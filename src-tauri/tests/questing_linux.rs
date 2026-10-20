//! Questing on Linux, end to end, against a real runner.
//!
//! The Linux runner is headless: it has no window and no toolkit, so a quest does
//! not need GTK, X11, or Wayland to be installed on the user's machine. It is
//! still a real process at the mirrored path, which is what Discord matches.

#![cfg(target_os = "linux")]

use std::os::unix::process::ExitStatusExt;
use std::path::{Path, PathBuf};
use std::time::Duration;

use discord_auto_quest_lib::catalogue::cache::{self, CachedCatalogue};
use discord_auto_quest_lib::catalogue::model::{
    CatalogEntry, CatalogExecutable, CatalogueSnapshot, CatalogueSource,
};
use discord_auto_quest_lib::catalogue::service::CatalogueService;
use discord_auto_quest_lib::quest::launch;
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

    catalogue
        .load()
        .await
        .expect("the catalogue loads from the cache");

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

/// The shared libraries a running process has loaded, once the loader has
/// mapped them.
///
/// A process becomes the executable it was started from a moment *before* the
/// dynamic loader has mapped its shared libraries. A reading taken in that
/// window says nothing, so it is taken again until it does.
fn wait_for_libraries(pid: u32) -> Vec<String> {
    let deadline = std::time::Instant::now() + Duration::from_secs(5);

    loop {
        let libraries = loaded_libraries(pid);

        if !libraries.is_empty() || std::time::Instant::now() >= deadline {
            return libraries;
        }

        std::thread::sleep(Duration::from_millis(10));
    }
}

/// The state of a process, as the kernel reports it, for a failure message.
fn process_state(pid: u32) -> String {
    let stat = std::fs::read_to_string(format!("/proc/{pid}/stat")).unwrap_or_default();
    let state = stat
        .rsplit_once(") ")
        .and_then(|(_, rest)| rest.chars().next())
        .unwrap_or('?');

    let maps = std::fs::read_to_string(format!("/proc/{pid}/maps")).unwrap_or_default();

    format!(
        "state {state}, {} mapping lines, /proc/{pid}/exe -> {:?}",
        maps.lines().count(),
        std::fs::read_link(format!("/proc/{pid}/exe"))
    )
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

    // The path mirrors the registered path, extension included. This registered
    // path has no extension of its own, so nothing is added to it either.
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

/// Wait until the process is running the executable it was started from.
///
/// A process exists from the moment it is forked, and it is running a given
/// file only once it has been exec'd. The kernel's own record of that is
/// `/proc/<pid>/exe`, a link to the file the process is running. Reading it is
/// also the strongest statement the test can make: the process is not merely
/// alive, it is alive *as the stub*.
fn wait_for_executable(pid: u32, expected: &Path) -> bool {
    let deadline = std::time::Instant::now() + Duration::from_secs(5);

    while std::time::Instant::now() < deadline {
        if let Ok(target) = std::fs::read_link(format!("/proc/{pid}/exe")) {
            if target == expected {
                return true;
            }
        }
        std::thread::sleep(Duration::from_millis(10));
    }

    false
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

    // The process has to be running the stub before its loaded libraries say
    // anything: a process that has been forked but not yet exec'd is still the
    // test's own process as far as the kernel is concerned.
    let stub = dir.path().join("games").join(APP_ID).join("csgo_linux64");
    assert!(
        wait_for_executable(view.pid, &stub),
        "the process is running the stub it was started from"
    );

    // The running process's own record of what it has loaded. A graphical
    // toolkit would be in here if the runner needed one. The reading is taken
    // once the loader has mapped the libraries, or it would say nothing at all.
    let libraries = wait_for_libraries(view.pid);
    assert!(
        !libraries.is_empty(),
        "the running process should show what it has loaded: {}",
        process_state(view.pid)
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

    // A second copy of the runner, standing in for the real game. It is started
    // through the application's own launch, so it is subject to the same rules
    // as a real quest — including the one that says a start is tried again
    // while the file is still open for writing.
    let decoy_dir = dir.path().join("decoy");
    std::fs::create_dir_all(&decoy_dir).expect("the decoy directory is created");
    let decoy_path = decoy_dir.join(runner::FILE_NAME);
    runner::materialise(&decoy_path).expect("the decoy is written");
    let launched =
        launch::launch_executable(&decoy_path, "Counter-Strike").expect("the decoy starts");
    let decoy_pid = launched.pid;
    let mut decoy = launched.child.expect("the decoy is this process's child");
    assert!(is_alive(decoy_pid));

    quests.stop(&view.id).expect("the quest stops");

    assert!(!is_alive(view.pid), "the stub is gone");
    assert!(
        is_alive(decoy_pid),
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

    let launched = launch::launch_executable(&stub, "Counter-Strike").expect("the runner starts");
    let pid = launched.pid;
    let mut child = launched.child.expect("the runner is this process's child");
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
    let mut exited = None;
    while std::time::Instant::now() < deadline {
        if let Some(status) = child.try_wait().expect("the child can be waited for") {
            exited = Some(status);
            break;
        }
        std::thread::sleep(Duration::from_millis(50));
    }

    // The child is waited for on every path, so it never becomes a zombie. One
    // that is still alive at this point is killed: the test must not leave a
    // process behind, and the assertion below is what reports that the stop did
    // not work.
    if exited.is_none() {
        let _ = child.kill();
    }

    let status = child.wait().expect("the child is waited for");
    assert_eq!(
        status.signal(),
        Some(SIGTERM),
        "the process was stopped with SIGTERM, not with a signal the app does not use"
    );
    assert!(!is_alive(pid), "the process is gone");
}

#[tokio::test]
async fn the_stub_keeps_the_registered_files_extension() {
    // A registered path whose last segment carries an extension, of the shape
    // the catalogue really holds — `bin.x86/terraria.bin.x86` is in it.
    const REGISTERED: &str = "bin.x86/terraria.bin.x86";
    const APP: &str = "2";

    let dir = tempfile::tempdir().expect("a temp dir");

    let snapshot = CatalogueSnapshot {
        entries: vec![CatalogEntry {
            id: APP.to_string(),
            name: "Terraria".to_string(),
            aliases: Vec::new(),
            cover_image_hash: None,
            icon_hash: None,
            executables: vec![CatalogExecutable {
                os: "linux".to_string(),
                path: REGISTERED.to_string(),
                is_launcher: false,
            }],
            age_ratings: Vec::new(),
        }],
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
    cache::write(dir.path(), &cached).expect("the cache is written");

    let catalogue = CatalogueService::new(dir.path().to_path_buf(), Duration::from_secs(3600))
        .expect("the catalogue service builds");
    let quests = QuestService::new(catalogue.clone(), dir.path().to_path_buf());
    catalogue
        .load()
        .await
        .expect("the catalogue loads from the cache");

    let view = quests
        .start(&QuestRequest {
            app_id: APP.to_string(),
            registered_path: REGISTERED.to_string(),
        })
        .expect("the quest starts");

    // The stub is at the registered path, extension and all. The extension is
    // part of the name Discord registered, so dropping it would leave the stub
    // somewhere Discord does not match.
    let expected = dir
        .path()
        .join("games")
        .join(APP)
        .join("bin.x86")
        .join("terraria.bin.x86");
    assert_eq!(
        PathBuf::from(&view.stub_path),
        expected,
        "the stub is at the registered path, extension included"
    );
    assert!(expected.exists(), "the stub is on disk");
    assert!(is_alive(view.pid), "the stub is running");

    quests.stop(&view.id).expect("the quest stops");
    assert!(!is_alive(view.pid), "the stub is gone");
}
