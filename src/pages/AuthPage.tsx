import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Hero } from '../components/Hero';
import { supabase, errorMessage } from '../lib/supabase';

export function AuthPage({ initialError = '' }: { initialError?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialError);
  const [failed, setFailed] = useState(!!initialError);
  useEffect(() => { if (initialError) { setMessage(initialError); setFailed(true); } }, [initialError]);
  async function authenticate(kind: 'login' | 'signup' | 'google') {
    if (busy) return;
    setBusy(true); setFailed(false); setMessage('Connexion…');
    try {
      const redirectTo = location.origin + location.pathname;
      if (kind === 'google') {
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
        if (error) throw error;
        setMessage('Redirection vers Google…'); return;
      }
      if (!email.trim() || !password) throw new Error('Saisis ton e-mail et ton mot de passe.');
      if (kind === 'signup') {
        if (password.length < 6) throw new Error('Choisis un mot de passe d’au moins 6 caractères.');
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        if (!data.session) setMessage('Compte créé. Confirme ton e-mail avec le lien reçu, puis connecte-toi ici.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(/confirm/i.test(error.message) ? 'Confirme ton e-mail avec le lien reçu, puis reconnecte-toi.' : 'E-mail ou mot de passe incorrect.');
      }
    } catch (error) { setFailed(true); setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void authenticate('login'); }
  return <>
    <Hero title="Le coréen commence par un petit pas." subtitle="Retrouve tes mots, relève des défis et progresse un peu chaque jour." bubble="환영해!" />
    <section className="panel">
      <h2>Connexion</h2><p className="note">Connecte-toi pour retrouver tes cartes et tes erreurs sur tous tes appareils.</p>
      <button className="btn google" disabled={busy} onClick={() => void authenticate('google')}>Continuer avec Google</button>
      <div className="divider" role="separator"><span>ou avec ton e-mail</span></div>
      <form className="auth-form" onSubmit={submit}>
        <label>E-mail<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
        <label>Mot de passe (6 caractères minimum)<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
        {message && <p role="status" className={`auth-msg ${failed ? 'error' : 'ok'}`}>{message}</p>}
        <div className="row"><button className="btn primary" disabled={busy} type="submit">Se connecter</button><button className="btn" disabled={busy} type="button" onClick={() => void authenticate('signup')}>Créer un compte</button></div>
      </form>
    </section>
  </>;
}
