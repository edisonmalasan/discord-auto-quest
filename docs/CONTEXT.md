# Project Context

> **Router.** Read this first, then only the parts of the roadmap and source that the task needs.

## At a Glance

- **Project:** `discord-auto-quest`
- **What it does:** A desktop app that completes Discord quests for games the user does not own, by
  launching a stub process from a path that mirrors the game's registered install location, so
  Discord's local activity detection reports the game as running.
- **Primary users / use cases:** Discord players who want to clear seasonal game quests without
  buying and installing every title in the catalogue.
- **Current focus:** The reverse-engineering study is complete. The application exists and
  serves Discord's catalogue; questing — materialising a stub, launching it, and stopping it by
  PID — is the next milestone and is **not yet implemented**.

## Where to Look

| Need | Canonical source |
|---|---|
| Durable product truth, principles, non-goals | `PRODUCT.md` |
| Goals, features, and progress | `docs/ROADMAP.md` |
| The catalogue service: fetch, validate, project, cache, serve | `src-tauri/src/catalogue/` |
| The catalogue index and the states it can be in | `src/`, `src/components/` |
| The mechanism, and why it works | `re/docs/02-quest-completion-mechanism.md` |
| Catalogue schema, statistics, and constraints | `re/docs/03-data-model-and-catalog.md` |
| Backend architecture and IPC surface | `re/docs/04-application-architecture.md` |
| UI states and the design gaps to fix | `re/docs/05-ui-structure-and-states.md` |
| Per-platform runner requirements | `re/docs/06-platform-runner-behaviour.md` |
| Build and packaging decisions | `re/docs/07-build-and-packaging.md` |
| The clone specification and acceptance cases | `re/docs/08-reconstruction-map.md` |
| What is unresolved, and what evidence would close it | `re/docs/09-coverage-and-open-questions.md` |
| Evidence provenance for every claim | `re/docs/01-evidence-register.md` |
| The design direction of the catalogue surface | `.impeccable/surfaces/src-app-tsx.md` |
| Build and test commands | Root `AGENTS.md` and the project manifests |

## Project-Specific Constraints

These affect many tasks. They are expanded in `PRODUCT.md` under *Technical constraints*.

- **The stub path must mirror the game's registered executable path**, and the file extension is
  stripped from the on-disk name. Discord's match is sensitive to both.
- **Catalogue data and runtime state are separate.** Runtime state is always read from the
  backend — never inferred optimistically in the frontend.
- **Processes are stopped by PID**, never by image name. A user running the real game must never
  have it killed by this tool.
- **The catalogue is fetched at runtime and cached.** It is never bundled into the shipped
  frontend.
- **All writes go to a per-user data directory.** The application directory is read-only.
- **Path sanitisation happens in the backend**, before any filesystem call.
- **No Discord RPC Rich Presence.** It does not complete quests, it requires application IDs this
  project does not own, and it risks the user's account.
- **The catalogue source of truth is Discord's endpoint.** Any mirror is operator-controlled and
  may drift.

## Context Loading Rules

1. Start with the user's task and this routing file.
2. Open only the relevant section of `docs/ROADMAP.md`, not the entire roadmap unless needed.
3. Inspect directly affected source files and tests.
4. Consult the `re/` study, architecture docs, or Graphify **only when relevant and available**.
5. If sources disagree, report the conflict; do not silently choose whichever is convenient.
6. Do not treat generated graphs or old memory notes as more authoritative than current source code
   and approved requirements.

## Working Notes

- `re/` is **git-ignored**. It is investigation evidence, deliberately kept out of the product's
  version history. A fresh clone will not contain it.
- Restricted upstream paths and source locations must never appear in root-level documentation.
  They belong only in the ignored `re/` tree.

