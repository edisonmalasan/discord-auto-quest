---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface brief — discord-auto-quest catalogue

**Scope:** the catalogue surface. The app's first screen: the index of games Discord
can detect, their questability, and the registered path behind each one.

**Visitor mode:** Operate. The visitor arrived to do a job — find a game, see whether it
can be quested, and later start and stop quests. They come back to this screen often and
for minutes at a time.

**Audience:** a Discord player clearing a seasonal quest list, at their desk, usually with
the Discord client open in the next window.

**Job:** find the game in a catalogue of ~25,000 entries, and know before clicking
whether it can be quested at all.

**Action:** browse or search the index; read the questability mark and the registered path.

**Proof/content:** the live catalogue, fetched at runtime. Every count is derived from
the catalogue in hand.

**Constraints:**
- The catalogue is never bundled. It is fetched and cached in the backend.
- The app is unaffiliated with Discord and does not borrow Discord's visual language.
- Runtime state is never asserted optimistically; what the app knows is what it shows.
- 58% of the catalogue cannot be quested. That has to be visible, not a dead end.

**Chosen direction:** the working index — a printed catalogue of detected applications,
with a margin key.

**Memorable moment:** the margin mark. A filled square means Discord has registered an
executable for that title; a hollow square means it has not. Beside it, in the reference
column, the exact registered path the stub will mirror. The mechanism is printed in the
margin of every line.

**Unresolved decisions:** questing controls, the selected-game panel's runtime fields, and
filter persistence are deferred to the groups that own them.

## Direction contract

**THESIS:** A printed index, not a launcher. This product's truth is that most of the
catalogue is und questable and that the path is the mechanism; the index prints both
facts in the margin of every line instead of hiding them behind a card and a play button.

**OWN-WORLD:** A working printed catalogue on uncoated stock, rendered as ink on a cold
ink ground. Rules: hairline rules divide, never boxes or cards; flat fields, no texture
or grain; the margin mark is the only decoration; one spot colour (`#4FC3B0`) carries
detection, selection, and focus; amber carries a stale cached copy, red carries an
unreachable endpoint; figures and registered paths are set in Azeret Mono; names and
interface are set in Archivo, hierarchy by scale and weight alone. Raised by the
orienteering legend: the keyed symbol table at the head of the index. Raised by the
boarding pass: the selected entry's facts segmented into a pass of labelled rows with
tabular figures. Raised by the type specimen: hierarchy from scale contrast, not
decoration. Raised by the design annual: 1px hairlines do all the dividing.

**STORY:** You open the app and land in an index of every game Discord can detect, already
sorted and already counted. The header tells you where the data came from and when it
arrived, in the same words every time: live from Discord, or a cached copy from four
hours ago. In the margin of every line, a mark tells you whether that title can be
quested at all. Select a line and the right column prints the registered path the stub
will mirror, the platform, and whether Discord marked it a launcher. Nothing on the
screen claims Discord has credited anything.

**FIRST VIEWPORT:** Three columns at 1440x900. A 232px left rail carries the app mark,
the three scope filters (All / Questable / Not questable), the platform filter, and the
composition readout: total entries, the questable share as a proportion bar with its
counts, and the per-platform executable split. The centre column is the index itself: a
sticky head row with the column labels (Title, Registered path) and the keyed legend
under it, then hairline-ruled entry rows — margin mark, 44px cover art, title, the
registered path in mono, a platform tag — with the selected row marked by a spot-colour
rule down its left edge. The 320px right column is the selected entry's fact pass:
cover art at 128px, the entry's full registered path broken into segments, the platform,
the launcher flag, and the age ratings. The primary action for the selected entry sits at
the foot of that panel and is disabled with a stated reason when the entry cannot be
quested.

**FORM:** chosen form — the working printed index; position 3 of the grounded list by
resonance; seed:1b3ae4cf96fcb263.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish
review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
