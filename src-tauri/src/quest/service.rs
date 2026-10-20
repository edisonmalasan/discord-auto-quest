use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Child;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};

use crate::catalogue::service::CatalogueService;
use crate::error::{AppError, AppResult};

use super::bundle;
use super::launch;
use super::path;
use super::process;
use super::records::{self, QuestRecord};

/// What the interface asks for: an application, and the registered path it wants to
/// mirror.
///
/// The interface never supplies a local path. The backend resolves the executable
/// from the catalogue it holds, so a stub can only ever be written where Discord's
/// own data points.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestRequest {
    pub app_id: String,
    pub registered_path: String,
}

/// The state of a quest, as far as the application can tell.
///
/// Every one of these is a statement about the machine, read at the moment it is
/// asked for. None of them is a flag the application set when it started something.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum QuestState {
    /// The stub is on disk and its process is alive. This is the only state the
    /// application calls a running quest.
    Running,
    /// The process is alive, but the file it was started from has been deleted from
    /// disk. The quest is idle: there is no longer a file at the path Discord
    /// matches.
    Missing,
    /// The process is gone. The quest is over.
    Ended,
}

/// A quest as the interface sees it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestView {
    /// The quest's identity: the application and the executable within it.
    pub id: String,
    pub app_id: String,
    pub display_name: String,
    /// Where the stub was written.
    pub stub_path: String,
    /// The process id of the running stub.
    pub pid: u32,
    /// When the quest started, as a Unix timestamp in seconds.
    pub started_at: u64,
    /// Whether the quest is running. True only in the `running` state.
    pub running: bool,
    /// The state of the quest.
    pub state: QuestState,
    /// The registered path the stub is mirroring.
    pub registered_path: String,
}

/// What the application knows about one executable's stub on disk.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StubState {
    /// The catalogue path this stub mirrors.
    pub registered_path: String,
    /// Where the stub is written.
    pub path: String,
    /// Whether a file is there now. This is a filesystem check made at the moment
    /// it is asked for, not a flag the application set earlier.
    pub installed: bool,
    /// The failure, when this executable's path cannot be mirrored at all.
    pub blocked: Option<AppError>,
}

/// The quests, and anything the application could not work out about them.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestList {
    /// The quests, read from the process table.
    pub quests: Vec<QuestView>,
    /// The quests that were running and are now over.
    ///
    /// A quest ends when its process is no longer there: it was stopped, it
    /// crashed, or somebody killed it from outside the application. The quest
    /// is not in the list above, because it is not running, but it is not
    /// forgotten either — the interface is told what happened, so it can say so
    /// rather than quietly showing a start control again.
    pub ended: Vec<QuestView>,
    /// A failure the application could not recover from on its own — a quest
    /// records file it could not read, for instance. The quests above are still
    /// true; this says what could not be checked.
    pub error: Option<AppError>,
}

struct LiveQuest {
    view: QuestView,
    /// The handle, for a quest this session started. A quest that survived a
    /// restart has no handle and is stopped by its process id instead.
    child: Option<Child>,
}

/// What a launch produced.
struct Launched {
    /// The process the app has to watch.
    pid: u32,
    /// The handle to the process, when the platform gives the app one.
    child: Option<Child>,
    /// Where the stub was written.
    stub_path: PathBuf,
}

/// Where a registered path's stub goes.
#[derive(Debug, Clone, PartialEq, Eq)]
struct StubLocation {
    /// The path Discord matches: the executable, or the bundle on macOS.
    path: PathBuf,
    /// The file the runner occupies.
    executable: PathBuf,
}

impl StubLocation {
    /// Whether the stub is on disk right now.
    ///
    /// This is a real check of the filesystem, made at the moment it is asked
    /// for. The application never infers that a stub is installed from a flag it
    /// set earlier.
    fn is_installed(&self) -> bool {
        self.executable.is_file()
    }
}

/// Runs quests.
pub struct QuestService {
    catalogue: CatalogueService,
    games_root: PathBuf,
    records_dir: PathBuf,
    live: Arc<Mutex<HashMap<String, LiveQuest>>>,
    /// The quests that were running and are now over.
    ///
    /// A quest that ends is not forgotten. The interface is told what ended, so
    /// it can say so beside the game rather than quietly showing a start
    /// control again and leaving the user to guess.
    ended: Arc<Mutex<Vec<QuestView>>>,
    /// A failure from the start-up reconciliation that the application could not
    /// recover from. It is reported rather than swallowed: the app must not claim
    /// that nothing is running when it could not find out.
    reconcile_error: Arc<Mutex<Option<AppError>>>,
}

impl QuestService {
    pub fn new(catalogue: CatalogueService, data_dir: PathBuf) -> Self {
        let service = Self {
            catalogue,
            games_root: data_dir.join("games"),
            records_dir: data_dir,
            live: Arc::new(Mutex::new(HashMap::new())),
            ended: Arc::new(Mutex::new(Vec::new())),
            reconcile_error: Arc::new(Mutex::new(None)),
        };
        service.reconcile();
        service
    }

    /// Where the stubs live.
    pub fn games_root(&self) -> &PathBuf {
        &self.games_root
    }

    /// Bring the recorded quests in line with the process table.
    ///
    /// A quest whose process has gone is gone: its record is dropped, and the
    /// application never claims it is running. A quest whose process is still alive
    /// is kept, and its file is checked on disk: a stub that was deleted from disk
    /// is reported as missing, because there is no longer a file at the path
    /// Discord matches.
    fn reconcile(&self) {
        let records = match records::read(&self.records_dir) {
            Ok(records) => records,
            Err(error) => {
                // The records could not be read. The quests from a previous run may
                // still be running, and the app must say so rather than show an
                // empty list.
                if let Ok(mut slot) = self.reconcile_error.lock() {
                    *slot = Some(error);
                }
                return;
            }
        };

        let mut kept = Vec::new();
        let mut recovered = Vec::new();
        let mut over = Vec::new();

        for record in records {
            if !process::is_alive(record.pid) {
                // The process is gone. The quest is over and its record is
                // dropped — but the fact that it ended is kept, so the interface
                // can say so rather than showing a start control again as though
                // nothing had happened.
                over.push(QuestView {
                    id: record.id,
                    app_id: record.app_id,
                    display_name: record.display_name,
                    stub_path: record.stub_path,
                    pid: record.pid,
                    started_at: record.started_at,
                    running: false,
                    state: QuestState::Ended,
                    registered_path: record.registered_path,
                });
                continue;
            }

            let stub_present = self
                .stub_location(&record.app_id, &record.registered_path)
                .map(|location| location.is_installed())
                .unwrap_or(false);

            kept.push(record.clone());
            recovered.push(LiveQuest {
                view: QuestView {
                    id: record.id,
                    app_id: record.app_id,
                    display_name: record.display_name,
                    stub_path: record.stub_path,
                    pid: record.pid,
                    started_at: record.started_at,
                    running: stub_present,
                    state: if stub_present {
                        QuestState::Running
                    } else {
                        QuestState::Missing
                    },
                    registered_path: record.registered_path,
                },
                // The process was started by a previous run of the application, so
                // there is no handle for it. It is stopped by its process id.
                child: None,
            });
        }

        let _ = records::write(&self.records_dir, &kept);

        if let Ok(mut live) = self.live.lock() {
            for quest in recovered {
                live.insert(quest.view.id.clone(), quest);
            }
        }

        if let Ok(mut ended) = self.ended.lock() {
            ended.extend(over);
        }
    }

    /// Start a quest: write the stub, run it, and remember its process id.
    pub fn start(&self, request: &QuestRequest) -> AppResult<QuestView> {
        let entry = self.catalogue.entry(&request.app_id).ok_or_else(|| {
            AppError::not_questable(format!(
                "the catalogue has no entry for application {}",
                request.app_id
            ))
        })?;

        let executable = entry
            .executables
            .iter()
            .find(|executable| executable.path == request.registered_path)
            .ok_or_else(|| {
                AppError::not_questable(format!(
                    "`{}` is not a registered executable for {}",
                    request.registered_path, entry.name
                ))
            })?;

        let id = quest_id(&entry.id, &executable.path);

        // A quest for the same executable is replaced, not duplicated: there is one
        // process per path, because one path is what Discord matches. This also
        // clears away a quest whose stub was deleted from disk.
        let _ = self.stop(&id);

        // A new quest for this executable supersedes the notice that the last
        // one ended: the game is being played again, so what it says about the
        // old quest no longer applies.
        if let Ok(mut ended) = self.ended.lock() {
            ended.retain(|quest| quest.id != id);
        }

        let launched = self.launch(&entry.id, &entry.name, &executable.path)?;

        let pid = launched.pid;
        let stub_path = launched.stub_path;
        let view = QuestView {
            id: id.clone(),
            app_id: entry.id.clone(),
            display_name: entry.name.clone(),
            stub_path: stub_path.display().to_string(),
            pid,
            started_at: now_seconds(),
            running: true,
            state: QuestState::Running,
            registered_path: executable.path.clone(),
        };

        self.record(&QuestRecord {
            id: id.clone(),
            app_id: view.app_id.clone(),
            display_name: view.display_name.clone(),
            registered_path: view.registered_path.clone(),
            stub_path: view.stub_path.clone(),
            pid,
            started_at: view.started_at,
        });

        if let Ok(mut live) = self.live.lock() {
            live.insert(
                id,
                LiveQuest {
                    view: view.clone(),
                    child: launched.child,
                },
            );
        }

        Ok(view)
    }

    /// Where a registered path's stub goes, and whether it is there.
    ///
    /// On macOS a registered path that names an application bundle becomes a real
    /// `.app` bundle, and it is launched the way macOS launches applications.
    /// Everywhere else it is a bare executable, launched directly.
    fn stub_location(&self, app_id: &str, registered_path: &str) -> AppResult<StubLocation> {
        stub_location_for(
            std::env::consts::OS,
            &self.games_root,
            app_id,
            registered_path,
        )
    }

    /// Materialise the stub and start it, in the way the platform asks for.
    fn launch(
        &self,
        app_id: &str,
        display_name: &str,
        registered_path: &str,
    ) -> AppResult<Launched> {
        let location = self.stub_location(app_id, registered_path)?;

        if location.path != location.executable {
            // A macOS application bundle: the runner goes inside it, and the
            // bundle is opened the way macOS opens applications.
            bundle::create(
                &bundle::Bundle {
                    path: location.path.clone(),
                    executable: location.executable.clone(),
                },
                display_name,
                crate::runner::RUNNER,
            )?;

            let launched = launch::launch_bundle(&location.path, display_name)?;

            return Ok(Launched {
                pid: launched.pid,
                child: launched.child,
                stub_path: location.path,
            });
        }

        crate::runner::materialise(&location.executable)?;

        let launched = launch::launch_executable(&location.executable, display_name)?;

        Ok(Launched {
            pid: launched.pid,
            child: launched.child,
            stub_path: location.path,
        })
    }

    /// Stop a quest by its identity.
    ///
    /// A quest this session started is stopped through the handle the application
    /// holds, so exactly one process is signalled. A quest that survived a restart
    /// is stopped by its process id, which is still exact.
    pub fn stop(&self, id: &str) -> AppResult<QuestView> {
        let mut live = self
            .live
            .lock()
            .map_err(|_| AppError::io("the quest table is poisoned"))?;

        let mut quest = live
            .remove(id)
            .ok_or_else(|| AppError::not_installed(format!("there is no quest `{id}` to stop")))?;

        match quest.child.as_mut() {
            Some(child) => {
                let _ = child.kill();
                let _ = child.wait();
            }
            None => {
                process::terminate(quest.view.pid);
            }
        }

        let mut view = quest.view;
        view.running = false;
        view.state = QuestState::Ended;
        self.forget(id);

        Ok(view)
    }

    /// The quests, read from the process table rather than from a flag the
    /// application set.
    pub fn list(&self) -> QuestList {
        let mut views = Vec::new();
        let mut just_ended: Vec<QuestView> = Vec::new();

        if let Ok(mut live) = self.live.lock() {
            let mut ended: Vec<String> = Vec::new();

            for (id, quest) in live.iter_mut() {
                let alive = match quest.child.as_mut() {
                    Some(child) => matches!(child.try_wait(), Ok(None)),
                    None => process::is_alive(quest.view.pid),
                };

                if !alive {
                    ended.push(id.clone());
                    continue;
                }

                // The stub's presence is a filesystem check, every time.
                let stub_present = self
                    .stub_location(&quest.view.app_id, &quest.view.registered_path)
                    .map(|location| location.is_installed())
                    .unwrap_or(false);
                quest.view.running = stub_present;
                quest.view.state = if stub_present {
                    QuestState::Running
                } else {
                    QuestState::Missing
                };

                views.push(quest.view.clone());
            }

            // A quest whose process has gone is over. It is not running, so it
            // leaves the list above, but it is reported as ended so the
            // interface can say what happened.
            for id in ended {
                if let Some(quest) = live.remove(&id) {
                    let mut view = quest.view;
                    view.running = false;
                    view.state = QuestState::Ended;
                    just_ended.push(view);
                }
                self.forget(&id);
            }
        }

        if !just_ended.is_empty() {
            if let Ok(mut ended) = self.ended.lock() {
                ended.extend(just_ended);
            }
        }

        let error = self
            .reconcile_error
            .lock()
            .ok()
            .and_then(|slot| slot.clone());

        let over = self
            .ended
            .lock()
            .map(|ended| ended.clone())
            .unwrap_or_default();

        QuestList {
            quests: views,
            ended: over,
            error,
        }
    }

    /// What the filesystem says about each of an application's registered
    /// executables.
    ///
    /// Every answer is a check of the disk made now. An executable whose path the
    /// filesystem will not accept is reported as blocked, with the reason, rather
    /// than being left out: the user is owed the whole list.
    pub fn stub_states(&self, app_id: &str) -> AppResult<Vec<StubState>> {
        let entry = self.catalogue.entry(app_id).ok_or_else(|| {
            AppError::not_questable(format!(
                "the catalogue has no entry for application {app_id}"
            ))
        })?;

        let mut states = Vec::new();

        for executable in &entry.executables {
            let location = match self.stub_location(&entry.id, &executable.path) {
                Ok(location) => location,
                Err(error) => {
                    states.push(StubState {
                        registered_path: executable.path.clone(),
                        path: String::new(),
                        installed: false,
                        blocked: Some(error),
                    });
                    continue;
                }
            };

            states.push(StubState {
                registered_path: executable.path.clone(),
                installed: location.is_installed(),
                path: location.path.display().to_string(),
                blocked: None,
            });
        }

        Ok(states)
    }

    /// Record a quest so the application can find it again.
    fn record(&self, record: &QuestRecord) {
        if let Ok(mut records) = records::read(&self.records_dir) {
            records.retain(|existing| existing.id != record.id);
            records.push(record.clone());
            let _ = records::write(&self.records_dir, &records);
        }
    }

    /// Forget a quest.
    fn forget(&self, id: &str) {
        if let Ok(mut records) = records::read(&self.records_dir) {
            records.retain(|existing| existing.id != id);
            let _ = records::write(&self.records_dir, &records);
        }
    }
}

/// A quest's identity: the application, and the executable within it.
fn quest_id(app_id: &str, registered_path: &str) -> String {
    format!("{app_id}:{registered_path}")
}

/// Where a registered path's stub goes, on a given platform.
///
/// The platform is a parameter rather than a compile-time constant so that the
/// rule can be tested on any machine: a macOS bundle is a real `.app` bundle on
/// macOS, and a bare executable everywhere else. The rule is the same either
/// way; only where it is exercised differs.
fn stub_location_for(
    os: &str,
    games_root: &std::path::Path,
    app_id: &str,
    registered_path: &str,
) -> AppResult<StubLocation> {
    if os == "macos" && bundle::is_bundle(registered_path) {
        // The bundle's segments are the registered path's own segments, with the
        // `.app` extension kept: the bundle is named after what Discord
        // registered, because the name is what the match is on.
        let segments = path::raw_segments(registered_path)?;
        let bundle = bundle::layout(games_root, app_id, &segments)?;
        path::ensure_inside(games_root, &bundle.path)?;

        return Ok(StubLocation {
            path: bundle.path,
            executable: bundle.executable,
        });
    }

    let segments = path::segments(registered_path)?;
    let stub_path = path::stub_path(games_root, app_id, &segments);
    path::ensure_inside(games_root, &stub_path)?;

    Ok(StubLocation {
        path: stub_path.clone(),
        executable: stub_path,
    })
}

fn now_seconds() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::quest::records::QuestRecord;
    use std::path::Path;
    use std::time::Duration;

    /// A service over a temporary directory. The catalogue is never loaded, so
    /// nothing here touches the network.
    fn service(dir: &Path) -> QuestService {
        let catalogue = CatalogueService::new(dir.to_path_buf(), Duration::from_secs(3600))
            .expect("the service builds");
        QuestService::new(catalogue, dir.to_path_buf())
    }

    fn record(dir: &Path, id: &str, pid: u32) -> QuestRecord {
        QuestRecord {
            id: id.to_string(),
            app_id: "1".to_string(),
            display_name: "Alpha".to_string(),
            registered_path: "a/b.exe".to_string(),
            stub_path: dir
                .join("games")
                .join("1")
                .join("a")
                .join("b")
                .display()
                .to_string(),
            pid,
            started_at: 1_700_000_000,
        }
    }

    /// A process id that cannot be running.
    const DEAD_PID: u32 = 0xFFFF_FFFE;

    #[test]
    fn a_quest_id_names_the_application_and_the_executable() {
        assert_eq!(quest_id("123", "a/b.exe"), "123:a/b.exe");
    }

    #[test]
    fn a_quest_whose_process_is_gone_is_dropped_on_start_up() {
        let dir = tempfile::tempdir().expect("a temp dir");
        records::write(dir.path(), &[record(dir.path(), "1:a/b.exe", DEAD_PID)]).expect("written");

        let quests = service(dir.path());

        assert!(
            quests.list().quests.is_empty(),
            "a quest whose process is gone must not be reported as running"
        );
        assert!(
            records::read(dir.path()).expect("read").is_empty(),
            "the dead quest's record must be dropped"
        );
    }

    #[test]
    fn a_quest_whose_process_is_alive_is_recovered_on_start_up() {
        let dir = tempfile::tempdir().expect("a temp dir");
        let alive = std::process::id();
        records::write(dir.path(), &[record(dir.path(), "1:a/b.exe", alive)]).expect("written");

        let quests = service(dir.path());
        let views = quests.list().quests;

        assert_eq!(views.len(), 1, "the quest is still running");
        assert_eq!(views[0].pid, alive);
    }

    #[test]
    fn a_recovered_quest_whose_stub_was_deleted_is_idle() {
        let dir = tempfile::tempdir().expect("a temp dir");
        let alive = std::process::id();
        records::write(dir.path(), &[record(dir.path(), "1:a/b.exe", alive)]).expect("written");

        let quests = service(dir.path());
        let views = quests.list().quests;

        assert_eq!(views.len(), 1);
        assert_eq!(views[0].state, QuestState::Missing);
        assert!(
            !views[0].running,
            "a quest with no file on disk is not a running quest"
        );
    }

    #[test]
    fn a_recovered_quest_whose_stub_is_on_disk_is_running() {
        let dir = tempfile::tempdir().expect("a temp dir");
        let alive = std::process::id();
        let record = record(dir.path(), "1:a/b.exe", alive);

        let stub = PathBuf::from(&record.stub_path);
        std::fs::create_dir_all(stub.parent().expect("a parent")).expect("created");
        std::fs::write(&stub, b"stub").expect("written");

        records::write(dir.path(), &[record]).expect("written");

        let quests = service(dir.path());
        let views = quests.list().quests;

        assert_eq!(views.len(), 1);
        assert_eq!(views[0].state, QuestState::Running);
        assert!(views[0].running);
    }

    #[test]
    fn a_records_file_that_cannot_be_read_is_reported() {
        let dir = tempfile::tempdir().expect("a temp dir");
        std::fs::write(records::path_in(dir.path()), "{ not json").expect("written");

        let quests = service(dir.path());
        let list = quests.list();

        assert!(
            list.error.is_some(),
            "the app must say it could not find out what is running"
        );
    }

    #[test]
    fn a_macos_bundle_is_a_bundle_on_macos() {
        let location = stub_location_for("macos", Path::new("/games"), "42", "osx64/dota2.app")
            .expect("a location");

        assert_eq!(
            location.path,
            PathBuf::from("/games/42/osx64/dota2.app"),
            "the bundle is named after what Discord registered"
        );
        assert_eq!(
            location.executable,
            PathBuf::from("/games/42/osx64/dota2.app/Contents/MacOS/dota2"),
            "the runner inside carries the name without the extension"
        );
    }

    #[test]
    fn a_bundle_is_an_ordinary_executable_elsewhere() {
        for os in ["windows", "linux"] {
            let location = stub_location_for(os, Path::new("/games"), "42", "osx64/dota2.app")
                .expect("a location");

            assert_eq!(
                location.path,
                PathBuf::from("/games/42/osx64/dota2"),
                "a bundle is only a bundle on macos, and the extension is stripped"
            );
        }
    }

    #[test]
    fn an_ordinary_executable_is_one_on_every_platform() {
        for os in ["macos", "windows", "linux"] {
            let location =
                stub_location_for(os, Path::new("/games"), "42", "_retail_/overwatch.exe")
                    .expect("a location");

            assert_eq!(
                location.path,
                PathBuf::from("/games/42/_retail_/overwatch"),
                "the stub mirrors the registered path, with the extension stripped"
            );
            assert_eq!(location.executable, location.path);
        }
    }

    #[test]
    fn a_refused_path_is_refused_on_every_platform() {
        for os in ["macos", "windows", "linux"] {
            let error =
                stub_location_for(os, Path::new("/games"), "42", ">hl2_osx").expect_err("refused");

            assert_eq!(error.code, crate::error::ErrorCode::InvalidPath);
        }
    }

    #[test]
    fn a_quest_that_ended_is_reported_as_ended() {
        let dir = tempfile::tempdir().expect("a temp dir");

        // A quest that was running, whose record says so, and whose process is
        // not there any more.
        records::write(
            dir.path(),
            &[QuestRecord {
                id: "1:a/b.exe".to_string(),
                app_id: "1".to_string(),
                display_name: "Alpha".to_string(),
                registered_path: "a/b.exe".to_string(),
                stub_path: dir
                    .path()
                    .join("games")
                    .join("1")
                    .join("a")
                    .join("b")
                    .display()
                    .to_string(),
                pid: DEAD_PID,
                started_at: 1_700_000_000,
            }],
        )
        .expect("written");

        // A service built over the same directory reconciles the record against
        // the process table.
        let quests = service(dir.path());
        let list = quests.list();

        assert!(list.quests.is_empty(), "the quest is not running");
        assert_eq!(list.ended.len(), 1, "the quest that ended is reported");
        assert_eq!(list.ended[0].state, QuestState::Ended);
        assert!(!list.ended[0].running, "an ended quest is not running");
    }
}
