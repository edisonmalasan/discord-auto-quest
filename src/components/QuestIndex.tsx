import { QuestCard } from './QuestCard';
import type { QuestSummary } from '../types/quests';

interface QuestIndexProps {
  /** The quests that have been accepted. */
  accepted: QuestSummary[];
  /** The quests on offer, and not expired. */
  available: QuestSummary[];
}

/**
 * The quests, as two registers of cards.
 *
 * The quests you have accepted come first, because those are the ones that can
 * be worked. The ones on offer follow, because they are the ones you might
 * accept.
 */
export function QuestIndex({ accepted, available }: QuestIndexProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
      <Section title="Accepted Quests" count={accepted.length}>
        {accepted.map((quest) => (
          <QuestCard key={quest.id} quest={quest} accepted />
        ))}
      </Section>

      <Section title="Available Quests" count={available.length}>
        {available.map((quest) => (
          <QuestCard key={quest.id} quest={quest} accepted={false} />
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
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        <span className="font-mono text-[11.5px] tabular text-ink-3">{count}</span>
      </div>

      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-4">
        {children}
      </div>
    </section>
  );
}
