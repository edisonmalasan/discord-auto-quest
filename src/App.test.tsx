import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CatalogueSnapshot } from './types/catalogue';

const loadCatalogue = vi.fn<() => Promise<CatalogueSnapshot>>();
const refreshCatalogue = vi.fn<() => Promise<CatalogueSnapshot>>();

vi.mock('./lib/ipc', () => ({
  loadCatalogue: () => loadCatalogue(),
  refreshCatalogue: () => refreshCatalogue(),
  onCatalogueUpdated: () => Promise.resolve(() => {}),
  onCatalogueRefreshFailed: () => Promise.resolve(() => {}),
  stubRoot: () => Promise.resolve('C:\\Users\\ed\\AppData\\Local\\discord-auto-quest\\games'),
  currentPlatform: () => Promise.resolve('win32'),
  listQuests: () => Promise.resolve([]),
  onQuestsChanged: () => Promise.resolve(() => {}),
  startQuest: () => Promise.reject(new Error('not used in this test')),
  stopQuest: () => Promise.reject(new Error('not used in this test')),
  isAppError: (value: unknown) => typeof value === 'object' && value !== null && 'code' in value,
  toAppError: (value: unknown) =>
    typeof value === 'object' && value !== null && 'code' in value
      ? value
      : { code: 'UNKNOWN', message: String(value), retryable: true },
}));

const { default: App } = await import('./App');

function snapshot(overrides: Partial<CatalogueSnapshot> = {}): CatalogueSnapshot {
  return {
    entries: [
      {
        id: '1',
        name: 'Overwatch',
        aliases: ['OW'],
        coverImageHash: null,
        iconHash: null,
        executables: [{ os: 'win32', path: '_retail_/overwatch.exe', isLauncher: false }],
        ageRatings: ['esrb:3'],
      },
      {
        id: '2',
        name: 'Hollow Knight',
        aliases: [],
        coverImageHash: null,
        iconHash: null,
        executables: [],
        ageRatings: [],
      },
    ],
    stats: {
      total: 2,
      questable: 1,
      notQuestable: 1,
      questableRatio: 0.5,
      platformSplits: [{ os: 'win32', executables: 1 }],
      withCoverArt: 0,
      withIcon: 0,
      withAliases: 1,
      droppedEntries: 0,
    },
    source: 'network',
    fetchedAt: 1_700_000_000,
    stale: false,
    ...overrides,
  };
}

describe('App', () => {
  beforeEach(() => {
    loadCatalogue.mockReset();
    refreshCatalogue.mockReset();
  });

  it('renders the index with the catalogue it was given', async () => {
    loadCatalogue.mockResolvedValue(snapshot());

    render(<App />);

    expect(await screen.findByText('Overwatch')).toBeInTheDocument();
    expect(screen.getByText('_retail_/overwatch.exe')).toBeInTheDocument();
    expect(screen.getByText('Hollow Knight')).toBeInTheDocument();
  });

  it('shows counts derived from the catalogue, not from constants', async () => {
    loadCatalogue.mockResolvedValue(snapshot());

    render(<App />);

    await screen.findByText('Overwatch');
    // The scope filter carries the derived counts.
    expect(screen.getByRole('button', { name: /Questable/ })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /Not questable/ })).toHaveTextContent('1');
    expect(screen.getByText('50.0%')).toBeInTheDocument();
  });

  it('says the catalogue is live when it came from Discord', async () => {
    loadCatalogue.mockResolvedValue(snapshot());

    render(<App />);

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Live from Discord'),
    );
  });

  it('says the catalogue is cached when it came from the cache', async () => {
    loadCatalogue.mockResolvedValue(snapshot({ source: 'cache' }));

    render(<App />);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cached copy'));
    expect(screen.getByRole('status')).not.toHaveTextContent('Live from Discord');
  });

  it('explains a failure instead of showing an empty catalogue', async () => {
    loadCatalogue.mockRejectedValue({
      code: 'NETWORK_UNAVAILABLE',
      message: 'could not reach Discord',
      retryable: true,
    });

    render(<App />);

    expect(await screen.findByText('Discord could not be reached')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
    expect(screen.queryByText('Overwatch')).not.toBeInTheDocument();
  });

  it('filters the index down to the entries that have a registered executable', async () => {
    loadCatalogue.mockResolvedValue(snapshot());

    render(<App />);
    await screen.findByText('Overwatch');

    screen.getByRole('button', { name: /^Questable/ }).click();

    await waitFor(() => expect(screen.queryByText('Hollow Knight')).not.toBeInTheDocument());
    expect(screen.getByText('Overwatch')).toBeInTheDocument();
  });
});
