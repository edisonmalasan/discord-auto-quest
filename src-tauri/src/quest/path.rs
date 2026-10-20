//! The path a stub is written to.
//!
//! Discord matches the running process against the **registered executable path**,
//! not against a file name, so the stub has to sit at the same shape of path. The
//! path is therefore built from the catalogue's own path, segment by segment, with
//! the file's extension removed — the asymmetry Discord expects.
//!
//! Every segment is checked before anything touches the filesystem. The catalogue
//! carries paths that the filesystem will not accept, and a name like `>hl2_osx`
//! or `va-11 hall-a/runner"` has to be refused rather than silently written
//! somewhere else.

use std::path::{Component, Path, PathBuf};

use crate::error::{AppError, AppResult};

/// Characters that are illegal in a Windows path component.
const ILLEGAL_CHARACTERS: [char; 7] = ['<', '>', ':', '"', '|', '?', '*'];

/// Device names Windows reserves, whatever the extension.
const RESERVED_NAMES: [&str; 22] = [
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// The path a stub takes for a registered executable.
///
/// The segments are the registered path's own segments, with the file's extension
/// removed from the last one. `_retail_/overwatch.exe` becomes
/// `_retail_/overwatch`.
pub fn segments(registered_path: &str) -> AppResult<Vec<String>> {
    let trimmed = registered_path.trim();

    if trimmed.is_empty() {
        return Err(AppError::invalid_path(
            "the registered path is empty, so there is nothing to mirror",
        ));
    }

    let mut segments: Vec<String> = Vec::new();

    for raw in trimmed.split('/') {
        if raw.is_empty() {
            return Err(AppError::invalid_path(format!(
                "the registered path `{trimmed}` has an empty segment"
            )));
        }

        check_segment(raw, trimmed)?;
        segments.push(raw.to_string());
    }

    // The file's extension is stripped. Discord's match is asymmetric: the
    // registered path has one, and the stub on disk does not.
    if let Some(last) = segments.last_mut() {
        if let Some((stem, _)) = last.rsplit_once('.') {
            if !stem.is_empty() {
                *last = stem.to_string();
            }
        }
    }

    Ok(segments)
}

/// The path the stub is written to, under the games root.
pub fn stub_path(games_root: &Path, app_id: &str, segments: &[String]) -> PathBuf {
    let mut path = games_root.join(app_id);
    for segment in segments {
        path = path.join(segment);
    }
    path
}

/// The segments of a registered path, with the extension kept.
///
/// A macOS application bundle is named after the registered path, extension and
/// all, because the bundle's name is what Discord's match is on. The extension is
/// stripped from the executable *inside* the bundle instead.
pub fn raw_segments(registered_path: &str) -> AppResult<Vec<String>> {
    let trimmed = registered_path.trim();

    if trimmed.is_empty() {
        return Err(AppError::invalid_path(
            "the registered path is empty, so there is nothing to mirror",
        ));
    }

    let mut segments: Vec<String> = Vec::new();

    for raw in trimmed.split('/') {
        if raw.is_empty() {
            return Err(AppError::invalid_path(format!(
                "the registered path `{trimmed}` has an empty segment"
            )));
        }

        check_segment(raw, trimmed)?;
        segments.push(raw.to_string());
    }

    Ok(segments)
}

/// Check that the resolved path is still inside the games root.
///
/// The segments are checked individually, so this should never fire. It is here
/// because the cost of being wrong is a stub written outside the user's own space.
pub fn ensure_inside(root: &Path, path: &Path) -> AppResult<()> {
    let relative = path.strip_prefix(root).map_err(|_| {
        AppError::invalid_path("the stub path would fall outside the games directory")
    })?;

    for component in relative.components() {
        match component {
            Component::Normal(_) | Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(AppError::invalid_path(
                    "the stub path would fall outside the games directory",
                ));
            }
        }
    }

    Ok(())
}

/// Refuse a segment the filesystem will not accept.
fn check_segment(segment: &str, whole: &str) -> AppResult<()> {
    if let Some(character) = segment
        .chars()
        .find(|character| ILLEGAL_CHARACTERS.contains(character) || character.is_control())
    {
        return Err(AppError::invalid_path(format!(
            "the registered path `{whole}` contains `{character}`, which the filesystem will not accept"
        )));
    }

    if segment == "." || segment == ".." {
        return Err(AppError::invalid_path(format!(
            "the registered path `{whole}` contains `{segment}`"
        )));
    }

    if segment.ends_with(' ') || segment.ends_with('.') {
        return Err(AppError::invalid_path(format!(
            "the registered path `{whole}` contains `{segment}`, which Windows would silently change"
        )));
    }

    let stem = segment
        .split('.')
        .next()
        .unwrap_or(segment)
        .to_ascii_uppercase();
    if RESERVED_NAMES.contains(&stem.as_str()) {
        return Err(AppError::invalid_path(format!(
            "the registered path `{whole}` contains `{segment}`, which is a reserved device name"
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_extension_is_stripped_from_the_file_only() {
        assert_eq!(
            segments("_retail_/overwatch.exe").expect("accepted"),
            vec!["_retail_".to_string(), "overwatch".to_string()]
        );
    }

    #[test]
    fn a_directory_segment_keeps_its_extension() {
        assert_eq!(
            segments("bin.x86/game.exe").expect("accepted"),
            vec!["bin.x86".to_string(), "game".to_string()]
        );
    }

    #[test]
    fn a_file_without_an_extension_is_kept() {
        assert_eq!(
            segments("hoi4").expect("accepted"),
            vec!["hoi4".to_string()]
        );
    }

    #[test]
    fn a_path_with_no_extension_anywhere_is_kept_whole() {
        assert_eq!(
            segments("csgo_linux64").expect("accepted"),
            vec!["csgo_linux64".to_string()]
        );
    }

    #[test]
    fn a_real_illegal_character_is_refused() {
        let error = segments(">hl2_osx").expect_err("refused");
        assert_eq!(error.code, crate::error::ErrorCode::InvalidPath);
        assert!(error.message.contains('>'));
        assert!(!error.retryable, "the same path will always be refused");
    }

    #[test]
    fn a_real_illegal_quote_is_refused() {
        let error = segments("va-11 hall-a/runner\"").expect_err("refused");
        assert_eq!(error.code, crate::error::ErrorCode::InvalidPath);
    }

    #[test]
    fn an_empty_segment_is_refused() {
        assert!(segments("a//b").is_err());
        assert!(segments("/a").is_err());
    }

    #[test]
    fn a_traversal_segment_is_refused() {
        assert!(segments("../etc/passwd").is_err());
        assert!(segments("a/../b").is_err());
    }

    #[test]
    fn a_reserved_device_name_is_refused() {
        let error = segments("CON.txt").expect_err("refused");
        assert!(error.message.contains("reserved"));
    }

    #[test]
    fn a_trailing_dot_is_refused() {
        assert!(segments("game.").is_err());
    }

    #[test]
    fn an_empty_path_is_refused() {
        assert!(segments("   ").is_err());
    }

    #[test]
    fn the_stub_path_sits_under_the_games_root() {
        let path = stub_path(
            Path::new("/data/games"),
            "356875221078245376",
            &["_retail_".into(), "overwatch".into()],
        );
        assert_eq!(
            path,
            Path::new("/data/games/356875221078245376/_retail_/overwatch")
        );
    }

    #[test]
    fn a_path_outside_the_root_is_refused() {
        let root = Path::new("/data/games");
        let outside = Path::new("/data/games/../elsewhere/game");
        assert!(ensure_inside(root, outside).is_err());
        assert!(ensure_inside(root, Path::new("/data/games/app/game")).is_ok());
    }
}
