// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createDecipheriv } from 'node:crypto';
import vm from 'node:vm';
import { afterEach, expect, it, vi } from 'vitest';

function operation() {
  const bytes = readFileSync(new URL('../src-tauri/payload/auto-quest.bin', import.meta.url));
  const key = Buffer.from(readFileSync(new URL('../src-tauri/payload/secret.key', import.meta.url), 'utf8').trim(), 'hex');
  const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
  cipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]).toString();
}
const readerSource = readFileSync(new URL('../src-tauri/src/quest/reader.rs', import.meta.url), 'utf8');
const reader = readerSource.match(/const READ_STATE: &str = r#"([\s\S]*?)"#;/)[1];

function client(body, kind = 'WATCH_VIDEO') {
  vi.useFakeTimers();
  const world = vm.createContext({
    body, kind, setTimeout: (fn, ms) => setTimeout(fn, ms),
    console: { log() {} }, DiscordNative: {}, window: {},
  });
  vm.runInContext(`
    const quest = { id: '123', config: { messages: { questName: 'Example' },
      expiresAt: '2099-01-01', taskConfigV2: { tasks: { [kind]: { target: 100 } } } },
      userStatus: { questId: '123', enrolledAt: '2026-10-01', progress: { [kind]: { value: 0 } } } };
    class Quests { getQuest(id) { return this.quests.get(id); } }
    const store = new Quests(); store.quests = new Map([['123', quest]]);
    class Streaming { getStreamerActiveStreamMetadata() {} }
    class Channels { getAllThreadsForParent() {} getSortedPrivateChannels() { return [{id:'local'}]; } }
    class Dispatcher { flushWaitQueue() {} dispatch() {} }
    const games = { getRunningGames: () => [], getGameForPID() {} };
    const api = { get() { throw new Error('Unexpected read'); }, post: async () => ({ body }) };
    const modules = { quests: { exports: { A: store } }, stream: { exports: { A: new Streaming() } },
      games: { exports: { Ay: games } }, channels: { exports: { A: new Channels() } },
      guilds: { exports: { Ay: { getSFWDefaultChannel() {} } } },
      dispatcher: { exports: { h: new Dispatcher() } }, api: { exports: { Bo: api } } };
    const webpackChunkdiscord_app = { push: a => a[2]({ c: modules }), pop() {} };
  `, world);
  vm.runInContext(`(function () { ${operation()} })()`, world);
  const read = () => vm.runInContext(reader, world).claimed[0];
  read.status = () => vm.runInContext('store.getQuest("123").userStatus', world);
  return read;
}
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

it.each(['WATCH_VIDEO', 'WATCH_VIDEO_ON_MOBILE', 'PLAY_ACTIVITY'])('reads acknowledged %s progress using the returned value', async kind => {
  const read = client({ quest_id: '123', progress: { [kind]: { value: 5 } }, completed_at: null }, kind);
  expect(read().taskDetails[0].value).toBe(0);
  await vi.advanceTimersByTimeAsync(7000);
  expect(read().taskDetails[0].value).toBe(5);
  expect(read().state).toBe('claimed');
});

it('uses confirmed completion without accepting or claiming a reward', async () => {
  const read = client({ quest_id: '123', progress: { WATCH_VIDEO: { value: 100 } }, completed_at: '2026-10-24T00:00:00Z' });
  await vi.advanceTimersByTimeAsync(7000);
  expect(read().state).toBe('completed');
  expect(read().rewardClaimState).toBe('unknown');
});

it.each([
  { progress: { WATCH_VIDEO: { value: 5 } }, completed_at: '2026-10-24' },
  { quest_id: 'other', progress: { WATCH_VIDEO: { value: 5 } }, completed_at: '2026-10-24' },
  { quest_id: '123', progress: { WATCH_VIDEO: { value: -1 } }, completed_at: 'bad' },
  { quest_id: '123', progress: { WATCH_VIDEO: { value: '5' } } },
  { quest_id: '123', progress: { WATCH_VIDEO: { value: NaN } } },
  { quest_id: '123', progress: { WATCH_VIDEO: { value: Infinity } } },
])('ignores invalid or unrelated progress acknowledgments: %j', async body => {
  const read = client(body);
  await vi.advanceTimersByTimeAsync(7000);
  expect(read().taskDetails[0].value).toBe(0);
  expect(read().state).toBe('claimed');
});

it('retains unrelated status and task metadata and never rolls back acknowledged progress', async () => {
  const read = client({ quest_id: '123', progress: { WATCH_VIDEO: { value: 5 } }, completed_at: null });
  const status = read.status();
  status.progress.WATCH_VIDEO = { value: 20, updatedAt: '2026-10-24', heartbeat: { lastBeatAt: '2026-10-24' } };
  status.progress.OTHER = { value: 4 };
  status.claimedAt = '2026-10-24';
  status.completedAt = '2026-10-24T01:00:00Z';
  await vi.advanceTimersByTimeAsync(7000);
  expect(read.status()).toMatchObject({ enrolledAt: '2026-10-01', claimedAt: '2026-10-24',
    completedAt: '2026-10-24T01:00:00Z', progress: { WATCH_VIDEO: { value: 20,
      updatedAt: '2026-10-24', heartbeat: { lastBeatAt: '2026-10-24' } }, OTHER: { value: 4 } } });
});

it('reads completion-only acknowledgments without inventing task progress', async () => {
  const read = client({ quest_id: '123', completed_at: '2026-10-24T00:00:00Z' });
  await vi.advanceTimersByTimeAsync(7000);
  expect(read().state).toBe('completed');
  expect(read().taskDetails[0].value).toBe(0);
});
