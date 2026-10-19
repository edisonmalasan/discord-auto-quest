// A console subsystem would flash a console window on launch, so the release build
// is a windowed binary.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    discord_auto_quest_lib::run()
}
