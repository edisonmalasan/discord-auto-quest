//! Questing, end to end, against a real runner.
//!
//! These tests write a real stub to a real directory and run it. The runner is
//! three kilobytes and does nothing but sleep, so this is cheap and it is the only
//! way to prove the things that matter: that the stub lands at the mirrored path,
//! that stopping a quest stops *that* process, and that an illegal path is refused
//! before anything is written.

#![cfg(windows)]

use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::time::Duration;

use discord_auto_quest_lib::catalogue::cache::{self, CachedCatalogue};
use discord_auto_quest_lib::catalogue::model::{
    CatalogEntry, CatalogExecutable, CatalogueSnapshot, CatalogueSource,
};
use discord_auto_quest_lib::catalogue::service::CatalogueService;
use discord_auto_quest_lib::quest::service::{QuestRequest, QuestService};
use discord_auto_quest_lib::runner;

/// The application id the Overwatch entry belongs to.
const APP_ID: &str = "356875221078245376";

/// The application id the illegal-path entry belongs to.
const OTHER_APP_ID: &str = "70";

/// A registered path with a character the filesystem will not accept. The live
/// catalogue contains one, so this is not a hypothetical.
const ILLEGAL_PATH: &str = ">hl2_osx";

fn entry(id: &str, name: &str, path: &str) -> CatalogEntry {
    CatalogEntry {
        id: id.to_string(),
        name: name.to_string(),
        aliases: Vec::new(),
        cover_image_hash: None,
        icon_hash: None,
        executables: vec![CatalogExecutable {
            os: "win32".to_string(),
            path: path.to_string(),
            is_launcher: false,
        }],
        age_ratings: Vec::new(),
    }
}

/// A service whose catalogue is already loaded, with no network involved.
async fn services(data_dir: &Path) -> (CatalogueService, QuestService) {
    let snapshot = CatalogueSnapshot {
        entries: vec![entry(APP_ID, "Overwatch", "_retail_/overwatch.exe"), entry(OTHER_APP_ID, "HL2", ILLEGAL_PATH)],
        stats: discord_auto_quest_lib::catalogue::model::CatalogueStats {
            total: 2,
            questable: 2,
            not_questable: 0,
            questable_ratio: 1.0,
            platform_splits: vec![discord_auto_quest_lib::catalogue::model::PlatformSplit {
                os: "win32".to_string(),
                executables: 2,
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

    // The quest service resolves the registered path from the catalogue it holds, so
    // the catalogue has to be loaded before a quest can start.
    catalogue.load().await.expect("the catalogue loads from the cache");

    (catalogue, quests)
}

/// Whether a process is still running, read from the process table.
fn is_alive(pid: u32) -> bool {
    let output = Command::new("tasklist")
        .args(["/FI", &format!("PID eq {pid}"), "/NH", "/FO", "CSV"])
        .output();

    match output {
        Ok(out) => {
            let text = String::from_utf8_lossy(&out.stdout);
            text.contains(&format!("\"{pid}\""))
        }
        Err(_) => false,
    }
}

/// A copy of the runner, running from somewhere else, with the same file name.
fn decoy(directory: &Path) -> Child {
    std::fs::create_dir_all(directory).expect("the decoy directory is created");
    let path: PathBuf = directory.join(runner::FILE_NAME);
    std::fs::write(&path, runner::RUNNER).expect("the decoy is written");

    Command::new(&path)
        .spawn()
        .expect("the decoy starts")
}

#[tokio::test]
async fn a_quest_writes_the_stub_to_the_mirrored_path_and_runs_it() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let (_catalogue, quests) = services(dir.path()).await;

    let view = quests
        .start(&QuestRequest {
            app_id: APP_ID.to_string(),
            registered_path: "_retail_/overwatch.exe".to_string(),
        })
        .expect("the quest starts");

    // The path mirrors the registered path, with the file's extension removed.
    let expected = dir
        .path()
        .join("games")
        .join(APP_ID)
        .join("_retail_")
        .join("overwatch");
    assert_eq!(PathBuf::from(&view.stub_path), expected);
    assert!(expected.exists(), "the stub is written to disk");

    // The runner is running, and it is the process that was reported.
    assert!(view.pid > 0);
    assert!(is_alive(view.pid), "the stub is running");
    assert!(view.running);

    quests.stop(&view.id).expect("the quest stops");
    assert!(!is_alive(view.pid), "the stub is gone");
}

#[tokio::test]
async fn stopping_a_quest_leaves_a_process_with_the_same_name_alone() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let (_catalogue, quests) = services(dir.path()).await;

    let view = quests
        .start(&QuestRequest {
            app_id: APP_ID.to_string(),
            registered_path: "_retail_/overwatch.exe".to_string(),
        })
        .expect("the quest starts");

    // A second process with the same image name, standing in for the real game.
    let mut decoy = decoy(&dir.path().join("decoy"));
    assert!(is_alive(decoy.id()));

    quests.stop(&view.id).expect("the quest stops");

    assert!(!is_alive(view.pid), "the stub is gone");
    assert!(
        is_alive(decoy.id()),
        "a process with the same image name must not be touched"
    );

    let _ = decoy.kill();
    let _ = decoy.wait();
}

#[tokio::test]
async fn an_illegal_path_is_refused_and_nothing_is_written() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let (_catalogue, quests) = services(dir.path()).await;

    let error = quests
        .start(&QuestRequest {
            app_id: OTHER_APP_ID.to_string(),
            registered_path: ILLEGAL_PATH.to_string(),
        })
        .expect_err("the path is refused");

    assert_eq!(error.code, discord_auto_quest_lib::error::ErrorCode::InvalidPath);
    assert!(error.message.contains('>'), "the message names the character: {error}");

    // Nothing may be written for a path that was refused.
    let games = dir.path().join("games");
    let written = match std::fs::read_dir(&games) {
        Ok(entries) => entries.count(),
        Err(_) => 0,
    };
    assert_eq!(written, 0, "no stub may be written for a refused path");
}

#[tokio::test]
async fn a_path_the_catalogue_does_not_hold_is_refused() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let (_catalogue, quests) = services(dir.path()).await;

    let error = quests
        .start(&QuestRequest {
            app_id: APP_ID.to_string(),
            registered_path: "somewhere/else.exe".to_string(),
        })
        .expect_err("the path is refused");

    assert_eq!(
        error.code,
        discord_auto_quest_lib::error::ErrorCode::NotQuestable
    );
}

#[tokio::test]
async fn an_unknown_application_is_refused() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let (_catalogue, quests) = services(dir.path()).await;

    let error = quests
        .start(&QuestRequest {
            app_id: "999".to_string(),
            registered_path: "_retail_/overwatch.exe".to_string(),
        })
        .expect_err("the application is refused");

    assert_eq!(
        error.code,
        discord_auto_quest_lib::error::ErrorCode::NotQuestable
    );
}
