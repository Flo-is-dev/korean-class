import { createClient } from '@supabase/supabase-js';
import type { Book, CardRow, GrammarPoint, Progress, Stats } from '../types';
import type { Database } from './database.types';

// Publishable values, protected by the existing server-side RLS policies.
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL || 'https://drmbmogzkeczrylymhtb.supabase.co',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_xMASBLY6tNgw29ooyMdevQ_HeETAxVY',
  { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } },
);
export async function loadBooks(): Promise<Book[]> {
  const books: Book[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('books').select('code, label')
      .order('sort_order').order('code').range(offset, offset + 999);
    if (error) throw error;
    books.push(...data);
    if (data.length < 1000) return books;
  }
}
export async function loadCards(): Promise<CardRow[]> {
  const rows: CardRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('cards')
      .select('id, category, word_type, book, lesson, level, ko, fr, short_form, zh_hanzi, zh_pinyin, zh_note')
      .order('sort_order').order('id').range(offset, offset + 999);
    if (error) throw new Error(`Lecture des cartes impossible : ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
type GrammarRecord = {
  id: string; ko: string; fr: string; book: string | null; lesson: number | null; cefr: string | null; conj_type: string | null; section: string | null;
  books: { label: string | null } | { label: string | null }[] | null;
  card_examples: { ko: string | null; fr: string | null; sort_order: number | null }[] | null;
};
// Grammar points with their book label and example sentences, in one request.
// These columns and relations are not described in database.types, hence the cast.
export async function loadGrammar(): Promise<GrammarPoint[]> {
  const { data, error } = await supabase.from('cards')
    .select('id, ko, fr, book, lesson, cefr, conj_type, section, level, sort_order, books(label), card_examples(ko, fr, sort_order)')
    .eq('category', 'grammar').order('sort_order');
  if (error) throw new Error(`Lecture de la grammaire impossible : ${error.message}`);
  return (data as unknown as GrammarRecord[]).map(row => ({
    id: row.id, ko: row.ko ?? '', fr: row.fr ?? '', book: row.book ?? null, lesson: row.lesson ?? null, cefr: row.cefr || null, conjType: row.conj_type || null, section: row.section || null,
    bookLabel: (Array.isArray(row.books) ? row.books[0]?.label : row.books?.label) || null,
    examples: [...(row.card_examples ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(example => ({ ko: example.ko ?? '', fr: example.fr ?? '' })).filter(example => example.ko || example.fr),
  }));
}
export async function loadStats(userId: string): Promise<Stats> {
  const stats: Stats = {};
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('user_progress')
      .select('card_id, right_count, wrong_count, streak, last_seen, score, mastered_at')
      .eq('user_id', userId).order('card_id').range(offset, offset + 999);
    if (error) throw new Error(`Lecture de ta progression impossible : ${error.message}`);
    data.forEach(row => { stats[row.card_id] = toProgress(row); });
    if (data.length < 1000) return stats;
  }
}
export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (error) return false;
  return data?.role === 'admin';
}
type ProgressRow = { right_count: number; wrong_count: number; streak: number; last_seen: string; score: number | null; mastered_at: string | null };
const toProgress = (row: ProgressRow): Progress => ({ right: row.right_count, wrong: row.wrong_count, streak: row.streak, last: Date.parse(row.last_seen), score: row.score ?? 0, masteredAt: row.mastered_at ?? null });
// Both functions return the up-to-date user_progress row, as a single row or a one-row set.
function progressFrom(data: ProgressRow | ProgressRow[] | null): Progress {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Progression introuvable.');
  return toProgress(row);
}
// The database applies the score rule: +1 per right answer, back to 0 on an error, mastered at 10.
export async function sendAnswer(cardId: string, ok: boolean): Promise<Progress> {
  const { data, error } = await supabase.rpc('record_answer', { p_card_id: cardId, p_ok: ok });
  if (error) throw error;
  return progressFrom(data);
}
export async function unmasterCard(cardId: string): Promise<Progress> {
  const { data, error } = await supabase.rpc('unmaster_card', { p_card_id: cardId });
  if (error) throw error;
  return progressFrom(data);
}
export async function deleteCards(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('cards').delete().in('id', ids).select('id');
  if (error) throw error;
  return data.map(row => row.id);
}
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
