(() => {
  "use strict";

  /* ================= Catégories ================= */
  // Chaque carte appartient à une seule catégorie : les verbes et adjectifs
  // sont sortis du vocabulaire pour pouvoir être filtrés à part.
  const CATS = [
    { key: "vocab", label: "Vocabulaire" },
    { key: "verbs", label: "Verbes" },
    { key: "adjectives", label: "Adjectifs" },
    { key: "colors", label: "Couleurs" },
    { key: "numbers", label: "Nombres" },
    { key: "classifiers", label: "Classificateurs" },
    { key: "interrogatives", label: "Interrogatifs" },
    { key: "grammar", label: "Grammaire" },
  ];
  const SIZES = [10, 20, 50, 0]; // 0 = toutes
  const MASTERY_STREAK = 2; // bonnes réponses d'affilée pour sortir des erreurs

  const norm = (s) =>
    String(s)
      .normalize("NFC")
      .toLowerCase()
      .replace(/\([^)]*\)/g, "")
      .replace(/[\s~\-.,?!'’"«»…=]/g, "");

  function variants(ko) {
    const out = new Set([ko]);
    const noParen = ko.replace(/\([^)]*\)/g, "");
    out.add(noParen);
    for (const part of noParen.split(/[\/,=]/)) out.add(part);
    for (const m of ko.matchAll(/\(([^)]*)\)/g)) out.add(m[1]);
    return [...out].map(norm).filter(Boolean);
  }

  function lessonTag(r) {
    const parts = [];
    if (r.book) parts.push(r.book);
    if (r.lesson != null) parts.push("L" + r.lesson);
    return parts.join(" · ");
  }

  function catOf(r) {
    if (r.category !== "vocab") return r.category;
    if (r.word_type === "verb") return "verbs";
    if (r.word_type === "adjective") return "adjectives";
    return "vocab";
  }

  /**
   * rows : [{ id, category, word_type, book, lesson, ko, fr, short_form }]
   * (même forme que la table Supabase `cards`).
   */
  function buildCards(rows) {
    const cards = rows.map((r) => {
      const cat = catOf(r);
      const c = {
        id: r.id,
        cat,
        front: r.fr,
        back: r.ko,
        tag: lessonTag(r),
        extra: [],
      };
      if (cat === "classifiers") c.hint = "Quel classificateur ?";
      if (cat === "numbers") {
        c.hint = "En coréen natif";
        if (r.short_form) {
          c.alt = "forme courte : " + r.short_form;
          c.extra = [r.short_form];
        }
      }
      return c;
    });

    // Dédoublonne (même mot noté dans plusieurs leçons) : on garde la 1re occurrence.
    const seen = new Set();
    const unique = cards.filter((c) => {
      const k = c.cat + "|" + norm(c.front) + "|" + norm(c.back);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // Réponses acceptées : toutes les traductions coréennes d'un même mot français.
    const byFront = new Map();
    unique.forEach((c) => {
      const k = c.cat + "|" + norm(c.front);
      if (!byFront.has(k)) byFront.set(k, []);
      byFront.get(k).push(c);
    });
    unique.forEach((c) => {
      const group = byFront.get(c.cat + "|" + norm(c.front));
      const acc = new Set();
      group.forEach((g) => {
        variants(g.back).forEach((v) => acc.add(v));
        g.extra.forEach((v) => acc.add(norm(v)));
      });
      c.accepted = acc;
      c.others = group.filter((g) => g !== c).map((g) => g.back);
    });
    return unique;
  }

  /* ================= Préférences (ce navigateur) ================= */
  const PREFS_KEY = "cahier-coreen:prefs";
  function loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
      if (p) return p;
    } catch (_) {}
    return null;
  }
  function savePrefs() {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          cats: [...state.settings.cats],
          size: state.settings.size,
          mode: state.settings.mode,
        }),
      );
    } catch (_) {}
  }

  /* ================= État ================= */
  const prefs = loadPrefs();
  const validCats = new Set(CATS.map((c) => c.key));
  const savedCats = (prefs?.cats || []).filter((k) => validCats.has(k));
  const state = {
    ready: false,
    cards: [],
    stats: {},
    loadError: null,
    saveError: false,
    settings: {
      cats: new Set(savedCats.length ? savedCats : ["vocab"]),
      size: SIZES.includes(prefs?.size) ? prefs.size : 20,
      mode: prefs?.mode === "type" ? "type" : "flash",
      errorsOnly: false,
    },
    session: null,
  };

  const view = document.getElementById("view");
  const metaEl = document.getElementById("meta");
  const whoEl = document.getElementById("who");
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "text") el.textContent = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    kids
      .flat()
      .forEach(
        (k) =>
          k != null && el.append(k.nodeType ? k : document.createTextNode(k)),
      );
    return el;
  };

  /* ================= Progression ================= */
  const saver = {
    dirty: new Set(),
    timer: null,
    chain: Promise.resolve(),
    schedule(id) {
      this.dirty.add(id);
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush(), 1200);
    },
    flush() {
      clearTimeout(this.timer);
      if (!this.dirty.size) return this.chain;
      const ids = [...this.dirty];
      this.dirty.clear();
      const entries = ids.map((id) => [
        id,
        state.stats[id] ? { ...state.stats[id] } : null,
      ]);
      const all = JSON.parse(JSON.stringify(state.stats));
      this.chain = this.chain
        .then(() => backend.save(entries, all))
        .then(() => {
          if (state.saveError) {
            state.saveError = false;
            renderMeta();
          }
        })
        .catch(() => {
          ids.forEach((id) => this.dirty.add(id));
          state.saveError = true;
          renderMeta();
        });
      return this.chain;
    },
  };
  window.addEventListener("pagehide", () => saver.flush());

  function isError(id) {
    const s = state.stats[id];
    return !!s && s.wrong > 0 && (s.streak || 0) < MASTERY_STREAK;
  }

  function record(card, ok) {
    playSound(ok ? "correct" : "wrong");
    const prev = state.stats[card.id] ? { ...state.stats[card.id] } : null;
    const s = state.stats[card.id]
      ? { ...state.stats[card.id] }
      : { right: 0, wrong: 0, streak: 0 };
    if (ok) {
      s.right += 1;
      s.streak = (s.streak || 0) + 1;
    } else {
      s.wrong += 1;
      s.streak = 0;
    }
    s.last = Date.now();
    state.stats[card.id] = s;
    saver.schedule(card.id);
    return prev;
  }

  function shuffle(a) {
    const arr = a.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pool() {
    const cats = state.settings.cats;
    let p = state.cards.filter((c) => cats.has(c.cat));
    if (state.settings.errorsOnly) p = p.filter((c) => isError(c.id));
    return p;
  }

  function renderMeta() {
    if (state.loadError) {
      metaEl.textContent = "Cartes introuvables";
      return;
    }
    if (!state.ready) {
      metaEl.textContent = "Chargement…";
      return;
    }
    const errs = state.cards.filter((c) => isError(c.id)).length;
    let where = backend.storageNote ? " · " + backend.storageNote : "";
    if (state.saveError)
      where =
        " · la dernière sauvegarde a échoué, nouvel essai à la prochaine réponse";
    metaEl.textContent = `${state.cards.length} cartes · ${errs} à revoir${where}`;
  }

  function renderWho() {
    const label = backend.userLabel ? backend.userLabel() : "";
    if (!label) {
      whoEl.hidden = true;
      whoEl.replaceChildren();
      return;
    }
    whoEl.hidden = false;
    whoEl.replaceChildren(
      h("span", { text: label }),
      h("button", {
        type: "button",
        class: "btn link",
        text: "Se déconnecter",
        onclick: async () => {
          await saver.flush();
          await backend.signOut();
          location.reload();
        },
      }),
    );
  }

  /* ================= Écran : réglages ================= */
  function renderSetup() {
    clearInterval(timerHandle);
    state.session = null;
    activePage = "learn";
    renderShell();
    renderMeta();
    view.replaceChildren(hero("Un petit pas aujourd’hui.", "Un grand voyage en coréen. Choisis tes mots et fais grandir ta progression.", "안녕!"));

    if (state.loadError) {
      view.append(
        h(
          "div",
          { class: "panel" },
          h("p", {
            class: "error",
            text: "Les cartes n'ont pas pu être chargées.",
          }),
          h("p", { class: "note", text: state.loadError }),
        ),
      );
      return;
    }

    const counts = {};
    CATS.forEach((c) => {
      const all = state.cards.filter((x) => x.cat === c.key);
      counts[c.key] = state.settings.errorsOnly
        ? all.filter((x) => isError(x.id)).length
        : all.length;
    });

    const catField = h(
      "fieldset",
      { class: "field" },
      h("legend", { text: "Catégories" }),
      h(
        "div",
        { class: "chips" },
        CATS.map((c) =>
          h(
            "button",
            {
              type: "button",
              class: "chip",
              "aria-pressed": String(state.settings.cats.has(c.key)),
              onclick: () => {
                const s = state.settings.cats;
                if (s.has(c.key)) {
                  if (s.size > 1) s.delete(c.key);
                } else s.add(c.key);
                savePrefs();
                renderSetup();
              },
            },
            c.label,
            h("span", { class: "n", text: String(counts[c.key]) }),
          ),
        ),
      ),
      h("p", {
        class: "seg-note",
        text: "Les verbes et les adjectifs ont leur propre filtre : « Vocabulaire » regroupe les autres mots.",
      }),
    );

    const available = pool().length;
    const sizeField = h(
      "fieldset",
      { class: "field" },
      h("legend", { text: "Nombre de cartes" }),
      h(
        "div",
        { class: "seg" },
        SIZES.map((n) =>
          h(
            "button",
            {
              type: "button",
              "aria-pressed": String(state.settings.size === n),
              onclick: () => {
                state.settings.size = n;
                savePrefs();
                renderSetup();
              },
            },
            n === 0 ? "Toutes" : String(n),
          ),
        ),
      ),
      h("p", {
        class: "seg-note",
        text: `${available} carte${available > 1 ? "s" : ""} disponible${available > 1 ? "s" : ""} avec ces réglages.`,
      }),
    );

    const modeField = h(
      "fieldset",
      { class: "field" },
      h("legend", { text: "Mode" }),
      h(
        "div",
        { class: "seg" },
        h(
          "button",
          {
            type: "button",
            "aria-pressed": String(state.settings.mode === "flash"),
            onclick: () => {
              state.settings.mode = "flash";
              savePrefs();
              renderSetup();
            },
          },
          "Flashcard",
        ),
        h(
          "button",
          {
            type: "button",
            "aria-pressed": String(state.settings.mode === "type"),
            onclick: () => {
              state.settings.mode = "type";
              savePrefs();
              renderSetup();
            },
          },
          "Saisie en hangul",
        ),
      ),
      h("p", {
        class: "seg-note",
        text:
          state.settings.mode === "flash"
            ? "Tu réponds dans ta tête, tu retournes la carte et tu dis si tu savais."
            : "Tu tapes la réponse avec un clavier coréen, la correction est automatique.",
      }),
    );

    const totalErrors = state.cards.filter(
      (c) => state.settings.cats.has(c.cat) && isError(c.id),
    ).length;
    const errInput = h("input", {
      type: "checkbox",
      id: "errors-only",
      checked: state.settings.errorsOnly,
      disabled:
        !state.ready || (totalErrors === 0 && !state.settings.errorsOnly),
      onchange: (e) => {
        state.settings.errorsOnly = e.target.checked;
        renderSetup();
      },
    });
    const errToggle = h(
      "label",
      { class: "toggle", for: "errors-only" },
      h(
        "span",
        {},
        h("strong", { text: `Revoir mes erreurs (${totalErrors})` }),
        h("small", {
          text: `Un mot quitte cette liste après ${MASTERY_STREAK} bonnes réponses d'affilée.`,
        }),
      ),
      errInput,
    );

    const start = h(
      "button",
      {
        type: "button",
        class: "btn primary",
        id: "start",
        disabled: available === 0 || !state.ready,
        onclick: () =>
          startQuiz(shuffle(pool()).slice(0, state.settings.size || undefined)),
      },
      !state.ready
        ? "Chargement…"
        : `Commencer · ${state.settings.size === 0 ? available : Math.min(available, state.settings.size)} cartes`,
    );

    view.append(
      h(
        "div",
        { class: "panel" },
        catField,
        sizeField,
        modeField,
        errToggle,
        start,
      ),
    );
  }

  /* ================= Écran : quiz ================= */
  function startQuiz(cards, timed = false) {
    if (!cards.length) return;
    state.session = {
      queue: cards,
      i: 0,
      results: [],
      mode: timed ? "type" : state.settings.mode,
      timed,
      startedAt: performance.now(),
      endedAt: null,
      revealed: false,
    };
    renderShell();
    renderCard();
  }

  function renderCard() {
    const s = state.session;
    const card = s.queue[s.i];
    const n = s.queue.length;
    s.revealed = false;
    view.replaceChildren();

    const progress = h(
      "div",
      { class: "progress" },
      h("span", { text: `${s.i + 1} / ${n}` }),
      h(
        "div",
        { class: "bar" },
        h("i", { style: `width:${(s.i / n) * 100}%` }),
      ),
      h("button", {
        type: "button",
        class: "btn link",
        onclick: finish,
        text: "Terminer",
      }),
    );

    const catLabel = CATS.find((c) => c.key === card.cat).label;
    const front = h(
      "div",
      { class: "face front" },
      h(
        "div",
        { class: "tag" },
        h("span", { text: catLabel }),
        h("span", { text: card.tag || "" }),
      ),
      h("div", { class: "fr", text: card.front }),
      card.hint ? h("div", { class: "hint", text: card.hint }) : null,
    );
    const back = h("div", { class: "face back", id: "back" });
    const cardEl = h(
      "div",
      { class: "card", id: "card", "aria-live": "polite" },
      h("div", { class: "card-inner" }, front, back),
    );

    const controls = h("div", { id: "controls", class: "field" });
    view.append(
      h(
        "div",
        { class: "field", style: "gap:16px" },
        progress,
        cardEl,
        controls,
      ),
    );

    if (s.timed) {
      const clock = h("div", { class: "live-clock", role: "timer", "aria-label": "Temps écoulé" });
      const tick = () => { clock.textContent = "⏱ " + formatTime(((s.endedAt ?? performance.now()) - s.startedAt) / 1000); };
      clearInterval(timerHandle);
      tick();
      timerHandle = setInterval(tick, 100);
      view.prepend(clock);
    }
    if (s.mode === "flash") renderFlashControls();
    else renderTypeControls();
  }

  function fillBack({ verdict, yours } = {}) {
    const card = state.session.queue[state.session.i];
    const back = document.getElementById("back");
    back.replaceChildren(
      h(
        "div",
        { class: "tag" },
        h("span", { text: card.front }),
        h("span", { text: card.tag || "" }),
      ),
      verdict
        ? h("span", {
            class: "verdict " + (verdict === "ok" ? "ok" : "ko-v"),
            text: verdict === "ok" ? "Correct" : "Pas tout à fait",
          })
        : null,
      h("div", { class: "ko", lang: "ko", text: card.back }),
      card.alt
        ? h("div", { class: "ko-alt", lang: "ko", text: card.alt })
        : null,
      card.others.length
        ? h("div", {
            class: "ko-alt",
            lang: "ko",
            text: "aussi : " + card.others.join(" · "),
          })
        : null,
      yours
        ? h(
            "div",
            { class: "yours" },
            "Ta réponse : ",
            h("b", { lang: "ko", text: yours }),
          )
        : null,
    );
    document.getElementById("card").classList.add("flipped");
  }

  function renderFlashControls() {
    const controls = document.getElementById("controls");
    const flip = h(
      "button",
      { type: "button", class: "btn primary", id: "flip", onclick: reveal },
      "Retourner la carte",
      h("span", { class: "kbd", text: "Espace" }),
    );
    controls.replaceChildren(flip);
    flip.focus({ preventScroll: true });
  }

  function reveal() {
    const s = state.session;
    if (s.revealed) return;
    s.revealed = true;
    fillBack();
    const controls = document.getElementById("controls");
    const no = h(
      "button",
      { type: "button", class: "btn bad", onclick: () => answerFlash(false) },
      "Je ne savais pas",
      h("span", { class: "kbd", text: "1" }),
    );
    const yes = h(
      "button",
      {
        type: "button",
        class: "btn good",
        id: "yes",
        onclick: () => answerFlash(true),
      },
      "Je savais",
      h("span", { class: "kbd", text: "2" }),
    );
    controls.replaceChildren(h("div", { class: "row" }, no, yes));
    yes.focus({ preventScroll: true });
  }

  function answerFlash(ok) {
    const s = state.session;
    const card = s.queue[s.i];
    record(card, ok);
    s.results.push({ card, ok });
    next();
  }

  function renderTypeControls() {
    const controls = document.getElementById("controls");
    const input = h("input", {
      id: "answer",
      type: "text",
      lang: "ko",
      inputmode: "text",
      autocomplete: "off",
      autocapitalize: "off",
      autocorrect: "off",
      spellcheck: "false",
      placeholder: "Réponse en hangul",
      "aria-label": "Ta réponse en coréen",
    });
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      check();
    });
    const verify = h(
      "button",
      { type: "button", class: "btn primary", onclick: () => check() },
      "Vérifier",
    );
    const skip = h("button", {
      type: "button",
      class: "btn link",
      onclick: () => check(true),
      text: "Je ne sais pas",
    });
    controls.replaceChildren(
      h("div", { class: "answer" }, input, verify),
      skip,
    );
    input.focus({ preventScroll: true });
  }

  function check(giveUp = false) {
    const s = state.session;
    if (s.revealed) return;
    const card = s.queue[s.i];
    const raw = giveUp ? "" : document.getElementById("answer").value.trim();
    if (!giveUp && !raw) {
      document.getElementById("answer").focus();
      return;
    }
    const ok = !giveUp && card.accepted.has(norm(raw));
    s.revealed = true;
    const prev = record(card, ok);
    const result = { card, ok, typed: raw };
    s.results.push(result);
    if (s.timed && s.results.length === s.queue.length) { s.endedAt = performance.now(); clearInterval(timerHandle); }
    fillBack({ verdict: ok ? "ok" : "ko", yours: !ok && raw ? raw : "" });

    const controls = document.getElementById("controls");
    const nextBtn = h(
      "button",
      { type: "button", class: "btn primary", id: "next", onclick: next },
      s.i + 1 < s.queue.length ? "Carte suivante" : "Voir le résultat",
      h("span", { class: "kbd", text: "Entrée" }),
    );
    const kids = [nextBtn];
    if (!ok && raw && !s.timed) {
      kids.unshift(
        h(
          "button",
          {
            type: "button",
            class: "btn",
            title: "Faute de frappe ou variante valable",
            onclick: () => {
              if (prev) state.stats[card.id] = prev;
              else delete state.stats[card.id];
              record(card, true);
              result.ok = true;
              next();
            },
          },
          "J'avais bon",
        ),
      );
    }
    controls.replaceChildren(h("div", { class: "row" }, kids));
    nextBtn.focus({ preventScroll: true });
  }

  function next() {
    const s = state.session;
    if (s.i + 1 >= s.queue.length) return finish();
    s.i += 1;
    renderCard();
  }

  /* ================= Écran : résultat ================= */
  function finish() {
    const s = state.session;
    if (!s) return renderSetup();
    clearInterval(timerHandle);
    saver.flush();
    const results = s.results;
    const good = results.filter((r) => r.ok).length;
    const missed = results.filter((r) => !r.ok);
    const reward = completeSession(s);
    state.session = null;
    renderShell();
    renderMeta();
    view.replaceChildren();

    if (!results.length) return renderSetup();

    const pct = Math.round((good / results.length) * 100);
    const panel = h(
      "div",
      { class: "panel" },
      h(
        "div",
        { class: "score" },
        h("span", { class: "big", text: `${good}/${results.length}` }),
        h("span", { class: "of", text: `${pct} % de bonnes réponses` }),
      ),
    );

    panel.prepend(h("h2", { text: s.timed ? "Défi chrono terminé !" : "Bien joué, continue comme ça !" }), h("p", { class: "reward", text: reward }));
    if (s.timed) panel.append(button("Voir mes records", renderScores));
    if (missed.length) {
      panel.append(
        h(
          "div",
          { class: "field" },
          h("div", { class: "label", text: `À revoir (${missed.length})` }),
          h(
            "ul",
            { class: "missed" },
            missed.map((r) =>
              h(
                "li",
                {},
                h("span", { class: "m-fr", text: r.card.front }),
                h("span", { class: "m-ko", lang: "ko", text: r.card.back }),
              ),
            ),
          ),
        ),
      );
    } else {
      panel.append(
        h("p", {
          class: "empty-state",
          text: "Aucune erreur sur cette série.",
        }),
      );
    }

    const row = h("div", { class: "row" });
    if (missed.length)
      row.append(
        h(
          "button",
          {
            type: "button",
            class: "btn primary",
            onclick: () => startQuiz(shuffle(missed.map((r) => r.card))),
          },
          "Refaire les ratés",
        ),
      );
    row.append(
      h(
        "button",
        {
          type: "button",
          class: missed.length ? "btn" : "btn primary",
          onclick: renderSetup,
        },
        "Nouveau quiz",
      ),
    );
    panel.append(row);
    view.append(panel);
  }

  /* ================= Clavier (mode flashcard) ================= */
  document.addEventListener("keydown", (e) => {
    const s = state.session;
    if (!s || s.mode !== "flash" || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!s.revealed && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      reveal();
    } else if (s.revealed && (e.key === "1" || e.key === "ArrowLeft")) {
      e.preventDefault();
      answerFlash(false);
    } else if (s.revealed && (e.key === "2" || e.key === "ArrowRight")) {
      e.preventDefault();
      answerFlash(true);
    }
  });

  /* ================= Source des données ================= */
  // Version locale : cartes et progression dans Supabase, connexion Google ou e-mail + mot de passe.
  const SUPABASE_URL = "https://mdicfesvrrnbwnyslnir.supabase.co";
  const SUPABASE_KEY = "sb_publishable_XVzEwk-V4X6sfCT2mSzzjw_cEZQvJiV"; // clé publique : les règles RLS protègent les données

  const backend = {
    storageNote: "",
    client: null,
    user: null,

    userLabel() {
      return this.user?.email || "";
    },
    async signOut() {
      await this.client.auth.signOut();
    },

    async start(ui) {
      if (!window.supabase?.createClient)
        throw new Error(
          "La librairie Supabase n'a pas pu être chargée (vérifie ta connexion).",
        );
      this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          flowType: "pkce",
          detectSessionInUrl: true,
          persistSession: true,
        },
      });
      // getSession() attend que supabase-js ait traité un éventuel retour de Google (?code=… dans l'URL).
      const {
        data: { session },
      } = await this.client.auth.getSession();
      this.oauthError =
        new URLSearchParams(location.search).get("error_description") ||
        new URLSearchParams(location.hash.slice(1)).get("error_description");
      if (location.search || location.hash)
        history.replaceState(null, "", location.pathname);
      this.user = session?.user || (await this.askLogin(ui));
      const [rows, stats] = await Promise.all([
        this.loadCards(),
        this.loadStats(),
        this.loadRole(),
      ]);
      return { rows, stats };
    },

    async loadRole() {
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

    async loadStats() {
      const { data, error } = await this.client
        .from("user_progress")
        .select("card_id, right_count, wrong_count, streak, last_seen");
      if (error)
        throw new Error(
          "Lecture de ta progression impossible : " + error.message,
        );
      const stats = {};
      data.forEach((r) => {
        stats[r.card_id] = {
          right: r.right_count,
          wrong: r.wrong_count,
          streak: r.streak,
          last: Date.parse(r.last_seen),
        };
      });
      return stats;
    },

    async save(entries) {
      const upserts = [];
      const deletes = [];
      entries.forEach(([id, s]) => {
        if (!s) {
          deletes.push(id);
          return;
        }
        upserts.push({
          user_id: this.user.id,
          card_id: id,
          right_count: s.right,
          wrong_count: s.wrong,
          streak: s.streak || 0,
          last_seen: new Date(s.last || Date.now()).toISOString(),
        });
      });
      if (upserts.length) {
        const { error } = await this.client
          .from("user_progress")
          .upsert(upserts, { onConflict: "user_id,card_id" });
        if (error) throw error;
      }
      if (deletes.length) {
        const { error } = await this.client
          .from("user_progress")
          .delete()
          .in("card_id", deletes);
        if (error) throw error;
      }
    },

    askLogin({ view, h }) {
      return new Promise((resolve) => {
        document.getElementById("meta").textContent = "";
        const email = h("input", {
          id: "auth-email",
          type: "email",
          autocomplete: "email",
          required: true,
        });
        const password = h("input", {
          id: "auth-password",
          type: "password",
          autocomplete: "current-password",
          minlength: "6",
          required: true,
        });
        const msg = h("p", { class: "auth-msg", role: "status" });
        const signIn = h("button", {
          type: "submit",
          class: "btn primary",
          text: "Se connecter",
        });
        const signUp = h("button", {
          type: "button",
          class: "btn",
          text: "Créer un compte",
        });

        const google = h("button", {
          type: "button",
          class: "btn google",
          text: "Continuer avec Google",
        });

        const setBusy = (busy) => {
          signIn.disabled = busy;
          signUp.disabled = busy;
          google.disabled = busy;
        };
        const show = (text, kind) => {
          msg.textContent = text;
          msg.className = "auth-msg " + (kind || "");
        };

        google.addEventListener("click", async () => {
          setBusy(true);
          show("Redirection vers Google…");
          const { error } = await this.client.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: location.origin + location.pathname },
          });
          // En cas de succès, le navigateur quitte la page vers Google.
          if (error) {
            setBusy(false);
            show("Connexion Google impossible : " + error.message, "error");
          }
        });

        const form = h(
          "form",
          { class: "auth-form", novalidate: true },
          h("label", { for: "auth-email" }, "E-mail", email),
          h(
            "label",
            { for: "auth-password" },
            "Mot de passe (6 caractères minimum)",
            password,
          ),
          msg,
          h("div", { class: "row" }, signIn, signUp),
        );

        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          if (!email.value || !password.value)
            return show("Saisis ton e-mail et ton mot de passe.", "error");
          setBusy(true);
          show("Connexion…");
          const { data, error } = await this.client.auth.signInWithPassword({
            email: email.value.trim(),
            password: password.value,
          });
          setBusy(false);
          if (error) {
            const text = /confirm/i.test(error.message)
              ? "Ton e-mail n'est pas encore confirmé : clique sur le lien reçu par mail, puis reconnecte-toi."
              : "E-mail ou mot de passe incorrect.";
            return show(text, "error");
          }
          resolve(data.user);
        });

        signUp.addEventListener("click", async () => {
          if (!email.value || password.value.length < 6)
            return show(
              "Choisis un e-mail et un mot de passe d'au moins 6 caractères.",
              "error",
            );
          setBusy(true);
          show("Création du compte…");
          const { data, error } = await this.client.auth.signUp({
            email: email.value.trim(),
            password: password.value,
            options: { emailRedirectTo: location.origin + location.pathname },
          });
          setBusy(false);
          if (error)
            return show("Création impossible : " + error.message, "error");
          if (data.session) return resolve(data.user);
          show(
            "Compte créé. Confirme ton e-mail avec le lien reçu, puis connecte-toi ici.",
            "ok",
          );
        });

        view.replaceChildren(
          h(
            "div",
            { class: "panel" },
            h(
              "div",
              { class: "field" },
              h("h2", { class: "auth-title", text: "Connexion" }),
              h("p", {
                class: "note",
                text: "Connecte-toi pour retrouver tes cartes et tes erreurs sur tous tes appareils. Pas encore de compte ? Saisis un e-mail et un mot de passe, puis « Créer un compte ».",
              }),
            ),
            google,
            h(
              "div",
              { class: "divider", role: "separator" },
              h("span", { text: "ou avec ton e-mail" }),
            ),
            form,
          ),
        );
        if (this.oauthError)
          show("Connexion Google refusée : " + this.oauthError, "error");
      });
    },
  };

  /* ================= Démarrage ================= */
  renderMeta();
  view.replaceChildren(
    h(
      "div",
      { class: "panel" },
      h("p", { class: "loading", text: "Chargement…" }),
    ),
  );
  backend
    .start({ view, h, renderMeta })
    .then(({ rows, stats }) => {
      state.rows = rows;
      state.cards = buildCards(rows);
      loadGame();
      state.stats = stats || {};
      state.ready = true;
      renderWho();
      renderSetup();
    })
    .catch((err) => {
      state.loadError = String(err?.message || err);
      renderSetup();
    });
})();
