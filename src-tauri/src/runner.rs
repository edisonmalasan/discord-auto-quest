//! The runner: the stub process the application launches in place of a game.
//!
//! Discord's local activity detection reports a game as running when it sees a
//! process whose image path matches the executable Discord has registered for that
//! application. That is the whole mechanism, so this process has exactly one job:
//! exist, at the right path, until it is stopped by the app.
//!
//! Its bytes are compiled into the application, so there is always one to write and
//! never a resource file to find.
//!
//! The runner is built per platform, because the platforms disagree about what a
//! running game looks like. Windows wants a bare executable and nothing else; macOS
//! wants an application bundle with a visible window, because Discord's macOS
//! integration detects applications rather than processes.

use std::path::Path;

use crate::error::{AppError, AppResult};

/// The Windows runner, embedded at build time.
#[cfg(windows)]
pub const RUNNER: &[u8] = include_bytes!(concat!(
    env!("OUT_DIR"),
    "/discord-auto-quest-runner.exe"
));

/// The macOS runner, embedded at build time.
#[cfg(target_os = "macos")]
pub const RUNNER: &[u8] = include_bytes!(concat!(
    env!("OUT_DIR"),
    "/discord-auto-quest-runner-macos"
));

/// There is no runner for this platform yet. The Linux runner is a separate
/// mechanism and lands with its own group.
#[cfg(not(any(windows, target_os = "macos")))]
pub const RUNNER: &[u8] = &[];

/// The runner's file name on disk.
///
/// The name is what the process is called, and it is what a user would see in a
/// process list next to the real game.
#[cfg(windows)]
pub const FILE_NAME: &str = "discord-auto-quest-runner.exe";

/// The macOS runner's file name on disk.
#[cfg(target_os = "macos")]
pub const FILE_NAME: &str = "discord-auto-quest-runner-macos";

/// The runner's file name on disk, where there is no runner.
#[cfg(not(any(windows, target_os = "macos")))]
pub const FILE_NAME: &str = "discord-auto-quest-runner";

/// Write the runner to `path`, creating the parent directories.
pub fn materialise(path: &Path) -> AppResult<()> {
    if RUNNER.is_empty() {
        return Err(AppError::not_supported(
            "no runner is built for this platform yet",
        ));
    }

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    std::fs::write(path, RUNNER)?;
    Ok(())
}

/// The size the runner occupies on disk, for the UI to report.
pub fn size() -> u64 {
    RUNNER.len() as u64
}

/// The path a stub takes for a registered executable, given the game's directory.
#[cfg(test)]
pub fn stub_path(
    games_root: &Path,
    app_id: &str,
    segments: &[String],
) -> std::path::PathBuf {
    let mut path = games_root.join(app_id);
    for segment in segments {
        path.push(segment);
    }
    path
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(windows)]
    fn the_embedded_runner_is_small() {
        assert!(
            size() < 300 * 1024,
            "the runner must be under 300 KB, got {} bytes",
            size()
        );
    }

    #[test]
    fn the_stub_path_mirrors_the_registered_segments() {
        let root = Path::new("/data/games");
        let path = stub_path(root, "356875221078245376", &["_retail_".into(), "overwatch".into()]);
        assert_eq!(
            path,
            Path::new("/data/games/356875221078245376/_retail_/overwatch")
        );
    }
}
