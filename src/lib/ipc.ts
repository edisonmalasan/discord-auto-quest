import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import type {
  AppErrorShape,
  CatalogueSnapshot,
  QuestList,
  QuestRequest,
  QuestView,
  StubState,
} from '../types/catalogue';

/** The backend serves the catalogue; it is never bundled with the frontend. */
export async function loadCatalogue(): Promise<CatalogueSnapshot> {
  return invoke<CatalogueSnapshot>('load_catalogue');
}

/** Ask Discord for a fresh catalogue, replacing the cached copy. */
export async function refreshCatalogue(): Promise<CatalogueSnapshot> {
  return invoke<CatalogueSnapshot>('refresh_catalogue');
}

/** Where the stubs are written. */
export async function stubRoot(): Promise<string> {
  return invoke<string>('stub_root');
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

/** Start a quest: the backend writes the stub and runs it. */
export async function startQuest(request: QuestRequest): Promise<QuestView> {
  return invoke<QuestView>('start_quest', { request });
}

/** Stop a quest. Only that process is terminated. */
export async function stopQuest(id: string): Promise<QuestView> {
  return invoke<QuestView>('stop_quest', { id });
}

/** The quests that are running, and anything the backend could not work out. */
export async function listQuests(): Promise<QuestList> {
  return invoke<QuestList>('list_quests');
}

/**
 * What the filesystem says about each of an application's stubs.
 *
 * This is the backend's own check of the disk, made now. The interface never
 * infers that a stub is installed from a flag it set earlier.
 */
export async function stubStates(appId: string): Promise<StubState[]> {
  return invoke<StubState[]>('stub_states', { appId });
}

/** A quest started or stopped. */
export function onQuestsChanged(handler: (view: QuestView) => void): Promise<UnlistenFn> {
  return listen<QuestView>('quests-changed', (event) => handler(event.payload));
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
