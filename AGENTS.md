# AGENTS.md

> Working method, project constraints, and Git workflow for `discord-auto-quest`.

## Project

- **Name:** `discord-auto-quest`
- **Purpose:** A desktop app that completes Discord quests for games the user does not own, by
  launching a stub process from a path that mirrors the game's registered install location, so
  Discord's local activity detection reports the game as running.
- **Current state:** The reverse-engineering study is **complete** (`re/docs/`, git-ignored). The
  product itself is **not yet implemented** — there is no application source, manifest, or test
  suite in this repository yet. Verify before claiming otherwise.

## Source of Truth

**Read only the documentation relevant to the task. Do not assume—verify.**

| Source                                  | Read when                                                    |
| --------------------------------------- | ------------------------------------------------------------ |
| `PRODUCT.md`                           | Product truth, principles, non-goals, technical constraints   |
| `docs/CONTEXT.md`                       | Locating context, constraints, and relevant documentation    |
| `docs/ROADMAP.md`                       | Checking planned features, priorities, or verified progress  |
| `docs/ARCHITECTURE.md` _(if it exists)_ | Making changes to established boundaries or data flows       |
| Source code and tests                   | Determining actual current behavior and verifying a change   |
| `re/docs/`                              | Upstream behaviour observed during the study                 |
| `graphify-out/` _(if it exists)_        | Exploring code relationships; verify findings against source |

- Requirements and explicitly approved decisions define **intended behavior**; source code and
  passing tests provide evidence of **current behavior**.
- If documentation and code conflict, **report the discrepancy** and determine whether the code or
  documentation needs correction. Never silently rewrite a requirement to justify current code.
- Prefer one authoritative location per fact; link to it rather than copying it into multiple files.
- **Restricted upstream paths and source locations must never appear in root-level documentation.**
  They belong only in the ignored `re/` tree.

## Tech Stack

_No application manifests exist in this repository yet, so every layer below is **Not yet
established**. Remove a row only when a real manifest supersedes it._

| Layer              | Technology / version      | Evidence        |
| ------------------ | ------------------------- | --------------- |
| Frontend / UI      | Not yet established       | —               |
| Backend / runtime  | Not yet established       | —               |
| Database / storage | Not yet established       | —               |
| Build / tooling    | Not yet established       | —               |
| Tests              | Not yet established       | —               |

**Target shape (from the study, not yet implemented):** a Tauri v2 desktop app with a TypeScript
webview frontend and a Rust backend, plus small per-platform runner executables. Confirm against
the actual manifests before relying on this.

## Build, Test, and Development Commands

_Use commands that really exist in this repository. Never invent a script._

**No application exists yet, so there are no build, test, or dev commands to run.** The table below is
intentionally empty of commands; it is filled in as each roadmap group lands and the manifests
exist. Do not copy a command from upstream's project or from `re/docs/` — those describe the
*studied* project, not this one.

| Purpose              | Command | Evidence / notes |
| -------------------- | ------- | ---------------- |
| Install dependencies | — | No `package.json` / `Cargo.toml` in this repository yet. |
| Run locally          | — | No application entry point yet. |
| Build                | — | No build manifest yet. |
| Test                 | — | No test suite yet. |
| Lint / type-check    | — | No linter or type-checker configured yet. |

Run from the repository root unless a command explicitly requires another directory.

**Documentation checks available today.** There is no Markdown linter configured in this
repository, so link and fence integrity is verified by reading the diff:

```bash
git diff --check   # whitespace errors only; not a link or fence checker
```

## Architecture Non-Negotiables

_Verified constraints from `PRODUCT.md`. These are load-bearing, not preferences._

- **The stub path must mirror the game's registered executable path**, and the file extension is
  stripped from the on-disk name. Discord's match is sensitive to both.
- **Catalogue data and runtime state are separate.** Runtime state is always read from the
  backend, never inferred optimistically in the frontend.
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
- **On macOS the stub is a real `.app` bundle with a visible window.** On Windows and Linux the
  runner is silent by default.

## Working Method (Lightweight ICM)

1. **Orient:** Read `docs/CONTEXT.md`, then only the relevant roadmap section, existing source files, and needed references.
2. **Plan when warranted:** For substantial changes, summarize approach, affected files, risks, and verification criteria before coding. Small, clear fixes do not need separate plan documents.
3. **Implement within scope:** Follow existing conventions and avoid unrelated changes.
4. **Verify:** Run applicable checks; report passed, failed, skipped, and unavailable checks accurately.
5. **Preserve:** Update `docs/ROADMAP.md` only for verified outcomes, and update other authoritative docs only when facts change.

Do not create extra ICM stage folders or permanent plan files unless the task benefits from them.

## Graphify

- Graphify is **derived project knowledge**, not the source of truth for code behavior.
- When available and relevant, query the existing graph to find related symbols and dependencies; inspect source files before acting on results.
- After meaningful structural changes, refresh the graph using the **installed** Graphify skill or CLI workflow. Do not presume Graphify is installed or that a graph exists.
- If exporting to Obsidian, use only this project's generated area:
  `C:\Users\Edison\Documents\Obsidian\10 - Projects/discord-auto-quest/_Graphify/`.
- Never export into the vault root or overwrite curated PARA notes. Refreshing the graph is **not** the same as saving session decisions.

## Obsidian / Cross-Project Knowledge

- **Central vault:** `C:\Users\Edison\Documents\Obsidian`
- **Project notes:** `10 - Projects/discord-auto-quest/`, if present. (Not created yet.)
- Read only relevant notes, when the vault is configured and accessible; repository docs remain authoritative for project-specific requirements.
- Propose meaningful updates after substantial work: project progress/decisions under `10 - Projects`, reusable lessons under `30 - Resources`, unverified ideas under `00 - Inbox`.
- **Ask before editing curated vault notes.** Avoid duplicates, stale claims, secrets, and copying entire chat transcripts.
- If the vault is inaccessible, continue using local project context and mention the limitation.

## Git Workflow

1. **Never commit directly to `main`.** Use task branches prefixed with `feat/`, `fix/`, `chore/`, `docs/`, or `refactor/`.
2. Before modifying files, check `git status`, switch to `main`, pull the latest `origin/main`, create a task branch, and push it with upstream tracking.
3. Commit at logical checkpoints and push changes to the remote.
4. Use the `git` subagent when available; otherwise, use permitted Git tools.
5. After implementation, run relevant tests, resolve issues, and **merge verified work into `main`**. Follow required CI checks and branch protections.
6. Never discard existing changes, force-push, or commit temporary agent-generated plans unless explicitly authorized.
7. **Do not consider a task complete until it is verified, merged, and reflected in `docs/ROADMAP.md`.**

### Branch Lifecycle

```bash
git status
git switch main
git pull --ff-only origin main
git switch -c <branch-name>
git push -u origin <branch-name>
```

If the working tree is dirty or Git operations are blocked, resolve safely without overwriting existing work.

---

## Autonomous Orchestration Mode

_Activate only when the user explicitly requests autonomous roadmap execution._

1. **Orchestrator:** Read `docs/CONTEXT.md` and `docs/ROADMAP.md`, select the next eligible task, manage Git operations, and verify completion.
2. **Subagent:** Spawn **one implementation-and-testing subagent** per task when supported. Otherwise, perform the work directly.
3. **Execution:** Create branch → Implement → Test → Commit → Push → Merge → Update roadmap.
4. **Continuity:** Automatically proceed to the next eligible roadmap task. **Do not stop after one feature or merge.**
5. **Blockers:** Attempt safe recovery. Pause only for unresolved errors, missing requirements, permissions, required approvals, or unsafe operations. Continue independent tasks when possible.
6. **Completion:** Stop when all authorized tasks are finished, remaining tasks are deferred or blocked, or the user stops execution.
7. **Knowledge:** Update relevant documentation, preserve reusable lessons in Obsidian, and refresh Graphify after significant changes.

## Template Initialization (only when requested)

When asked to initialize these templates for a new repository:

1. Inspect the repository's `README`, manifests, folder structure, configuration, tests, and existing documentation.
2. Fill this file plus `docs/CONTEXT.md` and `docs/ROADMAP.md` using **verified** information. Keep the roadmap grouped by useful milestones, not implementation steps.
3. Preserve existing user-written requirements. Use `Not verified` or ask a targeted question for genuinely unknown details.
4. Remove inapplicable template rows and placeholders. Do not claim features are complete without evidence.
5. Do **not** automatically install Graphify, create branches/commits, modify the Obsidian vault, or create optional docs without permission.
6. Summarize the populated files, sources consulted, and remaining uncertainties for review.
