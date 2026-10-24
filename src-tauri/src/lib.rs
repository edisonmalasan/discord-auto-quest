pub mod discord;
pub mod error;
pub mod quest;
pub mod updates;

/// The version of this build.
///
/// It is set by the build operation from the workspace manifest, so the about
/// panel cannot show a version that disagrees with the one the application
/// was shipped as.
pub const VERSION: &str = env!("APP_VERSION");

use discord::{DiscordState, WorkEvent, WorkPhase, WorkState};
use error::{AppError, AppResult};
use quest::reader::QuestList;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{Emitter, Manager, State};

/// The application's connection to Discord.
pub struct AppState {
    pub discord: DiscordState,
}

#[derive(Default)]
struct CloseState(AtomicBool);

/// The version of this build.
///
/// The backend is authoritative: the interface shows what the running
/// application says it is, not a number compiled into the frontend.
#[tauri::command]
fn app_version() -> &'static str {
    VERSION
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
async fn relaunch_discord(
    state: State<'_, AppState>,
    updates: State<'_, updates::UpdateManager>,
) -> AppResult<()> {
    let _gate = updates
        .work_gate
        .try_lock()
        .map_err(|_| AppError::not_supported("Wait for the current update or action to finish."))?;
    if state.discord.stop_work().await?.phase != WorkPhase::Stopped {
        return Err(AppError::not_supported(
            "Confirm Stop before restarting Discord.",
        ));
    }
    state.discord.restart().await
}

/// The quests Discord has: the ones on offer, and the ones already accepted.
#[tauri::command]
async fn list_discord_quests(state: State<'_, AppState>) -> AppResult<QuestList> {
    state.discord.quests().await
}

#[tauri::command]
async fn review_quest_offer(
    state: State<'_, AppState>,
    updates: State<'_, updates::UpdateManager>,
    id: String,
) -> AppResult<serde_json::Value> {
    let _gate = updates
        .work_gate
        .try_lock()
        .map_err(|_| AppError::not_supported("Wait for the current update or action to finish."))?;
    state.discord.enrollment(&id, None).await
}

#[tauri::command]
async fn confirm_quest_acceptance(
    state: State<'_, AppState>,
    updates: State<'_, updates::UpdateManager>,
    id: String,
    revision: String,
) -> AppResult<serde_json::Value> {
    let _gate = updates
        .work_gate
        .try_lock()
        .map_err(|_| AppError::not_supported("Wait for the current update or action to finish."))?;
    state.discord.enrollment(&id, Some(&revision)).await
}

/// Run the quest operation in Discord.
#[tauri::command]
async fn start_quest_work(
    state: State<'_, AppState>,
    updates: State<'_, updates::UpdateManager>,
) -> AppResult<WorkState> {
    let _gate = updates
        .work_gate
        .try_lock()
        .map_err(|_| AppError::not_supported("Wait for the current update or action to finish."))?;
    state.discord.start_work().await
}

/// Put Discord's own methods back.
#[tauri::command]
async fn stop_quest_work(state: State<'_, AppState>) -> AppResult<WorkState> {
    state.discord.stop_work().await
}

#[tauri::command]
async fn work_status(state: State<'_, AppState>) -> AppResult<WorkState> {
    Ok(state.discord.work_status().await)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .manage(updates::UpdateManager::default())
        .manage(CloseState::default())
        .manage(AppState {
            discord: DiscordState::default(),
        })
        .setup(|app| {
            let handle = app.handle().clone();
            let events = handle.clone();
            app.state::<AppState>().discord.set_event_sink(Arc::new(move |event| match event {
                WorkEvent::State(state) => { let _ = events.emit("work-state", state); }
                WorkEvent::Completed(quest) => {
                    let _ = events.emit("quest-completed", &quest);
                    let _ = updates::notify_quest_completed(&events, &quest.name);
                }
            }));
            tauri::async_runtime::spawn(async move {
                let mut timer = tokio::time::interval(std::time::Duration::from_secs(4));
                loop {
                    timer.tick().await;
                    if !handle.state::<updates::UpdateManager>().installation_in_progress() {
                        let _ = handle.state::<AppState>().discord.reconcile_work().await;
                    }
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let app = window.app_handle();
                if app.state::<updates::UpdateManager>().installation_in_progress()
                    || app.state::<CloseState>().0.swap(true, Ordering::SeqCst) { return; }
                let window = window.clone();
                tauri::async_runtime::spawn(async move {
                    let app = window.app_handle();
                    let manager = app.state::<updates::UpdateManager>();
                    let _gate = manager.work_gate.lock().await;
                    match app.state::<AppState>().discord.stop_work().await {
                        Ok(state) if state.phase == WorkPhase::Stopped => { let _ = window.destroy(); }
                        _ => { let _ = app.emit("app-close-error", "Work cleanup was not confirmed. Reconnect, try Stop, then close again."); }
                    }
                    app.state::<CloseState>().0.store(false, Ordering::SeqCst);
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            app_version,
            discord_status,
            relaunch_discord,
            list_discord_quests,
            review_quest_offer,
            confirm_quest_acceptance,
            start_quest_work,
            stop_quest_work,
            work_status,
            updates::check_for_updates,
            updates::update_status,
            updates::install_update,
            updates::notification_preferences,
            updates::set_notification_preferences
        ])
        .run(tauri::generate_context!())
        .expect("error while running the discord-auto-quest application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_version_is_the_one_the_workspace_manifest_states() {
        // The build operation reads the version from `package.json` and checks the
        // crate's own manifest against it, so these two are the same number by
        // construction. The assertion is here so a change that breaks that
        // arrangement is caught by the test suite rather than by a user.
        assert_eq!(VERSION, env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn the_version_is_a_release_number() {
        let core = VERSION.split(['-', '+']).next().expect("version core");
        let parts: Vec<&str> = core.split('.').collect();

        assert_eq!(parts.len(), 3, "the version is major.minor.patch");
        for part in parts {
            assert!(
                part.chars().all(|character| character.is_ascii_digit()),
                "the version is a number in every part: {VERSION}"
            );
        }
    }
}
