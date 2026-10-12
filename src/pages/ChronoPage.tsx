import { DirectionSwitch } from '../components/DirectionSwitch';
import { SelectField } from '../components/SelectField';
import { cardBookOptions, cardMatchesBook } from '../lib/books';
import { CATEGORIES, shuffle } from '../lib/cards';
import { levelOptions, matchesLevel, parseLevelFilter } from '../lib/levels';
import type { Book, BookFilter, Card, Category, Direction, LevelFilter } from '../types';

export function ChronoPage({ books, book, levels, level, cards, category, size, direction, onBook, onLevel, onCategory, onSize, onDirection, onStart, onChoose }: {
  books: Book[] | null; book: BookFilter; levels: number[]; level: LevelFilter; cards: Card[]; category: Category; size: number; direction: Direction; onDirection: (direction: Direction) => void; onBook: (book: BookFilter) => void; onLevel: (level: LevelFilter) => void; onCategory: (cat: Category) => void; onSize: (size: number) => void; onStart: (cards: Card[]) => void; onChoose: () => void;
}) {
  const inCategory = cards.filter(card => card.cat === category);
  const inBook = inCategory.filter(card => cardMatchesBook(card, book));
  const available = inBook.filter(card => matchesLevel(card, level));
  const count = Math.min(size, available.length);
  return <>
    <section className="panel"><h2>Chrono</h2>
      <div className="row filters"><SelectField label="Catégorie" value={category} options={CATEGORIES.map(cat => [cat.key, cat.label])} onChange={value => onCategory(value as Category)} /><SelectField label="Nombre de mots" value={size} options={[10, 20, 50].map(n => [n, `${n} mots`])} onChange={value => onSize(Number(value))} />{books !== null && <SelectField label="Livre" value={book} options={cardBookOptions(books, inCategory.filter(card => matchesLevel(card, level)), cards.some(card => card.books.includes(null)))} onChange={value => onBook(value as BookFilter)} />}{levels.length > 0 && <SelectField label="Niveau" value={level} options={levelOptions(levels, inBook)} onChange={value => onLevel(parseLevelFilter(value))} />}</div>
      <div className="row"><DirectionSwitch value={direction} onChange={onDirection} /><button className="btn primary" disabled={!count} onClick={() => onStart(shuffle(available).slice(0, count))}>C’est parti · {count} mots</button></div>
      <button className="btn link" onClick={onChoose}>Choisir moi-même les mots →</button>
    </section></>;
}
