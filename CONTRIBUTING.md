# Contributing

Open an issue before a substantial feature. Keep changes focused, preserve existing user work, and use task branches rather than committing directly to main.

## Setup and checks

Install Node.js 22+, Rust stable, and Tauri's native platform prerequisites. Run npm ci and npm run tauri dev.

Before a pull request, run:

```text
npm test
npm run typecheck
npm run build
npm run check:acceptance
npm run check:terms
npm run version:check
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Add meaningful regression tests for behavior changes. Never use a real account for automated tests. Explicitly document checks that were unavailable. The app must never automatically accept quests, claim rewards, or restart Discord.

Keep internal maintenance details in ignored re/. Current public files are checked against a narrow terminology allowlist for required standards and dependency metadata. Do not expand that allowlist to bypass a project-authored occurrence. Keep commit titles simple, such as fix: improve recovery or chore: prepare release. Curate release notes rather than copying internal development history.

Dependencies and copied material must retain required licenses. Do not submit tokens, personal data, private diagnostics, or real account fixtures. Report security concerns privately as described in SECURITY.md. By contributing, you agree that your contribution is licensed under the project's MIT License.
