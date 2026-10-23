//! A client for the Chrome DevTools Protocol.
//!
//! Discord is a Chromium application. Started with a remote debugging port, it
//! speaks the protocol on loopback, and the protocol lets us evaluate
//! code inside Discord's own renderer and read back what that code
//! prints.
//!
//! This module is the transport and nothing else. What we *do* with it lives in
//! [`super::discord`] and [`super::state`].
//!
//! The shape of the protocol is one JSON object per message, in both
//! directions. A command carries an `id`; the answer to it carries the same
//! `id`. Everything else is an event, which arrives whenever it arrives. The
//! client keeps the two apart: events that turn up while a command is waiting
//! for its answer are put aside, not dropped.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};

use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};

use crate::error::{AppError, AppResult};

/// A debugger target: a page, a worker, or something else the browser exposes.
#[derive(Debug, Clone, Deserialize)]
pub struct Target {
    /// The browser's identifier for it.
    pub id: String,
    /// The title of the page.
    #[serde(default)]
    pub title: String,
    /// The kind of target: `page`, `iframe`, `worker`, and so on.
    #[serde(rename = "type", default)]
    pub kind: String,
    /// The address the page is showing.
    #[serde(default)]
    pub url: String,
    /// Where the debugger attaches.
    #[serde(rename = "webSocketDebuggerUrl")]
    pub web_socket_url: String,
}

impl Target {
    /// Whether this is a page the user can see, rather than a worker.
    pub fn is_page(&self) -> bool {
        self.kind == "page"
    }
}

/// A live connection to one target's renderer.
pub struct Session {
    reader_task: tokio::task::JoinHandle<()>,
    /// The half we send on.
    outgoing: futures_util::stream::SplitSink<
        WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>,
        Message,
    >,
    /// The half we receive on, handed to a task that parses it.
    incoming: mpsc::UnboundedReceiver<Value>,
    /// Events that arrived while a command was waiting for its answer.
    buffered: VecDeque<Value>,
    /// The identifier of the next command.
    next_id: AtomicU64,
}

impl Session {
    /// Attach to a target.
    pub async fn connect(web_socket_url: &str) -> AppResult<Self> {
        let trace = std::env::var_os("DAQ_CDP_TRACE").is_some();
        macro_rules! say {
            ($message:expr) => {
                if trace {
                    eprintln!("[cdp] {}", $message);
                }
            };
        }
        say!("building the request");
        let request = web_socket_url.into_client_request().map_err(|error| {
            AppError::io(format!("the debugger address is not usable: {error}"))
        })?;

        say!("connecting");
        let (stream, _) = tokio_tungstenite::connect_async(request)
            .await
            .map_err(|error| AppError::io(format!("could not reach the debugger: {error}")))?;
        say!("connected");

        let (outgoing, mut source) = stream.split();
        let (sender, incoming) = mpsc::unbounded_channel();

        let reader_task = tokio::spawn(async move {
            say!("reader started");
            while let Some(Ok(message)) = source.next().await {
                let text = match message {
                    Message::Text(text) => text,
                    Message::Close(_) => break,
                    _ => continue,
                };

                if let Ok(value) = serde_json::from_str::<Value>(&text) {
                    if sender.send(value).is_err() {
                        break;
                    }
                }
            }
            say!("reader finished");
        });

        let mut session = Session {
            reader_task,
            outgoing,
            incoming,
            buffered: VecDeque::new(),
            next_id: AtomicU64::new(1),
        };

        say!("enabling the runtime");
        session
            .command("Runtime.enable", json!({}))
            .await
            .map_err(|error| {
                AppError::io(format!(
                    "the renderer would not accept the debugger: {error}"
                ))
            })?;
        say!("runtime enabled");

        Ok(session)
    }

    /// Run code in the renderer and return its value.
    ///
    /// The expression is awaited, so it may be a promise, and its result is
    /// returned by value rather than as a handle.
    pub async fn evaluate(&mut self, expression: &str) -> AppResult<Value> {
        let response = self
            .command(
                "Runtime.evaluate",
                json!({
                    "expression": expression,
                    "awaitPromise": true,
                    "returnByValue": true,
                    "userGesture": true,
                    "allowUnsafeEvalBlockedByCSP": true,
                }),
            )
            .await?;

        if let Some(details) = response.pointer("/result/exceptionDetails") {
            return Err(AppError::io(format!(
                "the operation raised an error: {}",
                describe_exception(details)
            )));
        }

        Ok(response
            .pointer("/result/result/value")
            .cloned()
            .unwrap_or(Value::Null))
    }

    /// The next line the page printed, if there is one.
    ///
    /// This is how the quest operation's `Quest progress: 12/900` lines reach the
    /// user. It returns `None` when the connection closes.
    pub async fn next_console_line(&mut self) -> Option<String> {
        loop {
            let message = self.next_event().await?;

            if message.get("method").and_then(Value::as_str) != Some("Runtime.consoleAPICalled") {
                continue;
            }

            let arguments = message.pointer("/params/args").and_then(Value::as_array);

            let Some(arguments) = arguments else {
                continue;
            };

            // The first argument is the value printed. The browser sends it as
            // a *remote object* — `{"type":"string","value":"…"}` — so the
            // value has to be read out of it rather than used as it is.
            let line = match arguments.first() {
                Some(Value::String(text)) => text.clone(),
                Some(argument) => match argument.get("value") {
                    Some(Value::String(text)) => text.clone(),
                    Some(value) => value.to_string(),
                    None => argument.to_string(),
                },
                None => continue,
            };

            return Some(line);
        }
    }

    /// Send a command and wait for its answer.
    async fn command(&mut self, method: &str, params: Value) -> AppResult<Value> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);

        let message = json!({ "id": id, "method": method, "params": params });

        self.outgoing
            .send(Message::Text(message.to_string().into()))
            .await
            .map_err(|error| AppError::io(format!("the debugger connection failed: {error}")))?;

        loop {
            // The answer is read from the wire, never from the buffer: the
            // buffer holds events that arrived while we were waiting, and
            // reading it here would look at the same event for ever.
            let answer = self.incoming.recv().await.ok_or_else(|| {
                AppError::io("the debugger closed the connection before it answered")
            })?;

            if answer.get("id").and_then(Value::as_u64) == Some(id) {
                if let Some(details) = answer.get("error") {
                    return Err(AppError::io(format!(
                        "the debugger refused the command: {details}"
                    )));
                }

                return Ok(answer);
            }

            // Not our answer. It is an event, and it is kept for whoever is
            // reading them.
            self.buffered.push_back(answer);
        }
    }

    /// The next event, whether it arrived earlier or just now.
    async fn next_event(&mut self) -> Option<Value> {
        if let Some(message) = self.buffered.pop_front() {
            return Some(message);
        }

        self.incoming.recv().await
    }
}

impl Drop for Session {
    fn drop(&mut self) {
        self.reader_task.abort();
    }
}

/// A readable description of what a operation raised.
fn describe_exception(details: &Value) -> String {
    let text = details
        .get("exception")
        .and_then(|exception| exception.get("description"))
        .and_then(Value::as_str)
        .or_else(|| details.get("text").and_then(Value::as_str))
        .unwrap_or("an unknown error");

    text.lines().next().unwrap_or(text).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_target_knows_whether_it_is_a_page() {
        let target: Target = serde_json::from_str(
            r#"{
                "id": "ABC123",
                "title": "Discord",
                "type": "page",
                "url": "app://discord.com/app",
                "webSocketDebuggerUrl": "ws://127.0.0.1:9222/devtools/page/ABC123"
            }"#,
        )
        .expect("the target parses");

        assert!(target.is_page());
        assert_eq!(target.id, "ABC123");
        assert_eq!(
            target.web_socket_url,
            "ws://127.0.0.1:9222/devtools/page/ABC123"
        );
    }

    #[test]
    fn a_worker_is_not_a_page() {
        let target: Target = serde_json::from_str(
            r#"{
                "id": "W1",
                "type": "worker",
                "url": "",
                "webSocketDebuggerUrl": "ws://127.0.0.1:9222/devtools/worker/W1"
            }"#,
        )
        .expect("the target parses");

        assert!(!target.is_page());
    }

    #[test]
    fn a_target_without_a_title_still_parses() {
        let target: Target = serde_json::from_str(
            r#"{"id": "X", "type": "page", "webSocketDebuggerUrl": "ws://x"}"#,
        )
        .expect("the target parses");

        assert_eq!(target.title, "");
        assert_eq!(target.url, "");
    }

    #[test]
    fn an_exception_is_described_by_its_first_line() {
        let details = json!({
            "text": "Uncaught",
            "exception": { "description": "TypeError: x is not a function\n    at <anonymous>" }
        });

        assert_eq!(
            describe_exception(&details),
            "TypeError: x is not a function"
        );
    }
}
