import { useCallback, useEffect, useMemo, useState } from 'react';

import { listQuests, onQuestsChanged, startQuest, stopQuest, toAppError } from '../lib/ipc';
import type { AppErrorShape, QuestRequest, QuestView } from '../types/catalogue';

export interface QuestController {
  /** The quests that are running. */
  quests: QuestView[];
  /** The quest for an executable, if there is one. */
  questFor: (appId: string, registeredPath: string) => QuestView | undefined;
  /**
   * The backend's own failure for one executable, if the last attempt on it
   * failed.
   *
   * The failure is kept against the executable it happened to, so it can be shown
   * next to that game rather than as a message about the application at large.
   */
  failureFor: (appId: string, registeredPath: string) => AppErrorShape | undefined;
  /** True while a quest is being started or stopped. */
  busy: boolean;
  /** The last failure, shown next to the game it happened to. */
  error: AppErrorShape | null;
  start: (request: QuestRequest) => Promise<void>;
  stop: (id: string) => Promise<void>;
  clearError: () => void;
}

/**
 * The key a failure is filed under.
 *
 * It is the quest's identity: the application and the executable within it. A
 * failure is therefore always about one executable, and can always be shown next
 * to it.
 */
function failureKey(appId: string, registeredPath: string): string {
  return `${appId}:${registeredPath}`;
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
  const [failures, setFailures] = useState<Record<string, AppErrorShape>>({});

  const reload = useCallback(async () => {
    try {
      const list = await listQuests();
      setQuests(list.quests);
      // A failure the backend could not recover from is reported rather than
      // dropped: the app must not claim that nothing is running when it could
      // not find out.
      if (list.error) {
        setError(list.error);
      }
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

  const record = useCallback((appId: string, registeredPath: string, failure: AppErrorShape) => {
    setError(failure);
    setFailures((current) => ({
      ...current,
      [failureKey(appId, registeredPath)]: failure,
    }));
  }, []);

  const clear = useCallback((appId: string, registeredPath: string) => {
    setFailures((current) => {
      const key = failureKey(appId, registeredPath);
      if (!(key in current)) {
        return current;
      }
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const start = useCallback(
    async (request: QuestRequest) => {
      setBusy(true);
      setError(null);
      clear(request.appId, request.registeredPath);
      try {
        await startQuest(request);
        await reload();
      } catch (failure) {
        record(request.appId, request.registeredPath, toAppError(failure));
      } finally {
        setBusy(false);
      }
    },
    [clear, record, reload],
  );

  const stop = useCallback(
    async (id: string) => {
      setBusy(true);
      setError(null);
      try {
        await stopQuest(id);
        await reload();
      } catch (failure) {
        // The quest's identity is the key, so the failure lands next to the
        // executable it belongs to.
        const quest = quests.find((candidate) => candidate.id === id);
        if (quest) {
          record(quest.appId, quest.registeredPath, toAppError(failure));
        } else {
          setError(toAppError(failure));
        }
      } finally {
        setBusy(false);
      }
    },
    [quests, record, reload],
  );

  const questFor = useCallback(
    (appId: string, registeredPath: string) =>
      quests.find(
        (quest) => quest.appId === appId && quest.registeredPath === registeredPath,
      ),
    [quests],
  );

  const failureFor = useCallback(
    (appId: string, registeredPath: string) => failures[failureKey(appId, registeredPath)],
    [failures],
  );

  return useMemo(
    () => ({
      quests,
      questFor,
      failureFor,
      busy,
      error,
      start,
      stop,
      clearError: () => setError(null),
    }),
    [quests, questFor, failureFor, busy, error, start, stop],
  );
}
