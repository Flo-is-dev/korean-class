import { describe, expect, it, vi } from 'vitest';
import { buildCards, isError, normalize, recordAnswer } from './cards';
import { emptyGame, formatTime, rankScores, rewardSession, streakDays } from './game';
import { loadGame, loadSettings, saveGame } from './storage';
import { ProgressQueue } from './progress-queue';
import type { CardRow, Progress, QuizResult, Score } from '../types';

const row = (overrides: Partial<CardRow> = {}): CardRow => ({ id: '1', category: 'vocab', word_type: 'verb', fr: 'Manger', ko: '먹다', book: null, lesson: null, short_form: null, ...overrides });
function result(overrides: Partial<QuizResult> = {}): QuizResult {
  const cards = buildCards([row(), row({ id: '2', fr: 'Boire', ko: '마시다' })]);
  return { run: { id: 1, cards, mode: 'type', timed: true, custom: false }, answers: cards.map((card, index) => ({ card, ok: index === 0 })), seconds: 10, completed: true, ...overrides };
}

describe('cards and progress', () => {
  it('preserves raw rows while deduplicating cards and accepting alternate translations', () => {
    const rows = [row(), row({ id: '2' }), row({ id: '3', ko: '드시다' })];
    const cards = buildCards(rows);
    expect(rows).toHaveLength(3); expect(cards).toHaveLength(2);
    expect(cards[0].cat).toBe('verbs'); expect(cards[0].accepted.has('드시다')).toBe(true);
    expect(cards[0].others).toEqual(['드시다']);
  });
  it('accepts native short forms and decomposed Hangul', () => {
    const card = buildCards([row({ category: 'numbers', word_type: null, ko: '하나', short_form: '한' })])[0];
    expect(card.accepted.has('한')).toBe(true);
    expect(normalize(' 먹다! '.normalize('NFD'))).toBe('먹다');
  });
  it('requires two consecutive correct answers to leave the error list', () => {
    const first = recordAnswer(undefined, false);
    const second = recordAnswer(first, true);
    expect(isError(second)).toBe(true);
    const third = recordAnswer(second, true);
    expect(isError(third)).toBe(false); expect(first.right).toBe(0);
  });
});
describe('chrono and rewards', () => {
  it('adds five seconds per error and preserves the existing game', () => {
    const game = emptyGame();
    const rewarded = rewardSession(game, result());
    expect(rewarded.game.scores[0]).toMatchObject({ seconds: 10, adjusted: 15, correct: 1, size: 2, cat: 'verbs', custom: false });
    expect(rewarded.game.xp).toBe(55); expect(game.xp).toBe(0); expect(game.scores).toHaveLength(0);
  });
  it('does not reward an interrupted run', () => {
    const game = emptyGame();
    expect(rewardSession(game, result({ completed: false })).game).toBe(game);
  });
  it('ranks accuracy first, then penalized time without changing input order', () => {
    const scores = [{ correct: 19, adjusted: 30 }, { correct: 20, adjusted: 80 }, { correct: 20, adjusted: 60 }] as Score[];
    expect(rankScores(scores).map(score => score.adjusted)).toEqual([60, 80, 30]);
    expect(scores[0].adjusted).toBe(30);
  });
  it('rounds timer values across minute boundaries', () => {
    expect(formatTime(59.99)).toBe('1:00.0'); expect(formatTime(0)).toBe('0:00.0');
  });
  it('keeps yesterday’s streak until today is complete, across month boundaries', () => {
    expect(streakDays(['2026-08-30', '2026-08-31'], new Date(2026, 8, 1, 12))).toBe(2);
    expect(streakDays(['2026-08-30'], new Date(2026, 8, 1, 12))).toBe(0);
  });
});
describe('legacy storage compatibility', () => {
  it('reads the original preference and account-specific game keys', () => {
    localStorage.setItem('cahier-coreen:prefs', JSON.stringify({ cats: ['verbs'], size: 20, mode: 'type' }));
    const game = rewardSession(emptyGame(), result()).game;
    saveGame('account-a', game);
    expect(loadSettings()).toMatchObject({ cats: ['verbs'], size: 20, mode: 'type' });
    expect(loadGame('account-a').xp).toBe(55); expect(loadGame('account-b').xp).toBe(0);
  });
  it('ignores corrupt fields and malformed JSON', () => {
    localStorage.setItem('haru:game:a', JSON.stringify({ xp: -1, days: 2, scores: [{ correct: 1 }], daily: { bad: 'value' } }));
    expect(loadGame('a')).toEqual(emptyGame());
    localStorage.setItem('cahier-coreen:prefs', '{');
    expect(loadSettings().cats).toEqual(['vocab']);
  });
});
describe('serialized progression writes', () => {
  const stat = (right: number): Progress => ({ right, wrong: 0, streak: right, last: 100 });
  it('retries failed writes without losing the latest answer', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const queue = new ProgressQueue(save);
    queue.set('1', stat(1)); expect(await queue.flush()).toBe(false); expect(queue.pending).toBe(true);
    queue.set('1', stat(2)); expect(await queue.flush()).toBe(true);
    expect(save.mock.calls[1][0][0][1].right).toBe(2); expect(queue.pending).toBe(false);
  });
  it('retains an answer recorded while another save is pending', async () => {
    let release!: () => void;
    const save = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; })).mockResolvedValue(undefined);
    const queue = new ProgressQueue(save);
    queue.set('1', stat(1)); const first = queue.flush();
    await Promise.resolve(); queue.set('1', stat(2)); release(); await first;
    expect(queue.pending).toBe(true); await queue.flush();
    expect(save.mock.calls[1][0][0][1].right).toBe(2); expect(queue.pending).toBe(false);
  });
});
