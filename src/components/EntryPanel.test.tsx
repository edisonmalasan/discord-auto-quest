import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { QuestController } from '../hooks/useQuests';
import type { CatalogEntry, QuestView } from '../types/catalogue';

import { EntryPanel } from './EntryPanel';

vi.mock('../hooks/useStubStates', () => ({
  useStubStates: () => ({}),
}));

function entry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: '356875221078245376',
    name: 'Overwatch',
    aliases: ['OW'],
    coverImageHash: null,
    iconHash: null,
    executables: [
      { os: 'win32', path: '_retail_/overwatch.exe', isLauncher: false },
    ],
    ageRatings: ['esrb:3'],
    ...overrides,
  };
}

function quest(overrides: Partial<QuestView> = {}): QuestView {
  return {
    id: '356875221078245376:_retail_/overwatch.exe',
    appId: '356875221078245376',
    displayName: 'Overwatch',
    stubPath: 'C:\\games\\356875221078245376\\_retail_\\overwatch.exe',
    pid: 4321,
    startedAt: 1_700_000_000,
    running: true,
    state: 'running',
    registeredPath: '_retail_/overwatch.exe',
    ...overrides,
  };
}

function controller(overrides: Partial<QuestController> = {}): QuestController {
  return {
    quests: [],
    ended: [],
    questFor: () => undefined,
    endedFor: () => undefined,
    failureFor: () => undefined,
    busy: false,
    error: null,
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    clearError: vi.fn(),
    ...overrides,
  };
}

describe('EntryPanel', () => {
  it('offers a quest for each registered executable', () => {
    render(
      <EntryPanel
        entry={entry()}
        quests={controller()}
        currentPlatform="win32"
      />,
    );

    expect(screen.getByText('_retail_/overwatch.exe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start quest' })).toBeInTheDocument();
  });

  it('starts a quest for the executable that was chosen', async () => {
    const start = vi.fn(async () => {});
    render(
      <EntryPanel
        entry={entry({
          executables: [
            { os: 'win32', path: '_retail_/overwatch.exe', isLauncher: false },
            { os: 'darwin', path: 'osx64/dota2.app', isLauncher: false },
          ],
        })}
        quests={controller({ start })}
        currentPlatform="win32"
      />,
    );

    const buttons = screen.getAllByRole('button', { name: 'Start quest' });
    await userEvent.click(buttons[1]);

    expect(start).toHaveBeenCalledWith({
      appId: '356875221078245376',
      registeredPath: 'osx64/dota2.app',
    });
  });

  it('shows the pid and a stop control while a quest is running', () => {
    const stop = vi.fn(async () => {});
    render(
      <EntryPanel
        entry={entry()}
        quests={controller({
          quests: [quest()],
          questFor: () => quest(),
          stop,
        })}
        currentPlatform="win32"
      />,
    );

    expect(screen.getByText(/PID/)).toHaveTextContent('4321');
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start quest' })).not.toBeInTheDocument();
  });

  it('explains a quest whose stub was deleted from disk', () => {
    render(
      <EntryPanel
        entry={entry()}
        quests={controller({
          quests: [quest({ running: false, state: 'missing' })],
          questFor: () => quest({ running: false, state: 'missing' }),
        })}
        currentPlatform="win32"
      />,
    );

    expect(screen.getByText(/deleted from disk/)).toBeInTheDocument();
    // The process is still there, so it can still be stopped.
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
  });

  it('reports a failure with the backend\'s own code, next to the game it happened to', () => {
    render(
      <EntryPanel
        entry={entry()}
        quests={controller({
          failureFor: () => ({
            code: 'INVALID_PATH',
            message: 'the registered path contains `>`, which the filesystem will not accept',
            retryable: false,
          }),
        })}
        currentPlatform="win32"
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('INVALID_PATH');
    expect(screen.getByRole('alert')).toHaveTextContent('the filesystem will not accept');
  });

  it('explains that a visible window is part of the mechanism where it is needed', () => {
    render(
      <EntryPanel
        entry={entry()}
        quests={controller()}
        currentPlatform="darwin"
        needsVisibleWindow
      />,
    );

    expect(screen.getByText(/visible window/)).toBeInTheDocument();
  });

  it('says nothing about windows where they are not needed', () => {
    render(
      <EntryPanel
        entry={entry()}
        quests={controller()}
        currentPlatform="win32"
      />,
    );

    expect(screen.queryByText(/visible window/)).not.toBeInTheDocument();
  });

  it('explains an entry that has no registered executable', () => {
    render(
      <EntryPanel
        entry={entry({ executables: [] })}
        quests={controller()}
        currentPlatform="win32"
      />,
    );

    expect(screen.getByText(/no path to mirror/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start quest' })).not.toBeInTheDocument();
  });

  it('says that a quest ended, rather than showing a start control as though nothing happened', () => {
    const ended = quest({ running: false, state: 'ended' });

    render(
      <EntryPanel
        entry={entry()}
        quests={controller({
          ended: [ended],
          endedFor: () => ended,
        })}
        currentPlatform="win32"
      />,
    );

    expect(screen.getByText(/quest for this executable ended/i)).toBeInTheDocument();
    // The quest can be started again: the notice is not the control.
    expect(screen.getByRole('button', { name: 'Start quest' })).toBeInTheDocument();
  });

  it('says nothing about a quest ending where none ended', () => {
    render(
      <EntryPanel
        entry={entry()}
        quests={controller()}
        currentPlatform="win32"
      />,
    );

    expect(screen.queryByText(/quest for this executable ended/i)).not.toBeInTheDocument();
  });

  it('labels a fallback when the platform has no registered executable', () => {
    render(
      <EntryPanel
        entry={entry()}
        quests={controller()}
        currentPlatform="linux"
      />,
    );

    expect(screen.getByText(/No Linux executable is registered/)).toBeInTheDocument();
  });
});
