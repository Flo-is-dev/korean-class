import { useState } from 'react';
import { SelectField } from '../components/SelectField';
import { categoryName, CATEGORIES } from '../lib/cards';
import { formatTime, rankScores, streakDays } from '../lib/game';
import type { Game, Score } from '../types';

export function ScoresPage({ game, onChallenge }: { game: Game; onChallenge: () => void }) {
  const [category, setCategory] = useState('all');
  const [size, setSize] = useState('all');
  const [kind, setKind] = useState('random');
  const scores = game.scores.filter(score => (category === 'all' || score.cat === category) && (size === 'all' || score.size === Number(size)) && score.custom === (kind === 'custom'));
  const groups = new Map<string, Score[]>();
  scores.forEach(score => { const key = `${score.cat}|${score.size}`; groups.set(key, [...(groups.get(key) ?? []), score]); });
  const badges: [string, string, boolean][] = [['🌱', 'Premier pas', game.xp > 0], ['🔥', '3 jours de suite', streakDays(game.days) >= 3], ['⚡', '1 000 XP', game.xp >= 1000], ['🎯', 'Sans-faute chrono', game.scores.some(score => score.correct === score.size)]];
  return <>
    <div className="page-heading"><p className="eyebrow">CHAQUE EFFORT COMPTE</p><h1>Tes petites grandes victoires.</h1></div>
    <div className="badges">{badges.map(([icon, label, unlocked]) => <div className={`badge ${unlocked ? 'unlocked' : 'locked'}`} key={label}><span>{icon}</span><strong>{label}</strong><small>{unlocked ? 'Débloqué' : 'À débloquer'}</small></div>)}</div>
    <section className="panel"><h2>Mes meilleurs chronos</h2><p className="note">Top 10 par catégorie et format : bonnes réponses décroissantes, puis temps avec pénalités croissant. Scores et XP personnels conservés dans ce navigateur, pour ce compte.</p>
      <div className="row filters"><SelectField label="Catégorie" value={category} options={[["all", "Toutes"], ...CATEGORIES.map(cat => [cat.key, cat.label] as const), ["mixed", "Sélection mixte"]]} onChange={setCategory} /><SelectField label="Format" value={size} options={[["all", "Tous"], ...[...new Set(game.scores.map(score => score.size))].sort((a, b) => a - b).map(n => [n, `${n} mots`] as const)]} onChange={setSize} /><SelectField label="Séries" value={kind} options={[["random", "Tirage aléatoire"], ["custom", "Sélection manuelle"]]} onChange={setKind} /></div>
      <div className="score-table-wrap">{[...groups.entries()].sort(([, a], [, b]) => categoryName(a[0].cat).localeCompare(categoryName(b[0].cat)) || a[0].size - b[0].size).map(([key, entries]) => <section key={key}><h3>{categoryName(entries[0].cat)} · {entries[0].size} mots</h3><table><thead><tr>{['Rang', 'Réussite', 'Temps + pénalités', 'Date'].map(text => <th scope="col" key={text}>{text}</th>)}</tr></thead><tbody>{rankScores(entries).slice(0, 10).map((score, index) => <tr key={score.id}><td>{index === 0 ? '🥇 1' : index + 1}</td><td>{score.correct}/{score.size}</td><td title={`${formatTime(score.seconds)} + ${(score.size - score.correct) * 5} s`}>{formatTime(score.adjusted)}</td><td>{new Date(score.date).toLocaleDateString('fr-FR')}</td></tr>)}</tbody></table></section>)}
        {!scores.length && <div className="score-empty"><span>🏆</span><h3>Le premier record t’attend</h3><p>Termine un chrono pour inscrire ton score ici.</p><button className="btn primary" onClick={onChallenge}>Lancer un défi</button></div>}
      </div>
    </section>
  </>;
}
