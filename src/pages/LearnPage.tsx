import { Hero } from '../components/Hero';
import { CATEGORIES, SIZES, cardPool, isError, shuffle } from '../lib/cards';
import type { Card, Settings, Stats } from '../types';

export function LearnPage({ cards, settings, stats, onSettings, onStart }: {
  cards: Card[]; settings: Settings; stats: Stats; onSettings: (settings: Settings) => void; onStart: (cards: Card[]) => void;
}) {
  const pool = cardPool(cards, settings, stats);
  const totalErrors = cards.filter(card => settings.cats.includes(card.cat) && isError(stats[card.id])).length;
  return <>
    <Hero title="Un petit pas aujourd’hui." subtitle="Un grand voyage en coréen. Choisis tes mots et fais grandir ta progression." bubble="안녕!" />
    <section className="panel learn-panel">
      <fieldset className="field"><legend>Catégories</legend><div className="chips">{CATEGORIES.map(category => <button key={category.key} className="chip" aria-pressed={settings.cats.includes(category.key)} onClick={() => {
        const cats = settings.cats.includes(category.key) ? settings.cats.filter(cat => cat !== category.key) : [...settings.cats, category.key];
        if (cats.length) onSettings({ ...settings, cats });
      }}>{category.label}<span className="n">{cards.filter(card => card.cat === category.key && (!settings.errorsOnly || isError(stats[card.id]))).length}</span></button>)}</div><p className="seg-note">Les verbes et les adjectifs ont leur propre catégorie.</p></fieldset>
      <fieldset className="field"><legend>Nombre de cartes</legend><div className="seg">{SIZES.map(size => <button key={size} aria-pressed={settings.size === size} onClick={() => onSettings({ ...settings, size })}>{size || 'Toutes'}</button>)}</div><p className="seg-note">{pool.length} cartes disponibles avec ces réglages.</p></fieldset>
      <fieldset className="field"><legend>Mode</legend><div className="seg"><button aria-pressed={settings.mode === 'flash'} onClick={() => onSettings({ ...settings, mode: 'flash' })}>Flashcards</button><button aria-pressed={settings.mode === 'type'} onClick={() => onSettings({ ...settings, mode: 'type' })}>Saisie en hangul</button></div><p className="seg-note">{settings.mode === 'flash' ? 'Retourne la carte et indique si tu connaissais la réponse.' : 'Écris en coréen, la correction est automatique.'}</p></fieldset>
      <label className="toggle"><span><strong>Revoir mes erreurs ({totalErrors})</strong><small>Un mot quitte cette liste après 2 bonnes réponses d’affilée.</small></span><input type="checkbox" checked={settings.errorsOnly} disabled={!totalErrors && !settings.errorsOnly} onChange={event => onSettings({ ...settings, errorsOnly: event.target.checked })} /></label>
      <button id="start" className="btn primary" disabled={!pool.length} onClick={() => onStart(shuffle(pool).slice(0, settings.size || undefined))}>Commencer · {Math.min(pool.length, settings.size || pool.length)} cartes</button>
    </section>
  </>;
}
