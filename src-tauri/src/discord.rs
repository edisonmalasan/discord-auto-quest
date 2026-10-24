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
            for reply in 0..replies {
                let request = socket.next().await.unwrap().unwrap();
                let message: serde_json::Value =
                    serde_json::from_str(request.to_text().unwrap()).unwrap();
                let value = match reply {
                    0 => serde_json::json!({}),
                    1 => super::continuous_tests::feed(&[("123", "claimed", 1)]),
                    _ => {
                        serde_json::json!({"phase":"stopped","questId":null,"taskKind":null,"message":null})
                    }
                };
                socket.send(tokio_tungstenite::tungstenite::Message::Text(
                    serde_json::json!({"id":message["id"],"result":{"result":{"type":"object","value":value}}}).to_string().into()
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
                ..Default::default()
            };
            if !work {
                state.work.lock().await.state.phase = WorkPhase::Paused;
            }
            let result = tokio::time::timeout(std::time::Duration::from_secs(12), async {
                if work {
                    state.start_work().await.map(|_| ())
                } else {
                    state.stop_work().await.map(|_| ())
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
            assert_eq!(state.work_status().await.phase, WorkPhase::Paused);
            assert!(state.start_work().await.is_err());
        }
    }

    #[tokio::test]
    async fn stalled_acceptance_releases_the_session_without_replaying() {
        let (session, server) = operation_session(false).await;
        let state = DiscordState {
            session: Mutex::new(Some(session)),
            ..Default::default()
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
            ..Default::default()
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
    async fn stop_without_an_owned_job_does_not_require_discord() {
        assert_eq!(
            DiscordState::default().stop_work().await.unwrap().phase,
            WorkPhase::Stopped
        );
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
            ..Default::default()
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
            ..Default::default()
        };
        assert!(state.quests().await.is_err());
        assert!(
            state.session.lock().await.is_none(),
            "a closed session must not poison every subsequent read"
        );
        server.await.unwrap();
    }
}

/// The application's serialized connection and continuous Work owner.
#[derive(Default)]
pub struct DiscordState {
    session: Mutex<Option<Session>>,
    operation: Mutex<()>,
    work: Mutex<crate::quest::work::Ledger>,
    event_sink: std::sync::RwLock<Option<WorkEventSink>>,
}

pub use crate::quest::work::{QuestCompleted, WorkEvent, WorkPhase, WorkState};
pub type WorkEventSink = std::sync::Arc<dyn Fn(WorkEvent) + Send + Sync>;

fn skip_message(
    work: &crate::quest::work::Ledger,
    list: &QuestList,
    waiting: bool,
) -> Option<String> {
    let skipped = work.skipped_count(list);
    (skipped > 0).then(|| format!("{}Skipped {skipped} accepted quest(s): expired, unsupported, or missing required task data.", if waiting { "Waiting for eligible accepted quests. " } else { "Working your accepted quests. " }))
}

impl DiscordState {
    pub fn set_event_sink(&self, sink: WorkEventSink) {
        *self
            .event_sink
            .write()
            .unwrap_or_else(|poison| poison.into_inner()) = Some(sink);
    }
    fn emit(&self, event: WorkEvent) {
        let sink = self
            .event_sink
            .read()
            .unwrap_or_else(|poison| poison.into_inner())
            .clone();
        if let Some(sink) = sink {
            sink(event);
        }
    }
    async fn emit_state(&self) -> WorkState {
        let state = self.work.lock().await.state.clone();
        self.emit(WorkEvent::State(state.clone()));
        state
    }
    pub async fn work_status(&self) -> WorkState {
        self.work.lock().await.state.clone()
    }
    async fn pause(&self, message: impl Into<String>) {
        let mut work = self.work.lock().await;
        work.enabled = false;
        work.state.phase = WorkPhase::Paused;
        work.state.message = Some(message.into());
        drop(work);
        self.emit_state().await;
    }
    async fn lost_connection(&self) {
        let active = self.work.lock().await.state.phase != WorkPhase::Stopped;
        if active {
            self.pause(
                "Discord disconnected. Reconnect and confirm Stop before starting Work again.",
            )
            .await;
        }
    }
    async fn attach_locked(&self) -> AppResult<()> {
        if self.session.lock().await.is_some() {
            return Ok(());
        }
        let install = discord::Install::locate()
            .ok_or_else(|| AppError::not_supported("Discord is not installed on this machine"))?;
        let session = discord::attach_to_discord(&install).await?;
        *self.session.lock().await = Some(session);
        Ok(())
    }
    pub async fn attach(&self) -> AppResult<()> {
        let _operation = self.operation.lock().await;
        self.attach_locked().await
    }
    /// Review and acceptance serialize with Work, but never start or resume it.
    pub async fn enrollment(
        &self,
        id: &str,
        revision: Option<&str>,
    ) -> AppResult<serde_json::Value> {
        let expression = crate::quest::enrollment::expression(id, revision)?;
        let _operation = self.operation.lock().await;
        let mut guard = self.session.lock().await;
        let session = guard.as_mut().ok_or_else(|| {
            AppError::not_supported("Reconnect to Discord before reviewing an offer.")
        })?;
        match tokio::time::timeout(
            std::time::Duration::from_secs(10),
            session.evaluate(&expression),
        )
        .await
        {
            Ok(Ok(value)) => crate::quest::enrollment::validate(value, id),
            _ => {
                *guard = None;
                drop(guard);
                self.lost_connection().await;
                Err(AppError::new(ErrorCode::OperationUncertain,"Discord did not confirm the result. Reconnect and check your quests before trying again.",false))
            }
        }
    }
    pub async fn restart(&self) -> AppResult<()> {
        let _operation = self.operation.lock().await;
        if self.work.lock().await.state.phase != WorkPhase::Stopped {
            return Err(AppError::not_supported(
                "Confirm Stop before restarting Discord.",
            ));
        }
        let install = discord::Install::locate()
            .ok_or_else(|| AppError::not_supported("Discord is not installed on this machine"))?;
        *self.session.lock().await = None;
        install.launch_with_debugger()?;
        *self.session.lock().await = Some(discord::attach_to_discord(&install).await?);
        Ok(())
    }
    pub async fn status(&self) -> DiscordStatus {
        let Some(install) = discord::Install::locate() else {
            return DiscordStatus {
                running: Some(false),
                installed: false,
                ready: false,
                action: Some(
                    "Discord is not installed on this machine, so there is nothing to work with."
                        .into(),
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
            Some("Discord is closed. Restart Discord to open it so the application can read your quests.".into())
        } else {
            Some("Discord has to be restarted so the application can drive it. Restarting Discord ends whatever you are doing in it, so it is your call.".into())
        };
        DiscordStatus {
            running,
            installed: true,
            ready,
            action,
            profile,
        }
    }
    async fn read_locked(&self) -> AppResult<QuestList> {
        let mut guard = self.session.lock().await;
        let session = guard.as_mut().ok_or_else(|| {
            AppError::network("Discord is disconnected. Reconnect before continuing.")
        })?;
        let result = tokio::time::timeout(
            std::time::Duration::from_secs(10),
            reader::read_state(session),
        )
        .await
        .unwrap_or_else(|_| {
            Err(AppError::network(
                "Discord stopped answering the quest read. Try again to reconnect.",
            ))
        });
        match result {
            Ok(list) => {
                drop(guard);
                let events = self.work.lock().await.observe(&list);
                for event in events {
                    self.emit(WorkEvent::Completed(event));
                }
                Ok(list)
            }
            Err(error) => {
                *guard = None;
                drop(guard);
                self.lost_connection().await;
                Err(error)
            }
        }
    }
    pub async fn quests(&self) -> AppResult<QuestList> {
        let _operation = self.operation.lock().await;
        self.attach_locked().await?;
        self.read_locked().await
    }
    pub async fn running_games(&self) -> AppResult<Vec<RunningGame>> {
        Ok(self.quests().await?.running_games)
    }
    pub async fn is_desktop_app(&self) -> AppResult<bool> {
        let _operation = self.operation.lock().await;
        let mut guard = self.session.lock().await;
        let Some(session) = guard.as_mut() else {
            return Ok(false);
        };
        tokio::time::timeout(
            std::time::Duration::from_secs(10),
            driver::is_desktop_app(session),
        )
        .await
        .unwrap_or_else(|_| Err(AppError::network("Discord stopped answering.")))
    }
    pub async fn start_work(&self) -> AppResult<WorkState> {
        let _operation = self.operation.lock().await;
        {
            let mut work = self.work.lock().await;
            if work.state.phase == WorkPhase::Paused {
                return Err(AppError::new(
                    ErrorCode::OperationUncertain,
                    "Confirm Stop before starting Work again.",
                    false,
                ));
            }
            if work.enabled {
                return Ok(work.state.clone());
            }
            if self.session.lock().await.is_none() {
                return Err(AppError::not_supported(
                    "Reconnect to Discord before starting Work.",
                ));
            }
            work.enabled = true;
            work.state.phase = WorkPhase::Starting;
            work.state.message = None;
        }
        self.emit_state().await;
        self.reconcile_locked().await
    }
    /// Called by the application-owned four-second background timer.
    pub async fn reconcile_work(&self) -> AppResult<WorkState> {
        let _operation = self.operation.lock().await;
        if !self.work.lock().await.enabled {
            return Ok(self.work_status().await);
        }
        self.reconcile_locked().await
    }
    async fn reconcile_locked(&self) -> AppResult<WorkState> {
        let list = match self.read_locked().await {
            Ok(list) => list,
            Err(error) => {
                let error = AppError::new(
                    ErrorCode::OperationUncertain,
                    format!("Work paused. Reconnect and confirm Stop. ({error})"),
                    false,
                );
                self.pause(error.message.clone()).await;
                return Err(error);
            }
        };
        let mut guard = self.session.lock().await;
        let Some(session) = guard.as_mut() else {
            drop(guard);
            self.pause("Work paused. Reconnect and confirm Stop.").await;
            return Err(AppError::network("Discord is disconnected."));
        };
        let result=tokio::time::timeout(std::time::Duration::from_secs(10),async {
            let runtime=driver::status(session).await?;
            let active=self.work.lock().await.state.active_quest_id.clone();
            if let Some(id)=active {
                let kind=self.work.lock().await.state.active_task_kind.clone();
                if runtime.quest_id.as_deref()!=Some(&id) || runtime.task_kind!=kind || runtime.phase!="working" {
                    return Err(AppError::new(ErrorCode::OperationUncertain,runtime.message.unwrap_or_else(||"The active runtime could not be confirmed. Use Stop before continuing.".into()),false));
                }
                let quest=list.claimed.iter().find(|q|q.id==id).ok_or_else(||AppError::new(ErrorCode::OperationUncertain,"The active quest disappeared. Confirm Stop before continuing.",false))?;
                if (quest.state==reader::QuestState::Completed && quest.completed_at.is_some()) || !quest.work_eligible {
                    driver::stop(session).await?;
                    let mut work=self.work.lock().await;work.state.active_quest_id=None;work.state.active_task_kind=None;
                } else {
                    let mut work=self.work.lock().await;work.state.queued_count=work.queue(&list).len();work.state.message=skip_message(&work,&list,false);
                    return Ok(());
                }
            } else if runtime.phase!="stopped" {
                return Err(AppError::new(ErrorCode::OperationUncertain,"An existing runtime must be stopped before starting Work.",false));
            }
            let next={let work=self.work.lock().await;let queue=work.queue(&list);queue.first().map(|q|(q.id.clone(),q.selected_task_kind.clone().unwrap(),queue.len()-1))};
            if let Some((id,kind,remaining))=next {
                {let mut work=self.work.lock().await;work.state.phase=WorkPhase::Starting;work.state.active_quest_id=Some(id.clone());work.state.active_task_kind=Some(kind.clone());work.state.queued_count=remaining;}
                self.emit_state().await;
                self.work.lock().await.manage(&id);
                driver::run_quest(session,&id,&kind).await?;
                let confirmed=driver::status(session).await?;
                if confirmed.phase!="working" || confirmed.quest_id.as_deref()!=Some(&id) || confirmed.task_kind.as_deref()!=Some(&kind) {
                    return Err(AppError::new(ErrorCode::OperationUncertain,"Discord did not confirm the active Work job.",false));
                }
                let mut work=self.work.lock().await;work.state.phase=WorkPhase::Working;work.state.message=skip_message(&work,&list,false);
            } else {
                let mut work=self.work.lock().await;work.state.phase=WorkPhase::Waiting;work.state.queued_count=0;work.state.message=skip_message(&work,&list,true);
            }
            Ok(())
        }).await;
        match result {
            Ok(Ok(())) => {
                drop(guard);
                Ok(self.emit_state().await)
            }
            failure => {
                *guard = None;
                drop(guard);
                let cause = match failure {
                    Ok(Err(error)) => error.to_string(),
                    _ => "Discord stopped answering".into(),
                };
                let error = AppError::new(
                    ErrorCode::OperationUncertain,
                    format!("Work paused. Reconnect and confirm Stop before continuing. ({cause})"),
                    false,
                );
                self.pause(error.message.clone()).await;
                Err(error)
            }
        }
    }
    /// Stop remains available in Paused. Unknown cancellation never permits new Work.
    pub async fn stop_work(&self) -> AppResult<WorkState> {
        let _operation = self.operation.lock().await;
        let stopped = self.work.lock().await.state.phase == WorkPhase::Stopped;
        if stopped {
            return Ok(self.work_status().await);
        }
        {
            let mut work = self.work.lock().await;
            work.enabled = false;
            work.state.phase = WorkPhase::Stopping;
            work.state.message = None;
        }
        self.emit_state().await;
        if let Err(error) = self.attach_locked().await {
            self.pause("Stop could not be confirmed. Reconnect and try Stop again.")
                .await;
            return Err(error);
        }
        let mut guard = self.session.lock().await;
        let result = tokio::time::timeout(
            std::time::Duration::from_secs(10),
            driver::stop(guard.as_mut().expect("attached above")),
        )
        .await;
        match result {
            Ok(Ok(())) => {
                drop(guard);
                self.work.lock().await.state = WorkState::default();
                Ok(self.emit_state().await)
            }
            failure => {
                *guard = None;
                drop(guard);
                let cause = match failure {
                    Ok(Err(error)) => error.to_string(),
                    _ => "Discord stopped answering".into(),
                };
                let error = AppError::new(
                    ErrorCode::OperationUncertain,
                    format!("Stop could not be confirmed. Reconnect and try Stop again. ({cause})"),
                    true,
                );
                self.pause(error.message.clone()).await;
                Err(error)
            }
        }
    }
}

#[cfg(test)]
mod continuous_tests {
    use super::*;
    use futures_util::{SinkExt, StreamExt};
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };
    pub(super) fn feed(rows: &[(&str, &str, u64)]) -> serde_json::Value {
        serde_json::json!({"available":[],"claimed":rows.iter().map(|(id,status,time)|serde_json::json!({
            "id":id,"name":id,"tasks":["WATCH_VIDEO"],"state":status,"progressSeconds":0,"targetSeconds":100,
            "selectedTaskKind":"WATCH_VIDEO","workEligible":*status=="claimed","enrolledAtMs":time,
            "completedAt":if *status=="completed"{Some("2026-10-24T01:00:00Z")}else{None},"taskDetails":[]
        })).collect::<Vec<_>>(),"desktopApp":true,"expired":0,"runningGames":[]})
    }
    async fn connected(
        snapshot: serde_json::Value,
    ) -> (
        DiscordState,
        Arc<Mutex<serde_json::Value>>,
        Arc<AtomicUsize>,
        tokio::task::JoinHandle<()>,
    ) {
        let snapshot = Arc::new(Mutex::new(snapshot));
        let reads = snapshot.clone();
        let dispatches = Arc::new(AtomicUsize::new(0));
        let count = dispatches.clone();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let mut socket = tokio_tungstenite::accept_async(stream).await.unwrap();
            let mut runtime = serde_json::json!({"phase":"stopped","questId":null,"taskKind":null,"message":null});
            while let Some(Ok(request)) = socket.next().await {
                if !request.is_text() {
                    continue;
                }
                let message: serde_json::Value =
                    serde_json::from_str(request.to_text().unwrap()).unwrap();
                let expression = message["params"]["expression"].as_str().unwrap_or("");
                let value = if expression.contains("const report =") {
                    reads.lock().await.clone()
                } else if expression.contains("window.__daqRequest =") {
                    count.fetch_add(1, Ordering::SeqCst);
                    let request = expression
                        .split("window.__daqRequest = ")
                        .nth(1)
                        .unwrap()
                        .split("; try")
                        .next()
                        .unwrap();
                    let request: serde_json::Value = serde_json::from_str(request).unwrap();
                    runtime = serde_json::json!({"phase":"working","questId":request["questId"],"taskKind":request["taskKind"],"message":null});
                    serde_json::json!({"accepted":true})
                } else if expression.contains("await owner.stop()") {
                    runtime = serde_json::json!({"phase":"stopped","questId":null,"taskKind":null,"message":null});
                    serde_json::json!({"stopped":true})
                } else {
                    runtime.clone()
                };
                if socket.send(tokio_tungstenite::tungstenite::Message::Text(serde_json::json!({"id":message["id"],"result":{"result":{"type":"object","value":value}}}).to_string().into())).await.is_err(){break;}
            }
        });
        let session = Session::connect(&format!("ws://127.0.0.1:{port}"))
            .await
            .unwrap();
        (
            DiscordState {
                session: Mutex::new(Some(session)),
                ..Default::default()
            },
            snapshot,
            dispatches,
            server,
        )
    }
    #[tokio::test]
    async fn starting_with_zero_quests_stays_waiting_until_explicit_stop() {
        let (state, _, dispatches, server) = connected(feed(&[])).await;
        let started = serde_json::to_value(state.start_work().await.unwrap()).unwrap();
        assert_eq!(started["phase"], "waiting");
        assert_eq!(dispatches.load(Ordering::SeqCst), 0);
        let stopped = serde_json::to_value(state.stop_work().await.unwrap()).unwrap();
        assert_eq!(stopped["phase"], "stopped");
        server.abort();
    }
    #[tokio::test]
    async fn waiting_rescans_new_acceptances_and_concurrent_starts_never_duplicate_a_job() {
        let (state, snapshot, dispatches, server) = connected(feed(&[])).await;
        assert_eq!(state.start_work().await.unwrap().phase, WorkPhase::Waiting);
        *snapshot.lock().await = feed(&[("new", "claimed", 20), ("old", "claimed", 10)]);
        let (one, two) = tokio::join!(state.reconcile_work(), state.start_work());
        assert_eq!(one.unwrap().active_quest_id.as_deref(), Some("old"));
        assert_eq!(two.unwrap().active_quest_id.as_deref(), Some("old"));
        assert_eq!(dispatches.load(Ordering::SeqCst), 1);
        assert_eq!(state.work_status().await.queued_count, 1);
        state.stop_work().await.unwrap();
        state.reconcile_work().await.unwrap();
        assert_eq!(dispatches.load(Ordering::SeqCst), 1);
        server.abort();
    }
    #[tokio::test]
    async fn discord_completion_cleans_up_before_the_next_job_and_emits_once() {
        let (state, snapshot, dispatches, server) = connected(feed(&[
            ("old", "claimed", 10),
            ("new", "claimed", 20),
            ("historical", "completed", 1),
        ]))
        .await;
        let completions = Arc::new(std::sync::Mutex::new(Vec::new()));
        let events = completions.clone();
        state.set_event_sink(Arc::new(move |event| {
            if let WorkEvent::Completed(quest) = event {
                events.lock().unwrap().push(quest.quest_id);
            }
        }));
        assert_eq!(
            state.start_work().await.unwrap().active_quest_id.as_deref(),
            Some("old")
        );
        assert!(completions.lock().unwrap().is_empty());
        // Full task progress without Discord's timestamp must retain the owner.
        let mut target = feed(&[("old", "claimed", 10), ("new", "claimed", 20)]);
        target["claimed"][0]["progressSeconds"] = serde_json::json!(100);
        *snapshot.lock().await = target;
        state.reconcile_work().await.unwrap();
        assert_eq!(dispatches.load(Ordering::SeqCst), 1);
        *snapshot.lock().await = feed(&[
            ("old", "completed", 10),
            ("new", "claimed", 20),
            ("historical", "completed", 1),
        ]);
        assert_eq!(
            state
                .reconcile_work()
                .await
                .unwrap()
                .active_quest_id
                .as_deref(),
            Some("new")
        );
        assert_eq!(dispatches.load(Ordering::SeqCst), 2);
        state.quests().await.unwrap();
        state.reconcile_work().await.unwrap();
        assert_eq!(*completions.lock().unwrap(), vec!["old"]);
        state.stop_work().await.unwrap();
        server.abort();
    }
    #[tokio::test]
    async fn an_ineligible_active_quest_is_cleaned_up_before_dispatching_the_next() {
        let (state, snapshot, dispatches, server) =
            connected(feed(&[("old", "claimed", 1), ("next", "claimed", 2)])).await;
        state.start_work().await.unwrap();
        let mut expired = feed(&[("old", "claimed", 1), ("next", "claimed", 2)]);
        expired["claimed"][0]["workEligible"] = serde_json::json!(false);
        *snapshot.lock().await = expired;
        let resumed = state.reconcile_work().await.unwrap();
        assert_eq!(resumed.active_quest_id.as_deref(), Some("next"));
        assert!(resumed.message.unwrap().contains("Skipped 1"));
        assert_eq!(dispatches.load(Ordering::SeqCst), 2);
        state.stop_work().await.unwrap();
        server.abort();
    }
    #[tokio::test]
    async fn disconnect_pauses_and_reattachment_does_not_redispatch_without_confirmed_stop() {
        let (state, _, dispatches, server) = connected(feed(&[("one", "claimed", 1)])).await;
        state.start_work().await.unwrap();
        server.abort();
        tokio::task::yield_now().await;
        assert!(state.reconcile_work().await.is_err());
        assert_eq!(state.work_status().await.phase, WorkPhase::Paused);
        assert!(state.start_work().await.is_err());
        assert_eq!(dispatches.load(Ordering::SeqCst), 1);
        let (reconnected, _, new_dispatches, new_server) =
            connected(feed(&[("one", "claimed", 1)])).await;
        *state.session.lock().await = reconnected.session.lock().await.take();
        state.reconcile_work().await.unwrap();
        assert_eq!(new_dispatches.load(Ordering::SeqCst), 0);
        assert!(state.start_work().await.is_err());
        assert_eq!(state.stop_work().await.unwrap().phase, WorkPhase::Stopped);
        state.start_work().await.unwrap();
        assert_eq!(new_dispatches.load(Ordering::SeqCst), 1);
        state.stop_work().await.unwrap();
        new_server.abort();
    }
}
