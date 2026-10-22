import type { QuestFeed, QuestSummary } from '../../types/quests';

export function makeQuest(overrides: Partial<QuestSummary> = {}): QuestSummary {
  return {
    id: '123', name: 'Example Quest', gameTitle: 'Example Game', publisher: 'Example Studio',
    tasks: ['PLAY_ON_DESKTOP'], expiresAt: '2099-10-25T00:00:00Z', state: 'available',
    progressSeconds: 0, targetSeconds: 900, rewardOrbs: 700, rewardName: '700 Orbs',
    premiumOrbs: 840, banner: null, logotype: null, tile: null, ctaLabel: 'Get Game',
    ctaLink: 'https://example.com/game', accent: null, enrolledAt: null, completedAt: null,
    rewardClaimedAt: null, rewardClaimState: 'unknown', rewardClaimable: null,
    rewardExpiresAt: null, claimedRewardOrbs: null, rewardImage: null, rewardType: '4',
    publisherVerified: null, heroVideo: null, selectedTaskKind: null,
    taskDetails: [{ kind: 'PLAY_ON_DESKTOP', value: 0, target: 900, unit: 'seconds', platform: 'Desktop' }],
    ...overrides,
  };
}

export function makeFeed(overrides: Partial<QuestFeed> = {}): QuestFeed {
  return { available: [], claimed: [], expired: 0, desktopApp: true, runningGames: [], ...overrides };
}
