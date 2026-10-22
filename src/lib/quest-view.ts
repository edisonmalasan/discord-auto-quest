import type { QuestFeed, QuestSummary } from '../types/quests';

export type QuestView = 'ongoing' | 'available' | 'completed';
export type RewardState = 'incomplete' | 'claimable' | 'claimed' | 'expired' | 'unknown';
export interface QuestCardModel {
  quest: QuestSummary;
  view: QuestView;
  expired: boolean;
  rewardState: RewardState;
  progress: { value: number; target: number; percent: number; unit: 'seconds' | 'count'; taskKind: string } | null;
}
export type QuestViews = Record<QuestView, QuestCardModel[]>;

function time(value: string | null): number | null {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}
function rewardState(q: QuestSummary, now: number): RewardState {
  if (q.state !== 'completed') return 'incomplete';
  if (q.rewardClaimState === 'claimed' || time(q.rewardClaimedAt) !== null) return 'claimed';
  if (q.rewardClaimState !== 'unclaimed') return 'unknown';
  const deadline = time(q.rewardExpiresAt);
  if (deadline !== null && deadline <= now) return 'expired';
  if (q.rewardClaimable === true) return 'claimable';
  return 'unknown';
}
function progress(q: QuestSummary): QuestCardModel['progress'] {
  const tasks = q.taskDetails ?? [];
  const task = q.selectedTaskKind ? tasks.find(t => t.kind === q.selectedTaskKind)
    : tasks.length === 1 ? tasks[0] : null;
  if (!task || task.unit === 'unknown' || task.value === null || task.target === null ||
      !Number.isFinite(task.value) || !Number.isFinite(task.target) || task.value < 0 || task.target <= 0) return null;
  return { value: task.value, target: task.target, unit: task.unit, taskKind: task.kind,
    percent: Math.min(100, Math.round(task.value / task.target * 100)) };
}

export function buildQuestViews(feed: QuestFeed, now: number): QuestViews {
  const views: QuestViews = { ongoing: [], available: [], completed: [] };
  const byId = new Map<string, QuestSummary>();
  const rank = { available: 0, claimed: 1, completed: 2 };
  for (const q of [...feed.available, ...feed.claimed]) {
    const existing = byId.get(q.id);
    if (!existing || rank[q.state] >= rank[existing.state]) byId.set(q.id, q);
  }
  for (const quest of byId.values()) {
    const end = time(quest.expiresAt);
    const expired = end !== null && end <= now;
    const view = quest.state === 'completed' ? 'completed' : quest.state === 'claimed' ? 'ongoing' : 'available';
    if (view === 'available' && expired) continue;
    views[view].push({ quest, view, expired, rewardState: rewardState(quest, now), progress: progress(quest) });
  }
  const endOrder = (a: QuestCardModel, b: QuestCardModel) =>
    (time(a.quest.expiresAt) ?? Infinity) - (time(b.quest.expiresAt) ?? Infinity) || a.quest.id.localeCompare(b.quest.id);
  views.available.sort(endOrder);
  views.ongoing.sort((a, b) => Number(a.expired) - Number(b.expired) || endOrder(a, b));
  views.completed.sort((a, b) => Number(b.rewardState === 'claimable') - Number(a.rewardState === 'claimable') ||
    (time(b.quest.completedAt) ?? 0) - (time(a.quest.completedAt) ?? 0) || a.quest.id.localeCompare(b.quest.id));
  return views;
}

export function searchQuests(cards: QuestCardModel[], query: string): QuestCardModel[] {
  const needle = query.trim().toLocaleLowerCase();
  return cards.filter(({ quest }) => [quest.name, quest.gameTitle, quest.publisher].some(
    value => value?.toLocaleLowerCase().includes(needle),
  ));
}
