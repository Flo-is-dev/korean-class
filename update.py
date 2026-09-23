from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8').replace('<html lang="fr">','<html lang="fr" data-theme="light">').replace('<title>Cahier de coréen</title>','<title>Haru · Un peu de coréen, chaque jour</title>').replace('<h1>Cahier <span>de coréen</span></h1>','<a class="brand" href="./" aria-label="Haru, accueil"><span class="brand-mark">하</span><span>haru<span class="brand-sub">LE CORÉEN, CHAQUE JOUR</span></span></a>').replace('<main id="view"></main>','<nav id="navigation" class="navigation" aria-label="Menu principal" hidden></nav>\n      <div id="game-bar" class="game-bar" hidden></div>\n      <main id="view"></main>\n      <p id="notice" class="notice" role="status"></p>')
p.write_text(s,encoding='utf-8')
p=Path('app.js');s=p.read_text(encoding='utf-8')
s=s.replace('    record(card, ok);','    record(card, ok);',1)
s=s.replace('    const prev = state.stats[card.id]', '    playSound(ok ? "correct" : "wrong");\n    const prev = state.stats[card.id]',1)
s=s.replace('  function renderSetup() {\n    state.session = null;', '  function renderSetup() {\n    clearInterval(timerHandle);\n    state.session = null;\n    activePage = "learn";\n    renderShell();')
s=s.replace('    view.replaceChildren();\n\n    if (state.loadError)', '    view.replaceChildren(hero("Un petit pas aujourd’hui.", "Un grand voyage en coréen. Choisis tes mots et fais grandir ta progression.", "안녕!"));\n\n    if (state.loadError)',1)
s=s.replace('  function startQuiz(cards) {', '  function startQuiz(cards, timed = false) {')
s=s.replace('      mode: state.settings.mode,\n      revealed: false,','      mode: timed ? "type" : state.settings.mode,\n      timed,\n      startedAt: performance.now(),\n      endedAt: null,\n      revealed: false,')
s=s.replace('    renderCard();\n  }\n\n  function renderCard()', '    renderShell();\n    renderCard();\n  }\n\n  function renderCard()',1)
s=s.replace('    if (s.mode === "flash") renderFlashControls();','    if (s.timed) {\n      const clock = h("div", { class: "live-clock", role: "timer", "aria-label": "Temps écoulé" });\n      const tick = () => { clock.textContent = "⏱ " + formatTime(((s.endedAt ?? performance.now()) - s.startedAt) / 1000); };\n      clearInterval(timerHandle);\n      tick();\n      timerHandle = setInterval(tick, 100);\n      view.prepend(clock);\n    }\n    if (s.mode === "flash") renderFlashControls();',1)
s=s.replace('    s.results.push(result);','    s.results.push(result);\n    if (s.timed && s.results.length === s.queue.length) { s.endedAt = performance.now(); clearInterval(timerHandle); }',1)
s=s.replace('    if (!ok && raw) {','    if (!ok && raw && !s.timed) {',1)
s=s.replace('    if (!s) return renderSetup();\n    saver.flush();','    if (!s) return renderSetup();\n    clearInterval(timerHandle);\n    saver.flush();',1)
s=s.replace('    state.session = null;\n    renderMeta();\n    view.replaceChildren();','    const reward = completeSession(s);\n    state.session = null;\n    renderShell();\n    renderMeta();\n    view.replaceChildren();',1)
s=s.replace('    if (missed.length) {\n      panel.append(', '    panel.prepend(h("h2", { text: s.timed ? "Défi chrono terminé !" : "Bien joué, continue comme ça !" }), h("p", { class: "reward", text: reward }));\n    if (s.timed) panel.append(button("Voir mes records", renderScores));\n    if (missed.length) {\n      panel.append(',1)
# raw list is kept complete while quiz deduplicates
s=s.replace('      state.cards = buildCards(rows);','      state.rows = rows;\n      state.cards = buildCards(rows);\n      loadGame();')
s=s.replace('        this.loadStats(),\n      ]);','        this.loadStats(),\n        this.loadRole(),\n      ]);',1)
start=s.index('    async loadCards() {');end=s.index('    async loadStats()',start)
s=s[:start]+'''    async loadRole() {
      const { data } = await this.client.from("profiles").select("role").eq("id", this.user.id).maybeSingle();
      this.isAdmin = data?.role === "admin";
    },
    async loadCards() {
      const rows = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await this.client.from("cards")
          .select("id, category, word_type, book, lesson, ko, fr, short_form")
          .order("sort_order").order("id").range(offset, offset + 999);
        if (error) throw new Error("Lecture des cartes impossible : " + error.message);
        rows.push(...data);
        if (data.length < 1000) return rows;
      }
    },

'''+s[end:]
insert=s.index('  /* ================= Source des données')
s=s[:insert]+Path('features.tmp').read_text(encoding='utf-8')+s[insert:] if Path('features.tmp').exists() else s
p.write_text(s,encoding='utf-8')
