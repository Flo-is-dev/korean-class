import { useCallback, useEffect, useRef, useState } from 'react';
import type { Progress, Stats } from '../types';
import { recordAnswer } from '../lib/cards';
import { ProgressQueue } from '../lib/progress-queue';
import { saveProgress } from '../lib/supabase';

export function useProgress(userId: string, initial: Stats) {
  const [stats, setStats] = useState(initial);
  const current = useRef(initial);
  const [saveError, setSaveError] = useState(false);
  const [queue] = useState(() => new ProgressQueue(entries => saveProgress(userId, entries)));
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const success = await queue.flush();
    setSaveError(!success);
    return success;
  }, [queue]);
  const record = (id: string, ok: boolean, previous?: Progress) => {
    const before = current.current[id];
    const value = recordAnswer(previous ?? before, ok);
    current.current = { ...current.current, [id]: value };
    setStats(current.current); queue.set(id, value);
    clearTimeout(timer.current); timer.current = setTimeout(() => void flush(), 1200);
    return before;
  };
  // Restores the pre-answer state before replacing a rejected answer in training.
  const override = (id: string, previous: Progress | undefined) => {
    const value = recordAnswer(previous, true);
    current.current = { ...current.current, [id]: value };
    setStats(current.current); queue.set(id, value);
    clearTimeout(timer.current); timer.current = setTimeout(() => void flush(), 1200);
  };
  const forget = (ids: string[]) => {
    queue.forget(ids);
    const next = { ...current.current }; ids.forEach(id => delete next[id]);
    current.current = next; setStats(next);
  };
  useEffect(() => {
    const persist = () => { void queue.flush(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (queue.pending) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('pagehide', persist);
    window.addEventListener('beforeunload', beforeUnload);
    return () => { clearTimeout(timer.current); window.removeEventListener('pagehide', persist); window.removeEventListener('beforeunload', beforeUnload); void queue.flush(); };
  }, [queue]);
  return { stats, saveError, record, override, flush, forget };
}
