import Fuse, { type FuseOptionKey } from 'fuse.js';

import type { CatalogEntry } from '../types/catalogue';

/**
 * Trademark symbols that stop a title matching itself.
 *
 * "Pokémon®" has to find "Pokémon", so they are removed from both the indexed
 * values and the query before anything is compared.
 */
const TRADEMARK_SYMBOLS = /[©™®]/g;

/** Remove trademark symbols from a string. */
export function stripSymbols(value: string): string {
  return value.replace(TRADEMARK_SYMBOLS, '');
}

/**
 * The weighted keys.
 *
 * The weights are the ones the upstream study recorded: a title's name dominates, its
 * aliases matter, and a registered executable path is the last resort. The path
 * carries the smallest weight because it is the least specific thing about a game.
 */
export const SEARCH_KEYS: FuseOptionKey<CatalogEntry>[] = [
  {
    name: 'name',
    weight: 0.7,
    getFn: (entry) => [stripSymbols(entry.name)],
  },
  {
    name: 'aliases',
    weight: 0.2,
    getFn: (entry) => entry.aliases.map(stripSymbols),
  },
  {
    name: 'executables.path',
    weight: 0.1,
    getFn: (entry) => entry.executables.map((executable) => stripSymbols(executable.path)),
  },
];

/**
 * Build the search index.
 *
 * The index is built lazily, the first time the visitor types, so opening the app
 * does not pay for it.
 */
export function createSearchIndex(entries: readonly CatalogEntry[]): Fuse<CatalogEntry> {
  return new Fuse(entries as CatalogEntry[], {
    keys: SEARCH_KEYS,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
    threshold: 0.35,
  });
}

/**
 * Search the catalogue.
 *
 * The query is stripped of trademark symbols for the same reason the indexed values
 * are: the two sides of the comparison have to be normalised the same way.
 */
export function searchCatalogue(
  index: Fuse<CatalogEntry>,
  query: string,
  limit: number,
): CatalogEntry[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }
  return index.search(stripSymbols(trimmed), { limit }).map((result) => result.item);
}
