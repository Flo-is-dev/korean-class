import { AppearanceSettings } from '../components/AppearanceSettings';
import { BellIcon, HeadphonesIcon, IconToggle, NoteIcon } from '../components/IconToggle';
import type { AudioPrefs } from '../types';

export function SettingsPage({ email, busy, audio, onAudio, onSignOut, onBack }: {
  email?: string; busy?: boolean; audio?: AudioPrefs; onAudio?: (patch: Partial<AudioPrefs>) => void; onSignOut?: () => void; onBack?: () => void;
}) {
  return <>
    <div className="page-heading"><p className="eyebrow">TON ESPACE</p><h1>Réglages</h1><p>Choisis l’affichage et l’ambiance qui te conviennent pour apprendre.</p></div>
    <section className="panel"><h2>Préférences</h2><AppearanceSettings>{audio && onAudio && <>
      <IconToggle label="Sons" state={audio.sound ? 'Activés' : 'Tout est coupé'} checked={audio.sound} onChange={sound => onAudio({ sound })}><NoteIcon off={!audio.sound} /></IconToggle>
      <IconToggle label="Effets sonores" state={audio.sound && audio.effects ? 'Activés' : 'Coupés'} checked={audio.sound && audio.effects} disabled={!audio.sound} onChange={effects => onAudio({ effects })}><BellIcon off={!audio.sound || !audio.effects} /></IconToggle>
      <IconToggle label="Musique d’ambiance" state={audio.sound && audio.music ? 'Activée' : 'Coupée'} checked={audio.sound && audio.music} disabled={!audio.sound} onChange={music => onAudio({ music })}><HeadphonesIcon off={!audio.sound || !audio.music} /></IconToggle>
    </>}</AppearanceSettings></section>
    {onSignOut && <section className="panel"><h2>Compte</h2><div className="account"><span>Connecté avec <strong>{email}</strong></span><button className="btn" disabled={busy} onClick={onSignOut}>Se déconnecter</button></div></section>}
    {onBack && <button className="btn" onClick={onBack}>Retour à la connexion</button>}
  </>;
}
