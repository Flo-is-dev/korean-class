import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Book, Card, CardRow, Category, Game, LibraryFilters, Page, QuizResult, QuizRun, Settings, Stats } from './types';
import { Header } from './components/Header';
import { Icon } from './components/Icon';
import type { IconName } from './components/Icon';
import { LearnPage } from './pages/LearnPage';
import { ChronoPage } from './pages/ChronoPage';
import { LibraryPage } from './pages/LibraryPage';
import { ScoresPage } from './pages/ScoresPage';
import { QuizPage } from './pages/QuizPage';
import { ResultPage } from './pages/ResultPage';
import { SettingsPage } from './pages/SettingsPage';
import { validateBookFilter } from './lib/books';
import { buildCards, isError } from './lib/cards';
import { loadBookFilter, loadGame, loadSettings, saveBookFilter, saveGame, saveSettings } from './lib/storage';
import { rewardSession, streakDays, today } from './lib/game';
import { deleteCards, errorMessage, supabase } from './lib/supabase';
import { playSound, setMusic } from './lib/sound';
import { useProgress } from './hooks/useProgress';

const pages: [Page, IconName, string][] = [['learn', 'cards', 'Apprendre'], ['chrono', 'stopwatch', 'Chrono'], ['words', 'book', 'Mes mots'], ['scores', 'trophy', 'Scores']];

export function Workspace({ user, initialRows, initialStats, admin, books }: { books: Book[] | null; user: User; initialRows: CardRow[]; initialStats: Stats; admin: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const cards = useMemo(() => buildCards(rows), [rows]);
  const progress = useProgress(user.id, initialStats);
  const [page, setPage] = useState<Page>('learn');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(loadSettings);
  const [game, setGame] = useState(() => loadGame(user.id));
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [run, setRun] = useState<QuizRun | null>(null);
  const [result, setResult] = useState<{ result: QuizResult; reward: string } | null>(null);
  const [chronoCategory, setChronoCategory] = useState<Category>('verbs');
  const [chronoSize, setChronoSize] = useState(20);
  const [library, setLibrary] = useState<LibraryFilters>(() => ({ query: '', cat: 'all', book: loadBookFilter(books, initialRows), selected: new Set() }));
  useEffect(() => {
    if (books === null) return;
    const book = validateBookFilter(library.book, books, rows);
    if (book !== library.book) {
      setLibrary(current => ({ ...current, book }));
      saveBookFilter(book);
    }
  }, [books, rows, library.book]);
  const effects = game.sound && game.effects;
  const music = game.sound && game.music ? game.track : null;
  useEffect(() => { setMusic(music); return () => setMusic(null); }, [music]);
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
    setRun(null); setResult(null); setPage(next); setSettingsOpen(false); void progress.flush();
  }
  function start(selected: Card[], timed = false, custom = false) {
    if (!selected.length || busyRef.current) return;
    playSound('tap', effects);
    setResult(null);
    setRun({ id: ++sequence.current, cards: selected, mode: timed ? 'mcq' : settings.mode, timed, custom });
  }
  function finish(completed: QuizResult) {
    if (awarded.current.has(completed.run.id)) return;
    awarded.current.add(completed.run.id);
    const rewarded = rewardSession(game, completed);
    if (completed.completed) { persistGame(rewarded.game); playSound('complete', effects); }
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
    <Header onHome={() => navigate('learn')} onSettings={() => setSettingsOpen(!settingsOpen)} settings={settingsOpen}><div className="meta"><span>{cards.length} cartes · {cards.filter(card => isError(progress.stats[card.id])).length} à revoir</span><span>Niveau {Math.floor(game.xp / 200) + 1} · {200 - game.xp % 200} XP avant le suivant</span></div></Header>
    <nav className="navigation" aria-label="Menu principal">{pages.map(([key, icon, label]) => <button key={key} className="nav-item" aria-current={page === key && !settingsOpen ? 'page' : undefined} disabled={busy} onClick={() => navigate(key)}><Icon name={icon} size={26} />{label}</button>)}</nav>
    <div className="game-bar"><span className="stat-pill"><Icon name="bolt" />{game.xp} XP</span><span className="stat-pill"><Icon name="flame" />{streakDays(game.days)} jours</span><span className="stat-pill"><Icon name="target" />{Math.min(game.daily[today()] ?? 0, 20)}/20 aujourd’hui</span></div>
    {progress.saveError && <div className="save-error" role="alert">La dernière sauvegarde de progression a échoué. <button className="btn link" onClick={() => void progress.flush()}>Réessayer la sauvegarde</button></div>}
    <main id="view">
      {settingsOpen && <SettingsPage email={user.email} busy={busy} audio={game} onAudio={patch => persistGame({ ...game, ...patch })} onSignOut={() => void signOut()} onBack={() => setSettingsOpen(false)} backLabel={run ? 'Reprendre la série' : 'Retour'} />}
      <div className="view-body" hidden={settingsOpen}>{run ? <QuizPage key={run.id} run={run} pool={cards} paused={settingsOpen} onAnswer={(id, ok) => { playSound(ok ? 'correct' : 'wrong', effects); return progress.record(id, ok); }} onOverride={(id, previous) => { progress.override(id, previous); playSound('correct', effects); }} onFinish={finish} onSound={kind => playSound(kind, effects)} /> : result ? <ResultPage {...result} onRetry={selected => start(selected)} onLearn={() => navigate('learn')} onScores={() => navigate('scores')} /> : <>
        {page === 'learn' && <LearnPage cards={cards} settings={settings} stats={progress.stats} onSettings={changeSettings} onStart={selected => start(selected)} />}
        {page === 'chrono' && <ChronoPage cards={cards} category={chronoCategory} size={chronoSize} onCategory={setChronoCategory} onSize={setChronoSize} onStart={selected => start(selected, true)} onChoose={() => { setLibrary(current => ({ ...current, query: '', cat: chronoCategory, selected: new Set() })); navigate('words'); }} />}
        {page === 'words' && <LibraryPage books={books} rows={rows} filters={library} admin={admin} busy={busy} onFilters={next => { if (!busyRef.current) { setLibrary(next); if (next.book !== library.book) saveBookFilter(next.book); } }} onStart={selected => start(selected, true, true)} onDelete={ids => void remove(ids)} />}
        {page === 'scores' && <ScoresPage game={game} onChallenge={() => navigate('chrono')} />}
      </>}</div>
    </main>
    {notice && <p className="notice" role="status">{notice}<button className="btn link" aria-label="Fermer le message" onClick={() => setNotice('')}>Fermer</button></p>}
  </>;
}
