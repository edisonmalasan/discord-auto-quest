import type { CatalogEntry } from '../types/catalogue';

/**
 * Discord's CDN serves cover art and icons from the same path shape, keyed by the
 * application id and the hash the catalogue carries.
 */
const CDN_BASE = 'https://cdn.discordapp.com/app-icons';

export function assetUrl(appId: string, hash: string): string {
  return `${CDN_BASE}/${appId}/${hash}.png`;
}

/** The cover art for an entry, or null when the catalogue carries none. */
export function coverUrl(entry: CatalogEntry): string | null {
  if (!entry.coverImageHash) {
    return null;
  }
  return assetUrl(entry.id, entry.coverImageHash);
}

/** The icon for an entry, or null when the catalogue carries none. */
export function iconUrl(entry: CatalogEntry): string | null {
  if (!entry.iconHash) {
    return null;
  }
  return assetUrl(entry.id, entry.iconHash);
}

/**
 * The artwork for an entry.
 *
 * The cover art is the plate and the icon is the mark, so the cover is preferred
 * where both exist. An entry with neither falls back to the initial, which is a
 * real name rather than a picture of nothing.
 */
export function artworkUrl(entry: CatalogEntry): string | null {
  return coverUrl(entry) ?? iconUrl(entry);
}
