//! Drive Discord, the way the application does.
//!
//!   cargo run --manifest-path src-tauri/Cargo.toml --example drive
//!
//! Attaches to Discord's renderer, reads its quest state, runs the quest
//! script, and puts Discord's own methods back. It is the same path the
//! application's commands take.

use discord_auto_quest_lib::discord::DiscordState;

#[tokio::main]
async fn main() {
    let state = DiscordState::default();

    let status = state.status().await;
    println!("installed: {}", status.installed);
    println!("ready:     {}", status.ready);
    if let Some(action) = &status.action {
        println!("action:    {action}");
    }
    println!();

    println!("attaching");
    if let Err(error) = state.attach().await {
        println!("  could not attach: {error}");
        std::process::exit(1);
    }
    println!("  attached");

    println!(
        "desktop app: {}",
        state.is_desktop_app().await.unwrap_or(false)
    );

    match state.quests().await {
        Ok(list) => {
            println!();
            println!("AVAILABLE ({}):", list.available.len());
            for quest in &list.available {
                println!(
                    "  {:<40} {:<24} {:>4}s  {:?}",
                    quest.name,
                    quest.tasks.join(","),
                    quest.target_seconds,
                    quest.reward_orbs
                );
            }
            println!();
            println!("CLAIMED ({}):", list.claimed.len());
            for quest in &list.claimed {
                println!(
                    "  {:<40} {:<10} {}/{}s",
                    quest.name,
                    format!("{:?}", quest.state),
                    quest.progress_seconds,
                    quest.target_seconds
                );
            }
            println!();
            println!("running games: {:?}", list.running_games);
        }
        Err(error) => {
            println!("  the quests could not be read: {error}");
        }
    }

    println!();
    println!("running the quest script");
    match state.run_script().await {
        Ok(spoofing) => {
            if spoofing {
                println!("  the script ran, and a game is being spoofed");
            } else {
                println!("  the script ran, and no game is being spoofed");
                println!("  (either there was nothing to work on, or the script did not attach)");
            }
        }
        Err(error) => println!("  the script did not run: {error}"),
    }

    println!("putting Discord's own methods back");
    match state.stop_script().await {
        Ok(()) => println!("  done"),
        Err(error) => println!("  could not: {error}"),
    }
}
