//! Repeat launches activate the existing release window without changing Work.

use std::sync::atomic::{AtomicBool, Ordering};
#[cfg(windows)]
use tauri::Emitter;
use tauri::{Manager, Runtime};

#[derive(Default)]
pub struct LaunchNotice(AtomicBool);

impl LaunchNotice {
    #[cfg(any(windows, test))]
    fn request(&self) {
        self.0.store(true, Ordering::SeqCst);
    }

    fn take(&self) -> bool {
        self.0.swap(false, Ordering::SeqCst)
    }
}

fn activate<R: Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        if window.is_minimized().unwrap_or(false) {
            let _ = window.unminimize();
        }
        let _ = window.set_focus();
    }
}

/// Register before every other plugin and before application setup.
pub fn register<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    #[cfg(windows)]
    if !cfg!(debug_assertions) {
        return builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            app.state::<LaunchNotice>().request();
            activate(app);
            let _ = app.emit("app-activation-requested", ());
        }));
    }
    // Development windows remain independent of each other and installed copies.
    builder
}

/// Consume a pending launch only once, including launches before webview readiness.
#[tauri::command]
pub fn take_launch_notice(app: tauri::AppHandle, notice: tauri::State<'_, LaunchNotice>) -> bool {
    let pending = notice.take();
    if pending {
        activate(&app);
    }
    pending
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn startup_and_reloads_do_not_invent_or_replay_launches() {
        let notice = LaunchNotice::default();
        assert!(!notice.take());
        notice.request();
        notice.request();
        assert!(notice.take(), "early and rapid launches remain pending");
        assert!(
            !notice.take(),
            "a second consumer must not replay the notice"
        );
        notice.request();
        assert!(notice.take(), "later launches still notify");
    }

    #[test]
    fn concurrent_consumers_cannot_duplicate_a_notice() {
        let notice = std::sync::Arc::new(LaunchNotice::default());
        notice.request();
        let readers: Vec<_> = (0..8)
            .map(|_| {
                let notice = notice.clone();
                std::thread::spawn(move || usize::from(notice.take()))
            })
            .collect();
        assert_eq!(
            readers
                .into_iter()
                .map(|reader| reader.join().unwrap())
                .sum::<usize>(),
            1
        );
    }
}
