import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppErrorShape, CatalogueSnapshot } from '../types/catalogue';

import { useCatalogue } from './useCatalogue';

const loadCatalogue = vi.fn<() => Promise<CatalogueSnapshot>>();
const refreshCatalogue = vi.fn<() => Promise<CatalogueSnapshot>>();

vi.mock('../lib/ipc', () => ({
  loadCatalogue: () => loadCatalogue(),
  refreshCatalogue: () => refreshCatalogue(),
  onCatalogueUpdated: () => Promise.resolve(() => {}),
  onCatalogueRefreshFailed: () => Promise.resolve(() => {}),
  toAppError: (value: unknown): AppErrorShape => {
    if (typeof value === 'object' && value !== null && 'code' in value) {
      return value as AppErrorShape;
    }
    return { code: 'UNKNOWN', message: String(value), retryable: true };
  },
}));

const SNAPSHOT: CatalogueSnapshot = {
  entries: [],
  stats: {
    total: 0,
    questable: 0,
    notQuestable: 0,
    questableRatio: 0,
    platformSplits: [],
    withCoverArt: 0,
    withIcon: 0,
    withAliases: 0,
    droppedEntries: 0,
  },
  source: 'network',
  fetchedAt: 1_700_000_000,
  stale: false,
};

describe('useCatalogue', () => {
  beforeEach(() => {
    loadCatalogue.mockReset();
    refreshCatalogue.mockReset();
  });

  it('loads the catalogue on mount', async () => {
    loadCatalogue.mockResolvedValue(SNAPSHOT);

    const { result } = renderHook(() => useCatalogue());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.snapshot).toEqual(SNAPSHOT);
    expect(result.current.error).toBeNull();
  });

  it('reports a failure instead of showing an empty catalogue', async () => {
    loadCatalogue.mockRejectedValue({
      code: 'NETWORK_UNAVAILABLE',
      message: 'could not reach Discord',
      retryable: true,
    });

    const { result } = renderHook(() => useCatalogue());

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.code).toBe('NETWORK_UNAVAILABLE');
    expect(result.current.error?.retryable).toBe(true);
    expect(result.current.snapshot).toBeNull();
  });

  it('replaces the catalogue when a refresh succeeds', async () => {
    loadCatalogue.mockResolvedValue(SNAPSHOT);
    const fresh = { ...SNAPSHOT, source: 'network' as const, fetchedAt: 1_700_000_100 };
    refreshCatalogue.mockResolvedValue(fresh);

    const { result } = renderHook(() => useCatalogue());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(result.current.snapshot?.fetchedAt).toBe(1_700_000_100);
    expect(result.current.refreshError).toBeNull();
  });

  it('keeps the catalogue on screen when a refresh fails', async () => {
    loadCatalogue.mockResolvedValue(SNAPSHOT);
    refreshCatalogue.mockRejectedValue({
      code: 'NETWORK_UNAVAILABLE',
      message: 'offline',
      retryable: true,
    });

    const { result } = renderHook(() => useCatalogue());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.refreshError).not.toBeNull());
    expect(result.current.snapshot).toEqual(SNAPSHOT);
    expect(result.current.status).toBe('ready');
  });
});
