//! Verify the mechanism, end to end, and report on it.
//!
//!   cargo run --manifest-path src-tauri/Cargo.toml --example verify
//!
//! This is the loop a person runs by hand, run automatically:
//!
//! 1. find Discord, and check whether its debugger is answering;
//! 2. read the quest state out of the client's own store;
//! 3. run the quest script inside the renderer, and follow what it prints;
//! 4. read the quest state again, and see whether the progress moved;
//! 5. put Discord's own methods back, so nothing is left spoofed.
//!
//! It reports what it found at every step, and ends with a summary that says
//! whether the mechanism worked. It changes nothing in Discord beyond the
//! spoof the script itself makes, and it puts that back before it finishes.

use std::time::{Duration, Instant};

use discord_auto_quest_lib::quest::{cdp, discord, driver, reader};

/// How long to follow the script's output for.
const WATCH: Duration = Duration::from_secs(20);

/// How long to wait between reading the quest state again.
const POLL: Duration = Duration::from_secs(2);

#[tokio::main]
async fn main() {
    println!("discord-auto-quest — verification");
    println!("================================\n");

    let mut report = Report::default();

    // 1. Discord, and its debugger.
    let Some(install) = discord::Install::locate() else {
        println!("Discord is not installed on this machine.");
        println!("\nsummary: FAILED — there is no Discord to work with.");
        std::process::exit(1);
    };

    let port = install.debug_port();
    let reachable = install.debugger_is_reachable().await;

    println!("1. Discord");
    println!("   installed:       yes");
    println!(
        "   debugger port:   {}",
        port.map(|p| p.to_string()).unwrap_or_else(|| "none".into())
    );
    println!("   answering:       {}", yes_no(reachable));

    if !reachable {
        println!("\n   Discord is not running with a debugging port.");
        println!("   The application offers to restart it, because that ends whatever");
        println!("   you were doing in it — so it asks first, and the answer is yours.");
        println!("\nsummary: FAILED — Discord is not reachable.");
        std::process::exit(1);
    }

    // 2. Attach, and read the quest state.
    let mut session = match discord::attach_to_discord(&install).await {
        Ok(session) => session,
        Err(error) => {
            println!("\n   could not attach: {error}");
            println!("\nsummary: FAILED — the renderer could not be reached.");
            std::process::exit(1);
        }
    };

    // The browser replays its console history when the debugger attaches, so
    // everything that was ever printed is in the way. It is drained first, so
    // that what follows is what the script says *now*.
    let mut history = 0usize;
    while let Ok(Some(_)) =
        tokio::time::timeout(Duration::from_millis(500), session.next_console_line()).await
    {
        history += 1;
    }

    let before = match reader::read_state(&mut session).await {
        Ok(list) => list,
        Err(error) => {
            println!("\n   the quests could not be read: {error}");
            println!("\nsummary: FAILED — Discord's quest state could not be read.");
            std::process::exit(1);
        }
    };

    println!("\n2. The quests, read out of Discord");
    println!("   on offer:    {}", before.available.len());
    println!("   accepted:    {}", before.claimed.len());
    println!("   expired:     {}", before.expired);
    println!("   desktop app: {}", yes_no(before.desktop_app));
    println!(
        "   ({} lines of earlier console output were set aside)",
        history
    );

    if before.running_games.is_empty() {
        println!("   games running: none");
    } else {
        println!("   games running:");
        for game in &before.running_games {
            println!(
                "     {} ({})",
                game.name,
                game.exe_name.as_deref().unwrap_or("no path")
            );
        }
    }

    for quest in &before.claimed {
        println!(
            "     {:<38} {:>10}  {}",
            quest.name,
            format!("{}/{}s", quest.progress_seconds, quest.target_seconds),
            match quest.state {
                reader::QuestState::Completed => "completed",
                reader::QuestState::Claimed => "accepted",
                reader::QuestState::Available => "available",
            }
        );
    }

    report.claimed_before = before.claimed.len();
    report.available = before.available.len();

    // 3. Run the script, and follow what it prints.
    println!("\n3. The quest script");
    let started = Instant::now();

    match driver::run(&mut session).await {
        Ok(()) => {
            println!("   the script ran.");
        }
        Err(error) => {
            println!("   the script did not attach: {error}");
            println!("\nsummary: FAILED — the script did not attach to Discord.");
            report.finish(&mut session).await;
            std::process::exit(1);
        }
    }

    let spoofing = driver::is_spoofing(&mut session).await.unwrap_or(false);
    println!("   a game is being spoofed: {}", yes_no(spoofing));
    report.spoofing = spoofing;

    // The script prints what it is doing. Those lines are the evidence, and
    // the quest state is read again while it works, so the progress can be
    // reported as it moves rather than only at the end.
    //
    // Discord's own client logs to the console as well, and it logs a great
    // deal. Those lines are CSS-formatted — `%c[Something]` — so they are
    // counted apart from the script's, which are plain sentences.
    let mut script_lines: Vec<String> = Vec::new();
    let mut other = 0usize;
    let mut moved = false;
    let mut last_poll = Instant::now();

    while started.elapsed() < WATCH {
        // Take whatever the page has printed, without waiting long for it.
        let remaining = WATCH.saturating_sub(started.elapsed());

        match tokio::time::timeout(
            remaining.min(Duration::from_millis(250)),
            session.next_console_line(),
        )
        .await
        {
            Ok(Some(line)) => {
                if line.starts_with("%c") {
                    other += 1;
                } else {
                    script_lines.push(line);
                }
            }
            Ok(None) => break,
            Err(_) => {}
        }

        // And every POLL, read the quest state and see whether it has moved.
        if last_poll.elapsed() >= POLL {
            last_poll = Instant::now();

            if let Ok(list) = reader::read_state(&mut session).await {
                for quest in &list.claimed {
                    let was = before
                        .claimed
                        .iter()
                        .find(|q| q.id == quest.id)
                        .map(|q| q.progress_seconds);

                    if let Some(was) = was {
                        if quest.progress_seconds > was {
                            moved = true;
                            println!(
                                "     {} is at {}/{}s",
                                quest.name, quest.progress_seconds, quest.target_seconds
                            );
                        }
                    }
                }
            }
        }
    }

    // The same line more than once is the same message said again — the
    // client repeats itself — so it is counted rather than listed.
    let mut said: Vec<(String, usize)> = Vec::new();
    for line in &script_lines {
        match said.iter_mut().find(|(text, _)| text == line) {
            Some((_, count)) => *count += 1,
            None => said.push((line.clone(), 1)),
        }
    }

    if said.is_empty() {
        println!("   (the script printed nothing of its own)");
    } else {
        for (line, count) in &said {
            if *count > 1 {
                println!("   | {line}  (x{count})");
            } else {
                println!("   | {line}");
            }
        }
        println!(
            "   ({} lines of the client's own logging were left out)",
            other
        );
    }

    // 4. Read the state again, and report where every quest stands.
    println!("\n4. The progress, after the script has run");
    let after = reader::read_state(&mut session).await.ok();

    if let Some(after) = &after {
        for quest in &after.claimed {
            let was = before
                .claimed
                .iter()
                .find(|q| q.id == quest.id)
                .map(|q| q.progress_seconds)
                .unwrap_or(quest.progress_seconds);

            let gain = quest.progress_seconds.saturating_sub(was);

            println!(
                "     {:<38} {:>10}  {}",
                quest.name,
                format!("{}/{}s", quest.progress_seconds, quest.target_seconds),
                if gain > 0 {
                    format!("+{gain}s")
                } else {
                    "no change".to_string()
                }
            );
        }
    } else {
        println!("   the quest state could not be read again.");
    }

    report.moved = moved;
    report.script_lines = script_lines.len();
    report.progress_lines = script_lines
        .iter()
        .filter(|line| line.contains("progress"))
        .count();
    report.nothing_to_do = script_lines
        .iter()
        .any(|line| line.contains("uncompleted quests"));

    // 5. Put Discord's own methods back.
    println!("\n5. Putting Discord's own methods back");
    report.finish(&mut session).await;

    println!("\n================================");
    println!("summary");
    println!("-------");
    println!("  quests on offer:        {}", report.available);
    println!("  quests accepted:        {}", report.claimed_before);
    println!("  a game was spoofed:     {}", yes_no(report.spoofing));
    println!("  the script said:        {} lines", report.script_lines);
    println!("  the progress moved:     {}", yes_no(report.moved));
    println!("  Discord was restored:   {}", yes_no(report.restored));

    let worked = report.spoofing || report.progress_lines > 0 || report.moved;

    println!(
        "\n  {}\n",
        if worked {
            "The mechanism works: the script attached, and Discord is counting."
        } else if report.nothing_to_do {
            "The mechanism is fine, and there was nothing to work on: every quest you have \
         accepted is finished, or its task is one the script does not handle. Accept a \
         fresh quest and run this again."
        } else {
            "The script attached but nothing counted, and it did not say why. That is worth \
         a look — and it is the case the roadmap calls N5."
        }
    );
}

/// What the run found, for the summary at the end.
#[derive(Default)]
struct Report {
    available: usize,
    claimed_before: usize,
    spoofing: bool,
    moved: bool,
    script_lines: usize,
    progress_lines: usize,
    nothing_to_do: bool,
    restored: bool,
}

impl Report {
    /// Put Discord's own methods back, and say whether that worked.
    async fn finish(&mut self, session: &mut cdp::Session) {
        match driver::stop(session).await {
            Ok(()) => self.restored = true,
            Err(error) => println!("   could not: {error}"),
        }
    }
}

/// "yes" or "no".
fn yes_no(value: bool) -> &'static str {
    if value {
        "yes"
    } else {
        "no"
    }
}
