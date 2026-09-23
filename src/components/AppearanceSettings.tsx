import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { applyAppearance, KOREAN_FONTS, readLocalAppearance, writeLocalAppearance } from '../lib/appearance';
import type { Appearance } from '../lib/appearance';
import { loadAppearance, saveAppearance } from '../lib/appearance-api';

interface AppearanceContextValue {
  value: Appearance;
  ready: boolean;
  notSynced: boolean;
  change: (patch: Partial<Appearance>) => void;
}
const AppearanceContext = createContext<AppearanceContextValue | null>(null);

// Keyed by account in App: a late request never changes another account's UI.
export function AppearanceProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [value, setValue] = useState(readLocalAppearance);
  const latest = useRef(value);
  const [ready, setReady] = useState(!userId);
  const [notSynced, setNotSynced] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    applyAppearance(latest.current);
    if (userId) {
      void loadAppearance(userId).then(saved => {
        if (!active) return;
        latest.current = saved; setValue(saved); applyAppearance(saved); writeLocalAppearance(saved);
      }).catch(() => { if (active) setNotSynced(true); })
        .finally(() => { if (active) setReady(true); });
    }
    return () => { active = false; mounted.current = false; clearTimeout(timer.current); };
  }, [userId]);

  function change(patch: Partial<Appearance>) {
    if (!ready) return;
    const next = { ...latest.current, ...patch };
    latest.current = next; setValue(next); applyAppearance(next); writeLocalAppearance(next);
    const version = ++revision.current;
    clearTimeout(timer.current);
    if (!userId) return;
    timer.current = setTimeout(() => {
      // Serialize network writes even when a previous save takes longer than the debounce.
      chain.current = chain.current.then(async () => {
        if (!mounted.current || version !== revision.current) return;
        try {
          await saveAppearance(userId, next);
          if (mounted.current && version === revision.current) setNotSynced(false);
        } catch {
          if (mounted.current && version === revision.current) setNotSynced(true);
        }
      });
    }, 500);
  }
  return <AppearanceContext.Provider value={{ value, ready, notSynced, change }}>{children}</AppearanceContext.Provider>;
}

export function AppearanceSettings() {
  const context = useContext(AppearanceContext);
  if (!context) return null;
  const { value, ready, notSynced, change } = context;
  return <details className="panel appearance-settings" onKeyDown={event => event.stopPropagation()}>
    <summary>Réglages</summary>
    <div className="appearance-content">
      <fieldset className="field" disabled={!ready}>
        <legend>Police coréenne</legend>
        <div className="font-options">{KOREAN_FONTS.map(font => <label key={font.value} className="font-option">
          <input type="radio" name="ko-font" value={font.value} checked={value.ko_font === font.value} onChange={() => change({ ko_font: font.value })} />
          <span>{font.label}</span><span className="font-preview" lang="ko" data-ko-font={font.value}>한국어 공부</span>
        </label>)}</div>
      </fieldset>
      <label className="toggle"><span><strong>Mode sombre</strong></span><input type="checkbox" role="switch" checked={value.theme === 'dark'} disabled={!ready} onChange={event => change({ theme: event.target.checked ? 'dark' : 'light' })} /></label>
      {!ready && <p className="note" role="status">Chargement des réglages…</p>}
      {notSynced && <p className="note settings-sync" role="status">Réglage non synchronisé</p>}
    </div>
  </details>;
}
