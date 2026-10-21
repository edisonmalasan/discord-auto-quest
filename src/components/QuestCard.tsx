import { openUrl } from '@tauri-apps/plugin-opener';

import type { QuestSummary } from '../types/quests';

/**
 * A quest, as a card.
 *
 * The shape is Discord's own: a banner across the top with the game's wordmark
 * over it, the publisher and the end date beneath, the reward with the game's
 * icon beside it, and the buttons along the bottom. The colours and the type
 * are this project's.
 */
interface QuestCardProps {
  quest: QuestSummary;
  /** Whether the quest has been accepted. */
  accepted: boolean;
}

/** Where Discord keeps the artwork. */
const CDN = 'https://cdn.discordapp.com';

/** The address of an asset Discord names. */
function asset(path: string | null): string | null {
  if (!path) {
    return null;
  }

  return path.startsWith('http') ? path : `${CDN}/${path}`;
}

export function QuestCard({ quest, accepted }: QuestCardProps) {
  const banner = asset(quest.banner);
  const logotype = asset(quest.logotype);
  const tile = asset(quest.tile);

  const share = quest.targetSeconds > 0 ? quest.progressSeconds / quest.targetSeconds : 0;
  const percent = Math.min(100, Math.round(share * 100));

  return (
    <article className="overflow-hidden rounded-[6px] border border-rule bg-surface-2">
      {/* The banner, and the wordmark over it. */}
      <div className="relative aspect-[16/7] w-full overflow-hidden bg-ground">
        {banner ? (
          <img
            src={banner}
            alt=""
            className="absolute inset-0 size-full object-cover"
            loading="lazy"
          />
        ) : null}

        {/* A neutral scrim, so the wordmark over the artwork has something to
            sit on whatever the artwork is doing. */}
        <div
          className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" // taste-skill-ignore: a neutral scrim over a photograph is the one gradient allowed
        />

        {logotype ? (
          <img
            src={logotype}
            alt={quest.gameTitle ?? quest.name}
            className="absolute bottom-2 left-3 max-h-7 max-w-[70%] object-contain object-left"
          />
        ) : (
          <span className="absolute bottom-2 left-3 max-w-[70%] truncate text-[15px] font-semibold tracking-[0.01em] text-white">
            {quest.gameTitle ?? quest.name}
          </span>
        )}
      </div>

      {/* The publisher, and the day it ends. */}
      <div className="flex items-baseline justify-between gap-3 px-3 pt-2.5">
        <p className="truncate text-[12.5px] text-ink-2">
          Promoted by{' '}
          <span className="inline-flex items-baseline gap-1 text-ink">
            <Check />
            {quest.publisher ?? 'Unknown'}
          </span>
        </p>
        <p className="shrink-0 text-[11.5px] tabular text-ink-3">{ends(quest)}</p>
      </div>

      {/* The reward, and the progress. */}
      <div className="flex gap-3 px-3 pb-3 pt-2.5">
        {accepted && quest.progressSeconds > 0 ? (
          <ProgressRing percent={percent} />
        ) : tile ? (
          <img
            src={tile}
            alt=""
            className="size-16 shrink-0 rounded-[4px] object-cover"
            loading="lazy"
          />
        ) : (
          <div className="size-16 shrink-0 rounded-[4px] bg-ground" />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11.5px] font-semibold tracking-[0.02em] text-[#7c9cff] uppercase">
            {quest.name}
          </p>

          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] text-ink">
            <span>Claim</span>
            {quest.rewardName ? (
              <span className="inline-flex items-baseline gap-1">
                <Orb />
                {quest.rewardName}
              </span>
            ) : null}
            {quest.premiumOrbs && quest.rewardOrbs && quest.premiumOrbs > quest.rewardOrbs ? (
              <span className="rounded-full bg-[#2b2d31] px-2 py-px text-[11px] font-semibold text-ink-2">
                Unlock {(quest.premiumOrbs / quest.rewardOrbs).toFixed(1)}x
              </span>
            ) : null}
          </p>

          <p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-3">{describe(quest)}</p>
        </div>
      </div>

      {/* Discord's own buttons. */}
      <div className="flex gap-2 border-t border-rule px-3 py-3">
        <button
          type="button"
          disabled={!quest.ctaLink}
          onClick={() => void open(quest.ctaLink)}
          className="flex-1 rounded-[4px] bg-surface px-3 py-2 text-[13px] font-semibold text-ink-2 transition-colors duration-150 hover:bg-[#2b2d31] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {quest.ctaLabel ?? 'Get Game'}
        </button>

        <button
          type="button"
          onClick={() => void open('discord://')}
          className="flex-1 rounded-[4px] bg-[#5865f2] px-3 py-2 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-[#4752c4]"
        >
          {accepted ? 'Open in Discord' : 'Accept Quest'}
        </button>
      </div>
    </article>
  );
}

/** The orb, as Discord draws it. */
function Orb() {
  return (
    <svg viewBox="0 0 16 16" className="size-3 shrink-0 translate-y-px" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" className="fill-ink-3" />
      <circle cx="8" cy="8" r="2.6" className="fill-surface-2" />
    </svg>
  );
}

/** The check Discord puts beside a publisher's name. */
function Check() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3 shrink-0 translate-y-px text-[#3ba55d]"
      aria-hidden="true"
    >
      <path
        d="M6.4 11.6 2.9 8.1l1.4-1.4 2.1 2.1 5.3-5.3 1.4 1.4z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * The progress, as a ring.
 *
 * Discord draws a ring around a percentage, and fills it in the quest's own
 * colour.
 */function ProgressRing({ percent }: { percent: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-[#2b2d31]"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          className="text-[#3ba55d]"
        />
      </svg>

      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold tabular text-ink">
        {percent}%
      </span>
    </div>
  );
}

/** When the quest ends, in the words the card uses. */
function ends(quest: QuestSummary): string {
  if (!quest.expiresAt) {
    return 'No end date';
  }

  const when = new Date(quest.expiresAt);
  if (Number.isNaN(when.getTime())) {
    return 'No end date';
  }

  const month = when.getMonth() + 1;
  const day = when.getDate();

  return `Ends ${month}/${day}`;
}

/**
 * What the quest takes, in one line.
 *
 * Discord words this itself, from the task and the game's name. The
 * application says the same thing, because saying it differently would be
 * saying something Discord did not.
 */
function describe(quest: QuestSummary): string {
  const minutes = Math.max(1, Math.round(quest.targetSeconds / 60));
  const reward = quest.rewardName ? `win ${quest.rewardName}` : 'win the reward';
  const game = quest.gameTitle ?? 'the game';

  if (quest.tasks.some((task) => task.startsWith('WATCH_VIDEO'))) {
    return `Watch the video to ${reward}!`;
  }

  return `Play ${game} for ${minutes} minutes and ${reward}.`;
}

/** Open a link outside the application. */
async function open(url: string | null): Promise<void> {
  if (!url) {
    return;
  }

  try {
    await openUrl(url);
  } catch {
    /* the link could not be opened; there is nothing useful to say about it */
  }
}
