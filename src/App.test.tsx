import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DiscordStatus, QuestFeed, QuestSummary } from './types/quests';

const discordStatus = vi.fn<() => Promise<DiscordStatus>>();
const listDiscordQuests = vi.fn<() => Promise<QuestFeed>>();
const runQuestScript = vi.fn<() => Promise<boolean>>();
const stopQuestScript = vi.fn<() => Promise<void>>();
const relaunchDiscord = vi.fn<() => Promise<void>>();

vi.mock('./lib/ipc', () => ({
  discordStatus: () => discordStatus(),
  listDiscordQuests: () => listDiscordQuests(),
  runQuestScript: () => runQuestScript(),
  stopQuestScript: () => stopQuestScript(),
  relaunchDiscord: () => relaunchDiscord(),
  appVersion: () => Promise.resolve('0.1.0'),
  isAppError: (value: unknown) => typeof value === 'object' && value !== null && 'code' in value,
  toAppError: (value: unknown) =>
    typeof value === 'object' && value !== null && 'code' in value
      ? value
      : { code: 'UNKNOWN', message: String(value), retryable: true },
}));

const { default: App } = await import('./App');

function quest(overrides: Partial<QuestSummary> = {}): QuestSummary {
  return {
    id: '1558176501663272961',
    name: 'Clean Crew',
    tasks: ['PLAY_ON_DESKTOP'],
    expiresAt: '2026-10-25T00:00:00+00:00',
    state: 'available',
    progressSeconds: 0,
    targetSeconds: 900,
    rewardOrbs: 700,
    ...overrides,
  };
}

function feed(overrides: Partial<QuestFeed> = {}): QuestFeed {
  return {
    available: [quest()],
    claimed: [
      quest({
        id: '1556778857481113610',
        name: 'Deadzone Rogue 2',
        state: 'claimed',
        progressSeconds: 612,
      }),
    ],
    expired: 64,
    desktopApp: true,
    runningGames: [],
    ...overrides,
  };
}

function ready(overrides: Partial<DiscordStatus> = {}): DiscordStatus {
  return {
    installed: true,
    ready: true,
    action: null,
    profile: 'C:\\Users\\ed\\AppData\\Roaming\\discord',
    ...overrides,
  };
}

describe('App', () => {
  beforeEach(() => {
    discordStatus.mockReset();
    listDiscordQuests.mockReset();
    runQuestScript.mockReset();
    stopQuestScript.mockReset();
    relaunchDiscord.mockReset();

    discordStatus.mockResolvedValue(ready());
    listDiscordQuests.mockResolvedValue(feed());
    runQuestScript.mockResolvedValue(true);
    stopQuestScript.mockResolvedValue(undefined);
    relaunchDiscord.mockResolvedValue(undefined);
  });

  it('shows the quests you have accepted before the ones on offer', async () => {
    render(<App />);

    await screen.findByText('Clean Crew');

    const accepted = screen.getByRole('heading', { name: /accepted/i }).closest('section');
    const offered = screen.getByRole('heading', { name: /on offer/i }).closest('section');

    expect(accepted).not.toBeNull();
    expect(offered).not.toBeNull();
    expect(within(accepted as HTMLElement).getByText('Deadzone Rogue 2')).toBeInTheDocument();
    expect(within(offered as HTMLElement).getByText('Clean Crew')).toBeInTheDocument();
  });

  it('prints the figures, in the register’s own columns', async () => {
    render(<App />);

    await screen.findByText('Clean Crew');

    // The task, in words. Both rows are desktop quests, so both say it.
    expect(screen.getAllByText('Play on desktop')).toHaveLength(2);
    // The reward.
    expect(screen.getAllByText('700 Orbs')).toHaveLength(2);
    // The progress of an accepted quest, in seconds.
    expect(screen.getByText('612/900s')).toBeInTheDocument();
    // How long a quest on offer takes.
    expect(screen.getByText('15 min')).toBeInTheDocument();
  });

  it('says what needs doing now', async () => {
    render(<App />);

    await screen.findByText('Clean Crew');
    expect(
      screen.getByText('Accept a quest in Discord, then work it from here.'),
    ).toBeInTheDocument();
  });

  it('says so when a quest is finished and waiting to be claimed', async () => {
    listDiscordQuests.mockResolvedValue(
      feed({
        available: [],
        claimed: [
          quest({
            name: 'Deadzone Rogue 2',
            state: 'completed',
            progressSeconds: 900,
          }),
        ],
      }),
    );

    render(<App />);

    expect(
      await screen.findByText('Deadzone Rogue 2 is finished — claim the reward in Discord.'),
    ).toBeInTheDocument();
  });

  it('says what a quest that needs the user is waiting for', async () => {
    listDiscordQuests.mockResolvedValue(
      feed({
        available: [],
        claimed: [
          quest({
            name: 'A streaming quest',
            tasks: ['STREAM_ON_DESKTOP'],
            state: 'claimed',
            progressSeconds: 30,
          }),
        ],
      }),
    );

    render(<App />);

    expect(
      await screen.findByText(
        'A streaming quest counts only while you are in a voice channel with somebody.',
      ),
    ).toBeInTheDocument();
  });

  it('never claims to be working a quest it is not working', async () => {
    render(<App />);

    await screen.findByText('Deadzone Rogue 2');
    expect(
      screen.queryByText('Working your quests. Discord counts them; this window only shows it.'),
    ).not.toBeInTheDocument();
  });

  it('asks before restarting Discord, because restarting ends what the user was doing', async () => {
    discordStatus.mockResolvedValue(
      ready({
        ready: false,
        action: 'Discord has to be restarted so the application can drive it.',
      }),
    );

    render(<App />);

    expect(await screen.findByRole('button', { name: /restart discord/i })).toBeInTheDocument();
    expect(relaunchDiscord).not.toHaveBeenCalled();
  });

  it('restarts Discord when the user asks for it', async () => {
    discordStatus.mockResolvedValue(ready({ ready: false, action: 'It has to be restarted.' }));

    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /restart discord/i }));

    await waitFor(() => expect(relaunchDiscord).toHaveBeenCalled());
  });

  it('runs the quest script when the user asks for it', async () => {
    render(<App />);

    const work = await screen.findByRole('button', { name: /work my quests/i });
    await waitFor(() => expect(work).toBeEnabled());

    await userEvent.click(work);

    await waitFor(() => expect(runQuestScript).toHaveBeenCalled());
  });

  it('offers to stop, rather than to start, once the script is running', async () => {
    render(<App />);

    const work = await screen.findByRole('button', { name: /work my quests/i });
    await waitFor(() => expect(work).toBeEnabled());
    await userEvent.click(work);

    expect(
      await screen.findByRole('button', { name: /^stop$/i }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('shows a failure as the backend worded it', async () => {
    listDiscordQuests.mockRejectedValue({
      code: 'NOT_SUPPORTED',
      message: 'Discord has to be attached to before its quests can be read',
      retryable: false,
    });

    render(<App />);

    expect(
      await screen.findByText('Discord has to be attached to before its quests can be read'),
    ).toBeInTheDocument();
  });
});
