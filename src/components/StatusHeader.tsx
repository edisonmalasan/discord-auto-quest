import type { CatalogueStatus } from '../hooks/useCatalogue';
import { formatAge } from '../lib/format';
import type { AppErrorShape, CatalogueSnapshot } from '../types/catalogue';

import { AppMark } from './AppMark';
import { RefreshIcon } from './Icons';

interface StatusHeaderProps {
  status: CatalogueStatus;
  snapshot: CatalogueSnapshot | null;
  refreshing: boolean;
  refreshError: AppErrorShape | null;
  onRefresh: () => void;
}

type Tone = 'ink' | 'warn' | 'danger';

const TONE_CLASS: Record<Tone, string> = {
  ink: 'text-ink-2',
  warn: 'text-warn',
  danger: 'text-danger',
};

/**
 * The header says where the catalogue came from and when it arrived.
 *
 * It always uses the same words: live from Discord, or a cached copy of a stated age.
 * The app never shows a catalogue without saying which of the two it is showing.
 */
export function StatusHeader({
  status,
  snapshot,
  refreshing,
  refreshError,
  onRefresh,
}: StatusHeaderProps) {
  const { text, tone } = describe(status, snapshot, refreshing, refreshError);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-6 border-b border-rule px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <AppMark className="size-6 shrink-0" />
        <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">
          discord-auto-quest
        </span>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <p
          role="status"
          aria-live="polite"
          className={`truncate text-[12px] tabular ${TONE_CLASS[tone]}`}
        >
          {text}
        </p>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || status === 'loading'}
          aria-label="Fetch a fresh catalogue from Discord"
          className="grid size-8 shrink-0 place-items-center rounded-[3px] border border-rule text-ink-2 transition-colors duration-150 hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-rule disabled:hover:text-ink-2"
        >
          <RefreshIcon
            className={`size-4 ${refreshing ? 'motion-safe:animate-spin' : ''}`}
          />
        </button>
      </div>
    </header>
  );
}

function describe(
  status: CatalogueStatus,
  snapshot: CatalogueSnapshot | null,
  refreshing: boolean,
  refreshError: AppErrorShape | null,
): { text: string; tone: Tone } {
  if (status === 'loading') {
    return { text: 'Loading the catalogue', tone: 'ink' };
  }

  if (status === 'error') {
    return { text: 'No catalogue is loaded', tone: 'danger' };
  }

  if (refreshError) {
    return {
      text: `Refresh failed — still showing the cached copy from ${formatAge(snapshot?.fetchedAt ?? null)}`,
      tone: 'danger',
    };
  }

  if (!snapshot) {
    return { text: 'No catalogue is loaded', tone: 'ink' };
  }

  const age = formatAge(snapshot.fetchedAt);

  if (snapshot.source === 'network') {
    return {
      text: refreshing ? 'Fetching a fresh catalogue from Discord' : `Live from Discord · fetched ${age}`,
      tone: 'ink',
    };
  }

  if (snapshot.stale) {
    return {
      text: refreshing
        ? `Cached copy from ${age} · fetching a fresh one`
        : `Cached copy from ${age} · fetching a fresh one`,
      tone: 'warn',
    };
  }

  return { text: `Cached copy from ${age}`, tone: 'ink' };
}
