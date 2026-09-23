import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { Workspace } from './Workspace';
import type { Book, CardRow } from './types';
import { loadBookFilter, saveBookFilter } from './lib/storage';

const api = vi.hoisted(() => ({ deleteCards: vi.fn(), saveProgress: vi.fn(), signOut: vi.fn() }));
vi.mock('./lib/supabase', () => ({ ...api, supabase: { auth: { signOut: api.signOut } }, errorMessage: (error: Error) => error.message }));
vi.mock('./lib/sound', () => ({ playSound: vi.fn() }));
const books: Book[] = [{ code: '초급2', label: 'Débutant 2' }, { code: '초급1', label: 'Débutant 1' }, { code: 'new', label: 'Nouveau livre' }];
const rows: CardRow[] = [
  { id: '1', category: 'vocab', word_type: 'verb', ko: '먹다', fr: 'Manger', book: '초급1', lesson: 1, short_form: null },
  { id: '2', category: 'vocab', word_type: 'verb', ko: '마시다', fr: 'Boire', book: '초급2', lesson: 1, short_form: null },
  { id: '3', category: 'vocab', word_type: null, ko: '학교', fr: 'École', book: '초급1', lesson: 2, short_form: null },
  { id: '4', category: 'vocab', word_type: null, ko: '집', fr: 'Maison', book: null, lesson: null, short_form: null },
];
function setup(catalogue: Book[] | null = books, cards = rows) {
  const view = render(<Workspace user={{ id: 'books-test', email: 'test@example.test' } as User} initialRows={cards} initialStats={{}} admin books={catalogue} />);
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Mes mots' }));
  return view;
}
const choose = (name: string, value: string) => fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } });
beforeEach(() => { api.deleteCards.mockReset().mockResolvedValue(['4']); api.saveProgress.mockReset().mockResolvedValue(undefined); vi.spyOn(window, 'confirm').mockReturnValue(true); });

describe('dynamic book filter', () => {
  it('uses the supplied catalogue order and shows all counts including zero', () => {
    setup();
    expect(within(screen.getByRole('combobox', { name: 'Livre' })).getAllByRole('option').map(option => option.textContent)).toEqual([
      'Tous les livres (4)', '초급2 · Débutant 2 (1)', '초급1 · Débutant 1 (2)', 'new · Nouveau livre (0)', 'Sans livre (1)',
    ]);
    expect((screen.getByLabelText('Livre') as HTMLSelectElement).value).toBe('all');
  });
  it('combines book, category and search immediately, including a zero-result state', () => {
    setup(); choose('Livre', 'book:초급1');
    expect(screen.queryByRole('checkbox', { name: 'Sélectionner Boire' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Sélectionner École' })).toBeDefined();
    choose('Catégorie', 'verbs');
    expect(screen.getByRole('checkbox', { name: 'Sélectionner Manger' })).toBeDefined();
    expect(screen.queryByRole('checkbox', { name: 'Sélectionner École' })).toBeNull();
    expect(screen.getByRole('option', { name: '초급1 · Débutant 1 (1)' })).toBeDefined();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'boire' } });
    expect(screen.getByText(/Aucun mot trouvé/)).toBeDefined();
    choose('Livre', 'book:초급2');
    expect(screen.getByRole('checkbox', { name: 'Sélectionner Boire' })).toBeDefined();
  });
  it('remembers the chosen book when the workspace is reloaded', () => {
    const view = setup(); choose('Livre', 'book:초급2'); view.unmount(); setup();
    expect((screen.getByLabelText('Livre') as HTMLSelectElement).value).toBe('book:초급2');
    expect(screen.getByText(/1 mots affichés sur 4/)).toBeDefined();
  });
  it('falls back to all books when the saved code no longer exists', () => {
    saveBookFilter('book:deleted'); setup();
    expect((screen.getByLabelText('Livre') as HTMLSelectElement).value).toBe('all');
    expect(screen.getByText(/4 mots affichés sur 4/)).toBeDefined();
  });
  it('omits the no-book option when no cards have a null book', () => {
    saveBookFilter('none'); setup(books, rows.filter(row => row.book !== null));
    expect(screen.queryByRole('option', { name: /Sans livre/ })).toBeNull();
    expect((screen.getByLabelText('Livre') as HTMLSelectElement).value).toBe('all');
  });
  it('resets the no-book filter after deleting the last unassigned card', async () => {
    setup(); choose('Livre', 'none');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner Maison' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la sélection' }));
    await waitFor(() => expect((screen.getByLabelText('Livre') as HTMLSelectElement).value).toBe('all'));
    expect(screen.queryByRole('option', { name: /Sans livre/ })).toBeNull();
    await waitFor(() => expect(loadBookFilter(books, rows)).toBe('all'));
  });
  it('hides an unavailable catalogue and ignores its saved filter', () => {
    saveBookFilter('book:초급1'); setup(null);
    expect(screen.queryByLabelText('Livre')).toBeNull();
    expect(screen.getByText(/4 mots affichés sur 4/)).toBeDefined();
    expect(loadBookFilter(books, rows)).toBe('book:초급1');
  });
  it('keeps the filter usable when localStorage throws on read or write', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    setup(); choose('Livre', 'book:초급1');
    expect((screen.getByLabelText('Livre') as HTMLSelectElement).value).toBe('book:초급1');
    expect(screen.getByText(/2 mots affichés sur 4/)).toBeDefined();
  });
});
