import { DirectionSwitch } from '../components/DirectionSwitch';
import { MultiSelect } from '../components/MultiSelect';
import { SelectField } from '../components/SelectField';
import { cardBookOptions, cardMatchesBook } from '../lib/books';
import { CATEGORIES, SIZES, cardPool, isError, shuffle } from '../lib/cards';
import { levelOptions, matchesLevel, parseLevelFilter } from '../lib/levels';
import type { Book, BookFilter, Card, LevelFilter, Settings, Stats } from '../types';

export function LearnPage({ books, book, levels, level, cards, settings, stats, onBook, onLevel, onSettings, onStart }: {
  books: Book[] | null; book: BookFilter; levels: number[]; level: LevelFilter; cards: Card[]; settings: Settings; stats: Stats; onBook: (book: BookFilter) => void; onLevel: (level: LevelFilter) => void; onSettings: (settings: Settings) => void; onStart: (cards: Card[]) => void;
}) {
  const eligible = cardPool(cards, settings, stats);
  const inScope = cards.filter(card => cardMatchesBook(card, book) && matchesLevel(card, level));
  const pool = cardPool(inScope, settings, stats);
  const totalErrors = inScope.filter(card => settings.cats.includes(card.cat) && isError(stats[card.id])).length;
  return <>
    <h2 className="page-heading">Apprendre</h2>
    <section className="panel learn-panel">
      <fieldset className="field"><legend>Catégories</legend><MultiSelect label="Catégories" selected={settings.cats} onChange={cats => onSettings({ ...settings, cats })} options={CATEGORIES.map(category => ({ value: category.key, label: category.label, count: inScope.filter(card => card.cat === category.key && (!settings.errorsOnly || isError(stats[card.id]))).length }))} /></fieldset>
      {(books !== null || levels.length > 0) && <div className="filters row">{books !== null && <SelectField label="Livre" value={book} options={cardBookOptions(books, eligible.filter(card => matchesLevel(card, level)), cards.some(card => card.books.includes(null)))} onChange={value => onBook(value as BookFilter)} />}{levels.length > 0 && <SelectField label="Niveau" value={level} options={levelOptions(levels, eligible.filter(card => cardMatchesBook(card, book)))} onChange={value => onLevel(parseLevelFilter(value))} />}</div>}
      <fieldset className="field"><legend>Nombre de cartes</legend><div className="seg">{SIZES.map(size => <button key={size} aria-pressed={settings.size === size} onClick={() => onSettings({ ...settings, size })}>{size || 'Toutes'}</button>)}</div></fieldset>
      <fieldset className="field"><legend>Mode</legend><div className="seg"><button aria-pressed={settings.mode === 'flash'} onClick={() => onSettings({ ...settings, mode: 'flash' })}>Flashcards</button><button aria-pressed={settings.mode === 'mcq'} onClick={() => onSettings({ ...settings, mode: 'mcq' })}>QCM</button><button aria-pressed={settings.mode === 'type'} onClick={() => onSettings({ ...settings, mode: 'type' })}>{settings.direction === 'ko-fr' ? 'Saisie en français' : 'Saisie en hangul'}</button></div></fieldset>
      <label className="toggle"><span><strong>Revoir mes erreurs ({totalErrors})</strong></span><input type="checkbox" checked={settings.errorsOnly} disabled={!totalErrors && !settings.errorsOnly} onChange={event => onSettings({ ...settings, errorsOnly: event.target.checked })} /></label>
      <div className="row"><DirectionSwitch value={settings.direction} onChange={direction => onSettings({ ...settings, direction })} /><button id="start" className="btn primary" disabled={!pool.length} onClick={() => onStart(shuffle(pool).slice(0, settings.size || undefined))}>Commencer · {Math.min(pool.length, settings.size || pool.length)} cartes</button></div>
    </section>
  </>;
}
