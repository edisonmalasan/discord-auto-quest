//! Questing on Linux, end to end, against a real runner.
//!
//! The Linux runner is headless: it has no window and no toolkit, so a quest does
//! not need GTK, X11, or Wayland to be installed on the user's machine. It is
//! still a real process at the mirrored path, which is what Discord matches.

#![cfg(target_os = "linux")]

use std::os::unix::process::ExitStatusExt;
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
use discord_auto_quest_lib::runner;

/// The application id the entry belongs to.
const APP_ID: &str = "1";

/// The registered path the entry carries.
const REGISTERED_PATH: &str = "csgo_linux64";

/// `SIGTERM`: the signal a Unix process is asked to stop with.
const SIGTERM: i32 = 15;

/// The shared libraries a graphical toolkit would come from.
///
/// A quest must not need any of them: the user is not asked to install a
/// graphical stack to run a stub.
const TOOLKITS: [&str; 5] = ["gtk", "libx11", "wayland", "gdk", "libglib"];

fn entry() -> CatalogEntry {
    CatalogEntry {
        id: APP_ID.to_string(),
        name: "Counter-Strike".to_string(),
        aliases: Vec::new(),
        cover_image_hash: None,
        icon_hash: None,
        executables: vec![CatalogExecutable {
            os: "linux".to_string(),
            path: REGISTERED_PATH.to_string(),
            is_launcher: false,
        }],
        age_ratings: Vec::new(),
    }
}

/// A service whose catalogue is already loaded, with no network involved.
async fn services(data_dir: &Path) -> (CatalogueService, QuestService) {
    let snapshot = CatalogueSnapshot {
        entries: vec![entry()],
        stats: discord_auto_quest_lib::catalogue::model::CatalogueStats {
            total: 1,
            questable: 1,
            not_questable: 0,
            questable_ratio: 1.0,
            platform_splits: vec![discord_auto_quest_lib::catalogue::model::PlatformSplit {
                os: "linux".to_string(),
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

    catalogue.load().await.expect("the catalogue loads from the cache");

    (catalogue, quests)
}

/// Whether a process is still running, read from the process table.
///
/// A process that has exited but has not been collected yet is still in
/// `/proc`, so the state is read as well as the existence. A zombie is not
/// running: it has no code left to run.
fn is_alive(pid: u32) -> bool {
    let stat = match std::fs::read_to_string(format!("/proc/{pid}/stat")) {
        Ok(stat) => stat,
        Err(_) => return false,
    };

    // The state is the character after the executable's name, which is the last
    // parenthesised field in the line.
    let state = stat
        .rsplit_once(") ")
        .and_then(|(_, rest)| rest.chars().next())
        .unwrap_or('?');

    state != 'Z' && state != 'X'
}

/// The shared objects a running process has loaded.
///
/// This is read from the kernel's own record of the process, so it says what the
/// process really has, not what the binary was linked against on paper.
fn loaded_libraries(pid: u32) -> Vec<String> {
    let maps = std::fs::read_to_string(format!("/proc/{pid}/maps")).unwrap_or_default();

    let mut libraries: Vec<String> = maps
        .lines()
        .filter_map(|line| line.split_whitespace().last())
        .filter(|path| path.contains(".so"))
        .map(|path| path.to_string())
        .collect();

    libraries.sort();
    libraries.dedup();
    libraries
}

#[tokio::test]
async fn a_quest_writes_the_stub_to_the_mirrored_path_and_runs_it() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let (_catalogue, quests) = services(dir.path()).await;

    let view = quests
        .start(&QuestRequest {
            app_id: APP_ID.to_string(),
            registered_path: REGISTERED_PATH.to_string(),
        })
        .expect("the quest starts");

    // The path mirrors the registered path, with the file's extension removed.
    let expected = dir.path().join("games").join(APP_ID).join("csgo_linux64");
    assert_eq!(PathBuf::from(&view.stub_path), expected);
    assert!(expected.exists(), "the stub is written to disk");

    assert!(view.pid > 0);
    assert!(is_alive(view.pid), "the stub is running");
    assert!(view.running);

    quests.stop(&view.id).expect("the quest stops");
    assert!(!is_alive(view.pid), "the stub is gone");
}

#[tokio::test]
async fn a_quest_is_tracked_by_its_process_id() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let (_catalogue, quests) = services(dir.path()).await;

    let view = quests
        .start(&QuestRequest {
            app_id: APP_ID.to_string(),
            registered_path: REGISTERED_PATH.to_string(),
        })
        .expect("the quest starts");

    // The quest is in the list, and it is the process that was started, not a
    // flag the application set.
    let listed = quests.list().quests;
    assert_eq!(listed.len(), 1, "the quest is listed");
    assert_eq!(listed[0].pid, view.pid, "it is tracked by its process id");
    assert!(listed[0].running, "and it is running");

    quests.stop(&view.id).expect("the quest stops");

    // A stopped quest is not in the list any more: the process is gone, so
    // there is nothing to report as running.
    assert!(
        quests.list().quests.is_empty(),
        "a stopped quest is not a running quest"
    );
}

#[tokio::test]
async fn the_runner_needs_no_toolkit_to_be_installed() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let (_catalogue, quests) = services(dir.path()).await;

    let view = quests
        .start(&QuestRequest {
            app_id: APP_ID.to_string(),
            registered_path: REGISTERED_PATH.to_string(),
        })
        .expect("the quest starts");

    // The running process's own record of what it has loaded. A graphical
    // toolkit would be in here if the runner needed one.
    let libraries = loaded_libraries(view.pid);
    assert!(
        !libraries.is_empty(),
        "the running process should show what it has loaded"
    );

    let lowered = libraries.join(" ").to_lowercase();
    for toolkit in TOOLKITS {
        assert!(
            !lowered.contains(toolkit),
            "the runner must not need {toolkit}: {lowered}"
        );
    }

    quests.stop(&view.id).expect("the quest stops");
}

#[tokio::test]
async fn stopping_a_quest_leaves_a_process_with_the_same_name_alone() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let (_catalogue, quests) = services(dir.path()).await;

    let view = quests
        .start(&QuestRequest {
            app_id: APP_ID.to_string(),
            registered_path: REGISTERED_PATH.to_string(),
        })
        .expect("the quest starts");

    // A second copy of the runner, standing in for the real game.
    let decoy_dir = dir.path().join("decoy");
    std::fs::create_dir_all(&decoy_dir).expect("the decoy directory is created");
    let decoy_path = decoy_dir.join(runner::FILE_NAME);
    runner::materialise(&decoy_path).expect("the decoy is written");
    let mut decoy: Child = Command::new(&decoy_path).spawn().expect("the decoy starts");
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
async fn a_quest_that_outlived_the_application_is_stopped_by_its_process_id() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let (_catalogue, _quests) = services(dir.path()).await;

    // A quest from a previous run of the application: the process is alive, the
    // application has no handle to it, and it is stopped by its id alone.
    let stub = dir.path().join("games").join(APP_ID).join("csgo_linux64");
    runner::materialise(&stub).expect("the stub is written");

    let mut child = Command::new(&stub).spawn().expect("the runner starts");
    let pid = child.id();
    assert!(is_alive(pid), "the runner is running");

    // The record the previous run left behind.
    let record = QuestRecord {
        id: format!("{APP_ID}:{REGISTERED_PATH}"),
        app_id: APP_ID.to_string(),
        display_name: "Counter-Strike".to_string(),
        registered_path: REGISTERED_PATH.to_string(),
        stub_path: stub.display().to_string(),
        pid,
        started_at: 1_700_000_000,
    };
    records::write(dir.path(), &[record]).expect("the record is written");

    // A new service reconciles the record against the process table.
    let recovered = QuestService::new(
        CatalogueService::new(dir.path().to_path_buf(), Duration::from_secs(3600))
            .expect("the catalogue service builds"),
        dir.path().to_path_buf(),
    );

    let listed = recovered.list().quests;
    assert_eq!(listed.len(), 1, "the quest was found again");
    assert_eq!(listed[0].pid, pid, "it is the same process");
    assert!(listed[0].running, "and it is running");

    recovered.stop(&listed[0].id).expect("the quest stops");

    // The process was asked to stop with `SIGTERM`, which is the polite request
    // on a Unix system. The test holds the handle, so it can see what happened.
    let deadline = std::time::Instant::now() + Duration::from_secs(5);
    let mut status = None;
    while std::time::Instant::now() < deadline {
        if let Some(exited) = child.try_wait().expect("the child can be waited for") {
            status = Some(exited);
            break;
        }
        std::thread::sleep(Duration::from_millis(50));
    }

    let status = status.expect("the quest's process was stopped");
    assert_eq!(
        status.signal(),
        Some(SIGTERM),
        "the process was stopped with SIGTERM, not with a signal the app does not use"
    );
    assert!(!is_alive(pid), "the process is gone");
}
