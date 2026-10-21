import { expiry, fraction, isCounting, isFinished, remaining, requirement, reward, stateLabel, taskLabel } from '../lib/quests';
import type { QuestSummary } from '../types/quests';

interface QuestCardProps {
  quest: QuestSummary;
  /**
   * True while the *application* is working quests.
   *
   * Not the same as a quest counting: a quest can be counting because the
   * script is running, or because a run was left behind. The card says
   * "Working…" only for the first, and never claims the second.
   */
  working: boolean;
}

/**
 * One quest.
 *
 * The card says three things, and only three: what the quest is, what it
 * gives, and how far along it is. It never says a quest is finished unless
 * Discord says so, and it never says a quest is counting when it is not.
 */
export function QuestCard({ quest, working }: QuestCardProps) {
  const counting = isCounting(quest);
  const finished = isFinished(quest);
  const done = fraction(quest);

  return (
    <article className="rounded-[3px] border border-rule bg-surface px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="truncate text-[13px] font-semibold tracking-[-0.01em] text-ink">
          {quest.name}
        </h3>
        <span
          className={`shrink-0 text-[11px] tabular ${
            finished ? 'text-spot' : counting ? 'text-ink-2' : 'text-ink-3'
          }`}
        >
          {stateLabel(quest.state)}
        </span>
      </div>

      <p className="mt-1 text-[11px] text-ink-3">
        {quest.tasks.map(taskLabel).join(' · ')}
        {quest.targetSeconds > 0 ? ` · ${Math.round(quest.targetSeconds / 60)} min` : ''}
      </p>

      {(quest.state !== 'available' || reward(quest) || expiry(quest)) && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-2">
          {reward(quest) && <span className="text-ink">{reward(quest)}</span>}
          {expiry(quest) && <span className="tabular">{expiry(quest)}</span>}
          {counting && <span className="tabular">{remaining(quest)}</span>}
        </p>
      )}

      {quest.state !== 'available' && (
        <div className="mt-2.5">
          <div
            className="h-1 w-full overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={quest.targetSeconds}
            aria-valuenow={quest.progressSeconds}
            aria-label={`${quest.name} progress`}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                finished ? 'bg-spot' : 'bg-spot/70'
              }`}
              style={{ width: `${Math.round(done * 100)}%` }}
            />
          </div>

          <p className="mt-1.5 text-[11px] tabular text-ink-3">
            {quest.progressSeconds} / {quest.targetSeconds}s
          </p>
        </div>
      )}

      {requirement(quest) && (
        <p className="mt-2 text-[11px] text-warn">{requirement(quest)}</p>
      )}

      {finished && (
        <p className="mt-2 text-[11px] text-spot">
          Finished — claim the reward in Discord.
        </p>
      )}

      {working && counting && (
        <p className="mt-2 text-[11px] text-ink-2">Working…</p>
      )}
    </article>
  );
}
