use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

use super::model::CatalogEntry;

/// Bumped whenever the on-disk shape changes in a way older builds cannot read.
pub const CACHE_SCHEMA_VERSION: u32 = 1;

const CACHE_FILE: &str = "catalogue.json";

/// What the catalogue cache holds.
///
/// The cache stores the **projection**, not the raw payload: the point of the cache
/// is to keep the 13 MB document out of memory and out of the download.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedCatalogue {
    pub schema_version: u32,
    /// Unix timestamp, in seconds, of when the data was fetched.
    pub fetched_at: u64,
    /// Where the data came from. Discord's endpoint is the only source this app uses.
    pub source: String,
    pub entries: Vec<CatalogEntry>,
}

impl CachedCatalogue {
    pub fn new(fetched_at: u64, source: &str, entries: Vec<CatalogEntry>) -> Self {
        Self {
            schema_version: CACHE_SCHEMA_VERSION,
            fetched_at,
            source: source.to_string(),
            entries,
        }
    }
}

pub fn path_in(dir: &Path) -> PathBuf {
    dir.join(CACHE_FILE)
}

/// Read the cache.
///
/// A missing cache is not an error — it is the normal first-run state. A cache that
/// cannot be parsed is reported, because silently treating it as absent would hide a
/// real problem behind a slow first fetch.
pub fn read(dir: &Path) -> AppResult<Option<CachedCatalogue>> {
    let path = path_in(dir);

    let text = match std::fs::read_to_string(&path) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(AppError::io(format!(
                "could not read the catalogue cache at {}: {error}",
                path.display()
            )))
        }
    };

    let cached: CachedCatalogue = serde_json::from_str(&text).map_err(|error| {
        AppError::io(format!(
            "the catalogue cache at {} could not be decoded: {error}",
            path.display()
        ))
    })?;

    // A cache written by an older build is treated as no cache. The app refetches.
    if cached.schema_version != CACHE_SCHEMA_VERSION {
        return Ok(None);
    }

    Ok(Some(cached))
}

/// Write the cache atomically.
///
/// The write goes to a temporary file that is then renamed over the target, so an
/// interrupted write can never leave a half-written catalogue behind.
pub fn write(dir: &Path, cached: &CachedCatalogue) -> AppResult<()> {
    std::fs::create_dir_all(dir)?;

    let path = path_in(dir);
    let temporary = path.with_extension("json.tmp");

    let text = serde_json::to_string(cached)?;
    std::fs::write(&temporary, text)?;
    std::fs::rename(&temporary, &path)?;

    Ok(())
}

/// Whether a cached copy is past the point where it should be refreshed.
pub fn is_stale(fetched_at: u64, ttl_seconds: u64, now: u64) -> bool {
    now.saturating_sub(fetched_at) > ttl_seconds
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalogue::model::CatalogEntry;

    fn entry() -> CatalogEntry {
        CatalogEntry {
            id: "1".into(),
            name: "Alpha".into(),
            aliases: vec!["A".into()],
            cover_image_hash: Some("cover".into()),
            icon_hash: None,
            executables: Vec::new(),
            age_ratings: vec!["esrb:3".into()],
        }
    }

    #[test]
    fn a_missing_cache_reads_as_none() {
        let dir = tempfile::tempdir().expect("temp dir");
        assert!(read(dir.path()).expect("no error").is_none());
    }

    #[test]
    fn a_cache_round_trips() {
        let dir = tempfile::tempdir().expect("temp dir");
        let cached = CachedCatalogue::new(1_700_000_000, "discord", vec![entry()]);
        write(dir.path(), &cached).expect("written");

        let loaded = read(dir.path()).expect("read").expect("present");
        assert_eq!(loaded.fetched_at, 1_700_000_000);
        assert_eq!(loaded.source, "discord");
        assert_eq!(loaded.entries, vec![entry()]);
    }

    #[test]
    fn writing_replaces_an_existing_cache() {
        let dir = tempfile::tempdir().expect("temp dir");
        write(
            dir.path(),
            &CachedCatalogue::new(1, "discord", vec![entry()]),
        )
        .expect("first");
        write(
            dir.path(),
            &CachedCatalogue::new(2, "discord", vec![entry()]),
        )
        .expect("second");

        let loaded = read(dir.path()).expect("read").expect("present");
        assert_eq!(loaded.fetched_at, 2);
    }

    #[test]
    fn the_temporary_file_is_not_left_behind() {
        let dir = tempfile::tempdir().expect("temp dir");
        write(
            dir.path(),
            &CachedCatalogue::new(1, "discord", vec![entry()]),
        )
        .expect("written");
        assert!(!dir.path().join("catalogue.json.tmp").exists());
    }

    #[test]
    fn a_cache_from_another_schema_version_is_treated_as_absent() {
        let dir = tempfile::tempdir().expect("temp dir");
        let mut cached = CachedCatalogue::new(1, "discord", vec![entry()]);
        cached.schema_version = CACHE_SCHEMA_VERSION + 1;
        write(dir.path(), &cached).expect("written");

        assert!(read(dir.path()).expect("read").is_none());
    }

    #[test]
    fn a_corrupt_cache_is_reported_rather_than_ignored() {
        let dir = tempfile::tempdir().expect("temp dir");
        std::fs::write(path_in(dir.path()), "{ not json").expect("written");
        let error = read(dir.path()).expect_err("reported");
        assert_eq!(error.code, crate::error::ErrorCode::IoError);
    }

    #[test]
    fn staleness_is_measured_against_the_refresh_interval() {
        assert!(!is_stale(1_000, 100, 1_050));
        assert!(is_stale(1_000, 100, 1_101));
        // A clock that has gone backwards must not make a fresh cache look stale.
        assert!(!is_stale(1_000, 100, 900));
    }
}
