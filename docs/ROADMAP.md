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

- [x] A Tauri application builds and launches on Windows from a clean checkout.
- [x] The catalogue is fetched from Discord's endpoint and cached to the per-user data directory.
- [x] The cached catalogue is a compacted projection, not the raw payload.
- [x] A cached catalogue is served when the network is unavailable, and the UI states that it is
      showing cached data.
- [x] An unreachable endpoint with no cache produces an explicit, retryable error — not an empty
      list and not a hang.
- [x] The shipped frontend bundle contains no catalogue snapshot.
- [x] Catalogue counts, questability ratios, and platform splits are derived from the fetched
      catalogue at runtime — no count is hard-coded, because the live catalogue and upstream's
      bundled snapshot already disagree by more than 3,000 entries.

**Status:** Complete. The catalogue service lives in `src-tauri/src/catalogue/`, the index surface
in `src/`. The catalogue is fetched, validated, projected, cached, and served; the cache is
served immediately when one exists, and a refresh runs in the background when the cache is past
its 24-hour interval. Verified by 39 frontend tests, 45 backend tests, and a network test that
runs against Discord's live endpoint.

**Not in this group:** questing. Materialising a stub, launching it, and stopping it by PID is
Group 2, and the index's primary action is disabled until then.

---

## Group 2 — Questing on Windows

*Outcome: A user can pick a game, start a quest, and stop it, on Windows, with correct process
lifecycle and honest state.*

- [x] Starting a quest materialises a stub at
      `<user data>/games/<app id>/<registered path segments>/<exe>` and returns a child PID.
- [x] The stub is launched with the game name, and the UI shows the PID and an elapsed timer.
- [x] Stopping a quest terminates that specific child process.
- [x] A real game process with the same image name is not affected by stopping a quest.
- [x] The runner is silent by default — no window, no tray icon, no console.
- [x] The runner is under 300 KB, and its PE import table contains no `user32.dll`, `gdi32.dll`, or
      `shell32.dll` import.
- [x] An executable name containing an illegal filesystem character is rejected by the backend with
      a readable message, and no file is written.

**Status:** Complete. The runner is a `no_std`, `no_main` Windows binary of **3,072 bytes** that
imports `KERNEL32.dll` and nothing else — no GUI library, so it cannot open a window. `npm run
check:runner` enforces both constraints against the built binary.

**The path comes from the catalogue.** The interface names an application and a registered path;
the backend resolves the executable from the catalogue it holds and refuses anything the
catalogue does not contain. A stub can therefore only ever be written where Discord's own data
points.

**Stopping is exact.** A quest is stopped through the process handle the application holds, so
one process is signalled. A test starts a second process with the same image name and shows that
stopping the quest leaves it running.

**Not in this group:** reconciling quests across restarts, which is Group 4.

---

## Group 3 — The catalogue experience

*Outcome: The app is browsable by eye, not only searchable, and the user can tell at a glance
whether a game can be quested.*

- [x] Catalogue entries render real cover art and icons.
- [x] Games with no registered executable are visibly marked not questable, with the reason, and
      cannot be started.
- [x] A cross-platform executable fallback is offered with a notice naming the actual platform.
- [x] The catalogue can be browsed and filtered, not only reached through a capped search result
      list.
- [x] Search remains responsive over 20,000 entries.
- [x] The app never displays an unearned verification badge or claims Discord-side state it has
      not observed.

**Status:** Complete. The index is a catalogue of everything Discord has registered, and every
entry in it is reachable: the 500-result cap is gone, and the list pages through whatever it is
given.

**The artwork is real.** 17,684 of the 24,725 entries in the live catalogue carry cover art and
20,572 carry an icon. The cover art is the plate and the icon is the mark, so an entry with only
an icon still gets a picture, and the 3,955 entries with neither fall back to their initial.
Both are fetched from Discord's own CDN at the moment they are shown, and a failed load falls
back rather than leaving a broken frame.

**Search was measured, not assumed.** The upstream fuzzy index answered a query over the live
catalogue in between thirty-five and a hundred and seventy milliseconds, which is a visible
freeze on every keystroke. The index now holds one normalised string per entry and answers by
scanning it, which took about two milliseconds on the same machine — a twenty-five-fold
improvement, measured over 684 two-letter queries against the real catalogue. The fuzzy index is
kept for a query that matches nothing exactly, a typo, and is built only when one arrives.

**Nothing is claimed that was not observed.** There is no verification badge anywhere in the
interface, because the app cannot observe that Discord has credited anything. A title with no
registered executable says so in the margin of its own line and cannot be started.

**The fallback names the real platform.** Where a title has only a foreign executable, the notice
names the platform that will actually be used, which is what the upstream study recorded the
upstream app getting wrong.

Verified by 53 frontend tests, including one that searches a synthetic 25,000-entry catalogue
and asserts the query answers inside a quarter of a second.

---

## Group 4 — Honest state

*Outcome: What the app shows is what is actually true on the machine.*

- [x] Installed state is determined by a real filesystem check, not a client-side boolean.
- [x] On start-up, the app reconciles recorded quests against the live process table and drops
      entries whose process is gone.
- [x] A quest whose stub was deleted from disk returns to a clearly-explained idle state.
- [x] Errors from the backend appear next to the affected game with the backend's own error code.

**Status:** Complete. A quest is now described by its state rather than by a flag: `running`,
`missing`, or `ended`. The state is read from two places and from nowhere else — the process
table, through `kernel32`, and the filesystem — so a stub that died on its own, or one whose
file was deleted from disk, is reported as what it is.

**Reconciliation on start-up.** Quest records are written to `quests.json` in the per-user
data directory, and the service reconciles them against the process table when it is built.
A record whose process is gone is dropped; one whose process is alive is kept and adopted, so
a quest that outlived the application is found again and stopped by its process id.

**A quest is only running if there is a file.** A stub that is running but whose file was
deleted from disk is reported as `missing` and shown as idle, with the reason stated: there
is no longer a file at the path Discord matches. The process can still be stopped.

**Nothing is swallowed.** A records file that cannot be read is reported through the quest
list rather than turned into an empty one, because an empty list and "nothing is running"
are not the same claim. The liveness check waits on the process handle rather than merely
opening it, so a process that has exited but whose object has not been collected is not
reported as running.

**Errors sit next to the game.** A failure is filed against the executable it happened to
and shown there, under the backend's own error code. A path the filesystem will not accept
is refused by the backend before anything is written, and the refusal is shown with the
character that caused it.

Verified by 78 backend unit tests, 10 questing integration tests against a real runner, and
46 frontend tests.

---

## Group 5 — macOS

*Outcome: Questing works on macOS through a real application bundle.*

- [ ] Starting a quest creates a valid `.app` bundle with an `Info.plist` carrying this project's
      own bundle identifier.
- [ ] The bundle is launched with `open -n -g -a`, and a visible window appears.
- [ ] Stopping a quest terminates the launched application.
- [ ] The UI explains that a visible window is required on macOS.

**Status:** In progress. The mechanism is implemented and the code is checked against the
`x86_64-apple-darwin` target, but the app has not been run on a Mac, so the behaviour is
unverified.

**A bundle, not a file.** On macOS, Discord's local integration detects an *application*, not a
bare executable. A registered path that names a bundle — 61 of the 67 macOS executables in the
live catalogue do — becomes a real `.app` directory with a `Info.plist` inside it, and the
bundle's name is the registered name, extension and all, because the name is what the match is
on. The identifier in the property list is this project's own.

**Launched the way macOS launches applications.** The bundle is opened with
`open -n -g -a`: a new instance, in the background so it does not steal focus, selected by
path. The process `open` returns has already exited by then, so the runner's own process id is
found afterwards, by the exact path of the executable inside the bundle. The same rule the app
uses on Windows: a process is identified by the path it was started from, never by its name.

**A window, because the window is the mechanism.** The macOS runner opens a small 320×200
window titled with the game's name. It is not a decoration: an application with no visible
window is not an application to Discord's macOS integration. The interface says so plainly,
rather than leaving the user to wonder why a quest did not count.

**What is verified, and what is not.** The bundle layout, the property list, the launch
command, and the process-identification rule are covered by tests that run here. The macOS
runner is checked against the `x86_64-apple-darwin` target, and the application builds for
Windows. **The app has not been launched on a Mac**, so the window appearing, the bundle
being detected, and the process being stopped are not yet observed. Those three checkboxes
stay unchecked until they are.

---

## Group 6 — Linux

*Outcome: Questing works on Linux without assuming a graphical toolkit is installed.*

- [x] The runner has no GTK or equivalent runtime dependency.
- [x] The runner starts hidden by default.
- [x] Starting and stopping a quest works and is tracked by PID.

**Status:** Complete. Verified on a real Linux machine — Ubuntu 26.04 under WSL2, x86-64 — by
running the application's own test suite there, against a runner built for that machine.

**No toolkit, and nothing to install.** The upstream Linux runner draws a GTK4 window. GTK
cannot be assumed on a user's machine, so the clone's runner is headless: it has no window, no
toolkit, and no dependencies at all. The built binary's dynamic section was parsed and it needs
no shared library beyond the C library that every machine with a desktop already has — no GTK,
no X11, no Wayland. A quest needs a process at the right path, and that is all it needs.

**Headless is hidden.** The runner starts with no window and never opens one, so a dozen quests
are a dozen processes rather than a dozen windows. This is the same rule the product sets for
Windows, and it is the opposite of what the upstream application does.

**The quest was observed running, not merely compiled.** The Linux integration tests in
`src-tauri/tests/questing_linux.rs` were run on that machine: the stub lands at the mirrored
path, the quest is tracked by the process id the backend reported, the process is stopped by
that id, a process with the same image name is left alone, and a quest that outlived the
application is found again on start-up and stopped by its id.

**Two real bugs were found by running it there, and both are fixed.**

- The stub was written without the execute bit. A file that cannot be run is not a stub, and
  the app started it by path: every quest on Linux failed with a permission error. The stub is
  now given the same permissions a runner needs on every Unix system.
- The liveness check read `errno` by declaring it as a function. It is a macro over a
  thread-local variable, and calling it as a function dereferenced a variable as though it
  were code: the process crashed. The error is now read through the standard library.

Neither fault was visible on Windows, and neither was visible in a cross-compiled build. Both
were found by running the tests on the operating system they are about.


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
| 1 | Foundation | Complete |
| 2 | Questing on Windows | Complete |
| 3 | The catalogue experience | Complete |
| 4 | Honest state | Complete |
| 5 | macOS | In progress |
| 6 | Linux | Complete |
| 7 | Release readiness | Not started |

## Maintenance

- Revisit this roadmap when scope or priorities change.
- Update statuses only after verification; distinguish untested from failed.
- Keep implementation details in code, code review, or a task-specific plan — not here.
- Preserve reasons for significant technical decisions in an existing authoritative project
  document, adding a dedicated one only if needed.


