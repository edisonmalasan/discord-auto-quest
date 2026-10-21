import { useEffect, useState } from 'react';

import { AppMark } from './components/AppMark';
import { Colophon } from './components/Colophon';
import { DiscordGate } from './components/DiscordGate';
import { QuestIndex } from './components/QuestIndex';
import { useDiscord } from './hooks/useDiscord';
import { awaitingClaim, awaitingUser, requirement } from './lib/quests';
import type { QuestSummary } from './types/quests';

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
  const accepted = feed?.claimed ?? [];
  const available = feed?.available ?? [];
  const finished = awaitingClaim(accepted);
  const waiting = awaitingUser(accepted);

  return (
    <div className="flex h-full flex-col bg-ground">
      <header className="flex h-14 shrink-0 items-center justify-between gap-6 border-b border-rule px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <AppMark className="size-6 shrink-0" />
          <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">
            discord-auto-quest
          </span>
        </div>

        <p
          role="status"
          aria-live="polite"
          className={`truncate font-mono text-[11.5px] tabular ${
            discord.phase === 'ready' ? 'text-ink-3' : 'text-warn'
          }`}
        >
          {status(discord.phase)}
        </p>
      </header>

      <DiscordGate
        status={discord.status}
        busy={discord.busy}
        onRestart={discord.restart}
      />

      {failure && (
        <div className="flex items-center justify-between gap-4 border-b border-rule px-5 py-2.5">
          <p className="text-[12.5px] text-danger">{failure}</p>
          <button
            type="button"
            onClick={() => setFailure(null)}
            className="shrink-0 text-[12px] text-ink-3 transition-colors duration-150 hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex shrink-0 items-center justify-between gap-6 border-b border-rule px-5 py-3">
        <p className="min-w-0 text-[12.5px] text-ink-2">
          {instruction(discord.working, finished, waiting)}
        </p>

        {discord.working ? (
          <button
            type="button"
            onClick={() => {
              setFailure(null);
              discord.stop();
            }}
            disabled={discord.busy}
            className="shrink-0 rounded-[3px] border border-rule px-3 py-1.5 text-[12px] text-ink-2 transition-colors duration-150 hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setFailure(null);
              discord.work();
            }}
            disabled={discord.busy || discord.phase !== 'ready'}
            className="shrink-0 rounded-[3px] bg-spot px-3 py-1.5 text-[12px] font-semibold text-ground transition-colors duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Work my quests
          </button>
        )}
      </div>

      <QuestIndex accepted={accepted} available={available} />

      <footer className="shrink-0 border-t border-rule px-5 py-2.5">
        <Colophon compact />
      </footer>
    </div>
  );
}

/** Where the application stands with Discord, in a few words. */
function status(phase: string): string {
  switch (phase) {
    case 'loading':
      return 'reading discord';
    case 'error':
      return 'discord unreachable';
    case 'blocked':
      return 'discord needs a restart';
    default:
      return 'discord ready';
  }
}

/** What needs doing now, in one sentence. */
function instruction(
  working: boolean,
  finished: QuestSummary | null,
  waiting: QuestSummary | null,
): string {
  if (finished) {
    return `${finished.name} is finished — claim the reward in Discord.`;
  }

  if (waiting) {
    const need = requirement(waiting);
    if (need) {
      return `${waiting.name} ${need}.`;
    }
  }

  if (working) {
    return 'Working your quests. Discord counts them; this window only shows it.';
  }

  return 'Accept a quest in Discord, then work it from here.';
}
