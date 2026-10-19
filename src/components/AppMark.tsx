/**
 * The app mark: a quest that is mostly complete.
 *
 * The ring is open at the top left, and the core sits inside it. It is the same mark
 * as the application icon, drawn at the size the interface needs.
 */
export function AppMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="5.5" fill="#3f4bc4" />
      <circle
        cx="12"
        cy="12"
        r="7"
        fill="none"
        stroke="#e7eae8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="35 44"
        transform="rotate(-90 12 12)"
      />
      <circle cx="12" cy="12" r="2.4" fill="#e7eae8" />
    </svg>
  );
}
