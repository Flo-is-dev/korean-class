import { useEffect, useRef, useState } from 'react';
import type { Chinese } from '../types';

// Chinese cognate shown next to a Korean word: the characters open a bubble with the pinyin and the note.
export function Hanzi({ zh, showPinyin = false }: { zh: Chinese; showPinyin?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const pointerdown = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', pointerdown); document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('pointerdown', pointerdown); document.removeEventListener('keydown', keydown); };
  }, [open]);
  const pinyin = zh.pinyin && <span lang="zh-Latn">{zh.pinyin}</span>;
  return <span className="zh" ref={root}>
    {zh.pinyin || zh.note
      ? <button type="button" className="zh-chars" lang="zh-Hans" title="Afficher le pinyin" aria-expanded={open} onClick={() => setOpen(!open)}>{zh.hanzi}</button>
      : <span className="zh-chars" lang="zh-Hans">{zh.hanzi}</span>}
    {showPinyin && zh.pinyin && <span className="zh-pinyin" lang="zh-Latn">{zh.pinyin}</span>}
    {open && <span className="zh-bubble" role="status" onClick={event => event.preventDefault()}>{pinyin && <strong>{pinyin}</strong>}{zh.note && <small>{zh.note}</small>}</span>}
  </span>;
}
