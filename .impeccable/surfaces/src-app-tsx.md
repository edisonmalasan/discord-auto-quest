---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface brief — discord-auto-quest quest register

**Scope:** the quest surface. The app's only screen: the quests Discord is
running, the quests the user has accepted, how far along each one is, and the
one action that works them.

**Visitor mode:** Operate. The visitor arrived to do a job — clear a quest
list — and they come back to this screen while it counts.

**Audience:** a Discord player clearing a seasonal quest list, at their desk,
usually with the Discord client open in the next window.

**Job:** see what Discord is asking for, see what is counting, and work the
quests.

**Action:** work the quests; stop working them.

**Proof/content:** the live quest state, read out of the client's own store.
Every count is derived from the client in hand.

**Constraints:**
- The quest list is Discord's, read at run time. It is never cached or bundled.
- The app is unaffiliated with Discord and does not borrow Discord's visual language.
- Runtime state is never asserted optimistically; what the app knows is what it shows.
- A quest is reported as finished only when Discord says it is.
- The app never accepts a quest, never claims a reward, and never restarts
  Discord without being asked.

**Chosen direction:** the register — a printed ledger of quests on uncoated
stock, rendered as ink on a cold ground, with the figures set like a ledger's.

**Memorable moment:** the figure column. Every measurement — the progress, the
reward, the day it ends — is set in mono and lines up down the column, so the
list reads as a ledger rather than a list of cards.

**Unresolved decisions:** whether the available-quest list earns its place beside
the accepted one in the first viewport, and what the band says when several
quests are finished at once.

## Direction contract

**THESIS:** A printed register, not a launcher. This product's truth is that the
quests belong to Discord, that the user accepts them there, and that the
application only works them. So the page prints them as a ledger: the task
beside the name, the figures at the end of the line, and one sentence saying
what needs doing now.

**OWN-WORLD:** A working register on uncoated stock, rendered as ink on a cold
ink ground. Rules: hairline rules divide, never boxes or cards; flat fields, no
texture or grain; one spot colour (`#4FC3B0`) carries the one action and the
focus ring; amber carries a client that needs a restart, red a failure; figures
are set in Azeret Mono and names and interface in Archivo, hierarchy by scale and
weight alone. Raised by the type specimen: hierarchy from scale contrast, not
decoration. Raised by the design annual: 1px hairlines do all the dividing.

**STORY:** You open the app and land in a register of the quests Discord is
running, already counted and already sorted: the ones you have accepted first,
and the ones on offer below them. The title bar says whether the client is
ready. The band says what needs doing now, in one sentence, and carries the one
control that does it. The register prints each quest's name, what it takes, how
far along it is, what it gives, and the day it ends. Nothing on the screen
claims Discord has credited anything.

**FIRST VIEWPORT:** One column at 1200x820. A 56px title bar with the app mark, the
application name, and the client's state in mono at the right. A band beneath
it, ruled, carrying the one sentence and the one control. Then the register:
the ACCEPTED section, a heading, a count, a rule, and hairline-ruled rows of
thirty-four pixels; then the ON OFFER section, the same shape. The register is
the only scrolling region. A quiet rule and the colophon close the page.

**FORM:** chosen form — the working register; position 3 of the grounded list by
resonance; seed:1b3ae4cf96fcb263.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance
