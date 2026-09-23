import { supabase } from './supabase';
import { DEFAULT_APPEARANCE, normalizeAppearance } from './appearance';
import type { Appearance } from './appearance';

export async function loadAppearance(userId: string): Promise<Appearance> {
  const { data, error } = await supabase.from('user_settings').select('ko_font, theme').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? normalizeAppearance(data) : { ...DEFAULT_APPEARANCE };
}
export async function saveAppearance(userId: string, value: Appearance): Promise<void> {
  const { error } = await supabase.from('user_settings').upsert({ user_id: userId, ko_font: value.ko_font, theme: value.theme }, { onConflict: 'user_id' });
  if (error) throw error;
}
