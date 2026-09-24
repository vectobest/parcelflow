import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import Icon from './Icon.jsx';

const PALETTE_SPRING = { type: 'spring', visualDuration: 0.25, bounce: 0 };

/** Cmd/Ctrl+K command palette. Pure client-side fuzzy filter over the same nav the sidebar uses -- no separate command registry to keep in sync. */
export default function CommandPalette({ groups, onNavigate, onClose }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const reduceMotion = useReducedMotion();
  // Materialize from the header search field: scale + blur, reversed on exit. Reduced motion falls back to a crossfade.
  const hidden = reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: 'blur(8px)' };
  const shown = reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, filter: 'blur(0px)' };

  const items = useMemo(() => groups.flatMap((g) => g.items.map((item) => ({ ...item, group: g.label }))), [groups]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setActiveIndex(0); }, [query]);

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filtered.length - 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    if (event.key === 'Enter' && filtered[activeIndex]) onNavigate(filtered[activeIndex].to);
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 z-[90] flex items-start justify-center pt-[12vh] px-4"
      onClick={onClose}
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={PALETTE_SPRING}
    >
      <motion.div
        className="w-full max-w-xl rounded-2xl bg-surface-container-low border border-white/[0.1] border-t-[3px] border-t-primary shadow-2xl overflow-hidden"
        style={{ transformOrigin: 'top center' }}
        initial={hidden}
        animate={shown}
        exit={hidden}
        transition={PALETTE_SPRING}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-2.5 px-4 border-b border-white/[0.08] bg-surface-container-lowest/70">
          <Icon name="search" className="text-[16px] text-on-surface-variant" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, incidents, policy..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Search"
            className="flex-1 bg-transparent border-none py-4 text-[13px] text-on-surface placeholder:text-on-surface-variant focus:outline-none"
          />
        </div>
        <div className="max-h-[340px] overflow-y-auto p-2" role="listbox">
          {filtered.length === 0 && <div className="px-3 py-3 text-[13px] text-on-surface-variant">No matching pages.</div>}
          {filtered.map((item, index) => (
            <div
              key={item.to}
              role="option"
              aria-selected={index === activeIndex}
              className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[13px] font-medium transition-colors ${index === activeIndex ? 'bg-primary/15 text-primary' : 'text-on-surface hover:bg-surface-container-high/70'} active:bg-primary/25`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onNavigate(item.to)}
            >
              <span className="flex items-center gap-2.5"><Icon name={item.icon} className="text-[16px]" />{item.label}</span>
              <span className="text-on-surface-variant/70 text-[11px] font-mono uppercase tracking-wide">{item.group}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
