import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface NoticeInput { title: string; message: string; kind?: 'info' | 'success' | 'error' | 'completed'; key?: string }
interface Notice extends NoticeInput { id: number; at: number; unread: boolean }
const Context = createContext<{items: Notice[]; toast: Notice | null; notify: (notice: NoticeInput) => void; dismiss: () => void; read: (id?: number) => void} | null>(null);
export const useNotifications = () => useContext(Context);

export function NotificationProvider({children}: {children: ReactNode}) {
  const [items, setItems] = useState<Notice[]>([]), [toast, setToast] = useState<Notice | null>(null);
  const sequence = useRef(0), seen = useRef(new Set<string>());
  const notify = useCallback((input: NoticeInput) => {
    if (input.key && seen.current.has(input.key)) return;
    if (input.key) seen.current.add(input.key);
    const notice = {...input, id: ++sequence.current, at: Date.now(), unread: true};
    setItems(previous => [notice, ...previous].slice(0, 50)); setToast(notice);
  }, []);
  const dismiss = useCallback(() => setToast(null), []);
  const read = useCallback((id?: number) => setItems(previous => previous.map(item => id === undefined || item.id === id ? {...item, unread: false} : item)), []);
  return <Context value={{items, toast, notify, dismiss, read}}>{children}</Context>;
}

function NoticeIcon({kind}: {kind?: NoticeInput['kind']}) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/>{kind === 'success' || kind === 'completed' ? <path d="m7 12 3 3 7-7"/> : <path d="M12 10v7m0-11v1"/>}</svg>;
}

export function NotificationCenter({onCompleted}: {onCompleted: () => void}) {
  const notices = useNotifications();
  const [open, setOpen] = useState(false), [expanded, setExpanded] = useState<number | null>(null), [held, setHeld] = useState(false);
  const root = useRef<HTMLDivElement>(null), bell = useRef<HTMLButtonElement>(null);
  const remaining = useRef(5000);
  const toastId = notices?.toast?.id;
  useEffect(() => { remaining.current = 5000; setHeld(false); }, [toastId]);
  useEffect(() => {
    if (!toastId || held) return;
    const started = Date.now(), timer = window.setTimeout(() => notices?.dismiss(), remaining.current);
    return () => { window.clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (Date.now() - started)); };
  }, [toastId, held, notices?.dismiss]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); bell.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  if (!notices) return null;
  const count = notices.items.filter(item => item.unread).length;
  return <div className="notification-center" ref={root}>
    <button className="notification-bell" ref={bell} aria-label={count ? `Notifications, ${count} unread` : 'Notifications'} aria-expanded={open} aria-controls="notification-panel" onClick={() => { setOpen(!open); notices.dismiss(); }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>{count > 0 && <span className="notification-count" aria-hidden="true">{count > 9 ? '9+' : count}</span>}
    </button>
    {open && <section className="notification-panel" id="notification-panel" aria-label="Notifications">
      <header><h2>Notifications</h2><button onClick={() => notices.read()} disabled={!count}>Mark all read</button><button aria-label="Close notifications" onClick={() => { setOpen(false); bell.current?.focus(); }}>×</button></header>
      <div className="notification-list">{notices.items.length ? notices.items.map(item => <article className="notification-item" key={item.id}>
        <button className="notification-row" aria-label={`${item.title}. ${item.message}`} aria-expanded={expanded === item.id} onClick={() => { setExpanded(expanded === item.id ? null : item.id); notices.read(item.id); }}>
          <span className={`notification-icon ${item.kind ?? 'info'}`}><NoticeIcon kind={item.kind}/></span><span><strong>{item.title}</strong><span className="notification-preview">{item.message}</span><time dateTime={new Date(item.at).toISOString()}>{new Date(item.at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</time></span>{item.unread && <i className="notification-unread" aria-label="Unread"/>}
        </button>
        {expanded === item.id && <div className="notification-detail"><p>{item.message}</p>{item.kind === 'completed' && <button className="button secondary" onClick={() => { onCompleted(); setOpen(false); }}>View completed</button>}</div>}
      </article>) : <p className="notification-empty">You’re all caught up.</p>}</div><footer>Notifications from this app session</footer>
    </section>}
    {notices.toast && <div className="notification-toast" role={notices.toast.kind === 'error' ? 'alert' : 'status'} onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false); }}>
      <span className={`notification-icon ${notices.toast.kind ?? 'info'}`}><NoticeIcon kind={notices.toast.kind}/></span><div><strong>{notices.toast.title}</strong><p>{notices.toast.message}</p>{notices.toast.kind === 'completed' && <button onClick={() => { onCompleted(); notices.dismiss(); }}>View completed</button>}</div><button aria-label="Dismiss notification" onClick={() => { notices.dismiss(); bell.current?.focus(); }}>×</button>
    </div>}
  </div>;
}
