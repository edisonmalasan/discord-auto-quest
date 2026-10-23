import { useCallback, useEffect, useRef, useState } from 'react';
import { discordStatus, listDiscordQuests, relaunchDiscord, startQuestWork, stopQuestWork, toAppError } from '../lib/ipc';
import type { AppErrorShape } from '../types/errors';
import type { DiscordStatus, QuestFeed } from '../types/quests';

export type DiscordPhase = 'loading' | 'ready' | 'blocked' | 'error';
export type ConnectionState = 'loading' | 'closed' | 'restart-needed' | 'connecting' | 'connected' | 'failed';
type Action = 'restart' | 'work' | 'stop';
export interface DiscordController {
  phase: DiscordPhase;
  status: DiscordStatus | null;
  feed: QuestFeed | null;
  error: AppErrorShape | null;
  operationError: AppErrorShape | null;
  busy: boolean;
  working: boolean;
  stale: boolean;
  pendingAction: Action | null;
  connectionState: ConnectionState;
  restart: () => void;
  work: () => void;
  stop: () => void;
  refresh: () => void;
}

export function useDiscord(): DiscordController {
  const [phase, setPhase] = useState<DiscordPhase>('loading');
  const [status, setStatus] = useState<DiscordStatus | null>(null);
  const [feed, setFeed] = useState<QuestFeed | null>(null);
  const [error, setError] = useState<AppErrorShape | null>(null);
  const [operationError, setOperationError] = useState<AppErrorShape | null>(null);
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [working, setWorking] = useState(false);
  const [fresh, setFresh] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const reading = useRef<number | null>(null);
  const acting = useRef(false);
  const needsStop = useRef(false);

  const poll = useCallback(async (epoch: number) => {
    if (reading.current === epoch) return;
    reading.current = epoch;
    let statusRead = false;
    const current = () => mounted.current && generation.current === epoch;
    try {
      const found = await discordStatus();
      if (!current()) return;
      statusRead = true; setStatus(found); setPhase(found.ready ? 'ready' : 'blocked');
      if (!found.ready) { setFresh(false); setError(null); return; }
      const quests = await listDiscordQuests();
      if (!current()) return;
      setFeed(quests); setFresh(true); setError(null);
    } catch (failure) {
      if (!current()) return;
      setFresh(false); setError(toAppError(failure));
      if (!statusRead) setPhase('error');
    } finally { if (reading.current === epoch) reading.current = null; }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const epoch = ++generation.current;
    void poll(epoch);
    const timer = window.setInterval(() => { if (!acting.current) void poll(generation.current); }, 4000);
    return () => { mounted.current = false; generation.current++; window.clearInterval(timer); };
  }, [poll]);

  const act = useCallback((action: Action) => {
    if (acting.current || (action === 'work' && needsStop.current)) return;
    acting.current = true;
    const epoch = ++generation.current;
    setPendingAction(action); setOperationError(null);
    if (action === 'restart') setFresh(false);
    void (async () => {
      try {
        if (action === 'restart') await relaunchDiscord();
        else if (action === 'work') await startQuestWork();
        else await stopQuestWork();
        if (!mounted.current || generation.current !== epoch) return;
        needsStop.current = action === 'work';
        setWorking(needsStop.current);
        await poll(epoch);
      } catch (failure) {
        if (mounted.current && generation.current === epoch) {
          const problem = toAppError(failure);
          if (action === 'work' && problem.code === 'OPERATION_UNCERTAIN') {
            needsStop.current = true;
            setWorking(true);
          }
          setOperationError(problem);
        }
      } finally {
        acting.current = false;
        if (mounted.current && generation.current === epoch) setPendingAction(null);
      }
    })();
  }, [poll]);

  const restart = useCallback(() => act('restart'), [act]);
  const work = useCallback(() => act('work'), [act]);
  const stop = useCallback(() => act('stop'), [act]);
  const refresh = useCallback(() => { if (!acting.current) void poll(generation.current); }, [poll]);
  const stale = feed !== null && !fresh;
  const connectionState: ConnectionState = pendingAction === 'restart' ? 'connecting'
    : phase === 'loading' ? 'loading' : error ? 'failed'
      : !status?.installed || status.running === false ? 'closed'
        : !status.ready ? 'restart-needed' : fresh ? 'connected' : 'connecting';
  return { phase, status, feed, error, operationError, pendingAction, busy: pendingAction !== null,
    working, stale, connectionState, restart, work, stop, refresh };
}
