//! The runner: a stub process that stands in for a game.
//!
//! Discord's local activity detection reports a game as running when it sees a
//! process whose image path matches the executable Discord has registered for
//! that application. That is the whole mechanism, so this process has exactly
//! one job: exist, at the right path, until it is stopped by the app.
//!
//! So it is built as small and as quiet as it can be:
//!
//! - `no_std` and `no_main`, so there is no standard library and no `main`.
//! - a custom entry point, so there is no CRT startup path.
//! - `kernel32` only, so it imports no GUI library at all: no `user32`, no
//!   `gdi32`, no `shell32`. There is no window, no tray icon and no console.
//!
//! The app stops it by PID. Nothing here terminates it, because a process that
//! died on its own would look like a quest the user stopped.

#![no_std]
#![no_main]

use core::panic::PanicInfo;

/// `INFINITE`, the `Sleep` timeout that never expires.
const INFINITE: u32 = u32::MAX;

#[link(name = "kernel32")]
extern "system" {
    fn Sleep(milliseconds: u32) -> u32;
}

/// The runner's entry point.
///
/// The linker is pointed here, so the binary starts here and nowhere else.
/// The arguments are ignored: the app passes `--title <game name>` to satisfy
/// the runner contract, but on Windows Discord matches the process by its image
/// path, not by anything the process displays.
#[no_mangle]
pub extern "system" fn mainEntryPoint() -> u32 {
    wait_forever()
}

/// Stay alive until the app stops this process.
fn wait_forever() -> ! {
    loop {
        unsafe { Sleep(INFINITE) };
    }
}

/// A panic must not end the process.
///
/// A dead runner is indistinguishable from a quest the user stopped, so a
/// failure keeps the process alive and lets the app decide what to do about it.
#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    wait_forever()
}
