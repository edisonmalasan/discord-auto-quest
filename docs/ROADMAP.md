# discord-auto-quest — Roadmap

> **Purpose:** A grouped, outcome-based guide to **what** should be built and in what order — not an
> implementation plan. The acceptance cases in `re/docs/08-reconstruction-map.md` (A1–A15) are the
> contract for "done".

## Status Rules

- `[ ]` = not yet verified as complete. `[x]` = implemented **and verified**.
- **Not started:** no required items verified. **In progress:** some required items pending.
  **Complete:** all required items verified.
- **Deferred:** intentionally excluded from the current milestone; move it to the Deferred section
  instead of counting it as done.
- The agent must check actual implementation and tests before marking an item complete; if evidence
  is missing, leave it unchecked and note the uncertainty.
- Each checkbox describes an **observable, testable outcome**, not a class name, code snippet, or
  implementation technique.
- Follow approved priorities; do not assume the next unchecked item is automatically authorized
  work.

---

## Group 0 — Reverse-engineering study

*Outcome: The upstream mechanism, data contracts, and platform boundaries are documented with
traceable evidence, and the clone specification is written.*

- [x] The upstream release and source tree are extracted, hashed, and analysed with REA.
- [x] The quest-completion mechanism is established and documented, with the absence of a Discord
      quest API confirmed.
- [x] The catalogue schema, distribution, and constraints are documented from live and bundled data.
- [x] The backend IPC surface, path model, and process lifecycle are documented from source.
- [x] The UI structure and its state-fidelity gaps are documented from source.
- [x] The three platform runners are documented, including their dependency and visibility
      requirements.
- [x] The build and packaging pipeline is documented, including the catalogue-in-bundle cost.
- [x] The clone specification, acceptance cases, and open questions are written.

**Status:** Complete. Documents live in `re/docs/`. `re/` is git-ignored.

---

## Group 1 — Foundation

*Outcome: The application exists, builds on Windows, and can fetch and cache the game catalogue
without the catalogue being part of the shipped artefact.*

- [ ] A Tauri application builds and launches on Windows from a clean checkout.
- [ ] The catalogue is fetched from Discord's endpoint and cached to the per-user data directory.
- [ ] The cached catalogue is a compacted projection, not the raw payload.
- [ ] A cached catalogue is served when the network is unavailable, and the UI states that it is
      showing cached data.
- [ ] An unreachable endpoint with no cache produces an explicit, retryable error — not an empty
      list and not a hang.
- [ ] The shipped frontend bundle contains no catalogue snapshot.
- [ ] Catalogue counts, questability ratios, and platform splits are derived from the fetched
      catalogue at runtime — no count is hard-coded, because the live catalogue and upstream's
      bundled snapshot already disagree by more than 3,000 entries.

**Status:** Not started

---

## Group 2 — Questing on Windows

*Outcome: A user can pick a game, start a quest, and stop it, on Windows, with correct process
lifecycle and honest state.*

- [ ] Starting a quest materialises a stub at
      `<user data>/games/<app id>/<registered path segments>/<exe>` and returns a child PID.
- [ ] The stub is launched with the game name, and the UI shows the PID and an elapsed timer.
- [ ] Stopping a quest terminates that specific child process.
- [ ] A real game process with the same image name is not affected by stopping a quest.
- [ ] The runner is silent by default — no window, no tray icon, no console.
- [ ] The runner is under 300 KB and does not statically link `user32`, `gdi32`, or `shell32`.
- [ ] An executable name containing an illegal filesystem character is rejected by the backend with
      a readable message, and no file is written.

**Status:** Not started

---

## Group 3 — The catalogue experience

*Outcome: The app is browsable by eye, not only searchable, and the user can tell at a glance
whether a game can be quested.*

- [ ] Catalogue entries render real cover art and icons.
- [ ] Games with no registered executable are visibly marked not questable, with the reason, and
      cannot be started.
- [ ] A cross-platform executable fallback is offered with a notice naming the actual platform.
- [ ] The catalogue can be browsed and filtered, not only reached through a capped search result
      list.
- [ ] Search remains responsive over 20,000 entries.
- [ ] The app never displays an unearned verification badge or claims Discord-side state it has
      not observed.

**Status:** Not started

---

## Group 4 — Honest state

*Outcome: What the app shows is what is actually true on the machine.*

- [ ] Installed state is determined by a real filesystem check, not a client-side boolean.
- [ ] On start-up, the app reconciles recorded quests against the live process table and drops
      entries whose process is gone.
- [ ] A quest whose stub was deleted from disk returns to a clearly-explained idle state.
- [ ] Errors from the backend appear next to the affected game with the backend's own error code.

**Status:** Not started

---

## Group 5 — macOS

*Outcome: Questing works on macOS through a real application bundle.*

- [ ] Starting a quest creates a valid `.app` bundle with an `Info.plist` carrying this project's
      own bundle identifier.
- [ ] The bundle is launched with `open -n -g -a`, and a visible window appears.
- [ ] Stopping a quest terminates the launched application.
- [ ] The UI explains that a visible window is required on macOS.

**Status:** Not started

---

## Group 6 — Linux

*Outcome: Questing works on Linux without assuming a graphical toolkit is installed.*

- [ ] The runner has no GTK or equivalent runtime dependency.
- [ ] The runner starts hidden by default.
- [ ] Starting and stopping a quest works and is tracked by PID.

**Status:** Not started

---

## Group 7 — Release readiness

*Outcome: The project can be built, tested, and shipped reproducibly.*

- [ ] The version is defined in one place and injected into every artefact and the about panel.
- [ ] A release archive is produced per platform, and the runner is bundled under a single,
      consistent naming convention.
- [ ] The build fails, rather than warns, when the platform runner is missing.
- [ ] The project carries its own MIT notice for reused upstream material and an unaffiliation
      disclaimer.
- [ ] The README documents the real build, test, and run commands.

**Status:** Not started

---

## Deferred / Future Work

*Intentionally postponed outcomes, with their reason or target release when known. Do not mark these
complete.*

- [ ] Discord RPC Rich Presence — excluded. It does not complete quests, it requires application
      IDs this project does not own, and it risks the user's account. Confirmed at the **binary**
      level: the `discord-sdk` crate is linked into the shipped upstream app, so this is a real,
      reachable upstream feature rather than a source-tree artefact.
- [ ] A "run for N seconds" timed quest mode — the minimum duration Discord requires is
      unverified; see Q3 in `re/docs/09-coverage-and-open-questions.md`.
- [ ] Store and platform filters beyond the catalogue's own fields — depends on the catalogue
      service landing first.
- [ ] An installer rather than a portable archive — deferred to keep the download small.

## Status Summary

| Group | Milestone | Status |
|---|---|---|
| 0 | Reverse-engineering study | Complete |
| 1 | Foundation | Not started |
| 2 | Questing on Windows | Not started |
| 3 | The catalogue experience | Not started |
| 4 | Honest state | Not started |
| 5 | macOS | Not started |
| 6 | Linux | Not started |
| 7 | Release readiness | Not started |

## Maintenance

- Revisit this roadmap when scope or priorities change.
- Update statuses only after verification; distinguish untested from failed.
- Keep implementation details in code, code review, or a task-specific plan — not here.
- Preserve reasons for significant technical decisions in an existing authoritative project
  document, adding a dedicated one only if needed.


