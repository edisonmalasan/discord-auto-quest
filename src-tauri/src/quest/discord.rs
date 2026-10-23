//! Finding Discord, and the debugger inside it.
//!
//! Discord is a Chromium application. It speaks the Chrome DevTools Protocol
//! when it is started with a remote debugging port, and that protocol is how
//! the quest operation gets into the renderer.
//!
//! This module knows where Discord is, whether it is running with a debugger,
//! and how to list the pages it exposes. It does not decide whether to
//! relaunch it — that is the user's call, and the caller asks first.

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

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

    /// Observe only the stable client's process name; never start or stop it.
    pub fn is_running(&self) -> Option<bool> {
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            std::process::Command::new("tasklist")
                .args(["/FI", "IMAGENAME eq Discord.exe", "/FO", "CSV", "/NH"])
                .creation_flags(0x08000000)
                .output()
                .ok()
                .filter(|output| output.status.success())
                .map(|output| process_list_has_discord(&String::from_utf8_lossy(&output.stdout)))
        }
        #[cfg(not(windows))]
        {
            None
        }
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
    ///
    /// **The launcher runs from its own directory, and the executable is named
    /// relatively.** That is how the Squirrel launcher works: it resolves the
    /// path it is given against the directory it was started in, so an
    /// absolute path makes it look for the executable in the wrong place and
    /// the client never comes up.
    ///
    /// **Any Discord already running is stopped first.** The launcher starts a
    /// new instance and hands over to the running one, so a launch while
    /// Discord is up leaves the old client running without a debugging port —
    /// and the port file points at a port nothing is listening on, which looks
    /// exactly like a client that cannot be reached.
    pub fn launch_with_debugger(&self) -> AppResult<()> {
        stop_running_discord();

        let directory = self.launcher.parent().ok_or_else(|| {
            AppError::io(format!(
                "the Discord launcher at {} has no directory to run from",
                self.launcher.display()
            ))
        })?;

        let executable = self.executable.file_name().ok_or_else(|| {
            AppError::io(format!(
                "the Discord executable at {} has no name",
                self.executable.display()
            ))
        })?;

        let mut command = std::process::Command::new(&self.launcher);
        command
            .current_dir(directory)
            .arg("--processStart")
            .arg(executable)
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

#[cfg(any(windows, test))]
fn process_list_has_discord(output: &str) -> bool {
    output.lines().any(|line| {
        line.split(',')
            .next()
            .is_some_and(|name| name.trim_matches('"').eq_ignore_ascii_case("Discord.exe"))
    })
}

/// Stop the Discord that is running, if any.
///
/// Only the stable channel's executable is stopped, and only by its own name:
/// the canary and the PTB builds have names of their own, and this application
/// only ever drives the install it found.
///
/// The caller has already asked the user. Restarting Discord ends whatever
/// they were doing in it — a voice call, most likely — which is why the
/// application never does it on its own.
#[cfg(windows)]
fn stop_running_discord() {
    let _ = std::process::Command::new("taskkill")
        .args(["/F", "/T", "/IM", "Discord.exe"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

/// There is no Discord to stop on this platform: the install is found on
/// Windows only.
#[cfg(not(windows))]
fn stop_running_discord() {}

/// The pages Discord's debugger exposes.
pub async fn list_targets(port: u16) -> AppResult<Vec<Target>> {
    let url = format!("http://127.0.0.1:{port}/json/list");

    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .no_proxy()
        .build()
        .map_err(|error| {
            AppError::network(format!("could not create the debugger probe: {error}"))
        })?
        .get(&url)
        .send()
        .await
        .map_err(|error| {
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
/// it is the one the quest operation has to run in.
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

/// Attach to Discord's renderer and hand the session back.
///
/// The session is kept, because reading the quest state means asking Discord
/// again and again, and running the operation means driving the same page.
pub async fn attach_to_discord(install: &Install) -> AppResult<Session> {
    wait_for_renderer(install, Duration::from_secs(30)).await
}

/// Launching Discord returns before its port file and renderer are ready.
/// Re-read the port on every attempt; the previous process's file can linger.
async fn wait_for_renderer(install: &Install, timeout: Duration) -> AppResult<Session> {
    let mut last_error = None;
    let result = tokio::time::timeout(timeout, async {
        loop {
            match attach_once(install).await {
                Ok(session) => return session,
                Err(error) => last_error = Some(error),
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
    })
    .await;

    result.map_err(|_| {
        AppError::network(format!(
            "Discord did not make its debugger and renderer ready within {} seconds. {}",
            timeout.as_secs(),
            last_error
                .map(|error| error.message)
                .unwrap_or_else(|| "The debugger did not respond.".to_string())
        ))
    })
}

async fn attach_once(install: &Install) -> AppResult<Session> {
    let port = install.debug_port().ok_or_else(|| {
        AppError::not_supported(
            "Discord is not running with a debugging port, so the quest operation cannot be run in it",
        )
    })?;

    let targets = list_targets(port).await?;
    let target = pick_renderer(&targets).ok_or_else(|| {
        AppError::not_supported("Discord's debugger exposes no page to run the quest operation in")
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

    #[test]
    fn the_process_probe_recognizes_only_the_stable_discord_executable() {
        assert!(process_list_has_discord(
            "\"Discord.exe\",\"123\",\"Console\""
        ));
        assert!(!process_list_has_discord(
            "\"DiscordCanary.exe\",\"123\",\"Console\""
        ));
        assert!(!process_list_has_discord("INFO: No tasks are running"));
    }

    #[tokio::test]
    async fn attaching_waits_for_the_new_port_and_a_renderer_after_restart() {
        use futures_util::{SinkExt, StreamExt};
        use std::io::{Read, Write};
        use std::time::Duration;

        let profile = std::env::temp_dir().join(format!("daq-restart-test-{}", std::process::id()));
        std::fs::create_dir_all(&profile).unwrap();
        let port_file = profile.join(DEVTOOLS_PORT_FILE);
        // Restart leaves a file pointing at the now-closed previous listener.
        let closed = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        std::fs::write(&port_file, closed.local_addr().unwrap().port().to_string()).unwrap();
        drop(closed);

        let websocket = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let websocket_port = websocket.local_addr().unwrap().port();
        let http = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        http.set_nonblocking(true).unwrap();
        let http_port = http.local_addr().unwrap().port();
        let server = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(150));
            std::fs::write(port_file, http_port.to_string()).unwrap();
            let deadline = std::time::Instant::now() + Duration::from_secs(10);
            let mut requests = 0;
            while std::time::Instant::now() < deadline {
                let Ok((mut stream, _)) = http.accept() else {
                    std::thread::sleep(Duration::from_millis(10));
                    continue;
                };
                stream.set_nonblocking(false).unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(1)))
                    .unwrap();
                let mut request = [0; 2048];
                match stream.read(&mut request) {
                    Ok(0) => continue,
                    Ok(_) => {}
                    Err(error)
                        if matches!(
                            error.kind(),
                            std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                        ) =>
                    {
                        continue
                    }
                    Err(error) => {
                        panic!("the test HTTP server could not read its request: {error}")
                    }
                }
                // The port opens before the main renderer exists.
                let body = if requests == 0 {
                    "[]".to_string()
                } else {
                    serde_json::json!([{
                        "id": "main", "type": "page", "url": "https://discord.com/app",
                        "webSocketDebuggerUrl": format!("ws://127.0.0.1:{websocket_port}")
                    }])
                    .to_string()
                };
                write!(
                    stream,
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                )
                .unwrap();
                requests += 1;
                if requests == 2 {
                    break;
                }
            }
        });
        let renderer = tokio::spawn(async move {
            let (stream, _) = websocket.accept().await.unwrap();
            let mut socket = tokio_tungstenite::accept_async(stream).await.unwrap();
            let request = socket.next().await.unwrap().unwrap();
            let command: serde_json::Value =
                serde_json::from_str(request.to_text().unwrap()).unwrap();
            assert_eq!(command["method"], "Runtime.enable");
            socket
                .send(tokio_tungstenite::tungstenite::Message::Text(
                    serde_json::json!({"id": command["id"], "result": {}})
                        .to_string()
                        .into(),
                ))
                .await
                .unwrap();
        });
        let install = Install {
            launcher: PathBuf::new(),
            executable: PathBuf::new(),
            user_data: profile.clone(),
        };
        let result =
            tokio::time::timeout(Duration::from_secs(8), attach_to_discord(&install)).await;
        renderer.abort();
        server.join().unwrap();
        std::fs::remove_dir_all(profile).unwrap();
        assert!(
            matches!(result, Ok(Ok(_))),
            "attaching must survive the old port and wait for the renderer"
        );
    }

    #[tokio::test]
    async fn an_unresponsive_debugger_does_not_hold_restart_forever() {
        let profile =
            std::env::temp_dir().join(format!("daq-restart-timeout-{}", std::process::id()));
        std::fs::create_dir_all(&profile).unwrap();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        std::fs::write(
            profile.join(DEVTOOLS_PORT_FILE),
            listener.local_addr().unwrap().port().to_string(),
        )
        .unwrap();
        let stalled = tokio::spawn(async move {
            let (_stream, _) = listener.accept().await.unwrap();
            std::future::pending::<()>().await;
        });
        let install = Install {
            launcher: PathBuf::new(),
            executable: PathBuf::new(),
            user_data: profile.clone(),
        };
        let result = tokio::time::timeout(
            Duration::from_secs(2),
            wait_for_renderer(&install, Duration::from_millis(100)),
        )
        .await;
        stalled.abort();
        std::fs::remove_dir_all(profile).unwrap();
        let error = match result {
            Ok(Err(error)) => error,
            _ => panic!("a stalled debugger must return a bounded, retryable failure"),
        };
        assert_eq!(error.code, crate::error::ErrorCode::NetworkUnavailable);
        assert!(error.retryable);
    }

    #[tokio::test]
    async fn a_stalled_status_probe_returns_instead_of_blocking_later_polls() {
        let profile =
            std::env::temp_dir().join(format!("daq-status-timeout-{}", std::process::id()));
        std::fs::create_dir_all(&profile).unwrap();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port_file = profile.join(DEVTOOLS_PORT_FILE);
        std::fs::write(
            &port_file,
            listener.local_addr().unwrap().port().to_string(),
        )
        .unwrap();
        let stalled = tokio::spawn(async move {
            let (_stream, _) = listener.accept().await.unwrap();
            std::future::pending::<()>().await;
        });
        let install = Install {
            launcher: PathBuf::new(),
            executable: PathBuf::new(),
            user_data: profile.clone(),
        };
        let result =
            tokio::time::timeout(Duration::from_secs(3), install.debugger_is_reachable()).await;
        stalled.abort();
        std::fs::remove_dir_all(profile).unwrap();
        assert!(
            matches!(result, Ok(false)),
            "status must finish even if the debugger never responds"
        );
    }

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
