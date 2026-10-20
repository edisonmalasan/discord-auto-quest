import { describe, expect, it } from 'vitest';

import type { CatalogEntry } from '../types/catalogue';

import { createSearchIndex, normalise, searchCatalogue, stripSymbols } from './search';

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

const CATALOGUE: CatalogEntry[] = [
  entry({
    id: '1',
    name: 'Overwatch',
    aliases: ['OW'],
    executables: [
      { os: 'win32', path: '_retail_/overwatch.exe', isLauncher: false },
    ],
  }),
  entry({
    id: '2',
    name: 'Pokémon® Mystery Dungeon',
    aliases: ['PMD'],
    executables: [],
  }),
  entry({
    id: '3',
    name: 'Dota 2',
    executables: [{ os: 'win32', path: 'osx64/dota2.app', isLauncher: false }],
  }),
  entry({ id: '4', name: 'Hollow Knight' }),
];

describe('stripSymbols', () => {
  it('removes trademark symbols', () => {
    expect(stripSymbols('Pokémon® Mystery Dungeon')).toBe('Pokémon Mystery Dungeon');
  });
});

describe('normalise', () => {
  it('folds the accents and the case', () => {
    expect(normalise('Pokémon®')).toBe('pokemon');
  });

  it('keeps the separators, so a path is still a path', () => {
    expect(normalise('osx64/dota2.app')).toBe('osx64/dota2.app');
  });
});

describe('searchCatalogue', () => {
  const index = createSearchIndex(CATALOGUE);

  it('finds a title by name', () => {
    const results = searchCatalogue(index, 'overwatch');
    expect(results.map((result) => result.id)).toEqual(['1']);
  });

  it('finds a title by alias', () => {
    const results = searchCatalogue(index, 'PMD');
    expect(results.map((result) => result.id)).toEqual(['2']);
  });

  it('finds a title by its registered path', () => {
    const results = searchCatalogue(index, 'dota2.app');
    expect(results.map((result) => result.id)).toEqual(['3']);
  });

  it('matches a trademarked title whether or not the query carries the symbol', () => {
    const withSymbol = searchCatalogue(index, 'Pokémon®');
    const withoutSymbol = searchCatalogue(index, 'Pokémon');
    expect(withSymbol.map((result) => result.id)).toEqual(['2']);
    expect(withoutSymbol.map((result) => result.id)).toEqual(['2']);
  });

  it('ignores a query that is too short to be meaningful', () => {
    expect(searchCatalogue(index, 'o')).toEqual([]);
    expect(searchCatalogue(index, '  ')).toEqual([]);
  });

  it('honours the result limit', () => {
    const many = Array.from({ length: 50 }, (_, index) =>
      entry({ id: String(index), name: `Quest ${index}` }),
    );
    expect(searchCatalogue(createSearchIndex(many), 'quest', 5)).toHaveLength(5);
  });

  it('returns every match when there is no limit', () => {
    const many = Array.from({ length: 50 }, (_, index) =>
      entry({ id: String(index), name: `Quest ${index}` }),
    );
    expect(searchCatalogue(createSearchIndex(many), 'quest')).toHaveLength(50);
  });

  it('returns nothing when the catalogue is empty', () => {
    expect(searchCatalogue(createSearchIndex([]), 'anything')).toEqual([]);
  });

  it('ranks an exact title first, then a prefix, then a title that contains it', () => {
    const many = [
      entry({ id: 'a', name: 'The Elder Scrolls' }),
      entry({ id: 'b', name: 'Skyrim' }),
      entry({ id: 'c', name: 'Elder Scrolls Online' }),
    ];
    const results = searchCatalogue(createSearchIndex(many), 'elder scrolls');
    expect(results.map((result) => result.id)).toEqual(['c', 'a']);
  });

  it('finds a misspelling through the fuzzy fallback', () => {
    const results = searchCatalogue(index, 'overwtch');
    expect(results.map((result) => result.id)).toContain('1');
  });

  it('answers a large catalogue quickly', () => {
    const many = Array.from({ length: 25000 }, (_, position) =>
      entry({
        id: String(position),
        name: `Some Game Title ${position} Deluxe Edition`,
        executables: [
          { os: 'win32', path: `_retail_/game${position}.exe`, isLauncher: false },
        ],
      }),
    );
    const large = createSearchIndex(many);

    const started = performance.now();
    const results = searchCatalogue(large, 'deluxe');
    const elapsed = performance.now() - started;

    expect(results.length).toBe(25000);
    // A quarter of a second is a long time to wait for a keystroke.
    expect(elapsed).toBeLessThan(250);
  });
});
