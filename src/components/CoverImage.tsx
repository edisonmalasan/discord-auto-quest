import { useState } from 'react';

import { coverUrl } from '../lib/assets';
import type { CatalogEntry } from '../types/catalogue';

/**
 * A catalogue entry's cover art.
 *
 * The artwork is decorative: the name is always beside it, so it carries no
 * information of its own and is marked as such for a screen reader.
 *
 * Not every entry has cover art, and a missing image on Discord's CDN must not
 * leave a broken frame in the index, so a failed load falls back to the mark.
 */
export function CoverImage({
  entry,
  size,
  className = '',
}: {
  entry: CatalogEntry;
  size: number;
  className?: string;
}) {
  const url = coverUrl(entry);
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
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
