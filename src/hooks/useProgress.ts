import { useCallback, useEffect, useRef, useState } from 'react';
import type { Progress, Stats } from '../types';
import { AnswerQueue } from '../lib/progress-queue';
import { sendAnswer, unmasterCard } from '../lib/supabase';

// The score rule lives in the database: every answer goes through record_answer and the local state takes the returned row.
export function useProgress(initial: Stats) {
  const [stats, setStats] = useState(initial);
  const current = useRef(initial);
  const [saveError, setSaveError] = useState(false);
  const apply = useCallback((id: string, value: Progress) => {
    current.current = { ...current.current, [id]: value };
    setStats(current.current);
  }, []);
  const [queue] = useState(() => new AnswerQueue(async answer => apply(answer.id, await sendAnswer(answer.id, answer.ok))));
  const flush = useCallback(async () => {
    const success = await queue.flush();
    setSaveError(!success);
    return success;
  }, [queue]);
  const drain = () => { void queue.drain().then(success => setSaveError(!success)); };
  // `hold` keeps a rejected answer unsent while it can still be corrected by `override`.
  const record = (id: string, ok: boolean, hold = false) => {
    queue.add({ id, ok }, hold); drain();
    return current.current[id];
  };
  const override = (id: string) => {
    if (!queue.correctHeld(id)) queue.add({ id, ok: true });
    drain();
  };
  const unmaster = async (id: string) => apply(id, await unmasterCard(id));
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
    return () => { window.removeEventListener('pagehide', persist); window.removeEventListener('beforeunload', beforeUnload); void queue.flush(); };
  }, [queue]);
  return { stats, saveError, record, override, unmaster, flush, forget };
}
