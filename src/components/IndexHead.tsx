import { DetectedMark, UndetectedMark } from './Marks';

/**
 * The head of the index: the column labels, and the key the margin is read against.
 *
 * The key is not decoration. It is the one thing a visitor has to understand before
 * the rest of the list means anything.
 */
export function IndexHead({ shown, total }: { shown: number; total: number }) {
  return (
    <div className="sticky top-0 z-10 border-b border-rule bg-ground">
      <div className="flex items-baseline justify-between gap-4 px-5 pt-4 pb-2">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.11em] text-ink-2">
          Index
        </h2>
        <p className="tabular text-[11px] text-ink-3">
          {shown.toLocaleString('en-US')} of {total.toLocaleString('en-US')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 pb-3 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <DetectedMark className="size-[7px]" />
          Detected — Discord registered an executable, so there is a path to mirror
        </span>
        <span className="flex items-center gap-1.5">
          <UndetectedMark className="size-[7px]" />
          Not detected — nothing to mirror, so it cannot be quested
        </span>
      </div>
    </div>
  );
}
