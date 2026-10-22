# Discord Auto Quest

A desktop app that completes Discord's quests — by making Discord's own client believe the game is
running.

**Status:** the mechanism is proved and the application is built. An accepted quest was driven to
`completed` on a real Discord client, and its reward became claimable. The transport, the encrypted
payload, the reader, the driver, and the interface are all merged, and the continuous integration is
green on Windows, Linux and macOS.

## What it does

Discord runs quests that credit you for playing a game. This app completes those quests for games
you do **not** have installed, by running a script inside the Discord desktop client you are
already signed in to.

There is **no Discord quest API** to call. A quest is counted by Discord's own client, from the
running-games store the client keeps, and by the heartbeat that client sends. So the app attaches
to the client's renderer over the Chrome DevTools Protocol and puts a fake game into that store.
Discord's own machinery then does the rest — and it reaches the quest types a stub process could
never reach: video, streaming and activity quests.

## How it works

The interface separates Ongoing, Available, and Completed quests in a sidebar workspace.
Cards show live progress and distinguish completed quests from claimed rewards. Accept and
claim controls continue in Discord; Work/Stop is one global control for accepted quests.
Search, accessible action menus, and connection recovery keep the list usable while it updates.

```text
FIND      locate the Discord desktop client and its debugging port
ATTACH    connect to the client's renderer over the DevTools Protocol
READ      read the quest state out of the client's own store
RUN       evaluate the quest script inside the renderer, and keep the originals
RESTORE   put Discord's own methods back
```

Every step runs against the user's own client. Nothing else on the machine is started, stopped, or
inspected.

## What it is not

- **Not a Discord bot.** It does not talk to the Discord API to complete quests, because no such
  API exists.
- **Not Rich Presence spoofing.** The upstream project has a separate RPC feature that fakes
  presence with other publishers' application IDs. That is excluded here — it does not complete
  quests and it risks the account.
- **Not affiliated with Discord.** Discord is a trademark of Discord Inc.

## What it does not do for you

- **It does not accept a quest.** You accept it in Discord, and the app works the ones you have
  accepted.
- **It does not claim a reward.** When a quest finishes, the app says so and you claim it.
- **It does not restart Discord on its own.** Restarting Discord ends whatever you were doing in
  it — a voice call, most likely — so the app says what is needed and you decide.

## Requirements

- **The Discord desktop client.** The mechanism reaches into the client's internals; a browser has
  no such internals to reach.
- **A debugging port.** The client only speaks the protocol when it is started with one, so it has
  to be restarted once. The app offers to do that and warns you what it costs.
- **Windows, Linux, or macOS.** There is nothing to build per platform: there is no helper
  executable.

## Building

The app is a Tauri v2 desktop application: a Rust backend under a React frontend.

```bash
npm install                              # install dependencies
npm run tauri dev                        # run the app against the Vite dev server
npm run build                            # check the version, then type-check and build the frontend
npm run tauri build                      # build the desktop application
```

### The dev server takes whatever port is free

The dev server does not have one fixed port. `npm run tauri dev` finds a free port, gives it to
the dev server, and tells the Tauri shell where to find it — so a second copy of the application,
or anything else on the machine already holding port 1420, does not stop you working.

It prints the port it took:

```text
the dev server will take port 1421
```

`npm run dev` on its own — the frontend in a browser, with no backend — also moves on to the next
free port.

### Verifying the mechanism

```bash
npm run verify
```

That runs the whole loop against your real Discord, and reports on it: whether Discord is
reachable, what quests it has, what the script said, whether the progress moved, and whether
Discord's own methods were put back. It is the same loop you would run by hand — accept a quest,
press "Work my quests", watch the progress climb — with the watching done for you.

```text
discord-auto-quest — verification
================================

1. Discord
   installed:       yes
   debugger port:   58913
   answering:       yes

2. The quests, read out of Discord
   on offer:    15
   accepted:    6
   expired:     64
   desktop app: yes

3. The quest script
   the script ran.
   | You don't have any uncompleted quests!

4. The progress, after the script has run
     Deadzone Rogue 2                         900/900s  no change

summary
-------
  quests on offer:        15
  quests accepted:        6
  a game was spoofed:     no
  the script said:        1 lines
  the progress moved:     no
  Discord was restored:   yes

  The mechanism is fine, and there was nothing to work on: every quest you have
  accepted is finished, or its task is one the script does not handle. Accept a
  fresh quest and run this again.
```

**Discord has to be running with a debugging port.** The application offers to restart it, because
that ends whatever you were doing in it — so it asks first, and the answer is yours.

### Testing

```bash
npm test                                             # the frontend test suite
npm run typecheck                                    # the frontend, without building it
cargo test --manifest-path src-tauri/Cargo.toml      # the backend test suite
cargo test --manifest-path src-tauri/Cargo.toml -- --ignored   # the suite that starts a browser
```

### The payload

The quest script is the one piece of this project that must not be handed over with the
application. It is encrypted when the payload is built and embedded as ciphertext; it is decrypted
into memory when it is needed and never written to disk.

```bash
npm run build:payload                                # re-encrypt the script into the payload
npm run check:payload -- <path to the built app>     # assert the script is not readable in it
```

The key is in the application, so this is *obfuscation* and not secrecy: the script is not sitting
in the executable as text, but the executable can decrypt it. The plaintext lives outside version
control, so a fresh clone builds without it.

### The acceptance cases

```bash
npm run build              # the bundle has to exist to be inspected
npm run check:acceptance   # the shipped bundle and the notices
```

### Continuous integration

A workflow builds and checks the application on Windows, Linux and macOS, and asserts on each
platform that the script is not readable in the built executable. A tag cuts a release from the
artifacts those builds produced.

### The version

The version is defined in one place — the `version` field of `package.json` — and injected into
everything that states one.

```bash
npm run version:check   # fail if a manifest disagrees with it
npm run version:sync    # bring the manifests into step
```

### Releasing

```bash
npm run release
```

This builds the frontend and the application for this machine and writes a portable archive under
`target/release/`, named after the version. The archive holds the application, and the licence and
notice.

## Project layout

| Path | Contents |
|---|---|
| `PRODUCT.md` | Durable product truth: what this is, who it is for, and the constraints that do not change. |
| `DESIGN.md` | The design system: the palette, the type, the rules, and the components. |
| `docs/CONTEXT.md` | Router for project context and constraints. |
| `docs/ROADMAP.md` | Grouped, outcome-based build guide and progress tracker. |
| `AGENTS.md` | Working method, Git workflow, and architecture non-negotiables. |
| `src/` | The React frontend: the quest register, the band, and the gate. |
| `src-tauri/` | The Rust backend: the transport, the payload, the reader, the driver, and the Tauri shell. |
| `src-tauri/examples/` | The hand-driven tools: `drive` does what the application does without the window. |
| `scripts/` | The version, the payload, the payload check, and the release packaging. |
| `.impeccable/` | The design direction for the quest surface and the brief it is held to. |
| `re/` | The reverse-engineering study of the upstream app. **Git-ignored** — it is prior art, not the blueprint. |

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

The study also found, against this project's own earlier reading, that Discord's detection needs
the stub process to have a **visible window** — which is why the silent runner this project built
never worked. The full audit, with the twenty disagreements it settled, is in
`re/docs/10-upstream-audit.md`.

Start at [`re/README.md`](re/README.md).

**Note:** `re/` is excluded from version control, so it will not appear in a fresh clone. It holds
investigation evidence that is intentionally kept out of the product's history.

## Licence and attribution

This project is an independent implementation, MIT licensed. It is not affiliated with, endorsed
by, or connected to Discord Inc., and it is not the upstream project.

The upstream project it was studied from is MIT licensed. Any upstream source or substantial
upstream-derived code reused here must retain its MIT notice and be attributed. See
[`NOTICE`](NOTICE) for the notices that ship with this project.

Discord is a registered trademark of Discord Inc. Use is at your own risk.
