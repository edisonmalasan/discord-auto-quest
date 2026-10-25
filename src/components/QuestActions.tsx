import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { QuestCardModel } from '../lib/quest-view';
import { copyQuestLink, openQuestExternal, openQuestInDiscord } from '../lib/quest-actions';
import { useEnrollment } from './Enrollment';
import { useNotifications } from './Notifications';
interface Props { card: QuestCardModel; stale: boolean; menuOpen: boolean; onMenuChange: (id: string | null) => void;
  onDiscord?: () => Promise<{ instruction: string | null }>; onExternal?: () => Promise<void>; onCopy?: () => Promise<void> }
export function QuestActions({ card, stale, menuOpen, onMenuChange, onDiscord, onExternal, onCopy }: Props) {
  const { quest } = card;
  const enrollment = useEnrollment();
  const notifications = useNotifications();
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    if (!notifications) return;
    if (notice) { notifications.notify({title: 'Quest message', message: notice}); setNotice(null); }
    if (error) { notifications.notify({title: 'Quest action failed', message: error, kind: 'error'}); setError(null); }
  }, [notice, error, notifications?.notify]);
  useEffect(() => {
    if (!menuOpen) return;
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    function outside(event: PointerEvent) {
      if (root.current?.contains(event.target as Node)) return;
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex]');
      onMenuChange(null);
      if (!control || control.tabIndex < 0) trigger.current?.focus();
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [menuOpen, onMenuChange]);
  function close() { onMenuChange(null); trigger.current?.focus(); }
  async function perform(kind: 'discord' | 'external' | 'copy') {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(null); setNotice(null);
    try {
      if (kind === 'discord') {
        const result = await (onDiscord ? onDiscord() : openQuestInDiscord(quest.id));
        if (result.instruction) setNotice(`${quest.name}: ${result.instruction}`);
      } else if (kind === 'external' && quest.ctaLink) await (onExternal ? onExternal() : openQuestExternal(quest.ctaLink));
      else if (kind === 'copy') { await (onCopy ? onCopy() : copyQuestLink(quest.id)); setNotice('Quest link copied'); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { busy.current = false; setPending(false); }
  }
  async function useDesktop() {
    if (busy.current || !enrollment?.selectDesktop || enrollment.disabled || enrollment.activeQuestId === quest.id || stale) return;
    busy.current = true; setPending(true); setError(null); setNotice(null);
    try {
      const result = await enrollment.selectDesktop(quest.id);
      if (result.status === 'selected') setNotice('Desktop selected. Work starts only when Work my quests is enabled.');
      else setError(result.message);
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { busy.current = false; setPending(false); }
  }
  function navigateMenu(event: KeyboardEvent) {
    const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'Tab') close();
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && items.length) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length-1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  }
  const taskKinds = quest.selectedTaskKind ? [quest.selectedTaskKind] : quest.tasks;
  const video = taskKinds.length > 0 && taskKinds.every(t => t.startsWith('WATCH_VIDEO'));
  const alternatives = !video && new Set(quest.taskDetails.map(task => task.platform).filter(Boolean)).size > 1;
  const desktopAlternatives = card.view === 'ongoing' && quest.tasks.includes('PLAY_ON_DESKTOP') && quest.tasks.some(t => t === 'PLAY_ON_XBOX' || t === 'PLAY_ON_PLAYSTATION');
  const canSelectDesktop = desktopAlternatives && quest.desktopSelectionSupported && quest.nativePlatform === null && !!enrollment?.selectDesktop;
  const seconds = videoRemaining(card);
  const label = card.view === 'available' ? enrollment ? 'Accept quest' : 'Accept in Discord' : card.rewardState === 'claimable' ? 'Claim in Discord'
    : card.rewardState === 'claimed' ? 'View reward in Discord' : card.view === 'completed' ? 'Check in Discord'
      : video ? `Watch${seconds !== null ? ` ${seconds}s` : ''} in Discord`
        : alternatives ? 'Platforms in Discord' : 'Open in Discord';
  const gameCtaOnly = card.view === 'ongoing' && !video && !alternatives && (quest.selectedTaskKind || quest.tasks.length === 1) && quest.ctaLink;
  return <div className="quest-action-region" ref={root} data-keyboard={keyboard}>
    <button ref={trigger} className="quest-menu-trigger" aria-label={`Quest actions for ${quest.name}`} aria-haspopup="menu" aria-expanded={menuOpen}
      aria-controls={menuOpen ? `menu-${quest.id}` : undefined} onClick={event => { setKeyboard(event.detail === 0); onMenuChange(menuOpen ? null : quest.id); }}
      onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setKeyboard(true); onMenuChange(quest.id); } }}>•••</button>
    {menuOpen && <div className="quest-menu" id={`menu-${quest.id}`} ref={menu} role="menu" aria-label={`Actions for ${quest.name}`} onKeyDown={navigateMenu}>
      {quest.ctaLink && <button role="menuitem" tabIndex={-1} disabled={pending || stale} onClick={() => { close(); void perform('external'); }}>{quest.ctaLabel ?? 'Get Game'}</button>}
      <button role="menuitem" tabIndex={-1} disabled={pending} onClick={() => { close(); void perform('copy'); }}>Copy quest link</button>
      <button role="menuitem" tabIndex={-1} disabled={pending || stale} onClick={() => { close(); void perform('discord'); }}>Open in Discord</button>
    </div>}
    {card.expired && card.view === 'ongoing' ? <footer className="quest-footer"><button className="button secondary" disabled>Quest expired</button></footer> : <footer className="quest-footer">
    {desktopAlternatives ? <><button className="button secondary" disabled>Quest accepted</button>
      {quest.nativePlatform === 'desktop' ? <button className="button secondary" disabled>Desktop</button>
        : canSelectDesktop ? <button className="button secondary" disabled={stale || pending || enrollment?.disabled || enrollment?.activeQuestId === quest.id} aria-describedby={enrollment?.continuousWork ? `desktop-note-${quest.id}` : undefined} onClick={() => void useDesktop()}>{pending ? 'Selecting Desktop…' : 'Use Desktop'}</button>
          : <button className="button secondary" disabled={stale || pending} onClick={() => void perform('discord')}>Platforms in Discord</button>}
    </> : <>
      {quest.ctaLink && !(alternatives && card.view === 'ongoing') && <button className="button secondary" disabled={stale || pending} onClick={() => void perform('external')}>{quest.ctaLabel ?? 'Get Game'}</button>}
      {alternatives && card.view === 'ongoing' && <button className="button secondary" disabled>Quest accepted</button>}
      {!gameCtaOnly && <button className={`button ${card.view === 'ongoing' && !video ? 'secondary' : 'primary'}`} disabled={stale || pending || card.rewardState === 'expired' || card.view === 'available' && enrollment?.disabled} onClick={() => card.view === 'available' && enrollment ? enrollment.review(quest.id) : void perform('discord')}>{card.rewardState === 'expired' ? 'Reward expired' : label}</button>}
    </>}
    </footer>}
    {canSelectDesktop && enrollment?.continuousWork && <p className={notifications ? 'sr-only' : 'card-feedback'} id={`desktop-note-${quest.id}`}>Continuous Work is on. Choosing Desktop adds this quest to the queue.</p>}
    {desktopAlternatives && quest.nativePlatform === 'console' && !notifications && <p className="card-feedback">Console is selected. Change the platform in Discord to use Desktop.</p>}
    {desktopAlternatives && quest.nativePlatform === null && !canSelectDesktop && !notifications && <p className="card-feedback">Select Desktop in Discord before working this quest.</p>}
    {error && !notifications && <p className="card-feedback error" role="alert">{error}</p>}
    {notice && !notifications && <p className="card-feedback" role="status">{notice}</p>}
  </div>;
}

function videoRemaining(card: QuestCardModel): number | null {
  if (card.progress?.unit === 'seconds' && card.progress.taskKind.startsWith('WATCH_VIDEO')) {
    return Math.max(0, Math.ceil(card.progress.target - card.progress.value));
  }
  const values = card.quest.taskDetails.filter(task => task.kind.startsWith('WATCH_VIDEO')).map(task =>
    task.unit === 'seconds' && task.target !== null && task.value !== null &&
    Number.isFinite(task.target) && Number.isFinite(task.value) && task.target > 0 && task.value >= 0
      ? Math.max(0, Math.ceil(task.target - task.value)) : null);
  const shared = values[0];
  return shared !== undefined && shared !== null && values.every(value => value === shared) ? shared : null;
}
