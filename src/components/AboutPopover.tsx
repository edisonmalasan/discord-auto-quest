import { useEffect, useRef, useState } from 'react';
import { Colophon } from './Colophon';
export function AboutPopover() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function close(e: PointerEvent) { if (!root.current?.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return <div className="about" ref={root} onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } }}>
    <button className="about-trigger" ref={trigger} aria-expanded={open} aria-controls="about-content" onClick={() => setOpen(!open)}>About Discord Auto Quest</button>
    {open && <div id="about-content" className="about-content"><Colophon /></div>}
  </div>;
}
