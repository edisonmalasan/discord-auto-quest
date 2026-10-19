import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CatalogueSnapshot } from '../types/catalogue';

import { StatusHeader } from './StatusHeader';

function snapshot(overrides: Partial<CatalogueSnapshot> = {}): CatalogueSnapshot {
  return {
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
    ...overrides,
  };
}

describe('StatusHeader', () => {
  it('says the catalogue came from Discord', () => {
    render(
      <StatusHeader
        status="ready"
        snapshot={snapshot()}
        refreshing={false}
        refreshError={null}
        onRefresh={() => {}}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Live from Discord');
  });

  it('says when the catalogue is a cached copy', () => {
    render(
      <StatusHeader
        status="ready"
        snapshot={snapshot({ source: 'cache' })}
        refreshing={false}
        refreshError={null}
        onRefresh={() => {}}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Cached copy');
    expect(screen.getByRole('status')).not.toHaveTextContent('Live from Discord');
  });

  it('reports a failed refresh without claiming the catalogue is live', () => {
    render(
      <StatusHeader
        status="ready"
        snapshot={snapshot({ source: 'cache' })}
        refreshing={false}
        refreshError={{ code: 'NETWORK_UNAVAILABLE', message: 'offline', retryable: true }}
        onRefresh={() => {}}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Refresh failed');
  });

  it('disables the refresh button while a refresh is in flight', () => {
    render(
      <StatusHeader
        status="ready"
        snapshot={snapshot()}
        refreshing
        refreshError={null}
        onRefresh={() => {}}
      />,
    );

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('refreshes when asked', () => {
    const onRefresh = vi.fn();
    render(
      <StatusHeader
        status="ready"
        snapshot={snapshot()}
        refreshing={false}
        refreshError={null}
        onRefresh={onRefresh}
      />,
    );

    screen.getByRole('button').click();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
