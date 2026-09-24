import { useEffect, useMemo, useRef, useState } from 'react';

/** Cmd/Ctrl+K command palette (master prompt section 34). Pure client-side fuzzy filter over the same nav the sidebar uses -- no separate command registry to keep in sync. */
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
    <div className="modal-scrim" onClick={onClose} role="presentation">
      <div className="command-palette" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search parcels, batches, policy, incidents..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Search"
        />
        <div className="command-list" role="listbox">
          {filtered.length === 0 && <div className="command-item muted">No matching pages.</div>}
          {filtered.map((item, index) => (
            <div
              key={item.to}
              role="option"
              aria-selected={index === activeIndex}
              className={`command-item ${index === activeIndex ? 'active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onNavigate(item.to)}
            >
              <span>{item.icon} {item.label}</span>
              <span className="muted">{item.group}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
