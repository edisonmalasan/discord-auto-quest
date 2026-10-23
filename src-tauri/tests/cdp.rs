//! The DevTools transport, against a real browser.
//!
//! These tests are ignored by default because they start a browser. Run them
//! with `cargo test --manifest-path src-tauri/Cargo.toml -- --ignored`.
//!
//! They exist because the transport is the whole of the mechanism: if the
//! application cannot evaluate code in a Chromium renderer and read back
//! what it prints, nothing else in the project matters.

use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use discord_auto_quest_lib::quest::cdp::{Session, Target};

/// The browsers this test will use, in order of preference.
const BROWSERS: [&str; 4] = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/usr/bin/google-chrome",
];

/// Find a browser to test against.
fn browser() -> Option<PathBuf> {
    BROWSERS
        .iter()
        .map(Path::new)
        .find(|path| path.is_file())
        .map(Path::to_path_buf)
}

/// A browser started with a debugging port, and the port it chose.
struct TestBrowser {
    child: Child,
    port: u16,
}

impl TestBrowser {
    /// Start a browser on a port of its own choosing.
    ///
    /// Each browser gets a profile of its own: a profile that has been used
    /// before still holds the port file of the browser that used it, and that
    /// port is dead.
    fn start() -> Option<TestBrowser> {
        static COUNTER: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

        let executable = browser()?;
        let profile = std::env::temp_dir().join(format!(
            "daq-cdp-test-{}-{}",
            std::process::id(),
            COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        ));

        let _ = std::fs::remove_dir_all(&profile);

        let mut child = Command::new(&executable)
            .arg("--remote-debugging-port=0")
            .arg(format!("--user-data-dir={}", profile.display()))
            .arg("--headless=new")
            .arg("--no-first-run")
            .arg("--no-default-browser-check")
            .arg("--disable-gpu")
            .arg("about:blank")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .ok()?;

        // Chromium writes the port it chose into the profile directory.
        let port_file = profile.join("DevToolsActivePort");
        let deadline = Instant::now() + Duration::from_secs(30);

        while Instant::now() < deadline {
            if let Ok(contents) = std::fs::read_to_string(&port_file) {
                if let Some(port) = contents
                    .lines()
                    .next()
                    .and_then(|line| line.trim().parse().ok())
                {
                    return Some(TestBrowser { child, port });
                }
            }

            std::thread::sleep(Duration::from_millis(100));
        }

        let _ = child.kill();
        None
    }
}

impl Drop for TestBrowser {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

/// The pages the browser's debugger exposes.
async fn targets(port: u16) -> Vec<Target> {
    let url = format!("http://127.0.0.1:{port}/json/list");

    let response = reqwest::get(&url).await.expect("the debugger answers");
    response.json().await.expect("the answer is readable")
}

/// Attach to the browser's page, or explain why not.
async fn attach(browser: &TestBrowser) -> Session {
    let pages = targets(browser.port).await;
    assert!(!pages.is_empty(), "the browser exposes at least one page");

    let page = pages
        .iter()
        .find(|target| target.is_page())
        .expect("a page to attach to");

    Session::connect(&page.web_socket_url)
        .await
        .expect("the session connects")
}

#[tokio::test]
#[ignore = "starts a browser"]
async fn an_expression_is_evaluated_in_the_renderer() {
    let Some(browser) = TestBrowser::start() else {
        eprintln!("no browser was found, so there was nothing to test against");
        return;
    };

    let mut session = attach(&browser).await;

    let value = session
        .evaluate("1 + 1")
        .await
        .expect("the expression runs");

    assert_eq!(value, serde_json::json!(2));
}

#[tokio::test]
#[ignore = "starts a browser"]
async fn what_the_page_prints_comes_back() {
    let Some(browser) = TestBrowser::start() else {
        eprintln!("no browser was found, so there was nothing to test against");
        return;
    };

    let mut session = attach(&browser).await;

    // The page prints something, and the client reads it back.
    session
        .evaluate("console.log('Quest progress: 12/900')")
        .await
        .expect("the expression runs");

    let line = tokio::time::timeout(Duration::from_secs(10), session.next_console_line())
        .await
        .expect("the line arrives in time")
        .expect("the page printed something");

    assert_eq!(line, "Quest progress: 12/900", "the line that came back");
}

#[tokio::test]
#[ignore = "starts a browser"]
async fn a_operation_that_throws_is_reported_as_a_failure() {
    let Some(browser) = TestBrowser::start() else {
        eprintln!("no browser was found, so there was nothing to test against");
        return;
    };

    let mut session = attach(&browser).await;

    let error = session
        .evaluate("throw new Error('the internals moved')")
        .await
        .expect_err("a thrown operation is a failure");

    assert!(
        error.message.contains("the internals moved"),
        "the error says what went wrong: {error}"
    );
}
