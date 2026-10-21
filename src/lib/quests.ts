import type { QuestSummary } from '../types/quests';

/**
 * What each kind of task is called, in words a person can act on.
 *
 * Discord's own names are kept alongside, because they are what Discord will
 * say if a quest behaves differently than this table says it should.
 */
const TASK_LABELS: Record<string, string> = {
  PLAY_ON_DESKTOP: 'Play on desktop',
  PLAY_ON_XBOX: 'Play on Xbox',
  PLAY_ON_PLAYSTATION: 'Play on PlayStation',
  PLAY_ACTIVITY: 'Play an activity',
  WATCH_VIDEO: 'Watch a video',
  WATCH_VIDEO_ON_MOBILE: 'Watch a video on mobile',
  STREAM_ON_DESKTOP: 'Stream on desktop',
  STREAM_ON_MOBILE: 'Stream on mobile',
  ACHIEVEMENT_IN_ACTIVITY: 'Reach an achievement',
};

/** What a task is called, in words. The raw name is the fallback. */
export function taskLabel(task: string): string {
  return TASK_LABELS[task] ?? task;
}

/** How long a quest takes, in the words the register uses. */
export function duration(seconds: number): string {
  if (seconds <= 0) {
    return '—';
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  return `${Math.round(seconds / 60)} min`;
}

/** The reward, in words. */
export function reward(quest: QuestSummary): string | null {
  if (!quest.rewardOrbs) {
    return null;
  }

  return `${quest.rewardOrbs} Orbs`;
}

/** When a quest stops being available, in the words the register uses. */
export function ends(quest: QuestSummary): string {
  if (!quest.expiresAt) {
    return '—';
  }

  const when = new Date(quest.expiresAt);
  if (Number.isNaN(when.getTime())) {
    return '—';
  }

  return when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Whether a quest is finished, as Discord says it. */
export function isFinished(quest: QuestSummary): boolean {
  return quest.state === 'completed';
}

/**
 * Whether a quest needs the user before it can count.
 *
 * Some quests do: a streaming quest only counts while the user is in a voice
 * channel with somebody else, and a video quest only while a video is playing.
 * The interface has to say so, or the user is left watching a number that does
 * not move.
 */
export function needsUser(quest: QuestSummary): boolean {
  return quest.tasks.some((task) =>
    [
      'STREAM_ON_DESKTOP',
      'STREAM_ON_MOBILE',
      'PLAY_ACTIVITY',
      'WATCH_VIDEO',
      'WATCH_VIDEO_ON_MOBILE',
    ].includes(task),
  );
}

/** What the user still has to do for a quest to count, in one sentence. */
export function requirement(quest: QuestSummary): string | null {
  if (quest.tasks.includes('STREAM_ON_DESKTOP') || quest.tasks.includes('STREAM_ON_MOBILE')) {
    return 'counts only while you are in a voice channel with somebody';
  }

  if (quest.tasks.includes('PLAY_ACTIVITY')) {
    return 'counts only while you are in a voice channel';
  }

  if (quest.tasks.includes('WATCH_VIDEO') || quest.tasks.includes('WATCH_VIDEO_ON_MOBILE')) {
    return 'counts only while a video is playing';
  }

  return null;
}

/**
 * The quest that is waiting on the user.
 *
 * There is normally at most one, and the first is as good as any.
 */
export function awaitingUser(quests: QuestSummary[]): QuestSummary | null {
  return quests.find(needsUser) ?? null;
}

/**
 * The quest that has been finished and is waiting to be claimed.
 *
 * A quest whose reward has expired cannot be claimed, so an expired one is
 * passed over: naming it would send the user after a reward that is gone.
 */
export function awaitingClaim(quests: QuestSummary[]): QuestSummary | null {
  const finished = quests.filter(isFinished);
  const claimable = finished.find((quest) => !hasExpired(quest));

  return claimable ?? finished[0] ?? null;
}

/** Whether a quest's reward can no longer be claimed. */
export function hasExpired(quest: QuestSummary): boolean {
  if (!quest.expiresAt) {
    return false;
  }

  const when = new Date(quest.expiresAt).getTime();
  return !Number.isNaN(when) && when < Date.now();
}
