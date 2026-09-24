import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import { useMode } from '../state/ModeContext.jsx';
import CommandPalette from './CommandPalette.jsx';
import Icon from './Icon.jsx';

const NAV = [
  { label: 'Overview', items: [{ to: '/', icon: 'alt_route', label: 'Dispatch Overview' }] },
  { label: 'Operations', items: [
    { to: '/intake', icon: 'upload', label: 'Intake' },
    { to: '/approvals', icon: 'task_alt', label: 'Approvals' }
  ] },
  { label: 'Policy', items: [
    { to: '/policy', icon: 'gavel', label: 'Policy Manager' },
    { to: '/simulator', icon: 'science', label: 'Impact Simulator' },
    { to: '/replay', icon: 'history', label: 'Decision Replay' }
  ] },
  { label: 'Intelligence', items: [
    { to: '/risk', icon: 'monitoring', label: 'Risk & Predictions' },
    { to: '/incidents', icon: 'emergency_home', label: 'Incident Center' },
    { to: '/digital-twin', icon: 'device_hub', label: 'Digital Twin' },
    { to: '/assistant', icon: 'terminal', label: 'Ops Assistant' }
  ] },
  { label: 'Governance', items: [
    { to: '/audit', icon: 'receipt_long', label: 'Audit Log' },
    { to: '/security', icon: 'security', label: 'Security Center' },
    { to: '/access', icon: 'admin_panel_settings', label: 'Access Control' },
    { to: '/history', icon: 'monitor_heart', label: 'System Health' }
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
    <div className="bg-surface text-on-surface font-body-regular text-body-regular min-h-screen">
      <a className="sr-only focus:not-sr-only focus:fixed focus:left-0 focus:top-0 focus:z-[200] focus:bg-primary focus:text-on-primary focus:px-space-md focus:py-space-xs" href="#main-content">Skip to content</a>

      {menuOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <aside className={`fixed left-0 top-0 bottom-0 w-64 bg-surface-container-low z-50 flex flex-col justify-between border-r border-outline-variant transition-transform lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col overflow-y-auto">
          <div className="h-14 px-space-md flex items-center gap-space-sm border-b border-outline-variant bg-surface-container-lowest shrink-0">
            <Icon name="hub" className="text-primary text-[20px]" />
            <div className="flex flex-col min-w-0">
              <span className="font-headline-md text-headline-md tracking-tight text-on-surface font-bold truncate">PARCELFLOW</span>
              <span className="font-kpi-micro text-kpi-micro text-on-surface-variant">CONTROL ROOM // V2</span>
            </div>
          </div>
          <div className="px-space-md py-space-xs bg-surface-container border-b border-outline-variant flex items-center justify-between">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Session</span>
            <span className="font-code-sm text-code-sm text-tertiary">ACTIVE</span>
          </div>
          <nav className="flex flex-col py-space-2xs">
            {NAV.map((group) => (
              <div key={group.label}>
                <span className="block px-space-md pt-space-md pb-space-2xs font-label-caps text-label-caps uppercase text-on-surface-variant">{group.label}</span>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => `flex items-center gap-space-sm px-space-md py-space-sm transition-colors ${
                      isActive
                        ? 'bg-surface-container-highest text-primary border-l-2 border-primary font-bold'
                        : 'font-body-compact text-body-compact text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface border-l-2 border-transparent'
                    }`}
                  >
                    <Icon name={item.icon} className="text-[18px]" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </div>
        <button className="m-space-sm p-space-sm border border-outline-variant bg-surface-container-lowest hover:bg-surface-container flex items-center gap-space-sm text-left transition-colors" type="button" onClick={logout} title="Sign out">
          <span className="w-8 h-8 shrink-0 bg-primary flex items-center justify-center">
            <Icon name="person" className="text-on-primary text-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-code-sm text-code-sm text-on-surface font-semibold truncate">{identity.name || identity.actor}</span>
            <span className="block font-kpi-micro text-kpi-micro text-on-surface-variant uppercase">{identity.role} &middot; sign out</span>
          </span>
        </button>
      </aside>

      <div className="lg:pl-64">
        <header className="fixed top-0 left-0 lg:left-64 right-0 h-14 bg-surface-container-low border-b border-outline-variant z-30 flex items-center justify-between px-space-md gap-space-sm">
          <div className="flex items-center gap-space-md min-w-0">
            <button className="lg:hidden p-space-2xs border border-outline-variant text-on-surface-variant" type="button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>
              <Icon name="menu" className="text-[18px]" />
            </button>
            <div className="flex flex-col min-w-0">
              <span className="font-kpi-micro text-kpi-micro uppercase text-on-surface-variant hidden sm:block">Parcel Routing Control Room</span>
              <span className="font-headline-md text-headline-md text-on-surface font-bold truncate">{current?.label || 'ParcelFlow'}</span>
            </div>
          </div>
          <div className="flex items-center gap-space-sm shrink-0">
            <button
              className="hidden sm:flex items-center gap-space-xs px-space-sm py-space-2xs bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:text-on-surface transition-colors"
              type="button"
              onClick={() => setPaletteOpen(true)}
            >
              <Icon name="terminal" className="text-[16px]" />
              <span className="font-code-sm text-code-sm">SEARCH</span>
              <kbd className="px-space-2xs bg-surface-container font-kpi-micro text-kpi-micro border border-outline-variant text-on-surface">&#8984;K</kbd>
            </button>
            <button
              className="px-space-sm py-space-2xs bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:text-on-surface font-code-sm text-code-sm uppercase transition-colors"
              type="button"
              onClick={toggle}
              aria-pressed={isTechnical}
            >
              {isTechnical ? 'Technical' : 'Simple'}
            </button>
          </div>
        </header>

        <main className="w-full pt-14 pb-space-xl bg-surface px-space-md min-h-screen" id="main-content">
          <div className="flex flex-col w-full max-w-[1400px] mx-auto pt-space-md">
            {children}
          </div>
        </main>
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} onNavigate={(to) => { navigate(to); setPaletteOpen(false); }} groups={NAV} />}
    </div>
  );
}

export { NAV };
