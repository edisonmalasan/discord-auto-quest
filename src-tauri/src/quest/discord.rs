//! Finding Discord, and the debugger inside it.
//!
//! Discord is a Chromium application. It speaks the Chrome DevTools Protocol
//! when it is started with a remote debugging port, and that protocol is how
//! the quest script gets into the renderer.
//!
//! This module knows where Discord is, whether it is running with a debugger,
//! and how to list the pages it exposes. It does not decide whether to
//! relaunch it — that is the user's call, and the caller asks first.

use std::path::{Path, PathBuf};
use std::process::Stdio;

use serde_json::Value;

use crate::error::{AppError, AppResult};
use crate::quest::cdp::{Session, Target};

/// Where Discord is installed, and where it keeps its data.
#[derive(Debug, Clone)]
pub struct Install {
    /// The launcher that starts Discord.
    pub launcher: PathBuf,
    /// Discord's own executable.
    pub executable: PathBuf,
    /// The directory Discord keeps its profile in.
    pub user_data: PathBuf,
}

/// The file Chromium writes the chosen debugging port into.
const DEVTOOLS_PORT_FILE: &str = "DevToolsActivePort";

impl Install {
    /// Find Discord on this machine.
    ///
    /// The Squirrel layout — which is what almost every install uses — puts
    /// Discord under the local application data, with `Update.exe` as the
    /// launcher. A machine-wide install is also looked for.
    pub fn locate() -> Option<Install> {
        let local = dirs::data_local_dir()?;
        let roaming = dirs::config_dir()?;

        let squirrel = local.join("Discord");
        let program_files = std::env::var_os("ProgramFiles")
            .map(PathBuf::from)
            .unwrap_or_else(|| local.join("Programs"));

        for root in [squirrel.clone(), program_files.join("Discord")] {
            let launcher = root.join("Update.exe");
            let executable = root.join("Discord.exe");

            if launcher.is_file() && executable.is_file() {
                return Some(Install {
                    launcher,
                    executable,
                    user_data: roaming.join("discord"),
                });
            }
        }

        None
    }

    /// The debugging port Discord is listening on, if it is listening on one.
    ///
    /// Chromium picks a free port when it is told to pick one, and writes it
    /// into the profile directory. The file holds the port on its first line.
    pub fn debug_port(&self) -> Option<u16> {
        let contents = std::fs::read_to_string(self.user_data.join(DEVTOOLS_PORT_FILE)).ok()?;

        contents.lines().next()?.trim().parse().ok()
    }

    /// Whether the debugger is answering right now.
    pub async fn debugger_is_reachable(&self) -> bool {
        match self.debug_port() {
            Some(port) => list_targets(port).await.is_ok(),
            None => false,
        }
    }

    /// Start Discord with a debugging port.
    ///
    /// The port is left for Chromium to choose, so two installations cannot
    /// collide and nothing has to be guessed at.
    pub fn launch_with_debugger(&self) -> AppResult<()> {
        let mut command = std::process::Command::new(&self.launcher);
        command
            .arg("--processStart")
            .arg(&self.executable)
            .arg("--process-start-args")
            .arg("--remote-debugging-port=0")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());

        command.spawn().map_err(|error| {
            AppError::io(format!(
                "Discord could not be started from {}: {error}",
                self.launcher.display()
            ))
        })?;

        Ok(())
    }
}

/// The pages Discord's debugger exposes.
pub async fn list_targets(port: u16) -> AppResult<Vec<Target>> {
    let url = format!("http://127.0.0.1:{port}/json/list");

    let response = reqwest::get(&url).await.map_err(|error| {
        AppError::network(format!(
            "the Discord debugger did not answer on port {port}: {error}"
        ))
    })?;

    let targets: Vec<Target> = response.json().await.map_err(|error| {
        AppError::invalid_payload(format!("the debugger's answer was not readable: {error}"))
    })?;

    Ok(targets)
}

/// Choose the page that is Discord's main window.
///
/// Discord exposes more than one page: the main window, popouts, and workers.
/// The main window is the one whose address is Discord's own application, and
/// it is the one the quest script has to run in.
pub fn pick_renderer(targets: &[Target]) -> Option<&Target> {
    let pages: Vec<&Target> = targets.iter().filter(|target| target.is_page()).collect();

    // The application window, in preference to anything else.
    if let Some(target) = pages.iter().find(|target| {
        let url = target.url.to_ascii_lowercase();
        url.starts_with("app://discord.com") || url.contains("discord.com/app")
    }) {
        return Some(target);
    }

    // Otherwise, a page that is not a popout.
    if let Some(target) = pages
        .iter()
        .find(|target| !target.url.to_ascii_lowercase().contains("popout"))
    {
        return Some(target);
    }

    pages.first().copied()
}

/// Attach to Discord's renderer and evaluate `expression` in it.
///
/// This is the whole of the mechanism in one call: find the page, connect to
/// it, and run the script.
pub async fn evaluate_in_discord(install: &Install, expression: &str) -> AppResult<Value> {
    let port = install.debug_port().ok_or_else(|| {
        AppError::not_supported(
            "Discord is not running with a debugging port, so the quest script cannot be run in it",
        )
    })?;

    let targets = list_targets(port).await?;
    let target = pick_renderer(&targets).ok_or_else(|| {
        AppError::not_supported("Discord's debugger exposes no page to run the quest script in")
    })?;

    let mut session = Session::connect(&target.web_socket_url).await?;
    session.evaluate(expression).await
}

/// Attach to Discord's renderer and hand the session back.
///
/// Used when the caller needs to keep reading what the page prints, which is
/// how the quest script's progress is followed.
pub async fn attach_to_discord(install: &Install) -> AppResult<Session> {
    let port = install.debug_port().ok_or_else(|| {
        AppError::not_supported(
            "Discord is not running with a debugging port, so the quest script cannot be run in it",
        )
    })?;

    let targets = list_targets(port).await?;
    let target = pick_renderer(&targets).ok_or_else(|| {
        AppError::not_supported("Discord's debugger exposes no page to run the quest script in")
    })?;

    Session::connect(&target.web_socket_url).await
}

/// The path of Discord's profile directory, for messages.
pub fn profile_directory(install: &Install) -> &Path {
    &install.user_data
}

#[cfg(test)]
mod tests {
    use super::*;

    fn target(id: &str, kind: &str, url: &str) -> Target {
        Target {
            id: id.to_string(),
            title: id.to_string(),
            kind: kind.to_string(),
            url: url.to_string(),
            web_socket_url: format!("ws://127.0.0.1:9222/devtools/page/{id}"),
        }
    }

    #[test]
    fn the_application_window_is_preferred() {
        let targets = vec![
            target("W", "worker", ""),
            target("P", "page", "app://discord.com/app"),
        ];

        assert_eq!(pick_renderer(&targets).map(|t| t.id.as_str()), Some("P"));
    }

    #[test]
    fn a_popout_is_not_the_main_window() {
        let targets = vec![
            target("pop", "page", "https://discord.com/popout"),
            target("main", "page", "app://discord.com/app"),
        ];

        assert_eq!(pick_renderer(&targets).map(|t| t.id.as_str()), Some("main"));
    }

    #[test]
    fn a_page_with_no_discord_address_is_still_usable() {
        let targets = vec![target("other", "page", "https://example.com/")];

        assert_eq!(
            pick_renderer(&targets).map(|t| t.id.as_str()),
            Some("other")
        );
    }

    #[test]
    fn no_pages_means_nothing_to_attach_to() {
        let targets = vec![target("W", "worker", "")];

        assert!(pick_renderer(&targets).is_none());
    }
}
