use std::path::{Path, PathBuf};
use std::process::Command;

/// Builds the platform's runner and embeds it in the application.
///
/// The runner is a separate executable, not a library: it is copied to the mirrored
/// path and launched as its own process. Embedding its bytes means the application
/// always has a runner to write, with no resource file to find and no way for one
/// to be missing at run time.
fn main() {
    let target = std::env::var("TARGET").unwrap_or_default();

    if target.contains("windows") {
        let runner = build_runner("runner", "discord-auto-quest-runner.exe");
        embed(&runner, "discord-auto-quest-runner.exe");
    } else if target.contains("apple-darwin") {
        let runner = build_runner("runner-macos", "discord-auto-quest-runner-macos");
        embed(&runner, "discord-auto-quest-runner-macos");
    }

    tauri_build::build()
}

/// Build a runner in its own target directory and return the path to it.
///
/// The runner is built by a separate `cargo` invocation with its own target
/// directory, so it never contends with this crate's build lock.
fn build_runner(directory: &str, binary: &str) -> PathBuf {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join(directory)
        .join("Cargo.toml");

    let cargo = std::env::var("CARGO").unwrap_or_else(|_| "cargo".to_string());

    let status = Command::new(&cargo)
        .arg("build")
        .arg("--release")
        .arg("--manifest-path")
        .arg(&manifest)
        .status()
        .unwrap_or_else(|error| {
            panic!("cargo must be available to build the runner: {error}");
        });

    assert!(status.success(), "the runner must build");

    let built = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join(directory)
        .join("target")
        .join("release")
        .join(binary);

    assert!(built.exists(), "the runner must be at {}", built.display());

    println!("cargo:rerun-if-changed={}", built.display());
    built
}

/// Copy the runner into `OUT_DIR` so `include_bytes!` can pick it up.
fn embed(runner: &Path, name: &str) {
    let out = PathBuf::from(std::env::var("OUT_DIR").expect("OUT_DIR")).join(name);

    std::fs::copy(runner, &out)
        .unwrap_or_else(|error| panic!("the runner must be copyable into OUT_DIR: {error}"));
}
