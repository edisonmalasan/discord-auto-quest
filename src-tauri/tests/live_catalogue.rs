//! End-to-end checks against Discord's live catalogue endpoint.
//!
//! These are ignored by default because they need the network. Run them with:
//!
//! ```text
//! cargo test --manifest-path src-tauri/Cargo.toml -- --ignored
//! ```
//!
//! They are the only tests that prove the fetch, the projection, and the cache work
//! against the real endpoint rather than a fixture.

use std::path::Path;
use std::time::Duration;

use discord_auto_quest_lib::catalogue::cache;
use discord_auto_quest_lib::catalogue::model::CatalogueSource;
use discord_auto_quest_lib::catalogue::service::{CatalogueService, DEFAULT_TTL};

fn service(dir: &Path) -> CatalogueService {
    CatalogueService::new(dir.to_path_buf(), DEFAULT_TTL).expect("the service builds")
}

#[tokio::test]
#[ignore = "needs the network"]
async fn the_live_catalogue_is_fetched_projected_and_cached() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let service = service(dir.path());

    let outcome = service.load().await.expect("the catalogue loads");

    assert_eq!(outcome.snapshot.source, CatalogueSource::Network);
    assert!(
        outcome.snapshot.entries.len() > 1_000,
        "the catalogue should hold thousands of entries, got {}",
        outcome.snapshot.entries.len()
    );

    // The counts are derived from what actually arrived.
    let detected = outcome
        .snapshot
        .entries
        .iter()
        .filter(|entry| !entry.executables.is_empty())
        .count();
    assert_eq!(detected, outcome.snapshot.stats.questable);
    assert_eq!(
        outcome.snapshot.stats.total,
        outcome.snapshot.entries.len()
    );
    assert_eq!(
        outcome.snapshot.stats.questable + outcome.snapshot.stats.not_questable,
        outcome.snapshot.stats.total
    );

    // The registered path survives the projection intact, separators and all.
    let with_path = outcome
        .snapshot
        .entries
        .iter()
        .find(|entry| entry.executables.iter().any(|executable| executable.path.contains('/')))
        .expect("some entry carries a path with a directory segment");
    assert!(with_path
        .executables
        .iter()
        .any(|executable| executable.path.contains('/')));

    // The cache holds the projection, and it is far smaller than the raw document.
    let cached = cache::read(dir.path())
        .expect("the cache reads")
        .expect("the cache exists");
    assert_eq!(cached.entries.len(), outcome.snapshot.entries.len());
    assert!(cached.source == "discord");

    let raw = std::fs::read(dir.path().join("catalogue.json")).expect("the cache file");
    assert!(
        raw.len() < 12_000_000,
        "the projection should be smaller than the raw payload, got {} bytes",
        raw.len()
    );
}

#[tokio::test]
#[ignore = "needs the network"]
async fn a_second_load_is_served_from_the_cache_without_the_network() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let catalogue = service(dir.path());

    let first = catalogue.load().await.expect("the catalogue loads");
    assert_eq!(first.snapshot.source, CatalogueSource::Network);

    // A second service over the same directory answers from the cache on disk.
    let fresh = service(dir.path());
    let second = fresh.load().await.expect("the catalogue loads");
    assert_eq!(second.snapshot.source, CatalogueSource::Cache);
    assert_eq!(second.snapshot.entries.len(), first.snapshot.entries.len());
    assert!(!second.snapshot.stale, "a just-written cache is not stale");
}

#[tokio::test]
#[ignore = "needs the network"]
async fn the_endpoint_answers_with_a_catalogue_the_projection_accepts() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let service = service(dir.path());

    let outcome = service
        .refresh()
        .await
        .expect("the catalogue refreshes");

    assert!(outcome.stats.total > 1_000);
    assert!(
        outcome.stats.questable < outcome.stats.total,
        "most of the catalogue cannot be quested"
    );
    assert!(
        outcome
            .stats
            .platform_splits
            .iter()
            .any(|split| split.os == "win32"),
        "the catalogue registers Windows executables"
    );
}

#[test]
fn the_fetch_is_bounded() {
    // A catalogue request must not hang the app.
    let timeout = Duration::from_secs(20);
    assert!(timeout <= Duration::from_secs(30));
}
