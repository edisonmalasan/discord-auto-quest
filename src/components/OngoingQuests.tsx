import { searchQuests, type QuestCardModel } from '../lib/quest-view';
import { workOverview } from '../lib/work-overview';
import type { WorkState } from '../types/work';
import { QuestIndex } from './QuestIndex';

interface Props { cards: QuestCardModel[]; work: WorkState; query: string; stale: boolean; openMenuQuestId: string | null; onMenuChange: (id: string | null) => void; onClear?: () => void }
export function OngoingQuests({cards, work, query, onClear, ...props}: Props) {
  const groups = workOverview(cards, work), running = work.phase !== 'stopped';
  const filtered = {active: groups.active, pending: searchQuests(groups.pending, query), manual: searchQuests(groups.manual, query), attention: searchQuests(groups.attention, query)};
  const reasons = new Map((work.skippedQuests ?? []).map(item => [item.questId, item.reason]));
  const labels = {desktop_required: 'Desktop required', unsupported: 'Unsupported task', unavailable: 'Not ready for Work', manual_play: 'Needs manual play'};
  return <>
    {work.phase === 'waiting' && <p className="work-waiting" role="status"><strong>Waiting for accepted quests</strong><br/>Eligible quests join Work automatically.</p>}
    {work.activeQuestId && running && !groups.active.length && <p className="stale-notice" role="status">The active quest is not in the latest view. Confirm Stop before continuing.</p>}
    {filtered.active.length > 0 && <section className="ongoing-group" aria-label="Active now"><h2>Active now <span>{work.phase === 'paused' ? 'Paused' : work.phase === 'stopping' ? 'Stopping…' : work.phase === 'starting' ? 'Starting…' : 'Working'}</span></h2><QuestIndex cards={filtered.active} {...props}/></section>}
    {filtered.pending.length > 0 && <section className="ongoing-group" aria-label="Pending"><h2>Pending <span>{filtered.pending.length}</span></h2><p>{!running ? 'Starts in this order when you enable Work.' : work.phase === 'paused' ? 'On hold until Work resumes.' : 'Runs automatically in this order.'}</p><QuestIndex cards={filtered.pending} {...props} badges={new Map(groups.pending.map((card, index) => [card.quest.id, !running ? 'Pending' : index === 0 ? 'Up next' : 'Queued']))}/></section>}
    {filtered.manual.length > 0 && <section className="ongoing-group" aria-label="Needs manual play"><h2>Needs manual play <span>{filtered.manual.length}</span></h2><p>{running ? 'Automatically skipped by Work. Complete these objectives in Discord.' : 'Work automatically skips these objectives when started.'}</p><QuestIndex cards={filtered.manual} {...props} badges={new Map(groups.manual.map(card => [card.quest.id, running ? 'Auto-skipped' : 'Manual play']))}/></section>}
    {filtered.attention.length > 0 && <section className="ongoing-group" aria-label="Needs attention"><h2>Needs attention <span>{filtered.attention.length}</span></h2><p>These quests remain in Ongoing. Review their requirements or continue in Discord.</p><QuestIndex cards={filtered.attention} {...props} badges={new Map(groups.attention.map(card => [card.quest.id, card.expired ? 'Expired' : labels[reasons.get(card.quest.id) ?? 'unavailable']]))}/></section>}
    {!Object.values(filtered).some(group => group.length > 0) && query.trim() && <div className="empty-state"><h2>No matching quests</h2><p>Try another quest, game, or publisher name.</p>{onClear && <button className="button secondary" onClick={onClear}>Clear search</button>}</div>}
  </>;
}
