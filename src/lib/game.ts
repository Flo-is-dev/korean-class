import type { Game, QuizResult, Score } from '../types';

export const today = () => new Date().toLocaleDateString('sv-SE');
export const emptyGame = (): Game => ({ xp: 0, days: [], scores: [], sound: true, daily: {} });
export function formatTime(seconds: number) {
  const tenths = Math.round(Math.max(0, seconds) * 10);
  return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`;
}
export function streakDays(days: string[], now = new Date()) {
  const dates = new Set(days);
  const day = new Date(now);
  if (!dates.has(day.toLocaleDateString('sv-SE'))) day.setDate(day.getDate() - 1);
  let count = 0;
  while (dates.has(day.toLocaleDateString('sv-SE'))) { count++; day.setDate(day.getDate() - 1); }
  return count;
}
export const rankScores = (scores: Score[]) => [...scores].sort((a, b) => b.correct - a.correct || a.adjusted - b.adjusted);
export function rewardSession(game: Game, result: QuizResult): { game: Game; reward: string } {
  if (!result.completed) return { game, reward: 'Série interrompue · pas de score classé ni de bonus XP.' };
  const correct = result.answers.filter(answer => answer.ok).length;
  const xp = correct * 10 + 20 + (result.run.timed ? 25 : 0);
  const daily = { ...game.daily, [today()]: (game.daily[today()] ?? 0) + correct };
  const next = { ...game, xp: game.xp + xp, days: [...new Set([...game.days, today()])], daily, scores: [...game.scores] };
  let reward = `+${xp} XP · ${Math.min(daily[today()], 20)}/20 bonnes réponses pour ton objectif du jour`;
  if (result.run.timed) {
    const cats = [...new Set(result.run.cards.map(card => card.cat))];
    const seconds = Math.max(0.1, result.seconds);
    const penalty = (result.run.cards.length - correct) * 5;
    next.scores.push({ id: crypto.randomUUID(), date: new Date().toISOString(), cat: cats.length === 1 ? cats[0] : 'mixed', size: result.run.cards.length, correct, seconds, adjusted: seconds + penalty, custom: result.run.custom });
    reward += ` · ${formatTime(seconds)} (+${penalty} s de pénalité)`;
  }
  return { game: next, reward };
}
