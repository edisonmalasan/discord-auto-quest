/**
 * The icon set.
 *
 * Every icon is drawn here, on one 16-unit grid, at one stroke weight, so they read
 * as a single family rather than a collection of borrowed glyphs.
 */

interface IconProps {
  className?: string;
}

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...STROKE}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.2 10.2 13.5 13.5" />
    </svg>
  );
}

export function RefreshIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...STROKE}>
      <path d="M13.25 8a5.25 5.25 0 1 1-1.6-3.78" />
      <path d="M13.4 1.9v2.6h-2.6" />
    </svg>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...STROKE}>
      <path d="M8 2.4 14.6 13.6H1.4L8 2.4Z" />
      <path d="M8 6.6v3.1" />
      <path d="M8 11.6h.01" />
    </svg>
  );
}

export function ArchiveIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...STROKE}>
      <path d="M1.9 4.3h12.2v2.1H1.9z" />
      <path d="M3 6.4v7.3h10V6.4" />
      <path d="M6.4 8.8h3.2" />
    </svg>
  );
}

export function SignalIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...STROKE}>
      <path d="M1.9 8h1.9" />
      <path d="M6.1 8h1.9" />
      <path d="M10.3 8h1.9" />
      <path d="M4.8 4.6v6.8" />
      <path d="M9 4.6v6.8" />
      <path d="M13.2 4.6v6.8" />
    </svg>
  );
}

export function CrossIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...STROKE}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}
