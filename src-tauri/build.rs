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
    } else if target.contains("linux") {
        let runner = build_runner("runner-linux", "discord-auto-quest-runner-linux");
        embed(&runner, "discord-auto-quest-runner-linux");
    }

    tauri_build::build()
}

/// Build a runner in its own target directory and return the path to it.
///
/// The runner is built by a separate `cargo` invocation with its own target
/// directory, so it never contends with this crate's build lock.
///
/// The runner is built for the *target*, not for the host. A Windows binary
/// embedded in a macOS application would be a runner that cannot run, and the
/// failure would only show up on a machine this build never touched.
///
/// `DISCORD_AUTO_QUEST_RUNNER` points the build at a runner that was built
/// elsewhere. It exists for cross-compilation, where the toolchain for the
/// target may not be installed on the machine doing the build. The path must
/// exist: a build without a runner is a build that fails, not one that warns.
fn build_runner(directory: &str, binary: &str) -> PathBuf {
    if let Ok(prebuilt) = std::env::var("DISCORD_AUTO_QUEST_RUNNER") {
        let prebuilt = PathBuf::from(prebuilt);
        assert!(
            prebuilt.exists(),
            "the runner at {} does not exist, so there is nothing to embed",
            prebuilt.display()
        );
        println!("cargo:rerun-if-changed={}", prebuilt.display());
        return prebuilt;
    }

    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join(directory)
        .join("Cargo.toml");

    let cargo = std::env::var("CARGO").unwrap_or_else(|_| "cargo".to_string());
    let target = std::env::var("TARGET").unwrap_or_default();

    let mut command = Command::new(&cargo);
    command
        .arg("build")
        .arg("--release")
        .arg("--manifest-path")
        .arg(&manifest);

    if !target.is_empty() {
        command.arg("--target").arg(&target);
    }

    let status = command.status().unwrap_or_else(|error| {
        panic!("cargo must be available to build the runner: {error}");
    });

    assert!(status.success(), "the runner must build");

    let mut built = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join(directory)
        .join("target");

    if !target.is_empty() {
        built.push(&target);
    }

    built.push("release");
    built.push(binary);

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
