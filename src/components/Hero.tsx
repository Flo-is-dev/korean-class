export function Hero({ title, subtitle, bubble = '할 수 있어!' }: { title: string; subtitle: string; bubble?: string }) {
  return <section className="hero">
    <div><p className="eyebrow">UN JOUR, UN PEU PLUS LOIN</p><h1>{title}</h1><p>{subtitle}</p></div>
    <div className="hero-art"><span className="speech" lang="ko">{bubble}</span><img src={`${import.meta.env.BASE_URL}assets/haru.svg`} alt="Haru, un petit tigre coréen souriant" width={180} height={180} /></div>
  </section>;
}
