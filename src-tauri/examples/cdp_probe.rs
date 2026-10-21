//! Run a JavaScript file inside a browser's renderer and print what it returns.
//!
//!   cargo run --manifest-path src-tauri/Cargo.toml --example cdp_probe -- <port> <file.js>
//!
//! Used to work out why the transport misbehaves, to explore what Discord's
//! internals look like today, and to poke at a live Discord without going
//! through the application.

use discord_auto_quest_lib::quest::cdp::Session;

#[tokio::main]
async fn main() {
    let mut arguments = std::env::args().skip(1);

    let Some(port) = arguments.next().and_then(|arg| arg.parse::<u16>().ok()) else {
        eprintln!("usage: cdp_probe <port> [file.js]");
        std::process::exit(2);
    };

    let script = match arguments.next() {
        Some(path) => std::fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("the script could not be read: {error}")),
        None => "1 + 1".to_string(),
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

    println!("\nattaching to {}", page.web_socket_url);
    let mut session = Session::connect(&page.web_socket_url)
        .await
        .expect("the session connects");

    let value = session.evaluate(&script).await.expect("it runs");
    println!("\n--- result ---");
    println!(
        "{}",
        serde_json::to_string_pretty(&value).unwrap_or_default()
    );
}
