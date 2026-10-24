//! Confirmed desktop updates and local completion notification preferences.
use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::{path::Path, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_updater::UpdaterExt;

mod download;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateState {
    pub status: String,
    pub installed: bool,
    pub current_version: String,
    pub version: Option<String>,
    pub notes: Option<String>,
    pub progress: Option<f64>,
    pub message: Option<String>,
}

impl UpdateState {
    fn new(installed: bool) -> Self {
        Self {
            status: "idle".into(),
            installed,
            current_version: crate::VERSION.into(),
            version: None,
            notes: None,
            progress: None,
            message: None,
        }
    }
}

fn stable_upgrade(current: &str, candidate: &str) -> bool {
    let (Ok(current), Ok(candidate)) = (
        semver::Version::parse(current),
        semver::Version::parse(candidate),
    ) else {
        return false;
    };
    candidate.pre.is_empty() && candidate.cmp_precedence(&current).is_gt()
}

fn same_installation(executable: &Path, location: &str) -> bool {
    let location = location.trim();
    let location = location
        .strip_prefix('"')
        .and_then(|value| value.strip_suffix('"'))
        .unwrap_or(location);
    if location.is_empty()
        || !Path::new(location).is_absolute()
        || executable.file_name().and_then(|name| name.to_str()) != Some("discord-auto-quest.exe")
    {
        return false;
    }
    let (Some(parent), Ok(location)) = (executable.parent(), std::fs::canonicalize(location))
    else {
        return false;
    };
    let Ok(parent) = std::fs::canonicalize(parent) else {
        return false;
    };
    #[cfg(windows)]
    {
        parent
            .to_string_lossy()
            .eq_ignore_ascii_case(&location.to_string_lossy())
    }
    #[cfg(not(windows))]
    {
        parent == location
    }
}

pub fn installed_application() -> bool {
    if cfg!(debug_assertions) {
        return false;
    }
    #[cfg(windows)]
    {
        use winreg::{enums::HKEY_CURRENT_USER, RegKey};
        let Ok(key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey(
            "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Discord Auto Quest",
        ) else {
            return false;
        };
        let (Ok(location), Ok(executable)) = (
            key.get_value::<String, _>("InstallLocation"),
            std::env::current_exe(),
        ) else {
            return false;
        };
        same_installation(&executable, &location)
    }
    #[cfg(not(windows))]
    {
        false
    }
}

fn require_stopped(phase: &str) -> AppResult<()> {
    if phase == "stopped" {
        Ok(())
    } else {
        Err(AppError::not_supported(
            "Work has not confirmed that it stopped. The update was not installed.",
        ))
    }
}

fn install_after_confirmed_stop(
    phase: &str,
    install: impl FnOnce() -> AppResult<()>,
) -> AppResult<()> {
    require_stopped(phase)?;
    install()
}

struct UpdateInner {
    state: UpdateState,
    pending: Option<tauri_plugin_updater::Update>,
}

pub struct UpdateManager {
    inner: Mutex<UpdateInner>,
    operation: tokio::sync::Mutex<()>,
    /// Commands that can start or change Work take this gate too.
    /// The update owns it until its stop/download/install sequence ends.
    pub work_gate: tokio::sync::Mutex<()>,
}

impl Default for UpdateManager {
    fn default() -> Self {
        Self {
            inner: Mutex::new(UpdateInner {
                state: UpdateState::new(installed_application()),
                pending: None,
            }),
            operation: tokio::sync::Mutex::new(()),
            work_gate: tokio::sync::Mutex::new(()),
        }
    }
}

impl UpdateManager {
    fn snapshot(&self) -> UpdateState {
        self.inner.lock().expect("update state").state.clone()
    }

    pub fn installation_in_progress(&self) -> bool {
        self.work_gate.try_lock().is_err()
            || matches!(
                self.snapshot().status.as_str(),
                "downloading" | "installing"
            )
    }

    fn publish(&self, app: &AppHandle, change: impl FnOnce(&mut UpdateState)) -> UpdateState {
        let state = {
            let mut inner = self.inner.lock().expect("update state");
            change(&mut inner.state);
            inner.state.clone()
        };
        let _ = app.emit("update-state", &state);
        state
    }

    fn fail(&self, app: &AppHandle, error: &AppError) {
        self.publish(app, |state| {
            state.status = "error".into();
            state.progress = None;
            state.message = Some(error.message.clone());
        });
    }
}

#[tauri::command]
pub fn update_status(manager: State<'_, UpdateManager>) -> UpdateState {
    manager.snapshot()
}

#[tauri::command]
pub async fn check_for_updates(
    app: AppHandle,
    manager: State<'_, UpdateManager>,
) -> AppResult<UpdateState> {
    let Ok(_operation) = manager.operation.try_lock() else {
        return Ok(manager.snapshot());
    };
    manager.publish(&app, |state| {
        state.status = "checking".into();
        state.installed = installed_application();
        state.message = None;
        state.progress = None;
    });
    let result = async {
        let updater = app
            .updater_builder()
            .timeout(std::time::Duration::from_secs(30))
            .version_comparator(|current, candidate| {
                stable_upgrade(&current.to_string(), &candidate.version.to_string())
            })
            .build()
            .map_err(|_| AppError::network("Could not prepare the update check."))?;
        updater.check().await.map_err(|_| {
            AppError::network("Could not check for updates. Check your connection and try again.")
        })
    }
    .await;
    Ok(match result {
        Ok(update) => {
            // The stable feed is public GitHub latest, which excludes drafts and prereleases.
            // Also bind the manifest URL and version to this project's exact stable asset.
            if let Some(update) = update.as_ref() {
                let expected=format!("https://github.com/edisonmalasan/discord-auto-quest/releases/download/v{0}/Discord-Auto-Quest-{0}-windows-x64-setup.exe",update.version);
                if !stable_upgrade(crate::VERSION, &update.version)
                    || update.download_url.as_str() != expected
                {
                    let error = AppError::invalid_payload(
                        "The update feed did not identify a supported stable Windows release.",
                    );
                    manager.inner.lock().expect("update state").pending = None;
                    manager.fail(&app, &error);
                    return Ok(manager.snapshot());
                }
            }
            let version = update.as_ref().map(|update| update.version.clone());
            let notes = update.as_ref().and_then(|update| update.body.clone());
            manager.inner.lock().expect("update state").pending = update;
            manager.publish(&app, |state| {
                state.status = if version.is_some() {
                    "available"
                } else {
                    "up-to-date"
                }
                .into();
                state.version = version;
                state.notes = notes;
            })
        }
        Err(error) => {
            manager.fail(&app, &error);
            manager.snapshot()
        }
    })
}

#[tauri::command]
pub async fn install_update(
    app: AppHandle,
    manager: State<'_, UpdateManager>,
    state: State<'_, crate::AppState>,
) -> AppResult<()> {
    let _operation = manager
        .operation
        .try_lock()
        .map_err(|_| AppError::not_supported("An update operation is already in progress."))?;
    let _work = manager.work_gate.try_lock().map_err(|_| {
        AppError::not_supported("Wait for the current Work command before installing an update.")
    })?;
    if !installed_application() {
        return Err(AppError::not_supported(
            "Portable builds download updates from the release page.",
        ));
    }
    let update = manager
        .inner
        .lock()
        .expect("update state")
        .pending
        .clone()
        .ok_or_else(|| AppError::not_supported("Check for an update before installing it."))?;
    let result=async {
        let stopped=serde_json::to_value(state.discord.stop_work().await?)?;
        require_stopped(stopped["phase"].as_str().unwrap_or_default())?;
        manager.publish(&app,|state| {state.status="downloading".into();state.progress=Some(0.0);state.message=None;});
        let mut downloaded=0_u64;
        let bytes=download::bounded_download(async { update.download(|chunk,total| {
            downloaded=downloaded.saturating_add(chunk as u64);
            manager.publish(&app,|state| {state.progress=total.filter(|total|*total>0).map(|total|((downloaded as f64/total as f64)*100.0).clamp(0.0,100.0));});
        },||{}).await.map_err(|_|AppError::network("The update could not be downloaded or its signature could not be verified. Nothing was installed.")) }, download::DOWNLOAD_LIMIT).await?;
        // Confirm again after the network wait. An uncertain stop can never reach install.
        let stopped=serde_json::to_value(state.discord.stop_work().await?)?;
        install_after_confirmed_stop(stopped["phase"].as_str().unwrap_or_default(),|| {
            manager.publish(&app,|state| {state.status="installing".into();state.progress=Some(100.0);});
            update.install(bytes).map_err(|_|AppError::io("The installer could not start. Try again or download the release manually."))
        })?;
        Ok(())
    }.await;
    if let Err(error) = &result {
        manager.fail(&app, error);
    }
    result
}

#[derive(Clone, Copy, Debug, Serialize)]
pub struct NotificationPreferences {
    pub enabled: bool,
    pub installed: bool,
}

#[derive(Default, Deserialize, Serialize)]
struct SavedPreferences {
    enabled: bool,
}

fn preferences_path(app: &AppHandle) -> AppResult<std::path::PathBuf> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join("notifications.json"))
        .map_err(|_| AppError::io("The application preferences folder could not be located."))
}

fn read_preferences(path: &Path) -> SavedPreferences {
    std::fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn notification_preferences(app: AppHandle) -> AppResult<NotificationPreferences> {
    let installed = installed_application();
    Ok(NotificationPreferences {
        enabled: installed && read_preferences(&preferences_path(&app)?).enabled,
        installed,
    })
}

#[tauri::command]
pub fn set_notification_preferences(
    app: AppHandle,
    enabled: bool,
) -> AppResult<NotificationPreferences> {
    let installed = installed_application();
    if enabled && !installed {
        return Err(AppError::not_supported(
            "Completion notifications are available in the installed Windows app.",
        ));
    }
    // This command is called only for an explicit opt-in. On Windows the native
    // plugin reports Granted without prompting; Windows notification settings still apply.
    if enabled {
        let permission = app
            .notification()
            .request_permission()
            .map_err(|_| AppError::permission("Notification permission could not be checked."))?;
        if permission != tauri_plugin_notification::PermissionState::Granted {
            return Err(AppError::permission(
                "Notifications are disabled in system settings.",
            ));
        }
    }
    let path = preferences_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec(&SavedPreferences { enabled })?)?;
    Ok(NotificationPreferences { enabled, installed })
}

/// Called only for the backend's deduplicated Discord-confirmed completion event.
pub fn notify_quest_completed(app: &AppHandle, name: &str) -> AppResult<()> {
    if !installed_application() || !read_preferences(&preferences_path(app)?).enabled {
        return Ok(());
    }
    app.notification()
        .builder()
        .title("Quest completed")
        .body(format!("{name} is complete. Claim any reward in Discord."))
        .show()
        .map_err(|_| AppError::io("The completion notification could not be shown."))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn updates_only_accept_newer_stable_semver() {
        assert!(stable_upgrade("1.1.0", "1.2.0"));
        for candidate in ["1.0.9", "1.1.0", "1.1.0+build", "1.2.0-rc.1", "garbage"] {
            assert!(!stable_upgrade("1.1.0", candidate), "{candidate}");
        }
    }

    #[test]
    fn registry_location_must_identify_the_running_installation() {
        let directory =
            std::env::temp_dir().join(format!("daq-install-test-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        let executable = directory.join("discord-auto-quest.exe");
        std::fs::write(&executable, b"test").unwrap();
        assert!(same_installation(
            &executable,
            &format!("\"{}\"", directory.display())
        ));
        assert!(!same_installation(&executable, ""));
        assert!(!same_installation(
            &executable,
            directory.join("another").to_str().unwrap()
        ));
        std::fs::remove_file(executable).unwrap();
        std::fs::remove_dir(directory).unwrap();
    }

    #[test]
    fn installation_refuses_every_unconfirmed_stop_phase() {
        let mut installed = false;
        install_after_confirmed_stop("stopped", || {
            installed = true;
            Ok(())
        })
        .unwrap();
        assert!(installed);
        for phase in ["starting", "working", "waiting", "stopping", "paused", ""] {
            let mut installed = false;
            assert!(
                install_after_confirmed_stop(phase, || {
                    installed = true;
                    Ok(())
                })
                .is_err(),
                "{phase}"
            );
            assert!(!installed, "installer ran during {phase}");
        }
    }

    #[test]
    fn missing_or_corrupt_preferences_never_opt_in() {
        let path =
            std::env::temp_dir().join(format!("daq-preferences-test-{}.json", std::process::id()));
        assert!(!read_preferences(&path).enabled);
        std::fs::write(&path, b"not-json").unwrap();
        assert!(!read_preferences(&path).enabled);
        std::fs::write(&path, br#"{"enabled":true}"#).unwrap();
        assert!(read_preferences(&path).enabled);
        std::fs::remove_file(path).unwrap();
    }
}
