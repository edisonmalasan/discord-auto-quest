---
name: discord-auto-quest
description: A Discord-style workspace for live desktop quests, with its own original identity.
colors:
  ground: "#121214"
  surface: "#1a1a1e"
  card: "#232327"
  rule: "#323237"
  ink: "#f2f3f5"
  ink-secondary: "#b5b7bf"
  ink-tertiary: "#94959e"
  spot: "#5865f2"
  success: "#43b581"
  danger: "#fa777c"
typography:
  sans: "'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif"
layout:
  sidebar: "224px"
  content-inset: "24px"
  card-gap: "16px"
  card-width: "360–440px at supported desktop sizes"
rounded:
  card: "10px"
  control: "8px"
---

# Discord Auto Quest design system

The app uses a familiar Discord quest-card composition within a persistent sidebar workspace.
Its original quest-badge logo and **Discord Auto Quest** display name identify it as an independent
utility. The About disclosure retains the backend version, MIT notice, and unaffiliation statement.
This system replaces the earlier teal/Archivo interface.

## Workspace

Ongoing, Available, and Completed are separate views with live, search-independent counts.
Ongoing opens first. Each view retains its search and scroll position during the session.
The main header owns one global Work my quests / Stop control; cards do not imply a per-quest runner.
Connection and recovery controls live in the sidebar footer. Operation errors stay beside Work/Stop.

The grid shows one, two, and three columns at 880, 1200, and 1600 px respectively. A lone card
stays compact and left-aligned. Content and footers grow for longer labels and text scaling;
hero wordmarks and publisher rows remain in normal flow to avoid overlapping at narrow widths.
The development-only visual fixture entry is not part of the production build.

## Card anatomy and type

Cards use hero artwork, a neutral scrim, a wordmark, publisher/end date, reward art/progress,
a compact quest title, reward and boost, description, and a separated action footer.
The publisher/date use 14/18 px type, the uppercase quest title 12/16 px at weight 700,
the reward 16/20 px at weight 600, and descriptions 12/16 px. Footer controls use 16/20 px
at weight 500 and a minimum 40 px height. These sizes follow inspected native card measurements.

The font stack begins with gg sans when locally available. No redistributable gg sans source
was established, so no proprietary font binary is bundled; the remaining system-font stack is
the supported fallback. Typography and wrapping therefore have a deliberate fidelity limit.

Quest media is read at runtime. Still hero artwork is displayed in the card; previews continue
in Discord. Missing media preserves dimensions and readable text. Game tiles are never used as
reward artwork. Orbs use an original blue reward illustration when the record supplies no image;
other rewards use observed artwork or an explicit neutral fallback. Publisher verification and
selected platform are not invented when unavailable. The boost pill is informational.

## Honest states and actions

The normalized model in `src/lib/quest-view.ts` drives counts, membership, ordering, progress,
and actions. Accepted-but-expired entries remain in Ongoing as expired. Discord's completion
record alone moves a quest to Completed. Claimable, claimed, expired rewards, and unknown reward
status are distinct; participation expiry is not treated as the reward deadline.

An accepted quest with a coherent task shows a progress ring even at zero. Alternative tasks
keep their values and targets paired; ambiguous platform selection shows requirements rather
than an invented percentage. Counts and seconds remain distinct. Streaming/activity cards retain
their voice-channel requirements.

Accept in Discord, Watch in Discord, Claim in Discord, and View reward in Discord are explicit
handoffs. The verified desktop route opens Quests and a visible instruction names the quest to
select; a direct desktop quest route was not supported in the inspected client. External CTA
buttons open supported HTTPS destinations and report failures. They never accept or claim here.
Copy quest link only copies the public quest URL. One anchored menu opens at a time, with arrow
navigation, Escape/outside dismissal, and keyboard focus restoration. Unsupported account/ad-setting
controls are not simulated.

## Recovery and motion

Initial reads show skeletons and unknown counts. Failed later reads retain the last in-memory
feed with a stale notice and disabled live-dependent actions. Connection errors clear on confirmed
recovery; failed operation messages survive unrelated polls. Restart remains a deliberate action.
Read generations ignore obsolete responses, duplicate operations are guarded, and stalled reads
release the connection after ten seconds so later polls can reconnect. Work and Stop replies
have the same bound. Once Work may have reached the renderer, an unconfirmed outcome keeps
Stop available and blocks another Work until Stop or a deliberate restart succeeds. A transport
timeout does not cancel renderer activity; the interface never reports that it did.

Pointer presses scale to 0.97 over 160 ms. Pointer-opened menus enter with opacity and scale from
0.95 over 200 ms, anchored at the trigger, using `cubic-bezier(0.23, 1, 0.32, 1)`. Keyboard-opened
menus and navigation are immediate. Reduced motion removes transforms/transitions. There are
no card hover lifts, looping decorations, interpolated progress, or poll-driven entrance effects.

The [approved design](docs/superpowers/specs/2026-10-23-ui-redesign-design.md) retains the visual
references and intended behavior; the [roadmap](docs/ROADMAP.md) records verified progress.

Two minor review follow-ups remain: native CSP currently falls back for artwork served only
by media.discordapp.net, and outside menu dismissal onto non-focusable background can lose
keyboard focus. Escape and menu actions restore trigger focus.
