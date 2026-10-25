import type { QuestCardModel } from './quest-view';
import type { WorkState } from '../types/work';

export function workOverview(cards: QuestCardModel[], work: WorkState) {
  const active = cards.filter(card => work.phase !== 'stopped' && card.quest.id === work.activeQuestId);
  const byId = new Map(cards.filter(card => !active.includes(card)).map(card => [card.quest.id, card]));
  const pending = [...new Set(work.pendingQuestIds ?? [])].flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
  const manualIds = new Set((work.skippedQuests ?? []).filter(item => item.reason === 'manual_play').map(item => item.questId));
  const manual = cards.filter(card => byId.has(card.quest.id) && manualIds.has(card.quest.id));
  const attention = cards.filter(card => byId.has(card.quest.id) && !pending.includes(card) && !manual.includes(card));
  return {active, pending, manual, attention};
}
