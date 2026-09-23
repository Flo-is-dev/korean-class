import { useEffect, useRef } from 'react';
import { SelectField } from '../components/SelectField';
import { buildCards, categoryName, categoryOf, CATEGORIES, lessonTag, searchText, shuffle } from '../lib/cards';
import type { Card, CardRow, Category, LibraryFilters } from '../types';

export function LibraryPage({ rows, filters, admin, busy, onFilters, onStart, onDelete }: {
  rows: CardRow[]; filters: LibraryFilters; admin: boolean; busy: boolean; onFilters: (filters: LibraryFilters) => void; onStart: (cards: Card[]) => void; onDelete: (ids: string[]) => void;
}) {
  const all = useRef<HTMLInputElement>(null);
  const query = searchText(filters.query);
  const visible = rows.filter(row => (filters.cat === 'all' || categoryOf(row) === filters.cat) && searchText(`${row.fr} ${row.ko} ${lessonTag(row)}`).includes(query));
  const allChecked = visible.length > 0 && visible.every(row => filters.selected.has(row.id));
  const someChecked = visible.some(row => filters.selected.has(row.id));
  useEffect(() => { if (all.current) all.current.indeterminate = !allChecked && someChecked; }, [allChecked, someChecked]);
  function select(ids: string[], checked: boolean) {
    const selected = new Set(filters.selected);
    ids.forEach(id => checked ? selected.add(id) : selected.delete(id));
    onFilters({ ...filters, selected });
  }
  return <>
    <div className="page-heading"><p className="eyebrow">TA COLLECTION</p><h1>Des mots, des possibilités.</h1><p>Retrouve toutes les entrées du catalogue et compose ta propre série.</p></div>
    <section className="panel" aria-busy={busy}>
      <div className="filters row"><input className="search" type="search" aria-label="Rechercher un mot" placeholder="Rechercher en français ou en coréen…" disabled={busy} value={filters.query} onChange={event => onFilters({ ...filters, query: event.target.value })} /><SelectField label="Catégorie" value={filters.cat} options={[["all", "Toutes les catégories"], ...CATEGORIES.map(cat => [cat.key, cat.label] as const)]} onChange={value => onFilters({ ...filters, cat: value as Category | 'all' })} /></div>
      <p className="note" role="status">{visible.length} mots affichés sur {rows.length} · la sélection est conservée entre les filtres</p>
      <div className="selection-toolbar"><label><input ref={all} type="checkbox" disabled={busy || !visible.length} checked={allChecked} onChange={event => select(visible.map(row => row.id), event.target.checked)} />Tout sélectionner (résultats filtrés)</label><span className="selection-count">{filters.selected.size} sélectionné(s)</span><button className="btn link" disabled={busy} onClick={() => onFilters({ ...filters, selected: new Set() })}>Tout désélectionner</button></div>
      <div className="row"><button className="btn primary" disabled={busy || !filters.selected.size} onClick={() => onStart(shuffle(buildCards(rows.filter(row => filters.selected.has(row.id)))))}>Chrono avec la sélection</button><button className="btn bad" disabled={busy || !admin || !filters.selected.size} onClick={() => onDelete([...filters.selected])}>{busy ? 'Suppression…' : 'Supprimer la sélection'}</button></div>
      <p className="note">{admin ? 'La suppression affecte le catalogue partagé. Une confirmation te sera demandée.' : 'La suppression du catalogue partagé est réservée aux administrateurs.'}</p>
      <p className="note">Les doublons identiques sont regroupés pendant les quiz. Les séries choisies manuellement ont leur propre classement.</p>
      <div className="word-list">{visible.map(row => <label className="word-row" key={row.id}><input type="checkbox" disabled={busy} checked={filters.selected.has(row.id)} aria-label={`Sélectionner ${row.fr}`} onChange={event => select([row.id], event.target.checked)} /><span className="word-fr">{row.fr}</span><span className="word-ko" lang="ko">{row.ko}</span><span className="word-tag">{[categoryName(categoryOf(row)), lessonTag(row)].filter(Boolean).join(' · ')}</span></label>)}{!visible.length && <p className="empty-state">Aucun mot trouvé. Essaie une autre recherche.</p>}</div>
    </section>
  </>;
}
