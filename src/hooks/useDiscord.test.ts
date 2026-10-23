import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DiscordStatus, QuestFeed } from '../types/quests';

const discordStatus = vi.fn<() => Promise<DiscordStatus>>();
const listDiscordQuests = vi.fn<() => Promise<QuestFeed>>();
const startQuestWork = vi.fn<() => Promise<boolean>>();
const stopQuestWork = vi.fn<() => Promise<void>>();
const relaunchDiscord = vi.fn<() => Promise<void>>();

vi.mock('../lib/ipc', () => ({
  discordStatus: () => discordStatus(),
  listDiscordQuests: () => listDiscordQuests(),
  startQuestWork: () => startQuestWork(),
  stopQuestWork: () => stopQuestWork(),
  relaunchDiscord: () => relaunchDiscord(),
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
  beforeEach(() => {
    vi.resetAllMocks();
    relaunchDiscord.mockResolvedValue();
    stopQuestWork.mockResolvedValue();
    startQuestWork.mockResolvedValue(true);
    discordStatus.mockResolvedValue({ installed: true, ready: true, action: null, profile: null });
    listDiscordQuests.mockResolvedValue({ available: [], claimed: [], expired: 0, desktopApp: true, runningGames: [] });
  });
  afterEach(() => vi.useRealTimers());

  it('retains the last read as stale and clears a recovered read error', async () => {
    const { result } = renderHook(() => useDiscord());
    await waitFor(() => expect(result.current.feed).not.toBeNull());
    const original = result.current.feed;
    listDiscordQuests.mockRejectedValueOnce({ code: 'NETWORK_UNAVAILABLE', message: 'Connection lost', retryable: true });
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.stale).toBe(true));
    expect(result.current.feed).toBe(original);
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.stale).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it('ignores an old read after an explicit restart creates a newer generation', async () => {
    let resolveOld!: (feed: QuestFeed) => void;
    listDiscordQuests.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
    const newer: QuestFeed = { available: [], claimed: [], expired: 22, desktopApp: true, runningGames: [] };
    listDiscordQuests.mockResolvedValue(newer);
    const { result } = renderHook(() => useDiscord());
    await waitFor(() => expect(listDiscordQuests).toHaveBeenCalledTimes(1));
    act(() => result.current.restart());
    await waitFor(() => expect(result.current.feed?.expired).toBe(22));
    await act(async () => resolveOld({ ...newer, expired: 99 }));
    expect(result.current.feed?.expired).toBe(22);
  });

  it('guards two same-tick Work calls before React rerenders', async () => {
    let acknowledge!: (value: boolean) => void;
    startQuestWork.mockReturnValue(new Promise(resolve => { acknowledge = resolve; }));
    const { result } = renderHook(() => useDiscord());
    await waitFor(() => expect(result.current.feed).not.toBeNull());
    act(() => { result.current.work(); result.current.work(); });
    expect(startQuestWork).toHaveBeenCalledTimes(1);
    await act(async () => acknowledge(true));
  });

  it('keeps Stop available and prevents another Work after an uncertain dispatch', async () => {
    startQuestWork.mockRejectedValue({ code: 'OPERATION_UNCERTAIN', message: 'Work outcome is unknown. Try Stop before working again.', retryable: false });
    const { result } = renderHook(() => useDiscord());
    await waitFor(() => expect(result.current.feed).not.toBeNull());
    act(() => result.current.work());
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.working).toBe(true);
    act(() => result.current.work());
    expect(startQuestWork).toHaveBeenCalledTimes(1);
    act(() => result.current.stop());
    await waitFor(() => expect(stopQuestWork).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.working).toBe(false));
  });

  it('does not erase a failed Stop when a later read succeeds', async () => {
    stopQuestWork.mockRejectedValue(Error('Stop failed'));
    const { result } = renderHook(() => useDiscord());
    await waitFor(() => expect(result.current.feed).not.toBeNull());
    act(() => result.current.work());
    await waitFor(() => expect(result.current.working).toBe(true));
    await waitFor(() => expect(result.current.busy).toBe(false));
    act(() => result.current.stop());
    await waitFor(() => expect(result.current.operationError?.message).toContain('Stop failed'));
    listDiscordQuests.mockResolvedValue({ available: [], claimed: [], expired: 77, desktopApp: true, runningGames: [] });
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.feed?.expired).toBe(77));
    expect(result.current.operationError?.message).toContain('Stop failed');
    expect(result.current.working).toBe(true);
  });

  it('distinguishes closed Discord and never restarts it by itself', async () => {
    discordStatus.mockResolvedValue({ installed: true, ready: false, running: false, action: 'Discord is closed', profile: null });
    const { result } = renderHook(() => useDiscord());
    await waitFor(() => expect(result.current.connectionState).toBe('closed'));
    expect(relaunchDiscord).not.toHaveBeenCalled();
    expect(listDiscordQuests).not.toHaveBeenCalled();
  });

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

  it('says the quest operation is running once it has run', async () => {
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
    startQuestWork.mockResolvedValue(true);

    const { result } = renderHook(() => useDiscord());

    await waitFor(() => expect(result.current.phase).toBe('ready'));

    await act(async () => {
      result.current.work();
    });

    await waitFor(() => expect(result.current.working).toBe(true));
    expect(startQuestWork).toHaveBeenCalled();
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
