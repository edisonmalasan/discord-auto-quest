import { useCallback, useEffect, useRef, useState } from 'react';
import { discordStatus, listDiscordQuests, relaunchDiscord, startQuestWork, stopQuestWork, toAppError, questEnrollment, questWorkStatus, selectQuestDesktop } from '../lib/ipc';
import type { EnrollmentRun, DesktopSelectionRun } from '../types/enrollment';
import type { AppErrorShape } from '../types/errors';
import type { DiscordStatus, QuestFeed } from '../types/quests';
import { stoppedWork, type WorkState } from '../types/work';

export type DiscordPhase = 'loading' | 'ready' | 'blocked' | 'error';
export type ConnectionState = 'loading' | 'closed' | 'restart-needed' | 'connecting' | 'connected' | 'failed';
type Action = 'restart' | 'work' | 'stop' | 'accept' | 'platform';
export interface DiscordController {
  phase: DiscordPhase;
  status: DiscordStatus | null;
  feed: QuestFeed | null;
  error: AppErrorShape | null;
  operationError: AppErrorShape | null;
  busy: boolean;
  working: boolean;
  workState: WorkState;
  stale: boolean;
  pendingAction: Action | null;
  connectionState: ConnectionState;
  restart: () => void;
  work: () => void;
  stop: () => void;
  refresh: () => void;
  enrollment: EnrollmentRun;
  selectDesktop: DesktopSelectionRun;
}

export function useDiscord(): DiscordController {
  const [phase, setPhase] = useState<DiscordPhase>('loading');
  const [status, setStatus] = useState<DiscordStatus | null>(null);
  const [feed, setFeed] = useState<QuestFeed | null>(null);
  const [error, setError] = useState<AppErrorShape | null>(null);
  const [operationError, setOperationError] = useState<AppErrorShape | null>(null);
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [workState, setWorkState] = useState<WorkState>(stoppedWork);
  const working = workState.phase !== 'stopped';
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
      const [found, session] = await Promise.all([discordStatus(), questWorkStatus()]);
      if (!current()) return;
      if (!(needsStop.current && session.phase === 'stopped')) {
        needsStop.current = session.phase !== 'stopped';
        setWorkState(session);
      }
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
        let session: WorkState;
        if (action === 'restart') {
          if (needsStop.current) {
            session = await stopQuestWork();
            if (session.phase !== 'stopped') throw new Error('Stop Work before restarting Discord.');
          }
          await relaunchDiscord(); session = stoppedWork();
        } else session = action === 'work' ? await startQuestWork() : await stopQuestWork();
        if (!mounted.current || generation.current !== epoch) return;
        needsStop.current = session.phase !== 'stopped';
        setWorkState(session);
        await poll(epoch);
      } catch (failure) {
        if (mounted.current && generation.current === epoch) {
          const problem = toAppError(failure);
          if (action === 'work' && problem.code === 'OPERATION_UNCERTAIN') {
            needsStop.current = true;
            setWorkState(previous => ({...previous, phase:'paused', message:problem.message}));
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
  const enrollment: EnrollmentRun = useCallback(async (id, revision) => {
    if (acting.current || ['starting','stopping','paused'].includes(workState.phase) || !fresh || !status?.ready || !feed?.desktopApp) throw new Error('Reconnect and resolve the Work session before accepting a quest.');
    acting.current = true;
    const epoch = ++generation.current;
    setPendingAction('accept');
    try { return await questEnrollment(id, revision); }
    finally { acting.current = false; if (revision) await poll(epoch); if (mounted.current && generation.current === epoch) setPendingAction(null); }
  }, [fresh, status, feed, workState.phase, poll]);
  const selectDesktop: DesktopSelectionRun = useCallback(async (id) => {
    if (acting.current || ['starting','stopping','paused'].includes(workState.phase) || workState.activeQuestId === id || !fresh || !status?.ready || !feed?.desktopApp) throw new Error('Reconnect and resolve the active Work job before choosing Desktop.');
    acting.current = true;
    const epoch = ++generation.current;
    setPendingAction('platform');
    try { return await selectQuestDesktop(id); }
    finally { acting.current = false; await poll(epoch); if (mounted.current && generation.current === epoch) setPendingAction(null); }
  }, [fresh, status, feed, workState, poll]);
  const work = useCallback(() => act('work'), [act]);
  const stop = useCallback(() => act('stop'), [act]);
  const refresh = useCallback(() => { if (!acting.current) void poll(generation.current); }, [poll]);
  const stale = feed !== null && !fresh;
  const connectionState: ConnectionState = pendingAction === 'restart' ? 'connecting'
    : phase === 'loading' ? 'loading' : error ? 'failed'
      : !status?.installed || status.running === false ? 'closed'
        : !status.ready ? 'restart-needed' : fresh ? 'connected' : 'connecting';
  return { phase, status, feed, error, operationError, pendingAction, busy: pendingAction !== null,
    working, workState, stale, connectionState, restart, work, stop, refresh, enrollment, selectDesktop };
}
