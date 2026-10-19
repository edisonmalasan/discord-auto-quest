import { catalogueErrorTitle } from '../lib/format';
import type { AppErrorShape } from '../types/catalogue';

import { AlertIcon, RefreshIcon } from './Icons';

interface ErrorPanelProps {
  error: AppErrorShape;
  onRetry: () => void;
}

/**
 * The failure state.
 *
 * A catalogue that could not be loaded is an explicit failure with a way out, not an
 * empty list and not a spinner that never ends.
 */
export function ErrorPanel({ error, onRetry }: ErrorPanelProps) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center px-6 py-10">
      <div className="max-w-[46ch]">
        <div className="flex items-center gap-2 text-danger">
          <AlertIcon className="size-4 shrink-0" />
          <p className="text-[11px] font-medium uppercase tracking-[0.11em]">
            {catalogueErrorTitle(error)}
          </p>
        </div>

        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">{error.message}</p>

        <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
          {error.retryable
            ? 'This usually means Discord could not be reached. Retrying will try again.'
            : 'Retrying will fetch the catalogue again, but the same payload is likely to arrive.'}
        </p>

        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-[3px] border border-rule px-3 py-2 text-[12.5px] font-medium text-ink transition-colors duration-150 hover:border-ink-3 hover:bg-surface"
        >
          <RefreshIcon className="size-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
