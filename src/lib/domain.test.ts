import { describe, expect, it, vi } from 'vitest';
import { buildCards, cardPool, choicesFor, isError, normalize } from './cards';
import { emptyGame, formatTime, rankScores, rewardSession, streakDays } from './game';
import { loadGame, loadSettings, saveGame } from './storage';
import { AnswerQueue } from './progress-queue';
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
  it('builds unique multiple-choice options from the same category, never offering another accepted answer', () => {
    const cards = buildCards([row(), row({ id: '2', ko: '드시다' }), row({ id: '3', fr: 'Boire', ko: '마시다' }), row({ id: '4', fr: 'Aller', ko: '가다' }), row({ id: '5', fr: 'Venir', ko: '오다' }), row({ id: '6', fr: 'Dormir', ko: '자다' }), row({ id: '7', category: 'colors', word_type: null, fr: 'Rouge', ko: '빨간색' })]);
    for (let attempt = 0; attempt < 25; attempt++) {
      const choices = choicesFor(cards[0], cards);
      expect(choices).toHaveLength(4); expect(new Set(choices).size).toBe(4); expect(choices).toContain('먹다');
      expect(choices).not.toContain('드시다'); expect(choices).not.toContain('빨간색');
    }
    expect(choicesFor(cards[0], cards.slice(0, 3)).sort()).toEqual(['마시다', '먹다']);
    expect(choicesFor(cards[6], cards)).toHaveLength(4);
  });
  it('requires two consecutive correct answers to leave the error list', () => {
    const stat = (streak: number): Progress => ({ right: streak, wrong: 1, streak, last: 100 });
    expect(isError(stat(0))).toBe(true); expect(isError(stat(1))).toBe(true); expect(isError(stat(2))).toBe(false); expect(isError(undefined)).toBe(false);
  });
  it('keeps mastered words out of the normal pool and draws only them in review', () => {
    const cards = buildCards([row(), row({ id: '2', fr: 'Boire', ko: '마시다' })]);
    const stats = { '2': { right: 10, wrong: 0, streak: 10, last: 100, score: 10, masteredAt: '2026-10-01T00:00:00Z' } };
    const settings = { ...loadSettings(), cats: ['verbs' as const] };
    expect(cardPool(cards, settings, stats).map(card => card.id)).toEqual(['1']);
    expect(cardPool(cards, { ...settings, mastered: true }, stats).map(card => card.id)).toEqual(['2']);
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
    localStorage.setItem('cahier-coreen:prefs', JSON.stringify({ mode: 'mcq' })); expect(loadSettings().mode).toBe('mcq');
    localStorage.setItem('cahier-coreen:prefs', JSON.stringify({ mode: 'other' })); expect(loadSettings().mode).toBe('flash');
  });
  it('ignores corrupt fields and malformed JSON', () => {
    localStorage.setItem('haru:game:a', JSON.stringify({ xp: -1, days: 2, scores: [{ correct: 1 }], daily: { bad: 'value' } }));
    expect(loadGame('a')).toEqual(emptyGame());
    localStorage.setItem('cahier-coreen:prefs', '{');
    expect(loadSettings().cats).toEqual(['vocab']);
  });
});
describe('answer queue', () => {
  it('keeps a failed answer and sends it again, in order, with the next one', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const queue = new AnswerQueue(send);
    queue.add({ id: '1', ok: true }); expect(await queue.drain()).toBe(false); expect(queue.pending).toBe(true);
    queue.add({ id: '2', ok: false }); expect(await queue.drain()).toBe(true);
    expect(send.mock.calls.map(call => call[0])).toEqual([{ id: '1', ok: true }, { id: '1', ok: true }, { id: '2', ok: false }]); expect(queue.pending).toBe(false);
  });
  it('holds a rejected answer until it is corrected or the learner moves on', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const queue = new AnswerQueue(send);
    queue.add({ id: '1', ok: false }, true); await queue.drain(); expect(send).not.toHaveBeenCalled(); expect(queue.pending).toBe(true);
    expect(queue.correctHeld('1')).toBe(true);
    queue.add({ id: '2', ok: false }, true); await queue.drain(); expect(send.mock.calls.map(call => call[0])).toEqual([{ id: '1', ok: true }]);
    expect(queue.correctHeld('1')).toBe(false); await queue.flush();
    expect(send).toHaveBeenLastCalledWith({ id: '2', ok: false }); expect(queue.pending).toBe(false);
  });
});
