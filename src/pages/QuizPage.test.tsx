import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuizPage } from './QuizPage';
import { buildCards } from '../lib/cards';
import type { QuizRun } from '../types';

const cards = buildCards([
  { id: '1', category: 'vocab', word_type: 'verb', ko: '먹다', fr: 'Manger', book: null, lesson: null, short_form: null },
  { id: '2', category: 'vocab', word_type: 'verb', ko: '마시다', fr: 'Boire', book: null, lesson: null, short_form: null },
]);
function setup(options: Partial<QuizRun> = {}) {
  const onAnswer = vi.fn(); const onOverride = vi.fn(); const onFinish = vi.fn();
  const run: QuizRun = { id: 1, cards, mode: 'type', timed: true, custom: false, ...options };
  render(<QuizPage run={run} onAnswer={onAnswer} onOverride={onOverride} onFinish={onFinish} />);
  return { onAnswer, onOverride, onFinish };
}
function answer(value: string) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }));
}
afterEach(() => vi.useRealTimers());
describe('quiz interactions', () => {
  it('records timed answers once, disallows overrides and freezes after the final answer', () => {
    vi.useFakeTimers(); let now = 1000; vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { onAnswer, onFinish } = setup();
    answer('먹다'); fireEvent.click(screen.getByRole('button', { name: /Carte suivante/ }));
    now = 11000; answer('incorrect');
    expect(screen.queryByRole('button', { name: 'J’avais bon' })).toBeNull();
    now = 21000; act(() => vi.advanceTimersByTime(100));
    expect(screen.getByRole('timer').textContent).toContain('0:10.0');
    fireEvent.click(screen.getByRole('button', { name: /Voir le résultat/ }));
    expect(onAnswer).toHaveBeenCalledTimes(2); expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0][0]).toMatchObject({ seconds: 10, completed: true });
  });
  it('supports training overrides using the pre-answer progress', () => {
    const { onOverride, onFinish } = setup({ cards: cards.slice(0, 1), timed: false });
    answer('typo'); fireEvent.click(screen.getByRole('button', { name: 'J’avais bon' }));
    expect(onOverride).toHaveBeenCalledWith('1', undefined);
    expect(onFinish.mock.calls[0][0].answers[0].ok).toBe(true);
  });
  it('does not submit blank answers and can skip a card', () => {
    const { onAnswer, onFinish } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' })); expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Je ne sais pas' }));
    expect(onAnswer).toHaveBeenCalledWith('1', false);
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }));
    expect(onFinish.mock.calls[0][0].completed).toBe(false);
  });
  it('supports flashcard keyboard controls and ignores held keys', () => {
    const { onAnswer, onFinish } = setup({ mode: 'flash', timed: false });
    fireEvent.keyDown(document, { key: ' ' }); fireEvent.keyDown(document, { key: '2', repeat: true });
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: '2' });
    fireEvent.click(screen.getByRole('button', { name: /Retourner la carte/ }));
    fireEvent.click(screen.getByRole('button', { name: /Je ne savais pas/ }));
    expect(onAnswer.mock.calls).toEqual([['1', true], ['2', false]]);
    expect(onFinish.mock.calls[0][0].completed).toBe(true);
  });
  it('flips on a card click and shows the Chinese cognate, with its pinyin only on demand', () => {
    const zh = buildCards([{ id: 'z', category: 'vocab', word_type: null, ko: '생선', fr: 'Poisson', book: null, lesson: null, short_form: null, zh_hanzi: '生鲜', zh_pinyin: 'shēngxiān', zh_note: 'En chinois : produits frais.' }]);
    const onSound = vi.fn();
    const view = render(<QuizPage run={{ id: 1, cards: zh, mode: 'flash', timed: false, custom: false }} onAnswer={() => undefined} onOverride={() => {}} onFinish={() => {}} onSound={onSound} />);
    expect(screen.queryByRole('button', { name: '生鲜' })).toBeNull();
    fireEvent.click(view.container.querySelector('.card')!);
    expect(onSound).toHaveBeenCalledExactlyOnceWith('flip'); expect(screen.queryByText('shēngxiān')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '生鲜' }));
    expect(screen.getByText('shēngxiān')).toBeDefined(); expect(screen.getByText('En chinois : produits frais.')).toBeDefined(); expect(onSound).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByText('shēngxiān')).toBeNull();
  });
  it('offers four choices in multiple-choice mode, marks a wrong pick and waits before the next card', () => {
    const pool = buildCards(['먹다', '마시다', '가다', '오다', '자다', '보다'].map((ko, index) => ({ id: String(index + 1), category: 'vocab' as const, word_type: 'verb' as const, ko, fr: `Verbe ${index + 1}`, book: null, lesson: null, short_form: null })));
    const onAnswer = vi.fn(); const onFinish = vi.fn();
    const view = render(<QuizPage run={{ id: 1, cards: pool.slice(0, 2), mode: 'mcq', timed: false, custom: false }} pool={pool} onAnswer={onAnswer} onOverride={() => {}} onFinish={onFinish} />);
    const choices = () => [...view.container.querySelectorAll<HTMLButtonElement>('.choice')];
    expect(choices()).toHaveLength(4); expect(choices().filter(choice => choice.textContent!.endsWith('먹다'))).toHaveLength(1);
    fireEvent.click(view.container.querySelector('.card')!); expect(view.container.querySelector('.card.flipped')).toBeNull();
    const wrong = choices().find(choice => !choice.textContent!.endsWith('먹다'))!;
    fireEvent.click(wrong);
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith('1', false); expect(view.container.querySelector('.card.flipped')).not.toBeNull();
    expect(view.container.querySelector('.verdict')).toBeNull(); expect(view.container.querySelector('.yours')).toBeNull();
    expect(wrong.className).toContain('bad'); expect(choices().find(choice => choice.textContent!.endsWith('먹다'))!.className).toContain('good');
    fireEvent.click(wrong); fireEvent.keyDown(document, { key: '1' }); expect(onAnswer).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Carte suivante/ }));
    expect(screen.getByText('2 / 2')).toBeDefined(); expect(view.container.querySelector('.card.flipped')).toBeNull();
    fireEvent.keyDown(document, { key: String(choices().findIndex(choice => choice.textContent!.endsWith('마시다')) + 1) });
    expect(onAnswer).toHaveBeenLastCalledWith('2', true); expect(view.container.querySelector('.verdict')).toBeNull();
    expect(choices().find(choice => choice.textContent!.endsWith('마시다'))!.className).toContain('good'); expect(view.container.querySelector('.choice.bad')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Voir le résultat/ }));
    expect(onFinish.mock.calls[0][0].answers.map((answer: { ok: boolean }) => answer.ok)).toEqual([false, true]);
  });
  it('gives ten seconds per question in a timed multiple-choice run, ticking through the last five', () => {
    vi.useFakeTimers(); let now = 1000; vi.spyOn(performance, 'now').mockImplementation(() => now);
    const pool = buildCards(['먹다', '마시다', '가다', '오다'].map((ko, index) => ({ id: String(index + 1), category: 'vocab' as const, word_type: 'verb' as const, ko, fr: `Verbe ${index + 1}`, book: null, lesson: null, short_form: null })));
    const onAnswer = vi.fn(); const onSound = vi.fn();
    const view = render(<QuizPage run={{ id: 1, cards: pool.slice(0, 2), mode: 'mcq', timed: true, custom: false }} pool={pool} onAnswer={onAnswer} onOverride={() => {}} onFinish={() => {}} onSound={onSound} />);
    const countdown = () => screen.getByRole('timer', { name: 'Temps restant pour cette question' }).textContent;
    const at = (time: number) => { now = time; act(() => vi.advanceTimersByTime(100)); };
    expect(countdown()).toBe('10 s');
    at(5900); expect(countdown()).toBe('6 s'); expect(onSound).not.toHaveBeenCalled();
    at(6100); expect(countdown()).toBe('5 s'); expect(onSound).toHaveBeenCalledExactlyOnceWith('tick');
    act(() => vi.advanceTimersByTime(300)); expect(onSound).toHaveBeenCalledTimes(1);
    at(9500); expect(countdown()).toBe('2 s'); expect(onSound).toHaveBeenCalledTimes(2);
    at(11000); expect(onAnswer).toHaveBeenCalledExactlyOnceWith('1', false); expect(screen.getByText('Temps écoulé')).toBeDefined(); expect(countdown()).toBe('0 s');
    at(15000); expect(onAnswer).toHaveBeenCalledTimes(1); expect(onSound).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('timer', { name: 'Temps écoulé' }).textContent).toContain('0:10.0');
    fireEvent.click(screen.getByRole('button', { name: /Carte suivante/ })); expect(countdown()).toBe('10 s');
    at(17000); fireEvent.click([...view.container.querySelectorAll('.choice')].find(choice => choice.textContent!.endsWith('마시다'))!);
    expect(onAnswer).toHaveBeenLastCalledWith('2', true); expect(countdown()).toBe('8 s');
    at(30000); expect(onAnswer).toHaveBeenCalledTimes(2); expect(screen.getByRole('timer', { name: 'Temps écoulé' }).textContent).toContain('0:12.0');
  });
  it('excludes time spent reading every answer, resumes cumulatively and saves only answering time', () => {
    vi.useFakeTimers(); let now = 1000; vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { onFinish } = setup();
    const at = (time: number) => { now = time; act(() => vi.advanceTimersByTime(100)); };
    at(3500); answer('incorrect');
    expect(screen.getByRole('timer').textContent).toContain('0:02.5');
    expect(screen.getByText('En pause')).toBeDefined();
    at(63500); expect(screen.getByRole('timer').textContent).toContain('0:02.5');
    fireEvent.click(screen.getByRole('button', { name: /Carte suivante/ }));
    expect(screen.queryByText('En pause')).toBeNull();
    at(65000); expect(screen.getByRole('timer').textContent).toContain('0:04.0');
    answer('마시다');
    at(90000); fireEvent.click(screen.getByRole('button', { name: /Voir le résultat/ }));
    expect(onFinish.mock.calls[0][0]).toMatchObject({ seconds: 4, completed: true });
  });
  it('does not double-count settings opened while reading an answer, including early finish', () => {
    vi.useFakeTimers(); let now = 1000; vi.spyOn(performance, 'now').mockImplementation(() => now);
    const onFinish = vi.fn();
    const props = { run: { id: 1, cards, mode: 'type' as const, timed: true, custom: false }, onAnswer: vi.fn(), onOverride: vi.fn(), onFinish };
    const view = render(<QuizPage {...props} />);
    now = 3000; answer('먹다');
    now = 5000; view.rerender(<QuizPage {...props} paused />);
    now = 65000; view.rerender(<QuizPage {...props} />);
    expect(screen.getByRole('timer').textContent).toContain('0:02.0');
    now = 70000; fireEvent.click(screen.getByRole('button', { name: /Carte suivante/ }));
    now = 73000; act(() => vi.advanceTimersByTime(100));
    expect(screen.getByRole('timer').textContent).toContain('0:05.0');
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }));
    expect(onFinish.mock.calls[0][0]).toMatchObject({ seconds: 5, completed: false });
  });
  it('asks the Korean word and expects its French meaning when the direction is reversed', () => {
    const { onAnswer } = setup({ direction: 'ko-fr', timed: false });
    expect(document.querySelector('.front .ko')!.textContent).toBe('먹다');
    expect(screen.getByRole('textbox', { name: 'Ta réponse en français' })).toBeDefined();
    answer('manger'); expect(onAnswer).toHaveBeenLastCalledWith('1', true);
    fireEvent.click(screen.getByRole('button', { name: /Carte suivante/ }));
    answer('먹다'); expect(onAnswer).toHaveBeenLastCalledWith('2', false);
  });
  it('offers French choices in a reversed multiple-choice run', () => {
    const pool = buildCards(['먹다', '마시다', '가다', '오다', '자다'].map((ko, index) => ({ id: String(index + 1), category: 'vocab' as const, word_type: 'verb' as const, ko, fr: `Verbe ${index + 1}`, book: null, lesson: null, short_form: null })));
    const onAnswer = vi.fn();
    const view = render(<QuizPage run={{ id: 1, cards: pool.slice(0, 1), mode: 'mcq', timed: false, custom: false, direction: 'ko-fr' }} pool={pool} onAnswer={onAnswer} onOverride={() => {}} onFinish={() => {}} />);
    const choices = [...view.container.querySelectorAll<HTMLButtonElement>('.choice')];
    expect(choices).toHaveLength(4); expect(choices.every(choice => /Verbe \d$/.test(choice.textContent!))).toBe(true);
    fireEvent.click(choices.find(choice => choice.textContent!.endsWith('Verbe 1'))!);
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith('1', true);
  });
  it('cleans up its timer when navigating away', () => {
    vi.useFakeTimers();
    const intervals = vi.spyOn(globalThis, 'setInterval');
    const clear = vi.spyOn(globalThis, 'clearInterval');
    const view = render(<QuizPage run={{ id: 1, cards, mode: 'type', timed: true, custom: false }} onAnswer={() => undefined} onOverride={() => {}} onFinish={() => {}} />);
    const handle = intervals.mock.results[0].value;
    view.unmount(); expect(clear).toHaveBeenCalledWith(handle);
  });
});
