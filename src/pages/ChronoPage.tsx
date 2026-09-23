import { Hero } from '../components/Hero';
import { SelectField } from '../components/SelectField';
import { CATEGORIES, shuffle } from '../lib/cards';
import type { Card, Category } from '../types';

export function ChronoPage({ cards, category, size, onCategory, onSize, onStart, onChoose }: {
  cards: Card[]; category: Category; size: number; onCategory: (cat: Category) => void; onSize: (size: number) => void; onStart: (cards: Card[]) => void; onChoose: () => void;
}) {
  const available = cards.filter(card => card.cat === category);
  const count = Math.min(size, available.length);
  return <><Hero title="À toi de battre le chrono." subtitle="Précision d’abord, vitesse ensuite. Donne le meilleur de toi-même !" bubble="준비?" />
    <section className="panel"><h2>Ton prochain record commence ici</h2>
      <div className="row filters"><SelectField label="Catégorie" value={category} options={CATEGORIES.map(cat => [cat.key, cat.label])} onChange={value => onCategory(value as Category)} /><SelectField label="Nombre de mots" value={size} options={[10, 20, 50].map(n => [n, `${n} mots`])} onChange={value => onSize(Number(value))} /></div>
      <div className="rules"><strong>Les règles du jeu</strong><p>Écris la traduction en hangul. Le temps continue pendant les corrections. Chaque erreur ajoute 5 secondes. Le classement privilégie le nombre de bonnes réponses, puis le temps avec pénalités. Seules les séries terminées sont classées.</p></div>
      <p className="note">{available.length} mots disponibles · {count} seront tirés au sort.{count < size && ' La série sera classée dans son format réel.'}</p>
      <button className="btn primary" disabled={!count} onClick={() => onStart(shuffle(available).slice(0, count))}>C’est parti · {count} mots</button>
      <button className="btn link" onClick={onChoose}>Choisir moi-même les mots →</button>
    </section></>;
}
