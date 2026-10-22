import type { QuestCardModel } from '../lib/quest-view';
interface Props { card: QuestCardModel; stale: boolean; onDiscord?: () => Promise<unknown>; onExternal?: () => Promise<unknown> }
export function QuestActions({ card, stale, onDiscord, onExternal }: Props) {
  const { quest } = card;
  const video = quest.tasks.some(t => t.startsWith('WATCH_VIDEO'));
  const alternatives = !video && quest.taskDetails.length > 1;
  const label = card.view === 'available' ? 'Accept in Discord' : card.rewardState === 'claimable' ? 'Claim in Discord'
    : card.rewardState === 'claimed' ? 'View reward in Discord' : card.view === 'completed' ? 'Check in Discord'
      : video ? `Watch${card.progress?.unit === 'seconds' ? ` ${Math.max(0, Math.ceil(card.progress.target-card.progress.value))}s` : ''} in Discord`
        : alternatives ? 'Platforms in Discord' : 'Open in Discord';
  if (card.expired && card.view === 'ongoing') return <footer className="quest-footer"><button className="button secondary" disabled>Quest expired</button></footer>;
  const gameCtaOnly = card.view === 'ongoing' && !video && !alternatives && quest.ctaLink;
  return <footer className="quest-footer">
    {quest.ctaLink && !alternatives && <button className="button secondary" disabled={stale || !onExternal} onClick={() => void onExternal?.()}>{quest.ctaLabel ?? 'Get Game'}</button>}
    {alternatives && card.view === 'ongoing' && <button className="button secondary" disabled>Quest accepted</button>}
    {!gameCtaOnly && <button className={`button ${card.view === 'ongoing' && !video ? 'secondary' : 'primary'}`} disabled={stale || !onDiscord || card.rewardState === 'expired'} onClick={() => void onDiscord?.()}>{card.rewardState === 'expired' ? 'Reward expired' : label}</button>}
  </footer>;
}
