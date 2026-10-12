import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { Workspace } from './Workspace';
import { setMusic } from './lib/sound';
import { AppearanceProvider } from './components/AppearanceSettings';
import type { CardRow } from './types';

const api = vi.hoisted(() => ({ deleteCards: vi.fn(), sendAnswer: vi.fn(), unmasterCard: vi.fn(), signOut: vi.fn() }));
vi.mock('./lib/supabase', () => ({ ...api, supabase: { auth: { signOut: api.signOut } }, errorMessage: (error: Error) => error.message }));
vi.mock('./lib/sound', () => ({ playSound: vi.fn(), setMusic: vi.fn() }));
const rows: CardRow[] = [
  { id: '1', category: 'vocab', word_type: 'verb', ko: '먹다', fr: 'Manger', book: null, lesson: null, short_form: null },
  { id: '2', category: 'vocab', word_type: 'verb', ko: '마시다', fr: 'Boire', book: null, lesson: null, short_form: null },
  { id: '3', category: 'vocab', word_type: null, ko: '학교', fr: 'École', book: null, lesson: null, short_form: null },
  { id: '4', category: 'vocab', word_type: 'verb', ko: '먹다', fr: 'Manger', book: null, lesson: null, short_form: null },
];
function setup(admin = true) { return render(<StrictMode><Workspace user={{ id: 'test-user', email: 'test@example.test' } as User} books={[]} initialRows={rows} initialStats={{}} admin={admin} /></StrictMode>); }
function go(name: string) { fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name })); }
beforeEach(() => { api.deleteCards.mockReset().mockResolvedValue(['1', '4']); api.sendAnswer.mockReset().mockResolvedValue({ right: 1, wrong: 0, streak: 1, last: 100, score: 1, masteredAt: null }); vi.spyOn(window, 'confirm').mockReturnValue(true); });
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
  it('opens settings and sign-out on their own page from the user button, away from the other pages', async () => {
    api.signOut.mockResolvedValue({ error: null });
    render(<AppearanceProvider userId={null}><Workspace user={{ id: 'test-user', email: 'test@example.test' } as User} books={[]} initialRows={rows} initialStats={{}} admin /></AppearanceProvider>);
    expect(screen.queryByRole('switch', { name: 'Mode sombre' })).toBeNull(); expect(screen.queryByRole('button', { name: 'Se déconnecter' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    expect(screen.getByRole('heading', { name: 'Préférences' })).toBeDefined(); expect(screen.getByRole('switch', { name: 'Mode sombre' })).toBeDefined();
    expect(screen.getByText('test@example.test')).toBeDefined(); expect(within(screen.getByRole('navigation')).queryByRole('button', { current: 'page' })).toBeNull();
    go('Apprendre'); expect(screen.queryByRole('switch', { name: 'Mode sombre' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Réglages' })); fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    await waitFor(() => expect(api.signOut).toHaveBeenCalled());
  });
  it('opens the settings in the middle of a chrono without ending it, and pauses both clocks meanwhile', () => {
    vi.useFakeTimers(); let now = 1000; vi.spyOn(performance, 'now').mockImplementation(() => now);
    const at = (time: number) => { now = time; act(() => vi.advanceTimersByTime(100)); };
    const clocks = () => [screen.getByRole('timer', { name: 'Temps écoulé' }).textContent, screen.getByRole('timer', { name: 'Temps restant pour cette question' }).textContent];
    render(<AppearanceProvider userId={null}><Workspace user={{ id: 'test-user', email: 'test@example.test' } as User} books={[]} initialRows={rows} initialStats={{}} admin /></AppearanceProvider>);
    go('Chrono'); fireEvent.click(screen.getByRole('button', { name: 'C’est parti · 2 mots' }));
    at(4000); expect(clocks()).toEqual(['0:03.0', '7 s']);
    fireEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    expect(window.confirm).not.toHaveBeenCalled(); expect(screen.queryByRole('timer')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'Mode sombre' })); expect(document.documentElement.dataset.theme).toBe('dark');
    at(64000); fireEvent.keyDown(document, { key: '1' }); expect(api.sendAnswer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre la série' }));
    expect(screen.getByText('1 / 2')).toBeDefined(); expect(document.querySelector('.choice:disabled')).toBeNull();
    act(() => vi.advanceTimersByTime(100)); expect(clocks()).toEqual(['0:03.0', '7 s']);
    at(65000); expect(clocks()).toEqual(['0:04.0', '6 s']);
    fireEvent.click(screen.getByRole('button', { name: 'Réglages' })); fireEvent.click(screen.getByRole('switch', { name: 'Mode sombre' }));
    fireEvent.click(screen.getByRole('button', { name: 'Réglages' })); expect(screen.getByText('1 / 2')).toBeDefined();
    vi.useRealTimers();
  });
  it('picks categories from a compact multi-select that always keeps one selected', () => {
    setup();
    const trigger = screen.getByRole('button', { name: /^Catégories/ });
    expect(trigger.textContent).toBe('Vocabulaire1'); expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(trigger); fireEvent.click(screen.getByRole('option', { name: /Verbes/ }));
    expect(trigger.textContent).toBe('Vocabulaire, Verbes3'); expect(screen.getByRole('button', { name: 'Commencer · 3 cartes' })).toBeDefined();
    fireEvent.click(screen.getByRole('option', { name: /Vocabulaire/ })); fireEvent.click(screen.getByRole('option', { name: /Verbes/ }));
    expect(screen.getByRole('option', { name: /Verbes/ }).getAttribute('aria-selected')).toBe('true'); expect(screen.getByRole('button', { name: 'Commencer · 2 cartes' })).toBeDefined();
    fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('listbox')).toBeNull(); expect(trigger.textContent).toBe('Verbes2');
  });
  it('shows the level in the header, only the three scores in the game bar, and the sound switch in settings', () => {
    const view = render(<AppearanceProvider userId={null}><Workspace user={{ id: 'test-user', email: 'test@example.test' } as User} books={[]} initialRows={rows} initialStats={{}} admin /></AppearanceProvider>);
    expect(within(screen.getByRole('banner')).getByText('Niveau 1 · 200 XP avant le suivant')).toBeDefined();
    expect([...view.container.querySelector('.game-bar')!.children].map(child => child.textContent)).toEqual(['0 XP', '0 jours', '0/20 aujourd’hui']);
    expect(screen.queryByRole('switch', { name: 'Sons' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    const saved = () => JSON.parse(localStorage.getItem('haru:game:test-user')!);
    expect(screen.getByRole('switch', { name: 'Sons' }).getAttribute('aria-checked')).toBe('true'); expect(vi.mocked(setMusic)).toHaveBeenLastCalledWith('calm');
    fireEvent.click(screen.getByRole('button', { name: 'Coréenne' }));
    expect(saved().track).toBe('korean'); expect(vi.mocked(setMusic)).toHaveBeenLastCalledWith('korean'); expect(screen.getByRole('button', { name: 'Coréenne' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('switch', { name: 'Musique d’ambiance' }));
    expect(saved()).toMatchObject({ sound: true, effects: true, music: false }); expect(vi.mocked(setMusic)).toHaveBeenLastCalledWith(null);
    expect((screen.getByRole('button', { name: 'Rythmée' }) as HTMLButtonElement).matches(':disabled')).toBe(true);
    fireEvent.click(screen.getByRole('switch', { name: 'Musique d’ambiance' })); expect(vi.mocked(setMusic)).toHaveBeenLastCalledWith('korean');
    fireEvent.click(screen.getByRole('switch', { name: 'Sons' }));
    expect(screen.getByRole('switch', { name: 'Sons' }).getAttribute('aria-checked')).toBe('false'); expect(screen.getByText('Tout est coupé')).toBeDefined();
    expect(saved()).toMatchObject({ sound: false, effects: true, music: true, track: 'korean' }); expect(vi.mocked(setMusic)).toHaveBeenLastCalledWith(null);
    for (const name of ['Effets sonores', 'Musique d’ambiance']) expect(screen.getByRole('switch', { name })).toMatchObject({ disabled: true, ariaChecked: 'false' });
  });
  it('lists the Chinese cognate with its pinyin next to the Korean word', () => {
    render(<Workspace user={{ id: 'test-user', email: 'test@example.test' } as User} books={[]} initialRows={[{ ...rows[2], zh_hanzi: '学校', zh_pinyin: 'xuéxiào', zh_note: 'Même mot qu’en coréen.' }, rows[1]]} initialStats={{}} admin />);
    go('Mes mots');
    expect(screen.getAllByRole('button', { name: '学校' })).toHaveLength(1); expect(screen.getByText('xuéxiào')).toBeDefined(); expect(screen.queryByText('Même mot qu’en coréen.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '学校' })); expect(screen.getByText('Même mot qu’en coréen.')).toBeDefined();
    expect((screen.getByRole('checkbox', { name: 'Sélectionner École' }) as HTMLInputElement).checked).toBe(false);
  });
  it('runs a manually selected chrono and stores one score and one reward in StrictMode', async () => {
    setup(); go('Mes mots');
    screen.getAllByRole('checkbox', { name: 'Sélectionner Manger' }).forEach(box => fireEvent.click(box));
    fireEvent.click(screen.getByRole('button', { name: 'Chrono avec la sélection' }));
    expect(screen.getByText('1 / 1')).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull(); expect(screen.getByRole('timer', { name: 'Temps restant pour cette question' }).textContent).toBe('10 s');
    fireEvent.click(screen.getByRole('button', { name: /먹다$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Voir le résultat/ }));
    await screen.findByText('Défi chrono terminé !');
    const game = JSON.parse(localStorage.getItem('haru:game:test-user')!);
    expect(game.xp).toBe(55); expect(game.scores).toHaveLength(1); expect(game.scores[0].custom).toBe(true);
    await waitFor(() => expect(api.sendAnswer).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Voir mes records' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Séries' }), { target: { value: 'custom' } });
    expect(screen.getByText('Verbes · 1 mots')).toBeDefined();
  });
  it('reports local storage failure while still showing results', async () => {
    setup(); go('Chrono');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    fireEvent.click(screen.getByRole('button', { name: 'C’est parti · 2 mots' }));
    fireEvent.click(document.querySelector('.choice')!);
    fireEvent.click(screen.getByRole('button', { name: /Carte suivante/ }));
    fireEvent.click(document.querySelector('.choice')!);
    fireEvent.click(screen.getByRole('button', { name: /Voir le résultat/ }));
    await screen.findByText(/Stockage du navigateur indisponible/);
    expect(screen.getByText('Défi chrono terminé !')).toBeDefined();
  });
});
