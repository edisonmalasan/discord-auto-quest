//! Questing: writing a stub where Discord expects one, and running it.
//!
//! A quest is three things, in this order:
//!
//! 1. Resolve the registered path from the catalogue the backend already holds.
//!    The frontend never supplies a path; it names the application, and the backend
//!    finds the executable itself. That is what keeps the stub inside the user's own
//!    directory: the path always comes from Discord's data, never from the interface.
//! 2. Write the runner to that path, exactly as it was registered — the file's
//!    extension included, because the extension is part of the name Discord
//!    registered.
//! 3. Run it, and remember its PID.
//!
//! On macOS the second step is different: a registered path that names an
//! application bundle becomes a real `.app` bundle, because Discord's macOS
//! integration detects applications rather than bare executables.
//!
//! Stopping a quest terminates that one process, by its handle. Nothing is ever
//! stopped by image name, so a real game the user is running is never touched.
//!
//! A quest outlives the application, so the app has to be able to answer honestly
//! about a quest it did not start in this session. That answer comes from two
//! places, and never from a flag the app set earlier: the process table
//! (`process`) and the filesystem (`records`).

//! Questing: making Discord count a quest.
//!
//! There are two routes, and only one of them is the product.
//!
//! **The route the product takes** is the script: `cdp` speaks the Chrome
//! DevTools Protocol to Discord's own renderer, `discord` finds Discord and
//! its debugger, and the quest script runs in there and drives the quest to
//! completion. No stub, no window, and it reaches the quest types a stub could
//! never reach.
//!
//! **The route that is being retired** is the stub: `path`, `bundle`, `launch`,
//! `process`, `records` and `service` materialise an executable at the path
//! Discord has registered for a game, and rely on Discord's local activity
//! detection noticing it. It was built, verified on three platforms, and then
//! observed not to work: Discord's local detection needs the process to have a
//! window, and the catalogue it is driven by carries no quest information at
//! all. It is kept until the script route is proven, and then it goes.
//!
//! The rest of this module's history is in `re/docs/`.

pub mod bundle;
pub mod cdp;
pub mod discord;
pub mod driver;
pub mod launch;
pub mod path;
pub mod payload;
pub mod process;
pub mod reader;
pub mod records;
pub mod service;

pub use service::{QuestList, QuestRequest, QuestService, QuestState, QuestView, StubState};
