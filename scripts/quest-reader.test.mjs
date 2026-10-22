// @vitest-environment node
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../src-tauri/src/quest/reader.rs', import.meta.url), 'utf8');
const expression = source.match(/const READ_STATE: &str = r#"([\s\S]*?)"#;/)[1];
function read(quests) {
  const context = vm.createContext({ input: quests });
  vm.runInContext(`
    const store = { quests: new Map(input.map(q => [q.id, q])), getQuest() {} };
    const webpackChunkdiscord_app = { push: a => a[2]({ c: { one: { exports: { renamed: store } } } }), pop() {} };
    const DiscordNative = {};
  `, context);
  return vm.runInContext(expression, context);
}
const quest = (overrides = {}) => ({ id: '1', config: {
  messages: { questName: 'Example' }, expiresAt: '2099-01-01',
  taskConfigV2: { tasks: { PLAY_ON_DESKTOP: { target: 900 } } },
  rewardsConfig: { rewards: [{ type: 4, orbQuantity: 200 }], rewardsExpireAt: '2099-02-01' },
}, ...overrides });

describe('the real read-only client expression', () => {
  it('does not invent completion or reject the feed for malformed optional metadata', () => {
    const q = quest({ userStatus: { enrolledAt: '2026-10-01', completedAt: 'not-a-date' } });
    q.config.messages.gamePublisher = { changedShape: true };
    q.config.ctaConfig = { buttonLabel: 123, link: { invalid: true } };
    q.config.expiresAt = 123;
    const summary = read([q]).claimed[0];
    expect(summary.state).toBe('claimed');
    expect(summary.publisher).toBeNull();
    expect(summary.ctaLink).toBeNull();
    expect(summary.expiresAt).toBeNull();
  });
  it('separates a claimed reward from completed and unknown claim evidence', () => {
    const feed = read([
      quest({ id: '1', userStatus: { enrolledAt: '2026-10-01', completedAt: '2026-10-02', claimedAt: '2026-10-22T12:00:00Z', orbQuantityClaimed: 240 } }),
      quest({ id: '2', userStatus: { completedAt: '2026-10-02', claimedAt: null } }),
      quest({ id: '3', userStatus: { completedAt: '2026-10-02' } }),
    ]);
    expect(feed.claimed.map(q => q.rewardClaimState)).toEqual(['claimed', 'unclaimed', 'unknown']);
    expect(feed.claimed[0].rewardClaimedAt).toBe('2026-10-22T12:00:00Z');
    expect(feed.claimed[0].claimedRewardOrbs).toBe(240);
    expect(feed.claimed[1].rewardClaimable).toBe(true);
    expect(feed.claimed[2].rewardClaimable).toBeNull();
  });
  it('keeps reward expiry separate from participation expiry', () => {
    const q = quest({ userStatus: { completedAt: '2026-10-01', claimedAt: null } });
    q.config.expiresAt = '2020-01-01';
    expect(read([q]).claimed[0].rewardClaimable).toBe(true);
    q.config.rewardsConfig.rewardsExpireAt = '2020-01-02';
    expect(read([q]).claimed[0].rewardClaimable).toBe(false);
  });
  it('keeps task progress paired with its target and identifies count units', () => {
    const q = quest({ userStatus: { enrolledAt: '2026-10-01', progress: { PLAY_ON_DESKTOP: { value: 100 }, WATCH_VIDEO: { value: 20 } } } });
    q.config.taskConfigV2.tasks.WATCH_VIDEO = { target: 60 };
    q.config.taskConfigV2.tasks.ACHIEVEMENT_IN_ACTIVITY = { target: 3 };
    const summary = read([q]).claimed[0];
    expect(summary.taskDetails.map(t => [t.value, t.target, t.unit])).toEqual([[100, 900, 'seconds'], [20, 60, 'seconds'], [0, 3, 'count']]);
    expect(summary.selectedTaskKind).toBeNull();
  });
  it('does not invent optional observations and handles absent or malformed assets', () => {
    const q = quest();
    q.config.assets = { questBarHero: 'PLACEHOLDER', hero: 'quests/banner.jpg' };
    const summary = read([q]).available[0];
    expect(summary.rewardImage).toBeNull();
    expect(summary.publisherVerified).toBeNull();
    expect(summary.banner).toBe('quests/banner.jpg');
    q.config.rewardsConfig.rewards = [{ type: 3, asset: 'quests/reward.png', messages: { name: 'Decoration' } }];
    q.config.taskConfigV2.tasks = { UNKNOWN_NEW_TASK: { target: 'bad' } };
    const newer = read([q]).available[0];
    expect(newer.rewardImage).toBe('quests/reward.png');
    expect(newer.rewardName).toBe('Decoration');
    expect(newer.taskDetails[0].unit).toBe('unknown');
    expect(newer.taskDetails[0].target).toBeNull();
  });
});
