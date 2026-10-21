pub mod discord;
pub mod error;
pub mod quest;

/// The version of this build.
///
/// It is set by the build script from the workspace manifest, so the about
/// panel cannot show a version that disagrees with the one the application
/// was shipped as.
pub const VERSION: &str = env!("APP_VERSION");

use discord::DiscordState;
use error::{AppError, AppResult};
use quest::reader::QuestList;
use tauri::State;

/// The application's connection to Discord.
pub struct AppState {
    pub discord: DiscordState,
}

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
async fn relaunch_discord(state: State<'_, AppState>) -> AppResult<()> {
    let install = quest::discord::Install::locate()
        .ok_or_else(|| AppError::not_supported("Discord is not installed on this machine"))?;

    install.launch_with_debugger()?;
    state.discord.attach().await
}

/// The quests Discord has: the ones on offer, and the ones already accepted.
#[tauri::command]
async fn list_discord_quests(state: State<'_, AppState>) -> AppResult<QuestList> {
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
        .manage(AppState {
            discord: DiscordState::default(),
        })
        .invoke_handler(tauri::generate_handler![
            app_version,
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
