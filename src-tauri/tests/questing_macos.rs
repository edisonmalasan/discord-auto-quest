//! Questing on macOS, end to end, against a real runner.
//!
//! On macOS, Discord's local integration detects an *application*, not a bare
//! executable. A stub is therefore a real `.app` bundle, launched the way macOS
//! launches applications, and it shows a window while it runs.
//!
//! These tests run on a Mac. They need a window server, so they are skipped on
//! a machine with no display.

#![cfg(target_os = "macos")]

use std::path::PathBuf;
use std::time::Duration;

use discord_auto_quest_lib::catalogue::cache::{self, CachedCatalogue};
use discord_auto_quest_lib::catalogue::model::{
    CatalogEntry, CatalogExecutable, CatalogueSnapshot, CatalogueSource,
};
use discord_auto_quest_lib::catalogue::service::CatalogueService;
use discord_auto_quest_lib::quest::service::{QuestRequest, QuestService};

/// The application id the entry belongs to.
const APP_ID: &str = "1";

/// The registered path the entry carries: a macOS application bundle.
const REGISTERED_PATH: &str = "osx64/dota2.app";

fn entry() -> CatalogEntry {
    CatalogEntry {
        id: APP_ID.to_string(),
        name: "Dota 2".to_string(),
        aliases: Vec::new(),
        cover_image_hash: None,
        icon_hash: None,
        executables: vec![CatalogExecutable {
            os: "darwin".to_string(),
            path: REGISTERED_PATH.to_string(),
            is_launcher: false,
        }],
        age_ratings: Vec::new(),
    }
}

/// A service whose catalogue is already loaded, with no network involved.
async fn services(data_dir: &std::path::Path) -> (CatalogueService, QuestService) {
    let snapshot = CatalogueSnapshot {
        entries: vec![entry()],
        stats: discord_auto_quest_lib::catalogue::model::CatalogueStats {
            total: 1,
            questable: 1,
            not_questable: 0,
            questable_ratio: 1.0,
            platform_splits: vec![discord_auto_quest_lib::catalogue::model::PlatformSplit {
                os: "darwin".to_string(),
                executables: 1,
            }],
            with_cover_art: 0,
            with_icon: 0,
            with_aliases: 0,
            dropped_entries: 0,
        },
        source: CatalogueSource::Cache,
        fetched_at: Some(1_700_000_000),
        stale: false,
    };

    let cached = CachedCatalogue {
        schema_version: cache::CACHE_SCHEMA_VERSION,
        fetched_at: 1_700_000_000,
        source: "discord".to_string(),
        entries: snapshot.entries.clone(),
    };
    cache::write(data_dir, &cached).expect("the cache is written");

    let catalogue = CatalogueService::new(data_dir.to_path_buf(), Duration::from_secs(3600))
        .expect("the catalogue service builds");
    let quests = QuestService::new(catalogue.clone(), data_dir.to_path_buf());

    catalogue
        .load()
        .await
        .expect("the catalogue loads from the cache");

    (catalogue, quests)
}

/// Whether a process is still running, read from the process table.
///
/// macOS has no `/proc`, so the system is asked instead.
fn is_alive(pid: u32) -> bool {
    let output = std::process::Command::new("/bin/ps")
        .args(["-p", &pid.to_string(), "-o", "pid="])
        .output();

    match output {
        Ok(out) => !String::from_utf8_lossy(&out.stdout).trim().is_empty(),
        Err(_) => false,
    }
}

#[tokio::test]
async fn a_quest_writes_a_real_application_bundle_and_runs_it() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let (_catalogue, quests) = services(dir.path()).await;

    let view = quests
        .start(&QuestRequest {
            app_id: APP_ID.to_string(),
            registered_path: REGISTERED_PATH.to_string(),
        })
        .expect("the quest starts");

    // The stub is a bundle, named after what Discord registered, extension and
    // all: the name is what the match is on.
    let expected = dir
        .path()
        .join("games")
        .join(APP_ID)
        .join("osx64")
        .join("dota2.app");
    assert_eq!(PathBuf::from(&view.stub_path), expected);
    assert!(expected.is_dir(), "the bundle is a directory");
    assert!(
        expected.join("Contents").join("Info.plist").is_file(),
        "the property list is where macOS looks for it"
    );
    assert!(
        expected
            .join("Contents")
            .join("MacOS")
            .join("dota2")
            .is_file(),
        "the runner is where macOS looks for it"
    );

    assert!(view.pid > 0);
    assert!(is_alive(view.pid), "the stub is running");
    assert!(view.running);

    quests.stop(&view.id).expect("the quest stops");
    assert!(!is_alive(view.pid), "the stub is gone");
}

#[tokio::test]
async fn the_property_list_carries_this_projects_own_identifier() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let (_catalogue, quests) = services(dir.path()).await;

    let view = quests
        .start(&QuestRequest {
            app_id: APP_ID.to_string(),
            registered_path: REGISTERED_PATH.to_string(),
        })
        .expect("the quest starts");

    let plist = std::fs::read_to_string(
        PathBuf::from(&view.stub_path)
            .join("Contents")
            .join("Info.plist"),
    )
    .expect("the property list is readable");

    assert!(
        plist.contains("com.edisonmalasan.discord-auto-quest.stub"),
        "the bundle identifies itself as this project's"
    );
    assert!(
        plist.contains("<string>APPL</string>"),
        "the property list says it is an application"
    );
    assert!(
        plist.contains("<string>dota2</string>"),
        "the property list names the executable inside the bundle"
    );

    quests.stop(&view.id).expect("the quest stops");
}

#[tokio::test]
async fn stopping_a_quest_terminates_the_launched_application() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let (_catalogue, quests) = services(dir.path()).await;

    let view = quests
        .start(&QuestRequest {
            app_id: APP_ID.to_string(),
            registered_path: REGISTERED_PATH.to_string(),
        })
        .expect("the quest starts");

    assert!(is_alive(view.pid), "the application is running");

    quests.stop(&view.id).expect("the quest stops");

    // The application is asked to stop, and it is given a moment to do so.
    let deadline = std::time::Instant::now() + Duration::from_secs(5);
    while std::time::Instant::now() < deadline && is_alive(view.pid) {
        std::thread::sleep(Duration::from_millis(50));
    }

    assert!(!is_alive(view.pid), "the application is gone");
}
