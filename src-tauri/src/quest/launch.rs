//! Starting a stub, on the platform that asks for it.
//!
//! The two platforms that ship a runner need different things from it:
//!
//! - On Windows, the stub is a bare executable at the mirrored path. It is
//!   launched directly, and the app holds a handle to the process it started.
//! - On macOS, the stub is a real application bundle. macOS does not launch a
//!   bundle's executable directly and call it an application, so the bundle is
//!   launched with `open`, and the process the app gets back is `open` itself
//!   rather than the runner.
//!
//! The macOS path is therefore a different mechanism, not a variation on the
//! Windows one, and it lives in its own module.

use std::path::Path;
use std::process::{Child, Command};
use std::time::Duration;

use crate::error::{AppError, AppResult};

/// The `CREATE_NO_WINDOW` flag. The runner is a windowed binary already, so this
/// only makes sure a console can never appear.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// The error a Unix system gives when a file is still open for writing.
///
/// Linux, macOS and the BSDs all use 26 for `ETXTBSY`.
#[cfg(unix)]
const TEXT_FILE_BUSY: i32 = 26;

/// How many times a busy start is tried again, and how long to wait between
/// tries.
///
/// The wait is short because the condition is short: it lasts only as long as
/// the process that inherited the write descriptor takes to start.
const BUSY_ATTEMPTS: u32 = 40;
const BUSY_BACKOFF: Duration = Duration::from_millis(2);

/// What a launch produced.
pub struct Launched {
    /// The process the app has to watch.
    pub pid: u32,
    /// The handle to the process, when the app started it itself and the
    /// platform gives it one.
    pub child: Option<Child>,
}

/// Launch a stub that is a bare executable at `path`.
///
/// The handle is kept: the process is this application's own child, and stopping
/// it through the handle is the most exact way to stop exactly that process.
pub fn launch_executable(path: &Path, title: &str) -> AppResult<Launched> {
    let mut attempt = 0;

    loop {
        match spawn_executable(path, title) {
            Ok(launched) => return Ok(launched),
            Err(error) => {
                if attempt >= BUSY_ATTEMPTS || !is_text_file_busy(&error) {
                    return Err(AppError::spawn_failed(format!(
                        "the runner at {} could not be started: {error}",
                        path.display()
                    )));
                }

                // The file was still open for writing by somebody else. That is
                // a transient condition — the write descriptor is released as
                // soon as the process holding it starts — so the start is
                // simply tried again.
                attempt += 1;
                std::thread::sleep(BUSY_BACKOFF);
            }
        }
    }
}

/// Start the stub, once.
fn spawn_executable(path: &Path, title: &str) -> Result<Launched, std::io::Error> {
    let mut command = Command::new(path);
    command
        .arg("--title")
        .arg(title)
        .current_dir(path.parent().unwrap_or(path));

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let child = command.spawn()?;

    let pid = child.id();
    Ok(Launched {
        pid,
        child: Some(child),
    })
}

/// Whether a start failed because the file was still open for writing.
///
/// Unix refuses to start a program from a file that anybody still holds open
/// for writing, and says so with `ETXTBSY`. It happens here because a process
/// started in another thread can inherit the descriptor the runner was written
/// with, and hold it for a moment after the writer has let go of it.
#[cfg(unix)]
fn is_text_file_busy(error: &std::io::Error) -> bool {
    error.raw_os_error() == Some(TEXT_FILE_BUSY)
}

/// Windows has no such error: a file that is open for writing can still be
/// started.
#[cfg(not(unix))]
fn is_text_file_busy(_error: &std::io::Error) -> bool {
    false
}

/// Launch a macOS application bundle.
///
/// `open -n` opens a new instance, `-g` opens it in the background so it does
/// not steal focus, and `-a` selects the application by path. The `--title` the
/// runner expects is forwarded after `--args`.
///
/// The process `open` returns is `open` itself, and it has already exited by the
/// time the bundle's runner is up. The runner's own process id is therefore found
/// afterwards, by the bundle's executable path.
pub fn launch_bundle(bundle: &Path, title: &str) -> AppResult<Launched> {
    let mut command = Command::new("open");
    command.args(open_arguments(bundle, title));

    let mut child = command.spawn().map_err(|error| {
        AppError::spawn_failed(format!(
            "the bundle at {} could not be opened: {error}",
            bundle.display()
        ))
    })?;

    // `open` exits as soon as the bundle has been handed to the system. Waiting
    // for it means the app is not left holding a process it knows nothing about.
    let _ = child.wait();

    let pid = find_bundle_process(bundle).ok_or_else(|| {
        AppError::spawn_failed(format!(
            "the bundle at {} was opened, but its runner could not be found",
            bundle.display()
        ))
    })?;

    Ok(Launched { pid, child: None })
}

/// The arguments `open` is given.
///
/// The command is written out rather than assembled in place, so the arguments
/// can be checked on a machine that has no `open` to run them with.
fn open_arguments(bundle: &Path, title: &str) -> Vec<String> {
    vec![
        "-n".to_string(),
        "-g".to_string(),
        "-a".to_string(),
        bundle.display().to_string(),
        "--args".to_string(),
        "--title".to_string(),
        title.to_string(),
    ]
}

/// Find the process running a bundle's executable.
///
/// The bundle's executable has a path of its own, inside the bundle, and that
/// path is what identifies the process. This is the same rule the app uses on
/// Windows: the process is found by the exact path it was started from, never
/// by its name.
fn find_bundle_process(bundle: &Path) -> Option<u32> {
    let executable = bundle
        .join("Contents")
        .join("MacOS")
        .join(bundle.file_name()?.to_str()?.trim_end_matches(".app"));

    let output = Command::new("/bin/ps")
        .args(["-A", "-o", "pid=", "-o", "comm="])
        .output()
        .ok()?;

    let wanted = executable.canonicalize().ok()?;
    let text = String::from_utf8_lossy(&output.stdout);

    for line in text.lines() {
        let mut parts = line.split_whitespace();
        let pid: u32 = match parts.next().and_then(|value| value.parse().ok()) {
            Some(pid) => pid,
            None => continue,
        };
        let path = match parts.next() {
            Some(path) => Path::new(path),
            None => continue,
        };
        if path == wanted {
            return Some(pid);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_bundle_is_opened_the_way_macos_opens_applications() {
        let arguments = open_arguments(Path::new("/games/dota2.app"), "Dota 2");

        assert_eq!(
            arguments,
            vec![
                "-n".to_string(),
                "-g".to_string(),
                "-a".to_string(),
                "/games/dota2.app".to_string(),
                "--args".to_string(),
                "--title".to_string(),
                "Dota 2".to_string(),
            ],
            "a new instance, in the background, selected by path, with the title forwarded"
        );
    }

    #[test]
    fn the_bundle_is_named_by_its_path_and_not_by_its_name() {
        let arguments = open_arguments(Path::new("/games/42/osx64/dota2.app"), "Dota 2");

        assert!(
            arguments.contains(&"/games/42/osx64/dota2.app".to_string()),
            "the bundle is selected by its path, so the path is what Discord matches"
        );
        assert!(
            !arguments.contains(&"dota2.app".to_string()),
            "the bundle is not selected by its name"
        );
    }

    #[test]
    fn a_file_that_is_open_for_writing_is_recognised() {
        #[cfg(unix)]
        {
            let busy = std::io::Error::from_raw_os_error(TEXT_FILE_BUSY);
            assert!(
                is_text_file_busy(&busy),
                "the error a Unix system gives for a busy file must be recognised"
            );

            let other = std::io::Error::from_raw_os_error(2);
            assert!(
                !is_text_file_busy(&other),
                "any other error must be reported as it is"
            );
        }
    }

    #[test]
    fn a_start_that_is_not_busy_is_not_retried() {
        // A file that is not there at all is not a busy file, and the error
        // reaches the caller unchanged rather than being retried into
        // something slower and less clear.
        let error = match launch_executable(Path::new("/nowhere/at/all/stub"), "Game") {
            Ok(_) => panic!("there is nothing to start"),
            Err(error) => error,
        };

        assert!(
            error.message.contains("could not be started"),
            "the error says what happened: {error}"
        );
    }
}
