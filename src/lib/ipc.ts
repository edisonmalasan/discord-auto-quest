import { invoke } from '@tauri-apps/api/core';

import type { AppErrorShape } from '../types/errors';
import type { DiscordStatus, QuestFeed } from '../types/quests';
import type { EnrollmentResult } from '../types/enrollment';
import type { WorkState } from '../types/work';

export async function questEnrollment(id: string, revision?: string): Promise<EnrollmentResult> {
  return revision === undefined ? invoke('review_quest_offer', { id }) : invoke('confirm_quest_acceptance', { id, revision });
}

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
 * client's renderer, reads its quests, and runs the quest operation inside it.
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

/** The quests Discord has: the ones on offer, and the ones already accepted. */
export async function listDiscordQuests(): Promise<QuestFeed> {
  return invoke<QuestFeed>('list_discord_quests');
}

/** Run the quest operation in Discord. */
export async function startQuestWork(): Promise<WorkState> {
  return invoke<WorkState>('start_quest_work');
}

/** Put Discord's own methods back. */
export async function stopQuestWork(): Promise<WorkState> {
  return invoke<WorkState>('stop_quest_work');
}

export async function questWorkStatus(): Promise<WorkState> {
  return invoke<WorkState>('work_status');
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
