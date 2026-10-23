//! Read Discord's quest list, the way the application reads it.
//!
//!   cargo run --manifest-path src-tauri/Cargo.toml --example list_quests -- <port>
//!
//! The reader is the application's own: it finds Discord's quest store by
//! shape, so it keeps working when the export names the quest operation uses
//! move.

use discord_auto_quest_lib::quest::cdp::Session;
use discord_auto_quest_lib::quest::discord;
use discord_auto_quest_lib::quest::reader;

#[tokio::main]
async fn main() {
    let Some(port) = std::env::args()
        .nth(1)
        .and_then(|arg| arg.parse::<u16>().ok())
    else {
        eprintln!("usage: list_quests <port>");
        std::process::exit(2);
    };

    let targets = discord::list_targets(port)
        .await
        .expect("the debugger answers");
    let page = discord::pick_renderer(&targets).expect("a page to attach to");

    let mut session = Session::connect(&page.web_socket_url)
        .await
        .expect("the session connects");

    let list = reader::read_state(&mut session)
        .await
        .expect("the quest state is read");

    println!("desktop app: {}", list.desktop_app);
    println!("expired and never accepted: {}", list.expired);
    println!("running games: {:?}", list.running_games);
    println!();

    println!("AVAILABLE ({}):", list.available.len());
    for quest in &list.available {
        println!(
            "  {:<44} {:<22} target {:>5}s  reward {:?}  expires {}",
            quest.name,
            quest.tasks.join(","),
            quest.target_seconds,
            quest.reward_orbs,
            quest.expires_at.clone().unwrap_or_default()
        );
    }

    println!();
    println!("CLAIMED ({}):", list.claimed.len());
    for quest in &list.claimed {
        println!(
            "  {:<44} {:<10} {:>5}/{:<5}s  reward {:?}",
            quest.name,
            format!("{:?}", quest.state),
            quest.progress_seconds,
            quest.target_seconds,
            quest.reward_orbs
        );
    }
}
