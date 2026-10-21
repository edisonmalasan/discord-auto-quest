import type { DiscordStatus } from '../types/quests';

interface DiscordGateProps {
  status: DiscordStatus | null;
  busy: boolean;
  onRestart: () => void;
  onAttach: () => void;
}

/**
 * What stands between the user and a working quest.
 *
 * There is usually nothing between them, and then this says nothing. When
 * there is something, it says what it is, in words, and offers the one action
 * that would clear it.
 *
 * **The restart is never automatic.** Restarting Discord ends whatever the user
 * was doing in it — a voice call, most likely — so the button is there and the
 * decision is theirs.
 */
export function DiscordGate({ status, busy, onRestart, onAttach }: DiscordGateProps) {
  if (!status) {
    return null;
  }

  if (!status.installed) {
    return (
      <div className="flex items-center gap-3 border-b border-rule bg-surface px-5 py-3">
        <p className="text-[12px] text-danger">
          Discord is not installed on this machine, so there is nothing to work with.
        </p>
      </div>
    );
  }

  if (!status.ready) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-surface px-5 py-3">
        <p className="max-w-[70ch] text-[12px] text-warn">
          {status.action ?? 'Discord has to be restarted so the application can drive it.'}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAttach}
            disabled={busy}
            className="rounded-[3px] border border-rule px-3 py-1.5 text-[12px] text-ink-2 transition-colors duration-150 hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onRestart}
            disabled={busy}
            className="rounded-[3px] border border-spot/60 bg-spot/10 px-3 py-1.5 text-[12px] font-semibold text-spot transition-colors duration-150 hover:bg-spot/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Restart Discord
          </button>
        </div>
      </div>
    );
  }

  return null;
}
