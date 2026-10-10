import type { ReactNode } from 'react';
import { Mascot } from './Mascot';

export function Header({ children, onHome, onSettings, settings }: { children?: ReactNode; onHome?: () => void; onSettings?: () => void; settings?: boolean }) {
  return <header className="top"><button type="button" className="brand" onClick={onHome} aria-label="Haru, accueil"><Mascot className="brand-mark" /><span>haru<span className="brand-sub">LE CORÉEN, CHAQUE JOUR</span></span></button>{children}
    {onSettings && <button type="button" className="user-button" aria-label="Réglages" aria-current={settings ? 'page' : undefined} onClick={onSettings}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" /></svg></button>}
  </header>;
}
