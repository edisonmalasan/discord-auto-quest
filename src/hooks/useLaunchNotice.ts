import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useNotifications } from '../components/Notifications';

export function useLaunchNotice() {
  const notify = useNotifications()?.notify;
  useEffect(() => {
    if (!notify) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const consume = async () => {
      const pending = await invoke<boolean>('take_launch_notice');
      if (!disposed && pending) notify({
        title: 'Discord Auto Quest is already running',
        message: 'Returned to your existing window.',
        kind: 'info',
      });
    };
    // Subscribe before consuming so a launch during startup cannot be lost.
    void listen('app-activation-requested', () => { void consume().catch(() => {}); })
      .then(stop => {
        if (disposed) { stop(); return; }
        unlisten = stop;
        return consume();
      }).catch(() => {});
    return () => { disposed = true; unlisten?.(); };
  }, [notify]);
}
