'use strict';
(() => {
  /* =====================================================================
     WorkLog V5 : suivi d'exercices et de charges, 100 % local sur le téléphone.
     V5 : détail du jour sous le calendrier, séances types validées (brouillon), dossiers,
     vignettes animées, glisser au doigt, bandeau qui réapparaît, transitions de page.
     V4 : séances types en dossiers, séance du jour (ordre, duplication), notes,
     calcul du poids, modification/suppression des séries, cardio, fichier d'activité.
     Exercices : liste fusionnée intégrée à l'app (data-v3.json), noms en anglais.
       - ExerciseDB (données MIT, images et animations © Gym visual, 180 px) en priorité ;
       - free-exercise-db (domaine public, photos) pour les exercices absents d'ExerciseDB.
     Schéma des muscles : bodymap.json (react-native-body-highlighter, licence MIT).
     ===================================================================== */
  const BACKUP_KEY = 'worklog.backup.v1';
  const ARCHIVE_KEY = 'worklog.archive.v1';
  const DATA_V = 2;
  const APP_VERSION = '0.5.2';
  const NS = 'http://www.w3.org/2000/svg';
  let SHA_E = 'main';   // version figée du dépôt des médias ExerciseDB
  let SHA_F = 'main';   // version figée du dépôt free-exercise-db
  let BODY = null;      // schéma du corps (face et dos)

  /* ---------- utilitaires ---------- */
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const skey = (s) => fold(s).replace(/[^a-z0-9]+/g, ' ').trim();
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const fmtNum = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);
  const fDateTime = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fDayLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const fDayShort = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  const fTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const fMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
  const pad2 = (n) => String(n).padStart(2, '0');
  const dayKey = (ts) => { const d = new Date(ts); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  const keyDate = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
  const toLocalInput = (ts) => { const d = new Date(ts); return dayKey(ts) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const plural = (n, one, many) => n + ' ' + (n > 1 ? many : one);
  function dayLabel(date) {
    const s = cap(fDayLong.format(date));
    return date.getFullYear() !== new Date().getFullYear() ? s + ' ' + date.getFullYear() : s;
  }
  function ago(key) {
    const now = new Date();
    const n = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - keyDate(key)) / 86400000);
    if (n <= 0) return 'aujourd’hui';
    if (n === 1) return 'hier';
    if (n < 14) return 'il y a ' + n + ' jours';
    if (n < 63) return 'il y a ' + Math.round(n / 7) + ' semaines';
    return 'il y a ' + Math.round(n / 30.44) + ' mois';
  }

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style') { for (const [p, val] of Object.entries(v)) { if (p.startsWith('--')) el.style.setProperty(p, val); else el.style[p] = val; } }
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(kid));
    }
    return el;
  }
  function sv(tag, attrs, ...kids) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  }

  const ICONS = {
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    star: '<path d="M12 3.6l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.8 1-5.9L3.5 9.8l5.9-.8z"/>',
    trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    down: '<path d="M6 10l6 6 6-6"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    export: '<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>',
    import: '<path d="M12 4v11M8 11l4 4 4-4M5 13v6h14v-6"/>',
    tag: '<path d="M4 5v6.2l8.4 8.4 6.2-6.2L10.2 5zM8 9h.01"/>',
    zoom: '<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 5.5H7A1.5 1.5 0 0 0 5.5 7v8.5"/>',
    grip: '<path d="M6 9h12M6 15h12"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    dots: '<circle cx="5.5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18.5" cy="12" r="1.7"/>',
    folderplus: '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5V17A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17zM12 11v5M9.5 13.5h5"/>',
    folder: '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5V17A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17z"/>',
  };
  function icon(name, cls) {
    const el = sv('svg', { viewBox: '0 0 24 24', class: 'ic ' + (cls || ''), 'aria-hidden': 'true' });
    el.innerHTML = ICONS[name];
    return el;
  }

  /* ---------- muscles et catégories (de la tête aux pieds) ---------- */
  const MUSCLES = {
    'neck': 'Cou', 'shoulders': 'Épaules', 'chest': 'Pectoraux', 'traps': 'Trapèzes', 'lats': 'Grands dorsaux',
    'middle back': 'Milieu du dos', 'lower back': 'Bas du dos', 'biceps': 'Biceps', 'triceps': 'Triceps', 'forearms': 'Avant-bras',
    'abdominals': 'Abdominaux', 'glutes': 'Fessiers', 'hamstrings': 'Ischio-jambiers', 'abductors': 'Abducteurs', 'adductors': 'Adducteurs',
    'quadriceps': 'Quadriceps', 'calves': 'Mollets',
    'obliques': 'Obliques', 'hip flexors': 'Fléchisseurs de hanche', 'tibialis': 'Tibial antérieur', 'serratus': 'Dentelé antérieur', 'cardio': 'Système cardiovasculaire',
  };
  /* Zones du schéma colorées pour chaque muscle. */
  const SLUGS = {
    'neck': ['neck'], 'shoulders': ['deltoids'], 'chest': ['chest'], 'traps': ['trapezius'], 'lats': ['upper-back'], 'middle back': ['upper-back'],
    'lower back': ['lower-back'], 'biceps': ['biceps'], 'triceps': ['triceps'], 'forearms': ['forearm'], 'abdominals': ['abs', 'obliques'], 'obliques': ['obliques'],
    'serratus': ['obliques'], 'glutes': ['gluteal'], 'hamstrings': ['hamstring'], 'abductors': ['gluteal'], 'adductors': ['adductors'], 'quadriceps': ['quadriceps'],
    'hip flexors': [], 'calves': ['calves'], 'tibialis': ['tibialis'], 'cardio': [],
  };
  const SKIN = new Set(['head', 'hair', 'hands', 'feet', 'ankles', 'knees']);
  const frMuscle = (s) => MUSCLES[s] || cap(String(s));

  const TREE = [
    { id: 'cou', label: 'Cou', color: '#7F8FA9', m: ['neck'] },
    { id: 'epaules', label: 'Épaules', color: '#4F86E0', m: ['shoulders'] },
    { id: 'pectoraux', label: 'Pectoraux', color: '#D9668F', m: ['chest'] },
    { id: 'dos', label: 'Dos', color: '#2F9C8A', m: ['traps', 'lats', 'middle back', 'lower back'] },
    { id: 'bras', label: 'Bras', color: '#DD8F2E', subs: [
      { id: 'biceps', label: 'Biceps', m: ['biceps'] },
      { id: 'triceps', label: 'Triceps', m: ['triceps'] },
      { id: 'avant-bras', label: 'Avant-bras', m: ['forearms'] },
    ] },
    { id: 'abdos', label: 'Abdominaux et taille', color: '#A9912B', m: ['abdominals'] },
    { id: 'jambes', label: 'Jambes', color: '#7459C4', subs: [
      { id: 'fessiers-ischios', label: 'Fessiers et ischio-jambiers', m: ['glutes', 'hamstrings'] },
      { id: 'abducteurs', label: 'Abducteurs et adducteurs', m: ['abductors', 'adductors'] },
      { id: 'quadriceps', label: 'Quadriceps', m: ['quadriceps'] },
      { id: 'mollets', label: 'Mollets', m: ['calves'] },
    ] },
    { id: 'cardio', label: 'Cardio', color: '#D95B56' },
  ];
  const GROUPS = new Map();      // id -> { id, label, full, top, color }
  const LEAF_OF = new Map();     // muscle anglais -> id de la (sous-)catégorie
  for (const t of TREE) {
    GROUPS.set(t.id, { id: t.id, label: t.label, full: t.label, top: t.id, color: t.color });
    (t.m || []).forEach((m) => LEAF_OF.set(m, t.id));
    for (const s of t.subs || []) {
      GROUPS.set(s.id, { id: s.id, label: s.label, full: t.label + ' – ' + s.label, top: t.id, color: t.color, sub: true });
      s.m.forEach((m) => LEAF_OF.set(m, s.id));
    }
  }
  const GROUP_LIST = [...GROUPS.values()];
  const topOf = (id) => (GROUPS.get(id) || {}).top;

  /* ---------- état ---------- */
  const S = {
    exercises: [],
    byId: new Map(),
    byLeaf: new Map(),
    loadError: false,
    entries: [],
    favs: new Set(),
    sessions: {},        // 'AAAA-MM-JJ' -> { name, main, sec: [] }
    days: {},            // 'AAAA-MM-JJ' -> { order: [id], plan: { id: [{ w, r }] }, note }
    notes: {},           // id d'exercice -> note libre
    plans: [],           // séances types : { id, name, folder, main, sec, items: [{ ex, sets: [{ w, r }] }], created, last }
    folders: [],         // noms des dossiers de séances types
    guard: null,         // saisie non validée sur la page en cours : { dirty(), save() }
    draft: null,         // saisie à remettre après « Annuler » : { id, rows }
    planDraft: null,     // séance type en cours de création/modification : { p, isNew, base }
    navAnim: null,       // animation de la prochaine page : 'back' (flèche) ou 'close' (croix)
    cal: null,
    alias: {},
    stack: [],
    cleanups: [],
    getUI: null,
  };

  const dn = (ex) => ex.name;
  function getEx(id, fallbackName) {
    return S.byId.get(id) || { id, name: fallbackName || id, missing: true, p: null, s: [], leaf: null };
  }

  /* ---------- images ----------
     ExerciseDB (src 0) : une vignette fixe et une animation gif, en 180 px.
     free-exercise-db (src 1) : deux photos nettes (départ et arrivée du mouvement).
     Adresse principale : le dépôt GitHub de chaque base. Secours : la même image via jsDelivr. */
  const RAW = 'https://raw.githubusercontent.com/';
  const CDN = 'https://cdn.jsdelivr.net/gh/';
  function mediaUrl(ex, kind, alt) {
    if (ex.src === 0) {
      const path = kind === 'a' ? '/videos/' + ex.media + '.gif' : '/images/' + ex.media + '.jpg';
      return alt ? CDN + 'hasaneyldrm/exercises-dataset@' + SHA_E + path : RAW + 'hasaneyldrm/exercises-dataset/' + SHA_E + path;
    }
    const path = '/exercises/' + encodeURIComponent(ex.id) + '/' + (kind === 1 ? 1 : 0) + '.jpg';
    return alt ? CDN + 'yuhonas/free-exercise-db@' + SHA_F + path : RAW + 'yuhonas/free-exercise-db/' + SHA_F + path;
  }
  function photo(ex, kind, props) {
    if (ex.missing) return h('span', { class: 'ph ' + ((props && props.class) || '') });
    const img = h('img', Object.assign({ alt: '', decoding: 'async', crossorigin: 'anonymous' }, props));
    let retried = false;
    img.addEventListener('error', () => {
      if (!retried) { retried = true; img.src = mediaUrl(ex, kind, true); } else img.classList.add('broken');
    });
    img.src = mediaUrl(ex, kind);
    return img;
  }
  /* Vignette : le gif (ExerciseDB) ou les deux photos (free-exercise-db) ne s'animent que
     lorsque la vignette est à l'écran ; ailleurs, l'image fixe. opts.zoom : un appui l'agrandit. */
  let thumbIO = null;
  function watchThumb(el) {
    if (!('IntersectionObserver' in window)) { el._play(true); return; }
    if (!thumbIO) thumbIO = new IntersectionObserver((ents) => ents.forEach((en) => en.target._play && en.target._play(en.isIntersecting)), { rootMargin: '40px 0px' });
    thumbIO.observe(el);
  }
  function thumb(ex, opts) {
    if (ex.missing) return h('span', { class: 'ph thumb' });
    let el;
    if (ex.src === 0) {
      el = h('img', { class: 'thumb sq', alt: '', decoding: 'async', crossorigin: 'anonymous' });
      let mode = 't'; let alt = false;
      const set = () => { el.src = mediaUrl(ex, mode, alt); };
      el.addEventListener('error', () => { if (!alt) { alt = true; set(); } else el.classList.add('broken'); });
      el._play = (on) => { const m = on ? 'a' : 't'; if (m !== mode) { mode = m; alt = false; set(); } };
      set();
    } else {
      el = h('span', { class: 'thumb tflip' }, photo(ex, 0, { loading: 'lazy' }));
      let second = null;
      el._play = (on) => { if (on && !second) { second = photo(ex, 1, { class: 'b' }); el.append(second); } el.classList.toggle('play', on); };
    }
    watchThumb(el);
    if (opts && opts.zoom) {
      el.classList.add('zoomable');
      el.setAttribute('title', 'Agrandir');
      el.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); lightbox(ex); });
    }
    return el;
  }
  /* Deux photos qui alternent (free-exercise-db). */
  function flip(ex, props) {
    const lazy = props && props.lazy ? 'lazy' : null;
    return h('div', { class: 'flip ' + ((props && props.class) || '') },
      photo(ex, 0, { loading: lazy, alt: (props && props.alt) || '' }),
      photo(ex, 1, { loading: lazy, class: 'b' }));
  }
  /* Schéma du corps : muscle principal en violet foncé, secondaires en violet clair. */
  function bodyFig(side, prim, sec) {
    const v = BODY[side];
    const svg = sv('svg', { viewBox: v.vb, class: 'body', 'aria-hidden': 'true' });
    for (const [slug, d] of Object.entries(v.parts)) {
      svg.append(sv('path', { class: prim.has(slug) ? 'p' : sec.has(slug) ? 's' : SKIN.has(slug) ? 'k' : 'm', d }));
    }
    return svg;
  }
  function muscleMaps(ex) {
    if (!BODY || ex.missing) return null;
    const prim = new Set(SLUGS[ex.p] || []);
    const sec = new Set(ex.s.flatMap((m) => SLUGS[m] || []).filter((x) => !prim.has(x)));
    return h('div', { class: 'maps' },
      h('figure', {}, bodyFig('front', prim, sec), h('figcaption', { text: 'Face' })),
      h('figure', {}, bodyFig('back', prim, sec), h('figcaption', { text: 'Dos' })));
  }
  /* Bloc visuel d'un exercice : le schéma en grand, l'animation ExerciseDB en vignette
     (un appui l'agrandit). Pour free-exercise-db : le schéma puis les photos en grand. */
  function visual(ex, opts) {
    const zoom = !(opts && opts.static);
    const maps = muscleMaps(ex);
    if (ex.src === 0) {
      const media = photo(ex, 'a', { alt: 'Animation : ' + dn(ex) });
      const box = zoom
        ? h('button', { type: 'button', class: 'anim', 'aria-label': 'Agrandir l’animation', onclick: () => lightbox(ex) }, media, h('span', { class: 'zoom' }, icon('zoom')))
        : h('div', { class: 'anim' }, media);
      return h('div', { class: 'vis' + (maps ? '' : ' nomap') }, maps, box);
    }
    const ph = zoom
      ? h('button', { type: 'button', class: 'visual', 'aria-label': 'Agrandir les photos', onclick: () => lightbox(ex) }, flip(ex, { alt: 'Démonstration : ' + dn(ex) }))
      : h('div', { class: 'visual' }, flip(ex, { alt: dn(ex) }));
    return h('div', { class: 'visf' }, maps ? h('div', { class: 'vis solo' }, maps) : null, ph);
  }
  function lightbox(ex) {
    let close = null;
    const media = ex.src === 0
      ? h('div', { class: 'lb-media sq' }, photo(ex, 'a', { alt: 'Animation : ' + dn(ex) }))
      : h('div', { class: 'lb-media' }, flip(ex, { alt: 'Démonstration : ' + dn(ex) }));
    const box = h('div', { class: 'dialog lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': dn(ex) },
      media, h('p', { class: 'lb-name', text: dn(ex) }),
      h('button', { type: 'button', class: 'btn ghost wide', text: 'Fermer', onclick: () => close() }));
    close = openModal(box);
  }

  /* ---------- stockage : IndexedDB + copie de secours localStorage ---------- */
  let dbp;
  function db() {
    if (!dbp) {
      dbp = new Promise((res, rej) => {
        const r = indexedDB.open('worklog', 1);
        r.onupgradeneeded = () => { r.result.createObjectStore('exercises', { keyPath: 'id' }); r.result.createObjectStore('kv'); };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    }
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then((d) => new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      let out;
      try { out = fn(t.objectStore(store)); } catch (e) { rej(e); return; }
      t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    }));
  }
  const kvGet = (k) => tx('kv', 'readonly', (st) => st.get(k));
  const kvSet = (k, v) => tx('kv', 'readwrite', (st) => { st.put(v, k); });

  /* Une série de musculation : { w, r }. Une série de cardio : { c: 1, dur (s), dist (km), incl, lvl, rounds, kcal }. */
  const fin = (v) => typeof v === 'number' && Number.isFinite(v);
  const validEntry = (e) => e && typeof e.id === 'string' && typeof e.exerciseId === 'string' && fin(e.ts)
    && (e.c === 1 ? fin(e.dur) && e.dur > 0 : fin(e.w) && e.w > 0 && fin(e.r) && e.r > 0);
  const CARDIO_KEYS = ['dist', 'incl', 'lvl', 'rounds', 'kcal'];
  function normEntry(raw) {
    const e = { id: raw.id, exerciseId: raw.exerciseId, name: String(raw.name || raw.exerciseId), ts: raw.ts, created: fin(raw.created) ? raw.created : raw.ts };
    if (raw.c === 1) {
      e.c = 1; e.dur = raw.dur;
      for (const k of CARDIO_KEYS) if (fin(raw[k]) && raw[k] >= 0) e[k] = raw[k];
    } else { e.w = raw.w; e.r = raw.r; }
    return e;
  }
  function cleanSession(s) {
    if (!s || typeof s !== 'object' || !GROUPS.has(s.main)) return null;
    const sec = [...new Set((Array.isArray(s.sec) ? s.sec : []).filter((x) => GROUPS.has(x) && x !== s.main))];
    return { name: typeof s.name === 'string' ? s.name.trim().slice(0, 60) : '', main: s.main, sec };
  }
  function cleanSessions(obj) {
    const out = {};
    if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        const c = /^\d{4}-\d{2}-\d{2}$/.test(k) ? cleanSession(v) : null;
        if (c) out[k] = c;
      }
    }
    return out;
  }
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  function numOrBlank(v) {
    if (fin(v)) return v > 0 ? v : '';
    if (typeof v === 'string' && v.trim()) { const n = calcEval(v); return Number.isFinite(n) && n > 0 ? n : ''; }
    return '';
  }
  const cleanSets = (a) => (Array.isArray(a) ? a.slice(0, 30).map((x) => ({ w: numOrBlank(x && x.w), r: numOrBlank(x && x.r) })) : []);
  function cleanPlans(arr) {
    const out = []; const seen = new Set();
    for (const p of Array.isArray(arr) ? arr : []) {
      if (!p || typeof p.id !== 'string' || seen.has(p.id)) continue;
      seen.add(p.id);
      const ids = new Set();
      const items = (Array.isArray(p.items) ? p.items : []).filter((it) => it && typeof it.ex === 'string' && !ids.has(it.ex) && ids.add(it.ex))
        .map((it) => ({ ex: it.ex, sets: cleanSets(it.sets) }));
      out.push({ id: p.id, name: str(p.name, 60), folder: str(p.folder, 40).trim(), main: GROUPS.has(p.main) ? p.main : '',
        sec: (Array.isArray(p.sec) ? p.sec : []).filter((x) => GROUPS.has(x) && x !== p.main), items,
        created: fin(p.created) ? p.created : Date.now(), last: /^\d{4}-\d{2}-\d{2}$/.test(p.last || '') ? p.last : null });
    }
    return out;
  }
  function cleanDays(obj) {
    const out = {};
    for (const [k, d] of Object.entries(obj && typeof obj === 'object' ? obj : {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !d || typeof d !== 'object') continue;
      const order = [...new Set((Array.isArray(d.order) ? d.order : []).filter((x) => typeof x === 'string'))];
      const plan = {};
      for (const [id, sets] of Object.entries(d.plan && typeof d.plan === 'object' ? d.plan : {})) { const c = cleanSets(sets); if (c.length) plan[id] = c; }
      const note = str(d.note, 4000);
      if (order.length || note) out[k] = { order, plan, note };
    }
    return out;
  }
  function cleanNotes(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj && typeof obj === 'object' ? obj : {})) if (typeof v === 'string' && v.trim()) out[k] = v.slice(0, 4000);
    return out;
  }
  const cleanFolders = (a) => [...new Set((Array.isArray(a) ? a : []).filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 40)))];

  async function saveUser() {
    const payload = { v: DATA_V, savedAt: Date.now(), entries: S.entries, favs: [...S.favs], sessions: S.sessions,
      days: S.days, notes: S.notes, plans: S.plans, folders: S.folders };
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify(payload)); } catch (e) { /* ignoré */ }
    try { await kvSet('user', payload); } catch (e) { console.warn('IndexedDB indisponible', e); }
  }
  async function loadUser() {
    let a = null; let b = null;
    try { a = await kvGet('user'); } catch (e) { /* ignoré */ }
    try { b = JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null'); } catch (e) { /* ignoré */ }
    const isV2 = (p) => p && p.v === DATA_V && Array.isArray(p.entries);
    // Données de la V1 (identifiants de l'ancienne base) : mises de côté une fois, on repart de zéro.
    const old = [a, b].find((p) => p && !isV2(p) && Array.isArray(p.entries) && p.entries.length);
    if (old) { try { if (!localStorage.getItem(ARCHIVE_KEY)) localStorage.setItem(ARCHIVE_KEY, JSON.stringify(old)); } catch (e) { /* ignoré */ } }
    const cands = [a, b].filter(isV2);
    if (!cands.length) { if (a || b) await saveUser(); return; }
    const p = cands.sort((x, y) => (y.savedAt || 0) - (x.savedAt || 0) || y.entries.length - x.entries.length)[0];
    S.entries = p.entries.filter(validEntry).map(normEntry);
    S.favs = new Set((p.favs || []).filter((x) => typeof x === 'string'));
    S.sessions = cleanSessions(p.sessions);
    S.days = cleanDays(p.days);
    S.notes = cleanNotes(p.notes);
    S.plans = cleanPlans(p.plans);
    S.folders = cleanFolders(p.folders);
  }
  async function dropOldCache() {
    try {
      if ((await kvGet('dataV')) === DATA_V) return;
      await tx('exercises', 'readwrite', (st) => { st.clear(); });
      await kvSet('cursor', null); await kvSet('syncDone', null); await kvSet('dataV', DATA_V);
    } catch (e) { /* ignoré */ }
  }

  /* ---------- exercices : liste intégrée à l'app ---------- */
  const getJson = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
  async function loadExercises() {
    try {
      const base = await getJson('data-v3.json');
      const sha = (v) => (typeof v === 'string' && /^[0-9a-f]{7,40}$/.test(v) ? v : 'main');
      SHA_E = sha(base.shaE); SHA_F = sha(base.shaF);
      S.alias = base.alias && typeof base.alias === 'object' ? base.alias : {};
      // [id, nom, source (0 ExerciseDB, 1 free-exercise-db), étirement (0/1), catégorie, muscle principal, muscles secondaires, média]
      S.exercises = base.items.filter((it) => Array.isArray(it) && typeof it[0] === 'string' && it[1] && GROUPS.has(it[4])).map((it) => ({
        id: it[0], name: String(it[1]), src: it[2] === 0 ? 0 : 1, st: it[3] === 1, leaf: it[4], top: topOf(it[4]),
        p: it[5], s: Array.isArray(it[6]) ? it[6] : [], media: it[7] || null, key: skey(it[1]),
      }));
      S.loadError = false;
    } catch (e) {
      S.exercises = []; S.loadError = true;
    }
    if (!BODY) { try { BODY = await getJson('bodymap.json'); } catch (e) { BODY = null; } }
    S.byId = new Map(S.exercises.map((e) => [e.id, e]));
    S.byLeaf = new Map();
    for (const ex of S.exercises) { if (!S.byLeaf.has(ex.leaf)) S.byLeaf.set(ex.leaf, []); S.byLeaf.get(ex.leaf).push(ex); }
    S.byLeaf.forEach((list) => list.sort((x, y) => dn(x).localeCompare(dn(y), 'en')));
  }
  /* Exercices retirés car en double avec ExerciseDB : l'historique et les favoris suivent le nouvel exercice. */
  async function migrateAliases() {
    const al = S.alias || {};
    let changed = false;
    for (const e of S.entries) { const to = al[e.exerciseId]; if (to && S.byId.has(to)) { e.exerciseId = to; e.name = S.byId.get(to).name; changed = true; } }
    for (const id of [...S.favs]) { const to = al[id]; if (to && S.byId.has(to)) { S.favs.delete(id); S.favs.add(to); changed = true; } }
    const mv = (id) => { const to = al[id]; if (to && S.byId.has(to)) { changed = true; return to; } return id; };
    for (const p of S.plans) for (const it of p.items) it.ex = mv(it.ex);
    for (const d of Object.values(S.days)) {
      d.order = [...new Set(d.order.map(mv))];
      for (const id of Object.keys(d.plan)) { const to = mv(id); if (to !== id) { d.plan[to] = d.plan[id]; delete d.plan[id]; } }
    }
    for (const id of Object.keys(S.notes)) { const to = mv(id); if (to !== id && !S.notes[to]) { S.notes[to] = S.notes[id]; delete S.notes[id]; } }
    if (changed) await saveUser();
  }

  /* ---------- petits composants ---------- */
  let toastTimer; let toastSticky = false;
  /* opts.sticky : le message reste affiché même si on change de page (bouton « Annuler » après « Valider »). */
  function toast(msg, opts) {
    const root = document.getElementById('toast');
    root.textContent = '';
    const t = h('div', { class: 't' }, h('span', { text: msg }));
    if (opts && opts.action) {
      t.append(h('button', { type: 'button', text: opts.label || 'Annuler', onclick: () => { root.textContent = ''; toastSticky = false; opts.action(); } }));
    }
    root.append(t);
    toastSticky = !!(opts && opts.sticky);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { root.textContent = ''; toastSticky = false; }, (opts && opts.ms) || 3200);
  }

  /* ----- calcul dans le champ du poids : 20+2,5+2,5 → 25 ----- */
  const fmtIn = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
  const OPS = /[+\-−×÷*/()]/;
  function calcEval(src) {
    const t = String(src).replace(/\s+/g, '').replace(/,/g, '.').replace(/[−–]/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
    if (!t) return NaN;
    let i = 0;
    const num = () => { const m = /^(\d+\.?\d*|\.\d+)/.exec(t.slice(i)); if (!m) throw new Error('n'); i += m[0].length; return parseFloat(m[0]); };
    const factor = () => {
      if (t[i] === '-') { i++; return -factor(); }
      if (t[i] === '+') { i++; return factor(); }
      if (t[i] === '(') { i++; const v = expr(); if (t[i] === ')') i++; return v; }
      return num();
    };
    const term = () => { let v = factor(); while (t[i] === '*' || t[i] === '/') { const op = t[i++]; const r = factor(); v = op === '*' ? v * r : v / r; } return v; };
    const expr = () => { let v = term(); while (t[i] === '+' || t[i] === '-') { const op = t[i++]; const r = term(); v = op === '+' ? v + r : v - r; } return v; };
    try { const v = expr(); return i === t.length && Number.isFinite(v) ? Math.round(v * 100) / 100 : NaN; } catch (e) { return NaN; }
  }
  /* Remplace le calcul par son résultat (touche « = » ou en quittant le champ). */
  function finishCalc(inp) {
    const v = inp.value.trim();
    if (!OPS.test(v.replace(/^[-−]/, ''))) return;
    const n = calcEval(v);
    if (Number.isFinite(n)) { inp.value = fmtIn(n); inp.dispatchEvent(new Event('input', { bubbles: true })); }
  }
  let calcBar = null; let calcTarget = null;
  function hideCalc() { if (calcBar) calcBar.hidden = true; calcTarget = null; }
  function ensureCalcBar() {
    if (calcBar) return calcBar;
    calcBar = h('div', { class: 'calcbar', hidden: true, role: 'toolbar', 'aria-label': 'Calcul du poids' },
      ['+', '−', '×', '÷', '(', ')'].map((k) => h('button', { type: 'button', class: 'ck', 'data-k': k, text: k })),
      h('button', { type: 'button', class: 'ck eq', 'data-k': '=', text: '=' }));
    const press = (b) => {
      const inp = calcTarget;
      if (!b || !inp) return;
      const k = b.dataset.k;
      if (k === '=') finishCalc(inp);
      else {
        const a = inp.selectionStart == null ? inp.value.length : inp.selectionStart;
        const z = inp.selectionEnd == null ? a : inp.selectionEnd;
        inp.setRangeText(k, a, z, 'end');
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
      inp.focus();
    };
    // Appui traité au contact du doigt : le champ garde le focus et le clavier reste ouvert.
    calcBar.addEventListener('pointerdown', (e) => { e.preventDefault(); press(e.target.closest('button')); });
    calcBar.addEventListener('touchstart', (e) => { e.preventDefault(); }, { passive: false });
    calcBar.addEventListener('click', (e) => { if (e.detail === 0) press(e.target.closest('button')); });
    document.body.append(calcBar);
    const place = () => {
      if (calcBar.hidden) return;
      const vv = window.visualViewport;
      const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      calcBar.style.top = Math.round(bottom - calcBar.offsetHeight) + 'px';
    };
    if (window.visualViewport) { visualViewport.addEventListener('resize', place); visualViewport.addEventListener('scroll', place); }
    window.addEventListener('scroll', place, { passive: true });
    calcBar.place = place;
    return calcBar;
  }
  function calcInput(props) {
    const inp = h('input', Object.assign({ class: 'field calc', type: 'text', inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'done' }, props));
    inp.addEventListener('focus', () => { const b = ensureCalcBar(); calcTarget = inp; b.hidden = false; b.place(); setTimeout(b.place, 250); setTimeout(b.place, 600); });
    inp.addEventListener('blur', () => {
      finishCalc(inp);
      setTimeout(() => { if (calcTarget === inp && document.activeElement !== inp) hideCalc(); }, 0);
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); finishCalc(inp); } });
    return inp;
  }

  /* ----- cardio : les données suivies dépendent de l'activité ----- */
  function cardioKind(ex) {
    if (!ex || ex.leaf !== 'cardio') return null;
    const n = ex.key || skey(ex.name);
    if (/jump rope|rope jump/.test(n)) return 'rope';
    if (/elliptical|cross trainer|stairmaster|step ?mill|stepper|ski step/.test(n)) return 'ellip';
    if (/rowing/.test(n)) return 'row';
    if (/bicycl|bike|cycl/.test(n)) return 'bike';
    if (/run|jog|treadmill|walk|sprint/.test(n)) return 'run';
    return 'other';
  }
  const CARDIO = {
    run: { fields: ['dist', 'incl', 'kcal'], metrics: ['dur', 'speed'] },
    bike: { fields: ['dist', 'lvl', 'kcal'], metrics: ['dur', 'speed'] },
    row: { fields: ['dist', 'kcal'], metrics: ['dur', 'speed'] },
    ellip: { fields: ['lvl', 'kcal'], metrics: ['dur', 'lvl'] },
    rope: { fields: ['rounds', 'kcal'], metrics: ['dur', 'rounds'] },
    other: { fields: ['rounds', 'kcal'], metrics: ['dur', 'rounds'] },
  };
  const CFIELD = {
    dist: { label: 'Distance', ph: 'km' }, incl: { label: 'Pente', ph: '%' }, lvl: { label: 'Niveau', ph: 'niv.' },
    rounds: { label: 'Tours', ph: 'tours' }, kcal: { label: 'Calories', ph: 'kcal' },
  };
  function fmtDur(sec) {
    const m = Math.floor(sec / 60); const s2 = Math.round(sec % 60);
    if (m >= 60) return Math.floor(m / 60) + ' h ' + pad2(m % 60);
    return s2 ? m + ' min ' + pad2(s2) : m + ' min';
  }
  const speedOf = (e) => (e.c === 1 && e.dist > 0 && e.dur > 0 ? e.dist / (e.dur / 3600) : null);
  function entryText(e) {
    if (e.c !== 1) return fmtNum(e.w) + ' kg × ' + fmtNum(e.r);
    const kind = cardioKind(S.byId.get(e.exerciseId)) || 'other';
    const out = [fmtDur(e.dur)];
    if (e.dist > 0) out.push(fmtNum(e.dist) + ' km');
    const sp = speedOf(e);
    if (sp && kind === 'row') { const p = e.dur / (e.dist * 2); out.push(Math.floor(p / 60) + ':' + pad2(Math.round(p % 60)) + ' /500 m'); } else if (sp) out.push(fmtNum(Math.round(sp * 10) / 10) + ' km/h');
    if (fin(e.incl)) out.push('pente ' + fmtNum(e.incl) + ' %');
    if (fin(e.lvl)) out.push('niveau ' + fmtNum(e.lvl));
    if (fin(e.rounds)) out.push(plural(e.rounds, 'tour', 'tours'));
    if (fin(e.kcal)) out.push(fmtNum(e.kcal) + ' kcal');
    return out.join(' · ');
  }
  const parseNum = (v) => { const t = String(v == null ? '' : v).trim().replace(',', '.'); return t ? Number(t) : NaN; };
  /* Champs d'une série de cardio, liés à un objet de saisie (chaînes). */
  function cardioFields(kind, row, onInput) {
    const mk = (key, ph, label, mode) => {
      const inp = h('input', { class: 'field', type: 'text', inputmode: mode || 'decimal', placeholder: ph, 'aria-label': label, autocomplete: 'off' });
      inp.value = row[key] || '';
      inp.addEventListener('input', () => { row[key] = inp.value; inp.classList.remove('invalid'); onInput(); });
      (row.nodes = row.nodes || {})[key] = inp;
      return inp;
    };
    return h('div', { class: 'cgrid' },
      h('label', { class: 'cf dur' }, h('span', { text: 'Durée' }),
        h('div', { class: 'durin' }, mk('min', 'min', 'Durée : minutes', 'numeric'), h('span', { text: ':' }), mk('sec', 's', 'Durée : secondes', 'numeric'))),
      CARDIO[kind].fields.map((k) => h('label', { class: 'cf' }, h('span', { text: CFIELD[k].label }), mk(k, CFIELD[k].ph, CFIELD[k].label))));
  }
  function readCardio(kind, row) {
    const min = row.min && String(row.min).trim() ? parseNum(row.min) : 0;
    const sec = row.sec && String(row.sec).trim() ? parseNum(row.sec) : 0;
    const bad = [];
    if (!(min >= 0) || !(sec >= 0) || !(min * 60 + sec > 0)) bad.push('min', 'sec');
    const out = { c: 1, dur: Math.round(min * 60 + sec) };
    for (const k of CARDIO[kind].fields) {
      if (!row[k] || !String(row[k]).trim()) continue;
      const n = parseNum(row[k]);
      if (n >= 0) out[k] = n; else bad.push(k);
    }
    return { ok: !bad.length, vals: out, bad };
  }
  const cardioRowOf = (e) => {
    const r = { min: String(Math.floor(e.dur / 60)), sec: e.dur % 60 ? String(Math.round(e.dur % 60)) : '' };
    for (const k of CARDIO_KEYS) if (fin(e[k])) r[k] = fmtIn(e[k]);
    return r;
  };

  /* ----- glisser de droite à gauche pour supprimer ----- */
  function swipeable(content, onDelete, label) {
    const del = h('button', { type: 'button', class: 'swipe-del', 'aria-label': label || 'Supprimer' }, icon('trash'));
    const wrap = h('div', { class: 'swipe' }, del, content);
    content.classList.add('swipe-c');
    let sx = 0; let sy = 0; let dx = 0; let mode = null; let open = false; let pid = null; let swiped = false;
    const setX = (x, anim) => { content.style.transition = anim ? 'transform .18s ease' : 'none'; content.style.transform = x ? 'translateX(' + x + 'px)' : ''; };
    const shut = () => { open = false; wrap.classList.remove('open'); setX(0, true); };
    content.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || e.target.closest('.handle, input, textarea, select')) return;
      sx = e.clientX; sy = e.clientY; dx = 0; mode = null; pid = e.pointerId;
    });
    content.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid) return;
      const mx = e.clientX - sx; const my = e.clientY - sy;
      if (!mode) {
        if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my) * 1.2) { mode = 'h'; try { content.setPointerCapture(pid); } catch (er) { /* ignoré */ } } else if (Math.abs(my) > 8) mode = 'v';
      }
      if (mode === 'h') { dx = Math.min(0, Math.max(-130, mx + (open ? -88 : 0))); setX(dx); }
    });
    const end = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      if (mode === 'h') {
        swiped = true; setTimeout(() => { swiped = false; }, 350);
        open = dx < -44; wrap.classList.toggle('open', open); setX(open ? -88 : 0, true);
      }
      mode = null;
    };
    content.addEventListener('pointerup', end);
    content.addEventListener('pointercancel', end);
    content.addEventListener('click', (e) => {
      if (swiped) { e.stopPropagation(); e.preventDefault(); return; }
      if (open) { e.stopPropagation(); e.preventDefault(); shut(); }
    }, true);
    del.addEventListener('click', () => { shut(); onDelete(); });
    return wrap;
  }
  /* ----- glisser au doigt ou à la souris depuis une poignée ----- */
  /* Gestes tactiles natifs (le défilement et la sélection de texte sont bloqués dès que le doigt
     touche la poignée) ; la page défile toute seule près des bords de l'écran. */
  function dragTrack(handle, cb) {
    let x = 0; let y = 0; let raf = 0; let on = false;
    const loop = () => {
      if (!on) return;
      const H = window.innerHeight; const edge = 80;
      let v = 0;
      if (y < edge) v = -Math.ceil((edge - y) / 6); else if (y > H - edge) v = Math.ceil((y - (H - edge)) / 6);
      if (v) window.scrollBy(0, v);
      cb.move(x, y);
      raf = requestAnimationFrame(loop);
    };
    const begin = (cx, cy) => { x = cx; y = cy; on = true; document.body.classList.add('dragging-now'); cb.start(x, y); raf = requestAnimationFrame(loop); };
    const end = () => { if (!on) return; on = false; cancelAnimationFrame(raf); document.body.classList.remove('dragging-now'); cb.end(); };
    handle.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      const t = e.touches[0];
      begin(t.clientX, t.clientY);
      const mv = (ev) => { ev.preventDefault(); const t2 = ev.touches[0]; if (t2) { x = t2.clientX; y = t2.clientY; } };
      const up = () => { document.removeEventListener('touchmove', mv); document.removeEventListener('touchend', up); document.removeEventListener('touchcancel', up); end(); };
      document.addEventListener('touchmove', mv, { passive: false });
      document.addEventListener('touchend', up);
      document.addEventListener('touchcancel', up);
    }, { passive: false });
    handle.addEventListener('mousedown', (e) => {
      if (e.button) return;
      e.preventDefault();
      begin(e.clientX, e.clientY);
      const mv = (ev) => { x = ev.clientX; y = ev.clientY; };
      const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); end(); };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
  }
  /* ----- changer l'ordre d'une liste avec la poignée ----- */
  function sortable(list, onDrop) {
    [...list.children].forEach((item) => {
      const hd = item.querySelector('.handle');
      if (!hd) return;
      let startY = 0; let base = 0; let scroll0 = 0;
      const pos = (cy) => cy - startY + (window.scrollY - scroll0) - (item.offsetTop - base);
      dragTrack(hd, {
        start: (cx, cy) => { startY = cy; base = item.offsetTop; scroll0 = window.scrollY; item.classList.add('dragging'); list.classList.add('sorting'); },
        move: (cx, cy) => {
          const dy = pos(cy);
          const prev = item.previousElementSibling; const next = item.nextElementSibling;
          if (prev && dy < -prev.offsetHeight / 2) list.insertBefore(item, prev);
          else if (next && dy > next.offsetHeight / 2) list.insertBefore(next, item);
          item.style.transform = 'translateY(' + pos(cy) + 'px)';
        },
        end: () => {
          item.style.transform = ''; item.classList.remove('dragging'); list.classList.remove('sorting');
          onDrop([...list.children].map((c) => c.dataset.id));
        },
      });
    });
  }
  /* ----- feuille qui monte du bas de l'écran (au-dessus des fenêtres) ----- */
  function bottomSheet(build) {
    const scrim = h('div', { class: 'sheet-scrim' });
    const box = h('div', { class: 'bsheet', role: 'dialog', 'aria-modal': 'true' }, h('span', { class: 'grab', 'aria-hidden': 'true' }));
    let closed = false;
    const close = (after) => {
      if (closed) return; closed = true;
      document.removeEventListener('keydown', onKey);
      scrim.classList.add('out');
      setTimeout(() => { scrim.remove(); if (typeof after === 'function') after(); }, 180);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(onCancel); };
    let onCancel = null;
    build(box, close, (fn) => { onCancel = fn; });
    scrim.addEventListener('click', (e) => { if (e.target === scrim) close(onCancel); });
    scrim.append(box);
    document.body.append(scrim);
    document.addEventListener('keydown', onKey);
    const first = box.querySelector('button, input');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
    return close;
  }
  /* Liste d'actions (menu « … »). */
  function actionSheet(title, items) {
    bottomSheet((box, close) => {
      box.append(h('h2', { class: 'bs-title', text: title }));
      for (const it of items) {
        box.append(h('button', { type: 'button', class: 'bs-item' + (it.danger ? ' danger' : ''), onclick: () => close(it.run) },
          it.icon ? icon(it.icon) : null, h('span', { text: it.label })));
      }
      box.append(h('button', { type: 'button', class: 'btn ghost wide bs-cancel', text: 'Annuler', onclick: () => close() }));
    });
  }
  /* Choix des groupes secondaires : une ligne compacte qui ouvre une liste à cocher. */
  function groupsField(get, set, getMain, id) {
    const btn = h('button', { type: 'button', class: 'field left gfield', id, 'aria-haspopup': 'dialog' });
    const paint = () => {
      const v = get().filter((x) => GROUPS.has(x));
      btn.textContent = '';
      btn.append(h('span', { class: v.length ? 'v' : 'ph', text: v.length ? v.map((x) => GROUPS.get(x).label).join(', ') : 'Aucun' }), icon('down'));
    };
    btn.addEventListener('click', () => {
      const sel = new Set(get());
      const main = getMain();
      bottomSheet((box, close, onCancel) => {
        const done = () => close(() => { set(GROUP_LIST.map((g) => g.id).filter((x) => sel.has(x) && x !== main)); paint(); });
        onCancel(() => { set(GROUP_LIST.map((g) => g.id).filter((x) => sel.has(x) && x !== main)); paint(); });
        box.append(h('h2', { class: 'bs-title', text: 'Groupes secondaires' }));
        const list = h('div', { class: 'gs-list' });
        for (const g of GROUP_LIST) {
          const isMain = g.id === main;
          const cb = h('input', { type: 'checkbox', disabled: isMain });
          cb.checked = sel.has(g.id) && !isMain;
          cb.addEventListener('change', () => { if (cb.checked) sel.add(g.id); else sel.delete(g.id); });
          list.append(h('label', { class: 'gs-row' + (g.sub ? ' sub' : '') + (isMain ? ' main' : '') },
            cb, h('span', { class: 'dot', style: { '--c': g.color } }), h('span', { class: 'gl', text: g.label }), isMain ? h('span', { class: 'gm', text: 'principal' }) : null));
        }
        box.append(list, h('button', { type: 'button', class: 'btn primary wide', text: 'OK', onclick: done }));
      });
    });
    paint();
    btn.repaint = paint;
    return btn;
  }
  /* ----- note libre, enregistrée au fil de la frappe ----- */
  function noteBox(get, set, placeholder, label) {
    const ta = h('textarea', { class: 'note', rows: '1', placeholder, 'aria-label': label });
    ta.value = get() || '';
    const fit = () => { ta.style.height = 'auto'; const b = ta.offsetHeight - ta.clientHeight; ta.style.height = (ta.scrollHeight + b) + 'px'; };
    let t = null; let dirty = false;
    const save = () => { clearTimeout(t); if (!dirty) return; dirty = false; set(ta.value.replace(/\s+$/, '')); saveUser(); };
    ta.addEventListener('input', () => { fit(); dirty = true; clearTimeout(t); t = setTimeout(save, 500); });
    ta.addEventListener('blur', save);
    S.cleanups.push(save);
    requestAnimationFrame(fit);
    return h('div', { class: 'notebox' }, ta);
  }
  function promptDialog(title, label, value, max) {
    return new Promise((resolve) => {
      let close = null;
      const inp = h('input', { class: 'field left', type: 'text', maxlength: String(max || 40), id: 'pr-in', autocomplete: 'off', enterkeyhint: 'done' });
      inp.value = value || '';
      const ok = () => { const v = inp.value.trim(); close(); resolve(v || null); };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
      const box = h('div', { class: 'dialog sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' },
        h('h2', { id: 'dlg-t', text: title }), h('label', { class: 'lbl', for: 'pr-in', text: label }), inp,
        h('div', { class: 'acts' }, h('button', { type: 'button', class: 'btn ghost', text: 'Annuler', onclick: () => { close(); resolve(null); } }),
          h('button', { type: 'button', class: 'btn primary', text: 'Valider', onclick: ok })));
      close = openModal(box, () => resolve(null));
      setTimeout(() => inp.focus(), 50);
    });
  }
  let modalClose = null;
  function openModal(box, onDismiss) {
    const root = document.getElementById('modal-root');
    const close = () => { root.textContent = ''; document.removeEventListener('keydown', onKey); modalClose = null; };
    const dismiss = () => { close(); if (onDismiss) onDismiss(); };
    const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
    const scrim = h('div', { class: 'scrim', onclick: (e) => { if (e.target === scrim) dismiss(); } }, box);
    root.textContent = '';
    root.append(scrim);
    document.addEventListener('keydown', onKey);
    modalClose = dismiss;
    return close;
  }
  function confirmDialog({ title, text, yes, no, safe }) {
    return new Promise((resolve) => {
      let close = null;
      const done = (v) => { close(); resolve(v); };
      const noBtn = h('button', { type: 'button', class: 'btn ghost', text: no || 'Non', onclick: () => done(false) });
      const box = h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' },
        h('h2', { id: 'dlg-t', text: title }), text ? h('p', { text }) : null,
        h('div', { class: 'acts' }, noBtn, h('button', { type: 'button', class: 'btn ' + (safe ? 'primary' : 'danger'), text: yes || 'Oui', onclick: () => done(true) })));
      close = openModal(box, () => resolve(false));
      noBtn.focus();
    });
  }
  function starBtn(id, onChange) {
    const b = h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Favori', 'aria-pressed': String(S.favs.has(id)) }, icon('star'));
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (S.favs.has(id)) S.favs.delete(id); else S.favs.add(id);
      b.setAttribute('aria-pressed', String(S.favs.has(id)));
      saveUser();
      if (onChange) onChange();
    });
    return b;
  }
  const closeBtn = () => h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Fermer', onclick: goHome }, icon('close'));
  const backBtn = () => h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Retour', onclick: goBack }, icon('left'));
  const setText = (w, r) => fmtNum(w) + ' kg × ' + fmtNum(r);
  const tag = (id, main) => { const g = GROUPS.get(id); return g ? h('span', { class: 'tag' + (main ? ' main' : ''), style: { '--c': g.color }, text: g.label }) : null; };

  /* ---------- navigation : une pile de pages, chaque page garde son état ----------
     La flèche retour et le balayage depuis le bord gauche utilisent l'historique du
     navigateur : on revient sur la page précédente telle qu'on l'avait laissée. */
  const app = () => document.getElementById('app');
  const VIEWS = () => ({ home: viewHome, library: viewLibrary, exercise: viewExercise, history: viewHistory, calendar: viewCalendar, session: viewSession, seances: viewSeances, plan: viewPlan });
  /* Transitions : nouvelle page qui arrive de la droite, flèche = page qui part vers la droite,
     croix = page qui descend. Le balayage depuis le bord garde l'animation du navigateur. */
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  /* Retire toute copie d'ancienne page restée à l'écran (animation interrompue). */
  function clearGhosts() {
    document.querySelectorAll('.pg-ghost').forEach((g) => g.remove());
    app().classList.remove('enter');
  }
  window.addEventListener('pageshow', clearGhosts);
  function render(entry, anim) {
    const rootEl = app();
    clearGhosts();
    let ghost = null;
    if (anim && !reduceMotion() && rootEl.firstElementChild) {
      const old = rootEl.firstElementChild;
      const inner = h('div', { class: 'ghost-in' });
      inner.style.transform = 'translateY(' + (-window.scrollY) + 'px)';
      old.remove();
      inner.append(old);
      ghost = h('div', { class: 'pg-ghost ' + (anim === 'fwd' ? 'under' : 'over'), 'aria-hidden': 'true' }, inner);
      document.body.append(ghost);
    }
    if (thumbIO) { thumbIO.disconnect(); }
    S.cleanups.forEach((fn) => fn()); S.cleanups = [];
    S.getUI = null;
    S.guard = null;
    hideCalc();
    if (modalClose) modalClose();
    if (!toastSticky) document.getElementById('toast').textContent = '';
    const root = app();
    root.textContent = '';
    const fn = VIEWS()[entry.view] || viewHome;
    root.append(fn(entry.arg, entry.ui || {}));
    if (S.planDraft && !S.stack.some((e) => e.view === 'plan')) S.planDraft = null;
    const y = (entry.ui && entry.ui.scroll) || 0;
    window.scrollTo(0, y);
    if (y) requestAnimationFrame(() => window.scrollTo(0, y));
    lastScrollY = window.scrollY;
    if (ghost) {
      const cls = anim === 'fwd' ? 'enter' : anim === 'close' ? 'leave-down' : 'leave-right';
      const done = () => { if (ghost) { ghost.remove(); ghost = null; } root.classList.remove('enter'); };
      if (anim === 'fwd') { root.classList.add('enter'); root.addEventListener('animationend', done, { once: true }); } else { ghost.classList.add(cls); ghost.addEventListener('animationend', done, { once: true }); }
      setTimeout(done, 700);
    }
  }
  /* Bandeau du haut : caché quand on descend, de retour dès qu'on remonte un peu. */
  let lastScrollY = 0;
  window.addEventListener('scroll', () => {
    const bar = document.querySelector('#app > main > header.bar');
    const yy = window.scrollY;
    if (!bar) { lastScrollY = yy; return; }
    bar.classList.toggle('stuck', yy > 6);
    const dy = yy - lastScrollY;
    if (Math.abs(dy) < 6) return;
    if (dy > 0 && yy > 90 && !document.body.classList.contains('dragging-now')) bar.classList.add('hidebar');
    else if (dy < 0 || yy <= 90) bar.classList.remove('hidebar');
    lastScrollY = yy;
  }, { passive: true });
  function snapshot() {
    const top = S.stack[S.stack.length - 1];
    if (top) top.ui = Object.assign({}, S.getUI ? S.getUI() : {}, { scroll: window.scrollY });
  }
  /* Saisie non validée : « Enregistrer », « Ne pas enregistrer » ou « Rester ». */
  const guarded = () => !!(S.guard && S.guard.dirty());
  function askLeave(proceed) {
    const g = S.guard;
    let close = null;
    const stay = h('button', { type: 'button', class: 'btn ghost', text: 'Rester', onclick: () => close() });
    const discard = () => { if (g.discard) g.discard(); S.guard = null; proceed(); };
    const box = h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' },
      h('h2', { id: 'dlg-t', text: g.title || 'Enregistrer ta saisie ?' }),
      h('p', { text: g.text || 'Tu as rempli une série sans la valider.' }),
      h('div', { class: 'acts col' },
        h('button', { type: 'button', class: 'btn primary', text: g.yes || 'Enregistrer', onclick: async () => {
          close();
          const miss = g.missing ? g.missing() : [];
          if (miss.length) { if ((await missingDialog(miss, true)) === 'quit') discard(); return; }
          if (await g.save()) { S.guard = null; proceed(); }
        } }),
        h('button', { type: 'button', class: 'btn ghost warn', text: g.no || 'Ne pas enregistrer', onclick: () => { close(); discard(); } }),
        stay));
    close = openModal(box);
    stay.focus();
  }
  /* Informations manquantes : revenir compléter, ou quitter sans enregistrer. */
  function missingDialog(miss, withQuit) {
    return new Promise((resolve) => {
      let close = null;
      const back = h('button', { type: 'button', class: 'btn primary', text: 'Compléter la séance', onclick: () => { close(); resolve('stay'); } });
      const box = h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' },
        h('h2', { id: 'dlg-t', text: 'Impossible de valider' }),
        h('p', { text: 'Il manque ' + miss.join(' et ') + ' pour enregistrer cette séance.' }),
        h('div', { class: 'acts col' }, back,
          withQuit ? h('button', { type: 'button', class: 'btn ghost warn', text: 'Quitter sans enregistrer', onclick: () => { close(); resolve('quit'); } }) : null));
      close = openModal(box, () => resolve('stay'));
      back.focus();
    });
  }
  const leave = (fn) => { if (guarded()) askLeave(fn); else fn(); };
  function goNow(view, arg) {
    snapshot();
    const entry = { view, arg: arg == null ? null : arg, ui: null };
    S.stack.push(entry);
    history.pushState({ i: S.stack.length - 1, view, arg: entry.arg }, '');
    render(entry, 'fwd');
  }
  /* Remplace la page en cours (après validation d'une séance type). */
  function replaceNow(view, arg, anim) {
    const entry = { view, arg: arg == null ? null : arg, ui: null };
    S.stack[S.stack.length - 1] = entry;
    history.replaceState({ i: S.stack.length - 1, view, arg: entry.arg }, '');
    render(entry, anim);
  }
  const go = (view, arg) => leave(() => goNow(view, arg));
  const prevView = () => (S.stack.length > 1 ? S.stack[S.stack.length - 2].view : null);
  function homeNow() {
    const n = S.stack.length - 1;
    S.navAnim = 'close';
    if (n > 0) history.go(-n); else { S.navAnim = null; render(S.stack[0], 'close'); }
  }
  const backNow = () => { if (S.stack.length > 1) { S.navAnim = 'back'; history.back(); } else homeNow(); };
  const goBack = () => leave(backNow);
  const goHome = () => leave(homeNow);
  window.addEventListener('popstate', (ev) => {
    const st = ev.state && typeof ev.state.i === 'number' ? ev.state : { i: 0, view: 'home', arg: null };
    const i = Math.max(0, st.i | 0);
    const cur = S.stack.length - 1;
    if (i < cur && guarded()) {
      // Balayage depuis le bord gauche avec une saisie en cours : on reste et on demande.
      const top = S.stack[cur];
      S.stack = S.stack.slice(0, i + 1).concat([top]);
      history.pushState({ i: i + 1, view: top.view, arg: top.arg }, '');
      S.navAnim = null;
      askLeave(() => history.back());
      return;
    }
    const anim = S.navAnim; S.navAnim = null;
    if (i < S.stack.length) {
      S.stack.length = i + 1;
    } else {
      snapshot();
      while (S.stack.length < i) S.stack.push({ view: 'home', arg: null, ui: null });
      S.stack.push({ view: st.view || 'home', arg: st.arg == null ? null : st.arg, ui: null });
    }
    render(S.stack[S.stack.length - 1], anim);
  });

  /* ---------- accueil ---------- */
  function lastEntry() {
    let best = null;
    for (const e of S.entries) if (!best || (e.created || e.ts) > (best.created || best.ts)) best = e;
    return best;
  }
  function viewHome() {
    const wrap = h('main', { class: 'home' });
    const menu = h('div', { class: 'menu', role: 'menu', hidden: true });
    const menuBtn = h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Menu', 'aria-expanded': 'false' }, icon('menu'));
    const closeMenu = () => { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); };
    const item = (label, fn) => h('button', { type: 'button', role: 'menuitem', text: label, onclick: () => { closeMenu(); fn(); } });
    menu.append(
      item('Historique', () => go('history')),
      item('Calendrier', () => go('calendar')),
      item('Séances', () => go('seances')),
      item('Créer une séance', createPlan),
      h('div', { class: 'ver', 'aria-hidden': 'true', text: 'Version ' + APP_VERSION }),
    );
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      menuBtn.setAttribute('aria-expanded', String(!menu.hidden));
    });
    const onDoc = (e) => { if (!menu.contains(e.target) && e.target !== menuBtn) closeMenu(); };
    const onEsc = (e) => { if (e.key === 'Escape') closeMenu(); };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onEsc);
    S.cleanups.push(() => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onEsc); });

    wrap.append(h('header', { class: 'bar' },
      h('div', { class: 'wordmark' }, h('img', { src: 'icon-192.png', alt: '' }), h('h1', { text: 'WorkLog' })),
      menuBtn, menu));

    const tk = todayKey();
    const tOrder = dayOrder(tk);
    if (S.days[tk] && tOrder.length) {
      const done = new Set(dayEntries(tk).map((e) => e.exerciseId));
      const k = tOrder.filter((id) => done.has(id)).length;
      const s = S.sessions[tk];
      const card = h('button', { type: 'button', class: 'today-card', style: s ? { '--c': GROUPS.get(s.main).color } : null, onclick: () => go('calendar', { day: tk }) },
        h('div', {}, h('span', { class: 'sub', text: 'Séance du jour' }), h('strong', { text: s ? sessionTitle(s) : plural(tOrder.length, 'exercice prévu', 'exercices prévus') }),
          h('span', { class: 'prog', text: k + ' / ' + plural(tOrder.length, 'exercice fait', 'exercices faits') })),
        h('span', { class: 'go' }, icon('right')));
      // Glisser vers la gauche : retirer la séance prévue (les séries déjà faites restent).
      const sw = swipeable(card, () => clearPlanned(tk, () => { snapshot(); render(S.stack[S.stack.length - 1]); }), 'Retirer la séance prévue aujourd’hui');
      sw.classList.add('today-swipe');
      wrap.append(sw);
    }

    const last = lastEntry();
    if (last) {
      const ex = getEx(last.exerciseId, last.name);
      const mine = S.entries.filter((e) => e.exerciseId === last.exerciseId);
      const latest = mine.reduce((a, b) => ((b.created || b.ts) > (a.created || a.ts) ? b : a));
      wrap.append(h('button', { type: 'button', class: 'hero', onclick: () => go('exercise', ex.id) },
        ex.missing ? null : (ex.src === 0 ? visual(ex, { static: true }) : h('div', { class: 'frame' }, flip(ex, { alt: dn(ex) }))),
        h('h2', { text: dn(ex) }),
        latest.c === 1 ? h('p', { class: 'last' }, h('strong', { text: fmtDur(latest.dur) }), latest.dist > 0 ? ' · ' + fmtNum(latest.dist) + ' km' : '')
          : h('p', { class: 'last' }, h('strong', { text: fmtNum(latest.w) + ' kg' }), ' × ' + fmtNum(latest.r)),
        h('p', { class: 'when', text: fDateTime.format(latest.ts) })));
    } else {
      wrap.append(h('button', { type: 'button', class: 'hero empty', onclick: () => go('library') },
        h('h2', { text: 'Pas encore d’exercice' }),
        h('p', { text: 'Choisis un exercice dans la bibliothèque pour noter ta première série.' })));
    }

    wrap.append(h('button', { type: 'button', class: 'lib-card', onclick: () => go('library') },
      h('div', {}, h('strong', { text: 'Bibliothèque' }),
        h('span', { class: 'sub', text: S.exercises.length ? fmtNum(S.exercises.length) + ' exercices · choisir un autre exercice' : 'Choisir un exercice' })),
      h('span', { class: 'go' }, icon('right'))));

    const byDay = daysIndex();
    const named = Object.keys(S.sessions).filter((k) => byDay.has(k)).sort();
    wrap.append(h('button', { type: 'button', class: 'lib-card', onclick: () => go('seances') },
      h('div', {}, h('strong', { text: 'Séances' }),
        h('span', { class: 'sub', text: named.length ? plural(named.length, 'séance enregistrée', 'séances enregistrées') + ' · dernière ' + ago(named[named.length - 1]) : 'Tes séances nommées, par groupe musculaire' })),
      h('span', { class: 'go' }, icon('right'))));
    return wrap;
  }
  async function shareFile(name, text, mime) {
    const file = new File([text], name, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'WorkLog' }); return true; } catch (e) { if (e && e.name === 'AbortError') return false; }
    }
    const url = URL.createObjectURL(file);
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  }

  /* ---------- fiche exercice ---------- */
  const RANGES = [
    { k: '2s', label: '2 semaines', days: 14 },
    { k: '1m', label: '1 mois', days: 30.44 },
    { k: '3m', label: '3 mois', days: 91.3 },
    { k: '6m', label: '6 mois', days: 182.6 },
  ];
  function viewExercise(arg, ui) {
    const id = typeof arg === 'string' ? arg : (arg && arg.id) || '';
    const dayCtx = arg && typeof arg === 'object' && arg.day ? arg.day : null;
    const known = S.entries.find((e) => e.exerciseId === id);
    const ex = getEx(id, known && known.name);
    const kind = cardioKind(ex);
    const metrics = kind ? CARDIO[kind].metrics : ['load'];
    let range = RANGES.some((r) => r.k === ui.range) ? ui.range : '2s';
    let metric = metrics.includes(ui.metric) ? ui.metric : metrics[0];
    S.getUI = () => ({ range, metric });
    const wrap = h('main', { class: 'page exercise' });
    const fromHome = prevView() === 'home' || prevView() === null;
    wrap.append(h('header', { class: 'bar' }, fromHome ? closeBtn() : backBtn(), h('div', { class: 'grow' }), ex.missing ? null : starBtn(ex.id), fromHome ? null : closeBtn()));
    wrap.append(h('h1', { class: 'ex-title', text: dn(ex) }));
    wrap.append(noteBox(() => S.notes[id], (v) => { if (v.trim()) S.notes[id] = v; else delete S.notes[id]; },
      'Note : réglages, position de la machine…', 'Note sur l’exercice'));
    if (!ex.missing) {
      wrap.append(visual(ex));
      const sec = [...new Set(ex.s.map(frMuscle))].filter((m) => m !== frMuscle(ex.p));
      wrap.append(h('div', { class: 'legend' },
        h('p', {}, h('i', { class: 'p' }), h('span', { text: 'Muscle principal : ' }), h('b', { text: frMuscle(ex.p) })),
        sec.length ? h('p', {}, h('i', { class: 's' }), h('span', { text: 'Muscles secondaires : ' }), sec.join(', ')) : null));
      if (ex.src === 0) wrap.append(h('p', { class: 'credit', text: 'Animation © Gym visual' }));
    }

    const recent = h('div', { class: 'recent' });
    const chartBox = h('div');
    const refresh = () => { renderRecent(); renderChart(); };

    function mine() { return S.entries.filter((e) => e.exerciseId === ex.id).sort((a, b) => a.ts - b.ts || (a.created || 0) - (b.created || 0)); }

    function renderRecent() {
      recent.textContent = '';
      const byDay = new Map();
      for (const e of mine()) { const k = dayKey(e.ts); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(e); }
      const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 3);
      if (!days.length) { recent.append(h('p', { class: 'empty-note', text: 'Aucune série pour l’instant. Note ta première série en bas de la page.' })); return; }
      for (const [, list] of days) {
        recent.append(h('div', { class: 'day' },
          h('div', { class: 'dlabel', text: cap(fDayLong.format(list[0].ts)) }),
          h('div', { class: 'sets' }, list.map((e) => h('button', { type: 'button', class: 'set', 'aria-label': 'Modifier la série ' + entryText(e), text: entryText(e), onclick: () => editEntry(e, refresh) })))));
      }
      recent.append(h('p', { class: 'hint', text: 'Touche une série pour la modifier ou la supprimer.' }));
    }

    function renderChart() {
      chartBox.textContent = '';
      if (metrics.length > 1) {
        chartBox.append(h('div', { class: 'tabs two', role: 'tablist', 'aria-label': 'Donnée affichée' },
          metrics.map((m) => h('button', { type: 'button', role: 'tab', class: 'tab', 'aria-selected': String(metric === m), text: METRICS[m].label, onclick: () => { metric = m; renderChart(); } }))));
      }
      chartBox.append(h('div', { class: 'chips fit', role: 'group', 'aria-label': 'Période' },
        RANGES.map((r) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(range === r.k), text: r.label, onclick: () => { range = r.k; renderChart(); } }))));
      const all = mine();
      const end = Math.max(Date.now(), all.length ? all[all.length - 1].ts : 0);
      const start = end - RANGES.find((r) => r.k === range).days * 86400000;
      chartBox.append(buildChart(all.filter((e) => e.ts >= start && e.ts <= end), start, end, METRICS[metric]));
    }

    wrap.append(h('section', { class: 'sec' }, h('h2', { text: 'Dernières séances' }), h('div', { class: 'card' }, recent)));
    wrap.append(h('section', { class: 'sec' }, h('h2', { text: 'Progression' }), h('div', { class: 'card' }, chartBox)));
    let draft = null;
    if (S.draft && S.draft.id === id) { draft = S.draft.rows; S.draft = null; }
    const planned = dayCtx && S.days[dayCtx] && S.days[dayCtx].plan[id] && !dayEntries(dayCtx).some((e) => e.exerciseId === id) ? S.days[dayCtx].plan[id] : null;
    wrap.append(buildForm(ex, { day: dayCtx, draft, planned, arg }, refresh));
    refresh();
    return wrap;
  }

  /* Données affichables sur le graphique. */
  const METRICS = {
    load: { label: 'Charge', note: 'Charge totale par série (kg × répétitions)', val: (e) => e.w * e.r, tick: fmtNum,
      detail: (e) => [fmtNum(e.w) + ' kg × ' + fmtNum(e.r) + ' rép.', 'Total ' + fmtNum(e.w * e.r) + ' · ' + fDateTime.format(e.ts)] },
    dur: { label: 'Durée', note: 'Durée (minutes)', val: (e) => e.dur / 60, tick: (v) => fmtNum(Math.round(v)),
      detail: (e) => [entryText(e), fDateTime.format(e.ts)] },
    speed: { label: 'Vitesse', note: 'Vitesse moyenne (km/h)', val: (e) => speedOf(e), tick: (v) => fmtNum(Math.round(v)),
      detail: (e) => [fmtNum(Math.round(speedOf(e) * 10) / 10) + ' km/h', entryText(e) + ' · ' + fDateTime.format(e.ts)] },
    lvl: { label: 'Niveau', note: 'Niveau', val: (e) => e.lvl, tick: fmtNum, detail: (e) => [entryText(e), fDateTime.format(e.ts)] },
    rounds: { label: 'Tours', note: 'Nombre de tours', val: (e) => e.rounds, tick: fmtNum, detail: (e) => [entryText(e), fDateTime.format(e.ts)] },
  };

  /* Graphique. Bornes : minimum −10 % arrondi à l'entier inférieur, maximum +10 % arrondi au supérieur. */
  function buildChart(all, start, end, M) {
    const box = h('div');
    const pts = all.filter((p) => { const v = M.val(p); return fin(v) && v > 0; });
    if (!pts.length) {
      box.append(h('p', { class: 'empty-note', text: all.length ? 'Pas de donnée « ' + M.label.toLowerCase() + ' » sur cette période.' : 'Aucune série sur cette période.' }));
      return box;
    }
    const vals = pts.map(M.val);
    const lo = Math.max(0, Math.floor(Math.min(...vals) * 0.9));
    let hi = Math.ceil(Math.max(...vals) * 1.1);
    if (hi <= lo) hi = lo + 1;
    const W = 340; const H = 210; const m = { l: 48, r: 12, t: 12, b: 28 };
    const x = (t) => m.l + ((t - start) / (end - start || 1)) * (W - m.l - m.r);
    const y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
    const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Courbe de progression : ' + pts.length + ' séries' });

    const steps = Math.min(4, hi - lo);
    const seen = new Set();
    for (let i = 0; i <= steps; i++) {
      const v = Math.round(lo + ((hi - lo) * i) / steps);
      if (seen.has(v)) continue; seen.add(v);
      svg.append(sv('line', { class: 'grid', x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
      svg.append(sv('text', { class: 'tick', x: m.l - 8, y: y(v) + 3.5, 'text-anchor': 'end' }, M.tick(v)));
    }
    [0, 1 / 3, 2 / 3, 1].forEach((f, i) => {
      const t = start + (end - start) * f;
      svg.append(sv('text', { class: 'tick', x: m.l + f * (W - m.l - m.r), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === 3 ? 'end' : 'middle' }, fDayShort.format(t)));
    });

    const sorted = [...pts].sort((a, b) => a.ts - b.ts);
    if (sorted.length > 1) {
      svg.append(sv('path', { class: 'line', d: sorted.map((p, i) => (i ? 'L' : 'M') + x(p.ts).toFixed(1) + ' ' + y(M.val(p)).toFixed(1)).join(' ') }));
    }
    const detail = h('div', { class: 'detail', 'aria-live': 'polite' });
    const dots = [];
    const select = (i) => {
      dots.forEach((d, j) => d.setAttribute('class', j === i ? 'dot on' : 'dot'));
      const [a, b] = M.detail(sorted[i]);
      detail.textContent = '';
      detail.append(h('strong', { text: a }), h('span', { class: 'sub', text: b }));
    };
    sorted.forEach((p) => {
      const dot = sv('circle', { class: 'dot', cx: x(p.ts), cy: y(M.val(p)), r: 5 });
      dots.push(dot); svg.append(dot);
    });
    sorted.forEach((p, i) => {
      const hit = sv('circle', { class: 'hit', cx: x(p.ts), cy: y(M.val(p)), r: 16, tabindex: '0', role: 'button', 'aria-label': M.detail(p).join(', ') });
      hit.addEventListener('click', () => select(i));
      hit.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); } });
      svg.append(hit);
    });
    box.append(h('p', { class: 'chart-note', text: M.note }), svg, detail);
    select(sorted.length - 1);
    return box;
  }

  /* Saisie des séries.
     ctx.day : séance d'un jour précis (séries datées de ce jour) ; ctx.planned : séries prévues ;
     ctx.draft : saisie remise après « Annuler ». */
  function buildForm(ex, ctx, onSaved) {
    const kind = cardioKind(ex);
    const rows = [];
    const list = h('div', { class: 'rows' });
    const msg = h('p', { class: 'form-msg', role: 'alert' });
    const fixedDay = ctx.day && ctx.day !== todayKey() ? ctx.day : null;
    const baseDt = (i) => (fixedDay ? keyDate(fixedDay).getTime() + 18 * 3600000 + i * 120000 : Date.now());
    const keys = kind ? ['min', 'sec'].concat(CARDIO[kind].fields) : ['w', 'r'];
    const newRow = (vals) => {
      const r = { dt: baseDt(rows.length), manual: !!fixedDay };
      for (const k of keys) r[k] = vals && vals[k] != null ? String(vals[k]) : '';
      return r;
    };
    const isFilled = (r) => keys.some((k) => String(r[k] || '').trim());
    const toStr = (v) => (fin(v) ? fmtIn(v) : typeof v === 'string' ? v : '');

    function renderRows() {
      list.textContent = '';
      rows.forEach((row, i) => {
        row.nodes = {};
        const dIn = h('input', { class: 'field', type: 'datetime-local', 'aria-label': 'Date et heure de la série ' + (i + 1) });
        dIn.value = toLocalInput(row.dt);
        const touch = () => {
          msg.textContent = '';
          if (!row.manual) { row.dt = Date.now(); dIn.value = toLocalInput(row.dt); }
        };
        dIn.addEventListener('change', () => {
          const t = new Date(dIn.value).getTime();
          if (Number.isFinite(t)) { row.dt = t; row.manual = true; } else { row.manual = false; row.dt = Date.now(); dIn.value = toLocalInput(row.dt); }
        });
        const dup = h('button', { type: 'button', class: 'iconbtn plain mini', 'aria-label': 'Dupliquer la série ' + (i + 1),
          onclick: () => { const c = newRow(row); rows.splice(i + 1, 0, c); renderRows(); } }, icon('copy'));
        const rm = rows.length > 1 ? h('button', { type: 'button', class: 'iconbtn plain mini', 'aria-label': 'Retirer la série ' + (i + 1), onclick: () => { rows.splice(i, 1); renderRows(); } }, icon('close')) : h('span', { class: 'mini' });
        if (kind) {
          const live = h('span', { class: 'live' });
          const upd = () => { const r = readCardio(kind, row); live.textContent = r.ok && speedOf(r.vals) ? fmtNum(Math.round(speedOf(r.vals) * 10) / 10) + ' km/h' : ''; };
          list.append(h('div', { class: 'crow' },
            h('div', { class: 'chead' }, h('span', { class: 'n', text: String(i + 1) }), live, h('span', { class: 'grow' }), dup, rm),
            cardioFields(kind, row, () => { touch(); upd(); }),
            h('div', { class: 'dt-line' }, h('span', { text: 'Le' }), dIn)));
          upd();
        } else {
          const wIn = calcInput({ placeholder: 'kg', 'aria-label': 'Poids de la série ' + (i + 1) + ' en kilos' });
          const rIn = h('input', { class: 'field', type: 'text', inputmode: 'numeric', placeholder: 'rép.', 'aria-label': 'Répétitions de la série ' + (i + 1), autocomplete: 'off' });
          wIn.value = row.w; rIn.value = row.r;
          wIn.addEventListener('input', () => { row.w = wIn.value; wIn.classList.remove('invalid'); touch(); });
          rIn.addEventListener('input', () => { row.r = rIn.value; rIn.classList.remove('invalid'); touch(); });
          row.nodes = { w: wIn, r: rIn };
          list.append(h('div', { class: 'srow' },
            h('span', { class: 'n', text: String(i + 1) }), wIn, h('span', { class: 'times', 'aria-hidden': 'true', text: '×' }), rIn, dup, rm,
            h('div', { class: 'dt-line' }, h('span', { text: 'Le' }), dIn)));
        }
      });
    }
    if (ctx.draft && ctx.draft.length) ctx.draft.forEach((d) => rows.push(Object.assign(newRow(d), { dt: d.dt, manual: d.manual })));
    else if (ctx.planned && ctx.planned.length && !kind) ctx.planned.forEach((p) => rows.push(newRow({ w: toStr(p.w), r: toStr(p.r) })));
    else rows.push(newRow());
    renderRows();

    /* Enregistre les séries remplies ; renvoie false si une valeur est invalide. */
    async function save() {
      msg.textContent = '';
      rows.forEach((r) => { if (r.nodes && r.nodes.w) finishCalc(r.nodes.w); });
      const filled = rows.filter(isFilled);
      if (!filled.length) { msg.textContent = kind ? 'Renseigne au moins la durée.' : 'Renseigne le poids et les répétitions d’au moins une série.'; return false; }
      let bad = false;
      const vals = filled.map((row) => {
        if (kind) {
          const r = readCardio(kind, row);
          r.bad.forEach((k) => row.nodes[k] && row.nodes[k].classList.add('invalid'));
          if (!r.ok) bad = true;
          return r.vals;
        }
        const w = calcEval(row.w); const r = parseNum(row.r);
        const okW = Number.isFinite(w) && w > 0; const okR = Number.isInteger(r) && r > 0;
        row.nodes.w.classList.toggle('invalid', !okW); row.nodes.r.classList.toggle('invalid', !okR);
        if (!okW || !okR) bad = true;
        return { w, r };
      });
      if (bad) { msg.textContent = kind ? 'Durée obligatoire ; les autres valeurs doivent être des nombres.' : 'Poids : un nombre positif. Répétitions : un nombre entier.'; return false; }
      const base = Date.now();
      const created = [];
      filled.forEach((row, i) => {
        const e = Object.assign({ id: uid(), exerciseId: ex.id, name: dn(ex), ts: row.dt, created: base + i }, vals[i]);
        S.entries.push(e); created.push(e.id);
        const k = dayKey(e.ts);
        if (S.days[k] && !S.days[k].order.includes(ex.id)) S.days[k].order.push(ex.id);
      });
      await saveUser();
      const draft = filled.map((r) => { const o = { dt: r.dt, manual: r.manual }; keys.forEach((k) => { o[k] = r[k]; }); return o; });
      const n = filled.length;
      rows.length = 0; rows.push(newRow()); renderRows();
      toast(n + (n > 1 ? ' séries enregistrées' : ' série enregistrée'), { ms: 6000, sticky: true, action: () => undoSave(ex.id, created, draft, ctx.arg) });
      onSaved();
      return true;
    }
    S.guard = { dirty: () => rows.some(isFilled), save };

    return h('section', { class: 'sec' },
      h('h2', { text: 'Nouvelle série' + (fixedDay ? ' · ' + cap(fDayLong.format(keyDate(fixedDay))) : '') }),
      h('div', { class: 'card' }, list,
        h('div', { class: 'form-actions' },
          msg,
          h('button', { type: 'button', class: 'btn ghost', onclick: () => { rows.push(newRow()); renderRows(); const last = rows[rows.length - 1]; const f = last.nodes.w || last.nodes.min; if (f) f.focus(); } }, icon('plus'), 'Ajouter une série'),
          h('button', { type: 'button', class: 'btn primary', onclick: save, text: 'Valider' }))));
  }
  /* « Annuler » après « Valider » : les séries sont retirées et la saisie revient sur la page de l'exercice. */
  function undoSave(exId, ids, draft, arg) {
    const set = new Set(ids);
    S.entries = S.entries.filter((e) => !set.has(e.id));
    saveUser();
    S.draft = { id: exId, rows: draft };
    const top = S.stack[S.stack.length - 1];
    const topId = top && top.view === 'exercise' ? (typeof top.arg === 'string' ? top.arg : top.arg && top.arg.id) : null;
    if (topId === exId) { snapshot(); S.guard = null; render(top); } else go('exercise', arg || exId);
  }
  /* Modifier ou supprimer une série déjà enregistrée. */
  function editEntry(e, onDone) {
    const ex = getEx(e.exerciseId, e.name);
    const kind = e.c === 1 ? (cardioKind(ex) || 'other') : null;
    const msg = h('p', { class: 'form-msg', role: 'alert' });
    let row; let fields;
    if (kind) { row = cardioRowOf(e); fields = cardioFields(kind, row, () => { msg.textContent = ''; }); } else {
      row = { w: fmtIn(e.w), r: String(e.r) };
      const wIn = calcInput({ placeholder: 'kg', 'aria-label': 'Poids en kilos' }); wIn.value = row.w;
      const rIn = h('input', { class: 'field', type: 'text', inputmode: 'numeric', placeholder: 'rép.', 'aria-label': 'Répétitions', autocomplete: 'off' }); rIn.value = row.r;
      wIn.addEventListener('input', () => { row.w = wIn.value; wIn.classList.remove('invalid'); });
      rIn.addEventListener('input', () => { row.r = rIn.value; rIn.classList.remove('invalid'); });
      row.nodes = { w: wIn, r: rIn };
      fields = h('div', { class: 'srow edit' }, wIn, h('span', { class: 'times', text: '×' }), rIn);
    }
    const dIn = h('input', { class: 'field left', type: 'datetime-local', id: 'ed-dt' });
    dIn.value = toLocalInput(e.ts);
    let close = null;
    const save = async () => {
      let vals;
      if (kind) { const r = readCardio(kind, row); r.bad.forEach((k) => row.nodes[k] && row.nodes[k].classList.add('invalid')); if (!r.ok) { msg.textContent = 'Durée obligatoire ; les autres valeurs doivent être des nombres.'; return; } vals = r.vals; } else {
        finishCalc(row.nodes.w);
        const w = calcEval(row.w); const r = parseNum(row.r);
        const okW = Number.isFinite(w) && w > 0; const okR = Number.isInteger(r) && r > 0;
        row.nodes.w.classList.toggle('invalid', !okW); row.nodes.r.classList.toggle('invalid', !okR);
        if (!okW || !okR) { msg.textContent = 'Poids : un nombre positif. Répétitions : un nombre entier.'; return; }
        vals = { w, r };
      }
      const t = new Date(dIn.value).getTime();
      if (kind) CARDIO_KEYS.forEach((k) => { delete e[k]; });
      Object.assign(e, vals, Number.isFinite(t) ? { ts: t } : {});
      await saveUser();
      close(); onDone(); toast('Série modifiée');
    };
    const box = h('div', { class: 'dialog sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' },
      h('h2', { id: 'dlg-t', text: 'Modifier la série' }), h('p', { class: 'ed-name', text: dn(ex) }),
      fields, h('label', { class: 'lbl', for: 'ed-dt', text: 'Date et heure' }), dIn, msg,
      h('div', { class: 'acts' }, h('button', { type: 'button', class: 'btn ghost', text: 'Annuler', onclick: () => close() }),
        h('button', { type: 'button', class: 'btn primary', text: 'Enregistrer', onclick: save })),
      h('button', { type: 'button', class: 'textbtn danger center', text: 'Supprimer cette série', onclick: () => { close(); deleteEntry(e, onDone); } }));
    close = openModal(box, hideCalc);
    const c0 = close; close = () => { hideCalc(); c0(); };
  }
  function deleteEntry(e, onDone) {
    const i = S.entries.findIndex((x) => x.id === e.id);
    if (i < 0) return;
    S.entries.splice(i, 1);
    saveUser(); onDone();
    toast('Série supprimée', { ms: 6000, action: () => { S.entries.push(e); saveUser(); onDone(); } });
  }

  /* ---------- bibliothèque : onglets Favoris / Musculation / Étirements ---------- */
  const TABS = [['fav', 'Favoris'], ['musc', 'Musculation'], ['str', 'Étirements']];
  function viewLibrary(arg, ui) {
    const wrap = h('main', { class: 'page library' });
    // Mode « ajouter des exercices » à une séance du jour (pick: 'day') ou à une séance type (pick: 'plan').
    const pick = arg && arg.pick ? arg : null;
    const pickPlan = pick && pick.pick === 'plan' ? (S.planDraft && S.planDraft.p.id === pick.id ? S.planDraft.p : S.plans.find((p) => p.id === pick.id)) : null;
    const picked = (id) => (pickPlan ? pickPlan.items.some((it) => it.ex === id) : pick ? dayOrder(pick.id).includes(id) : false);
    function togglePick(ex, row) {
      if (pickPlan) {
        if (picked(ex.id)) pickPlan.items = pickPlan.items.filter((it) => it.ex !== ex.id); else pickPlan.items.push({ ex: ex.id, sets: [] });
      } else {
        const d = dayMeta(pick.id, true);
        if (picked(ex.id)) {
          if (dayEntries(pick.id).some((e) => e.exerciseId === ex.id)) { toast('Cet exercice a déjà des séries ce jour-là.'); return; }
          d.order = d.order.filter((x) => x !== ex.id); delete d.plan[ex.id];
        } else if (!d.order.includes(ex.id)) d.order = dayOrder(pick.id).concat([ex.id]);
      }
      if (!pickPlan) saveUser();
      row.classList.toggle('picked', picked(ex.id));
      row.setAttribute('aria-checked', String(picked(ex.id)));
      countEl.textContent = pickPlan ? String(pickPlan.items.length) : String(dayOrder(pick.id).length);
    }
    const countEl = h('span', { class: 'pcount' });
    if (pick) {
      countEl.textContent = pickPlan ? String(pickPlan.items.length) : String(dayOrder(pick.id).length);
      wrap.append(h('header', { class: 'bar' }, backBtn(), h('h1', { class: 'grow', text: 'Ajouter des exercices' }),
        h('button', { type: 'button', class: 'btn primary okbtn', onclick: goBack }, 'OK ', countEl)));
    } else wrap.append(h('header', { class: 'bar' }, closeBtn(), h('h1', { class: 'grow', text: 'Bibliothèque' }), h('span')));
    const search = h('input', { class: 'search', type: 'search', placeholder: 'Rechercher un exercice', 'aria-label': 'Rechercher un exercice', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', enterkeyhint: 'search' });
    search.value = ui.q || '';
    const tabBar = h('div', { class: 'tabs', role: 'tablist' });
    const body = h('div');
    const clearBtn = h('button', { type: 'button', class: 'clear', 'aria-label': 'Effacer la recherche', hidden: !search.value,
      onclick: () => { search.value = ''; clearBtn.hidden = true; render(); search.focus(); } }, icon('close'));
    wrap.append(h('div', { class: 'searchbox' }, search, clearBtn), tabBar, body);
    let tab = TABS.some((t) => t[0] === ui.tab) ? ui.tab : (S.favs.size ? 'fav' : 'musc');
    // Groupes dépliés (Musculation, Étirements) ou repliés (Favoris, dépliés par défaut).
    const toggled = new Set(Array.isArray(ui.open) ? ui.open : []);
    S.getUI = () => ({ q: search.value, tab, open: [...toggled] });
    const inTab = (ex) => (tab === 'fav' ? S.favs.has(ex.id) : tab === 'str' ? ex.st : !ex.st);

    function onStar(ex) {
      if (search.value.trim() || tab !== 'fav' || S.favs.has(ex.id)) return;
      render();
      toast('Retiré des favoris', { ms: 5000, action: () => { S.favs.add(ex.id); saveUser(); render(); } });
    }
    const exRow = (ex, showKind) => {
      const label = h('span', { class: 'nm' }, dn(ex), showKind && ex.st ? h('span', { class: 'kind', text: 'Étirement' }) : null);
      if (pick) {
        // Toute la ligne sélectionne ; la loupe agrandit l'animation.
        const row = h('div', { class: 'exrow pickrow' + (picked(ex.id) ? ' picked' : ''), role: 'checkbox', tabindex: '0', 'aria-checked': String(picked(ex.id)) });
        row.addEventListener('click', () => togglePick(ex, row));
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePick(ex, row); } });
        row.append(h('span', { class: 'tw' }, thumb(ex),
          ex.missing ? null : h('button', { type: 'button', class: 'loupe', 'aria-label': 'Agrandir l’animation de ' + dn(ex), onclick: (e) => { e.stopPropagation(); lightbox(ex); } }, icon('zoom'))),
          label, h('span', { class: 'pick', 'aria-hidden': 'true' }, icon('check')));
        return row;
      }
      return h('div', { class: 'exrow' },
        h('button', { type: 'button', class: 'open', onclick: () => go('exercise', ex.id) }, thumb(ex, { zoom: true }), label),
        starBtn(ex.id, () => onStar(ex)));
    };

    /* Un groupe repliable ; son contenu n'est construit qu'à la première ouverture. */
    function group(gid, label, count, fill, cls) {
      const key = tab + ':' + gid;
      const defOpen = tab === 'fav';
      const d = h('details', { class: 'group ' + (cls || '') },
        h('summary', {}, h('span', {}, label, h('span', { class: 'count', text: String(count) })), icon('down')));
      let filled = false;
      const ensure = () => { if (!filled) { filled = true; d.append(fill()); } };
      if (defOpen !== toggled.has(key)) { d.open = true; ensure(); }
      d.addEventListener('toggle', () => {
        if (d.open) ensure();
        if (d.open !== defOpen) toggled.add(key); else toggled.delete(key);
      });
      return d;
    }
    const leafList = (id) => (S.byLeaf.get(id) || []).filter(inTab);

    function renderTabs(hidden) {
      tabBar.textContent = '';
      tabBar.hidden = hidden;
      for (const [id, label] of TABS) {
        tabBar.append(h('button', { type: 'button', role: 'tab', class: 'tab', 'aria-selected': String(tab === id), text: label,
          onclick: () => { if (tab !== id) { tab = id; render(); } } }));
      }
    }

    function render() {
      body.textContent = '';
      if (S.loadError || !S.exercises.length) {
        renderTabs(true);
        body.append(h('div', { class: 'loader' },
          h('strong', { text: 'Liste des exercices indisponible' }),
          h('p', { class: 'err', text: 'Le fichier des exercices n’a pas pu être lu. Vérifie ta connexion puis réessaie.' }),
          h('button', { type: 'button', class: 'btn primary', text: 'Réessayer', onclick: async () => { await loadExercises(); render(); } })));
        return;
      }
      const raw = search.value.trim();
      renderTabs(!!raw);
      if (raw) {
        // « pull up », « pull-up » et « pullup » trouvent les mêmes exercices.
        // Ordre : nom exact, puis noms qui commencent par la recherche, puis ceux qui la contiennent
        // telle quelle, puis le reste ; à égalité, le nom le plus court d'abord.
        const q = skey(raw);
        const tokens = q.split(' ');
        const qc = q.replace(/ /g, '');
        const rank = (ex) => {
          const k = ex.key;
          if (k === q || k.replace(/ /g, '') === qc) return 0;
          if (k.startsWith(q + ' ')) return 1;
          if ((' ' + k + ' ').includes(' ' + q + ' ')) return 2;
          if (k.startsWith(q)) return 3;
          return 4;
        };
        const hits = S.exercises.filter((ex) => tokens.every((t) => ex.key.includes(t)) || (qc.length > 2 && ex.key.replace(/ /g, '').includes(qc)))
          .map((ex) => [rank(ex), ex]).sort((a, b) => a[0] - b[0] || a[1].key.length - b[1].key.length || a[1].key.localeCompare(b[1].key)).map((x) => x[1]);
        if (!hits.length) { body.append(h('p', { class: 'empty-note', text: 'Aucun exercice ne correspond à « ' + raw + ' ».' })); return; }
        body.append(h('div', { class: 'results' }, hits.slice(0, 60).map((ex) => exRow(ex, true))));
        if (hits.length > 60) body.append(h('p', { class: 'empty-note more', text: hits.length + ' résultats, les 60 premiers sont affichés. Précise ta recherche.' }));
        return;
      }
      const wrapG = h('div', { class: 'groups' });
      for (const t of TREE) {
        if (t.subs) {
          const subs = t.subs.filter((s) => leafList(s.id).length);
          const total = subs.reduce((n, s) => n + leafList(s.id).length, 0);
          if (!total) continue;
          wrapG.append(group(t.id, t.label, total, () => h('div', { class: 'subgroups' },
            subs.map((s) => group(t.id + '/' + s.id, s.label, leafList(s.id).length, () => h('div', { class: 'exlist' }, leafList(s.id).map((ex) => exRow(ex))), 'sub')))));
        } else {
          const list = leafList(t.id);
          if (!list.length) continue; // une catégorie sans exercice n'est pas affichée
          wrapG.append(group(t.id, t.label, list.length, () => h('div', { class: 'exlist' }, list.map((ex) => exRow(ex)))));
        }
      }
      if (!wrapG.childElementCount) {
        body.append(h('p', { class: 'empty-note', text: tab === 'fav' ? 'Aucun favori pour l’instant. Touche l’étoile à côté d’un exercice pour le retrouver ici, rangé par catégorie.' : 'Aucun exercice dans cet onglet.' }));
        return;
      }
      body.append(wrapG);
    }

    let t;
    search.addEventListener('input', () => { clearBtn.hidden = !search.value; clearTimeout(t); t = setTimeout(render, 60); });
    render();
    return wrap;
  }

  /* ---------- historique ---------- */
  function viewHistory() {
    const wrap = h('main', { class: 'page history' });
    const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    wrap.append(h('header', { class: 'bar' }, closeBtn(), h('h1', { class: 'grow', text: 'Historique' }),
      h('button', { type: 'button', class: 'textbtn danger', text: 'Tout supprimer', onclick: wipeAll })));
    wrap.append(h('div', { class: 'tools' },
      h('button', { type: 'button', class: 'pill', onclick: exportData }, icon('export'), 'Exporter'),
      h('button', { type: 'button', class: 'pill', onclick: () => fileIn.click() }, icon('import'), 'Importer'), fileIn));
    const list = h('div');
    wrap.append(list);

    function render() {
      list.textContent = '';
      if (!S.entries.length) { list.append(h('p', { class: 'empty-note', text: 'Aucune série enregistrée. Elles apparaîtront ici dès ta première validation.' })); return; }
      const sorted = [...S.entries].sort((a, b) => b.ts - a.ts || (b.created || 0) - (a.created || 0));
      let cur = '';
      for (const e of sorted) {
        const k = dayKey(e.ts);
        if (k !== cur) { cur = k; list.append(h('div', { class: 'dayhead', text: dayLabel(new Date(e.ts)) })); }
        const ex = getEx(e.exerciseId, e.name);
        list.append(h('div', { class: 'hrow' },
          h('button', { type: 'button', class: 'hedit', 'aria-label': 'Modifier : ' + dn(ex) + ', ' + entryText(e), onclick: () => editEntry(e, render) }, h('div', { class: 'nm', text: dn(ex) }),
            h('div', { class: 'meta' }, h('b', { text: entryText(e) }), (e.c === 1 ? '' : ' · total ' + fmtNum(e.w * e.r)) + ' · ' + fTime.format(e.ts))),
          h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Supprimer cette série', onclick: () => removeOne(e) }, icon('trash'))));
      }
    }
    function removeOne(e) {
      const idx = S.entries.findIndex((x) => x.id === e.id);
      if (idx < 0) return;
      S.entries.splice(idx, 1);
      saveUser(); render();
      toast('Série supprimée', { ms: 5000, action: () => { S.entries.push(e); saveUser(); render(); } });
    }
    async function wipeAll() {
      const nSess = Object.keys(S.sessions).length + Object.keys(S.days).length;
      if (!S.entries.length && !nSess) { toast('Il n’y a rien à supprimer.'); return; }
      const ok = await confirmDialog({ title: 'Êtes-vous sûr de vouloir faire ça ?', text: 'Toutes les séries (' + S.entries.length + '), les noms et notes de séances seront supprimés. Tes favoris, tes notes d’exercices et tes séances types sont conservés.', yes: 'Oui', no: 'Non' });
      if (!ok) return;
      S.entries = []; S.sessions = {}; S.days = {}; await saveUser(); render(); toast('Historique supprimé');
    }
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files && fileIn.files[0]; fileIn.value = '';
      if (!f) return;
      const res = await importFile(f);
      if (res) render();
    });
    render();
    return wrap;
  }
  async function exportData() {
    const data = { app: 'WorkLog', version: DATA_V, exportedAt: new Date().toISOString(), entries: S.entries, favorites: [...S.favs], sessions: S.sessions,
      days: S.days, notes: S.notes, plans: S.plans, folders: S.folders };
    const ok = await shareFile('worklog-' + dayKey(Date.now()) + '.json', JSON.stringify(data, null, 2), 'application/json');
    if (ok) toast('Sauvegarde prête : enregistre-la dans ton dossier.');
  }
  async function importFile(file) {
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('trop gros');
      const d = JSON.parse(await file.text());
      if (!d || d.app !== 'WorkLog' || !Array.isArray(d.entries)) throw new Error('format');
      const sig = (e) => (e.c === 1 ? [e.exerciseId, e.ts, 'c', e.dur, e.dist] : [e.exerciseId, e.ts, e.w, e.r]).join('|');
      const ids = new Set(S.entries.map((e) => e.id)); const sigs = new Set(S.entries.map(sig));
      let added = 0; let dupes = 0; let invalid = 0;
      for (const raw of d.entries) {
        if (!validEntry(raw)) { invalid++; continue; }
        if (ids.has(raw.id) || sigs.has(sig(raw))) { dupes++; continue; }
        const e = normEntry(raw);
        S.entries.push(e); ids.add(e.id); sigs.add(sig(e)); added++;
      }
      (Array.isArray(d.favorites) ? d.favorites : []).forEach((id) => { if (typeof id === 'string') S.favs.add(id); });
      // Noms de séances : on ajoute ceux qui manquent, sans écraser ceux déjà présents.
      for (const [k, v] of Object.entries(cleanSessions(d.sessions))) if (!S.sessions[k]) S.sessions[k] = v;
      // Notes, séances types, journées et dossiers : on ajoute ce qui manque, sans rien écraser.
      for (const [k, v] of Object.entries(cleanNotes(d.notes))) if (!S.notes[k]) S.notes[k] = v;
      for (const [k, v] of Object.entries(cleanDays(d.days))) if (!S.days[k]) S.days[k] = v;
      const have = new Set(S.plans.map((p) => p.id));
      for (const p of cleanPlans(d.plans)) if (!have.has(p.id)) S.plans.push(p);
      S.folders = cleanFolders(S.folders.concat(Array.isArray(d.folders) ? d.folders : []));
      await saveUser();
      await migrateAliases();
      toast(added + (added > 1 ? ' séries ajoutées' : ' série ajoutée') + (dupes ? ', ' + dupes + ' déjà présente' + (dupes > 1 ? 's' : '') : '') + (invalid ? ', ' + invalid + ' ligne' + (invalid > 1 ? 's' : '') + ' invalide' + (invalid > 1 ? 's ignorées' : ' ignorée') : ''), { ms: 4500 });
      return true;
    } catch (e) {
      toast('Fichier non reconnu : choisis une sauvegarde WorkLog (.json).');
      return false;
    }
  }

  /* ---------- séances : données d'une journée ---------- */
  function daysIndex() {
    const m = new Map();
    for (const e of S.entries) { const k = dayKey(e.ts); if (!m.has(k)) m.set(k, []); m.get(k).push(e); }
    return m;
  }
  function dayStats(list) {
    return { nEx: new Set(list.map((e) => e.exerciseId)).size, nSets: list.length, load: list.reduce((n, e) => n + (e.c === 1 ? 0 : e.w * e.r), 0) };
  }
  const todayKey = () => dayKey(Date.now());
  function dayMeta(key, create) {
    if (!S.days[key] && create) S.days[key] = { order: [], plan: {}, note: '' };
    return S.days[key] || null;
  }
  const dayEntries = (key) => S.entries.filter((e) => dayKey(e.ts) === key).sort((a, b) => a.ts - b.ts || (a.created || 0) - (b.created || 0));
  /* Ordre des exercices d'une journée : l'ordre choisi, puis les exercices faits sans y figurer. */
  function dayOrder(key) {
    const d = S.days[key];
    const ids = d ? d.order.slice() : [];
    for (const e of dayEntries(key)) if (!ids.includes(e.exerciseId)) ids.push(e.exerciseId);
    return ids;
  }
  function guessMain(ids) {
    const c = new Map();
    for (const id of ids) { const ex = S.byId.get(id); if (ex) c.set(ex.leaf, (c.get(ex.leaf) || 0) + 1); }
    const g = [...c.entries()].sort((a, b) => b[1] - a[1])[0];
    return g ? g[0] : '';
  }
  /* Prépare une journée à partir d'une séance type ou d'une ancienne séance. */
  function startDay(key, src) {
    const d = dayMeta(key, true);
    d.order = dayOrder(key);
    for (const it of src.items) {
      if (!d.order.includes(it.ex)) d.order.push(it.ex);
      const sets = (it.sets || []).filter((x) => x.w !== '' || x.r !== '');
      if (sets.length) d.plan[it.ex] = sets.map((x) => ({ w: x.w, r: x.r }));
    }
    const main = GROUPS.has(src.main) ? src.main : guessMain(src.items.map((it) => it.ex));
    if (main && !S.sessions[key]) S.sessions[key] = { name: (src.name || '').trim(), main, sec: (src.sec || []).filter((x) => GROUPS.has(x) && x !== main) };
  }
  const sessionTitle = (s) => s.name || GROUPS.get(s.main).label;

  /* ---------- calendrier ---------- */
  function viewCalendar(arg, ui) {
    const wrap = h('main', { class: 'page sessions' });
    wrap.append(h('header', { class: 'bar' }, closeBtn(), h('h1', { class: 'grow', text: 'Calendrier' }), h('span')));
    let sel = /^\d{4}-\d{2}-\d{2}$/.test(ui.sel || '') ? ui.sel : (arg && arg.day) || todayKey();
    if (!S.cal || (arg && arg.day && !ui.sel)) { const d = keyDate(sel); S.cal = { y: d.getFullYear(), m: d.getMonth() }; }
    S.getUI = () => ({ sel });
    const box = h('div');
    const detail = h('div', { class: 'day-wrap' });
    wrap.append(box, detail);
    const select = (k) => { sel = k; const d = keyDate(k); S.cal = { y: d.getFullYear(), m: d.getMonth() }; render(); };

    function render() {
      box.textContent = '';
      const { y, m } = S.cal;
      const now = new Date();
      const isCurrent = y === now.getFullYear() && m === now.getMonth();
      const byDay = daysIndex();
      box.append(h('div', { class: 'monthbar' },
        h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Mois précédent', onclick: () => { S.cal = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }; render(); } }, icon('left')),
        h('h2', { text: fMonth.format(new Date(y, m, 1)) }),
        h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Mois suivant', disabled: isCurrent, onclick: () => { S.cal = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }; render(); } }, icon('right'))));
      const grid = h('div', { class: 'cal' });
      ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach((d) => grid.append(h('div', { class: 'wd', 'aria-hidden': 'true', text: d })));
      const lead = (new Date(y, m, 1).getDay() + 6) % 7;
      for (let i = 0; i < lead; i++) grid.append(h('div'));
      const nDays = new Date(y, m + 1, 0).getDate();
      let sessions = 0;
      for (let d = 1; d <= nDays; d++) {
        const k = y + '-' + pad2(m + 1) + '-' + pad2(d);
        const has = byDay.has(k);
        const planned = !has && S.days[k] && S.days[k].order.length > 0;
        if (has) sessions++;
        const named = has && S.sessions[k];
        const isToday = isCurrent && d === now.getDate();
        grid.append(h('button', {
          type: 'button', class: 'day' + (has ? ' has' : '') + (planned ? ' planned' : '') + (named ? ' named' : '') + (isToday ? ' today' : '') + (k === sel ? ' sel' : ''), text: String(d),
          style: named ? { '--c': GROUPS.get(named.main).color } : null, 'aria-pressed': String(k === sel),
          'aria-label': d + ' ' + fMonth.format(new Date(y, m, 1)) + (has ? ', séance' : planned ? ', séance prévue' : '') + (named ? ' : ' + sessionTitle(named) : ''),
          onclick: () => select(k),
        }));
      }
      box.append(grid);
      box.append(h('p', { class: 'cal-note', text: (sessions ? plural(sessions, 'jour', 'jours') + ' d’entraînement ce mois-ci. ' : 'Aucune séance ce mois-ci. ') + 'Touche un jour pour voir son détail en dessous.' }));
      detail.textContent = '';
      const sd = keyDate(sel);
      if (sd.getFullYear() === y && sd.getMonth() === m) detail.append(dayDetail(sel, render, select));
    }
    render();
    return wrap;
  }

  /* ---------- une journée d'entraînement ---------- */
  /* Ancien lien direct vers une journée : on ouvre le calendrier sur ce jour. */
  function viewSession(key, ui) { return viewCalendar({ day: key }, ui || {}); }
  function dayDetail(key, refresh, select) {
    const body = h('section', { class: 'daydetail', 'aria-label': 'Détail du ' + dayLabel(keyDate(key)) });
    const isToday = key === todayKey();
    const render = refresh;

    function build() {
      body.textContent = '';
      body.append(h('h2', { class: 'dd-title', text: dayLabel(keyDate(key)) + (isToday ? ' · aujourd’hui' : '') }));
      const entries = dayEntries(key);
      const order = dayOrder(key);
      const meta = S.days[key];
      if (entries.length || order.length) {
        const nameBox = h('div', { class: 'sess-name' });
        const s = S.sessions[key];
        if (!s) nameBox.append(h('button', { type: 'button', class: 'btn ghost wide', onclick: () => sessionDialog(key, entries.length ? entries : order.map((id) => ({ exerciseId: id })), render) }, icon('tag'), 'Nommer la séance'));
        else {
          nameBox.append(h('div', { class: 'card named', style: { '--c': GROUPS.get(s.main).color } },
            h('div', { class: 'row' }, h('strong', { class: 'nm', text: sessionTitle(s) }),
              h('button', { type: 'button', class: 'textbtn', text: 'Modifier', onclick: () => sessionDialog(key, entries, render) })),
            h('div', { class: 'tags' }, tag(s.main, true), s.sec.map((id) => tag(id)))));
        }
        body.append(nameBox);
      }
      body.append(noteBox(() => (S.days[key] || {}).note, (v) => { const d = dayMeta(key, true); d.note = v; },
        'Note de séance : sensations, fatigue…', 'Note de la séance'));
      if (entries.length) {
        const st = dayStats(entries);
        body.append(h('p', { class: 'sum', text: plural(st.nEx, 'exercice', 'exercices') + ' · ' + plural(st.nSets, 'série', 'séries') + (st.load ? ' · ' + fmtNum(Math.round(st.load)) + ' kg au total' : '') }));
      }
      if (!order.length) {
        body.append(h('p', { class: 'empty-note pad', text: isToday ? 'Rien de prévu aujourd’hui. Ajoute des exercices ou lance une de tes séances types.' : 'Aucun exercice ce jour-là.' }));
      } else {
        const list = h('div', { class: 'dlist' });
        for (const id of order) {
          const sets = entries.filter((e) => e.exerciseId === id);
          const ex = getEx(id, sets[0] && sets[0].name);
          const planned = !sets.length && meta && meta.plan[id] ? meta.plan[id] : null;
          const status = sets.length ? plural(sets.length, 'série', 'séries') : planned ? 'À faire · ' + plural(planned.length, 'série prévue', 'séries prévues') : 'À faire';
          const head = h('div', { class: 'dhead' },
            h('span', { class: 'handle', role: 'button', 'aria-label': 'Déplacer ' + dn(ex), title: 'Maintenir et glisser pour déplacer' }, icon('grip')),
            h('button', { type: 'button', class: 'open', onclick: () => go('exercise', { id, day: key }) }, thumb(ex, { zoom: true }),
              h('div', { class: 'txt' }, h('div', { class: 'nm', text: dn(ex) }), h('div', { class: 'st' + (sets.length ? '' : ' todo'), text: status }))),
            h('span', { class: 'chev' }, icon('right')));
          list.append(h('div', { class: 'sitem', 'data-id': id },
            h('article', { class: 'dcard' + (sets.length ? '' : ' todo') },
              swipeable(head, () => removeFromDay(id), 'Retirer ' + dn(ex) + ' de la séance'),
              sets.map((e) => swipeable(h('button', { type: 'button', class: 'line-set', 'aria-label': 'Modifier la série ' + entryText(e), onclick: () => editEntry(e, render) },
                h('span', { class: 'tm', text: fTime.format(e.ts) }), h('b', { text: entryText(e) }), e.c === 1 ? null : h('span', { class: 'tot', text: fmtNum(e.w * e.r) })),
                () => deleteEntry(e, render), 'Supprimer la série')),
              planned ? h('div', { class: 'sets planned' }, planned.map((p) => h('span', { class: 'set', text: (p.w !== '' ? fmtNum(p.w) + ' kg' : '… kg') + ' × ' + (p.r !== '' ? fmtNum(p.r) : '…') }))) : null)));
        }
        sortable(list, (ids) => { const d = dayMeta(key, true); d.order = ids; saveUser(); });
        body.append(list, h('p', { class: 'hint', text: 'Maintiens la poignée pour changer l’ordre. Glisse une ligne vers la gauche pour la supprimer.' }));
      }
      body.append(h('button', { type: 'button', class: 'btn ghost wide addex', onclick: () => go('library', { pick: 'day', id: key }) }, icon('plus'), 'Ajouter un exercice'));
      const doneIds = new Set(entries.map((e) => e.exerciseId));
      if (order.some((id) => !doneIds.has(id))) {
        body.append(h('button', { type: 'button', class: 'textbtn danger center clearplan', onclick: () => clearPlanned(key, render) },
          entries.length ? 'Retirer les exercices prévus non faits' : 'Retirer la séance prévue'));
      }
      if (isToday && S.plans.length) body.append(h('button', { type: 'button', class: 'btn ghost wide', onclick: () => go('seances', { tab: 'plans' }) }, icon('folder'), 'Lancer une séance type'));
      if (entries.length) {
        body.append(h('section', { class: 'sec tight acts-day' },
          isToday ? null : h('button', { type: 'button', class: 'pill', onclick: () => redoDay(key, select) }, icon('copy'), 'Refaire cette séance aujourd’hui'),
          h('button', { type: 'button', class: 'pill', onclick: () => dayToPlan(key) }, icon('folder'), 'Enregistrer comme séance type'),
          h('button', { type: 'button', class: 'pill', onclick: () => exportActivity(key) }, icon('export'), 'Exporter l’activité (Strava…)')));
      }
    }
    function removeFromDay(id) {
      const removed = S.entries.filter((e) => e.exerciseId === id && dayKey(e.ts) === key);
      const old = S.days[key] ? JSON.parse(JSON.stringify(S.days[key])) : null;
      S.entries = S.entries.filter((e) => !(e.exerciseId === id && dayKey(e.ts) === key));
      const d = S.days[key];
      if (d) { d.order = d.order.filter((x) => x !== id); delete d.plan[id]; }
      saveUser(); render();
      toast(removed.length ? 'Exercice et ' + plural(removed.length, 'série supprimés', 'séries supprimés') : 'Exercice retiré', { ms: 6000,
        action: () => { S.entries.push(...removed); if (old) S.days[key] = old; saveUser(); render(); } });
    }
    build();
    return body;
  }
  /* Retire ce qui était prévu pour un jour (séance lancée avec « Aujourd'hui ») ;
     les séries déjà enregistrées restent. Annulable quelques secondes. */
  function clearPlanned(key, after) {
    const oldD = S.days[key] ? JSON.parse(JSON.stringify(S.days[key])) : null;
    const oldS = S.sessions[key] ? JSON.parse(JSON.stringify(S.sessions[key])) : null;
    const done = new Set(dayEntries(key).map((e) => e.exerciseId));
    const d = S.days[key];
    if (d) {
      d.order = d.order.filter((id) => done.has(id));
      for (const id of Object.keys(d.plan)) if (!done.has(id)) delete d.plan[id];
      if (!d.order.length && !d.note) delete S.days[key];
    }
    if (!done.size) delete S.sessions[key];
    saveUser(); after();
    toast(done.size ? 'Exercices prévus retirés' : 'Séance prévue retirée', { ms: 6000, action: () => {
      if (oldD) S.days[key] = oldD; else delete S.days[key];
      if (oldS) S.sessions[key] = oldS; else delete S.sessions[key];
      saveUser(); after();
    } });
  }
  function redoDay(key, select) {
    const tk = todayKey();
    const entries = dayEntries(key);
    const s = S.sessions[key];
    startDay(tk, { name: s ? s.name : '', main: s ? s.main : '', sec: s ? s.sec : [],
      items: dayOrder(key).map((id) => ({ ex: id, sets: entries.filter((e) => e.exerciseId === id && e.c !== 1).map((e) => ({ w: e.w, r: e.r })) })) });
    saveUser();
    if (select) select(tk); else go('calendar', { day: tk });
    toast('Séance recopiée pour aujourd’hui : ajuste les charges si besoin.');
  }
  function dayToPlan(key) {
    const entries = dayEntries(key);
    const s = S.sessions[key];
    const p = { id: uid(), name: s ? sessionTitle(s) : 'Séance du ' + fDayShort.format(keyDate(key)), folder: '', main: s ? s.main : '', sec: s ? s.sec.slice() : [],
      items: dayOrder(key).map((id) => ({ ex: id, sets: entries.filter((e) => e.exerciseId === id && e.c !== 1).map((e) => ({ w: e.w, r: e.r })) })), created: Date.now(), last: key };
    S.planDraft = { p, isNew: true, base: planSig(emptyPlan()) };
    go('plan', p.id);
    toast('Vérifie la séance puis touche « Valider »');
  }
  /* Fichier d'activité .tcx (format accepté par Strava, Garmin…) pour une journée faite. */
  function exportActivity(key) {
    const ents = dayEntries(key);
    if (!ents.length) return;
    const start = Math.min(...ents.map((e) => e.ts));
    const end = Math.max(...ents.map((e) => e.ts + (e.c === 1 ? e.dur * 1000 : 0))) + 120000;
    const secs = Math.max(60, Math.round((end - start) / 1000));
    const dist = Math.round(ents.reduce((n, e) => n + (e.c === 1 && e.dist > 0 ? e.dist * 1000 : 0), 0));
    const kcal = Math.round(ents.reduce((n, e) => n + (e.c === 1 && e.kcal > 0 ? e.kcal : 0), 0));
    const s = S.sessions[key];
    const lines = [s ? sessionTitle(s) : 'Séance WorkLog'];
    for (const id of dayOrder(key)) {
      const sets = ents.filter((e) => e.exerciseId === id);
      if (sets.length) lines.push(getEx(id, sets[0].name).name + ' : ' + sets.map(entryText).join(', '));
    }
    if (S.days[key] && S.days[key].note) lines.push('', S.days[key].note);
    const iso = (t) => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">\n'
      + ' <Activities>\n  <Activity Sport="Other">\n   <Id>' + iso(start) + '</Id>\n'
      + '   <Lap StartTime="' + iso(start) + '">\n'
      + '    <TotalTimeSeconds>' + secs + '</TotalTimeSeconds>\n    <DistanceMeters>' + dist + '</DistanceMeters>\n'
      + '    <Calories>' + kcal + '</Calories>\n    <Intensity>Active</Intensity>\n    <TriggerMethod>Manual</TriggerMethod>\n'
      + '    <Track>\n     <Trackpoint><Time>' + iso(start) + '</Time><DistanceMeters>0</DistanceMeters></Trackpoint>\n'
      + '     <Trackpoint><Time>' + iso(start + secs * 1000) + '</Time><DistanceMeters>' + dist + '</DistanceMeters></Trackpoint>\n    </Track>\n'
      + '   </Lap>\n   <Notes>' + esc(lines.join('\n')) + '</Notes>\n  </Activity>\n </Activities>\n</TrainingCenterDatabase>\n';
    shareFile('worklog-' + key + '.tcx', xml, 'application/vnd.garmin.tcx+xml').then((ok) => {
      if (ok) toast('Fichier prêt : importe-le sur strava.com (Téléverser une activité > Fichier).', { ms: 6000 });
    });
  }

  /* Fenêtre « Nommer la séance » : nom libre, groupe principal, groupes secondaires. */
  function sessionDialog(key, entries, onDone) {
    const cur = S.sessions[key];
    // Proposition : le groupe le plus travaillé ce jour-là.
    const counts = new Map();
    for (const e of entries) { const ex = S.byId.get(e.exerciseId); if (ex) counts.set(ex.leaf, (counts.get(ex.leaf) || 0) + 1); }
    const guess = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    let main = cur ? cur.main : (guess ? guess[0] : '');
    const sec = new Set(cur ? cur.sec : []);

    const nameIn = h('input', { class: 'field left', type: 'text', id: 'sess-nm', maxlength: '60', placeholder: 'Ex. Push, Haut du corps, Jambes lourdes', autocomplete: 'off', enterkeyhint: 'done' });
    nameIn.value = cur ? cur.name : '';
    const sel = h('select', { class: 'field left', id: 'sess-main' },
      h('option', { value: '', text: 'Choisir un groupe' }),
      GROUP_LIST.map((g) => h('option', { value: g.id, text: g.full })));
    sel.value = main;
    const msg = h('p', { class: 'form-msg', role: 'alert' });
    const chipBox = groupsField(() => [...sec], (v) => { sec.clear(); v.forEach((x) => sec.add(x)); }, () => main, 'sess-sec');
    sel.addEventListener('change', () => { main = sel.value; msg.textContent = ''; sec.delete(main); chipBox.repaint(); });

    let close = null;
    async function save() {
      if (!GROUPS.has(main)) { msg.textContent = 'Choisis le groupe musculaire principal.'; sel.focus(); return; }
      S.sessions[key] = { name: nameIn.value.trim().slice(0, 60), main, sec: [...sec] };
      await saveUser();
      close(); onDone(); toast('Séance enregistrée');
    }
    async function clear() {
      delete S.sessions[key];
      await saveUser();
      close(); onDone(); toast('Nom de la séance retiré');
    }
    const box = h('div', { class: 'dialog sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' },
      h('h2', { id: 'dlg-t', text: cur ? 'Modifier la séance' : 'Nommer la séance' }),
      h('label', { class: 'lbl', for: 'sess-nm', text: 'Nom de la séance' }), nameIn,
      h('label', { class: 'lbl', for: 'sess-main', text: 'Groupe musculaire principal' }), sel,
      h('label', { class: 'lbl', for: 'sess-sec', text: 'Groupes secondaires' }), chipBox,
      msg,
      h('div', { class: 'acts' },
        h('button', { type: 'button', class: 'btn ghost', text: 'Annuler', onclick: () => close() }),
        h('button', { type: 'button', class: 'btn primary', text: 'Enregistrer', onclick: save })),
      cur ? h('button', { type: 'button', class: 'textbtn danger center', text: 'Retirer le nom de cette séance', onclick: clear }) : null);
    close = openModal(box);
  }

  /* ---------- page Séances : séances types (en dossiers) et séances réalisées ---------- */
  const emptyPlan = () => ({ id: uid(), name: '', folder: '', main: '', sec: [], items: [], created: Date.now(), last: null });
  const clonePlan = (p) => JSON.parse(JSON.stringify(p));
  const planSig = (p) => JSON.stringify([p.name.trim(), p.folder, p.main, [...p.sec].sort(), p.items.map((it) => [it.ex, it.sets.map((x) => [numOrBlank(x.w), numOrBlank(x.r)])])]);
  const planMissing = (p) => [!p.name.trim() ? 'un nom' : null, !p.items.length ? 'au moins un exercice' : null].filter(Boolean);
  const allFolders = () => [...new Set(S.folders.concat(S.plans.map((x) => x.folder)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  /* « Créer une séance » : un brouillon, enregistré seulement avec « Valider ». */
  function createPlan(folder) {
    const p = emptyPlan();
    S.planDraft = { p, isNew: true, base: planSig(p) };
    if (typeof folder === 'string') p.folder = folder;
    go('plan', p.id);
  }
  function commitPlan(d) {
    const p = d.p;
    p.name = p.name.trim();
    p.items.forEach((it) => { it.sets = it.sets.map((x) => ({ w: numOrBlank(x.w), r: numOrBlank(x.r) })).filter((x) => x.w !== '' || x.r !== ''); });
    if (p.folder && !S.folders.includes(p.folder)) S.folders.push(p.folder);
    const copy = clonePlan(p);
    const i = S.plans.findIndex((x) => x.id === p.id);
    if (i >= 0) S.plans[i] = copy; else S.plans.push(copy);
    d.isNew = false; d.base = planSig(p);
    saveUser();
  }
  const planTitle = (p) => p.name.trim() || 'Séance sans nom';
  function startPlanToday(p) {
    if (!p.items.length) { toast('Ajoute au moins un exercice à cette séance.'); return; }
    const tk = todayKey();
    startDay(tk, p);
    p.last = tk;
    saveUser();
    go('calendar', { day: tk });
    toast('« ' + planTitle(p) + ' » ajoutée à aujourd’hui');
  }
  async function newFolder(after) {
    const n = await promptDialog('Nouveau dossier', 'Nom du dossier', '');
    if (!n) return null;
    if (allFolders().some((f) => f.toLowerCase() === n.toLowerCase())) { toast('Ce dossier existe déjà.'); return allFolders().find((f) => f.toLowerCase() === n.toLowerCase()); }
    S.folders.push(n);
    await saveUser();
    if (after) after(n);
    return n;
  }
  function viewSeances(arg, ui) {
    let tab = ui.tab || (arg && arg.tab) || (S.plans.length ? 'plans' : 'done');
    let filter = GROUPS.has(ui.filter) ? ui.filter : 'all';
    let pfilter = GROUPS.has(ui.pfilter) ? ui.pfilter : 'all';
    const closedF = new Set(Array.isArray(ui.closed) ? ui.closed : []);
    S.getUI = () => ({ tab, filter, pfilter, closed: [...closedF] });
    const wrap = h('main', { class: 'page seances' });
    wrap.append(h('header', { class: 'bar' }, closeBtn(), h('h1', { class: 'grow', text: 'Séances' }), h('span')));
    const tabBar = h('div', { class: 'tabs two', role: 'tablist' });
    const body = h('div');
    wrap.append(tabBar, body);
    const chipsFor = (tops, cur, count, set) => h('div', { class: 'chips scroll', role: 'group', 'aria-label': 'Filtrer par groupe musculaire' },
      [['all', 'Toutes']].concat(tops.map((t) => [t.id, t.label])).map(([id, label]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(cur === id),
        onclick: () => { set(id); render(); window.scrollTo(0, 0); } }, label, h('span', { class: 'n', text: String(count(id)) }))));

    function renderTabs() {
      tabBar.textContent = '';
      [['plans', 'Mes séances'], ['done', 'Réalisées']].forEach(([id, label]) => tabBar.append(h('button', { type: 'button', role: 'tab', class: 'tab',
        'aria-selected': String(tab === id), text: label, onclick: () => { if (tab !== id) { tab = id; render(); window.scrollTo(0, 0); } } })));
    }

    function movePlan(id, folder) {
      const p = S.plans.find((x) => x.id === id);
      if (!p || p.folder === folder) return;
      p.folder = folder;
      if (folder && !S.folders.includes(folder)) S.folders.push(folder);
      if (folder) closedF.delete(folder); else closedF.delete('__none');
      saveUser(); render();
      toast('« ' + planTitle(p) + ' » déplacée dans ' + (folder ? '« ' + folder + ' »' : '« Sans dossier »'));
    }
    function moveMenu(p) {
      const items = allFolders().filter((f) => f !== p.folder).map((f) => ({ label: f, icon: 'folder', run: () => movePlan(p.id, f) }));
      if (p.folder) items.push({ label: 'Sans dossier', run: () => movePlan(p.id, '') });
      items.push({ label: 'Nouveau dossier…', icon: 'folderplus', run: () => newFolder((n) => movePlan(p.id, n)) });
      actionSheet('Déplacer « ' + planTitle(p) + ' » vers', items);
    }
    function planMenu(p) {
      actionSheet(planTitle(p), [
        { label: 'Déplacer vers…', icon: 'folder', run: () => moveMenu(p) },
        { label: 'Renommer', icon: 'tag', run: async () => {
          const n = await promptDialog('Renommer la séance', 'Nom de la séance', p.name, 60);
          if (n) { p.name = n; await saveUser(); render(); toast('Séance renommée'); }
        } },
        { label: 'Dupliquer', icon: 'copy', run: () => {
          const c = clonePlan(p); c.id = uid(); c.name = (p.name + ' (copie)').slice(0, 60); c.created = Date.now(); c.last = null;
          S.plans.push(c); saveUser(); render(); toast('Séance dupliquée');
        } },
        { label: 'Supprimer', icon: 'trash', danger: true, run: async () => {
          const ok = await confirmDialog({ title: 'Supprimer « ' + planTitle(p) + ' » ?', text: 'Tes séances déjà faites restent dans le calendrier.', yes: 'Supprimer', no: 'Annuler' });
          if (!ok) return;
          S.plans = S.plans.filter((x) => x !== p); await saveUser(); render(); toast('Séance supprimée');
        } },
      ]);
    }
    function folderMenu(f) {
      actionSheet('Dossier « ' + f + ' »', [
        { label: 'Renommer le dossier', icon: 'tag', run: async () => {
          const n = await promptDialog('Renommer le dossier', 'Nom du dossier', f);
          if (!n || n === f) return;
          if (allFolders().some((x) => x !== f && x.toLowerCase() === n.toLowerCase())) { toast('Ce dossier existe déjà.'); return; }
          S.folders = S.folders.map((x) => (x === f ? n : x));
          if (!S.folders.includes(n)) S.folders.push(n);
          S.plans.forEach((x) => { if (x.folder === f) x.folder = n; });
          await saveUser(); render(); toast('Dossier renommé');
        } },
        { label: 'Supprimer le dossier', icon: 'trash', danger: true, run: async () => {
          const n = S.plans.filter((x) => x.folder === f).length;
          const ok = await confirmDialog({ title: 'Supprimer le dossier « ' + f + ' » ?', text: n ? plural(n, 'séance passe', 'séances passent') + ' dans « Sans dossier ». Aucune séance n’est supprimée.' : 'Le dossier est vide.', yes: 'Supprimer', no: 'Annuler' });
          if (!ok) return;
          S.folders = S.folders.filter((x) => x !== f);
          S.plans.forEach((x) => { if (x.folder === f) x.folder = ''; });
          await saveUser(); render(); toast('Dossier supprimé');
        } },
      ]);
    }

    function renderPlans() {
      body.append(h('div', { class: 'plan-btns' },
        h('button', { type: 'button', class: 'btn primary wide', onclick: () => createPlan() }, icon('plus'), ' Créer une séance'),
        h('button', { type: 'button', class: 'newfolder', onclick: () => newFolder(() => render()) }, icon('folderplus'), h('span', { text: 'Nouveau dossier' }))));
      if (!S.plans.length && !allFolders().length) {
        body.append(h('div', { class: 'card empty-card' }, h('strong', { text: 'Aucune séance type' }),
          h('p', { text: 'Crée une séance (Push, Jambes…), ajoute ses exercices et, si tu veux, les séries et charges prévues. Range-la dans un dossier, puis lance-la le jour où tu la fais.' })));
        return;
      }
      const works = (p, top) => topOf(p.main) === top || p.sec.some((id) => topOf(id) === top);
      const tops = TREE.filter((t) => S.plans.some((p) => works(p, t.id)));
      if (pfilter !== 'all' && !tops.some((t) => t.id === pfilter)) pfilter = 'all';
      if (tops.length) body.append(chipsFor(tops, pfilter, (id) => (id === 'all' ? S.plans.length : S.plans.filter((p) => works(p, id)).length), (v) => { pfilter = v; }));
      const list = pfilter === 'all' ? S.plans : S.plans.filter((p) => works(p, pfilter));
      const sorted = (ps) => ps.sort((a, b) => planTitle(a).localeCompare(planTitle(b), 'fr'));
      const box = h('div', { class: 'folders' });
      const section = (key, cls, summary, ps, emptyText) => {
        const d = h('details', { class: cls, 'data-folder': key === '__none' ? '' : key }, summary);
        d.open = !closedF.has(key);
        d.addEventListener('toggle', () => { if (d.open) closedF.delete(key); else closedF.add(key); });
        d.append(ps.length ? h('div', { class: 'pcards' }, ps.map(planCard)) : h('p', { class: 'empty-note pad', text: emptyText }));
        return d;
      };
      for (const f of allFolders()) {
        const ps = sorted(list.filter((p) => p.folder === f));
        if (!ps.length && pfilter !== 'all') continue;
        box.append(section(f, 'group folder', h('summary', {},
          h('span', { class: 'fsum' }, icon('folder'), h('span', { class: 'fname', text: f }), h('span', { class: 'count', text: String(ps.length) })),
          h('button', { type: 'button', class: 'fmore', 'aria-label': 'Options du dossier ' + f, onclick: (e) => { e.preventDefault(); e.stopPropagation(); folderMenu(f); } }, icon('dots', 'fill')),
          icon('down')), ps, 'Dossier vide : glisse une séance ici avec sa poignée, ou utilise « … » puis « Déplacer vers ».'));
      }
      const loose = sorted(list.filter((p) => !p.folder));
      if (loose.length || S.plans.length) {
        box.append(section('__none', 'loose', h('summary', {}, h('span', { class: 'lsum' }, 'Sans dossier', h('span', { class: 'count', text: String(loose.length) })), icon('down')),
          loose, 'Aucune séance hors dossier.'));
      }
      body.append(box);
      planDrag(box, movePlan);
    }
    function planCard(p) {
      const g = GROUPS.get(p.main);
      const nSets = p.items.reduce((n, it) => n + it.sets.length, 0);
      return h('div', { class: 'pcard', 'data-id': p.id, style: g ? { '--c': g.color } : null },
        h('span', { class: 'handle phandle', role: 'button', 'aria-label': 'Glisser « ' + planTitle(p) + ' » vers un autre dossier' }, icon('grip')),
        h('button', { type: 'button', class: 'pmain', onclick: () => go('plan', p.id) },
          h('div', { class: 'nm', text: planTitle(p) }),
          g ? h('div', { class: 'tags' }, tag(p.main, true), p.sec.map((id) => tag(id))) : null,
          h('div', { class: 'meta', text: plural(p.items.length, 'exercice', 'exercices') + (nSets ? ' · ' + plural(nSets, 'série prévue', 'séries prévues') : '') + (p.last ? ' · faite ' + ago(p.last) : '') })),
        h('button', { type: 'button', class: 'pgo', 'aria-label': 'Faire « ' + planTitle(p) + ' » aujourd’hui', onclick: () => startPlanToday(p) }, icon('play'), h('span', { text: 'Aujourd’hui' })),
        h('button', { type: 'button', class: 'pmore', 'aria-label': 'Options de « ' + planTitle(p) + ' »', onclick: () => planMenu(p) }, icon('dots', 'fill')));
    }
    /* Glisser une séance (poignée) et la lâcher sur un autre dossier. */
    function planDrag(box, onDrop) {
      box.querySelectorAll('.phandle').forEach((hd) => {
        const card = hd.closest('.pcard');
        let ghost = null; let target = null; let ox = 0; let oy = 0;
        const place = (x, y) => { ghost.style.transform = 'translate(' + (x - ox) + 'px,' + (y - oy) + 'px)'; };
        dragTrack(hd, {
          start: (x, y) => {
            const r = card.getBoundingClientRect(); ox = x - r.left; oy = y - r.top;
            ghost = card.cloneNode(true); ghost.classList.add('pghost'); ghost.style.width = r.width + 'px';
            document.body.append(ghost); card.classList.add('lifted'); place(x, y);
          },
          move: (x, y) => {
            place(x, y);
            const el = document.elementFromPoint(x, y);
            const f = el && el.closest('[data-folder]');
            if (f !== target) { if (target) target.classList.remove('droptarget'); target = f; if (f) f.classList.add('droptarget'); }
          },
          end: () => {
            if (ghost) ghost.remove();
            card.classList.remove('lifted');
            if (target) { target.classList.remove('droptarget'); onDrop(card.dataset.id, target.dataset.folder || ''); }
            target = null;
          },
        });
      });
    }

    function renderDone() {
      const byDay = daysIndex();
      const all = Object.keys(S.sessions).filter((k) => byDay.has(k)).sort().reverse()
        .map((k) => ({ key: k, s: S.sessions[k], st: dayStats(byDay.get(k)) }));
      if (!all.length) {
        body.append(h('div', { class: 'card empty-card' },
          h('strong', { text: 'Aucune séance nommée' }),
          h('p', { text: 'Ouvre un jour d’entraînement dans le calendrier, puis touche « Nommer la séance ». Elle apparaîtra ici, classée par groupe musculaire.' }),
          h('button', { type: 'button', class: 'btn primary', text: 'Ouvrir le calendrier', onclick: () => go('calendar') })));
        return;
      }
      const works = (x, top) => topOf(x.s.main) === top || x.s.sec.some((id) => topOf(id) === top);
      const tops = TREE.filter((t) => all.some((x) => works(x, t.id)));
      if (filter !== 'all' && !tops.some((t) => t.id === filter)) filter = 'all';
      body.append(chipsFor(tops, filter, (id) => (id === 'all' ? all.length : all.filter((x) => works(x, id)).length), (v) => { filter = v; }));
      const list = filter === 'all' ? all : all.filter((x) => works(x, filter));
      if (filter === 'all') {
        body.append(h('section', { class: 'sec tight' }, h('h2', { text: 'Dernière fois par groupe' }),
          h('div', { class: 'card lastlist' }, tops.map((t) => {
            const last = all.find((x) => works(x, t.id));
            return h('button', { type: 'button', class: 'lastrow', onclick: () => { filter = t.id; render(); window.scrollTo(0, 0); } },
              h('span', { class: 'dot', style: { '--c': t.color } }), h('span', { class: 'g', text: t.label }),
              h('span', { class: 'w', text: ago(last.key) + ' · ' + fDayShort.format(keyDate(last.key)) }));
          }))));
      } else {
        body.append(h('p', { class: 'sum pad', text: plural(list.length, 'séance', 'séances') + ' · dernière ' + ago(list[0].key) }));
      }
      body.append(h('section', { class: 'sec tight' }, filter === 'all' ? h('h2', { text: 'Toutes les séances' }) : null, h('div', { class: 'scards' }, list.map(card))));
    }
    function card(x) {
      const g = GROUPS.get(x.s.main);
      return h('button', { type: 'button', class: 'scard', style: { '--c': g.color }, onclick: () => go('calendar', { day: x.key }) },
        h('div', { class: 'top' }, h('span', { class: 'date', text: dayLabel(keyDate(x.key)) }), h('span', { class: 'ago', text: ago(x.key) })),
        h('div', { class: 'nm', text: sessionTitle(x.s) }),
        h('div', { class: 'tags' }, tag(x.s.main, true), x.s.sec.map((id) => tag(id))),
        h('div', { class: 'figs' },
          h('div', {}, h('b', { text: String(x.st.nEx) }), h('span', { text: x.st.nEx > 1 ? 'exercices' : 'exercice' })),
          h('div', {}, h('b', { text: String(x.st.nSets) }), h('span', { text: x.st.nSets > 1 ? 'séries' : 'série' })),
          h('div', {}, h('b', { text: fmtNum(Math.round(x.st.load)) }), h('span', { text: 'kg soulevés' }))));
    }
    function render() {
      renderTabs();
      body.textContent = '';
      if (tab === 'plans') renderPlans(); else renderDone();
    }
    render();
    return wrap;
  }

  /* ---------- une séance type ----------
     On travaille sur un brouillon : rien n'est enregistré avant « Valider ». */
  function viewPlan(id, ui) {
    let d = S.planDraft && S.planDraft.p.id === id ? S.planDraft : null;
    if (!d) { const orig = S.plans.find((x) => x.id === id); if (orig) d = S.planDraft = { p: clonePlan(orig), isNew: false, base: planSig(orig) }; }
    const wrap = h('main', { class: 'page plan' });
    const valBtn = h('button', { type: 'button', class: 'btn primary okbtn valbtn' }, icon('check'), ' Valider');
    wrap.append(h('header', { class: 'bar' }, backBtn(), h('h1', { class: 'grow', text: d && d.isNew ? 'Nouvelle séance' : 'Séance type' }), d ? valBtn : null, closeBtn()));
    if (!d) { wrap.append(h('p', { class: 'empty-note', text: 'Cette séance type n’existe plus.' })); return wrap; }
    const p = d.p;
    const open = new Set(Array.isArray(ui.open) ? ui.open : []);
    S.getUI = () => ({ open: [...open] });
    const dirty = () => planSig(p) !== d.base;
    const changed = () => { valBtn.hidden = !(d.isNew || dirty()); };
    changed();

    async function validate() {
      const miss = planMissing(p);
      if (miss.length) { await missingDialog(miss, false); return false; }
      const isNew = d.isNew;
      commitPlan(d);
      toast(isNew ? 'Séance « ' + planTitle(p) + ' » créée' : 'Modifications enregistrées');
      return true;
    }
    valBtn.addEventListener('click', async () => {
      if (!(await validate())) return;
      S.guard = null; S.planDraft = null;
      if (prevView() === 'seances') backNow(); else replaceNow('seances', { tab: 'plans' }, 'back');
    });
    S.guard = {
      dirty, save: async () => { commitPlan(d); toast('Séance enregistrée'); S.planDraft = null; return true; },
      missing: () => planMissing(p), discard: () => { S.planDraft = null; },
      title: d.isNew ? 'Enregistrer la séance ?' : 'Enregistrer les changements ?',
      text: d.isNew ? 'Cette séance n’est pas encore créée.' : 'Tu as modifié cette séance sans valider.',
      no: d.isNew ? 'Ne pas enregistrer' : 'Ne pas enregistrer les changements',
    };

    const nameIn = h('input', { class: 'field left big', type: 'text', maxlength: '60', placeholder: 'Nom de la séance (ex. Push A)', 'aria-label': 'Nom de la séance', autocomplete: 'off', enterkeyhint: 'done' });
    nameIn.value = p.name;
    nameIn.addEventListener('input', () => { p.name = nameIn.value; changed(); });

    const folderSel = h('select', { class: 'field left', id: 'pl-folder' });
    function fillFolders() {
      folderSel.textContent = '';
      folderSel.append(h('option', { value: '', text: 'Sans dossier' }), ...allFolders().concat(p.folder && !allFolders().includes(p.folder) ? [p.folder] : []).map((f) => h('option', { value: f, text: f })), h('option', { value: '__new', text: '+ Nouveau dossier…' }));
      folderSel.value = p.folder;
    }
    fillFolders();
    folderSel.addEventListener('change', async () => {
      if (folderSel.value === '__new') {
        const n = await newFolder();
        if (n) p.folder = n;
        fillFolders(); changed();
      } else { p.folder = folderSel.value; changed(); }
    });

    const mainSel = h('select', { class: 'field left', id: 'pl-main' }, h('option', { value: '', text: 'Aucun' }), GROUP_LIST.map((g) => h('option', { value: g.id, text: g.full })));
    mainSel.value = p.main;
    const secField = groupsField(() => p.sec, (v) => { p.sec = v; changed(); }, () => p.main, 'pl-sec');
    mainSel.addEventListener('change', () => { p.main = mainSel.value; p.sec = p.sec.filter((x) => x !== p.main); secField.repaint(); changed(); });

    wrap.append(nameIn, h('div', { class: 'card pform' },
      h('label', { class: 'lbl', for: 'pl-folder', text: 'Dossier' }), folderSel,
      h('label', { class: 'lbl', for: 'pl-main', text: 'Groupe musculaire principal' }), mainSel,
      h('label', { class: 'lbl', for: 'pl-sec', text: 'Groupes secondaires' }), secField));

    const listBox = h('div');
    wrap.append(h('section', { class: 'sec' }, h('h2', { text: 'Exercices' }), listBox,
      h('button', { type: 'button', class: 'btn ghost wide addex', onclick: () => goNow('library', { pick: 'plan', id: p.id }) }, icon('plus'), 'Ajouter des exercices')));

    function setRows(it) {
      const box = h('div', { class: 'psets' });
      if (!it.sets.length) {
        box.append(h('p', { class: 'empty-note', text: 'Pas de séries prévues : tu les choisiras le jour même.' }),
          h('button', { type: 'button', class: 'textbtn', onclick: () => { it.sets.push({ w: '', r: '' }); changed(); renderList(); } }, 'Prévoir des séries'));
        return box;
      }
      it.sets.forEach((st, j) => {
        const wIn = calcInput({ placeholder: 'kg', 'aria-label': 'Poids prévu, série ' + (j + 1) });
        const rIn = h('input', { class: 'field', type: 'text', inputmode: 'numeric', placeholder: 'rép.', 'aria-label': 'Répétitions prévues, série ' + (j + 1), autocomplete: 'off' });
        wIn.value = fin(st.w) ? fmtIn(st.w) : st.w || '';
        rIn.value = fin(st.r) ? String(st.r) : st.r || '';
        wIn.addEventListener('input', () => { st.w = wIn.value; changed(); });
        wIn.addEventListener('change', () => { st.w = numOrBlank(wIn.value); changed(); });
        rIn.addEventListener('input', () => { const n = parseNum(rIn.value); st.r = Number.isFinite(n) && n > 0 ? Math.round(n) : ''; changed(); });
        box.append(h('div', { class: 'srow' }, h('span', { class: 'n', text: String(j + 1) }), wIn, h('span', { class: 'times', text: '×' }), rIn,
          h('button', { type: 'button', class: 'iconbtn plain mini', 'aria-label': 'Dupliquer la série ' + (j + 1), onclick: () => { it.sets.splice(j + 1, 0, { w: numOrBlank(st.w), r: st.r }); changed(); renderList(); } }, icon('copy')),
          h('button', { type: 'button', class: 'iconbtn plain mini', 'aria-label': 'Retirer la série ' + (j + 1), onclick: () => { it.sets.splice(j, 1); changed(); renderList(); } }, icon('close'))));
      });
      box.append(h('button', { type: 'button', class: 'textbtn', onclick: () => { const l = it.sets[it.sets.length - 1]; it.sets.push(l ? { w: numOrBlank(l.w), r: l.r } : { w: '', r: '' }); changed(); renderList(); } }, '+ Ajouter une série'));
      return box;
    }
    function renderList() {
      listBox.textContent = '';
      if (!p.items.length) { listBox.append(h('p', { class: 'empty-note pad', text: 'Aucun exercice pour l’instant.' })); return; }
      const list = h('div', { class: 'dlist' });
      p.items.forEach((it) => {
        const ex = getEx(it.ex);
        const n = it.sets.length;
        const isOpen = open.has(it.ex);
        const head = h('div', { class: 'dhead' },
          h('span', { class: 'handle', role: 'button', 'aria-label': 'Déplacer ' + dn(ex) }, icon('grip')),
          h('button', { type: 'button', class: 'open', 'aria-expanded': String(isOpen), onclick: () => { if (open.has(it.ex)) open.delete(it.ex); else open.add(it.ex); renderList(); } }, thumb(ex, { zoom: true }),
            h('div', { class: 'txt' }, h('div', { class: 'nm', text: dn(ex) }), h('div', { class: 'st', text: n ? plural(n, 'série prévue', 'séries prévues') : 'Séries libres' }))),
          h('span', { class: 'chev' + (isOpen ? ' up' : '') }, icon('down')));
        list.append(h('div', { class: 'sitem', 'data-id': it.ex },
          h('article', { class: 'dcard' }, swipeable(head, () => {
            const i = p.items.indexOf(it);
            p.items.splice(i, 1); changed(); renderList();
            toast('Exercice retiré', { ms: 6000, action: () => { p.items.splice(i, 0, it); changed(); renderList(); } });
          }, 'Retirer ' + dn(ex)), isOpen ? setRows(it) : null)));
      });
      sortable(list, (ids) => { p.items = ids.map((x) => p.items.find((it) => it.ex === x)).filter(Boolean); changed(); });
      listBox.append(list, h('p', { class: 'hint', text: 'Touche un exercice pour prévoir ses séries. Poignée ═ : changer l’ordre. Glisser à gauche : retirer.' }));
    }
    renderList();

    if (!d.isNew) {
      wrap.append(h('section', { class: 'sec plan-acts' },
        h('button', { type: 'button', class: 'btn ghost wide', onclick: async () => {
          if (dirty() && !(await validate())) return;
          S.guard = null; S.planDraft = null;
          const saved = S.plans.find((x) => x.id === p.id);
          if (saved) startPlanToday(saved);
        } }, icon('play'), ' Faire cette séance aujourd’hui'),
        h('button', { type: 'button', class: 'textbtn danger center', text: 'Supprimer cette séance type', onclick: async () => {
          const ok = await confirmDialog({ title: 'Supprimer « ' + planTitle(p) + ' » ?', text: 'Tes séances déjà faites restent dans le calendrier.', yes: 'Supprimer', no: 'Annuler' });
          if (!ok) return;
          S.plans = S.plans.filter((x) => x.id !== p.id); await saveUser();
          S.guard = null; S.planDraft = null; backNow(); toast('Séance type supprimée');
        } })));
    }
    return wrap;
  }

  /* ---------- démarrage ---------- */
  async function boot() {
    try { history.scrollRestoration = 'manual'; } catch (e) { /* ignoré */ }
    await Promise.all([loadUser(), loadExercises()]);
    await migrateAliases();
    dropOldCache();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignoré */ }
    S.stack = [{ view: 'home', arg: null, ui: null }];
    history.replaceState({ i: 0, view: 'home', arg: null }, '');
    render(S.stack[0]);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  boot();
})();
