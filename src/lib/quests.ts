import type { QuestState, QuestSummary } from '../types/quests';

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
  ACHIEVEMENT_IN_ACTIVITY: 'Reach an achievement in an activity',
};

/** What a task is called, in words. The raw name is the fallback. */
export function taskLabel(task: string): string {
  return TASK_LABELS[task] ?? task;
}

/**
 * What the user still has to do for a quest to count.
 *
 * Some quests need the user: a streaming quest only counts while the user is
 * in a voice channel with somebody else, and a desktop quest needs the game
 * to be *running*, which the application arranges by telling Discord the game
 * is running. The interface says which is which, rather than leaving the user
 * to wonder why a number is not moving.
 */
export function requirement(quest: QuestSummary): string | null {
  if (quest.state !== 'claimed') {
    return null;
  }

  if (quest.tasks.includes('STREAM_ON_DESKTOP') || quest.tasks.includes('STREAM_ON_MOBILE')) {
    return 'Be in a voice channel with somebody while this counts.';
  }

  if (quest.tasks.includes('WATCH_VIDEO') || quest.tasks.includes('WATCH_VIDEO_ON_MOBILE')) {
    return 'A video has to be playing for this to count.';
  }

  if (quest.tasks.includes('PLAY_ACTIVITY')) {
    return 'Be in a voice channel for this to count.';
  }

  return null;
}

/** Whether a quest is counting right now. */
export function isCounting(quest: QuestSummary): boolean {
  return (
    quest.state === 'claimed' &&
    quest.targetSeconds > 0 &&
    quest.progressSeconds < quest.targetSeconds
  );
}

/** Whether a quest is finished. */
export function isFinished(quest: QuestSummary): boolean {
  return quest.state === 'completed';
}

/** How far along a quest is, as a fraction between nothing and all of it. */
export function fraction(quest: QuestSummary): number {
  if (quest.targetSeconds <= 0) {
    return quest.state === 'completed' ? 1 : 0;
  }

  return Math.min(1, Math.max(0, quest.progressSeconds / quest.targetSeconds));
}

/** How long a quest has left, in words. */
export function remaining(quest: QuestSummary): string {
  if (quest.targetSeconds <= 0) {
    return '';
  }

  const left = Math.max(0, quest.targetSeconds - quest.progressSeconds);

  if (left < 60) {
    return `${left}s left`;
  }

  const minutes = Math.ceil(left / 60);
  return `${minutes} min left`;
}

/** When a quest stops being available, in words. */
export function expiry(quest: QuestSummary): string | null {
  if (!quest.expiresAt) {
    return null;
  }

  const when = new Date(quest.expiresAt);
  if (Number.isNaN(when.getTime())) {
    return null;
  }

  return `ends ${when.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;
}

/** The reward, in words. */
export function reward(quest: QuestSummary): string | null {
  if (!quest.rewardOrbs) {
    return null;
  }

  return `${quest.rewardOrbs} Orbs`;
}

/** The state of a quest, in words. */
export function stateLabel(state: QuestState): string {
  switch (state) {
    case 'available':
      return 'On offer';
    case 'claimed':
      return 'Accepted';
    case 'completed':
      return 'Completed';
  }
}
