import type { DiscordStatus } from '../types/quests';

interface DiscordGateProps {
  status: DiscordStatus | null;
  busy: boolean;
  onRestart: () => void;
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
export function DiscordGate({ status, busy, onRestart }: DiscordGateProps) {
  if (!status) {
    return null;
  }

  if (!status.installed) {
    return (
      <div className="border-b border-rule px-5 py-2.5">
        <p className="text-[12.5px] text-danger">
          Discord is not installed on this machine, so there is nothing to work with.
        </p>
      </div>
    );
  }

  if (!status.ready) {
    return (
      <div className="flex items-center justify-between gap-6 border-b border-rule px-5 py-2.5">
        <p className="min-w-0 text-[12.5px] text-warn">
          {status.action ??
            'Discord has to be restarted so the application can drive it.'}
        </p>

        <button
          type="button"
          onClick={onRestart}
          disabled={busy}
          className="shrink-0 rounded-[3px] bg-spot px-3 py-1.5 text-[12px] font-semibold text-ground transition-colors duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Restart Discord
        </button>
      </div>
    );
  }

  return null;
}
