import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'parcelflow-theme';
const MEDIA_QUERY = '(prefers-color-scheme: light)';

// Mirrors the pre-paint script in index.html so React's first render agrees with
// whatever class that script already applied to <html> before this ever runs.
function resolveInitialTheme() {
  let stored = null;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia(MEDIA_QUERY).matches ? 'light' : 'dark';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(resolveInitialTheme);
  // Only ever written by setExplicitTheme below -- if that invariant changes, this needs revisiting.
  const [hasExplicitChoice, setHasExplicitChoice] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== null; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    document.getElementById('theme-color-scheme')?.setAttribute('content', theme);
  }, [theme]);

  useEffect(() => {
    if (hasExplicitChoice) return;
    const mql = window.matchMedia(MEDIA_QUERY);
    const onChange = (event) => setThemeState(event.matches ? 'light' : 'dark');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [hasExplicitChoice]);

  const setExplicitTheme = useCallback((next) => {
    setThemeState(next);
    setHasExplicitChoice(true);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  }, []);

  const toggleTheme = useCallback(() => {
    setExplicitTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setExplicitTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: setExplicitTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider.');
  return ctx;
}
