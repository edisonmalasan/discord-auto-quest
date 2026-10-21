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

use crate::error::{AppError, AppResult};
use crate::quest::cdp::Session;
use crate::quest::discord;
use crate::quest::driver;
use crate::quest::reader::{self, QuestList, RunningGame};

/// What the application needs to know about Discord.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordStatus {
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

/// The application's connection to Discord.
#[derive(Default)]
pub struct DiscordState {
    session: Mutex<Option<Session>>,
}

impl DiscordState {
    /// Where Discord stands.
    pub async fn status(&self) -> DiscordStatus {
        let Some(install) = discord::Install::locate() else {
            return DiscordStatus {
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

        let action = if ready {
            None
        } else {
            Some(
                "Discord has to be restarted so the application can drive it. \
                 Restarting Discord ends whatever you are doing in it, so it is your call."
                    .to_string(),
            )
        };

        DiscordStatus {
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

    /// Run the quest script.
    ///
    /// The script is the payload, decrypted in memory. It is never written to
    /// disk, and it never leaves this machine.
    pub async fn run_script(&self) -> AppResult<bool> {
        let mut guard = self.session.lock().await;
        let session = guard.as_mut().ok_or_else(|| {
            AppError::not_supported("Discord has to be attached to before a quest can be worked")
        })?;

        driver::run(session).await?;

        driver::is_spoofing(session).await
    }

    /// Put Discord's own methods back.
    pub async fn stop_script(&self) -> AppResult<()> {
        let mut guard = self.session.lock().await;
        let Some(session) = guard.as_mut() else {
            return Ok(());
        };

        driver::stop(session).await
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

        reader::read_state(session).await
    }

    /// The games Discord believes are running.
    pub async fn running_games(&self) -> AppResult<Vec<RunningGame>> {
        Ok(self.quests().await?.running_games)
    }

    /// Whether the client is the desktop application, which the script needs.
    pub async fn is_desktop_app(&self) -> AppResult<bool> {
        let mut guard = self.session.lock().await;
        let Some(session) = guard.as_mut() else {
            return Ok(false);
        };

        driver::is_desktop_app(session).await
    }
}
