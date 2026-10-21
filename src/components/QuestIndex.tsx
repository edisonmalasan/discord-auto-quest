import { duration, ends, reward, taskLabel } from '../lib/quests';
import type { QuestSummary } from '../types/quests';

interface QuestIndexProps {
  /** The quests that have been accepted. */
  accepted: QuestSummary[];
  /** The quests on offer, and not expired. */
  available: QuestSummary[];
}

/**
 * The quests, as a printed register.
 *
 * One list, hairline-ruled: the quests you have accepted first, and the quests
 * on offer below them. Every figure is in mono and tabular, because every
 * figure is a measurement.
 */
export function QuestIndex({ accepted, available }: QuestIndexProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
      <Section title="Accepted" count={accepted.length}>
        {accepted.map((quest) => (
          <Row key={quest.id} quest={quest} />
        ))}
      </Section>

      <Section title="On offer" count={available.length}>
        {available.map((quest) => (
          <Row key={quest.id} quest={quest} />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[11px] font-medium tracking-[0.11em] text-ink-2 uppercase">
          {title}
        </h2>
        <span className="font-mono text-[11.5px] tabular text-ink-3">{count}</span>
      </div>

      <div className="mt-2 border-t border-rule-soft">{children}</div>
    </section>
  );
}

function Row({ quest }: { quest: QuestSummary }) {
  const accepted = quest.state !== 'available';

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_9rem_8rem_5.5rem_4.5rem] items-baseline gap-x-6 border-b border-rule-soft py-2">
      <span className="truncate text-[13px] font-medium text-ink">{quest.name}</span>

      <span className="truncate text-[12px] text-ink-2">
        {taskLabel(quest.tasks[0] ?? '')}
      </span>

      {accepted ? (
        <span className="font-mono text-[11.5px] tabular text-ink-2">
          {quest.progressSeconds}/{quest.targetSeconds}s
        </span>
      ) : (
        <span className="font-mono text-[11.5px] tabular text-ink-3">
          {duration(quest.targetSeconds)}
        </span>
      )}

      <span className="font-mono text-[11.5px] tabular text-ink-2">
        {reward(quest) ?? '—'}
      </span>

      <span className="font-mono text-[11.5px] tabular text-ink-3">{ends(quest)}</span>
    </div>
  );
}
