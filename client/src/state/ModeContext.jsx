import { createContext, useContext, useEffect, useState } from 'react';

const ModeContext = createContext(null);
const KEY = 'parcelflow.mode';

export function ModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(KEY) === 'technical' ? 'technical' : 'simple'; } catch { return 'simple'; }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, mode); } catch { /* storage unavailable */ }
  }, [mode]);

  const toggle = () => setMode((m) => (m === 'simple' ? 'technical' : 'simple'));

  return <ModeContext.Provider value={{ mode, isTechnical: mode === 'technical', toggle, setMode }}>{children}</ModeContext.Provider>;
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode must be used within a ModeProvider.');
  return ctx;
}
