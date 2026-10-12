const INK = '#302d43', AMBER = '#ffc531', CORAL = '#ff8a5c', LEAF = '#62c07f', CREAM = '#fffaf0', VIOLET = '#9b82f3';
const line = { stroke: INK, strokeWidth: 1.6, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
const mark = { ...line, fill: 'none' } as const;

// Sticker icons: flat fills, ink outlines and the same hard offset shadow as the buttons.
const art = {
  bolt: <path d="M13.6 1.8 4.6 13.2h5.6l-1.4 9 9.6-12h-5.8z" fill={AMBER} {...line} />,
  flame: <>
    <path d="M12 2c1.2 3.6 6 6.2 6 12a6 6 0 0 1-12 0c0-2.6 1.1-4.2 2.4-5.5.3 1.8 1.1 2.8 2.2 3.3C10.2 8.6 10.5 4.8 12 2z" fill={CORAL} {...line} />
    <path d="M12 12.6c1.1 1.2 2.2 2.1 2.2 3.5a2.2 2.2 0 0 1-4.4 0c0-1.4 1.1-2.3 2.2-3.5z" fill={AMBER} {...line} strokeWidth={1.3} />
  </>,
  target: <>
    <circle cx="11.5" cy="12.5" r="9.5" fill={CREAM} {...line} />
    <circle cx="11.5" cy="12.5" r="5.8" fill={CORAL} {...line} />
    <circle cx="11.5" cy="12.5" r="2" fill={INK} />
    <path d="M11.5 12.5 19.6 4.4" {...mark} />
    <path d="M17.4 2.6h4v4l-1.4-1.3-1.2-1.3z" fill={AMBER} {...line} strokeWidth={1.3} />
  </>,
  sprout: <>
    <path d="M12 19.6V10.6" {...mark} strokeWidth={3.2} />
    <path d="M12 19.6V10.6" {...mark} stroke={LEAF} strokeWidth={1.2} />
    <path d="M12 14C8 14 5 12 4.5 8c4 0 7 1.6 7.5 6z" fill={LEAF} {...line} />
    <path d="M12 11.4c0-4 2.6-6.6 7.5-7 .2 4.6-2.6 7.2-7.5 7z" fill={LEAF} {...line} />
    <path d="M4.5 21.6c1.6-3 13.4-3 15 0z" fill={AMBER} {...line} />
  </>,
  trophy: <>
    <path d="M10.4 20h3.2l-.5-6.4h-2.2z" fill={CORAL} {...line} />
    <rect x="7" y="19.6" width="10" height="2.6" rx="1.1" fill={CORAL} {...line} />
    <path d="M7.2 4.6H3.6c0 3.4 1.4 5.4 3.9 6z" fill={AMBER} {...line} />
    <path d="M16.8 4.6h3.6c0 3.4-1.4 5.4-3.9 6z" fill={AMBER} {...line} />
    <path d="M6.8 2.6h10.4v6.2a5.2 5.2 0 0 1-10.4 0z" fill={AMBER} {...line} />
    <path d="M12 4.8l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z" fill={CREAM} {...line} strokeWidth={1} />
  </>,
  medal: <>
    <path d="M7.4 2.2h4l2 6h-4z" fill={VIOLET} {...line} />
    <path d="M16.6 2.2h-4l-2 6h4z" fill={CORAL} {...line} />
    <circle cx="12" cy="15" r="6.6" fill={AMBER} {...line} />
    <path d="M10.8 13.4l1.6-1.2v5.8" {...mark} strokeWidth={1.5} />
  </>,
  stopwatch: <>
    <rect x="10" y="1.8" width="4" height="3.4" rx="1" fill={CORAL} {...line} />
    <circle cx="12" cy="13.6" r="8.4" fill={LEAF} {...line} />
    <circle cx="12" cy="13.6" r="5.4" fill={CREAM} {...line} strokeWidth={1.3} />
    <path d="M12 10.4v3.2l2.2 1.6" {...mark} strokeWidth={1.5} />
  </>,
  cards: <>
    <rect x="3.4" y="6.4" width="10.6" height="14" rx="2" transform="rotate(-9 8.7 13.4)" fill={CORAL} {...line} />
    <g transform="rotate(7 15 12)">
      <rect x="9.6" y="4.2" width="11" height="15.2" rx="2" fill={AMBER} {...line} />
      <path d="M12.2 9h3.1c0 2.7-.9 4.6-3 5.9M18 7.9v8M18 11.8h1.4" {...mark} strokeWidth={1.5} />
    </g>
  </>,
  book: <>
    <path d="M12 6.4C10 4.9 7.5 4.4 3.4 4.4v13.2c4.1 0 6.6.5 8.6 2z" fill={CORAL} {...line} />
    <path d="M12 6.4c2-1.5 4.5-2 8.6-2v13.2c-4.1 0-6.6.5-8.6 2z" fill={CREAM} {...line} />
    <path d="M14.6 9.4c1.2-.5 2.3-.7 3.6-.7M14.6 12.6c1.2-.5 2.3-.7 3.6-.7" {...mark} strokeWidth={1.3} />
  </>,
  grammar: <>
    <rect x="2.6" y="6" width="9.4" height="12" rx="2" fill={AMBER} {...line} />
    <rect x="12" y="6" width="9.4" height="12" rx="2" fill={CREAM} {...line} />
    <path d="M5.4 10h3.6c0 2.2-.8 3.8-2.6 4.8M15 11h3.6M15 14h2.2" {...mark} strokeWidth={1.4} />
  </>,
};
// Haru's navigation: hand-drawn hangul cards, a split dial, a stem tile joined to its ending,
// a bound notebook, and a small star cup. Colors inherit the active Pop / dark palette.
const navigationArt = {
  grammar: <>
    <path className="icon-soft-shadow" d="M6 10h24v17H6z" />
    <rect className="icon-tint" x="3" y="7" width="13" height="17" rx="3" />
    <rect className="icon-paper" x="16" y="7" width="13" height="17" rx="3" />
    <path d="M7 12h5c0 3.4-1.2 5.8-4 7.4M20.5 14h4.5m-4.5 4h3M9 29h14" />
    <circle className="icon-dot" cx="16" cy="15.5" r="2" />
  </>,
  cards: <>
    <path className="icon-soft-shadow" d="m7 7 15-2 2 22-15 2z" />
    <path className="icon-tint" d="M6 5 19 2l5 21-13 3z" />
    <rect className="icon-paper" x="10" y="6" width="17" height="24" rx="5" />
    <path d="M15 13h5v8m3-8v9m0-5h3M16 26h5" />
    <circle className="icon-dot" cx="7" cy="27" r="2" />
  </>,
  stopwatch: <>
    <path className="icon-tint" d="M12 2h8v5h-8z" /><path d="m24 8 3-3m-2-1 3 3" />
    <circle className="icon-paper" cx="16" cy="19" r="12" />
    <path className="icon-tint" d="M16 9a10 10 0 0 1 10 10H16z" />
    <path d="M16 11v8l-5 4M6 19h2m16 0h2m-10 8v2" /><circle className="icon-dot" cx="16" cy="19" r="2" />
  </>,
  book: <>
    <path className="icon-soft-shadow" d="M6 7h21v23H6z" />
    <path className="icon-paper" d="M9 4h16a3 3 0 0 1 3 3v20H9a4 4 0 0 1 0-8V4Z" />
    <path className="icon-tint" d="M9 4h5v23H9a4 4 0 0 1 0-8Z" />
    <path d="M9 27h19M18 15h5m-5 4h3" /><path className="icon-ribbon" d="M20 4h5v7l-2.5-2-2.5 2z" />
    <path d="M5 10h5m-5 5h5" />
  </>,
  trophy: <>
    <path className="icon-tint" d="M10 8H4v5a6 6 0 0 0 7 6m11-11h6v5a6 6 0 0 1-7 6" />
    <path className="icon-paper" d="M9 6h14v9a7 7 0 0 1-14 0Z" />
    <path d="M16 22v5m-5 3h10m-10 0 1-3h8l1 3" />
    <path className="icon-ribbon" d="m16 9 1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4z" />
    <path d="M27 1v4m-2-2h4" />
  </>,
};
export type IconName = keyof typeof art;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  if (name in navigationArt) return <svg className="icon haru-icon" viewBox="0 0 32 32" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{navigationArt[name as keyof typeof navigationArt]}</svg>;
  return <svg className="icon" viewBox="0 0 26 26" width={size} height={size} aria-hidden="true"><g className="icon-shadow" transform="translate(1.6 1.6)">{art[name]}</g>{art[name]}</svg>;
}
