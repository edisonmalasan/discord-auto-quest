import { useState } from 'react';

import { artworkUrl, coverUrl, iconUrl } from '../lib/assets';
import type { CatalogEntry } from '../types/catalogue';

interface ArtworkProps {
  entry: CatalogEntry;
  size: number;
  className?: string;
}

/**
 * A catalogue entry's cover art.
 *
 * The artwork is decorative: the name is always beside it, so it carries no
 * information of its own and is marked as such for a screen reader.
 *
 * Not every entry has cover art, and a missing image on Discord's CDN must not
 * leave a broken frame in the index, so a failed load falls back to the mark.
 */
export function CoverImage({ entry, size, className = '' }: ArtworkProps) {
  const url = coverUrl(entry);
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return <Mark entry={entry} size={size} className={className} />;
  }

  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-[2px] object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * The artwork for an entry, whatever it happens to be.
 *
 * The cover art is the plate and the icon is the mark, so the cover is preferred
 * where both exist. An entry that carries only an icon still gets a picture: 3,086
 * of the 24,725 entries in the live catalogue are in exactly that position.
 */
export function Artwork({ entry, size, className = '' }: ArtworkProps) {
  const url = artworkUrl(entry);
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return <Mark entry={entry} size={size} className={className} />;
  }

  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-[2px] object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * A catalogue entry's icon.
 *
 * The icon is the small square mark Discord carries for the application. It is
 * shown beside the cover art in the fact panel, and it is the artwork for the
 * entries that have an icon but no cover.
 */
export function IconImage({ entry, size, className = '' }: ArtworkProps) {
  const url = iconUrl(entry);
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return null;
  }

  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-[2px] object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * The mark that stands in for artwork the catalogue does not carry.
 *
 * It is the entry's initial, which is a real fact about the entry rather than a
 * picture of nothing.
 */
function Mark({ entry, size, className }: { entry: CatalogEntry; size: number; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-[2px] border border-rule bg-surface-2 text-[13px] font-medium text-ink-3 ${className}`}
      style={{ width: size, height: size }}
    >
      {entry.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
