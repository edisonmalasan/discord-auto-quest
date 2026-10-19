import { formatMoment, pathBasename, pathSegments, platformLabel } from '../lib/format';
import type { CatalogEntry } from '../types/catalogue';

import { CoverImage } from './CoverImage';

interface EntryPanelProps {
  entry: CatalogEntry | null;
  /** The user's data directory, where a stub would be created. */
  dataDirectory: string | null;
  /** The platform this build runs on, in the catalogue's vocabulary. */
  currentPlatform: string | null;
}

/**
 * The selected entry, printed as a fact pass.
 *
 * Everything here is something the catalogue actually says. The panel never claims
 * Discord has credited anything, because the app cannot observe that.
 */
export function EntryPanel({ entry, dataDirectory, currentPlatform }: EntryPanelProps) {
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
          dataDirectory={dataDirectory}
          currentPlatform={currentPlatform}
        />
      )}
    </aside>
  );
}

function SelectedEntry({
  entry,
  dataDirectory,
  currentPlatform,
}: {
  entry: CatalogEntry;
  dataDirectory: string | null;
  currentPlatform: string | null;
}) {
  const detected = entry.executables.length > 0;
  const native = currentPlatform
    ? entry.executables.filter((executable) => executable.os === currentPlatform)
    : [];
  const fallback = detected && native.length === 0 ? entry.executables[0] : null;
  const segments = entry.executables[0] ? pathSegments(entry.executables[0].path) : [];
  const stubLocation =
    dataDirectory && segments.length > 0
      ? `${dataDirectory}\\games\\${entry.id}\\${segments
          .slice(0, -1)
          .join('\\')}\\${pathBasename(entry.executables[0].path).replace(/\.[^.]+$/, '')}`
      : null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-5 pt-5">
        <CoverImage entry={entry} size={112} className="rounded-[3px]" />

        <h3 className="mt-3 text-[17px] font-semibold leading-tight tracking-[-0.01em] text-ink">
          {entry.name}
        </h3>

        {entry.aliases.length > 0 ? (
          <p className="mt-1 text-[12px] text-ink-3">
            Also known as {entry.aliases.join(', ')}
          </p>
        ) : null}
      </div>

      <dl className="mt-5 border-t border-rule-soft">
        <Fact label="State" value={detected ? 'Detected' : 'Not detected'} />
        <Fact label="Platform" value={entry.executables[0] ? platformLabel(entry.executables[0].os) : '—'} />
        <Fact
          label="Launcher"
          value={entry.executables.some((executable) => executable.isLauncher) ? 'Yes' : 'No'}
        />
        <Fact label="Application id" value={entry.id} mono />
        {entry.ageRatings.length > 0 ? (
          <Fact label="Age ratings" value={entry.ageRatings.join(' · ')} mono />
        ) : null}
      </dl>

      {segments.length > 0 ? (
        <section className="mt-5 border-t border-rule-soft px-5 py-4">
          <h4 className="text-[10px] font-medium uppercase tracking-[0.11em] text-ink-3">
            Registered path
          </h4>
          <p className="mt-1 text-[11.5px] leading-snug text-ink-3">
            The path Discord matches against. The stub is created at the same shape, with the
            file extension removed.
          </p>
          <ol className="mt-2.5 space-y-0.5 font-mono text-[11.5px]">
            {segments.map((segment, index) => (
              <li
                key={`${segment}-${index}`}
                className={index === segments.length - 1 ? 'text-ink' : 'text-ink-3'}
              >
                {segment}
              </li>
            ))}
          </ol>
          {stubLocation ? (
            <p className="mt-3 break-all font-mono text-[11px] leading-relaxed text-ink-3">
              {stubLocation}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="mt-auto border-t border-rule px-5 py-4">
        {!detected ? (
          <p className="mb-3 text-[12px] leading-relaxed text-ink-2">
            Discord has not registered a launchable executable for this title, so there is no
            path to mirror and it cannot be quested.
          </p>
        ) : fallback ? (
          <p className="mb-3 text-[12px] leading-relaxed text-ink-2">
            No {platformLabel(currentPlatform ?? '')} executable is registered for this title. A{' '}
            {platformLabel(fallback.os)} executable would be used as a fallback.
          </p>
        ) : null}

        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-[3px] border border-rule px-3 py-2 text-[12.5px] font-medium text-ink-3"
        >
          Start quest
        </button>
        <p className="mt-2 text-[11px] leading-snug text-ink-3">
          Starting a quest is not part of this build yet.
        </p>
      </div>
    </div>
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

/** The moment the catalogue was fetched, for the panel footer. */
export function fetchedAtLabel(fetchedAt: number | null): string {
  return formatMoment(fetchedAt);
}
