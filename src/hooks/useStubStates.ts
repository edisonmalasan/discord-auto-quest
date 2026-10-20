import { useEffect, useState } from 'react';

import { stubStates } from '../lib/ipc';
import type { StubState } from '../types/catalogue';

/**
 * The state of an application's stubs on disk, read from the backend.
 *
 * The backend checks the filesystem every time it is asked, so this is a fact about
 * the disk rather than a flag the interface set when it started something. The
 * list is re-read whenever the quests change, because a quest writes a stub and a
 * stopped quest leaves one behind.
 */
export function useStubStates(
  appId: string | null,
  revision: unknown,
): Record<string, StubState> {
  const [states, setStates] = useState<Record<string, StubState>>({});

  useEffect(() => {
    if (appId === null) {
      setStates({});
      return;
    }

    let cancelled = false;

    const read = async () => {
      try {
        const result = await stubStates(appId);
        if (cancelled) {
          return;
        }
        setStates(
          Object.fromEntries(result.map((state) => [state.registeredPath, state])),
        );
      } catch {
        // Outside the Tauri shell there is no filesystem to ask. The panel still
        // works; it simply cannot say what is on disk.
        if (!cancelled) {
          setStates({});
        }
      }
    };

    void read();

    return () => {
      cancelled = true;
    };
  }, [appId, revision]);

  return states;
}
