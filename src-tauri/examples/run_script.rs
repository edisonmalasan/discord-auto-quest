//! Run a script in a browser's renderer and follow what it prints.
//!
//!   cargo run --manifest-path src-tauri/Cargo.toml --example run_script -- <port> <file.js> [seconds]
//!
//! This is the driver in miniature: evaluate the script, then read the lines it
//! prints until it goes quiet. The quest script prints `Quest progress: 12/900`
//! as it works, and those lines are the whole of the progress report.

use std::time::Duration;

use discord_auto_quest_lib::quest::cdp::Session;

#[tokio::main]
async fn main() {
    let mut arguments = std::env::args().skip(1);

    let Some(port) = arguments.next().and_then(|arg| arg.parse::<u16>().ok()) else {
        eprintln!("usage: run_script <port> <file.js> [seconds]");
        std::process::exit(2);
    };

    let path = arguments.next().expect("a script to run");
    let seconds: u64 = arguments
        .next()
        .and_then(|arg| arg.parse().ok())
        .unwrap_or(20);

    let script = std::fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("the script could not be read: {error}"));

    let url = format!("http://127.0.0.1:{port}/json/list");
    let response = reqwest::get(&url).await.expect("the debugger answers");
    let targets: Vec<discord_auto_quest_lib::quest::cdp::Target> =
        response.json().await.expect("the answer is readable");

    let page = targets
        .iter()
        .find(|target| target.is_page())
        .expect("a page to attach to");

    let mut session = Session::connect(&page.web_socket_url)
        .await
        .expect("the session connects");

    println!("=== running {}", path);
    match session.evaluate(&script).await {
        Ok(value) => println!("--- the script returned: {value}"),
        Err(error) => println!("--- the script raised: {error}"),
    }

    println!("--- what it prints");
    let deadline = tokio::time::Instant::now() + Duration::from_secs(seconds);
    loop {
        let next = tokio::time::timeout_at(deadline, session.next_console_line()).await;

        match next {
            Ok(Some(line)) => println!("  {line}"),
            Ok(None) => {
                println!("  (the connection closed)");
                break;
            }
            Err(_) => break,
        }
    }

    println!("--- done");
}
