use crate::error::{AppError, AppResult};
use std::{future::Future, time::Duration};

pub(super) const DOWNLOAD_LIMIT: Duration = Duration::from_secs(5 * 60);

pub(super) async fn bounded_download<T>(
    download: impl Future<Output = AppResult<T>>,
    limit: Duration,
) -> AppResult<T> {
    tokio::time::timeout(limit, download).await.map_err(|_| {
        AppError::network("The update download timed out. Nothing was installed. Try again.")
    })?
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::AsyncWriteExt;

    #[tokio::test]
    async fn a_stalled_response_body_times_out_releases_its_gate_and_can_retry() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            socket
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 100000\r\n\r\n")
                .await
                .unwrap();
            std::future::pending::<()>().await;
            drop(socket);
        });
        let response = reqwest::get(format!("http://{address}")).await.unwrap();
        let gate = tokio::sync::Mutex::new(());
        let result = tokio::time::timeout(
            Duration::from_millis(250),
            bounded_download(
                async {
                    let _guard = gate.lock().await;
                    response
                        .bytes()
                        .await
                        .map_err(|error| AppError::network(error.to_string()))
                },
                Duration::from_millis(20),
            ),
        )
        .await;
        server.abort();
        let error = result
            .expect("the download must enforce its own deadline")
            .unwrap_err();
        assert!(error.message.contains("timed out"));
        assert!(error.retryable);
        assert!(
            gate.try_lock().is_ok(),
            "a timed-out body must release the operation gate"
        );
        let result = bounded_download(
            async {
                let _guard = gate.lock().await;
                Ok(42)
            },
            Duration::from_millis(20),
        )
        .await;
        assert_eq!(result.unwrap(), 42);
    }
}
