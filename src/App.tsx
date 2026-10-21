import { useEffect, useState } from 'react';

import { AppMark } from './components/AppMark';
import { Colophon } from './components/Colophon';
import { DiscordGate } from './components/DiscordGate';
import { QuestColumn } from './components/QuestColumn';
import { useDiscord } from './hooks/useDiscord';

export default function App() {
  const discord = useDiscord();
  const [failure, setFailure] = useState<string | null>(null);

  // The backend's failure is the one that matters, so it is shown as it came.
  useEffect(() => {
    if (discord.error) {
      setFailure(discord.error.message);
    }
  }, [discord.error]);

  const feed = discord.feed;
  const claimed = feed?.claimed ?? [];
  const available = feed?.available ?? [];

  const handleWork = () => {
    setFailure(null);
    discord.work();
  };

  const handleStop = () => {
    setFailure(null);
    discord.stop();
  };

  return (
    <div className="flex h-full flex-col bg-ground">
      <header className="flex h-14 shrink-0 items-center justify-between gap-6 border-b border-rule px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <AppMark className="size-6 shrink-0" />
          <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">
            discord-auto-quest
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-4">
          <p
            role="status"
            aria-live="polite"
            className={`truncate text-[12px] tabular ${
              discord.phase === 'ready' ? 'text-ink-2' : 'text-warn'
            }`}
          >
            {describe(discord.phase, discord.status?.ready ?? false)}
          </p>
        </div>
      </header>

      <DiscordGate
        status={discord.status}
        busy={discord.busy}
        onRestart={discord.restart}
        onAttach={discord.attach}
      />

      {failure && (
        <div className="flex items-center justify-between gap-3 border-b border-rule bg-surface px-5 py-3">
          <p className="text-[12px] text-danger">{failure}</p>
          <button
            type="button"
            onClick={() => setFailure(null)}
            className="shrink-0 rounded-[3px] border border-rule px-3 py-1.5 text-[12px] text-ink-2 transition-colors duration-150 hover:border-ink-3 hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-rule px-5 py-3">
          <div className="min-w-0">
            <p className="text-[12px] text-ink-2">
              {discord.working
                ? 'Working your accepted quests. Discord counts them; this window only shows it.'
                : 'Accept a quest in Discord, then work it from here.'}
            </p>
            {feed && !feed.desktopApp && (
              <p className="mt-1 text-[11px] text-warn">
                The quest script needs the Discord desktop application, not Discord in a browser.
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {discord.working ? (
              <button
                type="button"
                onClick={handleStop}
                disabled={discord.busy}
                className="rounded-[3px] border border-rule px-3 py-1.5 text-[12px] text-ink-2 transition-colors duration-150 hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={handleWork}
                disabled={discord.busy || discord.phase !== 'ready'}
                className="rounded-[3px] border border-spot/60 bg-spot/10 px-3 py-1.5 text-[12px] font-semibold text-spot transition-colors duration-150 hover:bg-spot/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Work my quests
              </button>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 divide-x divide-rule">
          <QuestColumn
            title="On offer"
            note="Quests Discord is running that you have not accepted. Accept one in Discord to work it."
            quests={available}
            working={discord.working}
            empty={
              discord.phase === 'loading'
                ? 'Reading Discord…'
                : 'Nothing on offer, or nothing this application can read.'
            }
          />

          <QuestColumn
            title="Accepted"
            note="The quests you have accepted, and how far along each one is."
            quests={claimed}
            working={discord.working}
            empty={
              discord.phase === 'loading'
                ? 'Reading Discord…'
                : 'No accepted quests. Accept one in the Quests tab of Discord.'
            }
          />
        </div>
      </div>

      <footer className="shrink-0 border-t border-rule px-5 py-3">
        <Colophon compact />      </footer>
    </div>
  );
}

/** Where the application stands with Discord, in a few words. */
function describe(phase: string, ready: boolean): string {
  switch (phase) {
    case 'loading':
      return 'Looking for Discord…';
    case 'error':
      return 'Discord could not be reached';
    case 'blocked':
      return 'Discord needs a restart';
    default:
      return ready ? 'Discord · ready' : 'Discord';
  }
}
