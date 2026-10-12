import type { Direction } from '../types';

// Compact toggle: pressed, the series asks the Korean word (한) and expects the French one (불).
export function DirectionSwitch({ value, onChange }: { value: Direction; onChange: (direction: Direction) => void }) {
  const reverse = value === 'ko-fr';
  return <button type="button" className="btn direction-toggle" aria-pressed={reverse} aria-label="Coréen vers français" title={reverse ? 'Sens : coréen → français' : 'Sens : français → coréen'} onClick={() => onChange(reverse ? 'fr-ko' : 'ko-fr')}><span lang="ko" aria-hidden="true">한 / 불</span></button>;
}
