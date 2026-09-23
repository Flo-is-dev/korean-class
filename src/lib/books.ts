import type { Book, BookFilter, CardRow } from '../types';

export function validateBookFilter(value: unknown, books: Book[] | null, rows: CardRow[]): BookFilter {
  if (!books) return 'all';
  if (value === 'none' && rows.some(row => row.book === null)) return 'none';
  if (typeof value === 'string' && books.some(book => value === `book:${book.code}`)) return value as BookFilter;
  return 'all';
}
export function matchesBook(row: CardRow, filter: BookFilter) {
  return filter === 'all' || (filter === 'none' ? row.book === null : row.book === filter.slice(5));
}
