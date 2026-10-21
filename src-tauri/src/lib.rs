pub mod catalogue;
pub mod discord;
pub mod error;
pub mod paths;
pub mod quest;
pub mod runner;

/// The version of this build.
///
/// It is set by the build script from the workspace manifest, so the about
/// panel cannot show a version that disagrees with the one the application was
/// shipped as.
pub const VERSION: &str = env!("APP_VERSION");

use catalogue::model::CatalogueSnapshot;
use catalogue::service::CatalogueService;
use error::{AppError, AppResult};
use quest::{QuestList, QuestRequest, QuestService, QuestView, StubState};
use tauri::{AppHandle, Emitter, Manager, State};

/// Emitted after a background refresh has replaced the catalogue.
pub const CATALOGUE_UPDATED_EVENT: &str = "catalogue-updated";

/// Emitted when a background refresh failed. The cached copy stays on screen.
pub const CATALOGUE_REFRESH_FAILED_EVENT: &str = "catalogue-refresh-failed";

/// Emitted when a quest starts or stops.
pub const QUESTS_CHANGED_EVENT: &str = "quests-changed";

pub struct AppState {
    pub catalogue: CatalogueService,
    pub quests: QuestService,
    /// The application's connection to Discord.
    pub discord: discord::DiscordState,
}

/// Serve the catalogue.
///
/// The cached copy is served immediately when one exists, so start-up never waits on
/// the network. A cached copy that is past its refresh interval is refreshed in the
/// background, and the frontend is told when the fresh one is ready.
#[tauri::command]
async fn load_catalogue(
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<CatalogueSnapshot> {
    let outcome = state.catalogue.load().await?;

    if outcome.needs_refresh {
        let service = CatalogueService::clone(&state.catalogue);
        tauri::async_runtime::spawn(async move {
            match service.refresh().await {
                Ok(snapshot) => {
                    let _ = app.emit(CATALOGUE_UPDATED_EVENT, snapshot);
                }
                Err(error) => {
                    let _ = app.emit(CATALOGUE_REFRESH_FAILED_EVENT, error);
                }
            }
        });
    }

    Ok(outcome.snapshot)
}

/// Fetch the catalogue from Discord, replacing the cached copy.
#[tauri::command]
async fn refresh_catalogue(state: State<'_, AppState>) -> AppResult<CatalogueSnapshot> {
    state.catalogue.refresh().await
}

/// Where the stubs are written. The frontend is told so it can show it.
#[tauri::command]
fn stub_root(state: State<'_, AppState>) -> String {
    state.quests.games_root().display().to_string()
}

/// The platform this build runs on, in the catalogue's own vocabulary.
///
/// The backend is authoritative here: the catalogue records `win32`, `darwin`, and
/// `linux`, and guessing from the user agent would be a guess.
#[tauri::command]
fn current_platform() -> &'static str {
    if cfg!(target_os = "windows") {
        "win32"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else {
        "unknown"
    }
}

/// Whether this platform needs a visible window for a quest to be detected.
///
/// On macOS, Discord's local integration looks for an *application*, so a stub
/// with no window is not a quest. The interface has to say so plainly rather
/// than leave the user wondering why a quest did not count.
#[tauri::command]
fn needs_visible_window() -> bool {
    cfg!(target_os = "macos")
}

/// The version of this build.
///
/// The backend is authoritative: the interface shows what the running
/// application says it is, not a number compiled into the frontend.
#[tauri::command]
fn app_version() -> &'static str {
    VERSION
}

/// Start a quest: write the stub where Discord expects it and run it.
#[tauri::command]
async fn start_quest(
    app: AppHandle,
    state: State<'_, AppState>,
    request: QuestRequest,
) -> AppResult<QuestView> {
    let view = state.quests.start(&request)?;
    let _ = app.emit(QUESTS_CHANGED_EVENT, &view);
    Ok(view)
}

/// Stop a quest. Only that process is terminated.
#[tauri::command]
async fn stop_quest(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> AppResult<QuestView> {
    let view = state.quests.stop(&id)?;
    let _ = app.emit(QUESTS_CHANGED_EVENT, &view);
    Ok(view)
}

/// The quests that are running, and anything the backend could not work out.
#[tauri::command]
fn list_quests(state: State<'_, AppState>) -> QuestList {
    state.quests.list()
}

/// What the filesystem says about each of an application's registered executables.
///
/// The answer is a real check of the file on disk, made now. The interface never
/// infers that a stub is installed from a flag the backend set earlier, and it
/// never asks for a path: the backend resolves the executables from the catalogue
/// it holds.
#[tauri::command]
fn stub_states(state: State<'_, AppState>, app_id: String) -> AppResult<Vec<StubState>> {
    state.quests.stub_states(&app_id)
}

/// Where Discord stands, and what the user has to do about it.
///
/// The answer is a check, made now: whether Discord is installed, whether the
/// application can talk to it, and what has to happen before it can.
#[tauri::command]
async fn discord_status(state: State<'_, AppState>) -> AppResult<discord::DiscordStatus> {
    Ok(state.discord.status().await)
}

/// Restart Discord so the application can drive it.
///
/// The application never calls this on its own: restarting Discord ends
/// whatever the user was doing in it. The interface asks first.
#[tauri::command]
async fn relaunch_discord(state: State<'_, AppState>) -> AppResult<()> {
    let install = quest::discord::Install::locate()
        .ok_or_else(|| AppError::not_supported("Discord is not installed on this machine"))?;

    install.launch_with_debugger()?;
    state.discord.attach().await
}

/// The quests Discord has: the ones on offer, and the ones already accepted.
#[tauri::command]
async fn list_discord_quests(state: State<'_, AppState>) -> AppResult<quest::reader::QuestList> {
    state.discord.quests().await
}

/// Run the quest script in Discord.
#[tauri::command]
async fn run_quest_script(state: State<'_, AppState>) -> AppResult<bool> {
    state.discord.run_script().await
}

/// Put Discord's own methods back.
#[tauri::command]
async fn stop_quest_script(state: State<'_, AppState>) -> AppResult<()> {
    state.discord.stop_script().await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = paths::user_data_dir()
                .ok_or_else(|| AppError::io("could not resolve this user's data directory"))?;
            std::fs::create_dir_all(&dir)?;

            let catalogue = CatalogueService::new(dir.clone(), catalogue::service::DEFAULT_TTL)?;
            let quests = QuestService::new(catalogue.clone(), dir);

            app.manage(AppState {
                catalogue,
                quests,
                discord: discord::DiscordState::default(),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_catalogue,
            refresh_catalogue,
            stub_root,
            current_platform,
            needs_visible_window,
            app_version,
            start_quest,
            stop_quest,
            list_quests,
            stub_states,
            discord_status,
            relaunch_discord,
            list_discord_quests,
            run_quest_script,
            stop_quest_script
        ])
        .run(tauri::generate_context!())
        .expect("error while running the discord-auto-quest application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_version_is_the_one_the_workspace_manifest_states() {
        // The build script reads the version from `package.json` and checks the
        // crate's own manifest against it, so these two are the same number by
        // construction. The assertion is here so a change that breaks that
        // arrangement is caught by the test suite rather than by a user.
        assert_eq!(VERSION, env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn the_version_is_a_release_number() {
        let parts: Vec<&str> = VERSION.split('.').collect();

        assert_eq!(parts.len(), 3, "the version is major.minor.patch");
        for part in parts {
            assert!(
                part.chars().all(|character| character.is_ascii_digit()),
                "the version is a number in every part: {VERSION}"
            );
        }
    }
}
