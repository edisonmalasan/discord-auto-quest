import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DiscordStatus, QuestFeed } from '../types/quests';

const discordStatus = vi.fn<() => Promise<DiscordStatus>>();
const listDiscordQuests = vi.fn<() => Promise<QuestFeed>>();
const runQuestScript = vi.fn<() => Promise<boolean>>();
const stopQuestScript = vi.fn<() => Promise<void>>();

vi.mock('../lib/ipc', () => ({
  discordStatus: () => discordStatus(),
  listDiscordQuests: () => listDiscordQuests(),
  runQuestScript: () => runQuestScript(),
  stopQuestScript: () => stopQuestScript(),
  relaunchDiscord: () => Promise.resolve(),
  attachDiscord: () => Promise.resolve(),
  appVersion: () => Promise.resolve('0.1.0'),
  isAppError: (value: unknown) => typeof value === 'object' && value !== null && 'code' in value,
  toAppError: (value: unknown) =>
    typeof value === 'object' && value !== null && 'code' in value
      ? value
      : { code: 'UNKNOWN', message: String(value), retryable: true },
}));

const { useDiscord } = await import('./useDiscord');

describe('useDiscord', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it('recovers when Discord finishes starting after the initial status check', async () => {
    vi.useFakeTimers();
    discordStatus.mockResolvedValueOnce({
      installed: true, ready: false, action: 'Restart Discord', profile: null,
    }).mockResolvedValue({
      installed: true, ready: true, action: null, profile: null,
    });
    const feed: QuestFeed = {
      available: [], claimed: [], expired: 3, desktopApp: true, runningGames: [],
    };
    listDiscordQuests.mockResolvedValue(feed);

    const { result } = renderHook(() => useDiscord());
    await act(async () => {});
    expect(result.current.phase).toBe('blocked');
    expect(result.current.feed).toBeNull();

    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(result.current.phase).toBe('ready');
    expect(result.current.feed).toEqual(feed);
    expect(result.current.error).toBeNull();
  });

  it('says the quest script is running once it has run', async () => {
    discordStatus.mockResolvedValue({
      installed: true,
      ready: true,
      action: null,
      profile: null,
    });
    listDiscordQuests.mockResolvedValue({
      available: [],
      claimed: [],
      expired: 0,
      desktopApp: true,
      runningGames: [],
    });
    runQuestScript.mockResolvedValue(true);

    const { result } = renderHook(() => useDiscord());

    await waitFor(() => expect(result.current.phase).toBe('ready'));

    await act(async () => {
      result.current.work();
    });

    await waitFor(() => expect(result.current.working).toBe(true));
    expect(runQuestScript).toHaveBeenCalled();
  });

  it('retries the quest read when the debugger opens before Discord finishes loading', async () => {
    vi.useFakeTimers();
    discordStatus.mockResolvedValue({
      installed: true, ready: true, action: null, profile: null,
    });
    const feed: QuestFeed = {
      available: [], claimed: [], expired: 58, desktopApp: true, runningGames: [],
    };
    listDiscordQuests
      .mockRejectedValueOnce({ code: 'INVALID_PAYLOAD', message: 'Quest store is loading', retryable: false })
      .mockResolvedValue(feed);

    const { result } = renderHook(() => useDiscord());
    await act(async () => {});
    expect(result.current.phase).toBe('ready');
    expect(result.current.error?.code).toBe('INVALID_PAYLOAD');

    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(result.current.feed).toEqual(feed);
    expect(result.current.error).toBeNull();
  });
});
