//! Questing: writing a stub where Discord expects one, and running it.
//!
//! A quest is three things, in this order:
//!
//! 1. Resolve the registered path from the catalogue the backend already holds.
//!    The frontend never supplies a path; it names the application, and the backend
//!    finds the executable itself. That is what keeps the stub inside the user's own
//!    directory: the path always comes from Discord's data, never from the interface.
//! 2. Write the runner to that path, with the file's extension removed.
//! 3. Run it, and remember its PID.
//!
//! Stopping a quest terminates that one process, by its handle. Nothing is ever
//! stopped by image name, so a real game the user is running is never touched.
//!
//! A quest outlives the application, so the app has to be able to answer honestly
//! about a quest it did not start in this session. That answer comes from two
//! places, and never from a flag the app set earlier: the process table
//! (`process`) and the filesystem (`records`).

pub mod path;
pub mod process;
pub mod records;
pub mod service;

pub use service::{QuestList, QuestRequest, QuestService, QuestState, QuestView, StubState};
