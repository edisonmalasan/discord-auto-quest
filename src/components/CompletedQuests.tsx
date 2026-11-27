import { completedGroups, searchQuests, type CompletedGroups, type QuestCardModel } from '../lib/quest-view';
import { QuestIndex } from './QuestIndex';

interface Props {
  cards: QuestCardModel[];
  query: string;
  stale: boolean;
  openMenuQuestId: string | null;
  onMenuChange: (id: string | null) => void;
  onClear?: () => void;
}

const sections: ReadonlyArray<{ key: keyof CompletedGroups; title: string; subtitle: string }> = [
  { key: 'unclaimed', title: 'Unclaimed rewards', subtitle: 'Completed quests with rewards ready to claim in Discord.' },
  { key: 'claimed', title: 'Claimed rewards', subtitle: 'Rewards you have already claimed.' },
  { key: 'other', title: 'Other completed', subtitle: 'Expired rewards or quests whose reward status could not be confirmed.' },
];

/** Render completed quest cards grouped by reward claim state. */
export function CompletedQuests({ cards, query, onClear, ...props }: Props) {
  const filtered = searchQuests(cards, query);
  const groups = completedGroups(filtered);
  return <>
    {sections.map(({ key, title, subtitle }) => {
      const items = groups[key];
      if (!items.length) return null;
      return <section key={key} className="quest-group" aria-label={title}>
        <h2>{title} <span>{items.length}</span></h2>
        <p>{subtitle}</p>
        <QuestIndex cards={items} {...props} />
      </section>;
    })}
    {filtered.length === 0 && query.trim() && <div className="empty-state"><h2>No matching quests</h2><p>Try another quest, game, or publisher name.</p>{onClear && <button className="button secondary" onClick={onClear}>Clear search</button>}</div>}
  </>;
}
