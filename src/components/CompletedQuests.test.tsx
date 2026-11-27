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
    for (const region of regions) expect(region).toHaveClass('quest-group');
    expect(within(regions[0]).getByRole('heading', { level: 2, name: /^Unclaimed rewards 1$/ })).toBeInTheDocument();
    expect(within(regions[0]).getByText('Completed quests with rewards ready to claim in Discord.')).toBeInTheDocument();
    expect(within(regions[0]).getByRole('article', { name: 'Unclaimed Orb' })).toBeInTheDocument();
    expect(within(regions[1]).getByRole('heading', { level: 2, name: /^Claimed rewards 2$/ })).toBeInTheDocument();
    expect(within(regions[1]).getByText('Rewards you have already claimed.')).toBeInTheDocument();
    expect(within(regions[1]).getByRole('article', { name: 'Claimed Orb' })).toBeInTheDocument();
    expect(within(regions[1]).getByRole('article', { name: 'Claimed Badge' })).toBeInTheDocument();
    expect(within(regions[2]).getByRole('heading', { level: 2, name: /^Other completed 1$/ })).toBeInTheDocument();
    expect(within(regions[2]).getByText('Expired rewards or quests whose reward status could not be confirmed.')).toBeInTheDocument();
    expect(within(regions[2]).getByRole('article', { name: 'Expired Reward' })).toBeInTheDocument();
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
    expect(within(screen.getByRole('region', { name: 'Claimed rewards' })).getByRole('heading', { level: 2, name: /^Claimed rewards 2$/ })).toBeInTheDocument();

    view.rerender(<CompletedQuests cards={cards} query="Alpha" stale={false} openMenuQuestId={null} onMenuChange={vi.fn()} onClear={onClear} />);
    expect(within(screen.getByRole('region', { name: 'Claimed rewards' })).getByRole('heading', { level: 2, name: /^Claimed rewards 1$/ })).toBeInTheDocument();

    view.rerender(<CompletedQuests cards={cards} query="missing" stale={false} openMenuQuestId={null} onMenuChange={vi.fn()} onClear={onClear} />);
    expect(screen.queryByRole('region', { name: 'Claimed rewards' })).toBeNull();
    expect(screen.getByText('No matching quests')).toBeInTheDocument();
    expect(screen.getByText('Try another quest, game, or publisher name.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('hides sections emptied when search only matches another group', () => {
    const cards = buildQuestViews(makeFeed({
      claimed: [
        completed('Ready Reward', { rewardClaimState: 'unclaimed', rewardClaimable: true, rewardExpiresAt: '2099-01-01' }),
        completed('Claimed History', { rewardClaimState: 'claimed' }),
      ],
    }), now).completed;
    render(<CompletedQuests cards={cards} query="History" stale={false} openMenuQuestId={null} onMenuChange={vi.fn()} />);

    expect(screen.queryByRole('region', { name: 'Unclaimed rewards' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Claimed rewards' })).getByRole('heading', { level: 2, name: /^Claimed rewards 1$/ })).toBeInTheDocument();
  });
});
