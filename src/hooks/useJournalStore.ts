import { useCallback, useEffect, useRef, useState } from 'react';
import { verseOfTheDay } from '../lib/verses';

export interface Entry {
  id: string;
  ref: string;
  text: string;
  updatedAt: number;
}

interface Persisted {
  entries: Entry[];
  lastPage: number;
}

const KEY = 'bible-journal:v1';

const newEntry = (ref = ''): Entry => ({
  id: (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`),
  ref,
  text: '',
  updatedAt: Date.now()
});

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw) as Persisted;
      if (Array.isArray(data.entries) && data.entries.length > 0) {
        return { entries: data.entries, lastPage: Math.min(Math.max(0, data.lastPage | 0), data.entries.length - 1) };
      }
    }
  } catch {
    /* corrupted or unavailable storage: fall through to a fresh journal */
  }
  // First run: the first page is seeded with today's verse as its reference.
  return { entries: [newEntry(verseOfTheDay().ref)], lastPage: 0 };
}

/** Journal entries (one page per entry), persisted to localStorage. */
export function useJournalStore() {
  const [state, setState] = useState<Persisted>(load);
  const timer = useRef<number | undefined>(undefined);

  // Debounced persistence so typing stays cheap; flushed on page hide.
  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full/blocked */ }
    }, 250);
    return () => window.clearTimeout(timer.current);
  }, [state]);

  useEffect(() => {
    const flush = () => { try { localStorage.setItem(KEY, JSON.stringify(stateRef.current)); } catch { /* ignore */ } };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onHide); };
  }, []);
  const stateRef = useRef(state);
  stateRef.current = state;

  const updateEntry = useCallback((index: number, patch: Partial<Pick<Entry, 'ref' | 'text'>>) => {
    setState((s) => ({
      ...s,
      entries: s.entries.map((e, i) => (i === index ? { ...e, ...patch, updatedAt: Date.now() } : e))
    }));
  }, []);

  /** Appends a blank page and returns its index. */
  const addEntry = useCallback((): number => {
    const index = stateRef.current.entries.length;
    setState((s) => ({ ...s, entries: [...s.entries, newEntry()] }));
    return index;
  }, []);

  const setLastPage = useCallback((lastPage: number) => setState((s) => (s.lastPage === lastPage ? s : { ...s, lastPage })), []);

  return { entries: state.entries, lastPage: state.lastPage, updateEntry, addEntry, setLastPage };
}
