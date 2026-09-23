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
  it('cleans up its timer when navigating away', () => {
    vi.useFakeTimers();
    const intervals = vi.spyOn(globalThis, 'setInterval');
    const clear = vi.spyOn(globalThis, 'clearInterval');
    const view = render(<QuizPage run={{ id: 1, cards, mode: 'type', timed: true, custom: false }} onAnswer={() => undefined} onOverride={() => {}} onFinish={() => {}} />);
    const handle = intervals.mock.results[0].value;
    view.unmount(); expect(clear).toHaveBeenCalledWith(handle);
  });
});
