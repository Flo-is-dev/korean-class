import { AppearanceSettings } from '../components/AppearanceSettings';
import { BellIcon, HeadphonesIcon, IconToggle, NoteIcon } from '../components/IconToggle';
import type { AudioPrefs, MusicTrack } from '../types';

const TRACKS: [MusicTrack, string][] = [['calm', 'Douce'], ['rhythm', 'Rythmée'], ['korean', 'Coréenne']];

export function SettingsPage({ email, busy, audio, onAudio, onSignOut, onBack, backLabel = 'Retour' }: {
  email?: string; busy?: boolean; audio?: AudioPrefs; onAudio?: (patch: Partial<AudioPrefs>) => void; onSignOut?: () => void; onBack?: () => void; backLabel?: string;
}) {
  return <>
    {onBack && <button className="btn" onClick={onBack}>{backLabel}</button>}
    <section className="panel"><h2>Préférences</h2><AppearanceSettings>{audio && onAudio && <>
      <IconToggle label="Sons" state={audio.sound ? 'Activés' : 'Tout est coupé'} checked={audio.sound} onChange={sound => onAudio({ sound })}><NoteIcon off={!audio.sound} /></IconToggle>
      <IconToggle label="Effets sonores" state={audio.sound && audio.effects ? 'Activés' : 'Coupés'} checked={audio.sound && audio.effects} disabled={!audio.sound} onChange={effects => onAudio({ effects })}><BellIcon off={!audio.sound || !audio.effects} /></IconToggle>
      <IconToggle label="Musique d’ambiance" state={audio.sound && audio.music ? 'Activée' : 'Coupée'} checked={audio.sound && audio.music} disabled={!audio.sound} onChange={music => onAudio({ music })}><HeadphonesIcon off={!audio.sound || !audio.music} /></IconToggle>
    </>}</AppearanceSettings>
      {audio && onAudio && <fieldset className="field" disabled={!audio.sound || !audio.music}><legend>Musique</legend><div className="seg">{TRACKS.map(([track, label]) => <button key={track} aria-pressed={audio.track === track} onClick={() => onAudio({ track })}>{label}</button>)}</div></fieldset>}
    </section>
    {onSignOut && <section className="panel"><h2>Compte</h2><div className="account"><span>Connecté avec <strong>{email}</strong></span><button className="btn" disabled={busy} onClick={onSignOut}>Se déconnecter</button></div></section>}
  </>;
}
