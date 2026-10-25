# Project context

Discord Auto Quest is a React/TS frontend with a Rust/Tauri desktop backend. The 1.2 release line targets Windows x64 and stable Discord.

| Need | Source |
|---|---|
| Product requirements | PRODUCT.md |
| Verified outcomes and open release gates | docs/ROADMAP.md |
| Interface tokens and behavior | DESIGN.md |
| User installation and troubleshooting | README.md |
| Contributions and verification | CONTRIBUTING.md |
| Packaging and publication | RELEASE.md |
| Backend connection and operations | src-tauri/src/discord.rs |
| Runtime quest observations | src-tauri/src/quest/reader.rs |
| UI controller and view model | src/hooks/useDiscord.ts and src/lib/quest-view.ts |
| Build and release utilities | tools/ |

Read only task-relevant documentation and verify claims against source and tests. Historical investigation and internal maintenance material live only in ignored re/. That folder is absent from a fresh clone. Public builds use inert validation content; production assets require private maintainer inputs and verification.
