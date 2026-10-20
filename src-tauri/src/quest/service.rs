use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};

use crate::catalogue::service::CatalogueService;
use crate::error::{AppError, AppResult};

use super::path;
use super::process;
use super::records::{self, QuestRecord};

/// The `CREATE_NO_WINDOW` flag. The runner is a windowed binary already, so this
/// only makes sure a console can never appear.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

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

/// Runs quests.
pub struct QuestService {
    catalogue: CatalogueService,
    games_root: PathBuf,
    records_dir: PathBuf,
    live: Arc<Mutex<HashMap<String, LiveQuest>>>,
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

        for record in records {
            if !process::is_alive(record.pid) {
                // The process is gone. The quest is over and its record is dropped.
                continue;
            }

            let stub_present = records::stub_installed(Path::new(&record.stub_path));

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

        let segments = path::segments(&executable.path)?;
        let stub_path = path::stub_path(&self.games_root, &entry.id, &segments);
        path::ensure_inside(&self.games_root, &stub_path)?;

        let id = quest_id(&entry.id, &executable.path);

        // A quest for the same executable is replaced, not duplicated: there is one
        // process per path, because one path is what Discord matches. This also
        // clears away a quest whose stub was deleted from disk.
        let _ = self.stop(&id);

        crate::runner::materialise(&stub_path)?;

        let mut command = Command::new(&stub_path);
        command
            .arg("--title")
            .arg(&entry.name)
            .current_dir(stub_path.parent().unwrap_or(&self.games_root));

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        let child = command.spawn().map_err(|error| {
            AppError::spawn_failed(format!(
                "the runner at {} could not be started: {error}",
                stub_path.display()
            ))
        })?;

        let pid = child.id();
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
                    child: Some(child),
                },
            );
        }

        Ok(view)
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

        let mut quest = live.remove(id).ok_or_else(|| {
            AppError::not_installed(format!("there is no quest `{id}` to stop"))
        })?;

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
                let stub_present = records::stub_installed(Path::new(&quest.view.stub_path));
                quest.view.running = stub_present;
                quest.view.state = if stub_present {
                    QuestState::Running
                } else {
                    QuestState::Missing
                };

                views.push(quest.view.clone());
            }

            for id in ended {
                live.remove(&id);
                self.forget(&id);
            }
        }

        let error = self
            .reconcile_error
            .lock()
            .ok()
            .and_then(|slot| slot.clone());

        QuestList { quests: views, error }
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
            let segments = match path::segments(&executable.path) {
                Ok(segments) => segments,
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

            let stub_path = path::stub_path(&self.games_root, &entry.id, &segments);

            states.push(StubState {
                registered_path: executable.path.clone(),
                installed: records::stub_installed(&stub_path),
                path: stub_path.display().to_string(),
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
    use std::time::Duration;

    /// A service over a temporary directory. The catalogue is never loaded, so
    /// nothing here touches the network.
    fn service(dir: &Path) -> QuestService {
        let catalogue =
            CatalogueService::new(dir.to_path_buf(), Duration::from_secs(3600)).expect("the service builds");
        QuestService::new(catalogue, dir.to_path_buf())
    }

    fn record(dir: &Path, id: &str, pid: u32) -> QuestRecord {
        QuestRecord {
            id: id.to_string(),
            app_id: "1".to_string(),
            display_name: "Alpha".to_string(),
            registered_path: "a/b.exe".to_string(),
            stub_path: dir.join("games").join("1").join("a").join("b").display().to_string(),
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
}
