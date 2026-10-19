import { useCallback, useEffect, useMemo, useState } from 'react';

import { listQuests, onQuestsChanged, startQuest, stopQuest, toAppError } from '../lib/ipc';
import type { AppErrorShape, QuestRequest, QuestView } from '../types/catalogue';

export interface QuestController {
  /** The quests that are running. */
  quests: QuestView[];
  /** The quest for an executable, if there is one. */
  questFor: (appId: string, registeredPath: string) => QuestView | undefined;
  /** True while a quest is being started or stopped. */
  busy: boolean;
  /** The last failure, shown next to the game it happened to. */
  error: AppErrorShape | null;
  start: (request: QuestRequest) => Promise<void>;
  stop: (id: string) => Promise<void>;
  clearError: () => void;
}

/**
 * Owns the running quests.
 *
 * The list comes from the backend, which reads the process table rather than a flag
 * it set itself. A stub that died on its own is therefore reported as stopped
 * instead of being shown as running for ever.
 */
export function useQuests(): QuestController {
  const [quests, setQuests] = useState<QuestView[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppErrorShape | null>(null);

  const reload = useCallback(async () => {
    try {
      setQuests(await listQuests());
    } catch {
      // Outside the Tauri shell there is nothing to list. The catalogue still works.
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    const subscribe = async () => {
      try {
        const stop = await onQuestsChanged(() => {
          void reload();
        });
        if (cancelled) {
          stop();
          return;
        }
        unlisten = stop;
      } catch {
        // No event channel outside the Tauri shell.
      }
    };

    void subscribe();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [reload]);

  const start = useCallback(
    async (request: QuestRequest) => {
      setBusy(true);
      setError(null);
      try {
        await startQuest(request);
        await reload();
      } catch (failure) {
        setError(toAppError(failure));
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  const stop = useCallback(
    async (id: string) => {
      setBusy(true);
      setError(null);
      try {
        await stopQuest(id);
        await reload();
      } catch (failure) {
        setError(toAppError(failure));
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  const questFor = useCallback(
    (appId: string, registeredPath: string) =>
      quests.find(
        (quest) => quest.appId === appId && quest.registeredPath === registeredPath,
      ),
    [quests],
  );

  return useMemo(
    () => ({
      quests,
      questFor,
      busy,
      error,
      start,
      stop,
      clearError: () => setError(null),
    }),
    [quests, questFor, busy, error, start, stop],
  );
}
