import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { Workspace } from './Workspace';
import type { CardRow, Progress, Stats } from './types';

const api = vi.hoisted(() => ({ sendAnswer: vi.fn(), unmasterCard: vi.fn() }));
vi.mock('./lib/supabase', () => ({ ...api, supabase: { auth: {} }, errorMessage: (error: Error) => error.message }));
vi.mock('./lib/sound', () => ({ playSound: vi.fn(), setMusic: vi.fn() }));
const rows: CardRow[] = [
  { id: '1', category: 'vocab', word_type: null, ko: '학교', fr: 'École', book: null, lesson: null, short_form: null },
  { id: '2', category: 'vocab', word_type: null, ko: '병원', fr: 'Hôpital', book: null, lesson: null, short_form: null },
];
const stat = (score: number, masteredAt: string | null = null): Progress => ({ right: score, wrong: 0, streak: score, last: 100, score, masteredAt });
function setup(stats: Stats) { render(<Workspace user={{ id: 'mastery-user', email: 'test@example.test' } as User} books={[]} initialRows={rows} initialStats={stats} admin={false} />); }
function go(name: string) { fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name })); }
beforeEach(() => { localStorage.clear(); api.sendAnswer.mockReset(); api.unmasterCard.mockReset(); vi.spyOn(window, 'confirm').mockReturnValue(true); });
describe('mastered words', () => {
  it('leaves mastered words out of a normal series and offers them in review', () => {
    setup({ '2': stat(10, '2026-10-01T00:00:00Z') });
    expect(screen.getByRole('button', { name: 'Commencer · 1 cartes' })).toBeDefined();
    fireEvent.click(screen.getByRole('checkbox', { name: /Réviser les appris \(1\)/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Commencer · 1 cartes' }));
    expect(document.querySelector('.front .fr')!.textContent).toBe('Hôpital');
  });
  it('explains an empty selection instead of starting an empty series', () => {
    setup({ '1': stat(10, '2026-10-01T00:00:00Z'), '2': stat(10, '2026-10-01T00:00:00Z') });
    expect(screen.getByText(/Tous les mots de cette sélection sont appris/)).toBeDefined();
    expect((screen.getByRole('button', { name: 'Commencer · 0 cartes' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('shows scores in the word list, filters by status and unmasters after confirmation', async () => {
    api.unmasterCard.mockResolvedValue(stat(0));
    setup({ '1': stat(7), '2': stat(10, '2026-10-01T00:00:00Z') });
    go('Mes mots');
    expect(screen.getByText('7/10')).toBeDefined(); expect(screen.getByText('10/10')).toBeDefined();
    fireEvent.change(screen.getByRole('combobox', { name: 'Statut' }), { target: { value: 'mastered' } });
    expect(screen.queryByText('École')).toBeNull(); expect(screen.getByText('Hôpital')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Appris, cliquer pour retirer' }));
    expect(window.confirm).toHaveBeenCalledWith('Retirer ce mot des mots appris ? Son score repartira à 0.');
    await waitFor(() => expect(api.unmasterCard).toHaveBeenCalledWith('2'));
    await waitFor(() => expect(screen.queryByText('Hôpital')).toBeNull());
    fireEvent.change(screen.getByRole('combobox', { name: 'Statut' }), { target: { value: 'learning' } });
    expect(screen.getByText('0/10')).toBeDefined(); expect(screen.queryByRole('button', { name: 'Appris, cliquer pour retirer' })).toBeNull();
  });
  it('announces the words a series has just taught, from the row the database returns', async () => {
    api.sendAnswer.mockResolvedValue(stat(10, '2026-10-12T00:00:00Z'));
    setup({ '1': stat(9), '2': stat(10, '2026-10-01T00:00:00Z') });
    fireEvent.click(screen.getByRole('button', { name: 'Commencer · 1 cartes' }));
    fireEvent.keyDown(document, { key: ' ' }); fireEvent.keyDown(document, { key: '2' });
    await waitFor(() => expect(api.sendAnswer).toHaveBeenCalledExactlyOnceWith('1', true));
    expect((await screen.findByText(/1 mot appris/)).textContent).toBe('🎉 1 mot appris : 학교');
  });
  it('keeps an answer the network refused and sends it again with the next one', async () => {
    api.sendAnswer.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(stat(1));
    setup({});
    fireEvent.click(screen.getByRole('button', { name: 'Commencer · 2 cartes' }));
    fireEvent.keyDown(document, { key: ' ' }); fireEvent.keyDown(document, { key: '2' });
    expect((await screen.findByRole('alert')).textContent).toContain('Réponse non enregistrée');
    fireEvent.keyDown(document, { key: ' ' }); fireEvent.keyDown(document, { key: '2' });
    await waitFor(() => expect(api.sendAnswer).toHaveBeenCalledTimes(3));
    expect(api.sendAnswer.mock.calls[1]).toEqual(api.sendAnswer.mock.calls[0]);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
