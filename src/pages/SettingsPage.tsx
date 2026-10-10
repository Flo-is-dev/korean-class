import { AppearanceSettings } from '../components/AppearanceSettings';
import { IconToggle, NoteIcon } from '../components/IconToggle';

export function SettingsPage({ email, busy, sound, onSound, onSignOut, onBack }: { email?: string; busy?: boolean; sound?: boolean; onSound?: (sound: boolean) => void; onSignOut?: () => void; onBack?: () => void }) {
  return <>
    <div className="page-heading"><p className="eyebrow">TON ESPACE</p><h1>Réglages</h1><p>Choisis l’affichage et l’ambiance qui te conviennent pour apprendre.</p></div>
    <section className="panel"><h2>Préférences</h2><AppearanceSettings>{onSound && <IconToggle label="Sons" state={sound ? 'Activés' : 'Coupés'} checked={!!sound} onChange={onSound}><NoteIcon off={!sound} /></IconToggle>}</AppearanceSettings></section>
    {onSignOut && <section className="panel"><h2>Compte</h2><div className="account"><span>Connecté avec <strong>{email}</strong></span><button className="btn" disabled={busy} onClick={onSignOut}>Se déconnecter</button></div></section>}
    {onBack && <button className="btn" onClick={onBack}>Retour à la connexion</button>}
  </>;
}
