import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Book, CardRow, Stats } from './types';
import { Header } from './components/Header';
import { AppearanceProvider, AppearanceSettings } from './components/AppearanceSettings';
import { AuthPage } from './pages/AuthPage';
import { Workspace } from './Workspace';
import { errorMessage, isAdmin, loadBooks, loadCards, loadStats, supabase } from './lib/supabase';

function UserWorkspace({ user }: { user: User }) {
  const [data, setData] = useState<{ rows: CardRow[]; stats: Stats; admin: boolean; books: Book[] | null } | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    const booksRequest = loadBooks().catch(failure => {
      console.error('Chargement des livres impossible :', failure);
      return null;
    });
    void Promise.all([loadCards(), loadStats(user.id), isAdmin(user.id), booksRequest]).then(([rows, stats, admin, books]) => {
      if (active) setData({ rows, stats, admin, books });
    }).catch(failure => { if (active) setError(errorMessage(failure)); });
    return () => { active = false; };
  }, [user.id, attempt]);
  if (data) return <Workspace user={user} initialRows={data.rows} initialStats={data.stats} admin={data.admin} books={data.books} />;
  return <><Header /><main id="view"><section className="panel">{error ? <><p className="error" role="alert">{error}</p><button className="btn primary" onClick={() => setAttempt(attempt + 1)}>Réessayer</button><button className="btn link" onClick={() => void supabase.auth.signOut().then(({ error }) => { if (error) setError(error.message); })}>Se déconnecter</button></> : <p className="loading" role="status">Chargement de tes cartes…</p>}</section></main></>;
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [error, setError] = useState(() => new URLSearchParams(location.search).get('error_description') || new URLSearchParams(location.hash.slice(1)).get('error_description') || '');
  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) { receivedEvent = true; setUser(session?.user ?? null); }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setError(error.message);
      if (!receivedEvent) setUser(data.session?.user ?? null);
      const url = new URL(location.href);
      if (url.searchParams.has('code') || url.searchParams.has('error_description') || url.hash.includes('access_token') || url.hash.includes('error_description')) history.replaceState(null, '', url.pathname);
    }).catch(failure => { if (active) { setError(errorMessage(failure)); setUser(null); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  return <AppearanceProvider key={user?.id ?? 'guest'} userId={user?.id ?? null}><div className="app">{user ? <UserWorkspace key={user.id} user={user} /> : <><Header /><main id="view">{user === undefined ? <section className="panel"><p className="loading" role="status">Chargement…</p></section> : <AuthPage initialError={error} />}</main></>}<AppearanceSettings /></div></AppearanceProvider>;
}
