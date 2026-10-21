/**
 * The quests, as the backend reads them out of Discord.
 *
 * These mirror the backend's own types. The frontend never holds a quest of its
 * own making: every one of them came out of Discord, and the interface shows
 * what Discord says.
 */

/** How a quest stands. */
export type QuestState = 'available' | 'claimed' | 'completed';

/** One quest. */
export interface QuestSummary {
  /** Discord's identifier for it. */
  id: string;
  /** The name to show. */
  name: string;
  /**
   * What has to be done: `PLAY_ON_DESKTOP`, `WATCH_VIDEO`, and so on.
   *
   * The names are Discord's, and they are shown as they are, because the
   * interface is reporting what Discord said rather than translating it.
   */
  tasks: string[];
  /** When it stops being available. */
  expiresAt: string | null;
  /** Which state it is in. */
  state: QuestState;
  /** How many seconds it has counted. */
  progressSeconds: number;
  /** How many seconds it needs. */
  targetSeconds: number;
  /** The reward, in orbs, if it has one. */
  rewardOrbs: number | null;
}

/** A game Discord believes is running. */
export interface RunningGame {
  id: string;
  name: string;
  exeName: string | null;
  pid: number | null;
}

/** Everything the interface needs to know about Discord's quests. */
export interface QuestFeed {
  /** The quests on offer, and not expired. */
  available: QuestSummary[];
  /** The quests that have been accepted, finished or not. */
  claimed: QuestSummary[];
  /** How many quests have expired and were never accepted. */
  expired: number;
  /**
   * Whether the client is the desktop application.
   *
   * The quest script only works there, so the interface has to say so rather
   * than offer a button that cannot work.
   */
  desktopApp: boolean;
  /** The games the client believes are running. */
  runningGames: RunningGame[];
}

/** Where Discord stands, and what the user has to do about it. */
export interface DiscordStatus {
  /** Whether Discord is installed on this machine. */
  installed: boolean;
  /** Whether the application can talk to Discord right now. */
  ready: boolean;
  /** What the user has to do about it. Nothing when there is nothing to do. */
  action: string | null;
  /** Where Discord keeps its profile. */
  profile: string | null;
}
