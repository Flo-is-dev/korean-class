export type Category = 'vocab' | 'verbs' | 'adjectives' | 'colors' | 'numbers' | 'classifiers' | 'interrogatives' | 'grammar';
export type Mode = 'flash' | 'type';
export type Page = 'learn' | 'chrono' | 'words' | 'scores' | 'settings';
export interface Book { code: string; label: string }
export type BookFilter = 'all' | 'none' | `book:${string}`;
export interface CardRow {
  id: string;
  category: Exclude<Category, 'verbs' | 'adjectives'>;
  word_type: 'verb' | 'adjective' | null;
  book: string | null;
  lesson: number | null;
  ko: string;
  fr: string;
  short_form: string | null;
  zh_hanzi?: string | null;
  zh_pinyin?: string | null;
  zh_note?: string | null;
}
export interface Chinese { hanzi: string; pinyin: string | null; note: string | null }
export interface Card {
  id: string;
  cat: Category;
  front: string;
  back: string;
  tag: string;
  hint?: string;
  alt?: string;
  zh?: Chinese;
  extra: string[];
  accepted: Set<string>;
  others: string[];
}
export interface Progress { right: number; wrong: number; streak: number; last: number }
export type Stats = Record<string, Progress>;
export interface Settings { cats: Category[]; size: number; mode: Mode; errorsOnly: boolean }
export interface Score {
  id: string;
  date: string;
  cat: Category | 'mixed';
  size: number;
  correct: number;
  seconds: number;
  adjusted: number;
  custom: boolean;
}
export interface Game { xp: number; days: string[]; scores: Score[]; sound: boolean; effects: boolean; music: boolean; daily: Record<string, number> }
export type AudioPrefs = Pick<Game, 'sound' | 'effects' | 'music'>;
export interface QuizRun { id: number; cards: Card[]; mode: Mode; timed: boolean; custom: boolean }
export interface Answer { card: Card; ok: boolean; typed?: string }
export interface QuizResult { run: QuizRun; answers: Answer[]; seconds: number; completed: boolean }
export interface LibraryFilters { query: string; cat: Category | 'all'; book: BookFilter; selected: Set<string> }
