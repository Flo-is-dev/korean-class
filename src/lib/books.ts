import type { Book, BookFilter, Card, CardRow } from '../types';

export function validateBookFilter(value: unknown, books: Book[] | null, rows: CardRow[]): BookFilter {
  if (!books) return 'all';
  if (value === 'none' && rows.some(row => row.book === null)) return 'none';
  if (typeof value === 'string' && books.some(book => value === `book:${book.code}`)) return value as BookFilter;
  return 'all';
}
export function matchesBook(row: CardRow, filter: BookFilter) {
  return filter === 'all' || (filter === 'none' ? row.book === null : row.book === filter.slice(5));
}
export function cardMatchesBook(card: Card, filter: BookFilter) {
  return filter === 'all' || card.books.includes(filter === 'none' ? null : filter.slice(5));
}
// Options for a book select over cards; the counts cover the cards it is given.
export function cardBookOptions(books: Book[], cards: Card[], hasUnassigned: boolean): [BookFilter, string][] {
  const count = (filter: BookFilter) => cards.filter(card => cardMatchesBook(card, filter)).length;
  const options: [BookFilter, string][] = [['all', `Tous les livres (${count('all')})`]];
  for (const book of books) options.push([`book:${book.code}`, `${book.code} · ${book.label} (${count(`book:${book.code}`)})`]);
  if (hasUnassigned) options.push(['none', `Sans livre (${count('none')})`]);
  return options;
}
