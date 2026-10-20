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

use crate::error::{AppError, AppResult};

/// The `CREATE_NO_WINDOW` flag. The runner is a windowed binary already, so this
/// only makes sure a console can never appear.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

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

    let child = command.spawn().map_err(|error| {
        AppError::spawn_failed(format!(
            "the runner at {} could not be started: {error}",
            path.display()
        ))
    })?;

    let pid = child.id();
    Ok(Launched {
        pid,
        child: Some(child),
    })
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
#[cfg(target_os = "macos")]
pub fn launch_bundle(bundle: &Path, title: &str) -> AppResult<Launched> {
    let mut command = Command::new("open");
    command
        .arg("-n")
        .arg("-g")
        .arg("-a")
        .arg(bundle)
        .arg("--args")
        .arg("--title")
        .arg(title);

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

/// Find the process running a bundle's executable.
///
/// The bundle's executable has a path of its own, inside the bundle, and that
/// path is what identifies the process. This is the same rule the app uses on
/// Windows: the process is found by the exact path it was started from, never
/// by its name.
#[cfg(target_os = "macos")]
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
