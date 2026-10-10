const head = `${import.meta.env.BASE_URL}assets/haru-head.svg`;

// Haru's head: the logo in the header, and a sticker peeking from the corner of a few panels.
export const Mascot = ({ className = 'mascot' }: { className?: string }) => <img className={className} src={head} alt="" width={70} height={61} />;
