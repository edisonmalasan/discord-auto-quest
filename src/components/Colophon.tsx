import { useAppVersion } from '../hooks/useAppVersion';

/** Version and legal information, confirmed by the running backend. */
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
    <section aria-labelledby="about-heading" className="about-details">
      <h2
        id="about-heading"
      >
        About Discord Auto Quest
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
