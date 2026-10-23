//! Questing: making Discord count a quest.
//!
//! There is no quest API. Discord counts a quest from its own client, from
//! the running-games store the client keeps, and the client's heartbeat is
//! what moves the progress.
//!
//! So the quest operation runs *inside* Discord's renderer, over the Chrome
//! DevTools Protocol, and makes the client believe the game is running.
//! That is the whole mechanism.
//!
//! The parts:
//!
//! - `discord` finds Discord and the debugger inside it.
//! - `cdp` speaks the DevTools Protocol: evaluate an expression in the
//!   renderer, and read back what it prints.
//! - `payload` holds the quest operation, encrypted, and decrypts it in memory.
//!   It is never written to disk.
//! - `driver` prepares and restores Discord's own methods, and runs the
//!   operation inside a function wrapper.
//! - `reader` reads the quest state out of the client's store, by shape
//!   rather than by a pinned export name, so a Discord update does not stop
//!   the application from saying what it can see.
//!
//! The rest of this module's history — a stub mechanism that wrote an
//! executable at a mirrored path — is in `re/docs/`.

pub mod cdp;
pub mod discord;
pub mod driver;
pub mod payload;
pub mod reader;
