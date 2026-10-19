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
