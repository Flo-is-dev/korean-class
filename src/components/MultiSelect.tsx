import { useEffect, useRef, useState } from 'react';

// A compact multiple-choice select: one line when closed, a checklist when open. At least one option stays selected.
export function MultiSelect<T extends string>({ label, options, selected, onChange }: {
  label: string; options: { value: T; label: string; count: number }[]; selected: T[]; onChange: (selected: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const pointerdown = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', pointerdown); document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('pointerdown', pointerdown); document.removeEventListener('keydown', keydown); };
  }, [open]);
  const chosen = options.filter(option => selected.includes(option.value));
  const names = chosen.map(option => option.label).join(', ');
  function toggle(value: T) {
    const next = selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value];
    if (next.length) onChange(next);
  }
  return <div className="multi" ref={root}>
    <button type="button" className="multi-trigger" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label} : ${names}`} onClick={() => setOpen(!open)}>
      <span className="multi-value">{names}</span><span className="n">{chosen.reduce((sum, option) => sum + option.count, 0)}</span>
    </button>
    {open && <div className="multi-list" role="listbox" aria-multiselectable="true" aria-label={label}>
      {options.map(option => <button type="button" key={option.value} className="multi-option" role="option" aria-selected={selected.includes(option.value)} onClick={() => toggle(option.value)}>
        <span className="multi-check" aria-hidden="true" />{option.label}<span className="n">{option.count}</span>
      </button>)}
    </div>}
  </div>;
}
