import { platformLabel } from '../lib/format';
import type { CatalogEntry, QuestView } from '../types/catalogue';

import { CoverImage } from './CoverImage';
import { DetectedMark, SelectionCaret, UndetectedMark } from './Marks';

interface EntryRowProps {
  entry: CatalogEntry;
  selected: boolean;
  quest?: QuestView;
  onSelect: (entry: CatalogEntry) => void;
}

/**
 * One line of the index.
 *
 * The line reads left to right: the selection pointer, the detection mark, the
 * cover, the title, the registered path, the platform, and whether a quest is
 * running. The path is in the line because the path is the mechanism.
 */
export function EntryRow({ entry, selected, quest, onSelect }: EntryRowProps) {
  const detected = entry.executables.length > 0;
  const primary = entry.executables[0];

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(entry)}
        aria-current={selected ? 'true' : undefined}
        className={`grid w-full grid-cols-[14px_10px_36px_minmax(6rem,1.1fr)_minmax(0,1fr)_auto_58px] items-center gap-x-3 border-b border-rule-soft px-5 py-2 text-left transition-colors duration-150 ${
          selected ? 'bg-surface-2' : 'hover:bg-surface'
        }`}
      >
        <span className="flex h-3 items-center justify-center">
          {selected ? <SelectionCaret className="h-3 w-2" /> : null}
        </span>

        <span className="flex items-center">
          {detected ? (
            <DetectedMark className="size-[8px]" />
          ) : (
            <UndetectedMark className="size-[8px]" />
          )}
        </span>

        <CoverImage entry={entry} size={36} />

        <span className="min-w-0 truncate text-[13px] font-medium text-ink">
          {entry.name}
        </span>

        <span className="min-w-0 truncate font-mono text-[11px] text-ink-3">
          {primary ? primary.path : '—'}
        </span>

        <span className="ml-1 text-[10px] font-medium uppercase tracking-[0.09em] text-ink-3">
          {primary ? platformLabel(primary.os) : 'none'}
        </span>

        <span className="text-right text-[10px] font-medium uppercase tracking-[0.09em]">
          {quest?.running ? (
            <span className="text-spot" title={`PID ${quest.pid}`}>
              Running
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
