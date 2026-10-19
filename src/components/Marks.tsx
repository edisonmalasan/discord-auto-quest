/**
 * The margin marks.
 *
 * A filled square means Discord has registered an executable for the title, and
 * there is a path to mirror. A hollow square means there is not. This is the key the
 * whole index is read against.
 */
export function DetectedMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 8 8" className={className} aria-hidden="true">
      <rect x="0.75" y="0.75" width="6.5" height="6.5" rx="0.75" fill="var(--color-spot)" />
    </svg>
  );
}

export function UndetectedMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 8 8" className={className} aria-hidden="true">
      <rect
        x="0.75"
        y="0.75"
        width="6.5"
        height="6.5"
        rx="0.75"
        fill="none"
        stroke="var(--color-ink-3)"
        strokeWidth="1"
      />
    </svg>
  );
}

/** The pointer that marks the selected line. */
export function SelectionCaret({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 8 12" className={className} aria-hidden="true">
      <path d="M1 1.5 6.5 6 1 10.5Z" fill="var(--color-spot)" />
    </svg>
  );
}
