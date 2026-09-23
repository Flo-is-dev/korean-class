import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { AppearanceProvider, AppearanceSettings } from './AppearanceSettings';
import { APPEARANCE_KEY, readLocalAppearance, writeLocalAppearance } from '../lib/appearance';
import type { Appearance } from '../lib/appearance';
import { QuizPage } from '../pages/QuizPage';
import { buildCards } from '../lib/cards';

const api = vi.hoisted(() => ({ loadAppearance: vi.fn(), saveAppearance: vi.fn() }));
vi.mock('../lib/appearance-api', () => api);
const defaults: Appearance = { ko_font: 'standard', theme: 'light' };
async function setup(userId: string | null = null) {
  const view = render(<AppearanceProvider key={userId} userId={userId}><AppearanceSettings /></AppearanceProvider>);
  await act(async () => {});
  fireEvent.click(screen.getByText('Réglages'));
  return view;
}
beforeEach(() => {
  api.loadAppearance.mockReset().mockResolvedValue(defaults);
  api.saveAppearance.mockReset().mockResolvedValue(undefined);
});
afterEach(() => { vi.useRealTimers(); document.documentElement.dataset.theme = 'light'; document.documentElement.dataset.koFont = 'standard'; });

describe('appearance settings', () => {
  it('applies the local cache in the head, before the React module', () => {
    const html = readFileSync('index.html', 'utf8');
    const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)![1];
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ ko_font: 'handwritten', theme: 'dark' }));
    Function(bootstrap)();
    expect(document.documentElement.dataset).toMatchObject({ theme: 'dark', koFont: 'handwritten' });
    expect(html.indexOf(bootstrap)).toBeLessThan(html.indexOf('type="module"'));
    expect((html.match(/href="https:\/\/fonts.googleapis.com\/css2/g) ?? []).length).toBe(1);
  });
  it('uses safe defaults if local storage contains invalid values or cannot be read', () => {
    localStorage.setItem(APPEARANCE_KEY, '{'); expect(readLocalAppearance()).toEqual(defaults);
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ ko_font: 'invalid', theme: 'auto' })); expect(readLocalAppearance()).toEqual(defaults);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readLocalAppearance()).toEqual(defaults);
    expect(() => Function(readFileSync('index.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)![1])()).not.toThrow();
  });
  it('applies radio and switch changes immediately for guests without network writes', async () => {
    await setup();
    fireEvent.click(screen.getByRole('radio', { name: /Carrée/ }));
    fireEvent.click(screen.getByRole('switch', { name: 'Mode sombre' }));
    expect(document.documentElement.dataset).toMatchObject({ koFont: 'square', theme: 'dark' });
    expect(readLocalAppearance()).toEqual({ ko_font: 'square', theme: 'dark' });
    expect(api.loadAppearance).not.toHaveBeenCalled(); expect(api.saveAppearance).not.toHaveBeenCalled();
  });
  it('uses the server row after login and updates the local cache without writing back', async () => {
    writeLocalAppearance({ ko_font: 'handwritten', theme: 'dark' });
    api.loadAppearance.mockResolvedValue({ ko_font: 'square', theme: 'light' });
    await setup('user-a');
    expect(readLocalAppearance()).toEqual({ ko_font: 'square', theme: 'light' });
    expect(document.documentElement.dataset).toMatchObject({ koFont: 'square', theme: 'light' });
    expect(api.saveAppearance).not.toHaveBeenCalled();
  });
  it('debounces rapid changes into one complete save after 500 ms', async () => {
    vi.useFakeTimers(); await setup('user-a');
    fireEvent.click(screen.getByRole('radio', { name: /Carrée/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Manuscrite/ }));
    fireEvent.click(screen.getByRole('switch', { name: 'Mode sombre' }));
    await act(async () => vi.advanceTimersByTime(499)); expect(api.saveAppearance).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(api.saveAppearance).toHaveBeenCalledExactlyOnceWith('user-a', { ko_font: 'handwritten', theme: 'dark' });
  });
  it('retains applied settings after a save failure and clears the message on a successful subsequent change', async () => {
    vi.useFakeTimers(); api.saveAppearance.mockRejectedValueOnce(new Error('offline')); await setup('user-a');
    fireEvent.click(screen.getByRole('switch', { name: 'Mode sombre' }));
    await act(async () => vi.advanceTimersByTime(500));
    expect(screen.getByText('Réglage non synchronisé')).toBeDefined(); expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.click(screen.getByRole('radio', { name: /Carrée/ }));
    await act(async () => vi.advanceTimersByTime(500));
    expect(screen.queryByText('Réglage non synchronisé')).toBeNull();
  });
  it('serializes writes to prevent an older request overwriting the latest choice', async () => {
    vi.useFakeTimers(); let release!: () => void;
    api.saveAppearance.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    await setup('user-a'); fireEvent.click(screen.getByRole('radio', { name: /Carrée/ }));
    await act(async () => vi.advanceTimersByTime(500));
    fireEvent.click(screen.getByRole('radio', { name: /Manuscrite/ }));
    await act(async () => vi.advanceTimersByTime(500)); expect(api.saveAppearance).toHaveBeenCalledTimes(1);
    await act(async () => release()); expect(api.saveAppearance).toHaveBeenLastCalledWith('user-a', { ko_font: 'handwritten', theme: 'light' });
  });
  it('ignores a late response for an account that has been unmounted', async () => {
    let release!: (value: Appearance) => void;
    api.loadAppearance.mockImplementationOnce(() => new Promise<Appearance>(resolve => { release = resolve; }));
    const view = await setup('user-a'); view.unmount();
    await setup('user-b'); await act(async () => release({ ko_font: 'handwritten', theme: 'dark' }));
    expect(document.documentElement.dataset).toMatchObject({ theme: 'light', koFont: 'standard' });
  });
  it('preserves unrelated settings fields in the shared local cache', () => {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ ui_lang: 'ko' }));
    writeLocalAppearance({ ko_font: 'square', theme: 'dark' });
    expect(JSON.parse(localStorage.getItem(APPEARANCE_KEY)!)).toEqual({ ui_lang: 'ko', ko_font: 'square', theme: 'dark' });
  });
  it('keeps applying changes when local storage cannot be written', async () => {
    await setup(); vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    fireEvent.click(screen.getByRole('switch', { name: 'Mode sombre' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
  it('does not let settings keyboard interactions trigger flashcard shortcuts', async () => {
    const cards = buildCards([{ id: '1', category: 'vocab', word_type: null, ko: '학교', fr: 'École', book: null, lesson: null, short_form: null }]);
    const onAnswer = vi.fn();
    render(<AppearanceProvider userId={null}><QuizPage run={{ id: 1, cards, mode: 'flash', timed: false, custom: false }} onAnswer={onAnswer} onOverride={() => {}} onFinish={() => {}} /><AppearanceSettings /></AppearanceProvider>);
    fireEvent.click(screen.getByText('Réglages'));
    fireEvent.keyDown(screen.getByRole('switch'), { key: ' ' });
    fireEvent.keyDown(screen.getByRole('radio', { name: /Carrée/ }), { key: '2' });
    expect(screen.getByRole('button', { name: /Retourner la carte/ })).toBeDefined();
    expect(onAnswer).not.toHaveBeenCalled();
  });
  it('does not reset a quiz or erase its input when changing appearance', async () => {
    const cards = buildCards([{ id: '1', category: 'vocab', word_type: null, ko: '학교', fr: 'École', book: null, lesson: null, short_form: null }]);
    const onAnswer = vi.fn();
    render(<AppearanceProvider userId={null}><QuizPage run={{ id: 1, cards, mode: 'type', timed: false, custom: false }} onAnswer={onAnswer} onOverride={() => {}} onFinish={() => {}} /><AppearanceSettings /></AppearanceProvider>);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '학' } });
    fireEvent.click(screen.getByText('Réglages')); fireEvent.click(screen.getByRole('radio', { name: /Manuscrite/ }));
    fireEvent.click(screen.getByRole('switch', { name: 'Mode sombre' }));
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('학'); expect(screen.getByText('1 / 1')).toBeDefined(); expect(onAnswer).not.toHaveBeenCalled();
  });
});
