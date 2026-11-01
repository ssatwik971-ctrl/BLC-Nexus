import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

/** Fetch JSON from the API with loading/error state. `path` may be null to skip. */
export function useFetch(path) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.get(path);
      if (id === latest.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (id === latest.current) setState({ data: null, error, loading: false });
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}

/** Light/dark theme (dark by default), persisted in localStorage. */
export function useTheme() {
  const [theme, setThemeState] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const setTheme = useCallback((next) => {
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('blc-nexus-theme', next);
    } catch {
      /* ignore */
    }
    setThemeState(next);
  }, []);
  return [theme, setTheme];
}

/** Set the browser tab title. The default brand title is "BLC Nexus — Billionaires Club". */
export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · BLC Nexus` : 'BLC Nexus — Billionaires Club';
  }, [title]);
}
