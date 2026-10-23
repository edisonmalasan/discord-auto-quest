//! Discord, from the application's point of view.
//!
//! This is the layer between the transport and the interface: where Discord
//! is, whether it can be used, and the one thing the user has to do about it.
//!
//! **The one thing the user has to do.** Discord only speaks the debugging
//! protocol when it is started with a debugging port, and it is not started
//! that way by default. So the application has to ask Discord to restart. That
//! ends whatever the user was doing in Discord — a voice call, most likely —
//! so the application never does it on its own: it says what is needed, and
//! the user decides.
//!
//! **One session, held.** The session is the application's connection to
//! Discord's renderer, and it is held for as long as the application is
//! running, because reading the quest state means asking Discord again and
//! again.

use serde::Serialize;
use tokio::sync::Mutex;

use crate::error::{AppError, AppResult, ErrorCode};
use crate::quest::cdp::Session;
use crate::quest::discord;
use crate::quest::driver;
use crate::quest::reader::{self, QuestList, RunningGame};

/// What the application needs to know about Discord.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordStatus {
    pub running: Option<bool>,
    /// Whether Discord is installed on this machine.
    pub installed: bool,
    /// Whether the application can talk to Discord right now.
    pub ready: bool,
    /// What the user has to do about it, in words. Nothing when there is
    /// nothing to do.
    pub action: Option<String>,
    /// Where Discord keeps its profile.
    pub profile: Option<String>,
}

#[cfg(test)]
mod recovery_tests {
    use super::*;
    use futures_util::{SinkExt, StreamExt};

    async fn operation_session(acknowledge_work: bool) -> (Session, tokio::task::JoinHandle<()>) {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let mut socket = tokio_tungstenite::accept_async(stream).await.unwrap();
            // Only imitate protocol replies. Never execute the supplied expressions.
            let replies = if acknowledge_work { 3 } else { 1 };
            for _ in 0..replies {
                let request = socket.next().await.unwrap().unwrap();
                let message: serde_json::Value =
                    serde_json::from_str(request.to_text().unwrap()).unwrap();
                socket.send(tokio_tungstenite::tungstenite::Message::Text(
                    serde_json::json!({"id":message["id"],"result":{"result":{"type":"boolean","value":true}}}).to_string().into()
                )).await.unwrap();
            }
            let _ = socket.next().await;
            if acknowledge_work {
                socket.close(None).await.unwrap();
            } else {
                tokio::time::sleep(std::time::Duration::from_secs(20)).await;
            }
        });
        (
            Session::connect(&format!("ws://127.0.0.1:{port}"))
                .await
                .unwrap(),
            server,
        )
    }

    #[tokio::test]
    async fn stalled_operations_release_the_session_and_report_uncertainty() {
        for work in [true, false] {
            let (session, server) = operation_session(false).await;
            let state = DiscordState {
                session: Mutex::new(Some(session)),
            };
            let result = tokio::time::timeout(std::time::Duration::from_secs(12), async {
                if work {
                    state.start_work().await.map(|_| ())
                } else {
                    state.stop_work().await
                }
            })
            .await;
            server.abort();
            let error = result
                .expect("operations must release recovery controls")
                .unwrap_err();
            assert_eq!(
                serde_json::to_value(error.code).unwrap(),
                "OPERATION_UNCERTAIN"
            );
            assert!(state.session.lock().await.is_none());
        }
    }

    #[tokio::test]
    async fn stalled_acceptance_releases_the_session_without_replaying() {
        let (session, server) = operation_session(false).await;
        let state = DiscordState {
            session: Mutex::new(Some(session)),
        };
        let result = tokio::time::timeout(
            std::time::Duration::from_secs(12),
            state.enrollment("123", Some("reviewed")),
        )
        .await;
        server.abort();
        let error = result
            .expect("acceptance must release recovery controls")
            .unwrap_err();
        assert!(matches!(error.code, ErrorCode::OperationUncertain));
        assert!(!error.retryable);
        assert!(state.session.lock().await.is_none());
    }

    #[tokio::test]
    async fn a_work_acknowledgment_failure_is_not_a_known_pre_dispatch_failure() {
        let (session, server) = operation_session(true).await;
        let state = DiscordState {
            session: Mutex::new(Some(session)),
        };
        let error = state.start_work().await.unwrap_err();
        assert_eq!(
            serde_json::to_value(error.code).unwrap(),
            "OPERATION_UNCERTAIN"
        );
        assert!(state.session.lock().await.is_none());
        server.await.unwrap();
    }

    #[tokio::test]
    async fn dropping_a_session_closes_its_websocket_reader() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let mut socket = tokio_tungstenite::accept_async(stream).await.unwrap();
            let request = socket.next().await.unwrap().unwrap();
            let message: serde_json::Value =
                serde_json::from_str(request.to_text().unwrap()).unwrap();
            socket
                .send(tokio_tungstenite::tungstenite::Message::Text(
                    serde_json::json!({"id":message["id"],"result":{}})
                        .to_string()
                        .into(),
                ))
                .await
                .unwrap();
            let next = tokio::time::timeout(std::time::Duration::from_secs(2), socket.next()).await;
            assert!(matches!(
                next,
                Ok(None)
                    | Ok(Some(Err(_)))
                    | Ok(Some(Ok(tokio_tungstenite::tungstenite::Message::Close(_))))
            ));
        });
        let session = Session::connect(&format!("ws://127.0.0.1:{port}"))
            .await
            .unwrap();
        drop(session);
        server.await.unwrap();
    }

    #[tokio::test]
    async fn stop_without_a_connection_does_not_report_a_false_success() {
        assert!(DiscordState::default().stop_work().await.is_err());
    }

    #[tokio::test]
    async fn an_unresponsive_quest_read_releases_the_connection_for_recovery() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let mut socket = tokio_tungstenite::accept_async(stream).await.unwrap();
            let request = socket.next().await.unwrap().unwrap();
            let message: serde_json::Value =
                serde_json::from_str(request.to_text().unwrap()).unwrap();
            socket
                .send(tokio_tungstenite::tungstenite::Message::Text(
                    serde_json::json!({"id":message["id"],"result":{}})
                        .to_string()
                        .into(),
                ))
                .await
                .unwrap();
            let _ = socket.next().await;
            tokio::time::sleep(std::time::Duration::from_secs(20)).await;
        });
        let session = Session::connect(&format!("ws://127.0.0.1:{port}"))
            .await
            .unwrap();
        let state = DiscordState {
            session: Mutex::new(Some(session)),
        };
        let result = tokio::time::timeout(std::time::Duration::from_secs(12), state.quests()).await;
        server.abort();
        assert!(result
            .expect("the quest read must time out itself so recovery controls are not held forever")
            .is_err());
        assert!(state.session.lock().await.is_none());
    }

    #[tokio::test]
    async fn a_closed_debugger_is_discarded_so_the_next_read_can_reattach() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let mut socket = tokio_tungstenite::accept_async(stream).await.unwrap();
            let request = socket.next().await.unwrap().unwrap();
            let message: serde_json::Value =
                serde_json::from_str(request.to_text().unwrap()).unwrap();
            socket
                .send(tokio_tungstenite::tungstenite::Message::Text(
                    serde_json::json!({"id":message["id"],"result":{}})
                        .to_string()
                        .into(),
                ))
                .await
                .unwrap();
            let _ = socket.next().await;
            socket.close(None).await.unwrap();
        });
        let session = Session::connect(&format!("ws://127.0.0.1:{port}"))
            .await
            .unwrap();
        let state = DiscordState {
            session: Mutex::new(Some(session)),
        };
        assert!(state.quests().await.is_err());
        assert!(
            state.session.lock().await.is_none(),
            "a closed session must not poison every subsequent read"
        );
        server.await.unwrap();
    }
}

/// The application's connection to Discord.
#[derive(Default)]
pub struct DiscordState {
    session: Mutex<Option<Session>>,
}

impl DiscordState {
    /// Review an offer or confirm a previously reviewed revision, on user request.
    pub async fn enrollment(
        &self,
        id: &str,
        revision: Option<&str>,
    ) -> AppResult<serde_json::Value> {
        let expression = crate::quest::enrollment::expression(id, revision)?;
        let mut guard = self.session.lock().await;
        let session = guard.as_mut().ok_or_else(|| {
            AppError::not_supported("Reconnect to Discord before reviewing an offer.")
        })?;
        let result = tokio::time::timeout(
            std::time::Duration::from_secs(10),
            session.evaluate(&expression),
        )
        .await;
        match result {
            Ok(Ok(value)) => crate::quest::enrollment::validate(value, id),
            _ => {
                *guard = None;
                Err(AppError::new(ErrorCode::OperationUncertain,
                    "Discord did not confirm the result. Reconnect and check your quests before trying again.", false))
            }
        }
    }

    /// Restart only on the user's request, and hold reads until the new
    /// renderer answers. A session from the old process is no longer usable.
    pub async fn restart(&self) -> AppResult<()> {
        let install = discord::Install::locate()
            .ok_or_else(|| AppError::not_supported("Discord is not installed on this machine"))?;
        let mut guard = self.session.lock().await;
        *guard = None;
        install.launch_with_debugger()?;
        *guard = Some(discord::attach_to_discord(&install).await?);
        Ok(())
    }

    /// Where Discord stands.
    pub async fn status(&self) -> DiscordStatus {
        let Some(install) = discord::Install::locate() else {
            return DiscordStatus {
                running: Some(false),
                installed: false,
                ready: false,
                action: Some(
                    "Discord is not installed on this machine, so there is nothing to work with."
                        .to_string(),
                ),
                profile: None,
            };
        };

        let profile = Some(discord::profile_directory(&install).display().to_string());
        let ready = install.debugger_is_reachable().await;
        let running = if ready {
            Some(true)
        } else {
            install.is_running()
        };

        let action = if ready {
            None
        } else if running == Some(false) {
            Some("Discord is closed. Restart Discord to open it so the application can read your quests.".to_string())
        } else {
            Some(
                "Discord has to be restarted so the application can drive it. \
                 Restarting Discord ends whatever you are doing in it, so it is your call."
                    .to_string(),
            )
        };

        DiscordStatus {
            running,
            installed: true,
            ready,
            action,
            profile,
        }
    }

    /// Attach to Discord's renderer.
    ///
    /// The session is kept, so that the application can keep asking Discord
    /// what is going on.
    pub async fn attach(&self) -> AppResult<()> {
        let install = discord::Install::locate()
            .ok_or_else(|| AppError::not_supported("Discord is not installed on this machine"))?;

        let session = discord::attach_to_discord(&install).await?;
        *self.session.lock().await = Some(session);

        Ok(())
    }

    /// Run the quest operation.
    ///
    /// The operation is the payload, decrypted in memory. It is never written to
    /// disk, and it never leaves this machine.
    pub async fn start_work(&self) -> AppResult<bool> {
        let mut guard = self.session.lock().await;
        let session = guard.as_mut().ok_or_else(|| {
            AppError::not_supported("Discord has to be attached to before a quest can be worked")
        })?;

        // The wrapper returns immediately after dispatch, rather than awaiting
        // quest completion. A missing reply is uncertainty, never permission
        // to run another payload. Cancel the transport wait, not renderer work.
        let result = tokio::time::timeout(std::time::Duration::from_secs(10), async {
            driver::run(session).await?;
            driver::is_spoofing(session).await
        })
        .await;
        match result {
            Ok(Ok(value)) => Ok(value),
            failure => {
                *guard = None;
                let cause = match failure {
                    Ok(Err(error)) => error.to_string(),
                    _ => "Discord stopped answering".to_string(),
                };
                Err(AppError::new(ErrorCode::OperationUncertain,
                    format!("Work outcome is unknown. Reconnect and try Stop before working again. ({cause})"), false))
            }
        }
    }

    /// Put Discord's own methods back.
    pub async fn stop_work(&self) -> AppResult<()> {
        let mut guard = self.session.lock().await;
        let Some(session) = guard.as_mut() else {
            return Err(AppError::network(
                "Discord is disconnected. Reconnect, then try Stop again.",
            ));
        };

        match tokio::time::timeout(std::time::Duration::from_secs(10), driver::stop(session)).await
        {
            Ok(Ok(())) => Ok(()),
            failure => {
                *guard = None;
                let cause = match failure {
                    Ok(Err(error)) => error.to_string(),
                    _ => "Discord stopped answering".to_string(),
                };
                Err(AppError::new(
                    ErrorCode::OperationUncertain,
                    format!("Stop could not be confirmed. Reconnect and try Stop again. ({cause})"),
                    true,
                ))
            }
        }
    }

    /// Read Discord's quest state.
    ///
    /// A connection is made if there is not one already: the application
    /// attaches on its own, so a connection that was lost — because Discord
    /// restarted, or because the client reloaded — is made again rather than
    /// reported as a failure the user cannot act on.
    pub async fn quests(&self) -> AppResult<QuestList> {
        if self.session.lock().await.is_none() {
            self.attach().await?;
        }

        let mut guard = self.session.lock().await;
        let session = guard.as_mut().ok_or_else(|| {
            AppError::not_supported("Discord has to be attached to before its quests can be read")
        })?;

        let result = match tokio::time::timeout(
            std::time::Duration::from_secs(10),
            reader::read_state(session),
        )
        .await
        {
            Ok(result) => result,
            Err(_) => Err(AppError::network(
                "Discord stopped answering the quest read. Try again to reconnect.",
            )),
        };
        if result.as_ref().is_err_and(|error| {
            matches!(
                error.code,
                ErrorCode::IoError | ErrorCode::NetworkUnavailable
            )
        }) {
            *guard = None;
        }
        result
    }

    /// The games Discord believes are running.
    pub async fn running_games(&self) -> AppResult<Vec<RunningGame>> {
        Ok(self.quests().await?.running_games)
    }

    /// Whether the client is the desktop application, which the operation needs.
    pub async fn is_desktop_app(&self) -> AppResult<bool> {
        let mut guard = self.session.lock().await;
        let Some(session) = guard.as_mut() else {
            return Ok(false);
        };

        driver::is_desktop_app(session).await
    }
}
