# AGENTS.md

> Working method, project constraints, and Git workflow for `discord-auto-quest`.

## Project

- **Name:** `discord-auto-quest`
- **Purpose:** A desktop app that completes Discord quests, by running a script inside the Discord
  desktop client the user is already signed in to, so that the client's own quest heartbeat counts
  the quest.
- **Current state:** The mechanism is **proved** on the real client — an accepted quest was driven
  to `completed` and its reward became claimable. The reverse-engineering study is **complete**
  (`re/docs/`, git-ignored). The old catalogue browser and stub mechanism are **retired** and gone
  from the tree.

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

_Verified against the manifests in this repository. Remove a row only when a real manifest
supersedes it._

| Layer              | Technology / version         | Evidence                             |
| ------------------ | ---------------------------- | ------------------------------------ |
| Frontend / UI      | React 19, TypeScript 5.9, Tailwind CSS 4, Vite 8 | `package.json`            |
| Backend / runtime  | Rust 1.82+, Tauri 2, reqwest 0.12 (rustls) | `src-tauri/Cargo.toml`              |
| Mechanism          | Chrome DevTools Protocol over a websocket | `src-tauri/src/quest/cdp.rs` |
| Payload            | AES-256-GCM, embedded as ciphertext | `src-tauri/src/quest/payload.rs` |
| Storage            | None. The quest script is decrypted in memory and never written to disk. | `src-tauri/src/quest/payload.rs` |
| Build / tooling    | Vite 8, `@tauri-apps/cli` 2  | `package.json`, `vite.config.ts`      |
| Tests              | Vitest 4 (frontend), `cargo test` (backend) | `src/**/*.test.ts(x)`, `src-tauri/tests/` |

**Target shape:** a Tauri v2 desktop app with a TypeScript webview frontend and a Rust backend.
There are no helper executables: the application drives Discord's own renderer, and the quest
script ships encrypted inside the binary.

## Build, Test, and Development Commands

_These commands exist in this repository. Run them from the repository root._

| Purpose              | Command | Evidence / notes |
| -------------------- | ------- | ---------------- |
| Install dependencies | `npm install` | Reads `package.json`. |
| Run locally          | `npm run tauri dev` | Starts Vite on port 1420 and the app against it. |
| Run the frontend only | `npm run dev` | The frontend in a browser, with no backend. |
| Build frontend       | `npm run build` | Checks the version, then type-checks and writes `dist/`. |
| Build the app        | `npm run tauri build` | Production desktop bundle. |
| Rebuild the payload  | `npm run build:payload` | Re-encrypts `re/scripts/auto-quest.js` into the embedded ciphertext. |
| Check the payload    | `npm run check:payload -- <path>` | Asserts the built binary carries none of the script's strings. |
| Check the acceptance cases | `npm run check:acceptance` | Asserts the shipped bundle and notices. |
| Check the version    | `npm run version:check` | Asserts every manifest agrees with `package.json`. |
| Fix the version      | `npm run version:sync` | Writes the version into the manifests that carry a copy. |
| Package a release    | `npm run release` | A portable archive for this machine, named after the version. |
| Test                 | `npm test` | Vitest, the frontend suite. |
| Test                 | `cargo test --manifest-path src-tauri/Cargo.toml` | The Rust suite. |
| Test                 | `cargo test --manifest-path src-tauri/Cargo.toml -- --ignored` | The suite that starts a browser. |
| Drive Discord by hand | `cargo run --manifest-path src-tauri/Cargo.toml --example drive` | The mechanism, without the window. |
| Lint / type-check    | `npm run typecheck` | `tsc --noEmit`. |

**Documentation checks available today.** There is no Markdown linter configured in this
repository, so link and fence integrity is verified by reading the diff:

```bash
git diff --check   # whitespace errors only; not a link or fence checker
```

## Architecture Non-Negotiables

_Verified constraints from `PRODUCT.md`. These are load-bearing, not preferences._

- **The quest script must not be readable in the shipped executable.** It ships as ciphertext and
  is decrypted in memory. The check runs against the built artefact, not the source.
- **The plaintext script never touches disk at run time.** It is evaluated in the renderer and
  forgotten.
- **The application never restarts Discord on its own.** Restarting Discord ends whatever the user
  was doing in it. The application says what is needed and the user decides.
- **The application never accepts a quest, and never claims a reward.** It works the quests the
  user has already accepted.
- **The quest list comes from Discord's client, read at run time.** It is never cached, and never
  bundled into the shipped frontend.
- **A quest is reported as finished only when Discord says it is.** The interface shows what the
  backend read, never what it hopes.
- **The application must work only in the Discord desktop client.** The browser has no such
  internals to drive.
- **No Discord RPC Rich Presence.** It does not complete quests, it requires application IDs this
  project does not own, and it risks the user's account.
- **The reader finds Discord's internals by shape, not by a pinned export name.** The quest script
  is pinned; the reader must survive a rename, so the application can still say what it can see.

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
