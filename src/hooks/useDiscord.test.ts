import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
});
