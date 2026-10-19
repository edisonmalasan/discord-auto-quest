use std::time::Duration;

use crate::error::{AppError, AppResult};

/// Discord's public catalogue of detectable applications.
///
/// Unauthenticated and undocumented. The endpoint's contents move, so nothing about
/// it may be assumed to be stable.
pub const CATALOGUE_ENDPOINT: &str = "https://discord.com/api/applications/detectable";

/// Discord's CDN serves cover art and icons from the same path shape.
pub const CDN_BASE: &str = "https://cdn.discordapp.com/app-icons";

const USER_AGENT: &str = concat!(
    "discord-auto-quest/",
    env!("CARGO_PKG_VERSION"),
    " (+https://github.com/edisonmalasan/discord-auto-quest)"
);

/// The URL of a catalogue asset — cover art or icon — for an application.
pub fn asset_url(app_id: &str, hash: &str) -> String {
    format!("{CDN_BASE}/{app_id}/{hash}.png")
}

/// Fetch the catalogue document.
///
/// The request is bounded by `timeout` so that an unreachable endpoint surfaces as an
/// error the user can retry, rather than a request that hangs indefinitely.
pub async fn fetch_text(client: &reqwest::Client, timeout: Duration) -> AppResult<String> {
    let response = client
        .get(CATALOGUE_ENDPOINT)
        .timeout(timeout)
        .send()
        .await
        .map_err(|error| {
            AppError::network(format!(
                "could not reach Discord's catalogue endpoint: {error}"
            ))
        })?;

    let status = response.status();
    if !status.is_success() {
        return Err(AppError::network(format!(
            "Discord's catalogue endpoint answered {status}"
        )));
    }

    response.text().await.map_err(|error| {
        AppError::network(format!("could not read the catalogue response: {error}"))
    })
}

/// Build the HTTP client the catalogue service uses.
pub fn build_client() -> AppResult<reqwest::Client> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|error| AppError::io(format!("could not build the HTTP client: {error}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn asset_urls_use_the_discord_cdn() {
        assert_eq!(
            asset_url("356875221078245376", "abc123"),
            "https://cdn.discordapp.com/app-icons/356875221078245376/abc123.png"
        );
    }

    #[test]
    fn the_request_carries_the_user_agent() {
        use std::io::{Read, Write};
        use std::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").expect("binds");
        let port = listener.local_addr().expect("an address").port();

        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accepts");
            let mut head = [0u8; 2048];
            let read = stream.read(&mut head).unwrap_or(0);
            let request = String::from_utf8_lossy(&head[..read]).to_string();
            let _ = stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n[]");
            request
        });

        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("a runtime");
        let client = build_client().expect("client builds");
        let sent = runtime.block_on(client.get(format!("http://127.0.0.1:{port}/")).send());
        let request = server.join().expect("the server thread finishes");

        assert!(sent.is_ok(), "the request should reach the listener");
        assert!(
            request.contains("discord-auto-quest/"),
            "the request should identify the app: {request}"
        );
    }
}
