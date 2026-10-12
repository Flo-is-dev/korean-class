export type Category = 'vocab' | 'verbs' | 'adjectives' | 'colors' | 'numbers' | 'classifiers' | 'interrogatives' | 'grammar';
export type Mode = 'flash' | 'mcq' | 'type';
export type Direction = 'fr-ko' | 'ko-fr';
export type Page = 'learn' | 'chrono' | 'grammar' | 'words' | 'scores';
export interface GrammarExample { ko: string; fr: string }
export interface GrammarPoint {
  id: string;
  ko: string;
  fr: string;
  book: string | null;
  bookLabel: string | null;
  lesson: number | null;
  cefr: string | null;
  conjType: string | null;
  section: string | null;
  examples: GrammarExample[];
}
export interface Book { code: string; label: string }
export type BookFilter = 'all' | 'none' | `book:${string}`;
export type LevelFilter = 'all' | number;
export interface CardRow {
  id: string;
  category: Exclude<Category, 'verbs' | 'adjectives'>;
  word_type: 'verb' | 'adjective' | null;
  book: string | null;
  lesson: number | null;
  level?: number | null;
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
  books: (string | null)[];
  level: number | null;
  hint?: string;
  alt?: string;
  zh?: Chinese;
  extra: string[];
  accepted: Set<string>;
  others: string[];
}
export interface Progress { right: number; wrong: number; streak: number; last: number; score?: number; masteredAt?: string | null }
export type Stats = Record<string, Progress>;
export interface Settings { cats: Category[]; size: number; mode: Mode; direction: Direction; errorsOnly: boolean; mastered: boolean }
export interface Score {
  id: string;
  date: string;
  cat: Category | 'mixed';
  size: number;
  correct: number;
  seconds: number;
  adjusted: number;
  custom: boolean;
  direction?: Direction;
}
export interface Game { xp: number; days: string[]; scores: Score[]; sound: boolean; effects: boolean; music: boolean; track: MusicTrack; daily: Record<string, number> }
export type MusicTrack = 'calm' | 'rhythm' | 'korean';
export type AudioPrefs = Pick<Game, 'sound' | 'effects' | 'music' | 'track'>;
export interface QuizRun { id: number; cards: Card[]; mode: Mode; timed: boolean; custom: boolean; direction?: Direction }
export interface Answer { card: Card; ok: boolean; typed?: string }
export interface QuizResult { run: QuizRun; answers: Answer[]; seconds: number; completed: boolean }
export interface LibraryFilters { query: string; cat: Category | 'all'; book: BookFilter; level: LevelFilter; status: MasteryFilter; selected: Set<string> }
export type MasteryFilter = 'all' | 'mastered' | 'learning';
