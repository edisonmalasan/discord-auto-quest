import { useEffect, useMemo, useState } from 'react';

import { EntryList, SkeletonList } from './components/EntryList';
import { EntryPanel } from './components/EntryPanel';
import { ErrorPanel } from './components/ErrorPanel';
import { FilterRail, type Scope } from './components/FilterRail';
import { IndexHead } from './components/IndexHead';
import { SearchIcon } from './components/Icons';
import { StatusHeader } from './components/StatusHeader';
import { useCatalogue } from './hooks/useCatalogue';
import { currentPlatform, dataDirectory } from './lib/ipc';
import { createSearchIndex, searchCatalogue } from './lib/search';
import type { CatalogEntry } from './types/catalogue';

/** The debounce the upstream study recorded. It keeps search responsive over 25,000 entries. */
const SEARCH_DEBOUNCE_MS = 300;

/** How many matches a single query is allowed to return. */
const SEARCH_LIMIT = 500;

export default function App() {
  const { status, snapshot, error, refreshing, refreshError, refresh, retry } = useCatalogue();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [platform, setPlatform] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dataDir, setDataDir] = useState<string | null>(null);
  const [thisPlatform, setThisPlatform] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    const read = async () => {
      try {
        const [dir, os] = await Promise.all([dataDirectory(), currentPlatform()]);
        if (cancelled) {
          return;
        }
        setDataDir(dir);
        setThisPlatform(os);
      } catch {
        // The panel can be shown without them; the path preview is simply omitted.
      }
    };
    void read();
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = useMemo(() => snapshot?.entries ?? [], [snapshot]);

  const index = useMemo(
    () => (entries.length > 0 ? createSearchIndex(entries) : null),
    [entries],
  );

  const matches = useMemo(() => {
    if (!index || debouncedQuery.trim().length < 2) {
      return null;
    }
    return searchCatalogue(index, debouncedQuery, SEARCH_LIMIT);
  }, [index, debouncedQuery]);

  const platformEntryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      for (const executable of entry.executables) {
        if (!counts.has(executable.os)) {
          counts.set(executable.os, 0);
        }
        counts.set(executable.os, (counts.get(executable.os) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([os, count]) => ({ os, count }))
      .sort((left, right) => right.count - left.count);
  }, [entries]);

  const visible = useMemo(() => {
    const base = matches ?? entries;
    return base.filter((entry) => {
      const detected = entry.executables.length > 0;
      if (scope === 'questable' && !detected) {
        return false;
      }
      if (scope === 'not-questable' && detected) {
        return false;
      }
      if (platform !== 'all' && !entry.executables.some((e) => e.os === platform)) {
        return false;
      }
      return true;
    });
  }, [matches, entries, scope, platform]);

  const selected = useMemo(
    () => entries.find((entry) => entry.id === selectedId) ?? null,
    [entries, selectedId],
  );

  const handleSelect = (entry: CatalogEntry) => {
    setSelectedId(entry.id);
  };

  return (
    <div className="flex h-full flex-col bg-ground">
      <StatusHeader
        status={status}
        snapshot={snapshot}
        refreshing={refreshing}
        refreshError={refreshError}
        onRefresh={refresh}
      />

      {status === 'error' && error ? (
        <ErrorPanel error={error} onRetry={retry} />
      ) : (
        <div className="flex min-h-0 flex-1">
          <FilterRail
            scope={scope}
            onScopeChange={setScope}
            platform={platform}
            onPlatformChange={setPlatform}
            stats={snapshot?.stats ?? EMPTY_STATS}
            platformEntryCounts={platformEntryCounts}
          />

          <main className="flex min-w-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-rule px-5 py-3">
              <div className="relative max-w-[420px]">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search titles, aliases, or registered paths"
                  aria-label="Search the catalogue"
                  className="w-full rounded-[3px] border border-rule bg-surface py-1.5 pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-3 focus:border-ink-3 focus:outline-none"
                />
              </div>
            </div>

            <IndexHead
              shown={visible.length}
              total={matches === null ? entries.length : matches.length}
            />

            <div className="min-h-0 flex-1 overflow-y-auto">
              {status === 'loading' ? (
                <SkeletonList />
              ) : (
                <EntryList
                  entries={visible}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                  emptyReason={
                    matches !== null && matches.length === 0
                      ? 'Nothing in the catalogue matches that. Registered paths are searched too, so a file name works.'
                      : scope === 'questable'
                        ? 'No entry in this scope has a registered executable.'
                        : 'Nothing matches the current filters.'
                  }
                />
              )}
            </div>
          </main>

          <EntryPanel
            entry={selected}
            dataDirectory={dataDir}
            currentPlatform={thisPlatform}
          />
        </div>
      )}
    </div>
  );
}

const EMPTY_STATS = {
  total: 0,
  questable: 0,
  notQuestable: 0,
  questableRatio: 0,
  platformSplits: [],
  withCoverArt: 0,
  withIcon: 0,
  withAliases: 0,
  droppedEntries: 0,
};
