//! The macOS application bundle.
//!
//! On macOS, Discord's local integration detects an *application*, not a bare
//! executable. A file at the registered path is not enough: the path has to be a
//! real `.app` bundle, with a valid `Info.plist` inside it, and it has to be
//! launched the way macOS launches applications.
//!
//! This is therefore a second mechanism, not a variation on the Windows one.
//!
//! The layout is the one macOS expects:
//!
//! ```text
//! <games>/<app id>/<segments>/<name>.app/
//!     Contents/
//!         Info.plist
//!         MacOS/
//!             <name>            the runner
//! ```

use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};

/// The bundle identifier this project gives its stubs.
///
/// It is this project's own identifier, not another publisher's: the app does
/// not borrow anyone's identity.
pub const BUNDLE_IDENTIFIER: &str = "com.edisonmalasan.discord-auto-quest.stub";

/// The name of the property list inside a bundle.
const INFO_PLIST: &str = "Info.plist";

/// The directory inside a bundle that holds its executable.
const MACOS_DIRECTORY: &str = "MacOS";

/// The extension a macOS application bundle carries.
const BUNDLE_EXTENSION: &str = ".app";

/// A bundle on disk, and the executable inside it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Bundle {
    /// The bundle directory: the thing macOS launches, and the thing Discord
    /// matches.
    pub path: PathBuf,
    /// The executable inside the bundle.
    pub executable: PathBuf,
}

/// Whether a registered path names a macOS application bundle.
///
/// A path whose last segment ends in `.app` is a bundle. Everything else is an
/// ordinary executable, and is handled the same way as on any other platform.
pub fn is_bundle(registered_path: &str) -> bool {
    registered_path
        .rsplit('/')
        .next()
        .map(|name| name.to_ascii_lowercase().ends_with(BUNDLE_EXTENSION))
        .unwrap_or(false)
}

/// The bundle for a registered path, under the games root.
///
/// The segments are the registered path's own segments, with the last one keeping
/// its `.app` extension: the bundle is named after the thing Discord registered,
/// because the name is what the match is on. The executable inside carries the
/// name without the extension, which is the rule the other platforms follow.
pub fn layout(games_root: &Path, app_id: &str, segments: &[String]) -> AppResult<Bundle> {
    let (name, directories) = segments
        .split_last()
        .ok_or_else(|| AppError::invalid_path("the registered path has no segments"))?;

    let mut path = games_root.join(app_id);
    for directory in directories {
        path.push(directory);
    }
    path.push(name);

    let executable = path
        .join("Contents")
        .join(MACOS_DIRECTORY)
        .join(executable_name(name));

    Ok(Bundle { path, executable })
}

/// The name a bundle's executable carries: the bundle's name, without the
/// extension.
pub fn executable_name(bundle_name: &str) -> &str {
    bundle_name
        .strip_suffix(BUNDLE_EXTENSION)
        .or_else(|| bundle_name.strip_suffix(".APP"))
        .unwrap_or(bundle_name)
}

/// The path of a bundle's executable, given the bundle's path.
pub fn executable_path(bundle_path: &Path) -> PathBuf {
    let name = bundle_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();

    bundle_path
        .join("Contents")
        .join(MACOS_DIRECTORY)
        .join(executable_name(name))
}

/// The property list that makes the bundle an application.
///
/// The keys are the ones macOS reads to decide what the bundle is: what it is
/// called, what it runs, and what identifies it.
pub fn info_plist(display_name: &str, executable_name: &str) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>{display_name}</string>
    <key>CFBundleExecutable</key>
    <string>{executable_name}</string>
    <key>CFBundleIdentifier</key>
    <string>{BUNDLE_IDENTIFIER}</string>
    <key>CFBundleName</key>
    <string>{executable_name}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
"#,
        display_name = escape(display_name),
        executable_name = escape(executable_name),
        BUNDLE_IDENTIFIER = BUNDLE_IDENTIFIER,
    )
}

/// Escape the characters that are not allowed in a property list's text.
fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

/// The property list's path inside the bundle.
pub fn info_plist_path(bundle: &Bundle) -> PathBuf {
    bundle.path.join("Contents").join(INFO_PLIST)
}

/// Write the bundle: the directory, the runner, and the property list.
///
/// The runner bytes are the same for every bundle; only the file it is written
/// as changes, because macOS reads the name out of the property list.
pub fn create(bundle: &Bundle, display_name: &str, runner: &[u8]) -> AppResult<()> {
    let parent = bundle
        .executable
        .parent()
        .ok_or_else(|| AppError::io("the bundle has no parent directory"))?;

    std::fs::create_dir_all(parent)?;

    std::fs::write(&bundle.executable, runner)?;

    // The runner is an application: it has to be executable.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut permissions = std::fs::metadata(&bundle.executable)?.permissions();
        permissions.set_mode(0o755);
        std::fs::set_permissions(&bundle.executable, permissions)?;
    }

    let name = bundle
        .path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();

    std::fs::write(
        info_plist_path(bundle),
        info_plist(display_name, executable_name(name)),
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn segments(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn a_path_ending_in_app_is_a_bundle() {
        assert!(is_bundle("osx64/dota2.app"));
        assert!(is_bundle("albion-online.app"));
        assert!(is_bundle("chess2.app"));
    }

    #[test]
    fn an_ordinary_path_is_not_a_bundle() {
        assert!(!is_bundle("_retail_/overwatch.exe"));
        assert!(!is_bundle(">hl2_osx"));
        assert!(!is_bundle("move or die/love/osx32/love.app/contents/macos/love"));
    }

    #[test]
    fn the_bundle_keeps_the_registered_name() {
        let bundle = layout(
            Path::new("/games"),
            "42",
            &segments(&["osx64", "dota2.app"]),
        )
        .expect("a bundle");

        assert_eq!(
            bundle.path,
            PathBuf::from("/games/42/osx64/dota2.app"),
            "the bundle is named after the registered path"
        );
        assert_eq!(
            bundle.executable,
            PathBuf::from("/games/42/osx64/dota2.app/Contents/MacOS/dota2"),
            "the executable carries the name without its extension"
        );
    }

    #[test]
    fn the_property_list_names_the_bundle() {
        let plist = info_plist("Dota 2", "dota2");

        assert!(plist.contains("<key>CFBundleExecutable</key>"));
        assert!(plist.contains("<string>dota2</string>"));
        assert!(plist.contains("<key>CFBundlePackageType</key>"));
        assert!(plist.contains("<string>APPL</string>"));
        assert!(plist.contains("<key>CFBundleIdentifier</key>"));
        assert!(plist.contains(BUNDLE_IDENTIFIER));
    }

    #[test]
    fn the_property_list_escapes_the_display_name() {
        let plist = info_plist("Tom & Jerry <Deluxe>", "tom");

        assert!(plist.contains("Tom &amp; Jerry &lt;Deluxe&gt;"));
        assert!(!plist.contains("<Deluxe>"));
    }

    #[test]
    fn a_bundle_is_written_with_its_runner_and_its_property_list() {
        let dir = tempfile::tempdir().expect("a temp dir");
        let bundle = layout(dir.path(), "42", &segments(&["osx64", "dota2.app"])).expect("a bundle");

        create(&bundle, "Dota 2", b"runner bytes").expect("the bundle is written");

        assert!(bundle.path.is_dir(), "the bundle is a directory");
        assert_eq!(
            std::fs::read(&bundle.executable).expect("readable"),
            b"runner bytes",
            "the runner is written into the bundle"
        );

        let plist = std::fs::read_to_string(info_plist_path(&bundle)).expect("readable");
        assert!(plist.contains("<string>APPL</string>"));
        assert!(plist.contains("<string>dota2</string>"));
    }
}
