# Discord Auto Quest UI redesign

Date: 2026-10-23

Status: Approved by the user on 2026-10-23. Implementation progress is recorded in the
[roadmap](../../ROADMAP.md).

## Intent and approved direction

Make the desktop utility feel familiar to someone using Discord Quests: recognizable cards,
clear places for active work and rewards, and a quieter connection/recovery experience.
The user approved these decisions during the visual study:

- Use a sidebar workspace with Ongoing, Available, and Completed views.
- Apply Discord-style colors, typography, and controls throughout the app.
- Display **Discord Auto Quest** in the title bar and sidebar.
- Keep the original quest-badge logo shown below.
- Use explicit handoff labels, including **Accept in Discord** and **Claim in Discord**.
- Add restrained motion using the project's animation guidance.

![Approved original quest badge](assets/ui-redesign/quest-badge.svg)

The goal is faithful card structure and behavior, with explicit adaptations for this utility's
boundaries. The app keeps its own identity and unaffiliation notice. The product constraints in
[PRODUCT.md](../../../PRODUCT.md) remain authoritative.

This spec describes the intended replacement for the current two-register interface and teal
design documented in [DESIGN.md](../../../DESIGN.md). Those documents describe today's UI;
they must be reconciled with the implemented result when the redesign ships.

## Workspace

Use a 224 px sidebar beneath the existing desktop title bar. Its brand block holds the approved
logo and name. Below it, three navigation items have distinct icons, labels, live counts, and a
clear selected background. Ongoing is the initial view. No extra overview dashboard or statistics
cards are needed.

The main pane has a persistent header with the current view name and one global **Work my
quests** / **Stop** control. The mechanism works accepted quests globally; individual cards must
not imply a separate per-quest runner or identify an active quest without backend evidence.
Starting and stopping show a pending state until the backend responds and prevent duplicate clicks.

Below the header, show a short view description, a labeled search field, and the card grid.
Search matches quest name, game title, and publisher within the selected view. Retain each view's
search and scroll position during the session. Counts describe the complete view, independent
of search. An empty search result offers Clear search; an empty view explains its next step.
Avoid adding sorting/filter controls in this first redesign.

The sidebar footer holds Discord connection status and a compact About control containing the
version and existing notices. Connection failures expand an actionable message near that status.
Quest-operation errors appear beside the global control. Avoid stacking full-width warning bands
above the cards.

### Responsive rules

- Main content padding: 24 px; card gap: 16 px. Card width stays between roughly 360 and 440 px.
- At a 1200 px window, show two columns; at 1600 px, show three. At 880 px, show one readable column.
- Do not stretch a lone card across the entire main pane. Keep the grid aligned to the left.
- Keep the labeled sidebar at these supported desktop sizes. At narrower sizes, let the grid
  become one column without clipping controls; do not introduce a second navigation pattern.
- Honor text scaling: card descriptions and action rows can grow. A longer handoff label must
  wrap or use a full-width row rather than shrink to illegible text.

## State and navigation

Derive one view model from each successful live read. Navigation counts, card variants, reward
messages, and available actions must use that same model.

| View | Membership | Order |
| --- | --- | --- |
| Ongoing | Accepted and not completed | Unexpired first, earliest quest end first; expired entries last |
| Available | Not accepted, not completed, and not expired | Earliest quest end first |
| Completed | Discord reports completion, whether or not the reward was claimed | Claimable first, then other completed entries; newest completion first within each group |

Use quest ID as a stable tie-breaker. Accepted-but-expired quests remain visible in Ongoing with
an Expired state and disabled work-related actions; they are never relabeled Completed. A
completed quest stays Completed after a reward expires. Claimability uses Discord's reward
deadline/status when available; a quest's participation deadline alone is not proof of the
reward deadline. Unknown claimability displays **Check in Discord**.

The existing wire value `claimed` means enrolled/accepted. It must not be interpreted as reward
claimed. The new model separates acceptance, completion, reward claim, and expiry. A missing
claim timestamp can mean unclaimed only when that field was read successfully from a supported
client shape; unavailable data stays unknown.

Completed cards distinguish:

- **Ready to claim:** confirmed completion, reward not claimed, and confirmed claim window open.
- **Claimed:** confirmed reward claim; show the observed claim date and reward actually received
  when available.
- **Reward expired:** confirmed unclaimed reward with a closed claim window.
- **Check in Discord:** completion is known but claim state or eligibility is unavailable.

## Quest cards

Use the six user-provided references as the visual baseline, supplemented by the inspected live
client. Screenshots are design evidence only; production cards are accessible components with
live data, never flattened screenshots or a bundled sample catalogue.

| Reference | Important state |
| --- | --- |
| [Royal Match](assets/ui-redesign/royal-match.png) | Available video; reward artwork; two actions |
| [EA SPORTS FC 27](assets/ui-redesign/fc27.png) | Available game; linked game name and reward |
| [Clean Crew](assets/ui-redesign/clean-crew.png) | Accepted game; circular reward treatment |
| [Endfield](assets/ui-redesign/endfield.png) | Accepted at zero progress; platform control |
| [Topaz](assets/ui-redesign/topaz.png) | Accepted video at zero progress; video action |
| [MapleStory](assets/ui-redesign/maplestory.png) | Completed and claimed; green ring and claim date |

### Anatomy and visual tokens

Preserve the native hierarchy: hero media with a bottom scrim, game wordmark, publisher and
verification marker, end date, reward image/progress ring, compact uppercase quest title,
reward line and boost pill, description, and a separated action footer. Use the quest's reward
artwork rather than substituting the game tile. Non-Orbs rewards must keep their own image and
label. Show verification and boost only when supported by the data.

Observed native dimensions provide the starting point, not a fixed screenshot canvas:

| Element | Reference measurement |
| --- | --- |
| Typical card | About 411 px wide and 316 px high; height varies with content |
| Outer treatment | 10 px corner radius; subtle 1 px border |
| Hero region | About 145 px high at that width; top inner corners 8 px |
| Footer actions | 40 px minimum height; 8 px radius and gap; 12 px horizontal inset |
| Media action circles | 24 px visual size; larger accessible hit area where space permits |
| Publisher / date | 14 px, weight 500, 18 px line height |
| Quest title | 12 px, weight 700, 16 px line height, 0.24 px tracking |
| Reward | 16 px, weight 600, 20 px line height |
| Description / boost | 12 px, weights 500 / 600, 16 px line height |
| Action label | 16 px, weight 500, 20 px line height |

Use neutral dark surfaces, a slightly lighter sidebar/header, restrained separators, white
primary text, muted secondary text, and Discord blurple `#5865F2` for primary controls and
selection. Sample the exact neutral tokens during implementation rather than applying an old
Discord palette by assumption. Reserve green for confirmed success/claimed states and red for
actionable errors. The app brand uses the approved original logo, not Discord's logo.

The inspected font stack is `gg sans`, `Noto Sans`, `Helvetica Neue`, Helvetica, Arial,
sans-serif. Before bundling a font, validate its distribution source and permitted use. If gg
sans cannot be supplied, use that fallback stack, document the substitution in DESIGN.md, and
assess wrapping against the references; do not claim exact typography in that case.

### Variants and real actions

| State or control | Result in this app |
| --- | --- |
| Available quest primary | **Accept in Discord** opens the relevant Discord destination; never accepts it here |
| Accepted video primary | **Watch in Discord**; preserve the native duration when known |
| Accepted game/platform | Show accepted/progress state; any platform change continues in Discord |
| Confirmed claimable reward | **Claim in Discord**; never invokes a claim request |
| Already claimed | **View reward in Discord** |
| Unknown reward status | **Check in Discord** |
| Download / Get Game / Get Offer / Play Now | Open the real supplied destination only after the user clicks |
| Boost or media preview | Continue in Discord when a supported destination exists; do not fake a purchase or video player |

Accepted quests show a circular progress treatment even at **0%**. Calculate progress from a
coherent task/target pair and preserve its unit. Never combine the maximum progress from one
task with the target of another or label achievements as seconds. If a platform-specific task
selection is unknown, show its requirements and an explicit handoff instead of inventing a
selected platform. Partial progress never implies completion; only Discord's completion record
changes the card to Completed.

The ellipsis opens one anchored menu. Native inspection found a 220 px menu with 36 px items,
8 px radius, and a subtle shadow. Provide only supported actions: the quest's external CTA,
**Copy quest link**, and **Open in Discord**. Native Share copies a link; this app's clearer label
does the same and shows a brief copied confirmation. Do not reproduce ad-preference controls
that the app cannot support. No message is sent.

Public share links were verified as `https://discord.com/quests/<id>`. A share URL is not proof
of a desktop deep link. Validate desktop routing before implementing handoff actions. If the
client cannot route directly to a quest, open its Quests view with a visible instruction naming
the quest; never silently treat the web browser as the completion client. Failed handoffs must
report a recoverable error.

These explicit labels and handoffs are deliberate differences from native Discord. Match the
reference composition, imagery, progress, and visual interaction states around those differences.

## Data and component boundaries

Keep the existing Rust/Tauri/CDP mechanism. The reader remains read-only and shape-based. Expand
its summary with the acceptance/completion/reward-claim timestamps and claimability evidence,
reward artwork and type, publisher verification, relevant media, and task/platform/unit details
needed by the card. Audit which fields are actually present before mapping them. Optional fields
have explicit unknown/fallback states rather than fabricated values.

Use a normalized quest model shared by view membership and presentation. Keep the shell,
navigation, quest grid, quest card, card actions, and connection status as focused components.
Update the TypeScript and Rust boundary together, with fixtures covering absent and unfamiliar
fields. Do not modify or rebuild the encrypted completion payload for this redesign.

Replace the current reward prompt that treats every completed quest as awaiting claim. A claimed
reward must not keep prompting the user. Preserve the restart/attach recovery fix and the
backend's authority over operation state.

## Loading, recovery, and accessibility

- Before the first successful read, show card skeletons and unknown counts, not misleading zeros.
- On a later failed read, retain the last successful in-memory view, visibly mark it stale, and
  disable actions that depend on a live connection. Do not persist a quest cache.
- Distinguish Discord closed, restart needed, connecting, connected, and failed. Restart remains
  a deliberate **Restart Discord** action explaining the interruption; never restart automatically.
- Retry through the existing polling/reconnect flow. Clear resolved errors when recovery is
  confirmed; dismissing an error is not evidence of recovery.
- Keep cards keyed by quest ID. Polling must preserve view/search state, scroll, focus, and an
  open menu while its quest still exists. If an action disappears, restore focus to a sensible
  surviving control. Do not reset the grid every four seconds.
- Support keyboard navigation, visible focus, descriptive icon labels, and a real search label.
  Menus support Escape, focus return, and arrow-key navigation; only one opens at a time.
- Announce user-triggered results and meaningful connection/completion changes politely. Do not
  announce every poll or percentage tick. Text and icons supplement status colors.
- Media failures preserve card dimensions and readable text, with a neutral fallback. Missing
  logos, long names, non-Orbs rewards, and unavailable dates must not break the card.

## Motion

Use CSS for these transitions; a motion dependency is unnecessary for this scope. Follow the
project's animate guidance and use `cubic-bezier(0.23, 1, 0.32, 1)` for short ease-out interactions.

| Interaction | Motion |
| --- | --- |
| Pointer button press | Scale to 0.97 and return over about 160 ms |
| Menu/popover | Opacity and scale from 0.95 over 200 ms, originating at its trigger |
| Tooltip | Short 125 ms fade |
| Confirmed state change | Short opacity/color change; progress reflects observed data |
| Keyboard navigation | Immediate selection and focus; no delayed view transition |

No card hover lift, decorative looping effects, fake progress interpolation, polling-driven
entrances, or staggered card reloads. Rapid repeated interaction interrupts cleanly. With
reduced motion enabled, remove movement/scaling and retain immediate state or a subtle fade.

## Verification and delivery

The implementation plan should sequence the work as follows:

1. Resolve reader/media/task gaps, font sourcing, and tested desktop handoffs against live
   read-only evidence. Keep controlled fixtures for variants absent from the current account.
2. Build the shell, branding, view derivation, and responsive grid.
3. Implement faithful accessible card variants and supported actions.
4. Integrate connection/operation recovery and restrained motion.
5. Compare screenshots, run applicable suites, update DESIGN.md/current documentation, and ship
   through the repository's branch, CI, merge, and roadmap workflow.

Acceptance requires:

- Counts and membership agree with the live source; completed and reward-claimed are distinct.
  Expiry boundaries and unavailable claim evidence have meaningful coverage.
- Zero-progress, partial-progress, claimed, claimable, expired, and non-Orbs fixtures render
  correctly. Task units and alternative platforms cannot produce mismatched percentages.
- Accept/claim controls only hand off; menu Copy quest link only copies. Work/Stop remains global.
- The six reference variants compare well at 880, 1200, and 1600 px, including long text and media
  failure. Explicit label differences and any font substitution are recorded.
- Keyboard menus, focus restoration, text scaling, reduced motion, and repeated polling behave
  without jumps or repeated announcements.
- Discord disconnect/reconnect and explicit restart recovery preserve honest state and actionable
  controls. No new automatic restart, reward claim, quest acceptance, or runtime file cache exists.
- Applicable frontend and reader tests, type checking, production build, and required CI pass.
  A read-only live check confirms cards against Discord; completion/claim demonstrations need
  separate user action and must not be silently performed for visual verification.

The live inspection covered native card layout, font metrics, a menu, and Share copying a link.
It did not verify a currently unclaimed completed reward, platform switching, or a desktop deep
link. Those limitations define the targeted evidence needed above. This UI work does not by
itself close the roadmap's unverified real video-completion or fresh accept-and-work cases.
