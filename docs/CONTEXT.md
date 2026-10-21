# Project Context

> **Router.** Read this first, then only the parts of the roadmap and source that the task needs.

## At a Glance

- **Project:** `discord-auto-quest`
- **What it does:** A desktop app that completes Discord quests, by driving the user's own Discord
  desktop client — attaching to its renderer over the Chrome DevTools Protocol, reading the quest
  state out of the client's own store, and running the quest script inside the renderer so that
  the client's own quest heartbeat counts the quest.
- **Primary users / use cases:** Discord players who want to clear a seasonal quest list without
  buying and installing every title in the catalogue.
- **Current focus:** The mechanism is proved against the real client — an accepted quest was
  driven to `completed` and its reward became claimable. The transport, the encrypted payload, the
  reader, the driver and the interface are all merged and verified. The old catalogue browser and
  the stub mechanism are retired and gone from the tree.

## Where to Look

| Need | Canonical source |
|---|---|
| Durable product truth, principles, non-goals | `PRODUCT.md` |
| Goals, features, and progress | `docs/ROADMAP.md` |
| The design direction of the quest surface | `DESIGN.md`, `.impeccable/surfaces/src-app-tsx.md` |
| The application: status, attach, run, stop, read | `src-tauri/src/discord.rs` |
| The transport: evaluate in a renderer, read what it prints | `src-tauri/src/quest/cdp.rs` |
| Finding Discord and its debugger | `src-tauri/src/quest/discord.rs` |
| The encrypted script, and its decryption | `src-tauri/src/quest/payload.rs` |
| Preparing and restoring Discord's own methods | `src-tauri/src/quest/driver.rs` |
| Reading the quest state out of Discord | `src-tauri/src/quest/reader.rs` |
| The interface: the register, the band, the gate | `src/App.tsx`, `src/components/` |
| The quest vocabulary the interface speaks | `src/lib/quests.ts` |
| The version, the payload check, the release archive | `scripts/` |
| Build and test commands | Root `AGENTS.md` and the project manifests |

### The study

`re/docs/` is the reverse-engineering study of the upstream project. It is **prior art, not the
blueprint**: it documents a mechanism this project no longer uses. Two things in it are still
load-bearing:

| Need | Canonical source |
|---|---|
| What the upstream app does, and where it differs | `re/docs/10-upstream-audit.md` |
| The mechanism Discord's detection actually needs | `re/docs/02-quest-completion-mechanism.md` |

`re/` is git-ignored. A fresh clone does not contain it.

## Project-Specific Constraints

These affect many tasks. They are expanded in `PRODUCT.md` under *Technical constraints*.

- **The quest script ships encrypted** and is decrypted in memory. It is never written to disk at
  run time, and it must not be readable in the built executable.
- **The quest state is Discord's**, read from the client at run time. The interface never infers it,
  and never says a quest is complete unless Discord says it is.
- **The application never restarts Discord on its own.** Restarting it ends whatever the user was
  doing in it.
- **The application never accepts a quest and never claims a reward.** Both are the user's.
- **Only the user's own Discord client is touched.** No other process is started, stopped, or
  inspected.
- **The reader finds Discord's internals by shape**, not by a pinned export name, so a Discord
  update does not stop the application from saying what it can see.
- **No Discord RPC Rich Presence.** It does not complete quests, it requires application IDs this
  project does not own, and it risks the user's account.

## Context Loading Rules

1. Start with the user's task and this routing file.
2. Open only the relevant section of `docs/ROADMAP.md`, not the entire roadmap unless needed.
3. Inspect directly affected source files and tests.
4. Consult the `re/` study or Graphify **only when relevant and available**.
5. If sources disagree, report the conflict; do not silently choose whichever is convenient.
6. Do not treat generated graphs or old memory notes as more authoritative than current source code
   and approved requirements.

## Working Notes

- `re/` is **git-ignored**. It is investigation evidence, deliberately kept out of the product's
  version history.
- The quest script itself lives in `re/scripts/` and is **not** in version control. The committed
  artefact is the encrypted payload, in `src-tauri/payload/`.
- Restricted upstream paths and source locations must never appear in root-level documentation.
  They belong only in the ignored `re/` tree.
