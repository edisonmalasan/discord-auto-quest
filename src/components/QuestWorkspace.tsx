import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { searchQuests, type QuestView, type QuestViews } from '../lib/quest-view';
import { AppMark } from './AppMark';
import { AboutPopover } from './AboutPopover';
import { QuestIndex } from './QuestIndex';

const labels: Record<QuestView, string> = { ongoing: 'Ongoing', available: 'Available', completed: 'Completed' };
const descriptions: Record<QuestView, string> = { ongoing: 'Your accepted quests, ready to work.', available: 'Find your next quest. Accept it in Discord to get started.', completed: 'Your completed quests and rewards.' };
const empty: Record<QuestView, string> = { ongoing: 'Accept a quest in Discord, then it will appear here.', available: 'There are no available quests right now. Check back later.', completed: 'Completed quests will appear here when Discord confirms them.' };
interface Props { views: QuestViews; loading: boolean; stale: boolean; controls: ReactNode; connection: ReactNode }

export function QuestWorkspace({ views, loading, stale, controls, connection }: Props) {
  const [view, setView] = useState<QuestView>('ongoing');
  const [queries, setQueries] = useState<Record<QuestView, string>>({ ongoing: '', available: '', completed: '' });
  const [openMenuQuestId, setMenu] = useState<string | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const positions = useRef<Record<QuestView, number>>({ ongoing: 0, available: 0, completed: 0 });
  const seenCompleted = useRef<Set<string> | null>(null);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (loading) return;
    const previous = seenCompleted.current;
    const added = previous ? views.completed.filter(c => !previous.has(c.quest.id)) : [];
    seenCompleted.current = new Set([...(previous ?? []), ...views.completed.map(c => c.quest.id)]);
    if (added.length) setAnnouncement(`${added.map(c => c.quest.name).join(', ')} completed. Check Completed for your reward.`);
  }, [views.completed, loading]);
  const cards = searchQuests(views[view], queries[view]);
  useLayoutEffect(() => { if (scroll.current) scroll.current.scrollTop = positions.current[view]; }, [view]);
  useEffect(() => { if (openMenuQuestId && !cards.some(c => c.quest.id === openMenuQuestId)) { setMenu(null); heading.current?.focus(); } }, [cards, openMenuQuestId]);
  return <div className="workspace">
    <aside className="sidebar">
      <div className="brand"><AppMark className="brand-mark" /><span>Discord Auto Quest</span></div>
      <nav aria-label="Your quests"><p className="nav-label">Your quests</p>
        {(Object.keys(labels) as QuestView[]).map(key => <button className="nav-item" key={key} aria-current={view === key ? 'page' : undefined} onClick={() => { setMenu(null); setView(key); }}>
          <NavIcon kind={key} /><span>{labels[key]}</span><span className="nav-count">{loading ? '—' : views[key].length}</span>
        </button>)}
      </nav><div className="sidebar-bottom">{connection}<AboutPopover /></div>
    </aside>
    <main className="quest-main">
      <span role="status" aria-live="polite" className="sr-only">{announcement}</span>
      <header className="workspace-header"><span><NavIcon kind={view} />{labels[view]} quests</span>{controls}</header>
      <div ref={scroll} className="workspace-scroll" onScroll={event => { positions.current[view] = event.currentTarget.scrollTop; }}>
        <section className="quest-content" aria-labelledby="view-title">
          <h1 id="view-title" ref={heading} tabIndex={-1}>{labels[view]} quests</h1><p className="view-description">{descriptions[view]}</p>
          {stale && <p className="stale-notice" role="status">Showing your last successful read. Reconnecting to Discord…</p>}
          <label className="search-field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
            <span className="sr-only">Search {labels[view].toLowerCase()} quests</span><input type="search" value={queries[view]} placeholder="Search quests" onChange={e => setQueries({ ...queries, [view]: e.target.value })} />
          </label>
          {loading ? <div role="status" aria-label="Loading quests"><span className="sr-only">Loading quests…</span><div className="quest-grid" aria-hidden="true">{[1,2,3].map(n => <div className="card-skeleton" key={n}><div/><span/><span/></div>)}</div></div>
            : cards.length ? <QuestIndex cards={cards} stale={stale} openMenuQuestId={openMenuQuestId} onMenuChange={setMenu} />
              : <div className="empty-state"><NavIcon kind={view}/><h2>{queries[view].trim() ? 'No matching quests' : `No ${labels[view].toLowerCase()} quests`}</h2><p>{queries[view].trim() ? 'Try another quest, game, or publisher name.' : empty[view]}</p>{queries[view].trim() && <button className="button secondary" onClick={() => setQueries({ ...queries, [view]: '' })}>Clear search</button>}</div>}
        </section>
      </div>
    </main>
  </div>;
}
function NavIcon({ kind }: { kind: QuestView }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    {kind === 'ongoing' ? <><path d="M5 4v16M10 5l10 7-10 7z"/></> : kind === 'available' ? <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></> : <><circle cx="12" cy="12" r="9"/><path d="m7 12 3.5 3.5L17 9"/></>}
  </svg>;
}
