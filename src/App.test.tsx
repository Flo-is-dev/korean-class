import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import App from './App';

const auth = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(), signInWithOAuth: vi.fn(), signOut: vi.fn() }));
const api = vi.hoisted(() => ({ loadCards: vi.fn(), loadStats: vi.fn(), isAdmin: vi.fn(), saveProgress: vi.fn(), deleteCards: vi.fn() }));
vi.mock('./lib/supabase', () => ({ ...api, supabase: { auth }, errorMessage: (error: Error) => error.message }));
vi.mock('./lib/sound', () => ({ playSound: vi.fn() }));
let notify: (event: string, session: Session | null) => void;
const unsubscribe = vi.fn();
beforeEach(() => {
  auth.getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
  auth.onAuthStateChange.mockImplementation(callback => { notify = callback; return { data: { subscription: { unsubscribe } } }; });
  auth.signInWithPassword.mockReset().mockResolvedValue({ error: null });
  auth.signUp.mockReset().mockResolvedValue({ data: { session: null }, error: null });
  auth.signInWithOAuth.mockReset().mockResolvedValue({ error: null });
  api.loadCards.mockReset().mockResolvedValue([]); api.loadStats.mockReset().mockResolvedValue({}); api.isAdmin.mockReset().mockResolvedValue(false);
  api.saveProgress.mockReset().mockResolvedValue(undefined);
});
describe('authentication and account lifecycle', () => {
  it('submits login, handles confirmation errors and allows retry', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ error: { message: 'Email not confirmed' } });
    render(<App />);
    fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: 'test@example.test' } });
    fireEvent.change(screen.getByLabelText(/Mot de passe/), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    await screen.findByText(/Confirme ton e-mail/);
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'test@example.test', password: 'password' });
    expect((screen.getByRole('button', { name: 'Se connecter' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('supports registration and Google redirects', async () => {
    render(<App />);
    fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: 'test@example.test' } });
    fireEvent.change(screen.getByLabelText(/Mot de passe/), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer un compte' }));
    await screen.findByText(/Compte créé/);
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'test@example.test' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer avec Google' }));
    await waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }));
  });
  it('isolates account state and unsubscribes on unmount', async () => {
    localStorage.setItem('haru:game:first', JSON.stringify({ xp: 400, days: [], scores: [], sound: false, daily: {} }));
    const view = render(<App />); await screen.findByText('Connexion');
    await act(async () => notify('SIGNED_IN', { user: { id: 'first', email: 'first@example.test' } } as Session));
    await screen.findByText('⚡ 400 XP');
    await act(async () => notify('SIGNED_IN', { user: { id: 'second', email: 'second@example.test' } } as Session));
    await screen.findByText('⚡ 0 XP'); expect(screen.queryByText('⚡ 400 XP')).toBeNull();
    await act(async () => notify('SIGNED_OUT', null)); await screen.findByText('Connexion');
    view.unmount(); expect(unsubscribe).toHaveBeenCalled();
  });
  it('shows data loading failures with a working retry', async () => {
    api.loadCards.mockRejectedValueOnce(new Error('Connexion interrompue'));
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'first', email: 'first@example.test' } } }, error: null });
    render(<App />); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await screen.findByRole('navigation'); expect(api.loadCards).toHaveBeenCalledTimes(2);
  });
});
