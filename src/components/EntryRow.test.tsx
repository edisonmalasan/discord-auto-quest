import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CatalogEntry } from '../types/catalogue';

import { EntryRow } from './EntryRow';

function entry(overrides: Partial<CatalogEntry> & { id: string; name: string }): CatalogEntry {
  return {
    aliases: [],
    coverImageHash: null,
    iconHash: null,
    executables: [],
    ageRatings: [],
    ...overrides,
  };
}

describe('EntryRow', () => {
  it('prints the title and the registered path', () => {
    render(
      <ul>
        <EntryRow
          entry={entry({
            id: '1',
            name: 'Overwatch',
            executables: [
              { os: 'win32', path: '_retail_/overwatch.exe', isLauncher: false },
            ],
          })}
          selected={false}
          onSelect={() => {}}
        />
      </ul>,
    );

    expect(screen.getByText('Overwatch')).toBeInTheDocument();
    expect(screen.getByText('_retail_/overwatch.exe')).toBeInTheDocument();
    expect(screen.getByText('Windows')).toBeInTheDocument();
  });

  it('shows a dash in the path column for a title Discord never detected', () => {
    render(
      <ul>
        <EntryRow
          entry={entry({ id: '2', name: 'Hollow Knight' })}
          selected={false}
          onSelect={() => {}}
        />
      </ul>,
    );

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('none')).toBeInTheDocument();
  });

  it('marks a title with no registered executable as not questable', () => {
    render(
      <ul>
        <EntryRow
          entry={entry({ id: '2', name: 'Hollow Knight' })}
          selected={false}
          onSelect={() => {}}
        />
      </ul>,
    );

    expect(screen.getByText('No path')).toBeInTheDocument();
  });

  it('reports the entry when it is clicked', () => {
    const onSelect = vi.fn();
    render(
      <ul>
        <EntryRow
          entry={entry({ id: '3', name: 'Dota 2' })}
          selected={false}
          onSelect={onSelect}
        />
      </ul>,
    );

    screen.getByText('Dota 2').click();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('marks the selected line for assistive technology', () => {
    render(
      <ul>
        <EntryRow
          entry={entry({ id: '4', name: 'Selected' })}
          selected
          onSelect={() => {}}
        />
      </ul>,
    );

    expect(screen.getByRole('button', { name: /Selected/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});
