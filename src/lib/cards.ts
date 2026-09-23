import type { Card, CardRow, Category, Progress, Settings, Stats } from '../types';

export const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'vocab', label: 'Vocabulaire' }, { key: 'verbs', label: 'Verbes' },
  { key: 'adjectives', label: 'Adjectifs' }, { key: 'colors', label: 'Couleurs' },
  { key: 'numbers', label: 'Nombres' }, { key: 'classifiers', label: 'Classificateurs' },
  { key: 'interrogatives', label: 'Interrogatifs' }, { key: 'grammar', label: 'Grammaire' },
];
export const SIZES = [10, 20, 50, 0];
export const categoryName = (key: string) => CATEGORIES.find(cat => cat.key === key)?.label ?? 'Sélection mixte';
export const normalize = (text: string) => text.normalize('NFC').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[\s~\-.,?!'’"«»…=]/g, '');
export const searchText = (text: string) => text.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const lessonTag = (row: CardRow) => [row.book, row.lesson != null ? `L${row.lesson}` : ''].filter(Boolean).join(' · ');
export const categoryOf = (row: CardRow): Category => row.category === 'vocab' ? row.word_type === 'verb' ? 'verbs' : row.word_type === 'adjective' ? 'adjectives' : 'vocab' : row.category;

function variants(ko: string) {
  const withoutParens = ko.replace(/\([^)]*\)/g, '');
  return [...new Set([ko, withoutParens, ...withoutParens.split(/[\/,=]/), ...Array.from(ko.matchAll(/\(([^)]*)\)/g), match => match[1])])].map(normalize).filter(Boolean);
}
export function buildCards(rows: CardRow[]): Card[] {
  const seen = new Set<string>();
  const cards: Card[] = [];
  for (const row of rows) {
    const cat = categoryOf(row);
    const key = `${cat}|${normalize(row.fr)}|${normalize(row.ko)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push({ id: row.id, cat, front: row.fr, back: row.ko, tag: lessonTag(row),
      hint: cat === 'classifiers' ? 'Quel classificateur ?' : cat === 'numbers' ? 'En coréen natif' : undefined,
      alt: cat === 'numbers' && row.short_form ? `forme courte : ${row.short_form}` : undefined,
      extra: cat === 'numbers' && row.short_form ? [row.short_form] : [], accepted: new Set(), others: [] });
  }
  const groups = new Map<string, Card[]>();
  for (const card of cards) {
    const key = `${card.cat}|${normalize(card.front)}`;
    groups.set(key, [...(groups.get(key) ?? []), card]);
  }
  for (const group of groups.values()) {
    const accepted = new Set(group.flatMap(card => [...variants(card.back), ...card.extra.map(normalize)]));
    group.forEach(card => { card.accepted = accepted; card.others = group.filter(other => other.id !== card.id).map(other => other.back); });
  }
  return cards;
}
export const isError = (progress?: Progress) => !!progress && progress.wrong > 0 && progress.streak < 2;
export const cardPool = (cards: Card[], settings: Settings, stats: Stats) => cards.filter(card => settings.cats.includes(card.cat) && (!settings.errorsOnly || isError(stats[card.id])));
export function recordAnswer(previous: Progress | undefined, ok: boolean): Progress {
  return { right: (previous?.right ?? 0) + Number(ok), wrong: (previous?.wrong ?? 0) + Number(!ok), streak: ok ? (previous?.streak ?? 0) + 1 : 0, last: Date.now() };
}
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
