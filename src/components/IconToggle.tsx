import type { ReactNode } from 'react';

const icon = (children: ReactNode) => <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;

export const SunIcon = () => icon(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
export const MoonIcon = () => icon(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />);
export const NoteIcon = ({ off = false }: { off?: boolean }) => icon(<><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />{off && <path d="M3 3l18 18" />}</>);

export function IconToggle({ label, state, checked, disabled, onChange, children }: { label: string; state: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return <label className="toggle"><span><strong>{label}</strong><small>{state}</small></span><button type="button" role="switch" className="icon-toggle" aria-label={label} aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}>{children}</button></label>;
}
