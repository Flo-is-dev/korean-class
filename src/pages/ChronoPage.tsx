import { Mascot } from '../components/Mascot';
import { SelectField } from '../components/SelectField';
import { CATEGORIES, shuffle } from '../lib/cards';
import type { Card, Category } from '../types';

export function ChronoPage({ cards, category, size, onCategory, onSize, onStart, onChoose }: {
  cards: Card[]; category: Category; size: number; onCategory: (cat: Category) => void; onSize: (size: number) => void; onStart: (cards: Card[]) => void; onChoose: () => void;
}) {
  const available = cards.filter(card => card.cat === category);
  const count = Math.min(size, available.length);
  return <>
    <section className="panel"><h2>Chrono</h2>
      <div className="row filters"><SelectField label="Catégorie" value={category} options={CATEGORIES.map(cat => [cat.key, cat.label])} onChange={value => onCategory(value as Category)} /><SelectField label="Nombre de mots" value={size} options={[10, 20, 50].map(n => [n, `${n} mots`])} onChange={value => onSize(Number(value))} /></div>
      <button className="btn primary" disabled={!count} onClick={() => onStart(shuffle(available).slice(0, count))}>C’est parti · {count} mots</button>
      <button className="btn link" onClick={onChoose}>Choisir moi-même les mots →</button>
      <Mascot />
    </section></>;
}
