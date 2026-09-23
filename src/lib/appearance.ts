export type KoreanFont = 'standard' | 'square' | 'handwritten';
export type Theme = 'light' | 'dark';
export interface Appearance { ko_font: KoreanFont; theme: Theme }

export const APPEARANCE_KEY = 'cahier-coreen:settings';
export const DEFAULT_APPEARANCE: Appearance = { ko_font: 'standard', theme: 'light' };
export const KOREAN_FONTS: { value: KoreanFont; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'square', label: 'Carrée' },
  { value: 'handwritten', label: 'Manuscrite' },
];
export function normalizeAppearance(value: unknown): Appearance {
  const saved = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    ko_font: saved.ko_font === 'square' || saved.ko_font === 'handwritten' ? saved.ko_font : 'standard',
    theme: saved.theme === 'dark' ? 'dark' : 'light',
  };
}
export function readLocalAppearance(): Appearance {
  try { return normalizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? 'null')); }
  catch { return { ...DEFAULT_APPEARANCE }; }
}
export function writeLocalAppearance(value: Appearance) {
  try {
    let previous: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? 'null');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) previous = parsed as Record<string, unknown>;
    } catch { /* Replace malformed JSON without interrupting the UI. */ }
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ ...previous, ...value }));
  } catch { /* A denied local cache must not block applying or syncing settings. */ }
}
export function applyAppearance(value: Appearance) {
  document.documentElement.dataset.theme = value.theme;
  document.documentElement.dataset.koFont = value.ko_font;
  document.documentElement.style.colorScheme = value.theme;
}
