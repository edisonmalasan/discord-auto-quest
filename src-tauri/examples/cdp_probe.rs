//! Attach to a browser's debugger and evaluate one expression.
//!
//!   cargo run --manifest-path src-tauri/Cargo.toml --example cdp_probe -- <port>
//!
//! Used to work out why the transport misbehaves, and to poke at a live
//! Discord without going through the application.

use discord_auto_quest_lib::quest::cdp::Session;

#[tokio::main]
async fn main() {
    let Some(port) = std::env::args()
        .nth(1)
        .and_then(|arg| arg.parse::<u16>().ok())
    else {
        eprintln!("usage: cdp_probe <port>");
        std::process::exit(2);
    };

    let url = format!("http://127.0.0.1:{port}/json/list");
    println!("asking {url}");

    let response = reqwest::get(&url).await.expect("the debugger answers");
    let targets: Vec<discord_auto_quest_lib::quest::cdp::Target> =
        response.json().await.expect("the answer is readable");

    for target in &targets {
        println!("  target {} {:?} {}", target.id, target.kind, target.url);
    }

    let page = targets
        .iter()
        .find(|target| target.is_page())
        .expect("a page to attach to");

    println!("\nthrough the client:");
    let mut session = Session::connect(&page.web_socket_url)
        .await
        .expect("the session connects");
    println!("through the client: connected");

    let value = session.evaluate("1 + 1").await.expect("it runs");
    println!("through the client: 1 + 1 = {value}");
}
