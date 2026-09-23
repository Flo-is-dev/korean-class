import { CATEGORIES, SIZES } from './cards';
import { emptyGame } from './game';
import type { Book, BookFilter, CardRow, Category, Game, Score, Settings } from '../types';
import { validateBookFilter } from './books';

const prefsKey = 'cahier-coreen:prefs';
const bookFilterKey = 'haru:library:book';
export function loadBookFilter(books: Book[] | null, rows: CardRow[]): BookFilter {
  try { return validateBookFilter(JSON.parse(localStorage.getItem(bookFilterKey) ?? 'null'), books, rows); }
  catch { return 'all'; }
}
export function saveBookFilter(filter: BookFilter) {
  try { localStorage.setItem(bookFilterKey, JSON.stringify(filter)); }
  catch { /* Filtering remains usable when browser storage is unavailable. */ }
}
const gameKey = (userId: string) => `haru:game:${userId}`;
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';
const nonNegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isCategory = (value: unknown): value is Category => CATEGORIES.some(cat => cat.key === value);
function isScore(value: unknown): value is Score {
  return isObject(value) && typeof value.id === 'string' && typeof value.date === 'string' && Number.isFinite(Date.parse(value.date)) &&
    (value.cat === 'mixed' || isCategory(value.cat)) && nonNegative(value.size) && value.size > 0 && nonNegative(value.correct) && value.correct <= value.size &&
    nonNegative(value.seconds) && nonNegative(value.adjusted);
}
export function loadSettings(): Settings {
  const fallback: Settings = { cats: ['vocab'], size: 20, mode: 'flash', errorsOnly: false };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(prefsKey) ?? 'null');
    if (!isObject(saved)) return fallback;
    const cats = Array.isArray(saved.cats) ? saved.cats.filter(isCategory) : [];
    return { cats: cats.length ? cats : fallback.cats, size: typeof saved.size === 'number' && SIZES.includes(saved.size) ? saved.size : 20, mode: saved.mode === 'type' ? 'type' : 'flash', errorsOnly: false };
  } catch { return fallback; }
}
export function loadGame(userId: string): Game {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(gameKey(userId)) ?? 'null');
    if (!isObject(saved)) return emptyGame();
    return { xp: nonNegative(saved.xp) ? saved.xp : 0,
      days: Array.isArray(saved.days) ? saved.days.filter((day): day is string => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)) : [],
      scores: Array.isArray(saved.scores) ? saved.scores.filter(isScore).map(score => ({ ...score, custom: !!score.custom })) : [],
      sound: typeof saved.sound === 'boolean' ? saved.sound : true,
      daily: isObject(saved.daily) ? Object.fromEntries(Object.entries(saved.daily).filter((entry): entry is [string, number] => nonNegative(entry[1]))) : {},
    };
  } catch { return emptyGame(); }
}
export function saveGame(userId: string, game: Game) { localStorage.setItem(gameKey(userId), JSON.stringify(game)); }
export function saveSettings(settings: Settings) { localStorage.setItem(prefsKey, JSON.stringify(settings)); }
