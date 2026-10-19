import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import type { AppErrorShape, CatalogueSnapshot } from '../types/catalogue';

/** The backend serves the catalogue; it is never bundled with the frontend. */
export async function loadCatalogue(): Promise<CatalogueSnapshot> {
  return invoke<CatalogueSnapshot>('load_catalogue');
}

/** Ask Discord for a fresh catalogue, replacing the cached copy. */
export async function refreshCatalogue(): Promise<CatalogueSnapshot> {
  return invoke<CatalogueSnapshot>('refresh_catalogue');
}

/** Where the app keeps its per-user data. */
export async function dataDirectory(): Promise<string> {
  return invoke<string>('data_directory');
}

/** The platform this build runs on, in the catalogue's own vocabulary. */
export async function currentPlatform(): Promise<string> {
  return invoke<string>('current_platform');
}

/** A background refresh replaced the catalogue. */
export function onCatalogueUpdated(handler: (snapshot: CatalogueSnapshot) => void): Promise<UnlistenFn> {
  return listen<CatalogueSnapshot>('catalogue-updated', (event) => handler(event.payload));
}

/** A background refresh failed. The cached copy stays on screen. */
export function onCatalogueRefreshFailed(handler: (error: AppErrorShape) => void): Promise<UnlistenFn> {
  return listen<AppErrorShape>('catalogue-refresh-failed', (event) => handler(event.payload));
}

/**
 * Narrow an unknown rejection to the backend's error shape.
 *
 * The backend returns a structured error, so the frontend never has to parse a
 * message to decide whether to offer a retry.
 */
export function isAppError(value: unknown): value is AppErrorShape {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<AppErrorShape>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.retryable === 'boolean'
  );
}

/** Turn an unknown rejection into something worth showing a person. */
export function toAppError(value: unknown): AppErrorShape {
  if (isAppError(value)) {
    return value;
  }
  return {
    code: 'UNKNOWN',
    message: value instanceof Error ? value.message : String(value),
    retryable: true,
  };
}
