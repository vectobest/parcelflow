import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useAuth } from '../state/AuthContext.jsx';
import { projectRest, releaseVelocity } from '../utils/gesture.js';
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

const DRAWER_WIDTH = 256;
const DESKTOP_QUERY = '(min-width: 1024px)';
const DRAWER_SPRING = { type: 'spring', visualDuration: 0.3, bounce: 0 };

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event) => setIsDesktop(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

export default function Layout({ children }) {
  const { identity, logout } = useAuth();
  const isDesktop = useIsDesktop();
  const [menuOpen, setMenuOpen] = useState(false);
  // True only once the drawer has fully finished closing, so it stays grabbable mid-animation.
  const [drawerParked, setDrawerParked] = useState(!isDesktop);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const drawerX = useMotionValue(isDesktop ? 0 : -DRAWER_WIDTH);
  const lastDragMoveAt = useRef(0);
  const didDrag = useRef(false);
  const scrimOpacity = useTransform(drawerX, [-DRAWER_WIDTH, 0], [0, 0.5]);

  const settleDrawer = useCallback((open, velocity = 0) => {
    setMenuOpen(open);
    if (open) setDrawerParked(false);
    // Bounce only when the finger carried momentum; taps and route changes settle without overshoot.
    const bounce = open && Math.abs(velocity) > 500 ? 0.2 : 0;
    animate(drawerX, open ? 0 : -DRAWER_WIDTH, {
      ...DRAWER_SPRING,
      bounce,
      velocity,
      onComplete: () => { if (!open) setDrawerParked(true); }
    });
  }, [drawerX]);

  useEffect(() => {
    setMenuOpen(false);
    setDrawerParked(!isDesktop);
    drawerX.set(isDesktop ? 0 : -DRAWER_WIDTH);
  }, [isDesktop, drawerX]);

  useEffect(() => {
    if (!isDesktop) settleDrawer(false);
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  function onDrawerDragEnd(_event, info) {
    const velocity = releaseVelocity(info.velocity.x, lastDragMoveAt.current);
    const rest = projectRest(drawerX.get(), velocity);
    settleDrawer(rest > -DRAWER_WIDTH / 2, velocity);
  }

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
  const initials = (identity.name || identity.actor || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="bg-surface text-on-surface font-sans text-body-regular min-h-screen relative">
      <a className="sr-only focus:not-sr-only focus:fixed focus:left-0 focus:top-0 focus:z-[200] focus:bg-primary focus:text-on-primary focus:px-space-md focus:py-space-xs" href="#main-content">Skip to content</a>

      {/* Ambient background mesh */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-20 w-[550px] h-[550px] bg-primary/5 rounded-full blur-[130px] opacity-50" />
        <div className="absolute top-[28%] right-[-100px] w-[600px] h-[600px] bg-secondary-container/10 rounded-full blur-[140px] opacity-40" />
      </div>

      {!isDesktop && (
        <motion.div
          className={`fixed inset-0 bg-black z-40 ${menuOpen ? '' : 'pointer-events-none'}`}
          style={{ opacity: scrimOpacity }}
          onClick={() => settleDrawer(false)}
          aria-hidden="true"
        />
      )}

      <motion.aside
        className={`fixed left-0 top-0 bottom-8 w-64 bg-surface-container-low z-50 flex flex-col justify-between border-r border-white/[0.08] [&_a]:[-webkit-user-drag:none] ${isDesktop ? '' : "shadow-xl before:content-[''] before:absolute before:inset-y-0 before:right-full before:w-16 before:bg-surface-container-low"}`}
        style={{ x: drawerX, touchAction: 'pan-y' }}
        drag={isDesktop ? false : 'x'}
        dragConstraints={{ left: -DRAWER_WIDTH, right: 0 }}
        dragElastic={{ left: 0, right: 0.15 }}
        dragMomentum={false}
        dragDirectionLock
        onPointerDownCapture={() => { didDrag.current = false; }}
        onDragStart={() => { didDrag.current = true; }}
        onDrag={() => { lastDragMoveAt.current = performance.now(); }}
        onDragEnd={onDrawerDragEnd}
        onClickCapture={(event) => {
          // A drag that ends over a nav link must not also count as a tap on it.
          if (didDrag.current) { event.preventDefault(); event.stopPropagation(); }
        }}
        aria-hidden={drawerParked || undefined}
        inert={drawerParked ? '' : undefined}
      >
        <div className="flex flex-col overflow-y-auto">
          <div className="h-16 px-4 flex items-center gap-3 border-b border-white/[0.06] bg-surface-container-lowest shrink-0">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <Icon name="hub" className="text-[22px]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[16px] tracking-tight text-white truncate">PARCELFLOW</span>
              <span className="font-mono text-[10px] text-on-surface-variant/80 tracking-wider uppercase font-semibold">Control Room // V2</span>
            </div>
          </div>
          <div className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 flex items-center justify-between">
            <span>Session</span>
            <span className="inline-flex items-center gap-1.5 text-tertiary">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
              Active
            </span>
          </div>
          <nav className="flex flex-col px-3 gap-1">
            {NAV.map((group) => (
              <div key={group.label}>
                <span className="block px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">{group.label}</span>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => `group flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-colors border ${
                      isActive
                        ? 'bg-primary/15 text-primary border-primary/25 font-semibold'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/70 active:bg-surface-container-high border-transparent hover:border-white/[0.05] font-medium'
                    }`}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon name={item.icon} className={`text-[20px] ${isActive ? '' : 'text-on-surface-variant group-hover:text-primary transition-colors'}`} />
                        <span className="truncate">{item.label}</span>
                        {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </div>
        <button className="m-3 p-3.5 rounded-2xl border border-white/[0.08] bg-surface-container-lowest hover:bg-surface-container active:bg-surface-container-high flex items-center gap-3 text-left transition-colors" type="button" onClick={logout} title="Sign out">
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-[12px]">
              {initials}
            </div>
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-tertiary ring-2 ring-surface-container-lowest" />
          </div>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-on-surface truncate">{identity.name || identity.actor}</span>
            <span className="block text-[11px] font-medium text-on-surface-variant/80 uppercase truncate">{identity.role} &middot; sign out</span>
          </span>
        </button>
      </motion.aside>

      <div className="lg:pl-64 relative z-10">
        <header className="fixed top-0 left-0 lg:left-64 right-0 h-14 bg-surface-container-low/80 backdrop-blur-xl border-b border-white/[0.08] z-40 flex items-center justify-between px-6 gap-3 shadow-sm">
          <div className="flex items-center gap-4 flex-1 min-w-0 max-w-xl">
            <button className="lg:hidden p-2 rounded-xl border border-white/[0.08] text-on-surface-variant active:bg-surface-container-high" type="button" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => settleDrawer(true)}>
              <Icon name="menu" className="text-[18px]" />
            </button>
            <div className="relative w-full max-w-md group hidden sm:block">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant/70 group-focus-within:text-primary transition-colors" />
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="w-full text-left pl-9 pr-12 py-1.5 rounded-xl bg-surface-container/60 hover:bg-surface-container border border-white/[0.08] focus:border-primary/60 text-on-surface-variant/70 text-[13px] transition-all"
              >
                Search pages, incidents, policy...
              </button>
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md bg-surface-container-high/80 text-[10px] font-mono text-on-surface-variant border border-white/[0.1]">&#8984;K</kbd>
            </div>
          </div>
          <div className="flex flex-col min-w-0 flex-1 items-center text-center sm:hidden">
            <span className="text-[15px] font-bold text-on-surface truncate">{current?.label || 'ParcelFlow'}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-3 pl-1.5">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-[12px]">
                  {initials}
                </div>
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-tertiary ring-2 ring-surface" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[13px] font-bold text-on-surface leading-tight truncate max-w-[140px]">{identity.name || identity.actor}</span>
                <span className="text-[11px] font-medium text-on-surface-variant/80 leading-tight">{identity.role}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="w-full pt-14 pb-12 bg-transparent px-4 sm:px-6 min-h-screen" id="main-content">
          <div className="max-w-7xl mx-auto py-5 flex flex-col gap-6">
            {children}
          </div>
        </main>

        <footer className="fixed bottom-0 left-0 lg:left-64 right-0 h-8 bg-surface-container-lowest/90 backdrop-blur-xl border-t border-white/[0.08] z-30 flex items-center justify-between px-6 font-mono text-[11px]">
          <div className="flex items-center gap-2 text-on-surface-variant min-w-0">
            <span className="w-2 h-2 rounded-full bg-tertiary shrink-0" />
            <span className="text-white font-bold shrink-0">ParcelFlow</span>
            <span className="text-white/20 hidden sm:inline">&bull;</span>
            <span className="text-on-surface-variant/90 truncate hidden sm:inline">Signed in as {identity.name || identity.actor}</span>
          </div>
          <span className="text-on-surface-variant/70 shrink-0">{identity.role}</span>
        </footer>
      </div>

      <AnimatePresence>
        {paletteOpen && <CommandPalette key="palette" onClose={() => setPaletteOpen(false)} onNavigate={(to) => { navigate(to); setPaletteOpen(false); }} groups={NAV} />}
      </AnimatePresence>
    </div>
  );
}

export { NAV };
