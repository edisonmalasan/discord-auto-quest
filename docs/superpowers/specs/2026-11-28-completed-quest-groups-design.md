# Completed Quests Grouping Design

## Intent and Why

Users who have completed many quests see a single flat grid in the **Completed** view. Even though claimable quests already sort ahead of claimed history, there is no visual boundary or heading separating rewards that still need to be claimed from rewards already claimed. Adding explicit sections places unclaimed rewards clearly at the top so users never overlook them, while keeping claimed history organized underneath.

## Goals, Non-goals, and Anti-goals

### Goals
- Separate the **Completed** view into labeled sections with live filtered counts:
  1. **Unclaimed rewards** (`rewardState === 'claimable'`) first.
  2. **Claimed rewards** (`rewardState === 'claimed'`) below it.
  3. **Other completed** (`rewardState === 'expired' | 'unknown'`) at the bottom only when such quests exist, so expired or unverified rewards remain visible without being mislabeled as claimed or claimable.
- Support search filtering inside **Completed** across all groups, hiding empty sections and showing the standard `"No matching quests"` + `"Clear search"` empty state when no cards match, while keeping the sidebar `Completed` count search-independent.
- Reuse the same grouped-section layout, typography, and stretched card-footer alignment used by **Ongoing**.

### Non-goals
- Changing **Ongoing** or **Available** membership, counts, sorting, or card layout.
- Changing `QuestCard` content, reward-claim handoffs (`Claim in Discord`, `View reward in Discord`, `Reward expired`, `Check in Discord`), or menu behavior.
- Adding in-app reward claiming (reward claims remain in Discord).

### Anti-goals
- Rendering empty group headers (e.g., an empty `Unclaimed rewards` section when zero quests are claimable).
- Dropping non-Orbs completed quests or labeling non-Orbs quests as Orbs or `expired` / `unknown` reward states as claimed/claimable.

## Constraints

- **Product truth (`PRODUCT.md`):** Discord is the authority for completion and reward state; **Completed** retains all reward types (`hasOrbReward` true or false); reward claims remain in Discord.
- **Design system (`DESIGN.md`):** `src/lib/quest-view.ts` drives normalized quest state, membership, and ordering; `claimable`, `claimed`, `expired`, and `unknown` reward states remain distinct; reduced motion and keyboard/focus restoration are preserved.
- **Public wording (`tools/terms.mjs`):** All committed files must pass `npm run check:terms`.

## Approaches

### Approach 1 (Selected): Pure `completedGroups` helper + `CompletedQuests` component + shared `.quest-group` styling
- Add a pure `completedGroups(cards: QuestCardModel[]): CompletedGroups` helper in `src/lib/quest-view.ts` returning `{ unclaimed, claimed, other }` while preserving the input's existing order within each group.
- Create `src/components/CompletedQuests.tsx` (parallel to `OngoingQuests.tsx`) rendering non-empty `<section className="quest-group" aria-label="...">` groups in order: `Unclaimed rewards`, `Claimed rewards`, and `Other completed`.
  - *Builder-check decision:* Because **Completed** retains all reward types (`hasOrbReward` true or false, per `PRODUCT.md` and `DESIGN.md`) and `QuestWorkspace` / `QuestCard` already describe Completed quests as `"rewards"`, reward-agnostic headings (`Unclaimed rewards` / `Claimed rewards`) keep the separation accurate for both Orbs and non-Orbs quests without adding extra fragmentation.
- Generalize `.ongoing-group` in `src/index.css` to `.quest-group` (updating `OngoingQuests.tsx` and `CompletedQuests.tsx` to share `.quest-group`) so section headers and stretched grids share one CSS rule set with zero duplication.
- Update `QuestWorkspace.tsx` to render `<CompletedQuests>` when `view === 'completed'` and `views.completed.length > 0`, leaving the empty-completed state (`views.completed.length === 0`) unchanged.
- **Trade-offs:** Preserves the `QuestViews` (`Record<QuestView, QuestCardModel[]>`) contract, `views.completed.length` sidebar count, and `awaitingClaim()` in `src/lib/quests.ts` without breaking existing consumers.

### Approach 2 (Rejected): Change `views.completed` in `buildQuestViews` from `QuestCardModel[]` to a grouped object
- **Why rejected:** Breaks `QuestViews` (`Record<QuestView, QuestCardModel[]>`), `views.completed.length` in `QuestWorkspace.tsx`, `awaitingClaim()` in `src/lib/quests.ts`, and existing unit tests.

### Approach 3 (Rejected): Inline the grouped JSX directly inside `QuestWorkspace.tsx`
- **Why rejected:** Duplicates view-specific grouping logic inside `QuestWorkspace.tsx` instead of following the established `OngoingQuests.tsx` pattern.

## Design Details

- **Grouping rules (`completedGroups` in `src/lib/quest-view.ts`):**
  - `unclaimed`: `card.rewardState === 'claimable'`
  - `claimed`: `card.rewardState === 'claimed'`
  - `other`: `card.rewardState !== 'claimable' && card.rewardState !== 'claimed'` (`'expired'` or `'unknown'`)
- **Section presentation (`src/components/CompletedQuests.tsx`):**
  - Search is applied with `searchQuests(cards, query)` before grouping, preserving input order and group counts.
  - Each non-empty group renders `<section className="quest-group" aria-label={title}>` with `<h2>{title} <span>{groupCards.length}</span></h2>`, a short `<p>` subtitle, and `<QuestIndex cards={groupCards} ... />`:
    - `Unclaimed rewards`: `"Completed quests with rewards ready to claim in Discord."`
    - `Claimed rewards`: `"Rewards you have already claimed."`
    - `Other completed`: `"Expired rewards or quests whose reward status could not be confirmed."`
  - When `cards.length > 0` and search matches zero cards across all groups, render the standard `"No matching quests"` empty state with `"Try another quest, game, or publisher name."` and a `"Clear search"` button when `onClear` is provided.
- **Documentation updates:** Update `DESIGN.md` (workspace/completed section) and `docs/ROADMAP.md` (after verification).

## Left to the Builder

- Exact JSX data-driven loop structure in `CompletedQuests.tsx`.
- Exact unit, component, and `App.test.tsx` test cases and fixture additions.
