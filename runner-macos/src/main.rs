//! The macOS runner: a stub process that stands in for a game.
//!
//! Discord's local activity detection reports a game as running when it sees a
//! running *application* whose path matches the bundle Discord registered for
//! that game. On macOS that is a materially different thing from a bare
//! executable, so this runner is materially different too: it is a window.
//!
//! The window is small and it is the whole point. A macOS application that has
//! no visible window is not an application to Discord's local integration, so the
//! runner presents one, titled with the game's name, and stays until the app
//! stops it.
//!
//! The app stops it by process id. Nothing here terminates it, because a
//! process that died on its own would look like a quest the user stopped.

use std::process::ExitCode;

use winit::application::ApplicationHandler;
use winit::event::WindowEvent;
use winit::event_loop::{ActiveEventLoop, ControlFlow, EventLoop};
use winit::window::{Window, WindowAttributes};

/// The window's size in logical pixels.
///
/// Small on purpose. The window exists so Discord's macOS integration can see
/// an application; it is not something the user asked to look at.
const WINDOW_WIDTH: u32 = 320;
const WINDOW_HEIGHT: u32 = 200;

fn main() -> ExitCode {
    let title = title_from_arguments();

    let event_loop = EventLoop::new().expect("the event loop must be created");
    event_loop.set_control_flow(ControlFlow::Wait);

    let mut runner = Runner {
        title,
        window: None,
    };

    // The runner runs until the app stops it, or until the user closes the
    // window. Either way the quest is over.
    let _ = event_loop.run_app(&mut runner);

    ExitCode::SUCCESS
}

/// The game's name, from the `--title` the app passes.
///
/// The app passes the name so the window can carry it. When there is no name,
/// the window says what it is rather than nothing.
fn title_from_arguments() -> String {
    let mut arguments = std::env::args().skip(1);

    while let Some(argument) = arguments.next() {
        if argument == "--title" {
            if let Some(title) = arguments.next() {
                return title;
            }
        }
    }

    "Discord quest".to_string()
}

/// The runner's window.
struct Runner {
    title: String,
    window: Option<Window>,
}

impl ApplicationHandler for Runner {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        let attributes = WindowAttributes::default()
            .with_title(self.title.clone())
            .with_visible(true)
            .with_inner_size(winit::dpi::LogicalSize::new(
                WINDOW_WIDTH,
                WINDOW_HEIGHT,
            ));

        let window = event_loop
            .create_window(attributes)
            .expect("the window must be created");
        window.set_visible(true);

        self.window = Some(window);
    }

    fn window_event(&mut self, event_loop: &ActiveEventLoop, _id: winit::window::WindowId, event: WindowEvent) {
        // The user closing the window ends the quest. The app's own Stop button
        // does the same thing from the other side.
        if let WindowEvent::CloseRequested = event {
            event_loop.exit();
        }
    }
}
