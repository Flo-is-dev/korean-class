import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Book, BookFilter, Card, LevelFilter, CardRow, Category, Game, GrammarPoint, LibraryFilters, Page, QuizResult, QuizRun, Settings, Stats } from './types';
import { Header } from './components/Header';
import { Icon } from './components/Icon';
import { GameBar } from './components/GameBar';
import type { IconName } from './components/Icon';
import { LearnPage } from './pages/LearnPage';
import { ChronoPage } from './pages/ChronoPage';
import { GrammarPage } from './pages/GrammarPage';
import { LibraryPage } from './pages/LibraryPage';
import { ScoresPage } from './pages/ScoresPage';
import { QuizPage } from './pages/QuizPage';
import { ResultPage } from './pages/ResultPage';
import { SettingsPage } from './pages/SettingsPage';
import { validateBookFilter } from './lib/books';
import { levelsOf, validateLevelFilter } from './lib/levels';
import { buildCards, isError, isMastered } from './lib/cards';
import { loadBookFilter, loadGame, loadLevelFilter, loadSettings, saveBookFilter, saveGame, saveLevelFilter, saveSettings } from './lib/storage';
import { rewardSession } from './lib/game';
import { deleteCards, errorMessage, supabase } from './lib/supabase';
import { playSound, setMusic } from './lib/sound';
import { useProgress } from './hooks/useProgress';

const pages: [Page, IconName, string][] = [['learn', 'cards', 'Apprendre'], ['chrono', 'stopwatch', 'Chrono'], ['grammar', 'grammar', 'Grammaire'], ['words', 'book', 'Mes mots'], ['scores', 'trophy', 'Scores']];

export function Workspace({ user, initialRows, initialStats, admin, books }: { books: Book[] | null; user: User; initialRows: CardRow[]; initialStats: Stats; admin: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const cards = useMemo(() => buildCards(rows), [rows]);
  const progress = useProgress(initialStats);
  const [page, setPage] = useState<Page>('learn');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(loadSettings);
  const [game, setGame] = useState(() => loadGame(user.id));
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [run, setRun] = useState<QuizRun | null>(null);
  const [result, setResult] = useState<{ result: QuizResult; reward: string } | null>(null);
  const viewRef = useRef<HTMLElement>(null);
  useEffect(() => { if (viewRef.current) viewRef.current.scrollTop = 0; }, [page, settingsOpen, run?.id, result]);
  const [chronoCategory, setChronoCategory] = useState<Category>('verbs');
  const [chronoSize, setChronoSize] = useState(20);
  const [library, setLibrary] = useState<LibraryFilters>(() => ({ query: '', cat: 'all', book: loadBookFilter(books, initialRows), level: loadLevelFilter(), status: 'all', selected: new Set() }));
  useEffect(() => {
    if (books === null) return;
    const book = validateBookFilter(library.book, books, rows);
    if (book !== library.book) {
      setLibrary(current => ({ ...current, book }));
      saveBookFilter(book);
    }
  }, [books, rows, library.book]);
  // One book filter for the whole app; it is ignored while the catalogue is unavailable.
  const book = books === null ? 'all' : library.book;
  function changeBook(next: BookFilter) {
    if (busyRef.current) return;
    setLibrary(current => ({ ...current, book: next }));
    saveBookFilter(next);
  }
  // Likewise one level filter; a level no card has any more falls back to all levels.
  const levels = useMemo(() => levelsOf(rows), [rows]);
  const level = validateLevelFilter(library.level, levels);
  function changeLevel(next: LevelFilter) {
    if (busyRef.current) return;
    setLibrary(current => ({ ...current, level: next }));
    saveLevelFilter(next);
  }
  const effects = game.sound && game.effects;
  const music = game.sound && game.music ? game.track : null;
  useEffect(() => { setMusic(music); return () => setMusic(null); }, [music]);
  // The grammar detail is a history entry, so the browser or phone back button returns to the list.
  const [grammar, setGrammar] = useState<GrammarPoint[] | null>(null);
  const [grammarDetail, setGrammarDetail] = useState<string | null>(null);
  useEffect(() => {
    const popstate = (event: PopStateEvent) => setGrammarDetail(event.state?.grammar ?? null);
    window.addEventListener('popstate', popstate);
    return () => window.removeEventListener('popstate', popstate);
  }, []);
  function openGrammar(id: string) { history.pushState({ grammar: id }, ''); setGrammarDetail(id); }
  function closeGrammar() { if (history.state?.grammar) history.back(); setGrammarDetail(null); }
  const sequence = useRef(0);
  const awarded = useRef(new Set<number>());
  // Words already mastered when the series starts, to tell the ones it has just taught.
  const masteredBefore = useRef(new Set<string>());

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
    closeGrammar(); setRun(null); setResult(null); setPage(next); setSettingsOpen(false); void progress.flush();
  }
  function start(selected: Card[], timed = false, custom = false, direction = settings.direction) {
    if (!selected.length || busyRef.current) return;
    playSound('tap', effects);
    setResult(null);
    masteredBefore.current = new Set(selected.filter(card => isMastered(progress.stats[card.id])).map(card => card.id));
    setRun({ id: ++sequence.current, cards: selected, mode: timed ? 'mcq' : settings.mode, timed, custom, direction });
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
  async function unmaster(id: string) {
    if (busyRef.current) return;
    if (!window.confirm('Retirer ce mot des mots appris ? Son score repartira à 0.')) return;
    try {
      if (!await progress.flush()) throw new Error('la progression en attente n’a pas pu être sauvegardée.');
      await progress.unmaster(id);
    } catch (error) { setNotice(`Impossible de retirer ce mot des mots appris : ${errorMessage(error)}`); }
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
    <GameBar game={game} />
    {progress.saveError && <div className="save-error" role="alert">Réponse non enregistrée : elle sera renvoyée avec la suivante. <button className="btn link" onClick={() => void progress.flush()}>Réessayer la sauvegarde</button></div>}
    <main id="view" ref={viewRef}>
      {settingsOpen && <SettingsPage email={user.email} busy={busy} audio={game} onAudio={patch => persistGame({ ...game, ...patch })} onSignOut={() => void signOut()} onBack={() => setSettingsOpen(false)} backLabel={run ? 'Reprendre la série' : 'Retour'} />}
      <div className="view-body" hidden={settingsOpen}>{run ? <QuizPage key={run.id} run={run} pool={cards} paused={settingsOpen} onAnswer={(id, ok) => { playSound(ok ? 'correct' : 'wrong', effects); return progress.record(id, ok, !ok && run.mode === 'type' && !run.timed); }} onOverride={id => { progress.override(id); playSound('correct', effects); }} onFinish={finish} onSound={kind => playSound(kind, effects)} /> : result ? <ResultPage {...result} learned={result.result.run.cards.filter(card => isMastered(progress.stats[card.id]) && !masteredBefore.current.has(card.id))} onRetry={selected => start(selected, false, false, result.result.run.direction)} onLearn={() => navigate('learn')} onScores={() => navigate('scores')} /> : <>
        {page === 'learn' && <LearnPage books={books} book={book} onBook={changeBook} levels={levels} level={level} onLevel={changeLevel} cards={cards} settings={settings} stats={progress.stats} onSettings={changeSettings} onStart={selected => start(selected)} />}
        {page === 'chrono' && <ChronoPage books={books} book={book} onBook={changeBook} levels={levels} level={level} onLevel={changeLevel} cards={cards} stats={progress.stats} category={chronoCategory} size={chronoSize} direction={settings.direction} onDirection={direction => changeSettings({ ...settings, direction })} onCategory={setChronoCategory} onSize={setChronoSize} onStart={selected => start(selected, true)} onChoose={() => { setLibrary(current => ({ ...current, query: '', cat: chronoCategory, selected: new Set() })); navigate('words'); }} />}
        {page === 'grammar' && <GrammarPage books={books} points={grammar} cards={cards} detail={grammarDetail} onLoaded={setGrammar} onOpen={openGrammar} onBack={closeGrammar} onStart={selected => start(selected)} />}
        {page === 'words' && <LibraryPage books={books} levels={levels} rows={rows} stats={progress.stats} onUnmaster={id => void unmaster(id)} filters={{ ...library, level }} admin={admin} busy={busy} direction={settings.direction} onDirection={direction => changeSettings({ ...settings, direction })} onFilters={next => { if (!busyRef.current) { setLibrary(next); if (next.book !== library.book) saveBookFilter(next.book); if (next.level !== level) saveLevelFilter(next.level); } }} onStart={selected => start(selected, true, true)} onDelete={ids => void remove(ids)} />}
        {page === 'scores' && <ScoresPage game={game} onChallenge={() => navigate('chrono')} />}
      </>}</div>
    {notice && <p className="notice" role="status">{notice}<button className="btn link" aria-label="Fermer le message" onClick={() => setNotice('')}>Fermer</button></p>}
    </main>
    <nav className="navigation" aria-label="Menu principal">{pages.map(([key, icon, label]) => <button key={key} className="nav-item" aria-current={page === key && !settingsOpen ? 'page' : undefined} disabled={busy} onClick={() => navigate(key)}><Icon name={icon} size={30} />{label}</button>)}</nav>
  </>;
}
