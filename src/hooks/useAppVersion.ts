import { useEffect, useState } from 'react';

import { appVersion } from '../lib/ipc';

/**
 * The version of the running application.
 *
 * The backend is the authority. The frontend does not carry a version of its
 * own, because a number in the interface that the application does not confirm
 * is a number that can be wrong.
 */
export function useAppVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const read = async () => {
      try {
        const stated = await appVersion();
        if (!cancelled) {
          setVersion(stated);
        }
      } catch {
        // The panel can be shown without it. The version is an addition, not a
        // requirement: the app works whether or not the backend answers.
      }
    };

    void read();

    return () => {
      cancelled = true;
    };
  }, []);

  return version;
}
