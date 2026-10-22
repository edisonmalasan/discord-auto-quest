import { QuestCard } from './QuestCard';
import type { QuestCardModel } from '../lib/quest-view';
interface Props { cards: QuestCardModel[]; stale: boolean; openMenuQuestId: string | null; onMenuChange: (id: string | null) => void }
export function QuestIndex({ cards, stale, openMenuQuestId, onMenuChange }: Props) {
  return <div className="quest-grid">{cards.map(card => <QuestCard key={card.quest.id} card={card} stale={stale} menuOpen={openMenuQuestId === card.quest.id} onMenuChange={onMenuChange} />)}</div>;
}
