'use strict';
(() => {
  /* =====================================================================
     WorkLog V3 : suivi d'exercices et de charges, 100 % local sur le téléphone.
     Exercices : liste fusionnée intégrée à l'app (data-v3.json), noms en anglais.
       - ExerciseDB (données MIT, images et animations © Gym visual, 180 px) en priorité ;
       - free-exercise-db (domaine public, photos) pour les exercices absents d'ExerciseDB.
     Schéma des muscles : bodymap.json (react-native-body-highlighter, licence MIT).
     ===================================================================== */
  const BACKUP_KEY = 'worklog.backup.v1';
  const ARCHIVE_KEY = 'worklog.archive.v1';
  const DATA_V = 2;
  const NS = 'http://www.w3.org/2000/svg';
  let SHA_E = 'main';   // version figée du dépôt des médias ExerciseDB
  let SHA_F = 'main';   // version figée du dépôt free-exercise-db
  let BODY = null;      // schéma du corps (face et dos)

  /* ---------- utilitaires ---------- */
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
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
  const thumb = (ex) => photo(ex, 't', { class: 'thumb' + (ex.src === 0 ? ' sq' : ''), loading: 'lazy' });
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

  const validEntry = (e) => e && typeof e.id === 'string' && typeof e.exerciseId === 'string'
    && Number.isFinite(e.w) && e.w > 0 && Number.isFinite(e.r) && e.r > 0 && Number.isFinite(e.ts);
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

  async function saveUser() {
    const payload = { v: DATA_V, savedAt: Date.now(), entries: S.entries, favs: [...S.favs], sessions: S.sessions };
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
    S.entries = p.entries.filter(validEntry);
    S.favs = new Set((p.favs || []).filter((x) => typeof x === 'string'));
    S.sessions = cleanSessions(p.sessions);
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
        p: it[5], s: Array.isArray(it[6]) ? it[6] : [], media: it[7] || null,
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
    if (changed) await saveUser();
  }

  /* ---------- petits composants ---------- */
  let toastTimer;
  function toast(msg, opts) {
    const root = document.getElementById('toast');
    root.textContent = '';
    const t = h('div', { class: 't' }, h('span', { text: msg }));
    if (opts && opts.action) {
      t.append(h('button', { type: 'button', text: opts.label || 'Annuler', onclick: () => { root.textContent = ''; opts.action(); } }));
    }
    root.append(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { root.textContent = ''; }, (opts && opts.ms) || 3200);
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
  function confirmDialog({ title, text, yes, no }) {
    return new Promise((resolve) => {
      let close = null;
      const done = (v) => { close(); resolve(v); };
      const noBtn = h('button', { type: 'button', class: 'btn ghost', text: no || 'Non', onclick: () => done(false) });
      const box = h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' },
        h('h2', { id: 'dlg-t', text: title }), text ? h('p', { text }) : null,
        h('div', { class: 'acts' }, noBtn, h('button', { type: 'button', class: 'btn danger', text: yes || 'Oui', onclick: () => done(true) })));
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
  function render(entry) {
    S.cleanups.forEach((fn) => fn()); S.cleanups = [];
    S.getUI = null;
    if (modalClose) modalClose();
    document.getElementById('toast').textContent = '';
    const root = app();
    root.textContent = '';
    const fn = { home: viewHome, library: viewLibrary, exercise: viewExercise, history: viewHistory, calendar: viewCalendar, session: viewSession, seances: viewSeances }[entry.view] || viewHome;
    root.append(fn(entry.arg, entry.ui || {}));
    const y = (entry.ui && entry.ui.scroll) || 0;
    window.scrollTo(0, y);
    if (y) requestAnimationFrame(() => window.scrollTo(0, y));
  }
  function snapshot() {
    const top = S.stack[S.stack.length - 1];
    if (top) top.ui = Object.assign({}, S.getUI ? S.getUI() : {}, { scroll: window.scrollY });
  }
  function go(view, arg) {
    snapshot();
    const entry = { view, arg: arg == null ? null : arg, ui: null };
    S.stack.push(entry);
    history.pushState({ i: S.stack.length - 1, view, arg: entry.arg }, '');
    render(entry);
  }
  const prevView = () => (S.stack.length > 1 ? S.stack[S.stack.length - 2].view : null);
  function goBack() { if (S.stack.length > 1) history.back(); else goHome(); }
  function goHome() {
    const n = S.stack.length - 1;
    if (n > 0) history.go(-n); else render(S.stack[0]);
  }
  window.addEventListener('popstate', (ev) => {
    const st = ev.state && typeof ev.state.i === 'number' ? ev.state : { i: 0, view: 'home', arg: null };
    const i = Math.max(0, st.i | 0);
    if (i < S.stack.length) {
      S.stack.length = i + 1;
    } else {
      snapshot();
      while (S.stack.length < i) S.stack.push({ view: 'home', arg: null, ui: null });
      S.stack.push({ view: st.view || 'home', arg: st.arg == null ? null : st.arg, ui: null });
    }
    render(S.stack[S.stack.length - 1]);
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

    const last = lastEntry();
    if (last) {
      const ex = getEx(last.exerciseId, last.name);
      const mine = S.entries.filter((e) => e.exerciseId === last.exerciseId);
      const latest = mine.reduce((a, b) => ((b.created || b.ts) > (a.created || a.ts) ? b : a));
      wrap.append(h('button', { type: 'button', class: 'hero', onclick: () => go('exercise', ex.id) },
        ex.missing ? null : (ex.src === 0 ? visual(ex, { static: true }) : h('div', { class: 'frame' }, flip(ex, { alt: dn(ex) }))),
        h('h2', { text: dn(ex) }),
        h('p', { class: 'last' }, h('strong', { text: fmtNum(latest.w) + ' kg' }), ' × ' + fmtNum(latest.r)),
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
  function viewExercise(id, ui) {
    const known = S.entries.find((e) => e.exerciseId === id);
    const ex = getEx(id, known && known.name);
    let range = RANGES.some((r) => r.k === ui.range) ? ui.range : '2s';
    S.getUI = () => ({ range });
    const wrap = h('main', { class: 'page exercise' });
    const fromHome = prevView() === 'home' || prevView() === null;
    wrap.append(h('header', { class: 'bar' }, fromHome ? closeBtn() : backBtn(), h('div', { class: 'grow' }), ex.missing ? null : starBtn(ex.id), fromHome ? null : closeBtn()));
    wrap.append(h('h1', { class: 'ex-title', text: dn(ex) }));
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
          h('div', { class: 'sets' }, list.map((e) => h('span', { class: 'set', text: setText(e.w, e.r) })))));
      }
    }

    function renderChart() {
      chartBox.textContent = '';
      chartBox.append(h('div', { class: 'chips fit', role: 'group', 'aria-label': 'Période' },
        RANGES.map((r) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(range === r.k), text: r.label, onclick: () => { range = r.k; renderChart(); } }))));
      const all = mine();
      const end = Math.max(Date.now(), all.length ? all[all.length - 1].ts : 0);
      const start = end - RANGES.find((r) => r.k === range).days * 86400000;
      chartBox.append(buildChart(all.filter((e) => e.ts >= start && e.ts <= end), start, end));
    }

    wrap.append(h('section', { class: 'sec' }, h('h2', { text: 'Dernières séances' }), h('div', { class: 'card' }, recent)));
    wrap.append(h('section', { class: 'sec' }, h('h2', { text: 'Progression' }), h('div', { class: 'card' }, chartBox)));
    wrap.append(buildForm(ex, refresh));
    refresh();
    return wrap;
  }

  /* Graphique : charge totale d'une série = poids × répétitions.
     Bornes : minimum −10 % arrondi à l'entier inférieur, maximum +10 % arrondi au supérieur. */
  function buildChart(pts, start, end) {
    const box = h('div');
    if (!pts.length) {
      box.append(h('p', { class: 'empty-note', text: 'Aucune série sur cette période.' }));
      return box;
    }
    const vals = pts.map((p) => p.w * p.r);
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
      svg.append(sv('text', { class: 'tick', x: m.l - 8, y: y(v) + 3.5, 'text-anchor': 'end' }, fmtNum(v)));
    }
    [0, 1 / 3, 2 / 3, 1].forEach((f, i) => {
      const t = start + (end - start) * f;
      svg.append(sv('text', { class: 'tick', x: m.l + f * (W - m.l - m.r), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === 3 ? 'end' : 'middle' }, fDayShort.format(t)));
    });

    const sorted = [...pts].sort((a, b) => a.ts - b.ts);
    if (sorted.length > 1) {
      svg.append(sv('path', { class: 'line', d: sorted.map((p, i) => (i ? 'L' : 'M') + x(p.ts).toFixed(1) + ' ' + y(p.w * p.r).toFixed(1)).join(' ') }));
    }
    const detail = h('div', { class: 'detail', 'aria-live': 'polite' });
    const dots = [];
    const select = (i) => {
      dots.forEach((d, j) => d.setAttribute('class', j === i ? 'dot on' : 'dot'));
      const p = sorted[i];
      detail.textContent = '';
      detail.append(h('strong', { text: fmtNum(p.w) + ' kg × ' + fmtNum(p.r) + ' rép.' }),
        h('span', { class: 'sub', text: 'Total ' + fmtNum(p.w * p.r) + ' · ' + fDateTime.format(p.ts) }));
    };
    sorted.forEach((p) => {
      const dot = sv('circle', { class: 'dot', cx: x(p.ts), cy: y(p.w * p.r), r: 5 });
      dots.push(dot); svg.append(dot);
    });
    sorted.forEach((p, i) => {
      const hit = sv('circle', { class: 'hit', cx: x(p.ts), cy: y(p.w * p.r), r: 16, tabindex: '0', role: 'button', 'aria-label': fmtNum(p.w) + ' kg × ' + fmtNum(p.r) + ', ' + fDateTime.format(p.ts) });
      hit.addEventListener('click', () => select(i));
      hit.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); } });
      svg.append(hit);
    });
    box.append(h('p', { class: 'chart-note', text: 'Charge totale par série (kg × répétitions)' }), svg, detail);
    select(sorted.length - 1);
    return box;
  }

  /* Saisie des séries */
  function buildForm(ex, onSaved) {
    const rows = [];
    const list = h('div', { class: 'rows' });
    const msg = h('p', { class: 'form-msg', role: 'alert' });
    const newRow = () => ({ w: '', r: '', dt: Date.now(), manual: false });

    function renderRows() {
      list.textContent = '';
      rows.forEach((row, i) => {
        const wIn = h('input', { class: 'field', type: 'text', inputmode: 'decimal', placeholder: 'kg', 'aria-label': 'Poids de la série ' + (i + 1) + ' en kilos', autocomplete: 'off' });
        const rIn = h('input', { class: 'field', type: 'text', inputmode: 'numeric', placeholder: 'rép.', 'aria-label': 'Répétitions de la série ' + (i + 1), autocomplete: 'off' });
        const dIn = h('input', { class: 'field', type: 'datetime-local', 'aria-label': 'Date et heure de la série ' + (i + 1) });
        wIn.value = row.w; rIn.value = row.r; dIn.value = toLocalInput(row.dt);
        const touch = () => {
          msg.textContent = '';
          wIn.classList.remove('invalid'); rIn.classList.remove('invalid');
          if (!row.manual) { row.dt = Date.now(); dIn.value = toLocalInput(row.dt); }
        };
        wIn.addEventListener('input', () => { row.w = wIn.value; touch(); });
        rIn.addEventListener('input', () => { row.r = rIn.value; touch(); });
        dIn.addEventListener('change', () => {
          const t = new Date(dIn.value).getTime();
          if (Number.isFinite(t)) { row.dt = t; row.manual = true; } else { row.manual = false; row.dt = Date.now(); dIn.value = toLocalInput(row.dt); }
        });
        row.nodes = { wIn, rIn };
        list.append(h('div', { class: 'srow' },
          h('span', { class: 'n', text: String(i + 1) }), wIn, h('span', { class: 'times', 'aria-hidden': 'true', text: '×' }), rIn,
          rows.length > 1 ? h('button', { type: 'button', class: 'iconbtn plain rm', 'aria-label': 'Retirer la série ' + (i + 1), onclick: () => { rows.splice(i, 1); renderRows(); } }, icon('close')) : h('span'),
          h('div', { class: 'dt-line' }, h('span', { text: 'Le' }), dIn)));
      });
    }
    rows.push(newRow()); renderRows();

    const parseNum = (s) => Number(String(s).trim().replace(',', '.'));
    async function save() {
      msg.textContent = '';
      const filled = rows.filter((r) => r.w.trim() || r.r.trim());
      if (!filled.length) { msg.textContent = 'Renseigne le poids et les répétitions d’au moins une série.'; return; }
      let bad = false;
      for (const row of filled) {
        const w = parseNum(row.w); const r = parseNum(row.r);
        const okW = Number.isFinite(w) && w > 0; const okR = Number.isInteger(r) && r > 0;
        row.nodes.wIn.classList.toggle('invalid', !okW); row.nodes.rIn.classList.toggle('invalid', !okR);
        if (!okW || !okR) bad = true;
      }
      if (bad) { msg.textContent = 'Poids : un nombre positif. Répétitions : un nombre entier.'; return; }
      const base = Date.now();
      filled.forEach((row, i) => {
        S.entries.push({ id: uid(), exerciseId: ex.id, name: dn(ex), w: parseNum(row.w), r: parseNum(row.r), ts: row.dt, created: base + i });
      });
      await saveUser();
      const n = filled.length;
      rows.length = 0; rows.push(newRow()); renderRows();
      toast(n + (n > 1 ? ' séries enregistrées' : ' série enregistrée'));
      onSaved();
    }

    return h('section', { class: 'sec' },
      h('h2', { text: 'Nouvelle série' }),
      h('div', { class: 'card' }, list,
        h('div', { class: 'form-actions' },
          msg,
          h('button', { type: 'button', class: 'btn ghost', onclick: () => { rows.push(newRow()); renderRows(); const last = rows[rows.length - 1]; last.nodes.wIn.focus(); } }, icon('plus'), 'Ajouter une série'),
          h('button', { type: 'button', class: 'btn primary', onclick: save, text: 'Valider' }))));
  }

  /* ---------- bibliothèque : onglets Favoris / Musculation / Étirements ---------- */
  const TABS = [['fav', 'Favoris'], ['musc', 'Musculation'], ['str', 'Étirements']];
  function viewLibrary(arg, ui) {
    const wrap = h('main', { class: 'page library' });
    wrap.append(h('header', { class: 'bar' }, closeBtn(), h('h1', { class: 'grow', text: 'Bibliothèque' }), h('span')));
    const search = h('input', { class: 'search', type: 'search', placeholder: 'Rechercher un exercice', 'aria-label': 'Rechercher un exercice', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', enterkeyhint: 'search' });
    search.value = ui.q || '';
    const tabBar = h('div', { class: 'tabs', role: 'tablist' });
    const body = h('div');
    wrap.append(search, tabBar, body);
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
    const exRow = (ex, showKind) => h('div', { class: 'exrow' },
      h('button', { type: 'button', class: 'open', onclick: () => go('exercise', ex.id) },
        thumb(ex), h('span', { class: 'nm' }, dn(ex), showKind && ex.st ? h('span', { class: 'kind', text: 'Étirement' }) : null)),
      starBtn(ex.id, () => onStar(ex)));

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
        const tokens = fold(raw).split(/\s+/);
        const hits = S.exercises.filter((ex) => { const hay = fold(ex.name); return tokens.every((t) => hay.includes(t)); });
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
    search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 60); });
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
          h('div', {}, h('div', { class: 'nm', text: dn(ex) }),
            h('div', { class: 'meta' }, h('b', { text: fmtNum(e.w) + ' kg × ' + fmtNum(e.r) }), ' · total ' + fmtNum(e.w * e.r) + ' · ' + fTime.format(e.ts))),
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
      const nSess = Object.keys(S.sessions).length;
      if (!S.entries.length && !nSess) { toast('Il n’y a rien à supprimer.'); return; }
      const ok = await confirmDialog({ title: 'Êtes-vous sûr de vouloir faire ça ?', text: 'Toutes les séries (' + S.entries.length + ') et les noms de séances seront supprimés. Tes favoris sont conservés.', yes: 'Oui', no: 'Non' });
      if (!ok) return;
      S.entries = []; S.sessions = {}; await saveUser(); render(); toast('Historique supprimé');
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
    const data = { app: 'WorkLog', version: DATA_V, exportedAt: new Date().toISOString(), entries: S.entries, favorites: [...S.favs], sessions: S.sessions };
    const ok = await shareFile('worklog-' + dayKey(Date.now()) + '.json', JSON.stringify(data, null, 2), 'application/json');
    if (ok) toast('Sauvegarde prête : enregistre-la dans ton dossier.');
  }
  async function importFile(file) {
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('trop gros');
      const d = JSON.parse(await file.text());
      if (!d || d.app !== 'WorkLog' || !Array.isArray(d.entries)) throw new Error('format');
      const sig = (e) => [e.exerciseId, e.ts, e.w, e.r].join('|');
      const ids = new Set(S.entries.map((e) => e.id)); const sigs = new Set(S.entries.map(sig));
      let added = 0; let dupes = 0; let invalid = 0;
      for (const raw of d.entries) {
        if (!validEntry(raw)) { invalid++; continue; }
        if (ids.has(raw.id) || sigs.has(sig(raw))) { dupes++; continue; }
        const e = { id: raw.id, exerciseId: raw.exerciseId, name: String(raw.name || raw.exerciseId), w: raw.w, r: raw.r, ts: raw.ts, created: Number.isFinite(raw.created) ? raw.created : raw.ts };
        S.entries.push(e); ids.add(e.id); sigs.add(sig(e)); added++;
      }
      (Array.isArray(d.favorites) ? d.favorites : []).forEach((id) => { if (typeof id === 'string') S.favs.add(id); });
      // Noms de séances : on ajoute ceux qui manquent, sans écraser ceux déjà présents.
      for (const [k, v] of Object.entries(cleanSessions(d.sessions))) if (!S.sessions[k]) S.sessions[k] = v;
      await saveUser();
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
    return { nEx: new Set(list.map((e) => e.exerciseId)).size, nSets: list.length, load: list.reduce((n, e) => n + e.w * e.r, 0) };
  }
  const sessionTitle = (s) => s.name || GROUPS.get(s.main).label;

  /* ---------- calendrier ---------- */
  function viewCalendar() {
    const wrap = h('main', { class: 'page sessions' });
    wrap.append(h('header', { class: 'bar' }, closeBtn(), h('h1', { class: 'grow', text: 'Calendrier' }), h('span')));
    if (!S.cal) { const n = new Date(); S.cal = { y: n.getFullYear(), m: n.getMonth() }; }
    const box = h('div');
    wrap.append(box);

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
        if (has) sessions++;
        const named = has && S.sessions[k];
        const isToday = isCurrent && d === now.getDate();
        grid.append(h('button', {
          type: 'button', class: 'day' + (has ? ' has' : '') + (named ? ' named' : '') + (isToday ? ' today' : ''), disabled: !has, text: String(d),
          style: named ? { '--c': GROUPS.get(named.main).color } : null,
          'aria-label': has ? 'Séance du ' + d + ' ' + fMonth.format(new Date(y, m, 1)) + (named ? ' : ' + sessionTitle(named) : '') : null,
          onclick: has ? () => go('session', k) : null,
        }));
      }
      box.append(grid);
      box.append(h('p', { class: 'cal-note', text: sessions ? plural(sessions, 'jour', 'jours') + ' d’entraînement ce mois-ci. Touche un carré pour revoir la séance et lui donner un nom.' : 'Aucune séance ce mois-ci.' }));
    }
    render();
    return wrap;
  }

  /* ---------- une journée d'entraînement ---------- */
  function viewSession(key) {
    const wrap = h('main', { class: 'page session' });
    wrap.append(h('header', { class: 'bar' }, backBtn(), h('h1', { class: 'grow', text: dayLabel(keyDate(key)) }), closeBtn()));
    const entries = S.entries.filter((e) => dayKey(e.ts) === key).sort((a, b) => a.ts - b.ts || (a.created || 0) - (b.created || 0));
    if (!entries.length) {
      wrap.append(h('p', { class: 'empty-note', text: 'Aucune série enregistrée ce jour-là.' }));
      return wrap;
    }
    const st = dayStats(entries);
    const nameBox = h('div', { class: 'sess-name' });
    function renderName() {
      nameBox.textContent = '';
      const s = S.sessions[key];
      if (!s) {
        nameBox.append(h('button', { type: 'button', class: 'btn ghost wide', onclick: edit }, icon('tag'), 'Nommer la séance'));
        return;
      }
      nameBox.append(h('div', { class: 'card named', style: { '--c': GROUPS.get(s.main).color } },
        h('div', { class: 'row' }, h('strong', { class: 'nm', text: sessionTitle(s) }),
          h('button', { type: 'button', class: 'textbtn', text: 'Modifier', onclick: edit })),
        h('div', { class: 'tags' }, tag(s.main, true), s.sec.map((id) => tag(id)))));
    }
    function edit() { sessionDialog(key, entries, renderName); }
    renderName();
    wrap.append(nameBox);
    wrap.append(h('p', { class: 'sum', text: plural(st.nEx, 'exercice', 'exercices') + ' · ' + plural(st.nSets, 'série', 'séries') + ' · ' + fmtNum(Math.round(st.load)) + ' kg au total' }));

    const blocks = [];
    for (const e of entries) {
      const last = blocks[blocks.length - 1];
      if (last && last.exerciseId === e.exerciseId) last.sets.push(e); else blocks.push({ exerciseId: e.exerciseId, name: e.name, sets: [e] });
    }
    const tl = h('div', { class: 'timeline' });
    for (const b of blocks) {
      const ex = getEx(b.exerciseId, b.name);
      tl.append(h('article', { class: 'tl' },
        h('button', { type: 'button', class: 'head', onclick: () => go('exercise', ex.id) }, thumb(ex),
          h('div', {}, h('div', { class: 't', text: fTime.format(b.sets[0].ts) }), h('div', { class: 'nm', text: dn(ex) }))),
        b.sets.map((e) => h('div', { class: 'line-set' }, h('span', { class: 'tm', text: fTime.format(e.ts) }), h('b', { text: fmtNum(e.w) + ' kg × ' + fmtNum(e.r) }), h('span', { class: 'tot', text: fmtNum(e.w * e.r) })))));
    }
    wrap.append(tl);
    return wrap;
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
    const chipBox = h('div', { class: 'chips wrap', role: 'group', 'aria-label': 'Groupes secondaires' });
    const msg = h('p', { class: 'form-msg', role: 'alert' });
    function renderChips() {
      chipBox.textContent = '';
      sec.delete(main);
      for (const g of GROUP_LIST) {
        if (g.id === main) continue;
        const b = h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(sec.has(g.id)), text: g.label });
        b.addEventListener('click', () => { if (sec.has(g.id)) sec.delete(g.id); else sec.add(g.id); b.setAttribute('aria-pressed', String(sec.has(g.id))); });
        chipBox.append(b);
      }
    }
    sel.addEventListener('change', () => { main = sel.value; msg.textContent = ''; renderChips(); });
    renderChips();

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
      h('div', { class: 'lbl', text: 'Groupes secondaires' }), chipBox,
      msg,
      h('div', { class: 'acts' },
        h('button', { type: 'button', class: 'btn ghost', text: 'Annuler', onclick: () => close() }),
        h('button', { type: 'button', class: 'btn primary', text: 'Enregistrer', onclick: save })),
      cur ? h('button', { type: 'button', class: 'textbtn danger center', text: 'Retirer le nom de cette séance', onclick: clear }) : null);
    close = openModal(box);
  }

  /* ---------- page Séances : les séances nommées, par groupe musculaire ---------- */
  function viewSeances(arg, ui) {
    let filter = GROUPS.has(ui.filter) ? ui.filter : 'all';
    S.getUI = () => ({ filter });
    const wrap = h('main', { class: 'page seances' });
    wrap.append(h('header', { class: 'bar' }, closeBtn(), h('h1', { class: 'grow', text: 'Séances' }), h('span')));
    const byDay = daysIndex();
    const all = Object.keys(S.sessions).filter((k) => byDay.has(k)).sort().reverse()
      .map((k) => ({ key: k, s: S.sessions[k], st: dayStats(byDay.get(k)) }));
    if (!all.length) {
      wrap.append(h('div', { class: 'card empty-card' },
        h('strong', { text: 'Aucune séance nommée' }),
        h('p', { text: 'Ouvre un jour d’entraînement dans le calendrier, puis touche « Nommer la séance ». Elle apparaîtra ici, classée par groupe musculaire.' }),
        h('button', { type: 'button', class: 'btn primary', text: 'Ouvrir le calendrier', onclick: () => go('calendar') })));
      return wrap;
    }
    const works = (x, top) => topOf(x.s.main) === top || x.s.sec.some((id) => topOf(id) === top);
    const tops = TREE.filter((t) => all.some((x) => works(x, t.id)));
    if (filter !== 'all' && !tops.some((t) => t.id === filter)) filter = 'all';
    const body = h('div');
    wrap.append(body);

    function card(x) {
      const g = GROUPS.get(x.s.main);
      return h('button', { type: 'button', class: 'scard', style: { '--c': g.color }, onclick: () => go('session', x.key) },
        h('div', { class: 'top' }, h('span', { class: 'date', text: dayLabel(keyDate(x.key)) }), h('span', { class: 'ago', text: ago(x.key) })),
        h('div', { class: 'nm', text: sessionTitle(x.s) }),
        h('div', { class: 'tags' }, tag(x.s.main, true), x.s.sec.map((id) => tag(id))),
        h('div', { class: 'figs' },
          h('div', {}, h('b', { text: String(x.st.nEx) }), h('span', { text: x.st.nEx > 1 ? 'exercices' : 'exercice' })),
          h('div', {}, h('b', { text: String(x.st.nSets) }), h('span', { text: x.st.nSets > 1 ? 'séries' : 'série' })),
          h('div', {}, h('b', { text: fmtNum(Math.round(x.st.load)) }), h('span', { text: 'kg soulevés' }))));
    }
    function render() {
      body.textContent = '';
      const chip = (id, label, n) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(filter === id), onclick: () => { filter = id; render(); window.scrollTo(0, 0); } }, label, h('span', { class: 'n', text: String(n) }));
      body.append(h('div', { class: 'chips scroll', role: 'group', 'aria-label': 'Filtrer par groupe musculaire' },
        chip('all', 'Toutes', all.length), tops.map((t) => chip(t.id, t.label, all.filter((x) => works(x, t.id)).length))));
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
    render();
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
