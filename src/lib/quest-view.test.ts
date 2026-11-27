import { describe, expect, it } from 'vitest';
import { makeFeed, makeQuest } from '../test/fixtures/quests';
import { buildQuestViews, completedGroups, searchQuests } from './quest-view';

const now = Date.parse('2026-10-23T00:00:00Z');
describe('quest views', () => {
  it('filters Available before search and counts while keeping non-Orb accepted and completed quests',()=>{
    const views=buildQuestViews(makeFeed({available:[makeQuest({id:'orbs',rewardOrbs:37}),makeQuest({id:'other',hasOrbReward:false,rewardOrbs:null,rewardName:'Arbitrary game item'}),makeQuest({id:'misleading',hasOrbReward:false,rewardName:'700 Orbs'})],claimed:[makeQuest({id:'accepted',state:'claimed',hasOrbReward:false}),makeQuest({id:'completed',state:'completed',hasOrbReward:false})]}),now);
    expect(views.available.map(c=>c.quest.id)).toEqual(['orbs']);
    expect(searchQuests(views.available,'Arbitrary')).toHaveLength(0);
    expect(views.ongoing[0].quest.id).toBe('accepted');expect(views.completed[0].quest.id).toBe('completed');
  });
  it('partitions accepted, expired, offered and completed without duplicates', () => {
    const active = makeQuest({ id: 'active', state: 'claimed' });
    const views = buildQuestViews(makeFeed({ available: [makeQuest({ id: 'offered' }), active,
      makeQuest({ id: 'gone', expiresAt: '2026-10-23T00:00:00Z' })], claimed: [active,
      makeQuest({ id: 'expired', state: 'claimed', expiresAt: '2020-01-01' }),
      makeQuest({ id: 'done', state: 'completed', rewardClaimState: 'claimed' })] }), now);
    expect(views.ongoing.map(c => c.quest.id)).toEqual(['active', 'expired']);
    expect(views.available.map(c => c.quest.id)).toEqual(['offered']);
    expect(views.completed[0].rewardState).toBe('claimed');
  });
  it('requires real claim evidence and a separate reward window', () => {
    const completed = (id: string, overrides = {}) => makeQuest({ id, state: 'completed', expiresAt: '2020-01-01', ...overrides });
    const views = buildQuestViews(makeFeed({ claimed: [
      completed('unknown'), completed('claim', { rewardClaimState: 'unclaimed', rewardClaimable: true, rewardExpiresAt: '2099-01-01' }),
      completed('claimed', { rewardClaimState: 'claimed', rewardClaimable: true }),
      completed('expired', { rewardClaimState: 'unclaimed', rewardExpiresAt: '2026-10-23T00:00:00Z' }),
    ] }), now);
    expect(views.completed.map(c => [c.quest.id, c.rewardState])).toEqual([
      ['claim', 'claimable'], ['claimed', 'claimed'], ['expired', 'expired'], ['unknown', 'unknown'],
    ]);
  });
  it('preserves zero progress, counts, and completion authority', () => {
    const views = buildQuestViews(makeFeed({ claimed: [makeQuest({ state: 'claimed', taskDetails: [
      { kind: 'ACHIEVEMENT_IN_ACTIVITY', value: 3, target: 3, unit: 'count', platform: null },
    ] })] }), now);
    expect(views.ongoing[0].progress).toMatchObject({ percent: 100, unit: 'count' });
    expect(views.completed).toHaveLength(0);
    expect(buildQuestViews(makeFeed({ claimed: [makeQuest({ state: 'claimed' })] }), now).ongoing[0].progress?.percent).toBe(0);
  });
  it('never mixes alternative tasks or invalid numbers into a percentage', () => {
    const tasks = [
      { kind: 'PLAY_ON_DESKTOP', value: 100, target: 900, unit: 'seconds' as const, platform: 'Desktop' },
      { kind: 'WATCH_VIDEO', value: 20, target: 60, unit: 'seconds' as const, platform: null },
    ];
    const q = makeQuest({ state: 'claimed', taskDetails: tasks });
    expect(buildQuestViews(makeFeed({ claimed: [q] }), now).ongoing[0].progress).toBeNull();
    q.selectedTaskKind = 'WATCH_VIDEO';
    expect(buildQuestViews(makeFeed({ claimed: [q] }), now).ongoing[0].progress?.percent).toBe(33);
    for (const value of [-1, NaN, Infinity]) {
      q.taskDetails = [{ ...tasks[1], value }];
      expect(buildQuestViews(makeFeed({ claimed: [q] }), now).ongoing[0].progress).toBeNull();
    }
  });
  it('searches all visible fields without changing the original counts', () => {
    const views = buildQuestViews(makeFeed({ available: [makeQuest({ name: 'First', gameTitle: 'Different', publisher: 'STUDIO' })] }), now);
    for (const query of ['first', 'DIFFERENT', 'studio']) expect(searchQuests(views.available, query)).toHaveLength(1);
    expect(searchQuests(views.available, 'missing')).toHaveLength(0);
    expect(views.available).toHaveLength(1);
  });
  it('uses valid completion dates and IDs for stable ordering with unavailable dates last', () => {
    const views = buildQuestViews(makeFeed({ available: [makeQuest({ id: '2', expiresAt: 'bad' }), makeQuest({ id: '1' })], claimed: [
      makeQuest({ id: '3', state: 'completed', completedAt: '2026-10-21' }),
      makeQuest({ id: '4', state: 'completed', completedAt: '2026-10-22' }),
    ] }), now);
    expect(views.available.map(c => c.quest.id)).toEqual(['1', '2']);
    expect(views.completed.map(c => c.quest.id)).toEqual(['4', '3']);
  });
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
});
