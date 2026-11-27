# Completed Quests Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate the Completed quests view into clearly labeled sections so unclaimed rewards appear first (`Unclaimed rewards`), followed by `Claimed rewards`, and `Other completed` (only when expired/unknown status cards exist).

**Architecture:** Keep `buildQuestViews` and `QuestViews['completed']` (`QuestCardModel[]`) unchanged so counts, sorting, and `awaitingClaim()` stay intact. Add a pure `completedGroups(cards)` helper in `src/lib/quest-view.ts`, a dedicated `CompletedQuests` component in `src/components/CompletedQuests.tsx` mirroring `OngoingQuests`, generalize `.ongoing-group` to `.quest-group` in `src/index.css`, and wire `CompletedQuests` into `QuestWorkspace.tsx`.

**Tech Stack:** React 19, TS 5.9, Vitest 4, Testing Library, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-11-28-completed-quest-groups-design.md`

## Global Constraints

- **Product truth (`PRODUCT.md`):** Discord is the authority for completion and reward state; **Completed** retains all reward types (`hasOrbReward` true or false); reward claims remain in Discord.
- **Design system (`DESIGN.md`):** `src/lib/quest-view.ts` drives normalized quest state, membership, and ordering; `claimable`, `claimed`, `expired`, and `unknown` reward states remain distinct; reduced motion and keyboard/focus restoration are preserved.
- **Section names and order:** Render non-empty sections in strict order: `Unclaimed rewards` (`rewardState === 'claimable'`), `Claimed rewards` (`rewardState === 'claimed'`), and `Other completed` (`'expired' | 'unknown'`). Never render empty section headers.
- **Shared styling:** Reuse one `.quest-group` CSS rule set across `OngoingQuests.tsx` and `CompletedQuests.tsx` instead of duplicating `.ongoing-group` rules.
- **Public wording (`tools/terms.mjs`):** All committed files must pass `npm run check:terms`.

## Review Focus

- **All-claimed Completed feed (zero unclaimed):** `Unclaimed rewards` and `Other completed` must not render; only `Claimed rewards` renders with the full count.
- **Unclaimed-only or expired/unknown-only feed:** Empty `Claimed rewards` must not render; `expired` and `unknown` cards must appear in `Other completed` rather than being dropped or mislabeled.
- **Non-Orbs completed quests (`hasOrbReward === false`):** Must be retained in their matching `Unclaimed rewards`, `Claimed rewards`, or `Other completed` group.
- **Search filtering in Completed:** Must filter across all three groups, update each visible section's count badge, keep the sidebar `Completed` nav count unchanged, and show `"No matching quests"` + `"Clear search"` when zero cards match.
- **Zero completed quests (`views.completed.length === 0`):** `QuestWorkspace` must still show the `"No completed quests"` empty state rather than `"No matching quests"`.

---

### Task 1: Add `completedGroups` helper in `src/lib/quest-view.ts`

**Files:**
- Modify: `src/lib/quest-view.ts:1-66`
- Test: `src/lib/quest-view.test.ts:1-70`

**Interfaces:**
- Produces:
  ```ts
  export interface CompletedGroups {
    unclaimed: QuestCardModel[];
    claimed: QuestCardModel[];
    other: QuestCardModel[];
  }
  export function completedGroups(cards: QuestCardModel[]): CompletedGroups;
  ```

- [ ] **Step 1: Write the failing tests in `src/lib/quest-view.test.ts`**

Add a test importing `completedGroups` from `./quest-view` that verifies:
- `claimable` cards (including `hasOrbReward: false`) go to `unclaimed` in input order.
- `claimed` cards (including `hasOrbReward: false`) go to `claimed` in input order.
- `expired` and `unknown` cards go to `other` in input order.
- Empty input returns `{ unclaimed: [], claimed: [], other: [] }`.

```ts
  it('groups completed cards into unclaimed, claimed, and other while keeping non-Orbs rewards and input order', () => {
    const completed = (id: string, overrides = {}) => makeQuest({ id, state: 'completed', expiresAt: '2020-01-01', ...overrides });
    const views = buildQuestViews(makeFeed({ claimed: [
      completed('claim-orb', { completedAt: '2026-10-20', rewardClaimState: 'unclaimed', rewardClaimable: true, rewardExpiresAt: '2099-01-01' }),
      completed('claim-badge', { completedAt: '2026-10-19', hasOrbReward: false, rewardOrbs: null, rewardName: 'Badge', rewardClaimState: 'unclaimed', rewardClaimable: true, rewardExpiresAt: '2099-01-01' }),
      completed('claimed-orb', { completedAt: '2026-10-22', rewardClaimState: 'claimed' }),
      completed('claimed-badge', { completedAt: '2026-10-21', hasOrbReward: false, rewardOrbs: null, rewardName: 'Badge', rewardClaimState: 'claimed' }),
      completed('expired', { completedAt: '2026-10-18', rewardClaimState: 'unclaimed', rewardExpiresAt: '2026-10-23T00:00:00Z' }),
      completed('unknown', { completedAt: '2026-10-17' }),
    ] }), now);
    const groups = completedGroups(views.completed);
    expect(groups.unclaimed.map(c => c.quest.id)).toEqual(['claim-orb', 'claim-badge']);
    expect(groups.claimed.map(c => c.quest.id)).toEqual(['claimed-orb', 'claimed-badge']);
    expect(groups.other.map(c => c.quest.id)).toEqual(['expired', 'unknown']);
    expect(completedGroups([])).toEqual({ unclaimed: [], claimed: [], other: [] });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/quest-view.test.ts`
Expected: FAIL because `completedGroups` is not exported from `./quest-view`.

- [ ] **Step 3: Implement `CompletedGroups` and `completedGroups(cards: QuestCardModel[]): CompletedGroups` in `src/lib/quest-view.ts`**

Partition `cards` in a single pass preserving input order:
- `card.rewardState === 'claimable'` -> `unclaimed`
- `card.rewardState === 'claimed'` -> `claimed`
- otherwise (`'expired'`, `'unknown'`, etc.) -> `other`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/quest-view.test.ts`
Expected: PASS (all tests in `src/lib/quest-view.test.ts` pass).

- [ ] **Step 5: Commit**

```bash
git add src/lib/quest-view.ts src/lib/quest-view.test.ts
git commit -m "feat: add completedGroups view helper"
```

---

### Task 2: Create `CompletedQuests` component and generalize `.quest-group` CSS

**Files:**
- Create: `src/components/CompletedQuests.tsx`
- Create: `src/components/CompletedQuests.test.tsx`
- Modify: `src/components/OngoingQuests.tsx:15-18`
- Modify: `src/index.css:165-168,215-217`

**Interfaces:**
- Consumes: `completedGroups`, `searchQuests`, `type QuestCardModel` from `../lib/quest-view`; `QuestIndex` from `./QuestIndex`
- Produces:
  ```ts
  interface Props {
    cards: QuestCardModel[];
    query: string;
    stale: boolean;
    openMenuQuestId: string | null;
    onMenuChange: (id: string | null) => void;
    onClear?: () => void;
  }
  export function CompletedQuests(props: Props): JSX.Element;
  ```

- [ ] **Step 1: Write the failing component tests in `src/components/CompletedQuests.test.tsx`**

Test:
1. Renders non-empty sections in order (`Unclaimed rewards`, `Claimed rewards`, `Other completed`) with matching headings, section counts, subtitles, and cards (including `hasOrbReward: false`).
2. Hides empty sections (e.g., when only `claimed` cards exist, `Unclaimed rewards` and `Other completed` regions are absent).
3. Filters across all groups when `query` is set, updates group counts, hides sections emptied by the query, and shows `"No matching quests"` + `"Clear search"` (calling `onClear` on click) when zero cards match.

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompletedQuests } from './CompletedQuests';
import { buildQuestViews } from '../lib/quest-view';
import { makeFeed, makeQuest } from '../test/fixtures/quests';

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

const now = Date.parse('2026-10-23T00:00:00Z');
const completed = (id: string, overrides = {}) => makeQuest({ id, name: id, state: 'completed', expiresAt: '2020-01-01', ...overrides });

describe('CompletedQuests', () => {
  it('renders unclaimed rewards first, then claimed rewards, then other completed in order', () => {
    const cards = buildQuestViews(makeFeed({
      claimed: [
        completed('Claimed Orb', { rewardClaimState: 'claimed', completedAt: '2026-10-22' }),
        completed('Claimed Badge', { hasOrbReward: false, rewardOrbs: null, rewardName: 'Badge', rewardClaimState: 'claimed', completedAt: '2026-10-21' }),
        completed('Unclaimed Orb', { rewardClaimState: 'unclaimed', rewardClaimable: true, rewardExpiresAt: '2099-01-01', completedAt: '2026-10-20' }),
        completed('Expired Reward', { rewardClaimState: 'unclaimed', rewardExpiresAt: '2026-10-23T00:00:00Z', completedAt: '2026-10-19' }),
      ],
    }), now).completed;
    render(<CompletedQuests cards={cards} query="" stale={false} openMenuQuestId={null} onMenuChange={vi.fn()} />);

    const regions = screen.getAllByRole('region');
    expect(regions.map(region => region.getAttribute('aria-label'))).toEqual([
      'Unclaimed rewards',
      'Claimed rewards',
      'Other completed',
    ]);
    expect(within(regions[0]).getByRole('heading', { level: 2 })).toHaveTextContent('Unclaimed rewards 1');
    expect(within(regions[0]).getByText('Unclaimed Orb')).toBeInTheDocument();
    expect(within(regions[1]).getByRole('heading', { level: 2 })).toHaveTextContent('Claimed rewards 2');
    expect(within(regions[1]).getByText('Claimed Orb')).toBeInTheDocument();
    expect(within(regions[1]).getByText('Claimed Badge')).toBeInTheDocument();
    expect(within(regions[2]).getByRole('heading', { level: 2 })).toHaveTextContent('Other completed 1');
    expect(within(regions[2]).getByText('Expired Reward')).toBeInTheDocument();
  });

  it('hides empty sections and filters across groups with clear-search empty state', () => {
    const cards = buildQuestViews(makeFeed({
      claimed: [
        completed('Claimed Alpha', { rewardClaimState: 'claimed' }),
        completed('Claimed Beta', { rewardClaimState: 'claimed' }),
      ],
    }), now).completed;
    const onClear = vi.fn();
    const view = render(<CompletedQuests cards={cards} query="" stale={false} openMenuQuestId={null} onMenuChange={vi.fn()} onClear={onClear} />);

    expect(screen.queryByRole('region', { name: 'Unclaimed rewards' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Other completed' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Claimed rewards' })).getByRole('heading', { level: 2 })).toHaveTextContent('Claimed rewards 2');

    view.rerender(<CompletedQuests cards={cards} query="Alpha" stale={false} openMenuQuestId={null} onMenuChange={vi.fn()} onClear={onClear} />);
    expect(within(screen.getByRole('region', { name: 'Claimed rewards' })).getByRole('heading', { level: 2 })).toHaveTextContent('Claimed rewards 1');

    view.rerender(<CompletedQuests cards={cards} query="missing" stale={false} openMenuQuestId={null} onMenuChange={vi.fn()} onClear={onClear} />);
    expect(screen.getByText('No matching quests')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CompletedQuests.test.tsx`
Expected: FAIL because `./CompletedQuests` does not exist.

- [ ] **Step 3: Implement `CompletedQuests.tsx`, update `OngoingQuests.tsx` class name, and generalize `.quest-group` in `src/index.css`**

In `src/index.css`: rename `.ongoing-group` selectors (`165-168` and `215-217`) to `.quest-group`.
In `src/components/OngoingQuests.tsx`: replace `className="ongoing-group"` with `className="quest-group"`.
In `src/components/CompletedQuests.tsx`: filter `cards` with `searchQuests(cards, query)`, group with `completedGroups(filtered)`, map over the 3 section definitions (`Unclaimed rewards`, `Claimed rewards`, `Other completed`) to render each non-empty `<section className="quest-group" aria-label={title}>` with `<h2>{title} <span>{items.length}</span></h2>`, `<p>{subtitle}</p>`, and `<QuestIndex cards={items} ... />`; when all groups are empty and `query.trim()`, render `"No matching quests"`, `"Try another quest, game, or publisher name."`, and optional `"Clear search"` button.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/CompletedQuests.test.tsx src/components/OngoingQuests.test.tsx`
Expected: PASS (all tests in both suites pass).

- [ ] **Step 5: Commit**

```bash
git add src/components/CompletedQuests.tsx src/components/CompletedQuests.test.tsx src/components/OngoingQuests.tsx src/index.css
git commit -m "feat: add CompletedQuests grouped view component"
```

---

### Task 3: Wire `CompletedQuests` into `QuestWorkspace`, add `App.test.tsx` integration tests, and update `DESIGN.md`

**Files:**
- Modify: `src/components/QuestWorkspace.tsx:1-68`
- Modify: `src/App.test.tsx:27-89`
- Modify: `DESIGN.md:58-63,90-96`

**Interfaces:**
- Consumes: `CompletedQuests` from `./CompletedQuests`

- [ ] **Step 1: Write failing integration tests in `src/App.test.tsx`**

Add tests in `describe('the quest workspace', ...)` verifying:
1. When Completed has both claimable and claimed quests, navigating to `Completed` renders `Unclaimed rewards` before `Claimed rewards` with accurate group counts, preserves the total search-independent sidebar count, and supports Completed search + `"Clear search"`.
2. When `views.completed` is empty, navigating to `Completed` renders `"No completed quests"` (and not `"No matching quests"`).

```tsx
 it('separates unclaimed and claimed quests in Completed while keeping sidebar counts independent of search', async () => {
  list.mockResolvedValue(makeFeed({
   claimed: [
    makeQuest({ id: 'c1', name: 'Claimed Later', state: 'completed', completedAt: '2026-10-22', rewardClaimState: 'claimed' }),
    makeQuest({ id: 'c2', name: 'Ready To Claim', state: 'completed', completedAt: '2026-10-20', rewardClaimState: 'unclaimed', rewardClaimable: true, rewardExpiresAt: '2099-01-01' }),
   ],
  }));
  render(<App />);
  const nav = screen.getByRole('navigation', { name: 'Your quests' });
  await userEvent.click(await within(nav).findByRole('button', { name: /Completed.*2/ }));
  const regions = screen.getAllByRole('region');
  expect(regions.map(region => region.getAttribute('aria-label'))).toEqual(['Unclaimed rewards', 'Claimed rewards']);
  expect(within(regions[0]).getByText('Ready To Claim')).toBeInTheDocument();
  expect(within(regions[1]).getByText('Claimed Later')).toBeInTheDocument();
  await userEvent.type(screen.getByRole('searchbox'), 'Ready');
  expect(screen.queryByRole('region', { name: 'Claimed rewards' })).toBeNull();
  expect(within(nav).getByRole('button', { name: /Completed.*2/ })).toBeInTheDocument();
  await userEvent.type(screen.getByRole('searchbox'), 'xyz');
  expect(screen.getByText('No matching quests')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.getByRole('region', { name: 'Claimed rewards' })).toBeInTheDocument();
 });
 it('shows No completed quests when there are no completed quests', async () => {
  list.mockResolvedValue(makeFeed());
  render(<App />);
  const nav = screen.getByRole('navigation', { name: 'Your quests' });
  await userEvent.click(await within(nav).findByRole('button', { name: /Completed.*0/ }));
  expect(screen.getByText('No completed quests')).toBeInTheDocument();
  expect(screen.queryByText('No matching quests')).toBeNull();
 });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL because `QuestWorkspace` still renders `<QuestIndex>` for Completed without `Unclaimed rewards` / `Claimed rewards` regions.

- [ ] **Step 3: Wire `CompletedQuests` in `src/components/QuestWorkspace.tsx` and update `DESIGN.md`**

In `src/components/QuestWorkspace.tsx`:
- Import `CompletedQuests` from `./CompletedQuests`.
- In the ternary chain (after the `view === 'ongoing'` branch), add:
  ```tsx
  : view === 'completed' && views.completed.length > 0 ? <CompletedQuests cards={views.completed} query={queries.completed} stale={stale} openMenuQuestId={openMenuQuestId} onMenuChange={setMenu} onClear={() => setQueries({ ...queries, completed: '' })} />
  ```
  (Keeping `cards` = `searchQuests(views[view], queries[view])` for `visibleIds` so open-menu focus restoration continues working when a search hides the open card.)
In `DESIGN.md`:
- Note under **Workspace** / **Honest states and actions** that Completed groups non-empty sections in order (`Unclaimed rewards`, `Claimed rewards`, and `Other completed` for expired or unverified reward status) while retaining all reward types and search-independent counts.

- [ ] **Step 4: Run tests and repo checks**

Run: `npm test && npm run typecheck && npm run build && npm run check:terms && npm run check:acceptance`
Expected: All frontend tests pass, TS typecheck passes, production Vite build succeeds, wording audit passes, acceptance check passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/QuestWorkspace.tsx src/App.test.tsx DESIGN.md
git commit -m "feat: wire CompletedQuests into QuestWorkspace"
```
