import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const openUrl = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl }));
import { copyQuestLink, openQuestExternal, openQuestInDiscord, questShareUrl } from './quest-actions';
describe('quest handoffs', () => {
  beforeEach(() => { openUrl.mockReset(); openUrl.mockResolvedValue(undefined); });
  afterEach(() => vi.unstubAllGlobals());
  it('builds only public quest links from numeric IDs', () => {
    expect(questShareUrl('123')).toBe('https://discord.com/quests/123');
    for (const id of ['x', '123?token=x', '', '123/4']) expect(() => questShareUrl(id)).toThrow();
  });
  it('uses the verified desktop Quests route and explains the fallback', async () => {
    expect(await openQuestInDiscord('123')).toMatchObject({ instruction: expect.stringContaining('Select') });
    expect(openUrl).toHaveBeenCalledExactlyOnceWith('discord://-/quest-home');
  });
  it('refuses unsupported URLs and reports opener failures', async () => {
    for (const url of ['javascript:alert(1)', 'file:///c:/x', 'discord://-', 'bad', 'https://user:pass@example.com']) await expect(openQuestExternal(url)).rejects.toThrow();
    openUrl.mockRejectedValue(Error('Protocol unavailable'));
    await expect(openQuestInDiscord('123')).rejects.toThrow('Protocol unavailable');
  });
  it('copies exactly a public link and does not hide clipboard errors', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await copyQuestLink('123');
    expect(writeText).toHaveBeenCalledExactlyOnceWith('https://discord.com/quests/123');
    expect(openUrl).not.toHaveBeenCalled();
    writeText.mockRejectedValue(Error('Clipboard denied'));
    await expect(copyQuestLink('123')).rejects.toThrow('Clipboard denied');
  });
});
