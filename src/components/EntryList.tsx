import { useEffect, useRef, useState } from 'react';

import type { CatalogEntry, QuestView } from '../types/catalogue';

import { EntryRow } from './EntryRow';

/** How many lines are rendered at a time. */
const PAGE = 120;

interface EntryListProps {
  entries: CatalogEntry[];
  selectedId: string | null;
  quests: QuestView[];
  onSelect: (entry: CatalogEntry) => void;
  /** Why the list is empty, when it is. */
  emptyReason: string | null;
}

/**
 * The index.
 *
 * A catalogue of ~25,000 entries is not rendered at once. Lines are added as the
 * visitor reaches the end, so the list stays responsive without capping what they
 * can reach.
 */
export function EntryList({
  entries,
  selectedId,
  quests,
  onSelect,
  emptyReason,
}: EntryListProps) {
  const [visible, setVisible] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisible(PAGE);
  }, [entries]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver(
      (records) => {
        if (records.some((record) => record.isIntersecting)) {
          setVisible((current) => current + PAGE);
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div className="px-5 py-16">
        <p className="max-w-[42ch] text-[13px] leading-relaxed text-ink-2">
          {emptyReason ?? 'Nothing to show.'}
        </p>
      </div>
    );
  }

  const shown = entries.slice(0, visible);

  return (
    <div>
      <ul>
        {shown.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            selected={entry.id === selectedId}
            quest={questFor(quests, entry)}
            onSelect={onSelect}
          />
        ))}
      </ul>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      {visible < entries.length ? (
        <p className="px-5 py-3 text-[11px] text-ink-3">
          Showing {shown.length.toLocaleString('en-US')} of{' '}
          {entries.length.toLocaleString('en-US')} — scroll for more
        </p>
      ) : null}
    </div>
  );
}

/** The quest running for an entry, if there is one. */
function questFor(quests: QuestView[], entry: CatalogEntry): QuestView | undefined {
  return quests.find(
    (quest) =>
      quest.running &&
      quest.appId === entry.id &&
      entry.executables.some((executable) => executable.path === quest.registeredPath),
  );
}

/**
 * The loading state.
 *
 * Skeleton lines, not a blank screen: the shape of the index is visible before the
 * catalogue arrives.
 */
export function SkeletonList({ rows = 14 }: { rows?: number }) {
  return (
    <ul aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li
          key={index}
          className="flex items-center gap-3 border-b border-rule-soft px-5 py-2"
        >
          <span className="size-2.5 rounded-[1px] bg-rule" />
          <span className="size-9 shrink-0 rounded-[2px] bg-surface-2" />
          <span
            className="h-2.5 rounded-[2px] bg-surface-2"
            style={{ width: `${28 + ((index * 13) % 26)}%` }}
          />
          <span
            className="ml-auto h-2.5 w-[22%] rounded-[2px] bg-rule"
            style={{ opacity: 1 - index * 0.05 }}
          />
        </li>
      ))}
    </ul>
  );
}
