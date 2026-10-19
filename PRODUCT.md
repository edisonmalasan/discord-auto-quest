# Product

Durable product truth for **discord-auto-quest**. This file changes only when the product itself
changes. For *how* the work is sequenced, see [`docs/ROADMAP.md`](docs/ROADMAP.md). For *what was
observed* about the upstream app, see [`re/docs/`](re/docs/).

## What this is

A desktop application that completes Discord quests for games the user does not own, by making
Discord's local activity detection report the game as running.

## Who it is for

A user who wants to complete Discord's game quests without buying and installing every game in
the catalogue. The person is:

- comfortable with a desktop utility that writes to their user data directory and spawns
  background processes,
- in the Discord ecosystem for play, not for automation,
- and unwilling to spend money or disk space on dozens of titles to clear a seasonal quest list.

## The mechanism, stated once

Discord has **no quest-completion API**. Quests credit activity that Discord's local Rich
Presence integration reports. So the app:

1. Fetches Discord's public game catalogue (`discord.com/api/applications/detectable`).
2. Resolves the game's registered executable path for the target platform.
3. Materialises a small platform-specific stub binary at a path that mirrors that registered path.
4. Launches the stub and tracks its child PID.
5. Terminates that PID on request.

Discord observes the running process, reports the game as active, and credits the quest.

**The path mirror is load-bearing.** Discord matches on the registered executable path, not merely
the file name. The stub is placed at
`<user data>/games/<app id>/<registered path segments>/<executable basename, extension stripped>`.

## Product principles

These are the decisions that must survive implementation changes.

### 1. Honesty about state beats optimistic UI

The app shows what it knows, not what it hopes. A stub that is running is reported as a running
stub. If the app cannot confirm Discord-side state, it does not claim Discord-side state. Quest
progress is Discord's business, not the app's to assert.

### 2. Questability is a first-class property

Roughly half of the catalogue has no registered executable and can never be quested by this
mechanism. The UI must make that visible — marked, explained, and non-actionable — rather than
letting the user select an entry and hit a dead end.

### 3. Real cover art, always

The catalogue carries `cover_image_hash` and `icon_hash` for most entries. The app renders them.
A catalogue of ~25,000 games should be browsable by eye, not only by search.

### 4. Never touch another process

The app starts and stops **its own** children, identified by PID. It never kills by image name.
A user running the real game must never have it killed by this tool.

### 5. Write only to the user's own space

All state — the catalogue cache, the materialised stubs, the quest records — lives under a
per-user application data directory. The application directory itself is treated as read-only.

### 6. The catalogue is data, not a payload

The catalogue is fetched at runtime and cached. It is never bundled into the shipped application.
A ~25,000-entry catalogue compiled into the frontend is a defect.

### 7. Quiet by default

Starting a quest should not open a dozen windows or tray icons. The runner is silent where the
platform allows it. On macOS a visible window is required by the platform's detection behaviour,
and that is stated plainly in the UI rather than hidden.

### 8. No borrowed identity

The app does not use another publisher's Discord application ID, does not spoof Rich Presence, and
does not present itself as Discord or as the upstream project. It is unaffiliated with Discord Inc.


## Explicit non-goals

| Non-goal | Reason |
|---|---|
| Discord RPC Rich Presence spoofing | Does not complete quests. Requires application IDs the project does not own. Upstream's own UI warns it may flag the account as self-botting. |
| A Discord bot or account automation | Out of scope, and against Discord's terms. |
| Bundling a catalogue snapshot | Fetched and cached instead. |
| A developer playground page | A debug surface, not a product feature. |
| An installer | A portable archive matches the upstream distribution model and keeps the download small. |

## Technical constraints

These are constraints the implementation must respect. They are not preferences.

| Constraint | Reason |
|---|---|
| The stub path must mirror the registered executable path | Discord's match is path-sensitive. |
| The file extension is stripped from the on-disk name | Discord's match is sensitive to this asymmetry. |
| The macOS stub must be a real `.app` bundle with a valid `Info.plist`, launched via `open -n -g -a` | macOS treats a bare executable differently from an application. |
| The macOS stub must present a visible window | Discord on macOS detects applications with a visible window. |
| The Windows runner should not statically link `user32`, `gdi32`, or `shell32` | Keeps the import table minimal and the runner small. Target ≤ 300 KB. |
| The Linux runner must not require GTK to be installed | GTK cannot be assumed on a user's machine. |
| The catalogue endpoint is unauthenticated and undocumented | The fetch and cache layer must be defensive and must degrade to the cache. |
| The catalogue source of truth is Discord's endpoint | Any mirror is operator-controlled and can drift. Discord is primary; a mirror is at most a fallback. |

## Acceptance

A build is acceptable when the acceptance cases in
[`re/docs/08-reconstruction-map.md`](re/docs/08-reconstruction-map.md) all pass. Those cases are
written as observable outcomes, and they are the contract — not the implementation.

## Attribution obligations

The upstream project studied in `re/` is MIT licensed. This project:

1. Retains the MIT notice on any upstream source or substantial upstream-derived code.
2. Does not present itself as the upstream project, and does not use its name, logo, or branding.
3. Does not ship upstream's catalogue snapshot as its own artefact.
4. Carries its own disclaimer that it is unaffiliated with and not endorsed by Discord Inc.
