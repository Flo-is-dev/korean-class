import { useEffect, useRef, useState } from 'react';
import { SelectField } from '../components/SelectField';
import { normalize, searchText, shuffle } from '../lib/cards';
import { errorMessage, loadGrammar } from '../lib/supabase';
import type { Book, Card, GrammarPoint } from '../types';

const bookKey = 'haru:grammar:book';
const DEFAULT_BOOK = 'CDC 초급';
const CONJUGATIONS: Record<string, string> = { '1': 'radical + terminaison', '2': 'ajout de (으) après une consonne', '3': '해 / 아 / 어 selon la dernière voyelle' };

function loadBook() {
  try { return localStorage.getItem(bookKey); }
  catch { return null; }
}
function saveBook(book: string) {
  try { localStorage.setItem(bookKey, book); }
  catch { /* The selector remains usable when browser storage is unavailable. */ }
}
// Points are grouped by section, or by chapter in the books that have no section.
function groupOf(point: GrammarPoint, points: GrammarPoint[]) {
  if (points.some(other => other.book === point.book && other.section)) return point.section ?? 'Autres points';
  return point.lesson != null ? `Chapitre ${point.lesson}` : 'Sans chapitre';
}
const chipsOf = (point: GrammarPoint) => [point.lesson != null ? `Ch. ${point.lesson}` : '', point.cefr ?? '', point.conjType ? `Voie ${point.conjType}` : ''].filter(Boolean);

export function GrammarPage({ books, points, cards, detail, onLoaded, onOpen, onBack, onStart }: {
  books: Book[] | null; points: GrammarPoint[] | null; cards: Card[]; detail: string | null; onLoaded: (points: GrammarPoint[]) => void; onOpen: (id: string) => void; onBack: () => void; onStart: (cards: Card[]) => void;
}) {
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState(loadBook);
  const root = useRef<HTMLElement>(null);
  const listScroll = useRef(0);
  const loaded = points !== null;
  useEffect(() => {
    if (loaded) return;
    let active = true;
    setError('');
    loadGrammar().then(result => { if (active) onLoaded(result); }).catch(failure => { if (active) setError(errorMessage(failure)); });
    return () => { active = false; };
  }, [loaded, attempt]);
  const point = points?.find(item => item.id === detail);
  // The detail opens at the top; going back restores the position in the list.
  const opened = point?.id;
  useEffect(() => {
    const view = root.current?.closest('#view');
    if (view) view.scrollTop = opened ? 0 : listScroll.current;
  }, [opened]);

  if (!points) return <section className="panel" ref={root}><h2>Grammaire</h2>{error ? <><p className="error" role="alert">Impossible de charger la grammaire. {error}</p><button className="btn primary" onClick={() => setAttempt(attempt + 1)}>Réessayer</button></> : <p className="loading" role="status">Chargement de la grammaire…</p>}</section>;

  if (point) {
    const group = groupOf(point, points);
    const members = new Set(points.filter(other => other.book === point.book && groupOf(other, points) === group).map(other => `${normalize(other.fr)}|${normalize(other.ko)}`));
    const review = cards.filter(card => card.cat === 'grammar' && members.has(`${normalize(card.front)}|${normalize(card.back)}`));
    const conjugation = point.conjType?.split('/').map(type => CONJUGATIONS[type.trim()]).filter(Boolean).join(' ; ou ');
    return <section className="panel" ref={root}>
      <button className="btn link grammar-back" onClick={onBack}>← Retour à la liste</button>
      <h2 className="ko" lang="ko">{point.ko}</h2>
      <p className="word-fr">{point.fr}</p>
      <dl className="grammar-facts">
        {point.section && <><dt>Rubrique</dt><dd>{point.section}</dd></>}
        {point.lesson != null && <><dt>Chapitre</dt><dd>{point.lesson}</dd></>}
        {point.cefr && <><dt>CECR</dt><dd>{point.cefr}</dd></>}
        {point.conjType && <><dt>Voie</dt><dd>{point.conjType}{conjugation && ` — ${conjugation}`}</dd></>}
      </dl>
      <div className="field"><div className="label">Exemples</div>{point.examples.length ? <ul className="examples">{point.examples.map((example, index) => <li key={index}><span className="example-ko" lang="ko">{example.ko}</span><span className="example-fr">{example.fr}</span></li>)}</ul> : <p className="empty-state">Pas encore d’exemple pour ce point.</p>}</div>
      <button className="btn primary" disabled={!review.length} onClick={() => onStart(shuffle(review))}>{point.section ? 'Réviser cette rubrique' : 'Réviser ce chapitre'} · {review.length} cartes</button>
    </section>;
  }

  const codes = [...new Set(points.map(item => item.book ?? ''))];
  const ordered = [...(books ?? []).map(item => item.code).filter(code => codes.includes(code)), ...codes.filter(code => !books?.some(item => item.code === code))];
  const options = ordered.map(code => [code, code ? [code, books?.find(item => item.code === code)?.label ?? points.find(item => item.book === code)?.bookLabel].filter(Boolean).join(' · ') : 'Sans livre'] as const);
  const book = saved !== null && ordered.includes(saved) ? saved : ordered.includes(DEFAULT_BOOK) ? DEFAULT_BOOK : ordered[0] ?? '';
  const needle = searchText(query);
  const visible = points.filter(item => (item.book ?? '') === book && searchText(`${item.ko} ${item.fr}`).includes(needle));
  const groups = new Map<string, GrammarPoint[]>();
  visible.forEach(item => { const key = groupOf(item, points); groups.set(key, [...(groups.get(key) ?? []), item]); });
  return <section className="panel" ref={root}>
    <h2>Grammaire</h2>
    <div className="filters row"><input className="search" type="search" aria-label="Rechercher un point de grammaire" placeholder="Rechercher en français ou en coréen…" value={query} onChange={event => setQuery(event.target.value)} />{options.length > 0 && <SelectField label="Livre" value={book} options={options} onChange={value => { setSaved(value); saveBook(value); }} />}</div>
    <p className="note" role="status">{visible.length} point(s) de grammaire</p>
    {[...groups.entries()].map(([name, items]) => <section className="grammar-group" key={name} aria-label={name}><h3>{name}</h3>{items.map(item => <button className="grammar-row" key={item.id} onClick={() => { listScroll.current = root.current?.closest('#view')?.scrollTop ?? 0; onOpen(item.id); }}><span className="word-ko" lang="ko">{item.ko}</span><span className="word-fr">{item.fr}</span>{chipsOf(item).length > 0 && <span className="chips">{chipsOf(item).map(chip => <span className="chip" key={chip}>{chip}</span>)}</span>}</button>)}</section>)}
    {!visible.length && <p className="empty-state">{query ? 'Aucun point de grammaire ne correspond à ta recherche.' : 'Aucun point de grammaire pour ce livre.'}</p>}
  </section>;
}
