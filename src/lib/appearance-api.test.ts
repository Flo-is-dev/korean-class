import { beforeEach, expect, it, vi } from 'vitest';
import { loadAppearance, saveAppearance } from './appearance-api';

const query = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), upsert: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { from: query.from } }));
beforeEach(() => {
  query.from.mockReturnValue(query); query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: null, error: null }); query.upsert.mockResolvedValue({ error: null });
});
it('selects only the requested settings for the signed-in account and defaults a missing row', async () => {
  expect(await loadAppearance('user-a')).toEqual({ ko_font: 'standard', theme: 'light' });
  expect(query.from).toHaveBeenCalledWith('user_settings'); expect(query.select).toHaveBeenCalledWith('ko_font, theme'); expect(query.eq).toHaveBeenCalledWith('user_id', 'user-a');
});
it('upserts both settings without writing updated_at or any schema change', async () => {
  await saveAppearance('user-a', { ko_font: 'square', theme: 'dark' });
  expect(query.upsert).toHaveBeenCalledWith({ user_id: 'user-a', ko_font: 'square', theme: 'dark' }, { onConflict: 'user_id' });
});
