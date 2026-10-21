import { QuestCard } from './QuestCard';
import type { QuestSummary } from '../types/quests';

interface QuestColumnProps {
  title: string;
  /** The line under the title, saying what the column holds. */
  note: string;
  quests: QuestSummary[];
  working: boolean;
  /** What to say when the column holds nothing. */
  empty: string;
}

/**
 * A column of quests.
 *
 * The two columns are the two halves of the question a user has: what is on
 * offer, and what has been accepted. They are not one list with a filter,
 * because they answer different things.
 */
export function QuestColumn({ title, note, quests, working, empty }: QuestColumnProps) {
  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-baseline justify-between gap-3 border-b border-rule px-5 py-2.5">
        <h2 className="text-[12px] font-semibold tracking-[0.08em] text-ink-2 uppercase">
          {title}
        </h2>
        <span className="text-[11px] tabular text-ink-3">{quests.length}</span>
      </header>

      <p className="px-5 pt-2 text-[11px] text-ink-3">{note}</p>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-3">
        {quests.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-ink-3">{empty}</p>
        ) : (
          quests.map((quest) => (
            <QuestCard key={quest.id} quest={quest} working={working} />
          ))
        )}
      </div>
    </section>
  );
}
