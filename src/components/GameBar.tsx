import { streakDays, today } from '../lib/game';
import type { Game } from '../types';

const number = new Intl.NumberFormat('fr-FR');
const compactNumber = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

// Faceted energy gem, enamel flame and orbital target, drawn for the Pop HUD.
function GameIcon({ kind, complete = false }: { kind: 'xp' | 'streak' | 'daily'; complete?: boolean }) {
  return <svg className="game-icon" viewBox="0 0 36 36" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'xp' ? <>
      <path className="emblem-edge" d="m18 2 12 7 2 16-14 9L4 25 2 9Z" />
      <path className="emblem-body" d="m18 4 10 6 2 14-12 8L6 24 4 10Z" />
      <path className="emblem-facet" d="m18 4-4 10-8 10-2-14Zm0 28 2-11 10 3Z" />
      <path className="emblem-glint" d="m7 10 10-5m6 24 5-4" />
      <path className="emblem-core" d="m20 8-9 12h6l-1 8 10-13h-7Z" />
    </> : kind === 'streak' ? <>
      <path className="emblem-edge" d="M19 2c2 7 10 9 10 19a12 12 0 0 1-24 0c0-5 3-8 6-11 0 4 2 5 4 6-2-6 2-10 4-14Z" />
      <path className="emblem-body" d="M19 6c2 5 8 9 8 15a10 10 0 0 1-20 0c0-3 1-5 3-7 1 3 4 5 7 5-3-6 0-9 2-13Z" />
      <path className="emblem-core" d="M19 17c0 5 5 6 4 10a6 6 0 0 1-12-1c0-3 2-5 4-6 0 3 2 4 3 4-1-3 0-5 1-7Z" />
      <path className="emblem-glint" d="M9 23c0 3 1 5 3 6M28 6v4m-2-2h4" />
    </> : <>
      <circle className="emblem-edge" cx="17" cy="19" r="14" />
      <circle className="emblem-body" cx="17" cy="19" r="11.5" />
      <circle className="emblem-facet" cx="17" cy="19" r="7.5" />
      {complete ? <path className="emblem-check" d="m10 19 5 5 10-11" /> : <>
        <circle className="emblem-core" cx="17" cy="19" r="3" />
        <path className="emblem-arrow" d="M17 19 29 7" />
        <path className="emblem-core" d="m26 3 1 6 6 1-1-7Z" />
      </>}
      <path className="emblem-glint" d="M6 19a11 11 0 0 1 4-8m13 16 2-2" />
    </>}
  </svg>;
}

export function GameBar({ game }: { game: Game }) {
  const level = Math.floor(game.xp / 200) + 1;
  const levelXp = game.xp % 200;
  const streak = streakDays(game.days);
  const daily = Math.min(game.daily[today()] ?? 0, 20);
  const complete = daily === 20;
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - 6 + index);
    return game.days.includes(date.toLocaleDateString('sv-SE'));
  });
  return <div className="game-bar" role="group" aria-label="Progression">
    <div className="stat-pill stat-xp" title={`${number.format(game.xp)} XP · niveau ${level} · ${200 - levelXp} XP avant le niveau ${level + 1}`}>
      <div className="stat-main"><GameIcon kind="xp" /><span className="stat-copy"><strong className="stat-value" key={game.xp}>{game.xp >= 10000 ? compactNumber.format(game.xp) : number.format(game.xp)}</strong><small> XP</small></span></div>
      <div className="stat-track" role="progressbar" aria-label={`XP vers le niveau ${level + 1}`} aria-valuemin={0} aria-valuemax={200} aria-valuenow={levelXp} aria-valuetext={`${levelXp} sur 200 XP`}><i style={{ width: `${levelXp / 2}%` }} /></div>
    </div>
    <div className="stat-pill stat-streak" title={`${streak} jours consécutifs · ${week.filter(Boolean).length} jours étudiés sur les 7 derniers`}>
      <div className="stat-main"><GameIcon kind="streak" /><span className="stat-copy"><strong className="stat-value" key={streak}>{number.format(streak)}</strong><small> {streak === 1 ? 'jour' : 'jours'}</small></span></div>
      <div className="streak-track" role="img" aria-label={`7 derniers jours : ${week.map(active => active ? 'étudié' : 'non étudié').join(', ')}`}>{week.map((active, index) => <i key={index} className={active ? 'is-active' : undefined} aria-hidden="true" />)}</div>
    </div>
    <div className={`stat-pill stat-daily${complete ? ' is-complete' : ''}`} title={`${daily}/20 bonnes réponses aujourd’hui${complete ? ' · objectif atteint' : ''}`}>
      <div className="stat-main"><GameIcon kind="daily" complete={complete} /><span className="stat-copy"><strong className="stat-value" key={daily}>{daily}<span className="stat-total">/20</span></strong><small> aujourd’hui</small></span></div>
      <div className="stat-track" role="progressbar" aria-label="Objectif quotidien" aria-valuemin={0} aria-valuemax={20} aria-valuenow={daily} aria-valuetext={complete ? 'Objectif atteint : 20 bonnes réponses' : `${daily} bonnes réponses sur 20`}><i style={{ width: `${daily * 5}%` }} /></div>
    </div>
  </div>;
}
