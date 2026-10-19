# discord-auto-quest

A desktop app that completes Discord quests for games you do not own — by making Discord's own
local activity detection believe the game is running.

**Status:** pre-implementation. The reverse-engineering study is complete; the product has not been
built yet.

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
MATERIALISE  copy a tiny platform stub to <user data>/games/<app id>/<registered path>/<exe>
LAUNCH       run the stub and track its PID
STOP         terminate that exact PID — never by image name
```

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
| `re/` | The reverse-engineering study of the upstream app. **Git-ignored** — it is reference material, not product code. |

## The reverse-engineering study

`re/` contains a clean-room behavioural and structural study of the upstream project
(`markterence/discord-quest-completer`, MIT licensed), produced with REA over the shipped binary,
the built frontend bundle, and the public source tree.

It documents the mechanism, the catalog schema and its statistics, the backend IPC surface, the UI
states, the per-platform runner behaviour, the build pipeline, and the open questions.

Start at [`re/README.md`](re/README.md).

**Note:** `re/` is excluded from version control, so it will not appear in a fresh clone. It holds
investigation evidence that is intentionally kept out of the product's history.

## Requirements

- **Windows 10/11** is the primary target. The catalog is overwhelmingly `win32` (~11,200 executable
  records, against ~70 for `darwin` and ~8 for `linux`).
- macOS and Linux are follow-on milestones with materially different mechanics, not
  configuration changes.

## Building

The build is not yet established — there is no `package.json`, `Cargo.toml`, or runner crate in
this repository yet. The commands will be recorded here as each milestone lands, verified against
the real manifests rather than assumed.

## Licence and attribution

This project is an independent implementation. It is not affiliated with, endorsed by, or
connected to Discord Inc., and it is not the upstream project.

The upstream project it was studied from is MIT licensed. Any upstream source or substantial
upstream-derived code reused here must retain its MIT notice and be attributed. See
[`re/README.md`](re/README.md) for the specific obligations this project has accepted.

Discord is a registered trademark of Discord Inc. Use is at your own risk.
