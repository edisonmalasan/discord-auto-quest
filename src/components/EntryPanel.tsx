import { useElapsed } from '../hooks/useElapsed';
import type { QuestController } from '../hooks/useQuests';
import { useStubStates } from '../hooks/useStubStates';
import { platformLabel } from '../lib/format';
import type { CatalogEntry, CatalogExecutable, StubState } from '../types/catalogue';

import { Artwork, IconImage } from './Artwork';

interface EntryPanelProps {
  entry: CatalogEntry | null;
  quests: QuestController;
  currentPlatform: string | null;
  /** True where a quest needs a visible window to be detected. */
  needsVisibleWindow?: boolean;
}

/**
 * The selected entry, printed as a fact pass.
 *
 * Everything here is something the catalogue or the backend actually says. The panel
 * never claims Discord has credited a quest, because the app cannot observe that:
 * what it can say is that a stub is running, with which process id, for how long.
 */
export function EntryPanel({ entry, quests, currentPlatform, needsVisibleWindow = false }: EntryPanelProps) {
  // The stub's presence on disk is re-read whenever the quests change, because a
  // quest writes a stub and a stopped quest leaves one behind.
  const stubStates = useStubStates(entry?.id ?? null, quests.quests);

  return (
    <aside
      aria-label="Selected entry"
      className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-l border-rule"
    >
      {entry === null ? (
        <div className="px-5 py-6">
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            Select a line to read what Discord registered for that title.
          </p>
        </div>
      ) : (
        <SelectedEntry
          entry={entry}
          quests={quests}
          currentPlatform={currentPlatform}
          stubStates={stubStates}
          needsVisibleWindow={needsVisibleWindow}
        />
      )}
    </aside>
  );
}

function SelectedEntry({
  entry,
  quests,
  currentPlatform,
  stubStates,
  needsVisibleWindow,
}: {
  entry: CatalogEntry;
  quests: QuestController;
  currentPlatform: string | null;
  stubStates: Record<string, StubState>;
  needsVisibleWindow: boolean;
}) {
  const detected = entry.executables.length > 0;
  const native =
    currentPlatform !== null
      ? entry.executables.filter((executable) => executable.os === currentPlatform)
      : [];
  const fallback = detected && native.length === 0 ? entry.executables[0] : null;

  // A failure that belongs to one of this entry's executables is shown beside it.
  // One that belongs to no executable is shown at the foot of the panel.
  const shownHere = entry.executables.some((executable) =>
    quests.failureFor(entry.id, executable.path),
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-5 pt-5">
        <Artwork entry={entry} size={112} className="rounded-[3px]" />

        <div className="mt-3 flex items-start gap-2.5">
          <IconImage entry={entry} size={28} className="mt-0.5 rounded-[2px]" />
          <h3 className="text-[17px] font-semibold leading-tight tracking-[-0.01em] text-ink">
            {entry.name}
          </h3>
        </div>

        {entry.aliases.length > 0 ? (
          <p className="mt-1 text-[12px] text-ink-3">
            Also known as {entry.aliases.join(', ')}
          </p>
        ) : null}
      </div>

      <dl className="mt-5 border-t border-rule-soft">
        <Fact
          label="State"
          value={detected ? 'Detected' : 'Not detected'}
        />
        <Fact
          label="Platforms"
          value={
            detected
              ? [...new Set(entry.executables.map((executable) => platformLabel(executable.os)))].join(
                  ', ',
                )
              : '—'
          }
        />
        <Fact
          label="Launcher"
          value={entry.executables.some((executable) => executable.isLauncher) ? 'Yes' : 'No'}
        />
        <Fact label="Application id" value={entry.id} mono />
        {entry.ageRatings.length > 0 ? (
          <Fact label="Age ratings" value={entry.ageRatings.join(' · ')} mono />
        ) : null}
      </dl>

      {detected ? (
        <section className="mt-5 border-t border-rule-soft py-4">
          <h4 className="px-5 text-[10px] font-medium uppercase tracking-[0.11em] text-ink-3">
            Registered executables
          </h4>

          {fallback ? (
            <p className="mt-2 px-5 text-[11.5px] leading-snug text-warn">
              No {platformLabel(currentPlatform ?? '')} executable is registered for this title. A{' '}
              {platformLabel(fallback.os)} executable would be used.
            </p>
          ) : null}

          <ul className="mt-2">
            {entry.executables.map((executable) => (
              <ExecutableRow
                key={executable.path}
                entry={entry}
                executable={executable}
                quests={quests}
                stub={stubStates[executable.path]}
                needsVisibleWindow={needsVisibleWindow}
              />
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-5 border-t border-rule-soft px-5 py-4 text-[12px] leading-relaxed text-ink-2">
          Discord has not registered a launchable executable for this title, so there is no path to
          mirror and it cannot be quested.
        </p>
      )}

      {quests.error && !shownHere ? (
        <p
          role="alert"
          className="mt-4 border-t border-rule-soft px-5 py-3 text-[11.5px] leading-snug text-danger"
        >
          <span className="font-mono text-[10.5px] uppercase tracking-[0.06em]">
            {quests.error.code}
          </span>
          <span className="mt-1 block text-ink-2">{quests.error.message}</span>
        </p>
      ) : null}
    </div>
  );
}

function ExecutableRow({
  entry,
  executable,
  quests,
  stub,
  needsVisibleWindow,
}: {
  entry: CatalogEntry;
  executable: CatalogExecutable;
  quests: QuestController;
  stub: StubState | undefined;
  needsVisibleWindow: boolean;
}) {
  const quest = quests.questFor(entry.id, executable.path);
  const ended = quests.endedFor(entry.id, executable.path);
  const failure = quests.failureFor(entry.id, executable.path);
  const elapsed = useElapsed(quest?.running ? quest.startedAt : null);

  return (
    <li className="mt-1 px-5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.09em] text-ink-3">
          {platformLabel(executable.os)}
        </span>
        {executable.isLauncher ? (
          <span className="text-[10px] uppercase tracking-[0.09em] text-ink-3">Launcher</span>
        ) : null}
      </div>

      <p className="mt-0.5 break-all font-mono text-[11px] leading-snug text-ink-2">
        {executable.path}
      </p>

      {stub ? (
        <p className="mt-0.5 text-[11px] leading-snug text-ink-3">
          {stub.blocked
            ? 'This path cannot be mirrored'
            : stub.installed
              ? 'Stub on disk'
              : 'No stub on disk'}
        </p>
      ) : null}

      {stub && stub.blocked ? (
        <p className="mt-1.5 text-[11.5px] leading-snug text-danger">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.06em]">
            {stub.blocked.code}
          </span>
          <span className="mt-0.5 block text-ink-2">{stub.blocked.message}</span>
        </p>
      ) : null}

      {needsVisibleWindow ? (
        <p className="mt-1.5 text-[11.5px] leading-snug text-warn">
          A small window opens while the quest runs. On this platform Discord only detects an
          application with a visible window, so the window is part of the mechanism.
        </p>
      ) : null}

      {ended ? (
        <p className="mt-1.5 text-[11.5px] leading-snug text-ink-3">
          The last quest for this executable ended — its process is no longer running. Start it
          again to run it.
        </p>
      ) : null}

      {quest && quest.state === 'running' ? (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] tabular text-ink-3">
            PID <span className="text-ink-2">{quest.pid}</span> · {elapsed}
          </span>
          <button
            type="button"
            onClick={() => void quests.stop(quest.id)}
            disabled={quests.busy}
            className="rounded-[2px] border border-rule px-2 py-1 text-[11px] font-medium text-ink-2 transition-colors duration-150 hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Stop
          </button>
        </div>
      ) : quest && quest.state === 'missing' ? (
        <div className="mt-1.5">
          <p className="text-[11.5px] leading-snug text-warn">
            The stub was deleted from disk, so this quest is idle. The process is still there, but
            there is no file at the path Discord matches.
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] tabular text-ink-3">
              PID <span className="text-ink-2">{quest.pid}</span>
            </span>
            <button
              type="button"
              onClick={() => void quests.stop(quest.id)}
              disabled={quests.busy}
              className="rounded-[2px] border border-rule px-2 py-1 text-[11px] font-medium text-ink-2 transition-colors duration-150 hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              Stop
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() =>
            void quests.start({
              appId: entry.id,
              registeredPath: executable.path,
            })
          }
          disabled={quests.busy || Boolean(stub?.blocked)}
          className="mt-1.5 rounded-[2px] border border-spot px-2 py-1 text-[11px] font-medium text-spot transition-colors duration-150 hover:bg-spot hover:text-ground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start quest
        </button>
      )}

      {failure ? (
        <p role="alert" className="mt-1.5 text-[11.5px] leading-snug text-danger">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.06em]">
            {failure.code}
          </span>
          <span className="mt-0.5 block text-ink-2">{failure.message}</span>
        </p>
      ) : null}
    </li>
  );
}

function Fact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-rule-soft px-5 py-2">
      <dt className="text-[11.5px] text-ink-3">{label}</dt>
      <dd
        className={`min-w-0 truncate text-right text-[12px] text-ink ${
          mono ? 'font-mono text-[11.5px]' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
