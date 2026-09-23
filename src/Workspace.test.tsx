import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { Workspace } from './Workspace';
import type { CardRow } from './types';

const api = vi.hoisted(() => ({ deleteCards: vi.fn(), saveProgress: vi.fn(), signOut: vi.fn() }));
vi.mock('./lib/supabase', () => ({ ...api, supabase: { auth: { signOut: api.signOut } }, errorMessage: (error: Error) => error.message }));
vi.mock('./lib/sound', () => ({ playSound: vi.fn() }));
const rows: CardRow[] = [
  { id: '1', category: 'vocab', word_type: 'verb', ko: '먹다', fr: 'Manger', book: null, lesson: null, short_form: null },
  { id: '2', category: 'vocab', word_type: 'verb', ko: '마시다', fr: 'Boire', book: null, lesson: null, short_form: null },
  { id: '3', category: 'vocab', word_type: null, ko: '학교', fr: 'École', book: null, lesson: null, short_form: null },
  { id: '4', category: 'vocab', word_type: 'verb', ko: '먹다', fr: 'Manger', book: null, lesson: null, short_form: null },
];
function setup(admin = true) { return render(<StrictMode><Workspace user={{ id: 'test-user', email: 'test@example.test' } as User} books={[]} initialRows={rows} initialStats={{}} admin={admin} /></StrictMode>); }
function go(name: string) { fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name })); }
beforeEach(() => { api.deleteCards.mockReset().mockResolvedValue(['1', '4']); api.saveProgress.mockReset().mockResolvedValue(undefined); vi.spyOn(window, 'confirm').mockReturnValue(true); });
describe('React workspace', () => {
  it('preserves selection across accent-insensitive searches and category filters', () => {
    setup(); go('Mes mots');
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Sélectionner Manger' })[0]);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ecole' } });
    expect(screen.getByRole('checkbox', { name: 'Sélectionner École' })).toBeDefined();
    expect(screen.queryByRole('checkbox', { name: 'Sélectionner Manger' })).toBeNull();
    expect(screen.getByText('1 sélectionné(s)')).toBeDefined();
    fireEvent.click(screen.getByRole('checkbox', { name: /Tout sélectionner/ }));
    expect(screen.getByText('2 sélectionné(s)')).toBeDefined();
    go('Apprendre'); go('Mes mots'); expect(screen.getByText('2 sélectionné(s)')).toBeDefined();
  });
  it('supports confirmed bulk deletion and refreshes catalogue counts', async () => {
    setup(); go('Mes mots');
    screen.getAllByRole('checkbox', { name: 'Sélectionner Manger' }).forEach(box => fireEvent.click(box));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la sélection' }));
    await waitFor(() => expect(api.deleteCards).toHaveBeenCalledWith(['1', '4']));
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Sélectionner Manger' })).toBeNull());
    expect(screen.getByText('0 sélectionné(s)')).toBeDefined(); expect(screen.getByText(/2 mots affichés sur 2/)).toBeDefined();
  });
  it('does not delete if cancelled, and preserves selection after a server rejection', async () => {
    setup(); go('Mes mots'); fireEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner Boire' }));
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la sélection' })); expect(api.deleteCards).not.toHaveBeenCalled();
    api.deleteCards.mockRejectedValueOnce(new Error('RLS refusé'));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la sélection' }));
    await screen.findByText(/Suppression impossible : RLS refusé/);
    expect(screen.getByText('1 sélectionné(s)')).toBeDefined();
  });
  it('restricts deletion to administrators', () => {
    setup(false); go('Mes mots'); fireEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner Boire' }));
    expect((screen.getByRole('button', { name: 'Supprimer la sélection' }) as HTMLButtonElement).disabled).toBe(true);
    expect(api.deleteCards).not.toHaveBeenCalled();
  });
  it('runs a manually selected chrono and stores one score and one reward in StrictMode', async () => {
    setup(); go('Mes mots');
    screen.getAllByRole('checkbox', { name: 'Sélectionner Manger' }).forEach(box => fireEvent.click(box));
    fireEvent.click(screen.getByRole('button', { name: 'Chrono avec la sélection' }));
    expect(screen.getByText('1 / 1')).toBeDefined();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '먹다' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }));
    fireEvent.click(screen.getByRole('button', { name: /Voir le résultat/ }));
    await screen.findByText('Défi chrono terminé !');
    const game = JSON.parse(localStorage.getItem('haru:game:test-user')!);
    expect(game.xp).toBe(55); expect(game.scores).toHaveLength(1); expect(game.scores[0].custom).toBe(true);
    await waitFor(() => expect(api.saveProgress).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Voir mes records' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Séries' }), { target: { value: 'custom' } });
    expect(screen.getByText('Verbes · 1 mots')).toBeDefined();
  });
  it('reports local storage failure while still showing results', async () => {
    setup(); go('Chrono');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    fireEvent.click(screen.getByRole('button', { name: 'C’est parti · 2 mots' }));
    fireEvent.click(screen.getByRole('button', { name: 'Je ne sais pas' }));
    fireEvent.click(screen.getByRole('button', { name: /Carte suivante/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Je ne sais pas' }));
    fireEvent.click(screen.getByRole('button', { name: /Voir le résultat/ }));
    await screen.findByText(/Stockage du navigateur indisponible/);
    expect(screen.getByText('Défi chrono terminé !')).toBeDefined();
  });
});
