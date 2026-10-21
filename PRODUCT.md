---

# Product

Durable product truth for **discord-auto-quest**. This file changes only when the product itself
changes. For *how* the work is sequenced, see [`docs/ROADMAP.md`](docs/ROADMAP.md). For *what was
observed* about the upstream app, see [`re/docs/`](re/docs/).

## What this is

A desktop application that completes Discord's quests for games the user does not own, by driving
the Discord desktop client the user is already signed in to.

## Who it is for

A user who wants to clear a seasonal quest list without buying and installing every game in the
catalogue. The person is:

- comfortable with a desktop utility that reads their Discord client and runs a script inside it,
- in the Discord ecosystem for play, not for automation,
- and unwilling to spend money or disk space on dozens of titles to clear a seasonal list.

## The mechanism, stated once

Discord has **no quest-completion API**. Quests credit activity that Discord's own client
reports. So the application:

1. Finds the Discord desktop client, and makes sure it is running with a debugging port — which
   means restarting Discord, once, with the user's agreement.
2. Attaches to the client's renderer over the Chrome DevTools Protocol.
3. Reads the quest state out of the client's own store: the quests on offer and not expired, and
   the quests the user has accepted, with their progress.
4. Runs the quest script inside that renderer, which is what makes the client's own quest
   heartbeat count the quest.
5. Shows the user what is happening, and what they still have to do themselves.

The script is the mechanism, and it is the one piece of this project that must not be readable by
anyone who has the application. It is encrypted when the payload is built and embedded as
ciphertext; it is decrypted into memory, evaluated in the renderer, and never written to disk.

## Product principles

These are the decisions that must survive implementation changes.

### 1. Honesty about state beats optimistic UI

The app shows what it knows, not what it hopes. If the app cannot confirm Discord-side state, it
does not claim Discord-side state. Quest progress is Discord's business, not the app's to assert.
A quest is reported as finished only when Discord says it is finished.

### 2. The quest list is the product, and it is Discord's list

The application does not maintain a catalogue of games, and it does not decide what is worth
accepting. It shows the quests Discord is running — the ones on offer and not expired, and the ones
already accepted — and it says what each one takes, what it gives, and when it ends. The user
accepts a quest in Discord; the application works the ones they have accepted.

### 3. Never act on the user's account without their say-so

The application never accepts a quest, never claims a reward, and never restarts Discord without
being asked. It works quests the user has already accepted, and it tells them when a reward is
waiting to be claimed. Every action the user did not ask for is a sentence, not a decision the
application takes for them.

### 4. Nothing is touched that is not the user's

The application reads and drives the user's own Discord client, on the user's own session. It
starts no process, kills no process, and writes nothing outside the user's own data directory. The
application directory is treated as read-only.

### 5. The script is a payload, and it is not exposed

The quest script lives in the ignored `re/` folder and ships encrypted. What the executable
carries is ciphertext. A check runs against the built artefact, not the source, because a check
against the source cannot see what the compiler produced.

### 6. Quiet by default

Working a quest opens nothing. The application is a window, and that is all.

### 7. No borrowed identity

The app does not present itself as Discord or as any other project, does not use another
publisher's Discord application ID, and carries its own statement that it is unaffiliated with and
not endorsed by Discord Inc.

## Explicit non-goals

| Non-goal | Reason |
|---|---|
| Accepting quests on the user's behalf | Claiming a quest is the user's decision. |
| Claiming rewards | The reward is the user's, and the claim is theirs to make. |
| A catalogue of games Discord can detect | It carries no quest information, and it is 25,000 rows of noise. |
| Bundling a catalogue snapshot | Discord's own list is read at run time, from the client. |
| A developer playground page | A debug surface, not a product feature. |
| An installer | A portable archive keeps the download small. |

## Technical constraints

These are constraints the implementation must respect. They are not preferences.

| Constraint | Reason |
|---|---|
| The script must not be readable in the shipped executable | It is the mechanism, and it is the one piece that must not be handed over. |
| The plaintext script must never touch disk at run time | It is decrypted in memory and evaluated in the renderer. |
| The application must not restart Discord without being asked | Restarting Discord ends whatever the user was doing in it. |
| The debugging port must be bound to loopback only | It is a local attack surface while the client runs with it. |
| The application must work only in the Discord **desktop** client | The mechanism reaches into the client, and a browser has no such internals. |
| The application must survive Discord updating | The script is pinned to a client version. When it stops attaching, the application must say so rather than go quiet. |
| The quest list comes from the client, read at run time | Discord is the only authority on what quests exist and what has been accepted. |

## Acceptance

A build is acceptable when the acceptance cases in the plan are all pass. Those cases are written
as observable outcomes, and they are the contract — not the implementation.

## Attribution obligations

The upstream project studied in `re/` is MIT licensed. This project:

1. Retains the MIT notice on any upstream source or substantial upstream-derived code.
2. Does not present itself as the upstream project, and does not use its name, logo, or branding.
3. Carries its own disclaimer that it is unaffiliated with and not endorsed by Discord Inc.
