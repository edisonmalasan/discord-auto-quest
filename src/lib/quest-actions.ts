import { openUrl } from '@tauri-apps/plugin-opener';
export function questShareUrl(id: string): string {
  if (!/^\d{1,20}$/.test(id)) throw new Error('This quest has an invalid identifier. Refresh the quest list.');
  return `https://discord.com/quests/${id}`;
}
export async function openQuestInDiscord(id: string): Promise<{ instruction: string | null }> {
  questShareUrl(id);
  // Verified desktop fallback: direct public quest paths do not route in the client.
  await openUrl('discord://-/quest-home');
  return { instruction: 'Select this quest in Discord’s Quests view to continue.' };
}
export async function openQuestExternal(value: string): Promise<void> {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('This quest’s external link is unavailable. Open it in Discord instead.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('This external link is unsupported. Open the quest in Discord instead.');
  await openUrl(url.href);
}
export async function copyQuestLink(id: string): Promise<void> {
  const link = questShareUrl(id);
  if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable. Open the quest in Discord to share it.');
  await navigator.clipboard.writeText(link);
}
