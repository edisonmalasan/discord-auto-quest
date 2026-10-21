import { invoke } from '@tauri-apps/api/core';

import type { AppErrorShape } from '../types/errors';
import type { DiscordStatus, QuestFeed } from '../types/quests';

/**
 * The version of the running application.
 *
 * The backend is the authority. The frontend does not carry a version of its
 * own, because a number in the interface that the application does not confirm
 * is a number that can be wrong.
 */
export async function appVersion(): Promise<string> {
  return invoke<string>('app_version');
}

/* ------------------------------------------------------------------ *
 * Discord
 *
 * The application drives the Discord desktop client: it attaches to the
 * client's renderer, reads its quests, and runs the quest script inside it.
 * ------------------------------------------------------------------ */

/** Where Discord stands, and what the user has to do about it. */
export async function discordStatus(): Promise<DiscordStatus> {
  return invoke<DiscordStatus>('discord_status');
}

/**
 * Restart Discord so the application can drive it.
 *
 * The application never calls this on its own: restarting Discord ends
 * whatever the user was doing in it. The interface asks first.
 */
export async function relaunchDiscord(): Promise<void> {
  await invoke<void>('relaunch_discord');
}

/** Attach to Discord's renderer. */
export async function attachDiscord(): Promise<void> {
  await invoke<void>('attach_discord');
}

/** The quests Discord has: the ones on offer, and the ones already accepted. */
export async function listDiscordQuests(): Promise<QuestFeed> {
  return invoke<QuestFeed>('list_discord_quests');
}

/** Run the quest script in Discord. */
export async function runQuestScript(): Promise<boolean> {
  return invoke<boolean>('run_quest_script');
}

/** Put Discord's own methods back. */
export async function stopQuestScript(): Promise<void> {
  await invoke<void>('stop_quest_script');
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
