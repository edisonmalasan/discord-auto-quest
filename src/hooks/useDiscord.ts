import { useCallback, useEffect, useRef, useState } from 'react';

import {
  attachDiscord,
  discordStatus,
  listDiscordQuests,
  relaunchDiscord,
  runQuestScript,
  stopQuestScript,
  toAppError,
} from '../lib/ipc';
import type { AppErrorShape } from '../types/errors';
import type { DiscordStatus, QuestFeed } from '../types/quests';

export type DiscordPhase = 'loading' | 'ready' | 'blocked' | 'error';

export interface DiscordController {
  /** Where the application stands with Discord. */
  phase: DiscordPhase;
  /** What Discord's status is, and what the user has to do about it. */
  status: DiscordStatus | null;
  /** Discord's quests, as the backend read them. */
  feed: QuestFeed | null;
  /** A failure that stopped the quests from being read. */
  error: AppErrorShape | null;
  /** True while an action the user asked for is in flight. */
  busy: boolean;
  /** True while the script is working a quest. */
  working: boolean;
  /** Attach to Discord, without restarting it. */
  attach: () => void;
  /** Restart Discord so the application can drive it. */
  restart: () => void;
  /** Run the quest script. */
  work: () => void;
  /** Put Discord's own methods back. */
  stop: () => void;
  /** Read the quests again now. */
  refresh: () => void;
}

/**
 * How often the quests are read again while the application is open.
 *
 * A quest counts in Discord's own time, so the interface has to keep asking.
 * Four seconds is often enough to see the count move and seldom enough not to
 * crowd the client.
 */
const POLL_MS = 4000;

/**
 * Owns Discord: where it stands, what quests it has, and what is being done
 * about them.
 *
 * Everything here is backend state. The interface shows what Discord said, and
 * it never says a quest is finished unless Discord says so.
 */
export function useDiscord(): DiscordController {
  const [phase, setPhase] = useState<DiscordPhase>('loading');
  const [status, setStatus] = useState<DiscordStatus | null>(null);
  const [feed, setFeed] = useState<QuestFeed | null>(null);
  const [error, setError] = useState<AppErrorShape | null>(null);
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const read = useCallback(async () => {
    try {
      const quests = await listDiscordQuests();
      if (!mounted.current) {
        return true;
      }
      setFeed(quests);
      setError(null);
      return true;
    } catch (failure) {
      if (!mounted.current) {
        return false;
      }
      setError(toAppError(failure));
      return false;
    }
  }, []);

  const look = useCallback(async () => {
    try {
      const found = await discordStatus();
      if (!mounted.current) {
        return;
      }
      setStatus(found);
      setPhase(found.ready ? 'ready' : 'blocked');
    } catch (failure) {
      if (!mounted.current) {
        return;
      }
      setError(toAppError(failure));
      setPhase('error');
    }
  }, []);

  // On mount: where Discord stands, and then the quests, if it can be asked.
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      await look();
      if (cancelled) {
        return;
      }
      await read();
    };

    void start();
    return () => {
      cancelled = true;
    };
  }, [look, read]);

  // The quests are read again and again, because a quest counts in Discord's
  // time and the interface has to keep up with it.
  useEffect(() => {
    if (phase !== 'ready') {
      return;
    }

    const timer = window.setInterval(() => {
      void read();
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, [phase, read]);

  const attach = useCallback(() => {
    setBusy(true);
    void (async () => {
      try {
        await attachDiscord();
        if (mounted.current) {
          await look();
          await read();
        }
      } catch (failure) {
        if (mounted.current) {
          setError(toAppError(failure));
        }
      } finally {
        if (mounted.current) {
          setBusy(false);
        }
      }
    })();
  }, [look, read]);

  const restart = useCallback(() => {
    setBusy(true);
    void (async () => {
      try {
        await relaunchDiscord();
        if (mounted.current) {
          await look();
          await read();
        }
      } catch (failure) {
        if (mounted.current) {
          setError(toAppError(failure));
        }
      } finally {
        if (mounted.current) {
          setBusy(false);
        }
      }
    })();
  }, [look, read]);

  const work = useCallback(() => {
    setBusy(true);
    void (async () => {
      try {
        await runQuestScript();
        if (mounted.current) {
          setWorking(true);
          await read();
        }
      } catch (failure) {
        if (mounted.current) {
          setError(toAppError(failure));
        }
      } finally {
        if (mounted.current) {
          setBusy(false);
        }
      }
    })();
  }, [read]);

  const stop = useCallback(() => {
    setBusy(true);
    void (async () => {
      try {
        await stopQuestScript();
        if (mounted.current) {
          setWorking(false);
          await read();
        }
      } catch (failure) {
        if (mounted.current) {
          setError(toAppError(failure));
        }
      } finally {
        if (mounted.current) {
          setBusy(false);
        }
      }
    })();
  }, [read]);

  const refresh = useCallback(() => {
    void read();
  }, [read]);

  return {
    phase,
    status,
    feed,
    error,
    busy,
    working,
    attach,
    restart,
    work,
    stop,
    refresh,
  };
}
