/**
 * The catalogue, as it crosses the IPC boundary.
 *
 * These mirror the Rust types in `src-tauri/src/catalogue/model.rs`. The backend is
 * the only source of catalogue data; the frontend never holds a bundled copy.
 */

export type CatalogueSource = 'network' | 'cache';

export interface CatalogExecutable {
  /** `win32`, `darwin`, or `linux`. */
  os: string;
  /** The full registered path, exactly as Discord published it. */
  path: string;
  isLauncher: boolean;
}

export interface CatalogEntry {
  id: string;
  name: string;
  aliases: string[];
  coverImageHash: string | null;
  iconHash: string | null;
  executables: CatalogExecutable[];
  /** `agency:rating` pairs, kept verbatim. */
  ageRatings: string[];
}

export interface PlatformSplit {
  os: string;
  executables: number;
}

export interface CatalogueStats {
  total: number;
  questable: number;
  notQuestable: number;
  /** `questable / total`, in the range 0..1. */
  questableRatio: number;
  platformSplits: PlatformSplit[];
  withCoverArt: number;
  withIcon: number;
  withAliases: number;
  droppedEntries: number;
}

export interface CatalogueSnapshot {
  entries: CatalogEntry[];
  stats: CatalogueStats;
  source: CatalogueSource;
  /** Unix timestamp, in seconds, of when the data was fetched. */
  fetchedAt: number | null;
  /** True when the data came from the cache and is past its refresh interval. */
  stale: boolean;
}

/** The error shape every backend command returns on failure. */
export interface AppErrorShape {
  code: string;
  message: string;
  retryable: boolean;
}

/** The platform this app is running on, in the catalogue's own vocabulary. */
export const CURRENT_PLATFORM: Record<string, string> = {
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux',
};

/**
 * The state of a quest, as the backend reports it.
 *
 * The backend reads this from the process table and from the disk, every time it
 * is asked. It is never a flag the interface set earlier.
 */
export type QuestState = 'running' | 'missing' | 'ended';

/**
 * The quests, and anything the backend could not work out about them.
 *
 * The `error` is a failure the backend could not recover from on its own — a quest
 * records file it could not read, for instance. The quests above are still true;
 * the error says what could not be checked.
 *
 * The `ended` are quests that were running and are now over. They are not
 * running, so they are not in `quests`, but they are not forgotten either: the
 * interface says what ended rather than showing a start control again as though
 * nothing had happened.
 */
export interface QuestList {
  quests: QuestView[];
  ended: QuestView[];
  error: AppErrorShape | null;
}

/** A quest as the backend sees it. */
export interface QuestView {
  /** The quest's identity: the application and the executable within it. */
  id: string;
  appId: string;
  displayName: string;
  /** Where the stub was written. */
  stubPath: string;
  /** The process id of the running stub. */
  pid: number;
  /** When the quest started, as a Unix timestamp in seconds. */
  startedAt: number;
  /** Whether the quest is running. True only in the `running` state. */
  running: boolean;
  /** The state of the quest. */
  state: QuestState;
  /** The registered path the stub is mirroring. */
  registeredPath: string;
}

/**
 * The quests that are running, and anything the backend could not work out.
 *
 * The quests are read from the process table. The error is a failure the backend
 * could not recover from on its own — a quest records file it could not read, for
 * instance — and it is reported rather than swallowed, so the app never claims
 * that nothing is running when it could not find out.
 */
export interface QuestList {
  quests: QuestView[];
  error: AppErrorShape | null;
}

/**
 * What the filesystem says about one executable's stub.
 *
 * This is a check of the disk made at the moment it was asked for, not a flag the
 * interface set earlier.
 */
export interface StubState {
  /** The catalogue path this stub mirrors. */
  registeredPath: string;
  /** Where the stub is written. */
  path: string;
  /** Whether a file is there now. */
  installed: boolean;
  /** The reason this path cannot be mirrored, when it cannot. */
  blocked: AppErrorShape | null;
}

/**
 * What the interface asks for.
 *
 * The interface names the application and the registered path. It never supplies a
 * local path: the backend resolves the executable from the catalogue it holds, so a
 * stub can only ever be written where Discord's own data says it goes.
 */
export interface QuestRequest {
  appId: string;
  registeredPath: string;
}
