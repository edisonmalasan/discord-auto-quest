import { describe, expect, it } from 'vitest';

import type { CatalogEntry } from '../types/catalogue';

import { createSearchIndex, searchCatalogue, stripSymbols } from './search';

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

describe('searchCatalogue', () => {
  const index = createSearchIndex(CATALOGUE);

  it('finds a title by name', () => {
    const results = searchCatalogue(index, 'overwatch', 10);
    expect(results.map((result) => result.id)).toEqual(['1']);
  });

  it('finds a title by alias', () => {
    const results = searchCatalogue(index, 'PMD', 10);
    expect(results.map((result) => result.id)).toEqual(['2']);
  });

  it('finds a title by its registered path', () => {
    const results = searchCatalogue(index, 'dota2.app', 10);
    expect(results.map((result) => result.id)).toEqual(['3']);
  });

  it('matches a trademarked title whether or not the query carries the symbol', () => {
    const withSymbol = searchCatalogue(index, 'Pokémon®', 10);
    const withoutSymbol = searchCatalogue(index, 'Pokémon', 10);
    expect(withSymbol.map((result) => result.id)).toEqual(['2']);
    expect(withoutSymbol.map((result) => result.id)).toEqual(['2']);
  });

  it('ignores a query that is too short to be meaningful', () => {
    expect(searchCatalogue(index, 'o', 10)).toEqual([]);
    expect(searchCatalogue(index, '  ', 10)).toEqual([]);
  });

  it('honours the result limit', () => {
    const many = Array.from({ length: 50 }, (_, index) =>
      entry({ id: String(index), name: `Quest ${index}` }),
    );
    expect(searchCatalogue(createSearchIndex(many), 'quest', 5)).toHaveLength(5);
  });

  it('returns nothing when the catalogue is empty', () => {
    expect(searchCatalogue(createSearchIndex([]), 'anything', 10)).toEqual([]);
  });
});
