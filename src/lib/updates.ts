import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { NotificationPreferences, UpdateState } from '../types/updates';

export const checkForUpdates = () => invoke<UpdateState>('check_for_updates');
export const updateStatus = () => invoke<UpdateState>('update_status');
export const installUpdate = () => invoke<void>('install_update');
export const notificationPreferences = () => invoke<NotificationPreferences>('notification_preferences');
export const setNotificationPreferences = (enabled: boolean) => invoke<NotificationPreferences>('set_notification_preferences', { enabled });

export async function downloadPortableUpdate(version: string): Promise<void> {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('The release version is unavailable. Check for updates again.');
  }
  await openUrl(`https://github.com/edisonmalasan/discord-auto-quest/releases/tag/${encodeURIComponent(`v${version}`)}`);
}
