import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { Workspace } from '../Workspace';
import type { CardRow, GrammarPoint } from '../types';

const api = vi.hoisted(() => ({ loadGrammar: vi.fn(), saveProgress: vi.fn() }));
vi.mock('../lib/supabase', () => ({ ...api, supabase: { auth: {} }, errorMessage: (error: Error) => error.message }));
vi.mock('../lib/sound', () => ({ playSound: vi.fn(), setMusic: vi.fn() }));
const grammarRow = (id: string, ko: string, fr: string, book: string): CardRow => ({ id, category: 'grammar', word_type: null, ko, fr, book, lesson: null, short_form: null });
const rows = [grammarRow('g1', '-아요/어요', 'Style poli informel', 'CDC 초급'), grammarRow('g2', '-(으)세요', 'Impératif poli', 'CDC 초급'), grammarRow('g3', '-고 싶다', 'Vouloir', 'CDC 초급'), grammarRow('g4', '-지만', 'Mais', 'Autre')];
const point = (id: string, ko: string, fr: string, extra: Partial<GrammarPoint>): GrammarPoint => ({ id, ko, fr, book: 'CDC 초급', bookLabel: null, lesson: null, cefr: null, conjType: null, section: null, examples: [], ...extra });
const points = [
  point('g1', '-아요/어요', 'Style poli informel', { section: 'Poli informel', lesson: 15, cefr: 'A2.1', conjType: '3', examples: [{ ko: '밥을 먹어요.', fr: 'Je mange.' }] }),
  point('g2', '-(으)세요', 'Impératif poli', { section: 'Poli informel', conjType: '2' }),
  point('g3', '-고 싶다', 'Vouloir', { section: 'Modalité' }),
  point('g4', '-지만', 'Mais', { book: 'Autre', lesson: 4 }),
];
const books = [{ code: 'Autre', label: 'Autre manuel' }, { code: 'CDC 초급', label: 'Cours de coréen – Niveau débutant' }];
function setup() {
  render(<Workspace user={{ id: 'grammar-user', email: 'test@example.test' } as User} books={books} initialRows={rows} initialStats={{}} admin={false} />);
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Grammaire' }));
}
beforeEach(() => { localStorage.clear(); history.replaceState(null, ''); api.loadGrammar.mockReset().mockResolvedValue(points); });
describe('grammar tab', () => {
  it('lists the default book by section with badges, filters by search and switches book', async () => {
    setup();
    expect(within(screen.getByRole('navigation')).getByRole('button', { current: 'page' }).textContent).toBe('Grammaire');
    expect(screen.getByText('Chargement de la grammaire…')).toBeDefined();
    const first = await screen.findByRole('button', { name: /-아요\/어요/ });
    expect(first.textContent).toContain('Ch. 15'); expect(first.textContent).toContain('A2.1'); expect(first.textContent).toContain('Voie 3');
    expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual(['Poli informel', 'Modalité']);
    expect(screen.queryByText('-지만')).toBeNull(); expect(document.body.textContent).not.toMatch(/null|undefined/);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'imperatif' } });
    expect(screen.queryByRole('button', { name: /-아요\/어요/ })).toBeNull(); expect(screen.getByRole('button', { name: /-\(으\)세요/ })).toBeDefined();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.getByText('Aucun point de grammaire ne correspond à ta recherche.')).toBeDefined();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Livre' }), { target: { value: 'Autre' } });
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Chapitre 4'); expect(localStorage.getItem('haru:grammar:book')).toBe('Autre');
  });
  it('opens a detail as a history entry, comes back with the back button and reviews the section', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /-아요\/어요/ }));
    expect(history.state).toEqual({ grammar: 'g1' });
    expect(screen.getByText('밥을 먹어요.')).toBeDefined(); expect(screen.getByText('Je mange.')).toBeDefined();
    expect(screen.getByText(/3 — 해 \/ 아 \/ 어 selon la dernière voyelle/)).toBeDefined();
    act(() => { history.replaceState(null, ''); window.dispatchEvent(new PopStateEvent('popstate', { state: null })); });
    fireEvent.click(screen.getByRole('button', { name: /-\(으\)세요/ }));
    expect(screen.getByText('Pas encore d’exemple pour ce point.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Réviser cette rubrique · 2 cartes' }));
    expect(screen.getByText('1 / 2')).toBeDefined();
  });
  it('reports a network failure and retries', async () => {
    api.loadGrammar.mockRejectedValueOnce(new Error('réseau indisponible'));
    setup();
    expect((await screen.findByRole('alert')).textContent).toContain('réseau indisponible');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /-아요\/어요/ })).toBeDefined());
  });
});
