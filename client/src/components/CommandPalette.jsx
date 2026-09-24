import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';

/** Cmd/Ctrl+K command palette. Pure client-side fuzzy filter over the same nav the sidebar uses -- no separate command registry to keep in sync. */
export default function CommandPalette({ groups, onNavigate, onClose }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-start justify-center pt-[12vh] px-4" onClick={onClose} role="presentation">
      <div className="w-full max-w-xl rounded-2xl bg-surface-container-low/95 backdrop-blur-xl border border-white/[0.1] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
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
              className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[13px] font-medium transition-colors ${index === activeIndex ? 'bg-primary/15 text-primary' : 'text-on-surface hover:bg-surface-container-high/70'}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onNavigate(item.to)}
            >
              <span className="flex items-center gap-2.5"><Icon name={item.icon} className="text-[16px]" />{item.label}</span>
              <span className="text-on-surface-variant/70 text-[11px] font-mono uppercase tracking-wide">{item.group}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
