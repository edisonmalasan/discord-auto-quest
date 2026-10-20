//! The Linux runner: a stub process that stands in for a game.
//!
//! Discord's local activity detection reports a game as running when it sees a
//! process whose image path matches the executable Discord has registered for that
//! application. On Linux that is a process at a path, so the runner is the
//! smallest thing that can be one: it sleeps.
//!
//! It deliberately has no window and no toolkit:
//!
//! - The upstream Linux runner draws a GTK4 window. GTK cannot be assumed on a
//!   user's machine, and a quest should not need a graphical toolkit installed to
//!   be detected.
//! - The runner is headless, which is the same thing as starting hidden. A quest
//!   is not a game, and a dozen quests should not be a dozen windows.
//!
//! The crate has no dependencies, so the runner links the C library and nothing
//! else: no GTK, no X11, no Wayland.
//!
//! The app stops it by process id. Nothing here terminates it, because a process
//! that died on its own would look like a quest the user stopped.

use std::time::Duration;

/// How long the runner sleeps between checks.
///
/// The sleep is in pieces so a signal is noticed promptly: `SIGTERM` ends the
/// process, and the app waits for that rather than for a whole interval.
const INTERVAL: Duration = Duration::from_millis(200);

fn main() {
    // The title is accepted because the app passes it for every platform, and the
    // contract is the same everywhere. On Linux there is no window to carry it,
    // and no window is needed.
    let _title = title_from_arguments();

    loop {
        std::thread::sleep(INTERVAL);
    }
}

/// The game's name, from the `--title` the app passes.
fn title_from_arguments() -> String {
    let mut arguments = std::env::args().skip(1);

    while let Some(argument) = arguments.next() {
        if argument == "--title" {
            if let Some(title) = arguments.next() {
                return title;
            }
        }
    }

    String::new()
}
