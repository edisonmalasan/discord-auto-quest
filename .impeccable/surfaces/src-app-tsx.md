---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface brief — discord-auto-quest quest register

**Scope:** the quest surface. The app's only screen: the quests Discord is running, the quests
the user has accepted, how far along each one is, and the one action that works them.

**Visitor mode:** Operate. The visitor arrived to do a job — clear a quest list — and they come
back to this screen while it counts.

**Audience:** a Discord player clearing a seasonal quest list, at their desk, usually with the
Discord client open in the next window.

**Job:** see what Discord is asking for, see what is counting, and work the quests.

**Action:** work the quests; stop working them.

**Proof/content:** the live quest state, read out of the client's own store. Every count is derived
from the client in hand.

**Constraints:**
- The quest list is Discord's, read at run time. It is never cached or bundled.
- The app is unaffiliated with Discord and does not borrow Discord's identity — but it draws the
  quests as Discord draws them, because every quest already has a face and a second invented
  shape would hide it.
- Runtime state is never asserted optimistically; what the app knows is what it shows.
- A quest is reported as finished only when Discord says it is.
- The app never accepts a quest, never claims a reward, and never restarts Discord without being
  asked.

**Chosen direction:** Discord's own quest card, in this project's ink. The card is Discord's —
its banner, its wordmark, its publisher line, its reward, its ring, its two buttons — because the
artwork is already made and a second shape would be a worse way to show it. What is this project's
is the ground, the type, the spot colour, and the honesty.

**Memorable moment:** the ring. The quest's own progress, as a percentage, in an arc of Discord's
green on a grey track — the one figure that says whether the work is counting, read from Discord
rather than kept by this application.

**Unresolved decisions:** whether the offered quests belong beside the accepted ones at all, since
they are the ones the application cannot work.

## Direction contract

**THESIS:** A card, not a row. Discord already draws a quest as a card, with the game's artwork
over it and the reward under it. An invented shape would hide the artwork, take a second language
to learn, and look like a different application from the one it lives inside.

**OWN-WORLD:** The card is Discord's; the application around it is ours. The ground is a cold ink
(#0F1214), the type one grotesque with a mono for figures, one spot colour on the control that
starts the work, and Discord's own quest blue and quest green kept to the parts Discord puts them
on. Flat throughout: no shadow anywhere, and the one gradient is a neutral scrim so a wordmark can
sit on artwork that leaves no room for it.

**STORY:** You open the app and land in the quests Discord is running, already counted and already
sorted: the ones you have accepted first, the ones on offer below them. Each is Discord's own
card — the game's artwork, its wordmark, the publisher's name, the day it ends, the reward, and the
ring that says how far it has counted. The band says what needs doing now, in one sentence, and
carries the one control that does it. Nothing on the screen claims Discord has credited anything.

**FIRST VIEWPORT:** One column at 1200x820. A 56px title bar with the mark, the application name,
and the client's state in mono at the right. A band beneath it, ruled, carrying the one sentence
and the one control. Then the cards: the ACCEPTED QUESTS register, a heading, a count, and a grid of
cards at a 19rem minimum with a 16px gutter; then the AVAILABLE QUESTS register, the same shape.
The cards are the only scrolling region. A quiet rule and the colophon close the page.

**FORM:** chosen form — the card Discord already draws; position 1 of the studied set, because the
subject already has a face and the study's own conclusion is that a distinctive first screen wins
over a clean one.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance
