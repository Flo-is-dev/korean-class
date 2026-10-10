import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { emptyGame } from '../lib/game';
import { GameBar } from './GameBar';

afterEach(() => vi.useRealTimers());

it('shows level progress, caps the daily goal and resets the XP gauge at the next level', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 11, 12));
  const game = { ...emptyGame(), xp: 199, daily: { '2026-10-11': 25 } };
  const view = render(<GameBar game={game} />);
  expect(screen.getByRole('progressbar', { name: 'XP vers le niveau 2' }).getAttribute('aria-valuenow')).toBe('199');
  expect(screen.getByRole('progressbar', { name: 'Objectif quotidien' }).getAttribute('aria-valuenow')).toBe('20');
  expect(screen.getByRole('progressbar', { name: 'Objectif quotidien' }).getAttribute('aria-valuetext')).toContain('Objectif atteint');
  view.rerender(<GameBar game={{ ...game, xp: 200 }} />);
  expect(screen.getByRole('progressbar', { name: 'XP vers le niveau 3' }).getAttribute('aria-valuenow')).toBe('0');
});

it('represents actual recent activity including gaps and yesterday’s ongoing streak', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 11, 12));
  const game = { ...emptyGame(), days: ['2026-10-01', '2026-10-05', '2026-10-09', '2026-10-10'] };
  render(<GameBar game={game} />);
  expect(screen.getByTitle('2 jours consécutifs · 3 jours étudiés sur les 7 derniers')).toBeDefined();
  expect(screen.getByRole('img', { name: '7 derniers jours : étudié, non étudié, non étudié, non étudié, étudié, étudié, non étudié' })).toBeDefined();
  expect(screen.getByRole('progressbar', { name: 'Objectif quotidien' }).getAttribute('aria-valuenow')).toBe('0');
});
