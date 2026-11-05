#![cfg(windows)]

use base64::Engine;
use discord_auto_quest_lib::updates::update_builder;
use tauri::Manager;

#[cfg(windows)]
#[tokio::test]
async fn failed_installer_launch_keeps_app_resources_and_instance_ownership() {
    use std::io::{Read, Write};
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    };
    struct Lifetime(Arc<AtomicBool>);
    impl tauri::Resource for Lifetime {}
    impl Drop for Lifetime {
        fn drop(&mut self) {
            self.0.store(true, Ordering::SeqCst);
        }
    }
    let signed: serde_json::Value =
        serde_json::from_str(include_str!("../../tools/fixtures/updater-tauri-cli.json")).unwrap();
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(signed["bytes"].as_str().unwrap())
        .unwrap();
    assert!(
        bytes.starts_with(b"MZ") && bytes.len() < 80,
        "only the inert signed fixture may reach the OS launch path"
    );
    let mut context = tauri::test::mock_context(tauri::test::noop_assets());
    context.config_mut().plugins.0.insert(
        "updater".into(),
        serde_json::json!({
            "pubkey":signed["pubkey"], "dangerousInsecureTransportProtocol":true
        }),
    );
    let app = tauri::test::mock_builder()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .build(context)
        .unwrap();
    let dropped = Arc::new(AtomicBool::new(false));
    app.resources_table().add(Lifetime(dropped.clone()));
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let endpoint = format!("http://{}/", listener.local_addr().unwrap());
    let server = std::thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        socket
            .set_read_timeout(Some(std::time::Duration::from_secs(5)))
            .unwrap();
        let _ = socket.read(&mut [0_u8; 4096]);
        let body = serde_json::json!({"version":"1.1.0","url":"https://example.invalid/setup.exe","signature":signed["signature"]}).to_string();
        write!(socket, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
    });
    let update = update_builder(app.handle())
        .endpoints(vec![endpoint.parse().unwrap()])
        .unwrap()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap()
        .check()
        .await
        .unwrap()
        .unwrap();
    server.join().unwrap();
    // An inert DOS header reaches the Windows launch path but cannot execute.
    // No installer code is present and no application can be installed.
    let result = update.install(bytes);
    assert!(
        matches!(result, Err(tauri_plugin_updater::Error::Io(_))),
        "expected a failed OS launch: {result:?}"
    );
    assert!(
        !dropped.load(Ordering::SeqCst),
        "failed update must retain the instance lock and other resources"
    );
    app.cleanup_before_exit();
    assert!(dropped.load(Ordering::SeqCst));
}
