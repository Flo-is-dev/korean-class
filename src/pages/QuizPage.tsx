import { useEffect, useMemo, useRef, useState } from 'react';
import type { Answer, Card, Progress, QuizResult, QuizRun } from '../types';
import { acceptedFor, answerKey, categoryName, choicesFor } from '../lib/cards';
import { formatTime } from '../lib/game';
import { Hanzi } from '../components/Hanzi';
import { Icon } from '../components/Icon';

const LIMIT = 10;

export function QuizPage({ run, pool, paused = false, onAnswer, onOverride, onFinish, onSound }: {
  run: QuizRun; pool?: Card[]; paused?: boolean; onAnswer: (id: string, ok: boolean) => Progress | undefined; onOverride: (id: string, previous: Progress | undefined) => void; onFinish: (result: QuizResult) => void; onSound?: (kind: 'flip' | 'tap' | 'tick') => void;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [input, setInput] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const started = useRef(performance.now());
  // Timestamp at which the current answer stopped the global clock.
  // Reading time is removed from `started` only when the next card is activated.
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
  const flash = run.mode === 'flash';
  const mcq = run.mode === 'mcq';
  const limit = run.timed && mcq ? LIMIT : 0;
  const [left, setLeft] = useState(limit);
  const [late, setLate] = useState(false);
  const cardStarted = useRef(performance.now());
  const lastTick = useRef(0);
  const direction = run.direction ?? 'fr-ko';
  const reverse = direction === 'ko-fr';
  const accepted = useMemo(() => acceptedFor(card, direction, pool ?? run.cards), [card, direction, pool, run.cards]);
  const isRight = (text: string) => accepted.has(answerKey(text, direction));
  const choices = useMemo(() => mcq ? choicesFor(card, pool ?? run.cards, direction) : [], [mcq, card, pool, run.cards, direction]);
  // While paused (settings open over the series) both clocks stop; on resume they pick up where they left off.
  const pausedAt = useRef<number | null>(null);
  useEffect(() => {
    if (paused) { pausedAt.current = performance.now(); return; }
    if (pausedAt.current === null) return;
    const gap = performance.now() - pausedAt.current;
    pausedAt.current = null; cardStarted.current += gap;
    if (ended.current === null) started.current += gap;
  }, [paused]);
  useEffect(() => {
    if (!run.timed || paused || revealed) return;
    const tick = () => setElapsed(((ended.current ?? performance.now()) - started.current) / 1000);
    tick(); const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [run.timed, paused, revealed, index]);
  useEffect(() => {
    if (paused) return;
    if (typed) { if (revealed) nextRef.current?.focus(); else inputRef.current?.focus(); }
    else if (mcq) { if (revealed) nextRef.current?.focus(); }
    else if (revealed) yesRef.current?.focus(); else flipRef.current?.focus();
  }, [index, revealed, typed, mcq, paused]);
  function finish() {
    if (finished.current) return;
    finished.current = true;
    onFinish({ run, answers: [...results.current], seconds: ((ended.current ?? performance.now()) - started.current) / 1000, completed: results.current.length === run.cards.length });
  }
  function reveal() {
    if (revealed) return;
    setRevealed(true); onSound?.('flip');
  }
  function next() {
    if (paused || !handled.current || finished.current) return;
    if (index + 1 >= run.cards.length) return finish();
    const now = performance.now();
    if (ended.current !== null) {
      started.current += now - ended.current;
      ended.current = null;
    }
    handled.current = false; setIndex(index + 1); setRevealed(false); setInput(''); setAnswer(null);
    cardStarted.current = now; lastTick.current = 0; setLeft(limit); setLate(false);
  }
  function submit(ok: boolean, raw?: string) {
    if (paused || handled.current || finished.current) return;
    handled.current = true;
    if (run.timed) {
      ended.current = performance.now(); setElapsed((ended.current - started.current) / 1000);
      if (limit) setLeft(Math.max(0, limit - (ended.current - cardStarted.current) / 1000));
    }
    const result = { card, ok, typed: raw };
    previous.current = onAnswer(card.id, ok);
    results.current.push(result); setAnswer(result); setRevealed(true);
    if (flash) next();
  }
  function choose(choice: string) {
    if (!revealed) submit(isRight(choice), choice);
  }
  function check(giveUp = false) {
    if (revealed || handled.current) return;
    if (!giveUp && !input.trim()) { inputRef.current?.focus(); return; }
    submit(!giveUp && isRight(input.trim()), giveUp ? '' : input.trim());
  }
  // Timed multiple choice: each question runs out after LIMIT seconds, ticking through the last five.
  useEffect(() => {
    if (!limit || revealed || paused) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, limit - (performance.now() - cardStarted.current) / 1000);
      const second = Math.ceil(remaining);
      setLeft(remaining);
      if (second > 0 && second <= 5 && second !== lastTick.current) { lastTick.current = second; onSound?.('tick'); }
      if (!remaining) { setLate(true); submit(false); }
    }, 100);
    return () => clearInterval(timer);
  }, [index, revealed, limit, paused]);
  function override() {
    if (!answer || answer.ok || run.timed) return;
    onOverride(card.id, previous.current);
    results.current[results.current.length - 1] = { ...answer, ok: true };
    next();
  }
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (paused || typed || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (mcq) {
        const choice = !revealed && choices[Number(event.key) - 1];
        if (choice) { event.preventDefault(); choose(choice); }
        return;
      }
      if (!revealed && (event.key === ' ' || event.key === 'Enter')) { event.preventDefault(); reveal(); }
      else if (revealed && ['1', 'ArrowLeft', '2', 'ArrowRight'].includes(event.key)) { event.preventDefault(); submit(event.key === '2' || event.key === 'ArrowRight'); }
    }
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  });
  const nextButton = <button ref={nextRef} className="btn primary" onClick={() => { onSound?.('tap'); next(); }}>{index + 1 < run.cards.length ? 'Carte suivante' : 'Voir le résultat'} <span className="kbd">Entrée</span></button>;
  return <>
    <div className="field quiz-layout">
      <div className="quiz-status">
        {run.timed && <div className="quiz-clock"><div className="quiz-stat" role="timer" aria-label="Temps écoulé"><Icon name="stopwatch" size={28} />{formatTime(elapsed)}</div>{revealed && <span className="clock-paused" role="status">En pause</span>}</div>}
        <div className="quiz-stat" title="Avancement de la série"><Icon name="cards" size={28} />{index + 1} / {run.cards.length}</div>
        <button className="btn link" onClick={finish}>Terminer</button>
      </div>
      {limit > 0 && <div className={`countdown ${left <= 5 ? 'urgent' : ''}`} role="timer" aria-label="Temps restant pour cette question"><div className="bar"><i style={{ width: `${left / limit * 100}%` }} /></div><span>{Math.ceil(left)} s</span></div>}
      <div className={`card ${revealed ? 'flipped' : flash ? 'clickable' : ''}`} aria-live="polite" onClick={flash ? reveal : undefined}><div className="card-inner">
        <div className="face front" aria-hidden={revealed}><div className="tag"><span>{categoryName(card.cat)}</span><span>{card.tag}</span></div>{reverse ? <div className="ko" lang="ko">{card.back}</div> : <><div className="fr">{card.front}</div>{card.hint && <div className="hint">{card.hint}</div>}</>}</div>
        <div className="face back" aria-hidden={!revealed}><div className="tag"><span lang={reverse ? 'ko' : undefined}>{reverse ? card.back : card.front}</span><span>{card.tag}</span></div>{answer && (!mcq || late) && <span className={`verdict ${answer.ok ? 'ok' : 'ko-v'}`}>{answer.ok ? 'Correct' : late ? 'Temps écoulé' : 'Pas tout à fait'}</span>}{reverse ? <><div className="fr">{card.front}</div>{revealed && card.zh && <div className="ko-alt" lang="ko">{card.back}<Hanzi key={card.id} zh={card.zh} /></div>}</> : <div className="ko" lang="ko">{card.back}{revealed && card.zh && <Hanzi key={card.id} zh={card.zh} />}</div>}{card.alt && <div className="ko-alt" lang="ko">{card.alt}</div>}{!reverse && card.others.length > 0 && <div className="ko-alt" lang="ko">aussi : {card.others.join(' · ')}</div>}{!mcq && answer?.typed && !answer.ok && <div className="yours">Ta réponse : <b lang={reverse ? undefined : 'ko'}>{answer.typed}</b></div>}</div>
      </div></div>
      <div className="field">
        {flash && (!revealed ? <button ref={flipRef} className="btn primary" onClick={reveal}>Retourner la carte <span className="kbd">Espace</span></button> : <div className="row"><button className="btn bad" onClick={() => submit(false)}>Je ne savais pas <span className="kbd">1</span></button><button ref={yesRef} className="btn good" onClick={() => submit(true)}>Je savais <span className="kbd">2</span></button></div>)}
        {typed && (!revealed ? <><form className="answer" onSubmit={event => { event.preventDefault(); check(); }}><input ref={inputRef} type="text" lang={reverse ? 'fr' : 'ko'} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={reverse ? 'Réponse en français' : 'Réponse en hangul'} aria-label={reverse ? 'Ta réponse en français' : 'Ta réponse en coréen'} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }} /><button className="btn primary" type="submit">Vérifier</button></form><button className="btn link" onClick={() => check(true)}>Je ne sais pas</button></> : <div className="row">{!run.timed && answer?.typed && !answer.ok && <button className="btn" title="Faute de frappe ou variante valable" onClick={override}>J’avais bon</button>}{nextButton}</div>)}
        {mcq && <><div className="choices">{choices.map((choice, position) => <button key={choice} className={`btn choice ${!revealed ? '' : isRight(choice) ? 'good' : choice === answer?.typed ? 'bad' : ''}`} lang={reverse ? undefined : 'ko'} disabled={revealed} onClick={() => choose(choice)}><span className="kbd">{position + 1}</span>{choice}</button>)}</div>{revealed && nextButton}</>}
      </div>
    </div>
  </>;
}
