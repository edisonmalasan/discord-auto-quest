import { useAppVersion } from '../hooks/useAppVersion';

/**
 * The colophon: what this is, what version it is, and who it belongs to.
 *
 * A printed catalogue ends with a colophon — the note that says who set it and
 * under what terms. This one is the application's, and it carries the three
 * facts a person is owed: the version they are running, the licence it is under,
 * and that it is nobody else's project.
 *
 * The version comes from the backend. The interface does not keep a copy of its
 * own, because a number it cannot confirm is a number that can be wrong.
 */
export function Colophon({ compact = false }: { compact?: boolean } = {}) {
  const version = useAppVersion();

  if (compact) {
    return (
      <p className="text-[11px] leading-snug text-ink-3">
        <span className="font-mono tabular text-ink-2">{version ?? '—'}</span>
        {' · MIT · '}
        An independent project. Not affiliated with, endorsed by, or connected to Discord Inc.
      </p>
    );
  }

  return (
    <section aria-labelledby="colophon-heading" className="px-4 py-5">
      <h2
        id="colophon-heading"
        className="text-[10px] font-medium uppercase tracking-[0.11em] text-ink-3"
      >
        Colophon
      </h2>

      <dl className="mt-3 space-y-1.5 text-[12px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-2">Version</dt>
          <dd className="font-mono text-[11.5px] tabular text-ink">
            {version ?? '—'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-2">Licence</dt>
          <dd className="text-ink">MIT</dd>
        </div>
      </dl>

      <p className="mt-2.5 text-[11px] leading-snug text-ink-3">
        An independent project. Not affiliated with, endorsed by, or connected to Discord Inc.
      </p>
    </section>
  );
}
