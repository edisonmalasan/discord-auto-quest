pub mod catalogue;
pub mod error;
pub mod paths;

use catalogue::model::CatalogueSnapshot;
use catalogue::service::CatalogueService;
use error::{AppError, AppResult};
use tauri::{AppHandle, Emitter, Manager, State};

/// Emitted after a background refresh has replaced the catalogue.
pub const CATALOGUE_UPDATED_EVENT: &str = "catalogue-updated";

/// Emitted when a background refresh failed. The cached copy stays on screen.
pub const CATALOGUE_REFRESH_FAILED_EVENT: &str = "catalogue-refresh-failed";

pub struct AppState {
    pub catalogue: CatalogueService,
}

/// Serve the catalogue.
///
/// The cached copy is served immediately when one exists, so start-up never waits on
/// the network. A cached copy that is past its refresh interval is refreshed in the
/// background, and the frontend is told when the fresh one is ready.
#[tauri::command]
async fn load_catalogue(app: AppHandle, state: State<'_, AppState>) -> AppResult<CatalogueSnapshot> {
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

/// Where the app keeps its per-user data. The frontend is told so it can show it.
#[tauri::command]
fn data_directory(state: State<'_, AppState>) -> String {
    state.catalogue.dir().display().to_string()
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = paths::user_data_dir().ok_or_else(|| {
                AppError::io("could not resolve this user's data directory")
            })?;
            std::fs::create_dir_all(&dir)?;

            let service = CatalogueService::new(dir, catalogue::service::DEFAULT_TTL)?;
            app.manage(AppState { catalogue: service });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_catalogue,
            refresh_catalogue,
            data_directory,
            current_platform
        ])
        .run(tauri::generate_context!())
        .expect("error while running the discord-auto-quest application");
}
