import type { QuestCardModel } from '../lib/quest-view';
import { duration, taskLabel, requirement } from '../lib/quests';
import { QuestImage } from './QuestImage';
import { QuestProgress } from './QuestProgress';
import { QuestActions } from './QuestActions';
interface Props { card: QuestCardModel; stale: boolean; menuOpen: boolean; onMenuChange: (id: string | null) => void }
export function QuestCard({ card, stale, menuOpen, onMenuChange }: Props) {
  const { quest } = card;
  const quantity = card.rewardState === 'claimed' ? quest.claimedRewardOrbs ?? quest.rewardOrbs : quest.rewardOrbs;
  const reward = quantity !== null ? `${quantity} Orbs` : quest.rewardName ?? 'Quest reward';
  const boost = quest.rewardOrbs && quest.premiumOrbs && quest.premiumOrbs > quest.rewardOrbs ? (quest.premiumOrbs/quest.rewardOrbs).toFixed(1) : null;
  return <article className="quest-card" aria-label={quest.name}>
    <div className="quest-hero"><QuestImage src={quest.banner} alt="" className="quest-banner"/><div className="hero-scrim"/>
      <div className="quest-wordmark"><QuestImage src={quest.logotype} alt="" fallback={<span>{quest.gameTitle ?? quest.name}</span>}/></div>
      <div className="publisher-row"><p>Promoted by <span>{quest.publisherVerified === true && <svg aria-label="Verified publisher" viewBox="0 0 16 16"><path fill="#3ba55d" d="m8 0 2 2 3-.1.5 3 2.5 2-2 2 .1 3-3 .5L8 16l-2-2-3 .1-.5-3L0 8l2-2-.1-3 3-.5z"/><path fill="none" stroke="white" strokeWidth="1.6" d="m4 8 2.5 2.5L12 5"/></svg>}{quest.publisher ?? 'Publisher unavailable'}</span></p><span className="quest-end">{endDate(quest.expiresAt)}</span></div>
    </div>
    <div className="quest-details"><QuestProgress card={card}/><div className="quest-copy"><h2>{quest.name}{/\bquest$/i.test(quest.name) ? '' : ' Quest'}</h2>
      <div className="quest-reward-line">{card.rewardState !== 'claimed' && card.view !== 'completed' && <span>Claim</span>}{quantity !== null && <OrbIcon/>}<strong>{reward}</strong>
        {boost && <span className="boost-pill">◉ Unlock {boost}x</span>}</div>
      <p className="quest-description">{description(card)}</p>
      {card.view === 'ongoing' && !card.expired && !card.progress && <p className="quest-description">Progress unavailable.</p>}
    </div></div>
    <QuestActions card={card} stale={stale} menuOpen={menuOpen} onMenuChange={onMenuChange}/>
  </article>;
}
function endDate(value: string | null) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? `Ends ${date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}` : 'End date unavailable';
}
function description(card: QuestCardModel) {
  const q = card.quest;
  if (card.rewardState === 'claimed') {
    const date = q.rewardClaimedAt ? new Date(q.rewardClaimedAt) : null;
    return date && Number.isFinite(date.getTime()) ? `You claimed this reward on ${date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}` : 'You claimed this reward.';
  }
  if (card.rewardState === 'claimable') return 'Quest completed! Claim your reward in Discord.';
  if (card.rewardState === 'expired') return 'Quest completed. The reward claim window has ended.';
  if (card.view === 'completed') return 'Quest completed. Check your reward status in Discord.';
  if (card.expired) return 'This quest has ended.';
  const reward = q.rewardOrbs !== null ? `${q.rewardOrbs} Orbs` : q.rewardName ?? 'your reward';
  const taskKinds = q.selectedTaskKind ? [q.selectedTaskKind] : q.tasks;
  if (taskKinds.length && taskKinds.every(t => t.startsWith('WATCH_VIDEO'))) return `Watch the video${q.selectedTaskKind === 'WATCH_VIDEO_ON_MOBILE' ? ' on mobile' : ''} to win ${reward}!`;
  if (card.progress?.unit === 'count') return `Reach ${card.progress.target} ${card.progress.target === 1 ? 'achievement' : 'achievements'} in ${q.gameTitle ?? 'the activity'} to earn your reward.`;
  const needs = requirement({ ...q, tasks: taskKinds });
  const extra = needs ? ` This quest ${needs}.` : '';
  if (card.progress?.unit === 'seconds') return `${taskLabel(card.progress.taskKind)}${q.gameTitle ? `: ${q.gameTitle}` : ''} for ${duration(card.progress.target)} to earn ${reward}.${extra}`;
  return `Complete a supported task in Discord: ${taskKinds.map(taskLabel).join(' / ')}.${extra}`;
}
export function OrbIcon() { return <svg className="orb-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="m8 1 7 7-7 7-7-7z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="m8 4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>; }
