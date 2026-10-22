import type { QuestCardModel } from '../lib/quest-view';
import { QuestImage } from './QuestImage';
export function QuestProgress({ card }: { card: QuestCardModel }) {
  const { quest, progress } = card;
  const accepted = card.view !== 'available';
  const completed = card.view === 'completed';
  const art = quest.rewardImage && !/\.(mp4|webm)(\?|$)/i.test(quest.rewardImage) ? quest.rewardImage : quest.rewardOrbs !== null ? '/orb-reward.svg' : null;
  const percent = completed ? 100 : progress?.percent ?? 0;
  const quantity = card.rewardState === 'claimed' ? quest.claimedRewardOrbs ?? quest.rewardOrbs : quest.rewardOrbs;
  const label = quantity !== null ? `${quantity} Orbs` : quest.rewardName ?? 'Quest reward';
  return <div className={`quest-reward-art ${accepted ? 'circular' : ''} ${completed ? 'finished' : ''}`}>
    <QuestImage src={art} alt={label} fallback={<div className="reward-fallback" aria-label="Reward artwork unavailable">✦</div>} />
    {accepted && <svg className="progress-ring" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="36"/><circle className="progress-value" cx="40" cy="40" r="36" strokeDasharray="226.2" strokeDashoffset={226.2*(1-percent/100)} /></svg>}
    {accepted && !completed && progress && <span className="progress-percent" role="progressbar" aria-label={`${quest.name} progress`} aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}
      aria-valuetext={`${progress.value} of ${progress.target} ${progress.unit === 'count' ? 'achievements' : 'seconds'}`}>{progress.percent}%</span>}
  </div>;
}
