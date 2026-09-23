import { useEffect, useRef, useState } from 'react';
import type { Answer, Progress, QuizResult, QuizRun } from '../types';
import { categoryName, normalize } from '../lib/cards';
import { formatTime } from '../lib/game';

export function QuizPage({ run, onAnswer, onOverride, onFinish }: {
  run: QuizRun; onAnswer: (id: string, ok: boolean) => Progress | undefined; onOverride: (id: string, previous: Progress | undefined) => void; onFinish: (result: QuizResult) => void;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [input, setInput] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const started = useRef(performance.now());
  const ended = useRef<number | null>(null);
  const results = useRef<Answer[]>([]);
  const handled = useRef(false);
  const finished = useRef(false);
  const previous = useRef<Progress | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const flipRef = useRef<HTMLButtonElement>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  const card = run.cards[index];
  const typed = run.mode === 'type';
  useEffect(() => {
    if (!run.timed) return;
    const tick = () => setElapsed(((ended.current ?? performance.now()) - started.current) / 1000);
    tick(); const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [run.timed]);
  useEffect(() => {
    if (typed) { if (revealed) nextRef.current?.focus(); else inputRef.current?.focus(); }
    else if (revealed) yesRef.current?.focus(); else flipRef.current?.focus();
  }, [index, revealed, typed]);
  function finish() {
    if (finished.current) return;
    finished.current = true;
    onFinish({ run, answers: [...results.current], seconds: ((ended.current ?? performance.now()) - started.current) / 1000, completed: results.current.length === run.cards.length });
  }
  function next() {
    if (!handled.current || finished.current) return;
    if (index + 1 >= run.cards.length) return finish();
    handled.current = false; setIndex(index + 1); setRevealed(false); setInput(''); setAnswer(null);
  }
  function submit(ok: boolean, raw?: string) {
    if (handled.current || finished.current) return;
    handled.current = true;
    const result = { card, ok, typed: raw };
    previous.current = onAnswer(card.id, ok);
    results.current.push(result); setAnswer(result); setRevealed(true);
    if (run.timed && results.current.length === run.cards.length) {
      ended.current = performance.now(); setElapsed((ended.current - started.current) / 1000);
    }
    if (!typed) next();
  }
  function check(giveUp = false) {
    if (revealed || handled.current) return;
    if (!giveUp && !input.trim()) { inputRef.current?.focus(); return; }
    submit(!giveUp && card.accepted.has(normalize(input.trim())), giveUp ? '' : input.trim());
  }
  function override() {
    if (!answer || answer.ok || run.timed) return;
    onOverride(card.id, previous.current);
    results.current[results.current.length - 1] = { ...answer, ok: true };
    next();
  }
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (typed || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (!revealed && (event.key === ' ' || event.key === 'Enter')) { event.preventDefault(); setRevealed(true); }
      else if (revealed && ['1', 'ArrowLeft', '2', 'ArrowRight'].includes(event.key)) { event.preventDefault(); submit(event.key === '2' || event.key === 'ArrowRight'); }
    }
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  });
  return <>
    {run.timed && <div className="live-clock" role="timer" aria-label="Temps écoulé">⏱ {formatTime(elapsed)}</div>}
    <div className="field quiz-layout">
      <div className="progress"><span>{index + 1} / {run.cards.length}</span><div className="bar" role="progressbar" aria-label="Avancement de la série" aria-valuemin={0} aria-valuemax={run.cards.length} aria-valuenow={results.current.length}><i style={{ width: `${results.current.length / run.cards.length * 100}%` }} /></div><button className="btn link" onClick={finish}>Terminer</button></div>
      <div className={`card ${revealed ? 'flipped' : ''}`} aria-live="polite"><div className="card-inner">
        <div className="face front" aria-hidden={revealed}><div className="tag"><span>{categoryName(card.cat)}</span><span>{card.tag}</span></div><div className="fr">{card.front}</div>{card.hint && <div className="hint">{card.hint}</div>}</div>
        <div className="face back" aria-hidden={!revealed}><div className="tag"><span>{card.front}</span><span>{card.tag}</span></div>{answer && <span className={`verdict ${answer.ok ? 'ok' : 'ko-v'}`}>{answer.ok ? 'Correct' : 'Pas tout à fait'}</span>}<div className="ko" lang="ko">{card.back}</div>{card.alt && <div className="ko-alt" lang="ko">{card.alt}</div>}{card.others.length > 0 && <div className="ko-alt" lang="ko">aussi : {card.others.join(' · ')}</div>}{answer?.typed && !answer.ok && <div className="yours">Ta réponse : <b lang="ko">{answer.typed}</b></div>}</div>
      </div></div>
      <div className="field">
        {!typed && (!revealed ? <button ref={flipRef} className="btn primary" onClick={() => setRevealed(true)}>Retourner la carte <span className="kbd">Espace</span></button> : <div className="row"><button className="btn bad" onClick={() => submit(false)}>Je ne savais pas <span className="kbd">1</span></button><button ref={yesRef} className="btn good" onClick={() => submit(true)}>Je savais <span className="kbd">2</span></button></div>)}
        {typed && (!revealed ? <><form className="answer" onSubmit={event => { event.preventDefault(); check(); }}><input ref={inputRef} type="text" lang="ko" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="Réponse en hangul" aria-label="Ta réponse en coréen" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }} /><button className="btn primary" type="submit">Vérifier</button></form><button className="btn link" onClick={() => check(true)}>Je ne sais pas</button></> : <div className="row">{!run.timed && answer?.typed && !answer.ok && <button className="btn" title="Faute de frappe ou variante valable" onClick={override}>J’avais bon</button>}<button ref={nextRef} className="btn primary" onClick={next}>{index + 1 < run.cards.length ? 'Carte suivante' : 'Voir le résultat'} <span className="kbd">Entrée</span></button></div>)}
      </div>
    </div>
  </>;
}
