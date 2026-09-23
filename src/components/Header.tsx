import type { ReactNode } from 'react';

export function Header({ children, onHome }: { children?: ReactNode; onHome?: () => void }) {
  return <header className="top"><button type="button" className="brand" onClick={onHome} aria-label="Haru, accueil"><span className="brand-mark">하</span><span>haru<span className="brand-sub">LE CORÉEN, CHAQUE JOUR</span></span></button>{children}</header>;
}
