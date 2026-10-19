use std::collections::HashMap;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};

use crate::catalogue::service::CatalogueService;
use crate::error::{AppError, AppResult};
use crate::runner;

use super::path;

/// The `CREATE_NO_WINDOW` flag. The runner is a windowed binary already, so this
/// only makes sure a console can never appear.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// What the interface asks for: an application, and the registered path it wants to
/// mirror.
///
/// The path is checked against the catalogue the backend holds. A path the backend
/// does not recognise is refused, so the interface cannot aim the stub anywhere the
/// catalogue does not already point.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestRequest {
    pub app_id: String,
    pub registered_path: String,
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
    /// Whether the process is still running.
    pub running: bool,
    /// The registered path the stub is mirroring.
    pub registered_path: String,
}

struct LiveQuest {
    view: QuestView,
    child: Child,
}

/// Runs quests.
pub struct QuestService {
    catalogue: CatalogueService,
    games_root: PathBuf,
    live: Arc<Mutex<HashMap<String, LiveQuest>>>,
}

impl QuestService {
    pub fn new(catalogue: CatalogueService, data_dir: PathBuf) -> Self {
        Self {
            catalogue,
            games_root: data_dir.join("games"),
            live: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Where the stubs live.
    pub fn games_root(&self) -> &PathBuf {
        &self.games_root
    }

    /// Start a quest: write the stub, run it, and remember its PID.
    pub fn start(&self, request: &QuestRequest) -> AppResult<QuestView> {
        if !self.catalogue.is_loaded() {
            return Err(AppError::not_questable(
                "the catalogue has not been loaded yet, so there is no registered path to mirror",
            ));
        }

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
        // process per path, because one path is what Discord matches.
        self.stop(&id).ok();

        runner::materialise(&stub_path)?;

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
            registered_path: executable.path.clone(),
        };

        if let Ok(mut live) = self.live.lock() {
            live.insert(
                id,
                LiveQuest {
                    view: view.clone(),
                    child,
                },
            );
        }

        Ok(view)
    }

    /// Stop a quest by its identity.
    ///
    /// The process is terminated through the handle the application holds, so
    /// exactly one process is signalled. A real game running from the same file name
    /// is untouched.
    pub fn stop(&self, id: &str) -> AppResult<QuestView> {
        let mut live = self
            .live
            .lock()
            .map_err(|_| AppError::io("the quest table is poisoned"))?;

        let mut quest = live
            .remove(id)
            .ok_or_else(|| AppError::not_installed(format!("there is no quest `{id}` to stop")))?;

        // Kill through the handle, then reap, so the process is gone and the handle
        // is not left dangling.
        let _ = quest.child.kill();
        let _ = quest.child.wait();

        let mut view = quest.view;
        view.running = false;
        Ok(view)
    }

    /// The quests that are running.
    ///
    /// The list is read from the process table rather than from a flag the
    /// application set, so a stub that died on its own is reported as stopped.
    pub fn list(&self) -> Vec<QuestView> {
        let mut live = match self.live.lock() {
            Ok(live) => live,
            Err(_) => return Vec::new(),
        };

        let mut views = Vec::with_capacity(live.len());

        for (id, quest) in live.iter_mut() {
            let running = match quest.child.try_wait() {
                Ok(Some(_)) => false,
                Ok(None) => true,
                Err(_) => false,
            };

            views.push(QuestView {
                id: id.clone(),
                app_id: quest.view.app_id.clone(),
                display_name: quest.view.display_name.clone(),
                stub_path: quest.view.stub_path.clone(),
                pid: quest.view.pid,
                started_at: quest.view.started_at,
                running,
                registered_path: quest.view.registered_path.clone(),
            });
        }

        views
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

    #[test]
    fn a_quest_id_names_the_application_and_the_executable() {
        assert_eq!(quest_id("123", "a/b.exe"), "123:a/b.exe");
    }
}
