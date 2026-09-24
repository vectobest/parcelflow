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
    <div className="fixed inset-0 bg-black/60 z-[90] flex items-start justify-center pt-[12vh] px-space-md" onClick={onClose} role="presentation">
      <div className="w-full max-w-xl bg-surface-container-low border border-outline-variant shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <div className="flex items-center gap-space-xs px-space-md border-b border-outline-variant bg-surface-container-lowest">
          <Icon name="terminal" className="text-[16px] text-on-surface-variant" />
          <input
            ref={inputRef}
            type="text"
            placeholder="SEARCH PARCELS, BATCHES, POLICY, INCIDENTS..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Search"
            className="flex-1 bg-transparent border-none py-space-md font-code-sm text-code-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none uppercase"
          />
        </div>
        <div className="max-h-[340px] overflow-y-auto" role="listbox">
          {filtered.length === 0 && <div className="px-space-md py-space-sm font-code-sm text-code-sm text-on-surface-variant">No matching pages.</div>}
          {filtered.map((item, index) => (
            <div
              key={item.to}
              role="option"
              aria-selected={index === activeIndex}
              className={`flex items-center justify-between gap-space-sm px-space-md py-space-sm cursor-pointer font-code-sm text-code-sm transition-colors ${index === activeIndex ? 'bg-surface-container-high text-primary' : 'text-on-surface hover:bg-surface-container-high'}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onNavigate(item.to)}
            >
              <span className="flex items-center gap-space-xs"><Icon name={item.icon} className="text-[16px]" />{item.label}</span>
              <span className="text-on-surface-variant uppercase font-kpi-micro text-kpi-micro">{item.group}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
