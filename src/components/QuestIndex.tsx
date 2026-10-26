import { QuestCard } from './QuestCard';
import type { QuestCardModel } from '../lib/quest-view';
interface Props { cards: QuestCardModel[]; stale: boolean; openMenuQuestId: string | null; onMenuChange: (id: string | null) => void; badges?: Map<string, string> }
export function QuestIndex({ cards, stale, openMenuQuestId, onMenuChange, badges }: Props) {
  return <div className="quest-grid">{cards.map(card => <QuestCard key={card.quest.id} card={card} stale={stale} menuOpen={openMenuQuestId === card.quest.id} onMenuChange={onMenuChange} badge={badges?.get(card.quest.id)} />)}</div>;
}
