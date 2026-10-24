import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { QuestCompletion } from '../types/work';

export function useCompletions() {
  const [completion, setCompletion] = useState<QuestCompletion | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const seen = new Set<string>();
    void listen<QuestCompletion>('quest-completed', event => {
      if (!disposed && !seen.has(event.payload.questId)) {
        seen.add(event.payload.questId);
        setCompletion(event.payload);
      }
    }).then(stop => { if (disposed) stop(); else unlisten = stop; }).catch(() => {});
    return () => { disposed = true; unlisten?.(); };
  }, []);
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<string>('app-close-error', event => {
      if (!disposed) setCloseError(event.payload);
    }).then(stop => { if (disposed) stop(); else unlisten = stop; }).catch(() => {});
    return () => { disposed = true; unlisten?.(); };
  }, []);
  return { completion, closeError, dismissCompletion: () => setCompletion(null) };
}
