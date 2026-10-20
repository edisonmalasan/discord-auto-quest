use std::path::PathBuf;

/// The per-user data directory name.
///
/// This is deliberately the product name rather than the Tauri identifier, so the
/// on-disk layout matches the documented contract:
///
/// ```text
/// %LOCALAPPDATA%\discord-auto-quest\          (Windows)
/// ~/Library/Application Support/discord-auto-quest/   (macOS)
/// $XDG_DATA_HOME/discord-auto-quest/           (Linux)
/// ```
pub const APP_DIR_NAME: &str = "discord-auto-quest";

/// Resolve the per-user data directory.
///
/// The application directory is read-only: everything this app writes — the catalogue
/// cache, the materialised stubs — belongs under here.
pub fn user_data_dir() -> Option<PathBuf> {
    resolve_user_data_dir(
        std::env::consts::OS,
        dirs::data_local_dir(),
        dirs::home_dir(),
        std::env::var_os("XDG_DATA_HOME").map(PathBuf::from),
    )
}

/// The pure resolution rule, split out so it can be tested without touching the
/// environment of the machine running the tests.
pub fn resolve_user_data_dir(
    os: &str,
    data_local_dir: Option<PathBuf>,
    home_dir: Option<PathBuf>,
    xdg_data_home: Option<PathBuf>,
) -> Option<PathBuf> {
    match os {
        "windows" => data_local_dir.map(|dir| dir.join(APP_DIR_NAME)),
        "macos" => home_dir.map(|home| {
            home.join("Library")
                .join("Application Support")
                .join(APP_DIR_NAME)
        }),
        _ => xdg_data_home
            .map(|dir| dir.join(APP_DIR_NAME))
            .or_else(|| home_dir.map(|home| home.join(".local").join("share").join(APP_DIR_NAME))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p(parts: &[&str]) -> PathBuf {
        parts.iter().collect()
    }

    #[test]
    fn windows_uses_the_local_app_data_directory() {
        let resolved = resolve_user_data_dir(
            "windows",
            Some(p(&[r"C:\Users\ed", "AppData", "Local"])),
            Some(p(&[r"C:\Users\ed"])),
            None,
        );
        assert_eq!(
            resolved,
            Some(p(&[r"C:\Users\ed", "AppData", "Local", APP_DIR_NAME]))
        );
    }

    #[test]
    fn macos_uses_application_support() {
        let resolved = resolve_user_data_dir(
            "macos",
            Some(p(&["/Users/ed/Library/Application Support"])),
            Some(p(&["/Users/ed"])),
            None,
        );
        assert_eq!(
            resolved,
            Some(p(&[
                "/Users/ed",
                "Library",
                "Application Support",
                APP_DIR_NAME
            ]))
        );
    }

    #[test]
    fn linux_prefers_xdg_data_home() {
        let resolved = resolve_user_data_dir(
            "linux",
            None,
            Some(p(&["/home/ed"])),
            Some(p(&["/home/ed/.local/share"])),
        );
        assert_eq!(resolved, Some(p(&["/home/ed/.local/share", APP_DIR_NAME])));
    }

    #[test]
    fn linux_falls_back_to_the_home_directory() {
        let resolved = resolve_user_data_dir("linux", None, Some(p(&["/home/ed"])), None);
        assert_eq!(
            resolved,
            Some(p(&["/home/ed", ".local", "share", APP_DIR_NAME]))
        );
    }

    #[test]
    fn an_unresolvable_environment_returns_none() {
        assert_eq!(resolve_user_data_dir("windows", None, None, None), None);
    }
}
