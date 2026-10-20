import type { AppErrorShape } from '../types/catalogue';

/** A count, with the thousands separators a person expects to read. */
export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

/** A share of the whole, as a percentage with one decimal place. */
export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/**
 * How long ago a Unix timestamp was, in the words a person would use.
 *
 * The catalogue's age matters: a copy fetched four hours ago is a different claim
 * from one fetched a minute ago, and the UI has to say which it is showing.
 */
export function formatAge(timestamp: number | null, now: number = Date.now()): string {
  if (timestamp === null) {
    return 'unknown';
  }

  const seconds = Math.max(0, Math.round((now - timestamp * 1000) / 1000));
  if (seconds < 45) {
    return 'just now';
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** The absolute moment, for the detail panel. */
export function formatMoment(timestamp: number | null): string {
  if (timestamp === null) {
    return 'unknown';
  }
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** A platform's name, from the catalogue's own vocabulary. */
export function platformLabel(os: string): string {
  switch (os) {
    case 'win32':
      return 'Windows';
    case 'darwin':
      return 'macOS';
    case 'linux':
      return 'Linux';
    default:
      return os;
  }
}

/**
 * The path a registered executable would be mirrored at, split into segments.
 *
 * Discord matches on the registered path, so the segments are the mechanism, not a
 * decoration: this is exactly the shape the stub has to take.
 */
export function pathSegments(path: string): string[] {
  return path
    .split(/[\\/]/)
    .filter((segment) => segment.length > 0);
}

/** The file name at the end of a registered path. */
export function pathBasename(path: string): string {
  const segments = pathSegments(path);
  return segments.length > 0 ? segments[segments.length - 1] : path;
}

/** How long a quest has been running, in the words a person would use. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/** A sentence explaining why an entry cannot be quested. */
export function notQuestableReason(executableCount: number): string {
  if (executableCount === 0) {
    return 'Discord has not registered a launchable executable for this title, so there is no path to mirror.';
  }
  return 'This title cannot be quested.';
}

/** The error text for a catalogue failure. */
export function catalogueErrorTitle(error: AppErrorShape): string {
  switch (error.code) {
    case 'NETWORK_UNAVAILABLE':
      return 'Discord could not be reached';
    case 'INVALID_PAYLOAD':
      return 'Discord sent something this app cannot read';
    case 'CACHE_UNAVAILABLE':
      return 'No catalogue is available yet';
    case 'IO_ERROR':
      return 'The catalogue cache could not be read';
    default:
      return 'The catalogue could not be loaded';
  }
}
