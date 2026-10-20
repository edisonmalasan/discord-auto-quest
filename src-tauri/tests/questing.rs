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
use discord_auto_quest_lib::quest::records::{self, QuestRecord};
use discord_auto_quest_lib::quest::service::{QuestRequest, QuestService};
use discord_auto_quest_lib::quest::QuestState;
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
        entries: vec![
            entry(APP_ID, "Overwatch", "_retail_/overwatch.exe"),
            entry(OTHER_APP_ID, "HL2", ILLEGAL_PATH),
        ],
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
    catalogue
        .load()
        .await
        .expect("the catalogue loads from the cache");

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
    runner::materialise(&path).expect("the decoy is written");

    Command::new(&path).spawn().expect("the decoy starts")
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

    assert_eq!(
        error.code,
        discord_auto_quest_lib::error::ErrorCode::InvalidPath
    );
    assert!(
        error.message.contains('>'),
        "the message names the character: {error}"
    );

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

#[tokio::test]
async fn a_quest_that_outlives_the_application_is_recovered_on_the_next_start() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let (catalogue, quests) = services(dir.path()).await;

    let view = quests
        .start(&QuestRequest {
            app_id: APP_ID.to_string(),
            registered_path: "_retail_/overwatch.exe".to_string(),
        })
        .expect("the quest starts");

    // The application is closed and opened again. The stub keeps running: it is
    // not a child of the app, and the app does not own it any more.
    drop(quests);
    drop(catalogue);

    let (_catalogue, quests) = services(dir.path()).await;
    let list = quests.list();

    assert!(
        list.error.is_none(),
        "the records were readable, so there is nothing to report"
    );
    assert_eq!(list.quests.len(), 1, "the quest is still running");
    assert_eq!(list.quests[0].pid, view.pid);
    assert!(list.quests[0].running);
    assert_eq!(list.quests[0].state, QuestState::Running);

    // The recovered quest is stopped by its process id, not by its image name.
    quests.stop(&view.id).expect("the quest stops");
    assert!(!is_alive(view.pid), "the stub is gone");
}

#[tokio::test]
async fn a_quest_whose_process_is_gone_is_dropped_on_the_next_start() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let (catalogue, quests) = services(dir.path()).await;

    let view = quests
        .start(&QuestRequest {
            app_id: APP_ID.to_string(),
            registered_path: "_retail_/overwatch.exe".to_string(),
        })
        .expect("the quest starts");

    // The stub is killed behind the application's back, as a crash would kill it.
    let child = Command::new(&view.stub_path)
        .spawn()
        .expect("nothing to spawn");
    drop(child);

    Command::new("taskkill")
        .args(["/F", "/PID", &view.pid.to_string()])
        .output()
        .expect("the taskkill runs");
    assert!(!is_alive(view.pid), "the stub is gone");

    drop(quests);
    drop(catalogue);

    let (_catalogue, quests) = services(dir.path()).await;
    let list = quests.list();

    assert!(
        list.quests.is_empty(),
        "a quest whose process is gone must not be reported as running"
    );
    assert!(
        records::read(dir.path()).expect("read").is_empty(),
        "the dead quest's record must be dropped"
    );
}

#[tokio::test]
async fn a_quest_whose_stub_was_deleted_from_disk_is_idle() {
    let dir = tempfile::tempdir().expect("a temp dir");

    // A runner that is running, and a record for it whose file is not on disk.
    //
    // The file cannot be taken away from under a running executable on Windows —
    // the loader holds it open — so the state is set up the way it occurs in
    // practice: the record is written for a process that is running, and the file
    // it names is not there.
    let mut runner_process = decoy(&dir.path().join("decoy"));
    let pid = runner_process.id();

    let record = QuestRecord {
        id: format!("{APP_ID}:_retail_/overwatch.exe"),
        app_id: APP_ID.to_string(),
        display_name: "Overwatch".to_string(),
        registered_path: "_retail_/overwatch.exe".to_string(),
        stub_path: dir
            .path()
            .join("games")
            .join(APP_ID)
            .join("_retail_")
            .join("overwatch")
            .display()
            .to_string(),
        pid,
        started_at: 1_700_000_000,
    };
    records::write(dir.path(), &[record]).expect("the record is written");

    let (_catalogue, quests) = services(dir.path()).await;
    let list = quests.list();

    assert_eq!(list.quests.len(), 1, "the process is still running");
    assert_eq!(
        list.quests[0].state,
        QuestState::Missing,
        "a quest with no file on disk is not a running quest"
    );
    assert!(!list.quests[0].running);

    let _ = runner_process.kill();
    let _ = runner_process.wait();
}

#[tokio::test]
async fn the_stub_state_is_a_real_check_of_the_disk() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let (_catalogue, quests) = services(dir.path()).await;

    // Nothing has been written yet, so no stub is installed.
    let states = quests.stub_states(APP_ID).expect("the states are read");
    assert_eq!(states.len(), 1);
    assert_eq!(states[0].registered_path, "_retail_/overwatch.exe");
    assert!(!states[0].installed, "no stub is on disk");
    assert!(states[0].blocked.is_none());
    assert!(
        states[0].path.ends_with("overwatch"),
        "the path is the mirrored one: {}",
        states[0].path
    );

    // After a quest starts, the file is there, and the check says so.
    let view = quests
        .start(&QuestRequest {
            app_id: APP_ID.to_string(),
            registered_path: "_retail_/overwatch.exe".to_string(),
        })
        .expect("the quest starts");

    let states = quests.stub_states(APP_ID).expect("the states are read");
    assert!(states[0].installed, "the stub is on disk");

    quests.stop(&view.id).expect("the quest stops");
}

#[tokio::test]
async fn a_path_the_filesystem_will_not_accept_is_reported_as_blocked() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let (_catalogue, quests) = services(dir.path()).await;

    let states = quests
        .stub_states(OTHER_APP_ID)
        .expect("the states are read");

    assert_eq!(states.len(), 1);
    assert_eq!(states[0].registered_path, ILLEGAL_PATH);
    assert!(!states[0].installed);
    let blocked = states[0].blocked.as_ref().expect("the path is blocked");
    assert_eq!(
        blocked.code,
        discord_auto_quest_lib::error::ErrorCode::InvalidPath
    );
    assert!(
        blocked.message.contains('>'),
        "the message names the character"
    );
}
