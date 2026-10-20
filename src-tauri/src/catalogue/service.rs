use std::future::Future;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::error::AppResult;

use super::cache::{self, CachedCatalogue};
use super::compact;
use super::fetch;
use super::model::{CatalogueSnapshot, CatalogueSource};
use super::stats;
use super::validate;

/// How long a cached catalogue is served before it is refreshed.
pub const DEFAULT_TTL: Duration = Duration::from_secs(24 * 60 * 60);

/// How long a single catalogue fetch may take before it is abandoned.
pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(20);

/// The source recorded on the cache. Discord's endpoint is the only one this app uses:
/// a mirror is operator-controlled and may drift.
const SOURCE_DISCORD: &str = "discord";

/// The catalogue service.
///
/// The pipeline is the documented one:
///
/// ```text
/// fetch (Discord → cached)  →  validate  →  compact  →  persist  →  serve
/// ```
///
/// Discord is tried first because it is the source of truth. The cache is the
/// fallback, and it is served immediately when it exists, so a slow or failing
/// network never blocks start-up.
pub struct CatalogueService {
    client: reqwest::Client,
    dir: PathBuf,
    ttl: Duration,
    timeout: Duration,
    memory: Arc<RwLock<Option<CatalogueSnapshot>>>,
}

impl Clone for CatalogueService {
    fn clone(&self) -> Self {
        Self {
            client: self.client.clone(),
            dir: self.dir.clone(),
            ttl: self.ttl,
            timeout: self.timeout,
            memory: Arc::clone(&self.memory),
        }
    }
}

/// What a load produced.
#[derive(Debug, Clone)]
pub struct LoadOutcome {
    pub snapshot: CatalogueSnapshot,
    /// True when the served copy came from the cache and is past its refresh
    /// interval, so a background refresh should be started.
    pub needs_refresh: bool,
}

impl CatalogueService {
    pub fn new(dir: PathBuf, ttl: Duration) -> AppResult<Self> {
        Ok(Self {
            client: fetch::build_client()?,
            dir,
            ttl,
            timeout: DEFAULT_TIMEOUT,
            memory: Arc::new(RwLock::new(None)),
        })
    }

    /// The directory the cache lives in.
    pub fn dir(&self) -> &PathBuf {
        &self.dir
    }

    /// Serve the catalogue, preferring what is already on disk.
    pub async fn load(&self) -> AppResult<LoadOutcome> {
        self.load_with(|| fetch::fetch_text(&self.client, self.timeout))
            .await
    }

    /// Fetch from Discord, replacing whatever is cached.
    pub async fn refresh(&self) -> AppResult<CatalogueSnapshot> {
        self.refresh_with(|| fetch::fetch_text(&self.client, self.timeout))
            .await
    }

    /// The load path, with the network call injected so it can be tested.
    async fn load_with<F, Fut>(&self, fetcher: F) -> AppResult<LoadOutcome>
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = AppResult<String>>,
    {
        if let Some(snapshot) = self.memory_snapshot() {
            return Ok(LoadOutcome {
                snapshot,
                needs_refresh: false,
            });
        }

        // A cache that cannot be read is treated as no cache: the network is still
        // available, and the refresh below rewrites the file.
        let cached = cache::read(&self.dir).unwrap_or(None);

        if let Some(cached) = cached {
            let now = now_seconds();
            let stale = cache::is_stale(cached.fetched_at, self.ttl.as_secs(), now);
            let snapshot = CatalogueSnapshot {
                stats: stats::compute(&cached.entries, 0),
                entries: cached.entries,
                source: CatalogueSource::Cache,
                fetched_at: Some(cached.fetched_at),
                stale,
            };
            self.store(snapshot.clone());
            return Ok(LoadOutcome {
                snapshot,
                needs_refresh: stale,
            });
        }

        // Nothing cached: the network is the only way forward, and failing here is
        // reported explicitly rather than presented as an empty catalogue.
        let snapshot = self.refresh_with(fetcher).await?;
        Ok(LoadOutcome {
            snapshot,
            needs_refresh: false,
        })
    }

    /// The refresh path, with the network call injected so it can be tested.
    async fn refresh_with<F, Fut>(&self, fetcher: F) -> AppResult<CatalogueSnapshot>
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = AppResult<String>>,
    {
        let text = fetcher().await?;
        let (games, dropped) = validate::parse(&text)?;
        let entries = compact::compact(&games);
        let stats = stats::compute(&entries, dropped);
        let fetched_at = now_seconds();

        // A cache that cannot be written does not fail the refresh. The catalogue was
        // fetched and validated, which is what the caller asked for; the next refresh
        // tries the cache again.
        let _ = cache::write(
            &self.dir,
            &CachedCatalogue::new(fetched_at, SOURCE_DISCORD, entries.clone()),
        );

        let snapshot = CatalogueSnapshot {
            entries,
            stats,
            source: CatalogueSource::Network,
            fetched_at: Some(fetched_at),
            stale: false,
        };
        self.store(snapshot.clone());
        Ok(snapshot)
    }

    fn memory_snapshot(&self) -> Option<CatalogueSnapshot> {
        self.memory.read().ok().and_then(|guard| guard.clone())
    }

    /// The catalogue entry for an application, if the catalogue holds one.
    ///
    /// The lookup borrows the catalogue rather than copying it: a 25,000-entry
    /// snapshot is not something to clone to answer one question.
    pub fn entry(&self, app_id: &str) -> Option<crate::catalogue::model::CatalogEntry> {
        let guard = self.memory.read().ok()?;
        let snapshot = guard.as_ref()?;
        snapshot
            .entries
            .iter()
            .find(|entry| entry.id == app_id)
            .cloned()
    }

    /// Whether a catalogue is loaded at all.
    pub fn is_loaded(&self) -> bool {
        self.memory
            .read()
            .ok()
            .map(|guard| guard.is_some())
            .unwrap_or(false)
    }

    fn store(&self, snapshot: CatalogueSnapshot) {
        if let Ok(mut guard) = self.memory.write() {
            *guard = Some(snapshot);
        }
    }
}

pub fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalogue::model::{CatalogEntry, CatalogueSource};
    use crate::error::AppError;

    const PAYLOAD: &str = r#"[
        {"id":"1","name":"Alpha","executables":[{"os":"win32","name":"alpha.exe","is_launcher":false}]},
        {"id":"2","name":"Beta","executables":[]}
    ]"#;

    fn service(dir: &std::path::Path) -> CatalogueService {
        CatalogueService::new(dir.to_path_buf(), DEFAULT_TTL).expect("service")
    }

    fn entry() -> CatalogEntry {
        CatalogEntry {
            id: "1".into(),
            name: "Alpha".into(),
            aliases: Vec::new(),
            cover_image_hash: None,
            icon_hash: None,
            executables: Vec::new(),
            age_ratings: Vec::new(),
        }
    }

    #[tokio::test]
    async fn a_successful_fetch_is_served_and_cached() {
        let dir = tempfile::tempdir().expect("temp dir");
        let service = service(dir.path());

        let outcome = service
            .load_with(|| async { Ok(PAYLOAD.to_string()) })
            .await
            .expect("loaded");

        assert_eq!(outcome.snapshot.source, CatalogueSource::Network);
        assert_eq!(outcome.snapshot.entries.len(), 2);
        assert_eq!(outcome.snapshot.stats.questable, 1);
        assert!(!outcome.snapshot.stale);
        assert!(!outcome.needs_refresh);

        // The projection, not the raw payload, is what landed on disk.
        let cached = cache::read(dir.path()).expect("read").expect("present");
        assert_eq!(cached.entries.len(), 2);
    }

    #[tokio::test]
    async fn an_unreachable_endpoint_with_a_cache_serves_the_cache() {
        let dir = tempfile::tempdir().expect("temp dir");
        let service = service(dir.path());

        cache::write(
            dir.path(),
            &CachedCatalogue::new(now_seconds(), SOURCE_DISCORD, vec![entry()]),
        )
        .expect("written");

        let outcome = service
            .load_with(|| async { Err(AppError::network("the network is down")) })
            .await
            .expect("served from cache");

        assert_eq!(outcome.snapshot.source, CatalogueSource::Cache);
        assert_eq!(outcome.snapshot.entries.len(), 1);
        assert!(!outcome.needs_refresh, "a fresh cache needs no refresh");
    }

    #[tokio::test]
    async fn a_stale_cache_is_served_and_flagged_for_refresh() {
        let dir = tempfile::tempdir().expect("temp dir");
        let service = service(dir.path());

        let old = now_seconds().saturating_sub(DEFAULT_TTL.as_secs() + 60);
        cache::write(
            dir.path(),
            &CachedCatalogue::new(old, SOURCE_DISCORD, vec![entry()]),
        )
        .expect("written");

        let outcome = service
            .load_with(|| async { Err(AppError::network("the network is down")) })
            .await
            .expect("served from cache");

        assert_eq!(outcome.snapshot.source, CatalogueSource::Cache);
        assert!(outcome.snapshot.stale);
        assert!(outcome.needs_refresh);
    }

    #[tokio::test]
    async fn an_unreachable_endpoint_with_no_cache_is_an_explicit_error() {
        let dir = tempfile::tempdir().expect("temp dir");
        let service = service(dir.path());

        let error = service
            .load_with(|| async { Err(AppError::network("the network is down")) })
            .await
            .expect_err("reported");

        assert_eq!(error.code, crate::error::ErrorCode::NetworkUnavailable);
        assert!(error.retryable, "the user must be able to retry");
    }

    #[tokio::test]
    async fn an_unusable_payload_is_rejected_rather_than_served_as_empty() {
        let dir = tempfile::tempdir().expect("temp dir");
        let service = service(dir.path());

        let error = service
            .load_with(|| async { Ok("<html>not a catalogue</html>".to_string()) })
            .await
            .expect_err("reported");

        assert_eq!(error.code, crate::error::ErrorCode::InvalidPayload);
    }

    #[tokio::test]
    async fn the_second_load_is_served_from_memory() {
        let dir = tempfile::tempdir().expect("temp dir");
        let service = service(dir.path());

        service
            .load_with(|| async { Ok(PAYLOAD.to_string()) })
            .await
            .expect("first load");

        // The network call would fail on the second load; memory must answer instead.
        let outcome = service
            .load_with(|| async { Err(AppError::network("must not be called")) })
            .await
            .expect("second load");

        assert_eq!(outcome.snapshot.entries.len(), 2);
        assert_eq!(outcome.snapshot.source, CatalogueSource::Network);
    }

    #[tokio::test]
    async fn a_refresh_replaces_the_cache() {
        let dir = tempfile::tempdir().expect("temp dir");
        let service = service(dir.path());

        cache::write(
            dir.path(),
            &CachedCatalogue::new(1, SOURCE_DISCORD, vec![entry()]),
        )
        .expect("written");

        let snapshot = service
            .refresh_with(|| async { Ok(PAYLOAD.to_string()) })
            .await
            .expect("refreshed");

        assert_eq!(snapshot.source, CatalogueSource::Network);
        assert_eq!(snapshot.entries.len(), 2);

        let cached = cache::read(dir.path()).expect("read").expect("present");
        assert_eq!(cached.entries.len(), 2);
    }

    #[tokio::test]
    async fn a_failed_refresh_leaves_the_existing_cache_intact() {
        let dir = tempfile::tempdir().expect("temp dir");
        let service = service(dir.path());

        cache::write(
            dir.path(),
            &CachedCatalogue::new(1, SOURCE_DISCORD, vec![entry()]),
        )
        .expect("written");

        let error = service
            .refresh_with(|| async { Err(AppError::network("the network is down")) })
            .await
            .expect_err("reported");

        assert_eq!(error.code, crate::error::ErrorCode::NetworkUnavailable);
        let cached = cache::read(dir.path()).expect("read").expect("present");
        assert_eq!(cached.entries.len(), 1);
    }

    #[tokio::test]
    async fn a_corrupt_cache_does_not_stop_a_fetch() {
        let dir = tempfile::tempdir().expect("temp dir");
        let service = service(dir.path());

        std::fs::write(cache::path_in(dir.path()), "{ not json").expect("written");

        let outcome = service
            .load_with(|| async { Ok(PAYLOAD.to_string()) })
            .await
            .expect("loaded");

        assert_eq!(outcome.snapshot.source, CatalogueSource::Network);
        assert_eq!(outcome.snapshot.entries.len(), 2);
    }

    #[tokio::test]
    async fn a_corrupt_cache_with_no_network_reports_the_network_failure() {
        let dir = tempfile::tempdir().expect("temp dir");
        let service = service(dir.path());

        std::fs::write(cache::path_in(dir.path()), "{ not json").expect("written");

        let error = service
            .load_with(|| async { Err(AppError::network("the network is down")) })
            .await
            .expect_err("reported");

        assert_eq!(error.code, crate::error::ErrorCode::NetworkUnavailable);
    }
}
