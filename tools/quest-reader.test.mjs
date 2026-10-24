// @vitest-environment node
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../src-tauri/src/quest/reader.rs', import.meta.url), 'utf8');
const expression = source.match(/const READ_STATE: &str = r#"([\s\S]*?)"#;/)[1];
function read(quests, optimistic = {}) {
  const context = vm.createContext({ input: quests, optimistic });
  vm.runInContext(`
    const store = { quests: new Map(input.map(q => [q.id, q])), getQuest() {},
      getOptimisticProgress(id, kind) { return optimistic[kind]; } };
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
  it('reads Discord live video progress again on every refresh without inventing completion', () => {
    const q = quest({ userStatus: { enrolledAt: '2026-10-01', progress: { WATCH_VIDEO: { value: 0 } } } });
    q.config.taskConfigV2.tasks = { WATCH_VIDEO: { target: 100 } };
    expect(read([q], { WATCH_VIDEO: 5 }).claimed[0].taskDetails[0].value).toBe(5);
    expect(read([q], { WATCH_VIDEO: 25 }).claimed[0].taskDetails[0].value).toBe(25);
    const nearlyDone = read([q], { WATCH_VIDEO: 100 }).claimed[0];
    expect(nearlyDone.taskDetails[0].value).toBe(99);
    expect(nearlyDone.state).toBe('claimed');
    q.userStatus.completedAt = '2026-10-02';
    expect(read([q], { WATCH_VIDEO: 100 }).claimed[0].state).toBe('completed');
  });
  it('keeps confirmed progress when live video progress is lower or invalid', () => {
    const q = quest({ userStatus: { enrolledAt: '2026-10-01', progress: { WATCH_VIDEO_ON_MOBILE: { value: 20 } } } });
    q.config.taskConfigV2.tasks = { WATCH_VIDEO_ON_MOBILE: { target: 100 } };
    for (const value of [5, -1, NaN, Infinity, '25', undefined]) {
      expect(read([q], { WATCH_VIDEO_ON_MOBILE: value }).claimed[0].taskDetails[0].value).toBe(20);
    }
    expect(read([q], { WATCH_VIDEO_ON_MOBILE: 25 }).claimed[0].taskDetails[0].value).toBe(25);
  });
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
    expect(summary.selectedTaskKind).toBe('WATCH_VIDEO');
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
it('selects the same video task when desktop and mobile alternatives both begin at zero', () => {
  const q=quest({userStatus:{enrolledAt:'2026-10-01'}});
  q.config.taskConfigV2.tasks={WATCH_VIDEO_ON_MOBILE:{target:80},WATCH_VIDEO:{target:60}};
  const summary=read([q]).claimed[0];
  expect(summary.selectedTaskKind).toBe('WATCH_VIDEO');expect(summary.progressSeconds).toBe(0);expect(summary.targetSeconds).toBe(60);
});
it('uses worker priority rather than object insertion order for aggregate progress',()=>{
 const q=quest({userStatus:{enrolledAt:'2026-10-01',progress:{PLAY_ON_DESKTOP:{value:90},WATCH_VIDEO:{value:12}}}});
 q.config.taskConfigV2.tasks={PLAY_ON_DESKTOP:{target:900},WATCH_VIDEO:{target:60}};
 const summary=read([q]).claimed[0];expect(summary.selectedTaskKind).toBe('WATCH_VIDEO');expect(summary.progressSeconds).toBe(12);expect(summary.targetSeconds).toBe(60);
});
it('does not aggregate ambiguous unsupported task alternatives',()=>{
 const q=quest({userStatus:{enrolledAt:'2026-10-01',progress:{PLAY_ON_XBOX:{value:100}}}});
 q.config.taskConfigV2.tasks={PLAY_ON_XBOX:{target:900},PLAY_ON_PLAYSTATION:{target:600}};
 const summary=read([q]).claimed[0];expect(summary.selectedTaskKind).toBeNull();expect(summary.progressSeconds).toBe(0);expect(summary.targetSeconds).toBe(0);
});
