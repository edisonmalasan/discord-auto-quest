import { QuestCard } from './QuestCard';
import type { QuestCardModel } from '../lib/quest-view';
interface Props { cards: QuestCardModel[]; stale: boolean; openMenuQuestId: string | null; onMenuChange: (id: string | null) => void }
export function QuestIndex({ cards }: Props) {
  return <div className="quest-grid">{cards.map(card => <QuestCard key={card.quest.id} quest={card.quest} accepted={card.view !== 'available'} />)}</div>;
}
