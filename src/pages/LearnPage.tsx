import { Mascot } from '../components/Mascot';
import { MultiSelect } from '../components/MultiSelect';
import { CATEGORIES, SIZES, cardPool, isError, shuffle } from '../lib/cards';
import type { Card, Settings, Stats } from '../types';

export function LearnPage({ cards, settings, stats, onSettings, onStart }: {
  cards: Card[]; settings: Settings; stats: Stats; onSettings: (settings: Settings) => void; onStart: (cards: Card[]) => void;
}) {
  const pool = cardPool(cards, settings, stats);
  const totalErrors = cards.filter(card => settings.cats.includes(card.cat) && isError(stats[card.id])).length;
  return <>
    <section className="panel learn-panel">
      <fieldset className="field"><legend>Catégories</legend><MultiSelect label="Catégories" selected={settings.cats} onChange={cats => onSettings({ ...settings, cats })} options={CATEGORIES.map(category => ({ value: category.key, label: category.label, count: cards.filter(card => card.cat === category.key && (!settings.errorsOnly || isError(stats[card.id]))).length }))} /></fieldset>
      <fieldset className="field"><legend>Nombre de cartes</legend><div className="seg">{SIZES.map(size => <button key={size} aria-pressed={settings.size === size} onClick={() => onSettings({ ...settings, size })}>{size || 'Toutes'}</button>)}</div></fieldset>
      <fieldset className="field"><legend>Mode</legend><div className="seg"><button aria-pressed={settings.mode === 'flash'} onClick={() => onSettings({ ...settings, mode: 'flash' })}>Flashcards</button><button aria-pressed={settings.mode === 'mcq'} onClick={() => onSettings({ ...settings, mode: 'mcq' })}>QCM</button><button aria-pressed={settings.mode === 'type'} onClick={() => onSettings({ ...settings, mode: 'type' })}>Saisie en hangul</button></div></fieldset>
      <label className="toggle"><span><strong>Revoir mes erreurs ({totalErrors})</strong></span><input type="checkbox" checked={settings.errorsOnly} disabled={!totalErrors && !settings.errorsOnly} onChange={event => onSettings({ ...settings, errorsOnly: event.target.checked })} /></label>
      <button id="start" className="btn primary" disabled={!pool.length} onClick={() => onStart(shuffle(pool).slice(0, settings.size || undefined))}>Commencer · {Math.min(pool.length, settings.size || pool.length)} cartes</button>
      <Mascot />
    </section>
  </>;
}
