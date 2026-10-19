import { formatCount, formatPercent, platformLabel } from '../lib/format';
import type { CatalogueStats } from '../types/catalogue';

/**
 * The catalogue's composition.
 *
 * Every figure here is derived from the catalogue that was actually loaded. Nothing
 * is a constant, because the endpoint and any snapshot of it disagree by thousands
 * of entries.
 *
 * It is set as a table rather than a headline figure: this is a working readout of
 * a catalogue's shape, not a statistic to admire.
 */
export function CompositionReadout({ stats }: { stats: CatalogueStats }) {
  const questableShare = Math.max(0, Math.min(1, stats.questableRatio));

  return (
    <section aria-labelledby="composition-heading" className="px-4 py-5">
      <h2
        id="composition-heading"
        className="text-[10px] font-medium uppercase tracking-[0.11em] text-ink-3"
      >
        Composition
      </h2>

      <dl className="mt-3 space-y-1.5 text-[12px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-2">Entries</dt>
          <dd className="tabular text-ink">{formatCount(stats.total)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-2">Questable</dt>
          <dd className="tabular text-ink">
            {formatCount(stats.questable)}
            <span className="ml-2 text-ink-3">{formatPercent(questableShare)}</span>
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-2">Not questable</dt>
          <dd className="tabular text-ink">{formatCount(stats.notQuestable)}</dd>
        </div>
      </dl>

      <div
        className="mt-2.5 flex h-1 w-full overflow-hidden rounded-[1px] bg-rule"
        role="img"
        aria-label={`${formatPercent(questableShare)} of entries have a registered executable`}
      >
        <div
          className="da-wipe h-full bg-spot"
          style={{ width: `${questableShare * 100}%` }}
        />
      </div>

      {stats.droppedEntries > 0 ? (
        <p className="mt-2 text-[11px] leading-snug text-warn">
          {formatCount(stats.droppedEntries)} entries could not be read and were left out.
        </p>
      ) : null}

      {stats.platformSplits.length > 0 ? (
        <>
          <h3 className="mt-5 text-[10px] font-medium uppercase tracking-[0.11em] text-ink-3">
            Registered executables
          </h3>
          <dl className="mt-2 space-y-1 text-[12px]">
            {stats.platformSplits.map((split) => (
              <div key={split.os} className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-2">{platformLabel(split.os)}</dt>
                <dd className="tabular text-ink">{formatCount(split.executables)}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}
    </section>
  );
}
