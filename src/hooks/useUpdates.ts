import { useCallback, useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { checkForUpdates, downloadPortableUpdate, installUpdate, notificationPreferences, setNotificationPreferences, updateStatus } from '../lib/updates';
import type { NotificationPreferences, UpdateState } from '../types/updates';

function message(failure: unknown) {
  if (failure instanceof Error) return failure.message;
  if (typeof failure === 'object' && failure !== null && 'message' in failure && typeof failure.message === 'string') return failure.message;
  return String(failure);
}

export function useUpdates() {
  const [state, setState] = useState<UpdateState | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const mounted = useRef(false), checkBusy = useRef(false), installBusy = useRef(false), preferenceBusy = useRef(false);
  const revision = useRef(0);

  const check = useCallback(async (manual = false) => {
    if (checkBusy.current || installBusy.current) return;
    checkBusy.current = true;
    setChecking(true);
    if (manual) { setError(null); setCheckMessage(null); }
    const generation = revision.current;
    try {
      const result = await checkForUpdates();
      if (!mounted.current) return;
      if (result.status === 'error') {
        if (manual) setError(result.message ?? 'Could not check for updates. Try again later.');
      } else {
        if (generation === revision.current) setState(result);
        if (manual && result.status === 'up-to-date') setCheckMessage('You’re up to date.');
      }
    } catch (failure) { if (mounted.current && manual) setError(message(failure)); }
    finally { checkBusy.current = false; if (mounted.current) setChecking(false); }
  }, []);

  useEffect(() => {
    mounted.current = true;
    let dispose: (() => void) | undefined, active = true;
    void listen<UpdateState>('update-state', event => {
      if (!active) return;
      // A later check response must not replace newer download progress.
      revision.current += 1;
      if (event.payload.status !== 'error') setState(event.payload);
      else if (installBusy.current) { setState(event.payload); setError(event.payload.message ?? 'The update failed. Try again.'); }
    }).then(unlisten => { if (active) dispose = unlisten; else unlisten(); }).catch(() => {});
    void notificationPreferences().then(value => { if (active) setPreferences(value); }).catch(() => {});
    void check();
    const timer = window.setInterval(() => { void check(); }, 12 * 60 * 60 * 1000);
    return () => { active = false; mounted.current = false; dispose?.(); window.clearInterval(timer); };
  }, [check]);

  useEffect(() => {
    if (!installing) return;
    // Progress events are primary; this also recovers a missed event listener.
    let active = true, reading = false;
    const timer = window.setInterval(() => {
      if (reading) return;
      reading = true;
      void updateStatus().then(value => {
        if (active && value.status !== 'error') { revision.current += 1; setState(value); }
      }).catch(() => {}).finally(() => { reading = false; });
    }, 750);
    return () => { active = false; window.clearInterval(timer); };
  }, [installing]);

  async function install() {
    if (installBusy.current || !state?.installed || !state.version) return false;
    installBusy.current = true; setInstalling(true); setError(null);
    try { await installUpdate(); return true; }
    catch (failure) {
      if (mounted.current) { setError(message(failure)); setState(previous => previous ? { ...previous, status: 'error' } : previous); }
      return false;
    }
    finally { installBusy.current = false; if (mounted.current) setInstalling(false); }
  }
  async function download() {
    if (!state?.version) return;
    setError(null);
    try { await downloadPortableUpdate(state.version); }
    catch (failure) { if (mounted.current) setError(message(failure)); }
  }
  async function setNotifications(enabled: boolean) {
    if (preferenceBusy.current || !preferences?.installed) return;
    preferenceBusy.current = true; setSavingPreferences(true); setPreferenceError(null);
    try {
      const result = await setNotificationPreferences(enabled);
      if (mounted.current) {
        setPreferences(result);
        if (enabled && !result.enabled) setPreferenceError('Notifications are blocked. Allow them in Windows settings to enable notifications.');
      }
    } catch (failure) { if (mounted.current) setPreferenceError(message(failure)); }
    finally { preferenceBusy.current = false; if (mounted.current) setSavingPreferences(false); }
  }
  return { state, preferences, checking, installing, savingPreferences, checkMessage, error, preferenceError, check, install, download, setNotifications };
}
