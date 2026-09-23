import { createClient } from '@supabase/supabase-js';
import type { CardRow, Progress, Stats } from '../types';
import type { Database } from './database.types';

// Publishable values, protected by the existing server-side RLS policies.
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL || 'https://mdicfesvrrnbwnyslnir.supabase.co',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_XVzEwk-V4X6sfCT2mSzzjw_cEZQvJiV',
  { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } },
);
export async function loadCards(): Promise<CardRow[]> {
  const rows: CardRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('cards')
      .select('id, category, word_type, book, lesson, ko, fr, short_form')
      .order('sort_order').order('id').range(offset, offset + 999);
    if (error) throw new Error(`Lecture des cartes impossible : ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
export async function loadStats(userId: string): Promise<Stats> {
  const stats: Stats = {};
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('user_progress')
      .select('card_id, right_count, wrong_count, streak, last_seen')
      .eq('user_id', userId).order('card_id').range(offset, offset + 999);
    if (error) throw new Error(`Lecture de ta progression impossible : ${error.message}`);
    data.forEach(row => { stats[row.card_id] = { right: row.right_count, wrong: row.wrong_count, streak: row.streak, last: Date.parse(row.last_seen) }; });
    if (data.length < 1000) return stats;
  }
}
export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (error) return false;
  return data?.role === 'admin';
}
export async function saveProgress(userId: string, entries: [string, Progress][]) {
  if (!entries.length) return;
  const { error } = await supabase.from('user_progress').upsert(entries.map(([cardId, stat]) => ({
    user_id: userId, card_id: cardId, right_count: stat.right, wrong_count: stat.wrong, streak: stat.streak, last_seen: new Date(stat.last).toISOString(),
  })), { onConflict: 'user_id,card_id' });
  if (error) throw error;
}
export async function deleteCards(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('cards').delete().in('id', ids).select('id');
  if (error) throw error;
  return data.map(row => row.id);
}
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
