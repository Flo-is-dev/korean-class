import { useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Card, CardRow, Category, Game, LibraryFilters, Page, QuizResult, QuizRun, Settings, Stats } from './types';
import { Header } from './components/Header';
import { LearnPage } from './pages/LearnPage';
import { ChronoPage } from './pages/ChronoPage';
import { LibraryPage } from './pages/LibraryPage';
import { ScoresPage } from './pages/ScoresPage';
import { QuizPage } from './pages/QuizPage';
import { ResultPage } from './pages/ResultPage';
import { buildCards, isError } from './lib/cards';
import { loadGame, loadSettings, saveGame, saveSettings } from './lib/storage';
import { rewardSession, streakDays, today } from './lib/game';
import { deleteCards, errorMessage, supabase } from './lib/supabase';
import { playSound } from './lib/sound';
import { useProgress } from './hooks/useProgress';

const pages: [Page, string, string][] = [['learn', '✦', 'Apprendre'], ['chrono', '◷', 'Chrono'], ['words', '▤', 'Mes mots'], ['scores', '♜', 'Scores']];

export function Workspace({ user, initialRows, initialStats, admin }: { user: User; initialRows: CardRow[]; initialStats: Stats; admin: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const cards = useMemo(() => buildCards(rows), [rows]);
  const progress = useProgress(user.id, initialStats);
  const [page, setPage] = useState<Page>('learn');
  const [settings, setSettings] = useState(loadSettings);
  const [game, setGame] = useState(() => loadGame(user.id));
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [run, setRun] = useState<QuizRun | null>(null);
  const [result, setResult] = useState<{ result: QuizResult; reward: string } | null>(null);
  const [chronoCategory, setChronoCategory] = useState<Category>('verbs');
  const [chronoSize, setChronoSize] = useState(20);
  const [library, setLibrary] = useState<LibraryFilters>({ query: '', cat: 'all', selected: new Set() });
  const sequence = useRef(0);
  const awarded = useRef(new Set<number>());

  function persistGame(next: Game) {
    setGame(next);
    try { saveGame(user.id, next); }
    catch { setNotice('Stockage du navigateur indisponible : les XP et les scores ne seront pas conservés après fermeture.'); }
  }
  function changeSettings(next: Settings) {
    setSettings(next);
    try { saveSettings(next); }
    catch { setNotice('Impossible de conserver les préférences dans ce navigateur.'); }
  }
  function navigate(next: Page) {
    if (busyRef.current) return;
    if (run && !window.confirm('Quitter cette série ? Un chrono inachevé ne sera pas classé.')) return;
    setRun(null); setResult(null); setPage(next); void progress.flush();
  }
  function start(selected: Card[], timed = false, custom = false) {
    if (!selected.length || busyRef.current) return;
    setResult(null);
    setRun({ id: ++sequence.current, cards: selected, mode: timed ? 'type' : settings.mode, timed, custom });
  }
  function finish(completed: QuizResult) {
    if (awarded.current.has(completed.run.id)) return;
    awarded.current.add(completed.run.id);
    const rewarded = rewardSession(game, completed);
    if (completed.completed) { persistGame(rewarded.game); playSound('complete', game.sound); }
    setResult({ result: completed, reward: rewarded.reward }); setRun(null); void progress.flush();
  }
  async function remove(ids: string[]) {
    if (!admin || busyRef.current || !ids.length) return;
    if (!window.confirm(`Supprimer définitivement ${ids.length} mot(s) du catalogue partagé et leur progression pour tous les utilisateurs ?`)) return;
    busyRef.current = true; setBusy(true);
    try {
      if (!await progress.flush()) throw new Error('La progression n’a pas pu être sauvegardée. Réessaie avant de supprimer les mots.');
      const removed = await deleteCards(ids);
      const removedSet = new Set(removed);
      progress.forget(removed);
      setRows(current => current.filter(row => !removedSet.has(row.id)));
      setLibrary(current => ({ ...current, selected: new Set([...current.selected].filter(id => !removedSet.has(id))) }));
      setNotice(`${removed.length} mot(s) supprimé(s).${removed.length !== ids.length ? ' Certains mots n’ont pas pu être supprimés : vérifie tes droits.' : ''}`);
    } catch (error) { setNotice(`Suppression impossible : ${errorMessage(error)}`); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function signOut() {
    if (busyRef.current) return;
    if (run && !window.confirm('Quitter la série et te déconnecter ?')) return;
    busyRef.current = true; setBusy(true);
    try {
      if (!await progress.flush()) throw new Error('Progression non sauvegardée. Réessaie la sauvegarde avant de te déconnecter.');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) { setNotice(errorMessage(error)); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <>
    <Header onHome={() => navigate('learn')}><div className="meta">{cards.length} cartes · {cards.filter(card => isError(progress.stats[card.id])).length} à revoir</div><div className="who"><span>{user.email}</span><button className="btn link" disabled={busy} onClick={() => void signOut()}>Se déconnecter</button></div></Header>
    <nav className="navigation" aria-label="Menu principal">{pages.map(([key, icon, label]) => <button key={key} className="nav-item" aria-current={page === key ? 'page' : undefined} disabled={busy} onClick={() => navigate(key)}><span aria-hidden="true">{icon}</span>{label}</button>)}</nav>
    <div className="game-bar"><span className="stat-pill">⚡ {game.xp} XP</span><span className="stat-pill">🔥 {streakDays(game.days)} jours</span><span className="stat-pill">🎯 {Math.min(game.daily[today()] ?? 0, 20)}/20 aujourd’hui</span><span className="level">Niveau {Math.floor(game.xp / 200) + 1} · {200 - game.xp % 200} XP avant le suivant</span><button className="sound-toggle" aria-pressed={game.sound} aria-label="Activer les sons" onClick={() => persistGame({ ...game, sound: !game.sound })}>♫ Sons {game.sound ? 'activés' : 'coupés'}</button></div>
    {progress.saveError && <div className="save-error" role="alert">La dernière sauvegarde de progression a échoué. <button className="btn link" onClick={() => void progress.flush()}>Réessayer la sauvegarde</button></div>}
    <main id="view">
      {run ? <QuizPage key={run.id} run={run} onAnswer={(id, ok) => { playSound(ok ? 'correct' : 'wrong', game.sound); return progress.record(id, ok); }} onOverride={(id, previous) => { progress.override(id, previous); playSound('correct', game.sound); }} onFinish={finish} /> : result ? <ResultPage {...result} onRetry={selected => start(selected)} onLearn={() => navigate('learn')} onScores={() => navigate('scores')} /> : <>
        {page === 'learn' && <LearnPage cards={cards} settings={settings} stats={progress.stats} onSettings={changeSettings} onStart={selected => start(selected)} />}
        {page === 'chrono' && <ChronoPage cards={cards} category={chronoCategory} size={chronoSize} onCategory={setChronoCategory} onSize={setChronoSize} onStart={selected => start(selected, true)} onChoose={() => { setLibrary({ query: '', cat: chronoCategory, selected: new Set() }); navigate('words'); }} />}
        {page === 'words' && <LibraryPage rows={rows} filters={library} admin={admin} busy={busy} onFilters={next => { if (!busyRef.current) setLibrary(next); }} onStart={selected => start(selected, true, true)} onDelete={ids => void remove(ids)} />}
        {page === 'scores' && <ScoresPage game={game} onChallenge={() => navigate('chrono')} />}
      </>}
    </main>
    {notice && <p className="notice" role="status">{notice}<button className="btn link" aria-label="Fermer le message" onClick={() => setNotice('')}>Fermer</button></p>}
  </>;
}
