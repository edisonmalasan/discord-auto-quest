import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DiscordStatus, QuestFeed } from './types/quests';

const discordStatus = vi.fn<() => Promise<DiscordStatus>>();
const listDiscordQuests = vi.fn<() => Promise<QuestFeed>>();
const runQuestScript = vi.fn<() => Promise<boolean>>();
const stopQuestScript = vi.fn<() => Promise<void>>();
const relaunchDiscord = vi.fn<() => Promise<void>>();
const attachDiscord = vi.fn<() => Promise<void>>();

vi.mock('./lib/ipc', () => ({
  discordStatus: () => discordStatus(),
  listDiscordQuests: () => listDiscordQuests(),
  runQuestScript: () => runQuestScript(),
  stopQuestScript: () => stopQuestScript(),
  relaunchDiscord: () => relaunchDiscord(),
  attachDiscord: () => attachDiscord(),
  appVersion: () => Promise.resolve('0.1.0'),
  isAppError: (value: unknown) => typeof value === 'object' && value !== null && 'code' in value,
  toAppError: (value: unknown) =>
    typeof value === 'object' && value !== null && 'code' in value
      ? value
      : { code: 'UNKNOWN', message: String(value), retryable: true },
}));

const { default: App } = await import('./App');

function ready(overrides: Partial<DiscordStatus> = {}): DiscordStatus {
  return {
    installed: true,
    ready: true,
    action: null,
    profile: 'C:\\Users\\ed\\AppData\\Roaming\\discord',
    ...overrides,
  };
}

function feed(overrides: Partial<QuestFeed> = {}): QuestFeed {
  return {
    available: [
      {
        id: '1558176501663272961',
        name: 'Clean Crew',
        tasks: ['PLAY_ON_DESKTOP'],
        expiresAt: '2026-10-25T00:00:00+00:00',
        state: 'available',
        progressSeconds: 0,
        targetSeconds: 900,
        rewardOrbs: 700,
      },
    ],
    claimed: [
      {
        id: '1556778857481113610',
        name: 'Deadzone Rogue 2',
        tasks: ['PLAY_ON_DESKTOP'],
        expiresAt: '2026-10-23T00:00:00+00:00',
        state: 'claimed',
        progressSeconds: 612,
        targetSeconds: 900,
        rewardOrbs: 700,
      },
    ],
    expired: 64,
    desktopApp: true,
    runningGames: [],
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
    attachDiscord.mockReset();

    discordStatus.mockResolvedValue(ready());
    listDiscordQuests.mockResolvedValue(feed());
    runQuestScript.mockResolvedValue(true);
    stopQuestScript.mockResolvedValue(undefined);
    relaunchDiscord.mockResolvedValue(undefined);
    attachDiscord.mockResolvedValue(undefined);
  });

  it('never claims to be working a quest it is not working', async () => {
    // The quest is counting — but the application did not start it, so it
    // must not say it is working it.
    listDiscordQuests.mockResolvedValue(
      feed({
        available: [],
        claimed: [
          {
            id: '1',
            name: 'RuneScape: Dragonwilds Mission',
            tasks: ['ACHIEVEMENT_IN_ACTIVITY'],
            expiresAt: '2026-09-22T00:00:00+00:00',
            state: 'claimed',
            progressSeconds: 0,
            targetSeconds: 1,
            rewardOrbs: 700,
          },
        ],
      }),
    );

    render(<App />);

    await screen.findByText('RuneScape: Dragonwilds Mission');
    expect(screen.queryByText('Working…')).not.toBeInTheDocument();
  });

  it('shows the quests Discord has, in two columns', async () => {
    render(<App />);

    const onOffer = (await screen.findByRole('heading', { name: /on offer/i })).closest('section');
    const accepted = screen.getByRole('heading', { name: /accepted/i }).closest('section');

    expect(onOffer).not.toBeNull();
    expect(accepted).not.toBeNull();
    expect(within(onOffer as HTMLElement).getByText('Clean Crew')).toBeInTheDocument();
    expect(within(accepted as HTMLElement).getByText('Deadzone Rogue 2')).toBeInTheDocument();
  });

  it('shows how far along a quest is, in Discord’s own numbers', async () => {
    render(<App />);

    await screen.findByText('Deadzone Rogue 2');

    expect(screen.getByText('612 / 900s')).toBeInTheDocument();
  });

  it('never says a quest is finished unless Discord says so', async () => {
    listDiscordQuests.mockResolvedValue(
      feed({
        claimed: [
          {
            id: '1',
            name: 'Deadzone Rogue 2',
            tasks: ['PLAY_ON_DESKTOP'],
            expiresAt: null,
            state: 'completed',
            progressSeconds: 900,
            targetSeconds: 900,
            rewardOrbs: 700,
          },
        ],
      }),
    );

    render(<App />);

    expect(await screen.findByText(/Finished — claim the reward in Discord\./)).toBeInTheDocument();
  });

  it('says what the user still has to do for a quest that needs them', async () => {
    listDiscordQuests.mockResolvedValue(
      feed({
        claimed: [
          {
            id: '1',
            name: 'A streaming quest',
            tasks: ['STREAM_ON_DESKTOP'],
            expiresAt: null,
            state: 'claimed',
            progressSeconds: 30,
            targetSeconds: 900,
            rewardOrbs: 700,
          },
        ],
      }),
    );

    render(<App />);

    expect(
      await screen.findByText(/Be in a voice channel with somebody while this counts\./),
    ).toBeInTheDocument();
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
    // Nothing is counting, so the button offers to work the quests.
    listDiscordQuests.mockResolvedValue(feed({ claimed: [] }));

    render(<App />);

    const button = await screen.findByRole(
      'button',
      { name: /work my quests/i },
      { timeout: 5000 },
    );
    await waitFor(() => expect(button).toBeEnabled(), { timeout: 5000 });

    await userEvent.click(button);

    await waitFor(() => expect(runQuestScript).toHaveBeenCalled());
  });

  it('offers to stop, rather than to start, once the script is running', async () => {
    render(<App />);

    const work = await screen.findByRole(
      'button',
      { name: /work my quests/i },
      { timeout: 5000 },
    );
    await waitFor(() => expect(work).toBeEnabled(), { timeout: 5000 });

    await userEvent.click(work);

    await waitFor(() => expect(runQuestScript).toHaveBeenCalled());

    expect(
      await screen.findByRole('button', { name: /^stop$/i }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /work my quests/i })).not.toBeInTheDocument();
  });

  it('offers to work the quests even when one of them is counting', async () => {
    // The button is about what the *application* is doing, not about what
    // Discord is counting. A quest left counting by an earlier run is not
    // something this window started, and the way to deal with it is to run the
    // script again.
    render(<App />);

    expect(
      await screen.findByRole('button', { name: /work my quests/i }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('says the browser cannot be used, because the script needs the desktop app', async () => {
    listDiscordQuests.mockResolvedValue(feed({ desktopApp: false }));

    render(<App />);

    expect(
      await screen.findByText(/needs the Discord desktop application, not Discord in a browser/i),
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
