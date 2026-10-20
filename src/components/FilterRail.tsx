import { formatCount, platformLabel } from '../lib/format';
import type { CatalogueStats } from '../types/catalogue';

import { Colophon } from './Colophon';
import { CompositionReadout } from './CompositionReadout';

export type Scope = 'all' | 'questable' | 'not-questable';

interface FilterRailProps {
  scope: Scope;
  onScopeChange: (scope: Scope) => void;
  platform: string;
  onPlatformChange: (platform: string) => void;
  stats: CatalogueStats;
  /** Entries with at least one executable for each platform. */
  platformEntryCounts: { os: string; count: number }[];
}

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'all', label: 'All entries' },
  { id: 'questable', label: 'Questable' },
  { id: 'not-questable', label: 'Not questable' },
];

function scopeCount(scope: Scope, stats: CatalogueStats): number {
  switch (scope) {
    case 'questable':
      return stats.questable;
    case 'not-questable':
      return stats.notQuestable;
    default:
      return stats.total;
  }
}

/**
 * The left rail: what is being shown, and what the catalogue is made of.
 *
 * A filter group is a list of rows with a mark in the margin, the same vocabulary
 * the index itself uses.
 */
export function FilterRail({
  scope,
  onScopeChange,
  platform,
  onPlatformChange,
  stats,
  platformEntryCounts,
}: FilterRailProps) {
  return (
    <nav
      aria-label="Catalogue filters"
      className="flex w-[232px] shrink-0 flex-col overflow-y-auto border-r border-rule"
    >
      <section aria-labelledby="scope-heading" className="px-4 py-5">
        <h2
          id="scope-heading"
          className="text-[10px] font-medium uppercase tracking-[0.11em] text-ink-3"
        >
          Scope
        </h2>
        <ul className="mt-2.5 space-y-px">
          {SCOPES.map((item) => {
            const active = scope === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onScopeChange(item.id)}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-2 rounded-[2px] py-1.5 pl-1 pr-2 text-left text-[12.5px] transition-colors duration-150 ${
                    active ? 'text-ink' : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`size-[5px] shrink-0 rounded-[1px] ${
                      active ? 'bg-spot' : 'bg-transparent'
                    }`}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  <span className="tabular text-ink-3">
                    {formatCount(scopeCount(item.id, stats))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {platformEntryCounts.length > 0 ? (
        <section aria-labelledby="platform-heading" className="border-t border-rule-soft px-4 py-5">
          <h2
            id="platform-heading"
            className="text-[10px] font-medium uppercase tracking-[0.11em] text-ink-3"
          >
            Platform
          </h2>
          <ul className="mt-2.5 space-y-px">
            <li>
              <button
                type="button"
                onClick={() => onPlatformChange('all')}
                aria-pressed={platform === 'all'}
                className={`flex w-full items-center gap-2 rounded-[2px] py-1.5 pl-1 pr-2 text-left text-[12.5px] transition-colors duration-150 ${
                  platform === 'all' ? 'text-ink' : 'text-ink-2 hover:text-ink'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`size-[5px] shrink-0 rounded-[1px] ${
                    platform === 'all' ? 'bg-spot' : 'bg-transparent'
                  }`}
                />
                <span className="flex-1 truncate">Every platform</span>
                <span className="tabular text-ink-3">{formatCount(stats.total)}</span>
              </button>
            </li>
            {platformEntryCounts.map((entry) => {
              const active = platform === entry.os;
              return (
                <li key={entry.os}>
                  <button
                    type="button"
                    onClick={() => onPlatformChange(entry.os)}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-2 rounded-[2px] py-1.5 pl-1 pr-2 text-left text-[12.5px] transition-colors duration-150 ${
                      active ? 'text-ink' : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`size-[5px] shrink-0 rounded-[1px] ${
                        active ? 'bg-spot' : 'bg-transparent'
                      }`}
                    />
                    <span className="flex-1 truncate">{platformLabel(entry.os)}</span>
                    <span className="tabular text-ink-3">{formatCount(entry.count)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="mt-auto border-t border-rule-soft">
        <CompositionReadout stats={stats} />
        <div className="border-t border-rule-soft">
          <Colophon />
        </div>
      </div>
    </nav>
  );
}
