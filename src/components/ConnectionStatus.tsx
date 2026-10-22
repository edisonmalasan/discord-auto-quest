import type { ConnectionState } from '../hooks/useDiscord';
import type { DiscordStatus } from '../types/quests';
import type { AppErrorShape } from '../types/errors';
interface Props { state: ConnectionState; status: DiscordStatus | null; error: AppErrorShape | null; busy: boolean; onRestart: () => void; onRetry: () => void }
export function ConnectionStatus({ state, status, error, busy, onRestart, onRetry }: Props) {
  const labels: Record<ConnectionState, string> = { loading: 'Connecting to Discord…', connecting: 'Connecting to Discord…', connected: 'Discord connected', closed: status?.installed ? 'Discord is closed' : 'Discord not found', 'restart-needed': 'Discord needs a restart', failed: 'Discord connection lost' };
  const restartNeeded = state === 'restart-needed' || state === 'closed' && status?.installed;
  return <div className="connection">
    <p role="status"><span className={`status-dot ${state === 'connected' ? 'connected' : ''}`}/>{labels[state]}</p>
    {error && <p className="connection-detail" role="alert">{error.message}</p>}
    {restartNeeded && <><p className="connection-detail">{status?.action ?? 'Restarting Discord interrupts your activity. Restart only when you are ready.'}</p><button className="button secondary" disabled={busy} onClick={onRestart}>Restart Discord</button></>}
    {state === 'closed' && !status?.installed && <p className="connection-detail">Open the Discord desktop app, then check again.</p>}
    {(state === 'failed' || state === 'closed') && <button className="connection-retry" disabled={busy} onClick={onRetry}>{state === 'failed' ? 'Try again' : 'Check again'}</button>}
  </div>;
}
