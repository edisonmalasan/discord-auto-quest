# discord-auto-quest

A desktop app that completes Discord quests for games you do not own — by making Discord's own
local activity detection believe the game is running.

**Status:** the catalogue works and quests run. The reverse-engineering study is complete, the
application fetches, caches, and serves Discord's catalogue of detectable games, and a quest
writes a silent stub to the path Discord matches and runs it until it is stopped.

Questing is verified on Windows, on Linux, and on macOS.

## What it does

Discord runs quests that credit you for playing a game you own. This app completes those quests for
games you do **not** have installed, by launching a small stub process from a path that mirrors the
game's registered install location. Discord's local integration detects the process and reports
the game as active; the quest tracker credits the activity.

There is **no Discord quest API** to call. The mechanism is a process-launch trick, and that is
what this app implements.

## How it works

```text
DISCOVER     fetch Discord's public game catalog (~25,000 entries) and cache a compact copy
SELECT       browse or search for a game; see cover art, store, and questability at a glance
MATERIALISE  copy a tiny platform stub to <user data>/games/<app id>/<registered path>
LAUNCH       run the stub and track its PID
STOP         terminate that exact PID — never by image name
```

All five steps work.

## What it is not

- **Not a Discord bot.** It does not talk to the Discord API to complete quests, because no such
  API exists.
- **Not Rich Presence spoofing.** Upstream has a separate RPC feature that fakes presence with
  other publishers' application IDs. That is excluded here — it does not complete quests and it
  risks the account.
- **Not affiliated with Discord.** Discord is a trademark of Discord Inc.

## Project layout

| Path | Contents |
|---|---|
| `PRODUCT.md` | Durable product truth: what this is, who it is for, and the constraints that do not change. |
| `docs/CONTEXT.md` | Router for project context and constraints. |
| `docs/ROADMAP.md` | Grouped, outcome-based build guide and progress tracker. |
| `AGENTS.md` | Working method, Git workflow, and architecture non-negotiables. |
| `src/` | The React frontend: the catalogue index, its filters, and the entry panel. |
| `src-tauri/` | The Rust backend: the catalogue service, its cache, and the Tauri shell. |
| `runner/`, `runner-macos/`, `runner-linux/` | The three platform stubs the app launches in place of a game. |
| `scripts/` | The version, the runner check, and the release packaging. |
| `.impeccable/` | The design direction for the catalogue surface and the brief it is held to. |
| `re/` | The reverse-engineering study of the upstream app. **Git-ignored** — it is reference material, not product code. |

## The reverse-engineering study

`re/` contains a clean-room behavioural and structural study of the upstream project
(`markterence/discord-quest-completer`, MIT licensed), produced with REA over the shipped binary,
the built frontend bundle, and the public source tree.

It documents the mechanism, the catalog schema and its statistics, the backend IPC surface, the UI
states, the per-platform runner behaviour, the build pipeline, and the open questions.

Two findings are worth flagging up front, because both correct an assumption:

- **The Discord RPC client is compiled into the shipped app.** A native string scan of the shipped
  executable recovers the `discord-sdk` crate and the full Discord IPC opcode set. Upstream's RPC
  path is real and reachable — which is exactly why this project excludes it.
- **The catalogue is bigger than upstream's snapshot, and less questable.** The live endpoint
  returned 24,725 entries against the snapshot's 21,692, while the *questable* population shrank
  by 50. Catalogue counts are therefore never hard-coded in this project.

Start at [`re/README.md`](re/README.md).

**Note:** `re/` is excluded from version control, so it will not appear in a fresh clone. It holds
investigation evidence that is intentionally kept out of the product's history.

## Requirements

- **Windows 10/11** is the primary target. The catalog is overwhelmingly `win32` (~11,200 executable
  records, against ~70 for `darwin` and ~8 for `linux`).
- **Linux** is supported. The stub needs nothing but the C library, so no graphical toolkit has to
  be installed.
- **macOS** is supported. The stub is a real application bundle with a visible window, because
  that is what Discord's macOS integration detects.

## Building

The app is a Tauri v2 desktop application: a Rust backend under a React frontend.

```bash
npm install                              # install dependencies
npm run tauri dev                        # run the app against the Vite dev server
npm run build                            # check the version, then type-check and build the frontend
npm run tauri build                      # build the desktop application
```

### The runner

Each platform has its own stub, and each is a separate crate so it can carry only what that
platform needs.

```bash
npm run build:runner         # Windows
npm run build:runner:macos   # macOS
npm run build:runner:linux   # Linux
npm run check:runner         # check the built runners against their constraints
```

The application builds its own runner for the target platform, so `npm run tauri build` needs
nothing extra. The build **fails** rather than warns when a runner is missing, so an application
that cannot quest is never produced.

### Testing

```bash
npm test                                             # the frontend test suite
npm run typecheck                                    # the frontend, without building it
cargo test --manifest-path src-tauri/Cargo.toml      # the backend test suite
cargo test --manifest-path src-tauri/Cargo.toml -- --ignored   # the network-backed tests
```

The backend suite includes `src-tauri/tests/questing_linux.rs` and
`src-tauri/tests/questing_macos.rs`, which run only on their own platform: they assert that a
quest lands at the mirrored path, that the stub needs no toolkit, that the quest is tracked by
its process id, and that stopping a quest leaves a process with the same image name alone. The
macOS one also asks the window server how many windows the runner has, because the window is
the mechanism there.

### The acceptance cases

```bash
npm run build              # the bundle has to exist to be inspected
npm run check:acceptance   # the shipped bundle carries no catalogue snapshot
```

The acceptance cases in `re/docs/08-reconstruction-map.md` are the contract for "done". Two of
them are about what ships rather than what the code does, and both are checked against the
artefacts.

### Continuous integration

A workflow builds and checks the application on Windows, Linux and macOS, and runs each
platform's own questing tests. A tag cuts a release from the artifacts those builds produced.

### The version

The version is defined in one place — the `version` field of `package.json` — and injected into
everything that states one.

```bash
npm run version:check   # fail if a manifest disagrees with it
npm run version:sync    # bring the manifests into step
```
The Tauri configuration reads `package.json` directly, the Rust build injects the version into the
binary and checks the crate's own manifest against it, and the about panel shows the version the
running application reports.

### Releasing

```bash
npm run release
```

This builds the runner and the application for this machine and writes a portable archive under
`target/release/`, named after the version. The archive holds the application, the runner beside
it, and the licence and notice. The runner is named `discord-auto-quest-runner` on every platform,
with the platform's own executable extension.

The catalogue is fetched from Discord at runtime and cached under your user data
directory. Nothing about the catalogue is compiled into the application.

## Licence and attribution

This project is an independent implementation, MIT licensed. It is not affiliated with, endorsed
by, or connected to Discord Inc., and it is not the upstream project.

The upstream project it was studied from is MIT licensed. Any upstream source or substantial
upstream-derived code reused here must retain its MIT notice and be attributed. See
[`NOTICE`](NOTICE) for the notices that ship with this project, and
[`re/README.md`](re/README.md) for the specific obligations this project has accepted.

Discord is a registered trademark of Discord Inc. Use is at your own risk.
