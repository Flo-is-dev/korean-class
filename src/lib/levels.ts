import type { LevelFilter } from '../types';

type Levelled = { level?: number | null };

// Estimated TOPIK level, 1 to 6.
export const levelName = (level: number) => `TOPIK ${level} · ${level <= 2 ? 'débutant' : level <= 4 ? 'intermédiaire' : 'avancé'}`;
export const levelsOf = (items: Levelled[]) => [...new Set(items.map(item => item.level).filter((level): level is number => level != null))].sort((a, b) => a - b);
export const validateLevelFilter = (value: unknown, levels: number[]): LevelFilter => levels.includes(value as number) ? value as number : 'all';
export const matchesLevel = (item: Levelled, filter: LevelFilter) => filter === 'all' || item.level === filter;
export const parseLevelFilter = (value: string): LevelFilter => value === 'all' ? 'all' : Number(value);
// Options for a level select; the counts cover the items it is given.
export function levelOptions(levels: number[], items: Levelled[]): [LevelFilter, string][] {
  return [['all', `Tous les niveaux (${items.length})`], ...levels.map(level => [level, `${levelName(level)} (${items.filter(item => item.level === level).length})`] as [LevelFilter, string])];
}
