/**
 * The quests, as the backend reads them out of Discord.
 *
 * These mirror the backend's own types. The frontend never holds a quest of its
 * own making: every one of them came out of Discord, and the interface shows
 * what Discord said.
 */

/** How a quest stands. */
export type QuestState = 'available' | 'claimed' | 'completed';

export interface QuestTaskSummary {
  kind: string;
  value: number | null;
  target: number | null;
  unit: 'seconds' | 'count' | 'unknown';
  platform: string | null;
}

/**
 * One quest.
 *
 * The fields are the ones Discord's own quest card is drawn from, so the
 * interface can show a quest the way the client shows it.
 */
export interface QuestSummary {
  /** Discord's identifier for it. */
  id: string;
  /** The quest's own name: "ROR2 Hallowed Concepts". */
  name: string;
  /** The game's name: "Risk of Rain 2: Hallowed Concepts". */
  gameTitle: string | null;
  /** Who published the game: "2K Games". */
  publisher: string | null;
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
  /** The reward as Discord words it: "200 Orbs". */
  rewardName: string | null;
  /** What a premium member gets, if it is more. */
  premiumOrbs: number | null;
  /** The banner across the top of the card. */
  banner: string | null;
  /** The game's wordmark, drawn over the banner. */
  logotype: string | null;
  /** The game's icon, drawn beside the reward. */
  tile: string | null;
  /** What Discord calls the button that leads to the game: "Play Now". */
  ctaLabel: string | null;
  /** Where that button goes. */
  ctaLink: string | null;
  /** The quest's own colour, as Discord writes it: "#4752C4". */
  accent: string | null;
  enrolledAt: string | null;
  completedAt: string | null;
  rewardClaimedAt: string | null;
  rewardClaimState: 'unknown' | 'unclaimed' | 'claimed';
  rewardClaimable: boolean | null;
  rewardExpiresAt: string | null;
  claimedRewardOrbs: number | null;
  rewardImage: string | null;
  rewardType: string | null;
  publisherVerified: boolean | null;
  heroVideo: string | null;
  selectedTaskKind: string | null;
  taskDetails: QuestTaskSummary[];
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
  /** The quests that are on offer, and not expired. */
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
  /** Observed process state; optional for older command responses. */
  running?: boolean | null;
  /** Whether Discord is installed on this machine. */
  installed: boolean;
  /** Whether the application can talk to Discord right now. */
  ready: boolean;
  /** What the user has to do about it. Nothing when there is nothing to do. */
  action: string | null;
  /** Where Discord keeps its profile. */
  profile: string | null;
}
