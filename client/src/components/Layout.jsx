import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import { useMode } from '../state/ModeContext.jsx';
import CommandPalette from './CommandPalette.jsx';

const NAV = [
  { label: 'Overview', items: [{ to: '/', icon: '◉', label: 'Overview' }] },
  { label: 'Operations', items: [
    { to: '/intake', icon: '↑', label: 'Intake' },
    { to: '/approvals', icon: '✓', label: 'Approvals' }
  ] },
  { label: 'Policy', items: [
    { to: '/policy', icon: '⚖', label: 'Policy Manager' },
    { to: '/simulator', icon: '⌁', label: 'Impact Simulator' },
    { to: '/replay', icon: '↺', label: 'Decision Replay' }
  ] },
  { label: 'Intelligence', items: [
    { to: '/risk', icon: '⚠', label: 'Risk & Predictions' },
    { to: '/incidents', icon: '◆', label: 'Incident Center' },
    { to: '/digital-twin', icon: '◇', label: 'Digital Twin' },
    { to: '/assistant', icon: '⌨', label: 'Ops Assistant' }
  ] },
  { label: 'Governance', items: [
    { to: '/audit', icon: '≡', label: 'Audit Log' },
    { to: '/security', icon: '⬡', label: 'Security Center' },
    { to: '/access', icon: '▤', label: 'Access Control' },
    { to: '/history', icon: '⏱', label: 'System Health' }
  ] }
];

export default function Layout({ children }) {
  const { identity, logout } = useAuth();
  const { mode, toggle, isTechnical } = useMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === 'Escape') setPaletteOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const current = NAV.flatMap((g) => g.items).find((item) => item.to === location.pathname);

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Skip to content</a>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">PF</span>
          <div><strong>ParcelFlow</strong><small>Control room</small></div>
        </div>
        <nav className="side-nav">
          {NAV.map((group) => (
            <div key={group.label}>
              <span className="nav-label">{group.label}</span>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <button className="identity" type="button" onClick={logout} title="Sign out">
          <span className="avatar" aria-hidden="true">{(identity.name || identity.actor).slice(0, 2).toUpperCase()}</span>
          <span>
            <strong>{identity.name || identity.actor}</strong>
            <small>{identity.role[0]}{identity.role.slice(1).toLowerCase()} &middot; sign out</small>
          </span>
        </button>
      </aside>

      <div className="main" id="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="button ghost menu-toggle" type="button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>&#9776;</button>
            <div className="topbar-title"><span className="eyebrow">Parcel routing control room</span><strong>{current?.label || 'ParcelFlow'}</strong></div>
          </div>
          <div className="topbar-actions">
            <button className="button ghost small" type="button" onClick={() => setPaletteOpen(true)}>&#8984;K Search</button>
            <button className="button ghost small" type="button" onClick={toggle} aria-pressed={isTechnical}>{isTechnical ? 'Technical view' : 'Simple view'}</button>
          </div>
        </header>
        {children}
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} onNavigate={(to) => { navigate(to); setPaletteOpen(false); }} groups={NAV} />}
    </div>
  );
}

export { NAV };
