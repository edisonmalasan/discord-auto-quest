import Fuse, { type FuseOptionKey } from 'fuse.js';

import type { CatalogEntry } from '../types/catalogue';

/**
 * Trademark symbols that stop a title matching itself.
 *
 * "Pokémon®" has to find "Pokémon", so they are removed from both the indexed
 * values and the query before anything is compared.
 */
const TRADEMARK_SYMBOLS = /[©™®]/g;

/** The diacritics that would otherwise stop a title matching itself. */
const DIACRITICS = /\p{Diacritic}/gu;

/** The shortest query that can mean anything. */
export const MIN_QUERY_LENGTH = 2;

/**
 * Normalise a value for comparison.
 *
 * The two sides of a comparison have to be normalised the same way, so the query
 * and the indexed values go through the same function: trademark symbols go, the
 * accents fold, and the case goes.
 */
export function normalise(value: string): string {
  return value
    .replace(TRADEMARK_SYMBOLS, '')
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase();
}

/**
 * Remove trademark symbols from a string.
 *
 * Kept as its own name because the catalogue's own values are compared against
 * each other, not only against a query.
 */
export function stripSymbols(value: string): string {
  return value.replace(TRADEMARK_SYMBOLS, '');
}

/** What a search holds. */
export interface SearchIndex {
  /** The entries, in catalogue order. */
  readonly entries: readonly CatalogEntry[];
  /** One normalised haystack per entry, carrying every searchable field. */
  readonly haystacks: readonly string[];
  /** The normalised name of each entry, for ranking. */
  readonly names: readonly string[];
  /**
   * The fuzzy index, built only if it is ever needed.
   *
   * Scanning is what answers almost every query, and it costs about two
   * milliseconds over the whole catalogue. The fuzzy index is the fallback for a
   * query that matches nothing exactly — a typo — and building it costs a third
   * of a second, so it is not paid for by a query that does not need it.
   */
  fuzzy: Fuse<CatalogEntry> | null;
}

/** The weighted keys, for the fuzzy fallback. */
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
 * The index is built once, from the catalogue that was actually loaded. It holds
 * one normalised string per entry, which is what a query is matched against.
 */
export function createSearchIndex(entries: readonly CatalogEntry[]): SearchIndex {
  const haystacks: string[] = [];
  const names: string[] = [];

  for (const entry of entries) {
    const parts: string[] = [entry.name, ...entry.aliases];
    for (const executable of entry.executables) {
      parts.push(executable.path);
    }
    haystacks.push(normalise(parts.join(' ')));
    names.push(normalise(entry.name));
  }

  return { entries, haystacks, names, fuzzy: null };
}

/**
 * How well an entry matches a query.
 *
 * The order is the one the catalogue reads in: the title itself, then its
 * aliases, then the registered path. A path is the least specific thing about a
 * game, so it is the last resort.
 */
const RANK_NAME_EXACT = 0;
const RANK_NAME_PREFIX = 1;
const RANK_NAME_INSIDE = 2;
const RANK_ALIAS = 3;
const RANK_PATH = 4;
const RANK_NONE = 5;

function rank(entry: CatalogEntry, name: string, needle: string): number {
  if (name === needle) {
    return RANK_NAME_EXACT;
  }
  if (name.startsWith(needle)) {
    return RANK_NAME_PREFIX;
  }
  if (name.includes(needle)) {
    return RANK_NAME_INSIDE;
  }
  if (entry.aliases.some((alias) => normalise(alias).includes(needle))) {
    return RANK_ALIAS;
  }
  for (const executable of entry.executables) {
    if (normalise(executable.path).includes(needle)) {
      return RANK_PATH;
    }
  }
  return RANK_NONE;
}

/**
 * Search the catalogue.
 *
 * Every match is returned. The list that shows them pages through what it is
 * given, so a query that matches a tenth of the catalogue is browsable rather
 * than truncated.
 */
export function searchCatalogue(
  index: SearchIndex,
  query: string,
  limit?: number,
): CatalogEntry[] {
  const needle = normalise(query.trim());
  if (needle.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const matched: { position: number; rank: number }[] = [];

  for (let position = 0; position < index.haystacks.length; position += 1) {
    if (!index.haystacks[position].includes(needle)) {
      continue;
    }
    const entry = index.entries[position];
    const score = rank(entry, index.names[position], needle);
    if (score !== RANK_NONE) {
      matched.push({ position, rank: score });
    }
  }

  if (matched.length === 0) {
    return fuzzySearch(index, query, limit);
  }

  // The rank decides the order; the name's length breaks a tie, so a shorter
  // title is the more likely one the reader meant.
  matched.sort((left, right) => {
    if (left.rank !== right.rank) {
      return left.rank - right.rank;
    }
    const leftName = index.names[left.position];
    const rightName = index.names[right.position];
    if (leftName.length !== rightName.length) {
      return leftName.length - rightName.length;
    }
    return left.position - right.position;
  });

  const limit_ = limit ?? matched.length;
  return matched.slice(0, limit_).map((match) => index.entries[match.position]);
}

/**
 * The fuzzy search, for a query that matches nothing exactly.
 *
 * This is the fallback for a typo, and it is the only place the catalogue is
 * scored against a query by similarity rather than by containment. The index is
 * built on first use and kept.
 */
function fuzzySearch(
  index: SearchIndex,
  query: string,
  limit?: number,
): CatalogEntry[] {
  if (!index.fuzzy) {
    index.fuzzy = new Fuse(index.entries as CatalogEntry[], {
      keys: SEARCH_KEYS,
      ignoreLocation: true,
      minMatchCharLength: MIN_QUERY_LENGTH,
      threshold: 0.35,
    });
  }

  return index.fuzzy
    .search(stripSymbols(query.trim()), limit ? { limit } : undefined)
    .map((result) => result.item);
}
