# Discord Auto Quest UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved sidebar workspace with faithful Discord quest cards, honest live
states, explicit Discord handoffs, and restrained motion.

**Architecture:** Preserve the Rust reader/CDP driver and expand the read-only quest summary.
Normalize each live feed once into a presentation model shared by cards and navigation. Keep
connection/operation state in the existing controller and isolate shell, cards, and handoff actions.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind CSS 4, Vite 8, Tauri 2, Rust, Vitest and
Testing Library. Use CSS motion; no animation dependency. Use the existing opener integration.

**Spec:** [Approved UI design](../specs/2026-10-23-ui-redesign-design.md). Read it together with
[PRODUCT.md](../../../PRODUCT.md) before executing.

**Status:** Awaiting implementation-plan review and execution-method selection. This document
does not authorize starting the implementation before that review.

## Global Constraints

- Display **Discord Auto Quest** in the title bar and sidebar.
- Use a 224 px sidebar beneath the existing desktop title bar.
- Main content padding: 24 px; card gap: 16 px. Card width stays between roughly 360 and 440 px.
- At a 1200 px window, show two columns; at 1600 px, show three. At 880 px, show one readable column.
- Use explicit handoff labels, including **Accept in Discord** and **Claim in Discord**.
- The existing wire value `claimed` means enrolled/accepted. It must not be interpreted as reward claimed.
- Partial progress never implies completion; only Discord's completion record changes the card to Completed.
- Do not modify or rebuild the encrypted completion payload for this redesign.
- Restart remains a deliberate **Restart Discord** action explaining the interruption; never restart automatically.
- No new automatic restart, reward claim, quest acceptance, or runtime file cache exists.
- Keep the reader shape-based and the single Work/Stop control global. Preserve the restart race fix.
- No fixtures or reference screenshots in the shipped frontend; no raw account dumps in Git.
- Font source and desktop routing must be verified, with the spec's explicit fallback behavior.

## Review Focus

1. Mixed task units/alternative platforms: no percentage built from unrelated tasks (Tasks 1–2).
2. Missing claim evidence or a participation deadline preceding a reward deadline: no false Claim action (Tasks 1–2).
3. A read/action response arriving after a newer connection generation: no stale overwrite or duplicate run (Task 6).
4. A menu's quest moves view or disappears during polling: close safely and restore focus (Tasks 4–6).
5. Failed external media/clipboard/deep links and long translated text: readable cards and honest recovery (Tasks 3–5).

## File map and shared contracts

Existing boundaries stay in place. Create these focused units rather than putting every state in App.tsx:

| File | Responsibility |
| --- | --- |
| `src-tauri/src/quest/reader.rs` | Read-only summary and Rust serialization |
| `src/types/quests.ts` | Matching wire types |
| `scripts/quest-reader.test.mjs` | Execute the actual reader expression against synthetic client stores |
| `src/test/fixtures/quests.ts` | Shared synthetic frontend fixtures; test imports only |
| `src/lib/quest-view.ts` | Membership, sorting, reward state, coherent progress, search |
| `src/lib/quest-actions.ts` | Public links, desktop handoff, external URL and copy operations |
| `src/components/QuestWorkspace.tsx` | Navigation, search, per-view scroll and menu ownership |
| `src/components/ConnectionStatus.tsx` | Connection/recovery copy and deliberate restart action |
| `src/components/QuestCard.tsx` | Card layout and accessible state variants |
| `src/components/QuestActions.tsx` | State-specific footer and anchored menu |
| `src/components/QuestProgress.tsx` | Reward art and progress ring |
| `src/components/AboutPopover.tsx` | Compact About control and existing notices |
| `src/App.tsx` | Compose controller and workspace; one Work/Stop control |
| `src/index.css` | Neutral tokens, layout, card details, focus and motion |

New wire fields on `QuestSummary` (camelCase JSON, snake_case Rust fields):

```ts
interface QuestTaskSummary {
  kind: string;
  value: number | null;
  target: number | null;
  unit: 'seconds' | 'count' | 'unknown';
  platform: string | null;
}
// Add to existing QuestSummary; keep existing fields for existing consumers.
// Default new optional observations to null/unknown/[] when unsupported.
enrolledAt: string | null;
completedAt: string | null;
rewardClaimedAt: string | null;
rewardClaimState: 'unknown' | 'unclaimed' | 'claimed';
rewardClaimable: boolean | null;
rewardExpiresAt: string | null;
claimedRewardOrbs: number | null;
rewardImage: string | null;
rewardType: string | null;
publisherVerified: boolean | null;
heroVideo: string | null;
selectedTaskKind: string | null;
taskDetails: QuestTaskSummary[];
```

`rewardClaimable` is an observed or evidence-backed result, never a guess based on quest end.
If the client has no reliable claim window/status field, keep it null. Selected task and
verification likewise stay null when unsupported. Record source mapping evidence only under
ignored `re/`, with sanitized semantic conclusions in tracked docs.

Presentation contracts in `src/lib/quest-view.ts`:

```ts
type QuestView = 'ongoing' | 'available' | 'completed';
type RewardState = 'incomplete' | 'claimable' | 'claimed' | 'expired' | 'unknown';
interface QuestCardModel {
  quest: QuestSummary;
  view: QuestView;
  expired: boolean;
  rewardState: RewardState;
  progress: { value: number; target: number; percent: number;
              unit: 'seconds' | 'count'; taskKind: string } | null;
}
type QuestViews = Record<QuestView, QuestCardModel[]>;
function buildQuestViews(feed: QuestFeed, now: number): QuestViews;
function searchQuests(cards: QuestCardModel[], query: string): QuestCardModel[];
```

Use an observed selected task when valid, otherwise the sole valid task. For ambiguous
alternatives show requirements without an aggregate percentage. Do not infer completion from
100%. Invalid/non-finite/negative progress values cannot create a valid percentage; cap valid
displayed percentages at 100. `expiresAt <= now` is expired; missing/invalid dates stay unknown.

## Task 1: Expand the read-only data contract

**Files:** Modify `src-tauri/src/quest/reader.rs`, `src/types/quests.ts`; create
`scripts/quest-reader.test.mjs`, `src/test/fixtures/quests.ts`; update existing test factories in
`src/App.test.tsx` and `src/lib/quests.test.ts` for the new fields.

**Interfaces:** Consumes the current `QuestList`/`QuestFeed`; produces the added wire fields
above, using serde defaults so old minimal summaries still deserialize.

- [x] **Step 1: Audit missing observations, without changing account state.** Inspect reward
  artwork, verification, claim window/status, selected platform/task and task units in the live
  desktop client. Read the approved spec's references. Record sanitized field availability and
  mappings under ignored `re/`; do not run the completion script, restart, accept, watch or claim.
  A missing supported observation resolves to the explicit unknown field above.
- [x] **Step 2: Write failing extraction tests.** In the `.mjs` test, read `reader.rs`, extract its
  actual `READ_STATE` raw string, and evaluate it using Node's VM with synthetic webpack module
  exports, quest stores, and DiscordNative. Exercise renamed exports through shape discovery.
  Pin these independent inputs/assertions:

  ```js
  expect(completedWithoutClaimEvidence.rewardClaimState).toBe('unknown');
  expect(claimed.rewardClaimState).toBe('claimed');
  expect(claimed.rewardClaimedAt).toBe('2026-10-22T12:00:00Z');
  expect(achievement.taskDetails[0].unit).toBe('count');
  expect(alternatives.taskDetails.map(t => [t.value, t.target])).toEqual([[100, 900], [20, 60]]);
  expect(missingMedia.rewardImage).toBeNull();
  expect(unverifiedPublisher.publisherVerified).toBeNull();
  ```

  Include known-unclaimed versus unavailable claim data, expired participation with an open
  reward window, zero progress, unknown task types, non-Orbs rewards, PLACEHOLDER artwork,
  and malformed optional values. Add Rust deserialization assertions for old and new summaries.
- [x] **Step 3: Run the new tests and confirm failures reflect missing behavior.**
  `npm test -- scripts/quest-reader.test.mjs` and
  `cargo test --manifest-path src-tauri/Cargo.toml quest::reader::tests -j 1`.
- [x] **Step 4: Implement the new fields and synthetic fixture factory.** Define
  `makeQuest(overrides: Partial<QuestSummary> = {}): QuestSummary` and
  `makeFeed(overrides: Partial<QuestFeed> = {}): QuestFeed` in the test fixture module.
  Preserve legacy fields until their consumers migrate; if supplying legacy seconds, derive
  them from one coherent seconds task, not independent maxima. Do not edit driver/payload.
- [x] **Step 5: Run the targeted tests and `npm run typecheck`; require all to pass.**
- [x] **Step 6: Commit the reader contract and tests.** Message:
  `feat(quests): expose reward claim and task observations`.

## Task 2: Normalize cards, counts, and sorting

**Files:** Create `src/lib/quest-view.ts`, `src/lib/quest-view.test.ts`; modify
`src/lib/quests.ts`, `src/lib/quests.test.ts`.

**Interfaces:** Consumes Task 1 wire fields and fixture factories; produces `buildQuestViews`
and `searchQuests` using the contracts above. Existing `taskLabel`, `duration`, and date helpers
can remain; remove the old false awaiting-claim inference when its consumers migrate.

- [x] **Step 1: Write failing model tests with a fixed `now`.** Assert:

  ```ts
  expect(views.ongoing.map(c => c.quest.id)).toEqual(['active', 'expired-accepted']);
  expect(views.available.map(c => c.quest.id)).toEqual(['available']);
  expect(views.completed.map(c => c.rewardState)).toEqual(['claimable', 'claimed', 'unknown']);
  expect(zero.progress?.percent).toBe(0);
  expect(ambiguousAlternatives.progress).toBeNull();
  expect(completedWithUnknownClaim.rewardState).toBe('unknown');
  expect(searchQuests(views.available, 'STUDIO')).toHaveLength(1);
  ```

  Cover the exact expiry boundary, invalid/missing dates, expired participation with confirmed
  open claimability, actual reward expiry, claimed reward despite a stale claimable flag,
  count-unit tasks, 100% without completion, negative/non-finite values, stable ID tie-breaks,
  and case-insensitive matching across all three search fields. Deduplicate by ID, preferring
  the accepted/completed record if both feed arrays contain it.
- [x] **Step 2: Run `npm test -- src/lib/quest-view.test.ts`; confirm the expected failure.**
- [x] **Step 3: Implement the two exported functions.** Apply spec ordering; classify completion
  before expiry. A claimed timestamp/state wins over claimability, then confirmed claimability,
  then confirmed closed reward window, otherwise unknown. Search does not change source counts.
  Filter `awaitingUser` to unfinished, unexpired accepted quests; make `awaitingClaim` select
  only confirmed claimable cards or remove it after Task 3 switches to this model.
- [x] **Step 4: Run both quest helper suites; require passing assertions.**
  `npm test -- src/lib/quest-view.test.ts src/lib/quests.test.ts`.
- [x] **Step 5: Commit.** Message: `feat(quests): derive honest quest views and reward states`.

## Task 3: Build the branded sidebar workspace

**Files:** Create `src/components/QuestWorkspace.tsx`, `src/components/AboutPopover.tsx`;
modify `src/App.tsx`, `src/App.test.tsx`, `src/components/QuestIndex.tsx`,
`src/components/AppMark.tsx`, `src/components/Colophon.tsx`, `src/components/Colophon.test.tsx`,
`src/index.css`, `src-tauri/tauri.conf.json`, `index.html`, and `src-tauri/icons/*`;
create `public/quest-badge.svg` from the approved asset.

**Interfaces:** `QuestWorkspace({ views, loading, stale, controls, connection }: Props)` consumes
`QuestViews`, booleans and ReactNode slots for the header control and connection footer. It owns
selected `QuestView`, per-view search/scroll, and `openMenuQuestId: string | null` for later cards.
`QuestIndex({ cards, stale, openMenuQuestId, onMenuChange }: Props)` renders stable ID keys.

- [ ] **Step 1: Write failing workspace interaction tests.** Using `App.test.tsx` and mocked IPC,
  assert the default Ongoing view, three navigation labels/counts, per-view search retention,
  counts unaffected by search, no-result Clear search, empty-state copy, and a single global
  Work/Stop control. About exposes the backend version and existing MIT/unaffiliation text.
  Assert initial unknown counts/skeletons rather than zero quests.
- [ ] **Step 2: Run `npm test -- src/App.test.tsx src/components/Colophon.test.tsx`; confirm failure.**
- [ ] **Step 3: Resolve the font source.** Use the inspected font stack. Bundle gg sans only with
  a validated distributable source; otherwise use the approved fallback and record that choice
  in DESIGN.md. Do not add a dependency on a hashed Discord font URL or load a proprietary font
  from the user's Discord installation at runtime.
- [ ] **Step 4: Implement shell and tokens.** Use 224 px sidebar, 24 px content inset, 16 px grid
  gap, 360–440 px cards, native-style neutrals sampled from the read-only reference, and blurple
  `#5865F2`. Put the selection/search/scroll state in the workspace; use a stable scroll container
  and layout restoration per view, without remounting it on polls. Implement About as an
  accessible disclosure/popover with Escape and focus return. Reuse existing notice content.
- [ ] **Step 5: Apply the approved identity to desktop assets.** Copy the original SVG to public,
  reference it from AppMark and favicon, and generate native icons with the installed Tauri CLI
  icon command from that SVG. Set window title and product display name to Discord Auto Quest;
  preserve crate/package names, executable names, identifier, and version wiring. Verify release
  scripts still locate the executable and generated icons exist. Do not paint custom OS window
  controls inside the webview.
- [ ] **Step 6: Run the targeted tests, `npm run typecheck`, and `npm run build`; require success.**
  Inspect 880/1200/1600 px layouts in the browser: 1/2/3 columns, no horizontal clipping, readable
  labels at 200% text scaling. Leave reference fixtures out of production entry imports.
- [ ] **Step 7: Commit.** Message: `feat(ui): add branded sidebar quest workspace`.

## Task 4: Rebuild native-style card variants

**Files:** Modify `src/components/QuestCard.tsx`, `src/index.css`; create
`src/components/QuestProgress.tsx`, `src/components/QuestActions.tsx`,
`src/components/QuestCard.test.tsx`, `src/test/preview.html`, `src/test/preview.tsx`;
update workspace/index props as needed within the contract.

**Interfaces:** `QuestCard({ card, stale, menuOpen, onMenuChange }: Props)` consumes one
`QuestCardModel`; `QuestProgress({ card }: { card: QuestCardModel })` renders art/progress.
`QuestActions` initially consumes the same card/stale/menu props and named callbacks for
`onDiscord`, `onExternal`, and `onCopy`; Task 5 supplies real callbacks. All action failures are
displayed accessibly within the card, not swallowed.

- [ ] **Step 1: Write failing semantic card tests.** Assert 0% has a progressbar, accepted count
  progress has the correct unit, claimed cards show observed claim date/actual reward quantity,
  unknown claim evidence has Check in Discord, and unclaimed/claimable cards say Claim in Discord.
  Assert reward art differs from the game tile, non-Orbs rewards retain labels/art, verification
  is absent when unknown, and long text remains in the accessibility tree.
- [ ] **Step 2: Run `npm test -- src/components/QuestCard.test.tsx`; confirm missing-variant failures.**
- [ ] **Step 3: Implement the anatomy and footer variants from the spec.** Use hero/scrim/wordmark,
  publisher/date, 12/16 px title/reward hierarchy, progress art, boost pill only with evidence,
  and 40 px footer controls. Accepted game quests show accepted state and explicit platform
  handoff; video cards show Watch in Discord with known duration. Expired entries disable
  work-related actions. Do not render fake dropdown choices or a local video player.
- [ ] **Step 4: Implement accessible media fallbacks.** Invalid/failed banner, logo or reward art
  gets a dimension-preserving neutral fallback; logo failure shows game/quest text. No game-tile
  substitution for missing reward art. Unknown selected task lists requirements without a fake
  percentage/platform. Unknown dates use a neutral unavailable label.
- [ ] **Step 5: Run card tests and the full frontend suite.** Compare six reference states at
  card width about 411 px using a test-only fixture render. Make `src/test/preview.html` a separate
  Vite development entry whose `preview.tsx` renders the real workspace/cards with synthetic
  fixtures and disabled mechanism controls. Open that path on the actual Vite dev port; do not
  link/import it from the app entry or put it in public. Confirm the production build emits
  neither that entry nor its fixtures. Save visual evidence outside the production public
  directory. Record explicit action-label/font differences, and fix unintended crop, spacing,
  typography or wrapping differences.
- [ ] **Step 6: Commit.** Message: `feat(ui): reproduce quest card states and reward presentation`.

## Task 5: Wire handoffs, clipboard, and anchored menus

**Files:** Create `src/lib/quest-actions.ts`, `src/lib/quest-actions.test.ts`,
`src/components/QuestActions.test.tsx`; modify `src/components/QuestActions.tsx` and
`src/components/QuestWorkspace.tsx`. Modify capability/CSP configuration only for an observed
required destination and keep the existing URL permission scope no wider than necessary.

**Interfaces:** Export `questShareUrl(id: string): string`,
`openQuestInDiscord(id: string): Promise<{ instruction: string | null }>`,
`openQuestExternal(url: string): Promise<void>`, and `copyQuestLink(id: string): Promise<void>`.
Only accept numeric quest IDs for constructed links. Use the existing opener for navigation
and `navigator.clipboard.writeText` for copying, with propagated errors and no false confirmation.

- [ ] **Step 1: Verify routing read-only.** Inspect the installed desktop client's route handling,
  then test the supported OS protocol to a known quest without accepting/watching/claiming it.
  If direct routing fails, verify routing to the Quests view and return an instruction naming
  the quest from the card. Do not hard-code an untested scheme from the public share URL.
  If neither desktop route can be verified, report that limitation and continue independent UI
  tasks; do not mark this task complete or silently fall back to a web completion client.
- [ ] **Step 2: Write failing action tests.** Mock opener/clipboard; assert the exact public link
  `https://discord.com/quests/123`, reject invalid IDs and unsupported external URL schemes,
  propagate protocol/clipboard failures, and announce Copied only after fulfillment. HTTP(S)
  external destinations require parseable URLs; no executable or JavaScript destinations.
  Handoff tests assert only opener calls and never run/accept/claim requests.
- [ ] **Step 3: Run `npm test -- src/lib/quest-actions.test.ts`; confirm failures.**
- [ ] **Step 4: Implement the helpers and connect state-specific actions.** Use the observed
  desktop route, exact explicit labels, real external CTA, and per-card pending/error handling.
  Any fallback instruction must name the quest and the next user step. Preview/boost/platform
  actions continue in Discord; unsupported actions are omitted rather than simulated.
- [ ] **Step 5: Write and run menu interaction tests, then implement the menu.** One 220 px
  anchored menu at a time; external CTA when present, Copy quest link, Open in Discord. Use native
  buttons with menu/menuitem semantics, roving focus, Arrow/Home/End, Escape, outside-click
  dismissal and trigger focus restoration. Own the active ID in the workspace. Test opening a
  second menu closes the first; removing/moving its quest closes it and focuses the surviving
  view heading; same-ID refresh preserves it. Run
  `npm test -- src/components/QuestActions.test.tsx src/lib/quest-actions.test.ts` to green.
- [ ] **Step 6: Verify desktop opener and clipboard behavior in the Tauri window.** Confirm
  Copy quest link changes only the clipboard; no message/share dialog is sent. Verify failures
  remain actionable. No Discord restart is needed for these checks.
- [ ] **Step 7: Commit.** Message: `feat(ui): add explicit Discord handoffs and quest menus`.

## Task 6: Stabilize connection, operation, and polling behavior

**Files:** Modify `src/hooks/useDiscord.ts`, `src/hooks/useDiscord.test.ts`, `src/App.tsx`,
`src/App.test.tsx`; create `src/components/ConnectionStatus.tsx`,
`src/components/ConnectionStatus.test.tsx`; retire `src/components/DiscordGate.tsx` once all callers migrate.
If distinguishing closed from restart-needed requires new backend evidence, modify the existing
`DiscordStatus` in `src-tauri/src/discord.rs` and `src/types/quests.ts` together, retaining the
existing installed/ready/action/profile fields.

**Interfaces:** Extend `DiscordController` with `stale: boolean`,
`pendingAction: 'restart' | 'work' | 'stop' | null`, `operationError: AppErrorShape | null`, and
`connectionState: 'loading' | 'closed' | 'restart-needed' | 'connecting' | 'connected' | 'failed'`.
Keep existing controller methods. A connected debugger plus a failed quest read is not a fresh
usable feed. If needed, add observed backend `running: boolean` to distinguish closed Discord.

- [ ] **Step 1: Write failing controller tests with deferred promises/fake timers.** Assert a
  later failed read retains the previous feed and marks it stale, recovery clears stale/read
  errors, a late pre-restart read cannot overwrite the new generation, and two same-tick Work
  calls cause one IPC operation. Distinguish action failure from read failure so a successful
  poll cannot erase a failed Stop notification. Retain existing blocked-startup recovery tests.
- [ ] **Step 2: Run `npm test -- src/hooks/useDiscord.test.ts`; confirm the missing behavior fails.**
- [ ] **Step 3: Implement generation/request guards and separate errors.** Serialize reads and
  operations where they share connection state; use an immediate ref guard for action reentry.
  Keep the 4000 ms poll interval, pause while operations are pending, and ignore obsolete replies.
  Set working only after successful Work, unset after successful Stop; do not silently report
  stopped when disconnected and unconfirmed. Preserve a usable Stop/retry path for uncertain
  operation state. Do not turn progress into an inferred active quest.
- [ ] **Step 4: Write UI recovery tests, then integrate ConnectionStatus.** No automatic restart,
  restart interruption text beside its deliberate button, unknown initial counts, stale visible
  data with live-dependent actions disabled, and resolved errors disappearing after confirmed
  recovery. Verify menu/focus/scroll/search survive same-ID polling and removed cards restore
  focus safely. Operation errors stay beside the global control.
- [ ] **Step 5: Run the controller, connection and App suites to green.** If backend status changed,
  add tests proving closed versus running-without-debugger and run Rust tests too. Verify there
  is exactly one global Work/Stop control across all views and repeated clicks are guarded.
- [ ] **Step 6: Commit.** Message: `fix(ui): preserve honest state through polling and recovery`.

## Task 7: Motion, visual acceptance, and delivery

**Files:** Modify `src/index.css`, card/menu controls where pointer state is needed,
`DESIGN.md`, `docs/CONTEXT.md`, `docs/ROADMAP.md`, and this plan's checkboxes; update README only
where current user-facing description changed. Do not mark unverified mechanism cases complete.

**Interfaces:** CSS interaction classes share
`cubic-bezier(0.23, 1, 0.32, 1)`: 160 ms pointer press at scale 0.97; 200 ms menu opacity/scale
from 0.95 with trigger origin; 125 ms tooltip fade. Keyboard navigation is instant.

- [ ] **Step 1: Add the CSS motion with reduced-motion rules.** Remove the old wipe/stamp
  entrances from the quest surface. No card lift, looping effects, stagger on polling, fake
  progress interpolation, or transitions that delay focus. Reduced motion removes transforms.
  Do not add tests that merely repeat CSS constants; inspect real interactions in the browser.
- [ ] **Step 2: Run visual and interaction acceptance in the real browser and Tauri shell.**
  Compare the six reference variants at 880/1200/1600 px; inspect pointer interruption,
  keyboard/menu focus, Escape, reduced motion, long content, 200% text, broken media and repeated
  polling. Confirm 1/2/3 columns and stable scroll. Use fixtures only through test tooling, never
  a shipped demo/debug route. Save screenshots outside shipped assets and report discrepancies.
- [ ] **Step 3: Run final code checks and resolve failures.**

  ```text
  npm test
  npm run typecheck
  npm run build
  npm run check:acceptance
  cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
  cargo test --manifest-path src-tauri/Cargo.toml -j 1
  cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
  git diff --check
  ```

  Expected: all commands exit 0. Run ignored browser/CDP tests when the browser runtime is
  available and report skipped/unavailable honestly. For packaging/metadata changes build the
  native app and run `npm run check:payload -- <built-executable-path>` against its actual output.
  Do not weaken size/notices/payload checks to accommodate test data or accidental dependencies.
- [ ] **Step 4: Verify against live Discord without account mutations.** Compare actual accepted,
  available/completed states and counts with the client. If it is unreachable, report the
  limitation; restart requires a new explicit user request. Do not invoke `npm run verify`
  or Work merely to check visual fidelity: those can execute the completion mechanism.
- [ ] **Step 5: Update authoritative docs and review the whole diff.** Describe implemented
  tokens/components, font substitution if any, supported handoffs, and known limitations in
  DESIGN.md. Route CONTEXT.md to that current source. Mark roadmap UI outcomes only as proved;
  retain N3/fresh accept-and-work as unverified unless separately demonstrated. Perform a fresh
  whole-branch review using the selected execution workflow; resolve material findings.
- [ ] **Step 6: Commit/push and merge verified work.** Use scoped staging and a UI completion
  commit, create/attach a PR, wait for required CI/branch protections, and merge without force.
  Keep the roadmap accurate in the merged change. Do not publish a release/tag unless requested.
  Refresh an existing relevant Graphify graph after structural changes using its installed
  workflow; do not install Graphify or edit curated vault notes as a side effect.
- [ ] **Step 7: Report the result.** Link the merged change, show a final UI screenshot, summarize
  applicable passing/failed/skipped checks, and state any remaining fidelity or live-verification
  limitations. Do not call the redesign complete while routing, required checks, or merge remain
  unresolved.

## Execution setup after plan approval

Use the selected Superpowers execution skill and its worktree workflow. First inspect current
status and attached worktrees; preserve this docs branch's approved spec/assets/plan. Start the
implementation branch from a commit containing them, rather than from main without the design.
Use a `feat/` task branch and upstream tracking, respecting the repository's clean-tree and
pull requirements. Never discard other work. Commit at the task boundaries above and push
checkpoints. The final PR must include the approved design and its implementation evidence.


