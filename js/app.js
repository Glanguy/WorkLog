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
  const APP_VERSION = '0.8.5';
  const SYNC_KEY = 'worklog.sync.v1';   // connexion au NAS : jeton et suivi, gardés sur ce téléphone uniquement
  const LANG_KEY = 'worklog.lang';
  const NS = 'http://www.w3.org/2000/svg';
  let SHA_E = 'main';   // version figée du dépôt des médias ExerciseDB
  let SHA_F = 'main';   // version figée du dépôt free-exercise-db
  let BODY = null;      // schéma du corps (face et dos)
  const W3 = window.WL3D || null;   // exercices maison en 3D (mannequin.js, exercices-3d.js)

  /* ---------- utilitaires ---------- */
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const skey = (s) => fold(s).replace(/[^a-z0-9]+/g, ' ').trim();
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  /* Langue : français (par défaut) ou anglais. T() traduit un texte de l'interface (js/i18n.js). */
  let LANG = 'fr';
  try { if (localStorage.getItem(LANG_KEY) === 'en') LANG = 'en'; } catch (e) { /* ignoré */ }
  const EN = window.WL_EN || {};
  const T = (fr, ...args) => {
    let out = LANG === 'en' && Object.prototype.hasOwnProperty.call(EN, fr) ? EN[fr] : fr;
    if (args.length) out = out.replace(/\{(\d)\}/g, (m, i) => (args[i] == null ? '' : String(args[i])));
    return out;
  };
  const LOC = () => (LANG === 'en' ? 'en-GB' : 'fr-FR');
  let nf; let fDateTime; let fDayLong; let fDayShort; let fTime; let fMonth; let fDate;
  function setLocale() {
    nf = new Intl.NumberFormat(LOC(), { maximumFractionDigits: 2 });
    fDateTime = new Intl.DateTimeFormat(LOC(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    fDayLong = new Intl.DateTimeFormat(LOC(), { weekday: 'long', day: 'numeric', month: 'long' });
    fDayShort = new Intl.DateTimeFormat(LOC(), { day: 'numeric', month: 'short' });
    fTime = new Intl.DateTimeFormat(LOC(), { hour: '2-digit', minute: '2-digit' });
    fMonth = new Intl.DateTimeFormat(LOC(), { month: 'long', year: 'numeric' });
    fDate = new Intl.DateTimeFormat(LOC(), { day: 'numeric', month: 'long', year: 'numeric' });
    document.documentElement.lang = LANG;
  }
  setLocale();
  const fmtNum = (n) => nf.format(n);
  const pad2 = (n) => String(n).padStart(2, '0');
  const dayKey = (ts) => { const d = new Date(ts); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  const keyDate = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
  const toLocalInput = (ts) => { const d = new Date(ts); return dayKey(ts) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  // Pluriel : en français à partir de 2, en anglais dès que ce n'est pas 1.
  const plural = (n, one, many) => n + ' ' + ((LANG === 'en' ? n !== 1 : n > 1) ? T(many) : T(one));
  function dayLabel(date) {
    const s = cap(fDayLong.format(date));
    return date.getFullYear() !== new Date().getFullYear() ? s + ' ' + date.getFullYear() : s;
  }
  function ago(key) {
    const now = new Date();
    const n = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - keyDate(key)) / 86400000);
    if (n <= 0) return T('aujourd’hui');
    if (n === 1) return T('hier');
    if (n < 14) return T('il y a {0} jours', n);
    if (n < 63) return T('il y a {0} semaines', Math.round(n / 7));
    return T('il y a {0} mois', Math.round(n / 30.44));
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
  /* 0.8.3 : un bouton qui enregistre ne réagit qu'une fois : il reste désactivé jusqu'à la fin de l'enregistrement
     (un double appui enregistrait deux séries).
     0.8.4 : et rien n'est enregistré dans les 600 ms qui suivent un enregistrement : le 2e appui d'un double appui
     arrive après la fin de l'écriture, parfois sur un bouton redessiné (accueil, page de la séance). */
  let lastSave = 0;
  const onceClick = (fn) => async (ev) => {
    const b = ev.currentTarget;
    if (!b || b.disabled || Date.now() - lastSave < 600) return;
    b.disabled = true;
    try { await fn(ev); } finally { lastSave = Date.now(); b.disabled = false; }
  };
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
    // 0.8.0 : barre du bas, accueil, fiche exercice
    home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
    book: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6"/>',
    flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.8 1.2 2.6 2 3C12.8 9 12 6 12 3z"/>',
    minus: '<path d="M5 12h14"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    body: '<circle cx="12" cy="5" r="2.2"/><path d="M6 9h12M12 9v6M12 15l-3.5 6M12 15l3.5 6"/>',
    stack: '<path d="M4 8l8-4 8 4-8 4z"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4"/>',
    steps: '<path d="M4 17h4v-4h4V9h4V5h4"/>',
    history: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5M12 8v4l3 2"/>',
    swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  };
  function icon(name, cls) {
    const el = sv('svg', { viewBox: '0 0 24 24', class: 'ic ' + (cls || ''), 'aria-hidden': 'true' });
    el.innerHTML = ICONS[name];
    return el;
  }

  /* ---------- muscles et catégories (de la tête aux pieds) ---------- */
  const MUSCLES = {
    'neck': T('Cou'), 'shoulders': T('Épaules'), 'chest': T('Pectoraux'), 'traps': T('Trapèzes'), 'lats': T('Grands dorsaux'),
    'middle back': T('Milieu du dos'), 'lower back': T('Bas du dos'), 'biceps': T('Biceps'), 'triceps': T('Triceps'), 'forearms': T('Avant-bras'),
    'abdominals': T('Abdominaux'), 'glutes': T('Fessiers'), 'hamstrings': T('Ischio-jambiers'), 'abductors': T('Abducteurs'), 'adductors': T('Adducteurs'),
    'quadriceps': T('Quadriceps'), 'calves': T('Mollets'),
    'obliques': T('Obliques'), 'hip flexors': T('Fléchisseurs de hanche'), 'tibialis': T('Tibial antérieur'), 'serratus': T('Dentelé antérieur'), 'cardio': T('Système cardiovasculaire'),
    'psoas': T('Psoas'), 'piriformis': T('Piriforme'), 'tfl': T('Tenseur du fascia lata (TFL)'), 'rhomboids': T('Rhomboïdes'), 'rear delts': T('Deltoïde postérieur'), 'rotator cuff': T('Coiffe des rotateurs'),
  };
  /* Zones du schéma colorées pour chaque muscle. */
  const SLUGS = {
    'neck': ['neck'], 'shoulders': ['deltoids'], 'chest': ['chest'], 'traps': ['trapezius'], 'lats': ['upper-back'], 'middle back': ['upper-back'],
    'lower back': ['lower-back'], 'biceps': ['biceps'], 'triceps': ['triceps'], 'forearms': ['forearm'], 'abdominals': ['abs', 'obliques'], 'obliques': ['obliques'],
    'serratus': ['obliques'], 'glutes': ['gluteal'], 'hamstrings': ['hamstring'], 'abductors': ['gluteal'], 'adductors': ['adductors'], 'quadriceps': ['quadriceps'],
    'hip flexors': [], 'calves': ['calves'], 'tibialis': ['tibialis'], 'cardio': [],
    'psoas': [], 'piriformis': ['gluteal'], 'tfl': ['gluteal'], 'rhomboids': ['upper-back'], 'rear delts': ['deltoids'], 'rotator cuff': ['deltoids'],
  };
  const SKIN = new Set(['head', 'hair', 'hands', 'feet', 'ankles', 'knees']);
  const frMuscle = (s) => MUSCLES[s] || cap(String(s));

  const TREE = [
    { id: 'cou', label: T('Cou'), color: '#9FB2D4', m: ['neck'] },
    { id: 'epaules', label: T('Épaules'), color: '#5FA8FF', m: ['shoulders'] },
    { id: 'pectoraux', label: T('Pectoraux'), color: '#FF6FAE', m: ['chest'] },
    { id: 'dos', label: T('Dos'), color: '#3EE0B5', m: ['traps', 'lats', 'middle back', 'lower back'] },
    { id: 'bras', label: T('Bras'), color: '#FFA54A', subs: [
      { id: 'biceps', label: T('Biceps'), m: ['biceps'] },
      { id: 'triceps', label: T('Triceps'), m: ['triceps'] },
      { id: 'avant-bras', label: T('Avant-bras'), m: ['forearms'] },
    ] },
    { id: 'abdos', label: T('Abdominaux et taille'), color: '#E8C547', m: ['abdominals'] },
    { id: 'jambes', label: T('Jambes'), color: '#B784FF', subs: [
      { id: 'fessiers-ischios', label: T('Fessiers et ischio-jambiers'), m: ['glutes', 'hamstrings'] },
      { id: 'abducteurs', label: T('Abducteurs et adducteurs'), m: ['abductors', 'adductors'] },
      { id: 'quadriceps', label: T('Quadriceps'), m: ['quadriceps'] },
      { id: 'mollets', label: T('Mollets'), m: ['calves'] },
    ] },
    { id: 'cardio', label: T('Cardio'), color: '#FF6B6B' },
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
    schedules: [],       // programmations répétées : { id, plan, start, every (semaines), days [0 = lundi … 6], until, made: [dates déjà ajoutées] }
    settings: { bw: '', pct: 70, steps: {}, diag: false, nas: { url: '', email: '' } },   // réglages : poids du corps (kg), crans des roues, adresse du NAS
    savedAt: 0,          // date de la dernière modification des données
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

  const dn = (ex) => (LANG === 'fr' ? ex.fr || ex.name : ex.en || ex.name);
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
  /* Vignette : l'image n'est chargée que lorsque la vignette arrive à l'écran (gif animé
     d'ExerciseDB, ou les deux photos de free-exercise-db) et elle est retirée de la mémoire dès
     qu'elle en sort : faire défiler beaucoup d'exercices ne remplit plus la mémoire du téléphone.
     opts.zoom : un appui l'agrandit. */
  let thumbIO = null;
  function watchThumb(el) {
    if (!('IntersectionObserver' in window)) { el._play(true); return; }
    // Une vignette ne se charge que si elle reste à l'écran un court instant : un défilement rapide
    // ne lance pas des centaines de chargements d'images pour rien.
    if (!thumbIO) {
      thumbIO = new IntersectionObserver((ents) => ents.forEach((en) => {
        const t = en.target;
        if (!t._play) return;
        clearTimeout(t._wait);
        if (en.isIntersecting) t._wait = setTimeout(() => { if (t.isConnected) t._play(true); }, 140);
        else t._play(false);
      }), { rootMargin: '60px 0px' });
    }
    thumbIO.observe(el);
  }
  /* Exercice maison (src 2) : le mannequin 3D animé. big : grande vue qu'on fait tourner au doigt. */
  /* Exercice de la bibliothèque qui a aussi son mannequin 3D (exercices-3d-muscu.js) : le mannequin remplace le gif ou les photos. */
  const has3d = (ex) => !!ex && !ex.missing && (ex.src === 2 || !!(W3 && W3.lib(ex.id)));
  function view3d(ex, big, cls) {
    const c = W3 && W3.view(ex.id, { thumb: !big, cls });
    return c || h('span', { class: 'ph ' + (cls || '') });
  }
  /* ---------- vignettes dessinées dans un canvas ----------
     Safari garde dans sa mémoire graphique chaque gif animé et chaque grande photo affichés par une
     balise <img>, même une fois retirés de la page. En parcourant des centaines d'exercices, cette
     mémoire déborde et Safari arrête de dessiner la page (écran blanc, rien de cliquable), alors que
     l'app, elle, tourne toujours (c'est ce qu'a montré le diagnostic de la 0.7.1).
     Les vignettes des listes sont donc dessinées par l'app dans un petit canvas : le gif est décodé
     image par image (js/gifreader.js), les photos sont réduites à la taille de la vignette, et tout est
     libéré (canvas vidé, données oubliées) dès que la vignette sort de l'écran. */
  const ANIM = new Set();   // vignettes animées actuellement à l'écran
  let animRaf = 0;
  function animLoop(now) {
    animRaf = 0;
    for (const a of ANIM) if (now >= a.next) a.step(now);
    if (ANIM.size && document.visibilityState !== 'hidden') animRaf = requestAnimationFrame(animLoop);
  }
  const animKick = () => { if (!animRaf && ANIM.size) animRaf = requestAnimationFrame(animLoop); };
  document.addEventListener('visibilitychange', animKick);
  async function fetchBytes(ex, kind) {
    try {
      let r = await fetch(mediaUrl(ex, kind));
      if (!r.ok) r = await fetch(mediaUrl(ex, kind, true));
      if (!r.ok) return null;
      return r;
    } catch (e) { return null; }
  }
  /* Gif ExerciseDB : décodé et dessiné image par image dans un canvas 180 × 180. */
  function gifThumb(ex) {
    const c = h('canvas', { class: 'thumb sq cv', 'aria-hidden': 'true', width: '0', height: '0' });
    let on = false; let gen = 0; let anim = null;
    const stop = () => { if (anim) { ANIM.delete(anim); anim = null; } c.width = 0; c.height = 0; };
    c._play = async (v) => {
      if (v === on) return;
      on = v; const my = ++gen;
      if (!on) { stop(); return; }
      const r = await fetchBytes(ex, 'a');
      const buf = r ? new Uint8Array(await r.arrayBuffer().catch(() => new ArrayBuffer(0))) : null;
      if (my !== gen) return;
      let rd = null;
      try { rd = buf && buf.length && window.GifReader ? new window.GifReader(buf) : null; } catch (e) { rd = null; }
      if (!rd) { c.classList.add('broken'); return; }
      c.classList.remove('broken');
      c.width = rd.width; c.height = rd.height;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(rd.width, rd.height);
      const n = rd.numFrames();
      let i = 0;
      const delay = (k) => { try { return Math.max(60, (rd.frameInfo(k).delay || 10) * 10); } catch (e) { return 100; } };
      const draw = () => {
        if (i === 0) img.data.fill(0);
        try { rd.decodeAndBlitFrameRGBA(i, img.data); } catch (e) { /* image abîmée : on garde la précédente */ }
        ctx.putImageData(img, 0, 0);
      };
      draw();
      if (n > 1) {
        anim = { next: performance.now() + delay(0), step(now) { i = (i + 1) % n; draw(); this.next = now + delay(i); } };
        ANIM.add(anim); animKick();
      }
    };
    return c;
  }
  /* Deux photos free-exercise-db (750 × 500) réduites à la taille de la vignette, qui alternent. */
  function photoThumb(ex) {
    const el = h('span', { class: 'thumb tflip' });
    const a = h('canvas', { width: '0', height: '0' });
    const b = h('canvas', { class: 'b', width: '0', height: '0' });
    el.append(a, b);
    let on = false; let gen = 0;
    const paint = async (cv, k, my) => {
      const r = await fetchBytes(ex, k);
      if (!r || my !== gen) return false;
      let bmp = null;
      try { bmp = await createImageBitmap(await r.blob()); } catch (e) { return false; }
      if (my !== gen) { bmp.close(); return false; }
      const W = 216; const H = 144;   // 3 × la taille affichée
      cv.width = W; cv.height = H;
      const sc = Math.max(W / bmp.width, H / bmp.height);
      const w = bmp.width * sc; const hh = bmp.height * sc;
      cv.getContext('2d').drawImage(bmp, (W - w) / 2, (H - hh) / 2, w, hh);
      bmp.close();   // la grande photo décodée est libérée tout de suite
      return true;
    };
    el._play = async (v) => {
      if (v === on) return;
      on = v; const my = ++gen;
      el.classList.toggle('play', false);
      if (!on) { a.width = a.height = b.width = b.height = 0; return; }
      const ok = await paint(a, 0, my);
      if (!ok) { if (my === gen) el.classList.add('broken'); return; }
      if (await paint(b, 1, my)) el.classList.toggle('play', on && my === gen);
    };
    return el;
  }

  function thumb(ex, opts) {
    if (ex.missing) return h('span', { class: 'ph thumb' });
    let el;
    if (has3d(ex)) {
      el = view3d(ex, false, 'thumb sq');
      if (opts && opts.zoom) { el.classList.add('zoomable'); el.setAttribute('title', T('Agrandir')); el.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); lightbox(ex); }); }
      return el;
    }
    if (ex.src === 0) el = gifThumb(ex);
    else el = photoThumb(ex);
    watchThumb(el);
    if (opts && opts.zoom) {
      el.classList.add('zoomable');
      el.setAttribute('title', T('Agrandir'));
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
      h('figure', {}, bodyFig('front', prim, sec), h('figcaption', { text: T('Face') })),
      h('figure', {}, bodyFig('back', prim, sec), h('figcaption', { text: T('Dos') })));
  }
  /* Bloc visuel d'un exercice : le schéma en grand, l'animation ExerciseDB en vignette
     (un appui l'agrandit). Pour free-exercise-db : le schéma puis les photos en grand. */
  function visual(ex, opts) {
    const zoom = !(opts && opts.static);
    if (has3d(ex)) {
      return h('div', { class: 'vis vis3d' }, view3d(ex, zoom, 'big'),
        zoom ? h('p', { class: 'turn', text: T('Fais glisser le doigt sur le mannequin pour le tourner dans tous les sens.') }) : null);
    }
    const maps = muscleMaps(ex);
    if (ex.src === 0) {
      const media = photo(ex, 'a', { alt: T('Animation : ') + dn(ex) });
      const box = zoom
        ? h('button', { type: 'button', class: 'anim', 'aria-label': T('Agrandir l’animation'), onclick: () => lightbox(ex) }, media, h('span', { class: 'zoom' }, icon('zoom')))
        : h('div', { class: 'anim' }, media);
      return h('div', { class: 'vis' + (maps ? '' : ' nomap') }, maps, box);
    }
    const ph = zoom
      ? h('button', { type: 'button', class: 'visual', 'aria-label': T('Agrandir les photos'), onclick: () => lightbox(ex) }, flip(ex, { alt: T('Démonstration : ') + dn(ex) }))
      : h('div', { class: 'visual' }, flip(ex, { alt: dn(ex) }));
    return h('div', { class: 'visf' }, maps ? h('div', { class: 'vis solo' }, maps) : null, ph);
  }
  function lightbox(ex) {
    let close = null;
    const media = has3d(ex) ? h('div', { class: 'lb-media sq' }, view3d(ex, true, 'big'))
      : ex.src === 0
      ? h('div', { class: 'lb-media sq' }, photo(ex, 'a', { alt: T('Animation : ') + dn(ex) }))
      : h('div', { class: 'lb-media' }, flip(ex, { alt: T('Démonstration : ') + dn(ex) }));
    const box = h('div', { class: 'dialog lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': dn(ex) },
      media, h('p', { class: 'lb-name', text: dn(ex) }),
      h('button', { type: 'button', class: 'btn ghost wide', text: T('Fermer'), onclick: () => close() }));
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
    } else {
      e.w = raw.w; e.r = raw.r;
      // Série au poids du corps : w = poids total soulevé (poids du corps + lest), x = lest (négatif : assistance).
      if (raw.bw === 1) { e.bw = 1; e.x = fin(raw.x) ? raw.x : 0; }
    }
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
  /* Série prévue : { w, r } ; pour un exercice à la durée (étirement, mobilité) : { w: '', r: '', dur } en secondes, dur vide = durée libre. */
  const durOrBlank = (v) => { const n = numOrBlank(v); return n === '' ? '' : Math.round(n); };
  /* Lest d'une série au poids du corps : positif (ajouté), négatif (assistance) ou vide. */
  function signedOrBlank(v) {
    if (fin(v)) return Math.round(v * 100) / 100;
    if (typeof v === 'string' && v.trim()) { const n = calcEval(v); return Number.isFinite(n) ? n : ''; }
    return '';
  }
  const cleanSet = (x) => (x && x.dur !== undefined ? { w: '', r: '', dur: durOrBlank(x.dur) }
    : x && x.bw ? { w: signedOrBlank(x.w), r: numOrBlank(x.r), bw: 1 } : { w: numOrBlank(x && x.w), r: numOrBlank(x && x.r) });
  const keepSet = (x) => x.w !== '' || x.r !== '' || x.dur !== undefined || !!x.bw;
  const cleanSets = (a) => (Array.isArray(a) ? a.slice(0, 30).map(cleanSet) : []);
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
      if (order.length || note) {
        out[k] = { order, plan, note };
        if (d.hidden === true) out[k].hidden = true;
        const src = (Array.isArray(d.src) ? d.src : []).filter((x) => typeof x === 'string');
        if (src.length) out[k].src = [...new Set(src)];
        // 0.8.2 : la séance qui a donné son nom à la journée (id de séance type, ou « copy » pour une séance recopiée).
        if (typeof d.own === 'string' && d.own.length < 80) out[k].own = d.own;
      }
    }
    return out;
  }
  function cleanNotes(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj && typeof obj === 'object' ? obj : {})) if (typeof v === 'string' && v.trim()) out[k] = v.slice(0, 4000);
    return out;
  }
  const isKey = (k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);
  function cleanSchedules(arr) {
    const out = []; const seen = new Set();
    for (const x of Array.isArray(arr) ? arr : []) {
      if (!x || typeof x.id !== 'string' || seen.has(x.id) || typeof x.plan !== 'string' || !isKey(x.start)) continue;
      seen.add(x.id);
      const every = [1, 2, 3, 4].includes(x.every) ? x.every : 1;
      const days = [...new Set((Array.isArray(x.days) ? x.days : []).filter((d) => Number.isInteger(d) && d >= 0 && d < 7))].sort();
      if (!days.length) continue;
      out.push({ id: x.id, plan: x.plan, start: x.start, every, days, until: isKey(x.until) ? x.until : '', made: (Array.isArray(x.made) ? x.made : []).filter(isKey) });
    }
    return out;
  }
  const STEPS = [0.5, 1, 1.25, 2, 2.5, 5, 10];
  function cleanSettings(o) {
    const s = o && typeof o === 'object' ? o : {};
    const bw = fin(s.bw) && s.bw > 0 && s.bw < 400 ? Math.round(s.bw * 10) / 10 : '';
    const nas = s.nas && typeof s.nas === 'object' ? s.nas : {};
    const pct = [60, 70, 80].includes(s.pct) ? s.pct : 70;   // graphique « Répétitions à X % »
    // Cran de la roue du poids, choisi pour chaque exercice (0.8.0).
    const steps = {};
    if (s.steps && typeof s.steps === 'object') for (const [k, v] of Object.entries(s.steps)) if (typeof k === 'string' && STEPS.includes(v)) steps[k] = v;
    return { bw, pct, steps, diag: s.diag === true, nas: { url: str(nas.url, 300).trim(), email: str(nas.email, 200).trim() } };
  }
  const cleanFolders = (a) => [...new Set((Array.isArray(a) ? a : []).filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 40)))];

  /* Tout ce que l'utilisateur a rempli : séries, favoris, séances, notes, séances types, dossiers,
     programmations et réglages. C'est aussi le contenu de l'export complet et de la synchronisation. */
  const userData = () => ({ entries: S.entries, favs: [...S.favs], sessions: S.sessions, days: S.days, notes: S.notes,
    plans: S.plans, folders: S.folders, schedules: S.schedules, settings: S.settings });
  async function saveUser(opts) {
    S.savedAt = (opts && opts.at) || Date.now();
    const payload = Object.assign({ v: DATA_V, savedAt: S.savedAt }, userData());
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify(payload)); } catch (e) { /* ignoré */ }
    try { await kvSet('user', payload); } catch (e) { console.warn('IndexedDB indisponible', e); }
    if (!(opts && opts.quiet)) nasSoon();
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
    S.schedules = cleanSchedules(p.schedules);
    S.settings = cleanSettings(p.settings);
    S.savedAt = fin(p.savedAt) ? p.savedAt : 0;
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
      const [base, frNames] = await Promise.all([getJson('data/data-v3.json'), getJson('data/names-fr.json').catch(() => ({}))]);
      const frOf = (id) => (frNames && typeof frNames[id] === 'string' ? frNames[id] : '');
      const sha = (v) => (typeof v === 'string' && /^[0-9a-f]{7,40}$/.test(v) ? v : 'main');
      SHA_E = sha(base.shaE); SHA_F = sha(base.shaF);
      S.alias = base.alias && typeof base.alias === 'object' ? base.alias : {};
      // [id, nom, source (0 ExerciseDB, 1 free-exercise-db), étirement (0/1), catégorie, muscle principal, muscles secondaires, média]
      S.exercises = base.items.filter((it) => Array.isArray(it) && typeof it[0] === 'string' && it[1] && GROUPS.has(it[4])).map((it) => ({
        id: it[0], name: String(it[1]), src: it[2] === 0 ? 0 : 1, st: it[3] === 1, leaf: it[4], top: topOf(it[4]),
        p: it[5], s: Array.isArray(it[6]) ? it[6] : [], media: it[7] || null, key: skey(it[1]), fr: frOf(it[0]), fkey: skey(frOf(it[0])),
      }));
      // Exercices maison en 3D : ils remplacent leurs doublons de la liste (l'historique suit, voir migrateAliases).
      const own = W3 ? W3.list().filter((o) => GROUPS.has(o.leaf)) : [];
      const dups = new Map();
      own.forEach((o) => o.dup.forEach((d) => dups.set(d, o.id)));
      if (dups.size) { S.exercises = S.exercises.filter((e) => !dups.has(e.id)); S.alias = Object.assign({}, S.alias); dups.forEach((to, from) => { S.alias[from] = to; }); }
      // Exercices maison : nom anglais (en) et nom français (name dans exercices-3d.js).
      own.forEach((o) => S.exercises.push({ id: o.id, name: o.en || o.name, fr: o.name, src: 2, st: true, leaf: o.leaf, top: topOf(o.leaf), p: o.p, s: o.s, media: null,
        key: skey(o.en || o.name), fkey: skey(o.name), side: o.side }));
      S.loadError = false;
    } catch (e) {
      S.exercises = []; S.loadError = true;
    }
    if (!BODY) { try { BODY = await getJson('data/bodymap.json'); } catch (e) { BODY = null; } }
    S.byId = new Map(S.exercises.map((e) => [e.id, e]));
    S.byLeaf = new Map();
    for (const ex of S.exercises) { if (!S.byLeaf.has(ex.leaf)) S.byLeaf.set(ex.leaf, []); S.byLeaf.get(ex.leaf).push(ex); }
    S.byLeaf.forEach((list) => list.sort((x, y) => dn(x).localeCompare(dn(y), LANG)));
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
      t.append(h('button', { type: 'button', text: opts.label || T('Annuler'), onclick: () => { root.textContent = ''; toastSticky = false; opts.action(); } }));
    }
    root.append(t);
    toastSticky = !!(opts && opts.sticky);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { root.textContent = ''; toastSticky = false; }, (opts && opts.ms) || 3200);
  }

  /* ----- calcul dans le champ du poids : 20+2,5+2,5 → 25 ----- */
  const fmtIn = (n) => (LANG === 'en' ? String(Math.round(n * 100) / 100) : String(Math.round(n * 100) / 100).replace('.', ','));
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
    calcBar = h('div', { class: 'calcbar', hidden: true, role: 'toolbar', 'aria-label': T('Calcul du poids') },
      ['+', '−', T('×'), T('÷')].map((k) => h('button', { type: 'button', class: 'ck', 'data-k': k, text: k })),
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
    if (ex && ex.src === 2) return 'hold';   // exercice maison : on note seulement la durée de chaque série
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
    hold: { fields: [], metrics: ['hold'] },
  };
  const CFIELD = {
    dist: { label: T('Distance'), ph: 'km' }, incl: { label: T('Pente'), ph: '%' }, lvl: { label: T('Niveau'), ph: T('niv.') },
    rounds: { label: T('Tours'), ph: T('tours') }, kcal: { label: T('Calories'), ph: 'kcal' },
  };
  function fmtDur(sec) {
    const m = Math.floor(sec / 60); const s2 = Math.round(sec % 60);
    if (m === 0) return s2 + ' s';
    if (m >= 60) return Math.floor(m / 60) + ' h ' + pad2(m % 60);
    return s2 ? m + ' min ' + pad2(s2) : m + ' min';
  }
  const speedOf = (e) => (e.c === 1 && e.dist > 0 && e.dur > 0 ? e.dist / (e.dur / 3600) : null);
  /* Lest d'une série au poids du corps : « PDC », « PDC + 10 kg », « PDC − 20 kg ». */
  const bwText = (x) => T('PDC') + (fin(x) && x ? (x > 0 ? ' + ' : ' − ') + fmtNum(Math.abs(x)) + ' kg' : '');
  function entryText(e) {
    if (e.c !== 1 && e.bw) return bwText(e.x) + T(' × ') + fmtNum(e.r);
    if (e.c !== 1) return fmtNum(e.w) + T(' kg × ') + fmtNum(e.r);
    const kind = cardioKind(S.byId.get(e.exerciseId)) || 'other';
    const out = [fmtDur(e.dur)];
    if (e.dist > 0) out.push(fmtNum(e.dist) + ' km');
    const sp = speedOf(e);
    if (sp && kind === 'row') { const p = e.dur / (e.dist * 2); out.push(Math.floor(p / 60) + ':' + pad2(Math.round(p % 60)) + ' /500 m'); } else if (sp) out.push(fmtNum(Math.round(sp * 10) / 10) + ' km/h');
    if (fin(e.incl)) out.push(T('pente ') + fmtNum(e.incl) + ' %');
    if (fin(e.lvl)) out.push(T('niveau ') + fmtNum(e.lvl));
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
      h('label', { class: 'cf dur' }, h('span', { text: T('Durée') }),
        h('div', { class: 'durin' }, mk('min', 'min', T('Durée : minutes'), 'numeric'), h('span', { text: ':' }), mk('sec', 's', T('Durée : secondes'), 'numeric'))),
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

  /* ----- poids du corps (PDC) -----
     Le poids du corps se règle dans Réglages. Une série au poids du corps enregistre le poids total
     soulevé (poids du corps + lest) : les graphiques et les totaux restent justes même si ton poids change. */
  const bwKg = () => (fin(S.settings.bw) && S.settings.bw > 0 ? S.settings.bw : 0);
  async function askBodyWeight() {
    const v = await promptDialog(T('Ton poids du corps'), T('Poids du corps en kg (modifiable dans Réglages)'), bwKg() ? fmtIn(bwKg()) : '', 6, 'decimal');
    if (v == null) return false;
    const n = calcEval(v);
    if (!(n > 0 && n < 400)) { toast(T('Poids du corps : un nombre en kilos.')); return false; }
    S.settings.bw = Math.round(n * 10) / 10;
    await saveUser();
    return true;
  }
  /* Champ du poids d'une série. Au poids du corps : un bouton « + » ou « − » (lest ajouté, ou poids
     retiré par une machine d'assistance) suivi du lest en kg ; vide = poids du corps seul. */
  function weightField(row, label, onInput) {
    const inp = calcInput({ 'aria-label': label });
    inp.value = row.w || '';
    const sign = h('button', { type: 'button', class: 'sgn' });
    const box = h('div', { class: 'wbox' }, sign, inp);
    const paint = () => {
      if (inp.value !== String(row.w || '')) inp.value = row.w || '';
      box.classList.toggle('bw', !!row.bw);
      sign.hidden = !row.bw;
      sign.textContent = row.neg ? '−' : '+';
      sign.setAttribute('aria-label', row.neg ? T('Poids retiré (assistance). Toucher pour ajouter du lest.') : T('Lest ajouté. Toucher pour retirer du poids (assistance).'));
      inp.placeholder = row.bw ? T('lest') : 'kg';
    };
    sign.addEventListener('pointerdown', (e) => e.preventDefault());
    sign.addEventListener('click', () => { row.neg = !row.neg; paint(); onInput(); });
    inp.addEventListener('input', () => {
      // Au poids du corps, un signe tapé au début du champ règle le bouton + / −.
      if (row.bw && /^\s*[-−–+]/.test(inp.value)) {
        row.neg = !/^\s*\+/.test(inp.value);
        inp.value = inp.value.replace(/^\s*[-−–+]\s*/, '');
        row.w = inp.value;
        paint();
      }
      row.w = inp.value; inp.classList.remove('invalid'); onInput();
    });
    paint();
    box.inp = inp; box.paint = paint;
    return box;
  }
  /* Case « PDC » (poids du corps) d'une série ; cochée, elle affiche le total soulevé. */
  function bwCheck(row, onChange, long) {
    const cb = h('input', { type: 'checkbox', 'aria-label': T('Poids du corps') });
    cb.checked = !!row.bw;
    const txt = h('span');
    const paint = () => {
      const r = row.bw ? readWeight(row, row.base) : null;
      txt.textContent = (long ? T('Poids du corps') : T('PDC')) + (r && r.ok ? ' · ' + fmtNum(r.vals.w) + ' kg' : !long || !bwKg() ? '' : ' · ' + fmtNum(bwKg()) + ' kg');
    };
    cb.addEventListener('change', async () => {
      if (cb.checked && !bwKg() && !row.base) { const ok = await askBodyWeight(); if (!ok) { cb.checked = false; return; } }
      // Changer de mode vide le champ : une charge en kg n'est pas un lest, et inversement.
      row.bw = cb.checked; row.neg = false; row.w = '';
      paint(); onChange();
    });
    paint();
    const lab = h('label', { class: 'bwcheck', title: T('Poids du corps') }, cb, txt);
    lab.paint = paint;
    return lab;
  }
  /* Lit le poids d'une série. base : poids du corps à utiliser (celui de l'époque pour une série modifiée). */
  function readWeight(row, base) {
    const raw = String(row.w == null ? '' : row.w).trim();
    if (!row.bw) { const w = calcEval(raw); return Number.isFinite(w) && w > 0 ? { ok: true, vals: { w } } : { ok: false }; }
    const b = base || bwKg();
    if (!b) return { ok: false, noBw: true };
    const amt = raw ? calcEval(raw) : 0;
    if (!Number.isFinite(amt)) return { ok: false };
    const x = Math.round((row.neg ? -1 : 1) * amt * 100) / 100;
    const w = Math.round((b + x) * 100) / 100;
    return w > 0 ? { ok: true, vals: { w, bw: 1, x } } : { ok: false };
  }
  /* Valeurs de saisie (texte) à partir d'une série enregistrée ou prévue. */
  function rowVals(src) {
    if (!src) return null;
    if (src.bw) {
      const x = fin(src.x) ? src.x : fin(src.w) && src.c === undefined && src.x === undefined ? src.w : 0;
      return { w: x ? fmtIn(Math.abs(x)) : '', r: fin(src.r) ? String(src.r) : '', bw: true, neg: x < 0 };
    }
    return { w: fin(src.w) ? fmtIn(src.w) : '', r: fin(src.r) ? String(src.r) : '' };
  }

  /* ----- glisser de droite à gauche pour supprimer ----- */
  function swipeable(content, onDelete, label) {
    const del = h('button', { type: 'button', class: 'swipe-del', 'aria-label': label || T('Supprimer') }, icon('trash'));
    const wrap = h('div', { class: 'swipe' }, del, content);
    content.classList.add('swipe-c');
    let sx = 0; let sy = 0; let dx = 0; let mode = null; let open = false; let pid = null; let swiped = false;
    // 0.8.5 : la poubelle rouge n'est visible que pendant le glissement (au repos, ses bords dépassaient
    // des coins arrondis : fin trait rouge sous les lignes).
    let hideT = 0;
    const setX = (x, anim) => {
      content.style.transition = anim ? 'transform .18s ease' : 'none'; content.style.transform = x ? 'translateX(' + x + 'px)' : '';
      clearTimeout(hideT);
      if (x) wrap.classList.add('moving');
      else if (anim) hideT = setTimeout(() => wrap.classList.remove('moving'), 200);
      else wrap.classList.remove('moving');
    };
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
      setTimeout(() => {
        scrim.remove();
        if (!document.querySelector('.sheet-scrim')) document.documentElement.classList.remove('sheet-open');
        if (typeof after === 'function') after();
      }, 180);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(onCancel); };
    let onCancel = null;
    build(box, close, (fn) => { onCancel = fn; });
    scrim.addEventListener('click', (e) => { if (e.target === scrim) close(onCancel); });
    scrim.append(box);
    document.body.append(scrim);
    document.addEventListener('keydown', onKey);
    // La page derrière ne défile pas tant que la fenêtre est ouverte.
    document.documentElement.classList.add('sheet-open');
    scrim.addEventListener('touchmove', (e) => { if (e.target === scrim) e.preventDefault(); }, { passive: false });
    // Glisser la fenêtre vers le bas (depuis le haut de sa liste) la ferme.
    let y0 = null; let dy = 0; let t0 = 0; let drag = false;
    box.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) { y0 = null; return; }
      y0 = e.touches[0].clientY; t0 = Date.now(); dy = 0; drag = false;
    }, { passive: true });
    box.addEventListener('touchmove', (e) => {
      if (y0 == null) return;
      const d = e.touches[0].clientY - y0;
      if (!drag && d > 6 && box.scrollTop <= 0) { drag = true; box.style.transition = 'none'; }
      if (drag) {
        e.preventDefault();
        dy = Math.max(0, d);
        box.style.transform = 'translateY(' + dy + 'px)';
        scrim.style.backgroundColor = 'rgba(58, 51, 71, ' + (0.38 * Math.max(0, 1 - dy / 400)).toFixed(3) + ')';
      } else if (box.scrollHeight <= box.clientHeight + 1) e.preventDefault();   // rien à faire défiler dans la fenêtre
    }, { passive: false });
    const endDrag = () => {
      if (y0 == null) return;
      y0 = null;
      if (!drag) return;
      drag = false;
      const v = dy / Math.max(1, Date.now() - t0);
      box.style.transition = 'transform .2s ease';
      if (dy > 90 || (dy > 30 && v > 0.5)) { box.style.transform = 'translateY(105%)'; close(onCancel); } else { box.style.transform = ''; scrim.style.backgroundColor = ''; }
    };
    box.addEventListener('touchend', endDrag);
    box.addEventListener('touchcancel', endDrag);
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
      box.append(h('button', { type: 'button', class: 'btn ghost wide bs-cancel', text: T('Annuler'), onclick: () => close() }));
    });
  }
  /* Choix des groupes secondaires : une ligne compacte qui ouvre une liste à cocher. */
  function groupsField(get, set, getMain, id) {
    const btn = h('button', { type: 'button', class: 'field left gfield', id, 'aria-haspopup': 'dialog' });
    const paint = () => {
      const v = get().filter((x) => GROUPS.has(x));
      btn.textContent = '';
      btn.append(h('span', { class: v.length ? 'v' : 'ph', text: v.length ? v.map((x) => GROUPS.get(x).label).join(', ') : T('Aucun') }), icon('down'));
    };
    btn.addEventListener('click', () => {
      const sel = new Set(get());
      const main = getMain();
      bottomSheet((box, close, onCancel) => {
        const done = () => close(() => { set(GROUP_LIST.map((g) => g.id).filter((x) => sel.has(x) && x !== main)); paint(); });
        onCancel(() => { set(GROUP_LIST.map((g) => g.id).filter((x) => sel.has(x) && x !== main)); paint(); });
        box.append(h('h2', { class: 'bs-title', text: T('Groupes secondaires') }));
        const list = h('div', { class: 'gs-list' });
        for (const g of GROUP_LIST) {
          const isMain = g.id === main;
          const cb = h('input', { type: 'checkbox', disabled: isMain });
          cb.checked = sel.has(g.id) && !isMain;
          cb.addEventListener('change', () => { if (cb.checked) sel.add(g.id); else sel.delete(g.id); });
          list.append(h('label', { class: 'gs-row' + (g.sub ? ' sub' : '') + (isMain ? ' main' : '') },
            cb, h('span', { class: 'dot', style: { '--c': g.color } }), h('span', { class: 'gl', text: g.label }), isMain ? h('span', { class: 'gm', text: T('principal') }) : null));
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
  function promptDialog(title, label, value, max, mode) {
    return new Promise((resolve) => {
      let close = null;
      const inp = h('input', { class: 'field left', type: 'text', maxlength: String(max || 40), id: 'pr-in', autocomplete: 'off', enterkeyhint: 'done', inputmode: mode || null });
      inp.value = value || '';
      const ok = () => { const v = inp.value.trim(); close(); resolve(v || null); };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
      const box = h('div', { class: 'dialog sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' },
        h('h2', { id: 'dlg-t', text: title }), h('label', { class: 'lbl', for: 'pr-in', text: label }), inp,
        h('div', { class: 'acts' }, h('button', { type: 'button', class: 'btn ghost', text: T('Annuler'), onclick: () => { close(); resolve(null); } }),
          h('button', { type: 'button', class: 'btn primary', text: T('Valider'), onclick: ok })));
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
      const noBtn = h('button', { type: 'button', class: 'btn ghost', text: no || T('Non'), onclick: () => done(false) });
      const box = h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' },
        h('h2', { id: 'dlg-t', text: title }), text ? h('p', { text }) : null,
        h('div', { class: 'acts' }, noBtn, h('button', { type: 'button', class: 'btn ' + (safe ? 'primary' : 'danger'), text: yes || T('Oui'), onclick: () => done(true) })));
      close = openModal(box, () => resolve(false));
      noBtn.focus();
    });
  }
  function starBtn(id, onChange) {
    const b = h('button', { type: 'button', class: 'iconbtn', 'aria-label': T('Favori'), 'aria-pressed': String(S.favs.has(id)) }, icon('star'));
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (S.favs.has(id)) S.favs.delete(id); else S.favs.add(id);
      b.setAttribute('aria-pressed', String(S.favs.has(id)));
      saveUser();
      if (onChange) onChange();
    });
    return b;
  }
  const closeBtn = () => h('button', { type: 'button', class: 'iconbtn', 'aria-label': T('Fermer'), onclick: goHome }, icon('close'));
  const backBtn = () => h('button', { type: 'button', class: 'iconbtn', 'aria-label': T('Retour'), onclick: goBack }, icon('left'));
  const setText = (w, r) => fmtNum(w) + T(' kg × ') + fmtNum(r);
  const tag = (id, main) => { const g = GROUPS.get(id); return g ? h('span', { class: 'tag' + (main ? ' main' : ''), style: { '--c': g.color }, text: g.label }) : null; };

  /* ---------- navigation : une pile de pages, chaque page garde son état ----------
     La flèche retour et le balayage depuis le bord gauche utilisent l'historique du
     navigateur : on revient sur la page précédente telle qu'on l'avait laissée. */
  const app = () => document.getElementById('app');
  const VIEWS = () => ({ home: viewHome, library: viewLibrary, exercise: viewExercise, history: viewHistory, calendar: viewCalendar, session: viewSession, seances: viewSeances, plan: viewPlan, settings: viewSettings, exhistory: viewExHistory });
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
    if (!document.querySelector('.sheet-scrim')) document.documentElement.classList.remove('sheet-open');   // sécurité : jamais de page bloquée
    const rootEl = app();
    clearGhosts();
    let ghost = null;
    if (anim && !reduceMotion() && rootEl.firstElementChild) {
      const old = rootEl.firstElementChild;
      const inner = h('div', { class: 'ghost-in' });
      inner.style.transform = 'translateY(' + (-window.scrollY) + 'px)';
      old.remove();
      inner.append(old);
      ghost = h('div', { class: 'pg-ghost ' + (anim === 'fwd' || anim === 'fade' ? 'under' : 'over'), 'aria-hidden': 'true' }, inner);
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
    // Barre du bas : posée une seule fois hors de la page, elle ne bouge pas pendant les transitions.
    syncNav(entry);
    if (S.planDraft && !S.stack.some((e) => e.view === 'plan')) S.planDraft = null;
    const y = (entry.ui && entry.ui.scroll) || 0;
    window.scrollTo(0, y);
    if (y) requestAnimationFrame(() => window.scrollTo(0, y));
    lastScrollY = window.scrollY;
    if (ghost) {
      // Comme sur iPhone : la nouvelle page glisse depuis la droite pendant que l'ancienne recule un peu
      // et s'assombrit ; au retour, c'est l'inverse. Changer d'onglet : simple fondu.
      const done = () => { if (ghost) { ghost.remove(); ghost = null; } root.classList.remove('enter', 'emerge', 'fadein', 'rise'); };
      if (anim === 'fwd') { root.classList.add('enter'); ghost.classList.add('recede'); root.addEventListener('animationend', done, { once: true }); }
      else if (anim === 'fade') { root.classList.add('fadein'); ghost.classList.add('fadeout'); root.addEventListener('animationend', done, { once: true }); }
      else { ghost.classList.add(anim === 'close' ? 'leave-down' : 'leave-right'); root.classList.add(anim === 'close' ? 'rise' : 'emerge'); ghost.addEventListener('animationend', done, { once: true }); }
      setTimeout(done, 800);
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
    const stay = h('button', { type: 'button', class: 'btn ghost', text: T('Rester'), onclick: () => close() });
    const discard = () => { if (g.discard) g.discard(); S.guard = null; proceed(); };
    const box = h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' },
      h('h2', { id: 'dlg-t', text: g.title || T('Enregistrer ta saisie ?') }),
      h('p', { text: g.text || T('Tu as rempli une série sans la valider.') }),
      h('div', { class: 'acts col' },
        h('button', { type: 'button', class: 'btn primary', text: g.yes || T('Enregistrer'), onclick: async () => {
          close();
          const miss = g.missing ? g.missing() : [];
          if (miss.length) { if ((await missingDialog(miss, true)) === 'quit') discard(); return; }
          if (await g.save()) { S.guard = null; proceed(); }
        } }),
        h('button', { type: 'button', class: 'btn ghost warn', text: g.no || T('Ne pas enregistrer'), onclick: () => { close(); discard(); } }),
        stay));
    close = openModal(box);
    stay.focus();
  }
  /* Informations manquantes : revenir compléter, ou quitter sans enregistrer. */
  function missingDialog(miss, withQuit) {
    return new Promise((resolve) => {
      let close = null;
      const back = h('button', { type: 'button', class: 'btn primary', text: T('Compléter la séance'), onclick: () => { close(); resolve('stay'); } });
      const box = h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' },
        h('h2', { id: 'dlg-t', text: T('Impossible de valider') }),
        h('p', { text: T('Il manque {0} pour enregistrer cette séance.', miss.map((x) => T(x)).join(' ' + T('et') + ' ')) }),
        h('div', { class: 'acts col' }, back,
          withQuit ? h('button', { type: 'button', class: 'btn ghost warn', text: T('Quitter sans enregistrer'), onclick: () => { close(); resolve('quit'); } }) : null));
      close = openModal(box, () => resolve('stay'));
      back.focus();
    });
  }
  const leave = (fn) => { if (guarded()) askLeave(fn); else fn(); };
  function goNow(view, arg, anim) {
    snapshot();
    const entry = { view, arg: arg == null ? null : arg, ui: null };
    S.stack.push(entry);
    history.pushState({ i: S.stack.length - 1, view, arg: entry.arg }, '');
    render(entry, anim || 'fwd');
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

  /* ---------- barre du bas (0.8.0) ----------
     Accueil, Exercices, le gros « + » (noter une série), Séances, Calendrier. Changer d'onglet remplace
     la page en cours (la flèche « retour » ramène toujours à l'accueil). */
  const TAB_VIEWS = new Set(['home', 'library', 'seances', 'calendar']);
  const isTabEntry = (e) => !!e && TAB_VIEWS.has(e.view) && !(e.view === 'library' && e.arg && e.arg.pick);
  function tabGo(view) {
    const top = S.stack[S.stack.length - 1];
    if (top && top.view === view && !(top.arg && top.arg.pick)) {
      // Toucher l'onglet où l'on est : retour à sa page de base (recherche, filtres et groupe effacés).
      if (view === 'home') { window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' }); return; }
      if (view === 'calendar') S.cal = null;
      if (view === 'library') S.libFilters = null;
      leave(() => replaceNow(view, null, 'fade'));
      return;
    }
    if (view === 'home') { leave(() => { S.navAnim = 'fade'; const n = S.stack.length - 1; if (n > 0) history.go(-n); else render(S.stack[0], 'fade'); }); return; }
    if (view === 'calendar') S.cal = null;
    leave(() => { if (!top || top.view === 'home') goNow(view, null, 'fade'); else { snapshot(); replaceNow(view, null, 'fade'); } });
  }
  /* Exercice à faire maintenant dans la séance du jour : le premier de la liste qui n'a pas encore
     de série, ou dont il reste des séries prévues. */
  function currentTodo(key) {
    const k = key || todayKey();
    const d = S.days[k];
    if (!d || d.hidden) return null;
    const ents = dayEntries(k);
    for (const id of dayFlow(k)) {
      const n = ents.filter((e) => e.exerciseId === id).length;
      const plan = d.plan[id];
      if (!n || (plan && n < plan.length)) return id;
    }
    return null;
  }
  /* Le « + » : l'exercice en cours de la séance du jour, sinon la bibliothèque. */
  /* Le « + » : créer une séance type. */
  function plusGo() { createPlan(); }
  let navEl = null;
  function navPill() {
    const it = (view, ic, label) => h('button', { type: 'button', class: 'nv', 'data-view': view, 'aria-label': label, onclick: () => tabGo(view) }, icon(ic));
    return h('nav', { class: 'navpill', 'aria-label': T('Navigation principale') },
      it('home', 'home', T('Accueil')), it('library', 'book', T('Exercices')),
      h('button', { type: 'button', class: 'nv plus', 'aria-label': T('Créer une séance'), onclick: plusGo }, icon('plus')),
      it('seances', 'list', T('Séances')), it('calendar', 'cal', T('Calendrier')));
  }
  function syncNav(entry) {
    const tabbed = isTabEntry(entry);
    app().classList.toggle('has-nav', tabbed);
    if (!navEl) { navEl = navPill(); document.body.append(navEl); }
    navEl.classList.toggle('off', !tabbed);
    navEl.inert = !tabbed;
    navEl.querySelectorAll('.nv[data-view]').forEach((b) => {
      const on = tabbed && b.dataset.view === entry.view;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }
  /* Logo + « WorkLog » (Log en citron). */
  const lockup = () => h('div', { class: 'wordmark' }, h('img', { src: 'icons/logo.svg', alt: '', width: '36', height: '36' }),
    h('h1', { class: 'wm' }, 'Work', h('span', { text: 'Log' })));
  /* Anneau de progression (exercices faits / prévus). */
  function ring(k, n) {
    const size = 92; const sw = 10; const r = (size - sw) / 2; const c = 2 * Math.PI * r;
    const frac = n ? Math.min(1, k / n) : 0;
    return sv('svg', { class: 'ring', width: String(size), height: String(size), viewBox: '0 0 ' + size + ' ' + size, role: 'img', 'aria-label': T('{0} exercices faits sur {1}', k, n) },
      sv('circle', { cx: size / 2, cy: size / 2, r, class: 'ring-bg', 'stroke-width': sw }),
      sv('circle', { cx: size / 2, cy: size / 2, r, class: 'ring-fg', 'stroke-width': sw, 'stroke-dasharray': (c * frac).toFixed(1) + ' ' + c.toFixed(1), transform: 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')' }),
      sv('text', { x: '50%', y: '52%', 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'ring-t' }, k + '/' + n));
  }
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

  /* ---------- matériel (0.8.1) ----------
     La base ne dit pas avec quoi se fait un exercice : on le déduit de son nom anglais. */
  const EQUIP = [
    ['pdc', 'Poids du corps'], ['halteres', 'Haltères'], ['barre', 'Barre'], ['ez', 'Barre EZ'], ['kettlebell', 'Kettlebell'],
    ['machine', 'Machine'], ['poulie', 'Poulie'], ['elastique', 'Élastique'], ['smith', 'Smith machine'], ['ballon', 'Médecine-ball, swiss ball'],
    ['trx', 'TRX, anneaux, sangles'], ['autre', 'Autre matériel'],
  ];
  const EQ_RULES = [
    ['smith', /\bsmith\b/],
    ['kettlebell', /kettlebell|\bkb\b/],
    ['halteres', /dumbbell|\bdb\b/],
    ['ez', /\bez\b|ez[- ]?bar|ez[- ]?curl|cambered/],
    ['trx', /suspend|suspension|\btrx\b|\bstraps?\b|\brings?\b|gymnastic ring/],
    ['elastique', /\bbands?\b|\bbanded\b|resistance band|elastic|mini band/],
    ['poulie', /cable|pulley|rope attachment|pull[- ]?down|push[- ]?down|crossover|face pull|\bv[- ]bar\b/],
    ['barre', /barbell|trap bar|hex bar|landmine|\bclean\b|\bsnatch\b|\bjerk\b|olympic bar|\bthruster\b|good morning|deadlift|\brack\b/],
    ['machine', /lever|leverage|machine|\bsled\b|leg press|hack squat|leg extension|leg curl|calf press|pec deck|butterfly|assisted.*(?:pull|chin|dip)|seated row|chest press|hip adduction|hip abduction|t[- ]bar|glute ham|hyperextension|roman chair|preacher/],
    ['ballon', /medicine ball|med ball|weighted ball|stability ball|swiss ball|exercise ball|bosu|slam ball|\bball\b/],
    ['autre', /\btire\b|battling rope|rope climb|\broller\b|ab wheel|sandbag|\bplate\b|\bclub\b|\bmace\b|balance board|\bstep\b|\bbox\b|towel|\bbench\b(?!.*press)|\bchair\b|\bwall\b/],
  ];
  function eqOf(ex) {
    if (ex._eq) return ex._eq;
    const n = ex.key || skey(ex.name || '');
    let r = 'pdc';
    for (const [k, re] of EQ_RULES) if (re.test(n)) { r = k; break; }
    // banc, mur, chaise : l'exercice reste au poids du corps
    if (r === 'autre' && /\bbench\b|\bchair\b|\bwall\b|\bstep\b|\bbox\b|towel/.test(n) && !/\btire\b|rope|roller|wheel|sandbag|plate|club|mace|board/.test(n)) r = 'pdc';
    ex._eq = r;
    return r;
  }
  /* Unilatéral : un bras ou une jambe à la fois (exercices alternés compris), d'après le nom. */
  const UNI_RE = /one[- ]arm|one[- ]leg|one[- ]hand|single[- ]?(arm|leg|hand)|unilateral|alternat|\blunges?\b|split squat|bulgarian|step[- ]?ups?\b|pistol|\bone[- ]side/;
  const isUni = (ex) => UNI_RE.test(ex.key || '');
  /* À la maison : sans matériel de salle (poids du corps, élastiques, kettlebell). */
  const isHome = (ex) => ['pdc', 'elastique', 'kettlebell'].includes(eqOf(ex));
  const eqLabel = (k) => T((EQUIP.find((x) => x[0] === k) || EQUIP[EQUIP.length - 1])[1]);
  /* « Poids du corps » proposé seulement là où il a un sens (pompes, tractions, dips, gainage…). */
  const canBW = (ex) => !cardioKind(ex) && (eqOf(ex) === 'pdc' || /weighted (pull|chin|dip)|\bdips?\b|pull[- ]?ups?|chin[- ]?ups?|push[- ]?ups?|muscle[- ]?ups?/.test(ex.key || ''));

  function stepOf() { return 2.5; }   // − / + de l'accueil : 2,5 kg par appui
  const r2 = (v) => Math.round(v * 100) / 100;
  /* Dernière série enregistrée d'un exercice. */
  function lastOf(id) {
    let best = null;
    for (const e of S.entries) if (e.exerciseId === id && (!best || e.ts > best.ts || (e.ts === best.ts && (e.created || 0) > (best.created || 0)))) best = e;
    return best;
  }
  /* Enregistre une série de musculation et l'ajoute à la journée. vals : { w, r } ou { w, r, bw: 1, x }. */
  async function saveSet(ex, vals, ts) {
    const now = Date.now();
    const e = Object.assign({ id: uid(), exerciseId: ex.id, name: ex.name, ts: ts || now, created: now }, vals);
    S.entries.push(e);
    const k = dayKey(e.ts);
    if (S.days[k] && !S.days[k].order.includes(ex.id)) S.days[k].order.push(ex.id);
    await saveUser();
    return e;
  }
  /* Valeurs de départ d'une série : la série prévue, sinon la dernière faite, sinon 20 kg × 10. */
  function startVals(ex, planned) {
    if (planned && (planned.w !== '' || planned.r !== '')) {
      if (planned.bw) return { w: fin(planned.w) ? planned.w : 0, r: fin(planned.r) ? planned.r : 10, bw: true };
      if (fin(planned.w) && planned.w > 0) return { w: planned.w, r: fin(planned.r) && planned.r > 0 ? planned.r : 10, bw: false };
    }
    const l = lastOf(ex.id);
    if (l && l.c !== 1) return l.bw ? { w: fin(l.x) ? l.x : 0, r: l.r, bw: true } : { w: l.w, r: l.r, bw: false };
    return { w: 20, r: 10, bw: false };
  }
  const setLabel = (v) => (v.bw ? bwText(v.w) : fmtNum(v.w) + ' kg') + T(' × ') + fmtNum(v.r);
  function valsToEntry(v) {
    if (!v.bw) return v.w > 0 && v.r > 0 ? { ok: true, vals: { w: r2(v.w), r: v.r } } : { ok: false };
    const b = bwKg();
    if (!b) return { ok: false, noBw: true };
    const w = r2(b + v.w);
    return w > 0 && v.r > 0 ? { ok: true, vals: { w, r: v.r, bw: 1, x: r2(v.w) } } : { ok: false };
  }

  /* ---------- accueil ---------- */
  function lastEntry() {
    let best = null;
    for (const e of S.entries) if (!best || (e.created || e.ts) > (best.created || best.ts)) best = e;
    return best;
  }
  function viewHome() {
    materialize(todayKey());   // séance programmée pour aujourd'hui
    const wrap = h('main', { class: 'home' });
    wrap.append(h('header', { class: 'bar' }, lockup(),
      h('button', { type: 'button', class: 'iconbtn', 'aria-label': T('Réglages'), onclick: () => go('settings') }, icon('gear'))));
    const again = () => { snapshot(); render(S.stack[S.stack.length - 1]); };

    // 1. Séance du jour (anneau de progression, « Reprendre »)
    const tk = todayKey();
    const tOrder = dayOrder(tk);
    if (S.days[tk] && !S.days[tk].hidden && tOrder.length) {
      const done = new Set(dayEntries(tk).map((e) => e.exerciseId));
      const k = tOrder.filter((id) => done.has(id)).length;
      const s = S.sessions[tk];
      // 0.8.3 : plusieurs séances : le titre est celle du haut, les autres suivent (« puis … »).
      const gs = dayGroups(tk).filter((g) => !g.loose);
      const g0 = gs.length > 1 ? gs[0] : null;
      const hg = g0 ? GROUPS.get(g0.main) : s && GROUPS.get(s.main);
      const card = h('section', { class: 'hero2', style: hg ? { '--c': hg.color } : null },
        h('div', { class: 'hero2-top' },
          h('div', { class: 'hero2-txt' }, h('span', { class: 'kicker acc', text: T('Séance du jour') }),
            h('strong', { class: 'hero2-title', text: g0 ? g0.title : s ? sessionTitle(s) : plural(tOrder.length, 'exercice prévu', 'exercices prévus') }),
            g0 ? h('span', { class: 'hero2-more', text: T('puis {0}', gs.slice(1).map((g) => g.title).join(' · ')) }) : null),
          ring(k, tOrder.length)),
        h('button', { type: 'button', class: 'btn acc wide', onclick: () => go('session', tk) }, k ? T('Reprendre') : T('Commencer')));
      // Glisser vers la gauche : retirer la séance prévue de l'accueil (les séries déjà faites restent).
      const sw = swipeable(card, () => clearPlanned(tk, again, true), T('Retirer la séance du jour de l’accueil'));
      sw.classList.add('today-swipe');
      wrap.append(sw);
    } else {
      wrap.append(h('section', { class: 'hero2' },
        h('span', { class: 'kicker acc', text: T('Aujourd’hui') }),
        h('strong', { class: 'hero2-title', text: T('Pas de séance prévue') }),
        h('p', { class: 'hero2-sub', text: T('Lance une de tes séances, ou choisis un exercice et note tes séries.') }),
        h('div', { class: 'hero2-btns' },
          h('button', { type: 'button', class: 'btn acc', onclick: () => tabGo('seances') }, T('Mes séances')),
          h('button', { type: 'button', class: 'btn onvio', onclick: () => tabGo('library') }, T('Un exercice')))));
    }

    // 2. À faire maintenant : noter la série sans quitter l'accueil
    const curId = currentTodo(tk);
    const last = lastEntry();
    const qid = curId || (last ? last.exerciseId : null);
    if (qid) wrap.append(quickCard(getEx(qid, last && last.exerciseId === qid ? last.name : null), !!curId, again));

    // 3. Cette semaine : séries par jour
    wrap.append(weekCard());
    return wrap;
  }
  /* Carte « À faire maintenant » / « Reprendre » : − / + sur le poids et les répétitions, puis « Valider ». */
  function quickCard(ex, isTodo, after) {
    const tk = todayKey();
    const done = dayEntries(tk).filter((e) => e.exerciseId === ex.id).length;
    const plan = isTodo && S.days[tk] ? S.days[tk].plan[ex.id] : null;
    const kind = cardioKind(ex);
    const card = h('section', { class: 'quick' });
    const open = () => go('exercise', isTodo ? { id: ex.id, day: tk } : ex.id);
    card.append(h('button', { type: 'button', class: 'quick-head', onclick: open }, thumb(ex),
      h('span', { class: 'qh-txt' }, h('span', { class: 'kicker acc', text: isTodo ? T('À faire maintenant') : T('Reprendre') }),
        h('strong', { text: dn(ex) }), h('span', { class: 'qh-sub', text: kind && !(plan && plan.length) ? '' : T('Série {0}', done + 1) + (plan && plan.length ? ' / ' + plan.length : '') })),
      icon('right')));
    const hsLine = () => {
      const hs = S.homeSaved; S.homeSaved = null;
      return hs && S.entries.some((x) => x.id === hs.id) ? h('div', { class: 'saved-line', role: 'status' }, icon('check'), h('span', { text: hs.text }),
        h('button', { type: 'button', class: 'undo', text: T('Annuler'), onclick: () => { S.entries = S.entries.filter((x) => x.id !== hs.id); saveUser(); after(); } })) : null;
    };
    if (kind || ex.missing) {
      const q = isTodo && !ex.missing ? plannedNext(tk, ex.id) : null;
      if (q) {
        card.append(h('p', { class: 'qh-plan', text: T('Prévu : {0}', q.text) }),
          h('button', { type: 'button', class: 'btn acc wide', onclick: onceClick(async () => {
            const e = await saveSet(ex, q.vals, Date.now());
            S.homeSaved = { id: e.id, text: T('Série enregistrée · {0}', entryText(e)) };
            after();
          }) }, icon('check'), T('Valider la série')),
          h('button', { type: 'button', class: 'btn ghost wide', onclick: open }, T('Ouvrir l’exercice')));
      } else card.append(h('button', { type: 'button', class: 'btn acc wide', onclick: open }, T('Ouvrir l’exercice')));
      const l = hsLine(); if (l) card.append(l);
      return card;
    }
    const v = startVals(ex, plan ? plan[done] : null);
    const step = stepOf(ex);
    const out = {};
    const stepper = (key, label, inc, fmt) => {
      // Le chiffre se touche pour le taper au clavier (le poids accepte un calcul : 20+2,5+2,5).
      const val = h('button', { type: 'button', class: 'qs-v', 'aria-label': T('{0} : toucher pour taper une valeur', label) });
      const paint = () => { val.textContent = fmt(v[key]); };
      val.addEventListener('click', () => {
        const inp = key === 'w' ? calcInput({ 'aria-label': label }) : h('input', { class: 'field', type: 'text', inputmode: 'numeric', autocomplete: 'off', enterkeyhint: 'done', 'aria-label': label });
        inp.classList.add('qs-in');
        inp.value = key === 'w' && v.bw ? (v.w ? (v.w < 0 ? '-' : '+') + fmtIn(Math.abs(v.w)) : '') : fmtIn(v[key]);
        val.replaceWith(inp);
        inp.focus();
        try { inp.select(); } catch (e) { /* ignoré */ }
        let done = false;
        const finish = () => {
          if (done) return; done = true;
          if (key === 'w') finishCalc(inp);
          const t = inp.value.trim();
          const n = key === 'w' ? (t === '' && v.bw ? 0 : calcEval(t)) : parseNum(t);
          const ok = Number.isFinite(n) && (key === 'r' ? Number.isInteger(n) && n > 0 : v.bw || n > 0);
          if (ok) v[key] = r2(n);
          inp.replaceWith(val); paint();
        };
        inp.addEventListener('blur', () => setTimeout(finish, 0));
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
      });
      const btn = (d, ic, l) => h('button', { type: 'button', class: 'qs-b', 'aria-label': l, onclick: () => {
        const nv = r2(v[key] + d * inc);
        if (key === 'r' ? nv >= 1 : (v.bw || nv > 0)) { v[key] = nv; paint(); }
      } }, icon(ic));
      paint(); out[key] = paint;
      return h('div', { class: 'qs' }, h('span', { class: 'kicker', text: label }), h('div', { class: 'qs-row' }, btn(-1, 'minus', T('Moins')), val, btn(1, 'plus', T('Plus'))));
    };
    card.append(h('div', { class: 'qs-wrap' },
      stepper('w', v.bw ? T('Lest (kg)') : T('Poids (kg)'), step, (x) => (v.bw ? (x > 0 ? '+' : x < 0 ? '−' : '') + fmtNum(Math.abs(x)) : fmtNum(x))),
      stepper('r', T('Répétitions'), 1, (x) => fmtNum(x))));
    card.append(h('button', { type: 'button', class: 'btn acc wide', onclick: onceClick(async () => {
      let r = valsToEntry(v);
      if (r.noBw) { if (!(await askBodyWeight())) return; r = valsToEntry(v); }
      if (!r.ok) { toast(T('Poids ou répétitions invalides.')); return; }
      const e = await saveSet(ex, r.vals);
      S.homeSaved = { id: e.id, text: T('Série enregistrée · {0}', entryText(e)) };   // confirmation dans la carte, après l'affichage
      after();
    }) }, icon('check'), T('Valider')));
    // Confirmation de la série tout juste validée, avec « Annuler » (dans la carte, rien ne flotte).
    const hs = S.homeSaved; S.homeSaved = null;
    if (hs && S.entries.some((x) => x.id === hs.id)) {
      card.append(h('div', { class: 'saved-line', role: 'status' }, icon('check'), h('span', { text: hs.text }),
        h('button', { type: 'button', class: 'undo', text: T('Annuler'), onclick: () => { S.entries = S.entries.filter((x) => x.id !== hs.id); saveUser(); after(); } })));
    }
    return card;
  }
  /* « Cette semaine » : une barre par jour (nombre de séries), aujourd'hui en citron. */
  function weekCard() {
    const tk = todayKey();
    const mon = new Date(mondayOf(tk));
    const keys = [0, 1, 2, 3, 4, 5, 6].map((i) => dayKey(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i).getTime()));
    const counts = keys.map((k) => dayEntries(k).length);
    const max = Math.max(1, ...counts);
    const days = counts.filter((n) => n > 0).length;
    const names = WD('narrow');
    return h('section', { class: 'week' },
      h('div', { class: 'week-head' }, h('span', { class: 'kicker', text: T('Cette semaine') }), h('span', { class: 'week-n' }, h('b', { text: String(days) }), ' ' + (days > 1 ? T('séances') : T('séance')))),
      h('div', { class: 'week-bars', role: 'img', 'aria-label': keys.map((k, i) => names[i] + ' ' + plural(counts[i], 'série', 'séries')).join(', ') },
        keys.map((k, i) => h('div', { class: 'wb' + (k === tk ? ' today' : '') + (counts[i] ? ' has' : '') },
          h('div', { class: 'wb-track' }, h('div', { class: 'wb-bar', style: { height: Math.max(8, Math.round(70 * counts[i] / max)) + 'px' } })),
          h('span', { class: 'wb-d', text: names[i].toUpperCase() })))));
  }
  async function shareFile(name, text, mime) {
    const file = new File([text], name, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      // Le fichier seul : un titre ou un texte serait partagé en plus, comme un second fichier texte « WorkLog ».
      try { await navigator.share({ files: [file] }); return true; } catch (e) { if (e && e.name === 'AbortError') return false; }
    }
    const url = URL.createObjectURL(file);
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  }

  /* ---------- fiche exercice ---------- */
  const RANGES = [
    { k: '2s', label: T('2 semaines'), short: T('2 sem.'), days: 14 },
    { k: '1m', label: T('1 mois'), short: T('1 m'), days: 30.44 },
    { k: '3m', label: T('3 mois'), short: T('3 m'), days: 91.3 },
    { k: '6m', label: T('6 mois'), short: T('6 m'), days: 182.6 },
  ];
  const fmtLest = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + fmtNum(Math.abs(x));
  /* Date et heure lisibles : « Aujourd'hui · 18:42 », sinon « mar. 24 nov. · 18:42 ». */
  const whenText = (t) => (dayKey(t) === todayKey() ? T('Aujourd’hui') : cap(fDayShort.format(t))) + ' · ' + fTime.format(t);

  /* Carte « Série n » de la fiche exercice (0.8.1) : poids et répétitions au clavier (le poids accepte
     un calcul), poids du corps si l'exercice s'y prête, date et heure, « Valider ».
     Dans une séance avec des séries prévues : une fois toutes faites, la saisie se ferme et
     WorkLog propose l'exercice suivant (« Une série en plus » reste possible). */
  function serieCard(ex, ctx, onSaved) {
    const dayK = ctx.day || todayKey();
    const fixedDay = ctx.day && ctx.day !== todayKey() ? ctx.day : null;
    const plannedAll = () => (ctx.day && S.days[dayK] && S.days[dayK].plan[ex.id] && S.days[dayK].plan[ex.id].length ? S.days[dayK].plan[ex.id] : null);
    const doneN = () => dayEntries(dayK).filter((e) => e.exerciseId === ex.id).length;
    const nextPlanned = () => { const p = plannedAll(); return p ? p[doneN()] || null : null; };
    const bwOk = canBW(ex);
    // 0.8.2 : la même carte pour le cardio et les exercices tenus (étirements, gainage) : la durée en grand.
    const kind = cardioKind(ex);
    const KF = kind && kind !== 'hold' ? CARDIO[kind].fields : [];
    const startK = (pl) => {
      const l0 = lastOf(ex.id);
      const l = l0 && l0.c === 1 ? l0 : null;
      const o = { dur: pl && fin(pl.dur) && pl.dur > 0 ? pl.dur : l && l.dur > 0 ? l.dur : kind === 'hold' ? 30 : 1200 };
      for (const k of KF) o[k] = l && fin(l[k]) ? l[k] : '';
      return o;
    };
    let v = kind ? startK(nextPlanned()) : startVals(ex, nextPlanned());
    if (!kind && v.bw && !bwOk) v = { w: 20, r: v.r, bw: false };
    let extra = 0;          // séries non prévues autorisées (« Une série en plus »)
    let dt = null;          // heure choisie ; null = maintenant
    const baseDt = () => (fixedDay ? keyDate(fixedDay).getTime() + 18 * 3600000 + doneN() * 120000 : null);
    dt = baseDt();
    let lastSaved = null;
    const card = h('section', { class: 'serie' });
    const title = h('h2', {});
    const sub = h('span', { class: 'serie-sub' });
    const plannedLine = h('p', { class: 'serie-plan' });
    const msg = h('p', { class: 'form-msg', role: 'alert' });
    // Les deux champs
    const wIn = calcInput({ 'aria-label': T('Poids (kg)') });
    wIn.classList.add('big-in');
    const rIn = h('input', { class: 'field big-in', type: 'text', inputmode: 'numeric', autocomplete: 'off', enterkeyhint: 'done', 'aria-label': T('Répétitions') });
    const wLab = h('span', { class: 'kicker' });
    const wUnit = h('span', { class: 'unit', text: 'kg' });
    const wPrev = h('span', { class: 'big-prev', 'aria-live': 'polite' });
    const box = (lab, inp, unit, prev) => h('label', { class: 'bigbox' }, lab, h('span', { class: 'bigrow' }, inp, unit), prev || null);
    // Champs du cardio et des exercices tenus
    const nIn = (label) => h('input', { class: 'field big-in', type: 'text', inputmode: 'numeric', autocomplete: 'off', enterkeyhint: 'done', 'aria-label': label });
    const mIn = kind ? nIn(kind === 'hold' ? T('Durée en secondes') : T('Durée : minutes')) : null;
    const sIn = kind && kind !== 'hold' ? nIn(T('Durée : secondes')) : null;
    const kIns = {};
    for (const k of KF) kIns[k] = h('input', { class: 'field', type: 'text', inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'done', placeholder: CFIELD[k].ph, 'aria-label': CFIELD[k].label });
    const kAll = () => [mIn, sIn].concat(KF.map((k) => kIns[k])).filter(Boolean);
    kAll().forEach((inp, i, a) => {
      inp.addEventListener('input', () => { msg.textContent = ''; });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (a[i + 1]) a[i + 1].focus(); else inp.blur(); } });
    });
    const fillK = () => {
      if (kind === 'hold') mIn.value = fmtIn(v.dur);
      else { mIn.value = String(Math.floor(v.dur / 60)); sIn.value = v.dur % 60 ? String(Math.round(v.dur % 60)) : ''; }
      for (const k of KF) kIns[k].value = fin(v[k]) ? fmtIn(v[k]) : '';
    };
    const readK = () => {
      let dur;
      if (kind === 'hold') { const t = mIn.value.trim(); const mm = /^(\d+):(\d{1,2})$/.exec(t); dur = mm ? Number(mm[1]) * 60 + Number(mm[2]) : parseNum(t); }
      else { const m = mIn.value.trim() ? parseNum(mIn.value) : 0; const s2 = sIn.value.trim() ? parseNum(sIn.value) : 0; dur = m >= 0 && s2 >= 0 ? m * 60 + s2 : NaN; }
      let ok = Number.isFinite(dur) && dur > 0;
      const out = { c: 1, dur: Math.round(dur) };
      for (const k of KF) { const t = kIns[k].value.trim(); if (!t) continue; const n = parseNum(t); if (n >= 0) out[k] = n; else ok = false; }
      return { ok, vals: out };
    };
    const fill = () => { if (kind) fillK(); else fillW(); };
    const fillW = () => {
      wIn.value = v.bw ? (v.w ? (v.w < 0 ? '-' : '+') + fmtIn(Math.abs(v.w)) : '') : fmtIn(v.w);
      rIn.value = fmtIn(v.r);
      wLab.textContent = v.bw ? T('Lest (kg)') : T('Poids (kg)');
      wIn.setAttribute('aria-label', wLab.textContent);
      wIn.placeholder = v.bw ? '0' : '';
      wPrev.textContent = '';
    };
    const read = () => {
      const tw = wIn.value.trim();
      const w = tw === '' && v.bw ? 0 : calcEval(tw);
      const r = parseNum(rIn.value);
      return { w, r };
    };
    // Un calcul long (20+2,5+2,5) : le texte rétrécit pour rester entier dans la case.
    const fit = () => { const n = wIn.value.length; wIn.style.fontSize = n > 9 ? '20px' : n > 6 ? '26px' : ''; };
    wIn.addEventListener('input', () => { fit(); const t = wIn.value.trim(); const n = OPS.test(t.replace(/^[-−+]/, '')) ? calcEval(t) : NaN; wPrev.textContent = Number.isFinite(n) ? '= ' + fmtNum(n) + ' kg' : ''; msg.textContent = ''; });
    wIn.addEventListener('blur', () => setTimeout(fit, 0));
    rIn.addEventListener('input', () => { msg.textContent = ''; });
    wIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); rIn.focus(); } });
    rIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); rIn.blur(); } });
    // Poids du corps (seulement si l'exercice s'y prête), date et heure
    const bwBtn = bwOk ? h('button', { type: 'button', class: 'mini-chip' }) : null;
    const dtText = h('span');
    const dtIn = h('input', { type: 'datetime-local', class: 'dt-over', 'aria-label': T('Date et heure de la série') });
    const dtChip = h('label', { class: 'mini-chip dtchip' }, icon('clock'), dtText, dtIn);
    function paintChips() {
      if (bwBtn) {
        bwBtn.textContent = '';
        bwBtn.append(icon('body'), h('span', { text: T('Poids du corps') + (v.bw && bwKg() ? ' · ' + fmtNum(bwKg()) + ' kg' : '') }));
        bwBtn.setAttribute('aria-pressed', String(!!v.bw));
      }
      const t = dt || Date.now();
      dtText.textContent = whenText(t);
      dtIn.value = toLocalInput(t);
    }
    if (bwBtn) bwBtn.addEventListener('click', async () => {
      if (!v.bw && !bwKg() && !(await askBodyWeight())) return;
      const cur = read();
      if (Number.isInteger(cur.r) && cur.r > 0) v.r = cur.r;
      v.bw = !v.bw;
      const l = lastOf(ex.id);
      v.w = v.bw ? (l && l.bw && fin(l.x) ? l.x : 0) : (l && !l.bw && l.c !== 1 ? l.w : 20);
      fill(); paintChips();
    });
    dtIn.addEventListener('change', () => { const t = new Date(dtIn.value).getTime(); dt = Number.isFinite(t) ? t : baseDt(); paintChips(); });
    // L'heure affichée suit l'horloge tant qu'on ne l'a pas changée.
    const tick = setInterval(() => { if (!dt) paintChips(); }, 20000);
    S.cleanups.push(() => clearInterval(tick));

    /* Confirmation dans la carte, sous le bouton : rien ne flotte par-dessus la page. */
    const savedLine = h('div', { class: 'saved-line', role: 'status', 'aria-live': 'polite' });
    function showSaved(e, n) {
      savedLine.textContent = '';
      if (!e) return;
      savedLine.append(icon('check'), h('span', { text: T('Série {0} enregistrée · {1}', n, entryText(e)) }),
        h('button', { type: 'button', class: 'undo', text: T('Annuler'), onclick: () => {
          S.entries = S.entries.filter((x) => x.id !== e.id); saveUser();
          lastSaved = null; showSaved(null); paint(); onSaved();
        } }));
    }
    const lockedNow = () => { const p = plannedAll(); return !!p && doneN() >= p.length + extra; };
    const nextEx = () => { const id = currentTodo(dayK); return id && id !== ex.id ? id : null; };
    const goNext = (id) => replaceNow('exercise', { id, day: dayK }, 'fwd');
    const endBtns = () => {
      const id = nextEx();
      return id ? h('button', { type: 'button', class: 'btn acc wide big next', onclick: () => goNext(id) }, h('span', { class: 'nx' }, h('small', { text: T('Exercice suivant') }), h('b', { text: dn(getEx(id)) })), icon('right'))
        : h('button', { type: 'button', class: 'btn acc wide big', onclick: () => replaceNow('session', dayK, 'fwd') }, icon('check'), h('span', { text: T('Voir la séance terminée') }));
    };
    // Zone de saisie / zone « tout est fait »
    const entry = h('div', { class: 'serie-entry' });
    const doneBox = h('div', { class: 'serie-done' });
    function paint() {
      const n = doneN();
      const p = plannedAll();
      const locked = lockedNow();
      title.textContent = locked ? T('Séries prévues faites') : p && n < p.length ? T('Série {0} sur {1}', n + 1, p.length) : T('Série {0}', n + 1);
      sub.textContent = locked ? '' : n ? plural(n, 'déjà faite', 'déjà faites') : fixedDay ? cap(fDayLong.format(keyDate(fixedDay))) : T('Première série du jour');
      const np = nextPlanned();
      plannedLine.hidden = !np || locked;
      if (np) plannedLine.textContent = T('Prévu : {0}', plannedText(np));
      entry.hidden = locked;
      doneBox.hidden = !locked;
      multiLink.hidden = locked;
      if (locked) {
        doneBox.textContent = '';
        doneBox.append(h('p', { class: 'done-t' }, icon('check'), h('span', { text: plural(p.length, 'série prévue faite', 'séries prévues faites') + T(' pour cet exercice.') })),
          endBtns(),
          h('button', { type: 'button', class: 'linkbtn', onclick: () => { extra++; paint(); (kind ? mIn : wIn).focus(); } }, icon('plus'), h('span', { text: T('Une série en plus') })));
      }
      paintChips();
    }
    async function saveK() {
      msg.textContent = '';
      if (lockedNow()) return true;
      const r = readK();
      if (!r.ok) { msg.textContent = kind === 'hold' ? T('Durée : un nombre de secondes.') : T('Durée obligatoire ; les autres valeurs doivent être des nombres.'); return false; }
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      const e = await saveSet(ex, r.vals, dt || Date.now());
      lastSaved = e;
      v = { dur: r.vals.dur };
      for (const k of KF) v[k] = fin(r.vals[k]) ? r.vals[k] : '';
      if (fixedDay) dt = baseDt(); else dt = null;
      const np = nextPlanned();
      if (np && fin(np.dur) && np.dur > 0) v.dur = np.dur;
      fill();
      showSaved(e, doneN());
      paint();
      onSaved();
      afterAll();
      return true;
    }
    async function save() {
      if (kind) return saveK();
      msg.textContent = '';
      if (lockedNow()) return true;
      const cur = read();
      const vals = { w: cur.w, r: cur.r, bw: v.bw };
      if (!(Number.isInteger(cur.r) && cur.r > 0) || !Number.isFinite(cur.w) || (!v.bw && cur.w <= 0)) {
        msg.textContent = T('Poids : un nombre positif (au poids du corps, le total doit rester positif). Répétitions : un nombre entier.');
        return false;
      }
      const r = valsToEntry(vals);
      if (r.noBw) { if (!(await askBodyWeight())) return false; return save(); }
      if (!r.ok) { msg.textContent = T('Poids : un nombre positif (au poids du corps, le total doit rester positif). Répétitions : un nombre entier.'); return false; }
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      const e = await saveSet(ex, r.vals, dt || Date.now());
      lastSaved = e;
      v.w = cur.w; v.r = cur.r;
      if (fixedDay) dt = baseDt(); else dt = null;
      const np = nextPlanned();
      if (np) { const nv = startVals(ex, np); if (!!nv.bw === !!v.bw) { v.w = nv.w; v.r = nv.r; } }
      fill();
      showSaved(e, doneN());
      paint();
      onSaved();
      afterAll();
      return true;
    }
    function afterAll() {
      // Toutes les séries prévues faites : on propose de passer à l'exercice suivant.
      const p = plannedAll();
      if (p && doneN() === p.length + extra) {
        const id = nextEx();
        bottomSheet((bx, close) => {
          bx.append(h('div', { class: 'bs-done' }, h('span', { class: 'bs-done-ic' }, icon('check')),
            h('h2', { class: 'bs-title', text: T('Toutes les séries prévues sont faites') }),
            h('p', { class: 'bs-note', text: id ? T('Passer à l’exercice suivant ?') : T('C’était le dernier exercice de la séance.') })),
          id ? h('button', { type: 'button', class: 'btn acc wide big', onclick: () => close(() => goNext(id)) }, h('span', { text: dn(getEx(id)) }), icon('right'))
            : h('button', { type: 'button', class: 'btn acc wide big', onclick: () => close(() => replaceNow('session', dayK, 'fwd')) }, h('span', { text: T('Voir la séance') })),
          h('button', { type: 'button', class: 'btn ghost wide', text: T('Rester ici'), onclick: () => close() }));
        });
      }
    }
    const multiLink = h('button', { type: 'button', class: 'linkbtn' }, icon('stack'), h('span', { text: T('Noter plusieurs séries') }));
    // Quitter avec des valeurs changées et pas validées : WorkLog demande.
    let base = '';
    const sig = () => (kind ? kAll().map((x) => x.value).join('|') : wIn.value + '|' + rIn.value);
    const guard = { dirty: () => !lockedNow() && sig() !== base, save, title: T('Valider cette série ?'), text: T('Tu as changé une série sans la valider.'), yes: T('Valider la série'), no: T('Ne pas valider') };
    const markBase = () => { base = sig(); };
    function openMulti(draft) {
      bottomSheet((bx, close, setCancel) => {
        const restore = () => { S.guard = guard; };
        const p = plannedAll();
        const rest = p ? p.slice(doneN()) : null;
        const form = buildForm(ex, { day: ctx.day, draft, planned: rest && rest.length ? rest : null, arg: ctx.arg }, () => close(() => { restore(); paint(); onSaved(); }));
        form.classList.add('in-sheet');
        bx.classList.add('multi');
        bx.append(form);
        setCancel(restore);
      });
    }
    multiLink.addEventListener('click', () => openMulti(null));
    fill(); paint();
    const kick = (t) => h('span', { class: 'kicker', text: t });
    entry.append(
      kind === 'hold' ? h('div', { class: 'bigboxes one' }, box(kick(T('Durée')), mIn, h('span', { class: 'unit', text: 's' })))
        : kind ? h('div', { class: 'bigboxes' }, box(kick(T('Minutes')), mIn, h('span', { class: 'unit', text: 'min' })), box(kick(T('Secondes')), sIn, h('span', { class: 'unit', text: 's' })))
        : h('div', { class: 'bigboxes' }, box(wLab, wIn, wUnit, wPrev), box(kick(T('Répétitions')), rIn, h('span', { class: 'unit', text: T('reps') }))),
      ...(KF.length ? [h('div', { class: 'kgrid' }, ...KF.map((k) => h('label', { class: 'kf' }, kick(CFIELD[k].label), kIns[k])))] : []),
      h('div', { class: 'mini-chips' }, bwBtn, dtChip),
      msg,
      h('button', { type: 'button', class: 'btn acc wide big', onclick: onceClick(async () => { if (await save()) markBase(); }) }, icon('check'), h('span', { text: T('Valider la série') })));
    card.append(h('div', { class: 'serie-head' }, title, sub), plannedLine, entry, doneBox, savedLine, h('div', { class: 'serie-links' }, multiLink));
    markBase();
    S.guard = guard;
    card.setFrom = (src) => {
      if (kind) {
        if (!src || src.c !== 1 || !(src.dur > 0)) return;
        v = { dur: src.dur };
        for (const k of KF) v[k] = fin(src[k]) ? src[k] : '';
        fill(); paint();
        card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
        return;
      }
      const rv = rowVals(src); if (!rv) return;
      const bw = !!rv.bw && bwOk;
      v.bw = bw;
      v.w = bw ? (rv.neg ? -1 : 1) * (parseNum(rv.w) || 0) : parseNum(rv.w);
      v.r = parseNum(rv.r);
      fill(); paint();
      card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
    };
    card.openMulti = openMulti;
    card.refresh = () => { paint(); };
    return card;
  }

  /* Muscle principal + un secondaire ; « … » déplie les autres. */
  function muscleChips(ex, secM) {
    const g = GROUPS.get(ex.top);
    const box = h('div', { class: 'mchips' }, h('span', { class: 'mchip main', style: g ? { '--c': g.color } : null, text: frMuscle(ex.p) }));
    if (secM.length) box.append(h('span', { class: 'mchip', text: secM[0] }));
    if (secM.length > 1) {
      const more = h('button', { type: 'button', class: 'mchip more', 'aria-expanded': 'false', 'aria-label': T('Voir les autres muscles secondaires ({0})', secM.length - 1), text: '…' });
      more.addEventListener('click', () => { more.replaceWith(...secM.slice(1).map((m) => h('span', { class: 'mchip', text: m }))); });
      box.append(more);
    }
    return box;
  }
  function viewExercise(arg, ui) {
    const id = typeof arg === 'string' ? arg : (arg && arg.id) || '';
    const dayCtx = arg && typeof arg === 'object' && arg.day ? arg.day : null;
    const known = S.entries.find((e) => e.exerciseId === id);
    const ex = getEx(id, known && known.name);
    const kind = cardioKind(ex);
    // Graphiques de musculation, du plus utile au plus spécialisé.
    const metrics = kind ? CARDIO[kind].metrics : ['e1rm', 'max', 'vol', 'rel', 'pct', 'fat'];
    let range = RANGES.some((r) => r.k === ui.range) ? ui.range : '1m';
    let metric = metrics.includes(ui.metric) ? ui.metric : metrics[0];
    let explainOpen = !!ui.explain;   // « En savoir plus » déplié
    // Sections repliables : « Progression » ouverte, « Dernière séance » et « Animation et muscles » fermées.
    const openSec = Object.assign({ last: false, prog: true, form: true }, ui.openSec || {});
    S.getUI = () => ({ range, metric, explain: explainOpen, openSec });
    const wrap = h('main', { class: 'page exercise' });
    const fromHome = prevView() === 'home' || prevView() === null;
    wrap.append(h('header', { class: 'bar' }, fromHome ? closeBtn() : backBtn(), h('div', { class: 'grow' }), ex.missing ? null : starBtn(ex.id), fromHome ? null : closeBtn()));
    // Vignette (un appui l'agrandit), nom, muscles
    const secM = ex.missing ? [] : [...new Set(ex.s.map(frMuscle))].filter((m) => m !== frMuscle(ex.p));
    wrap.append(h('div', { class: 'ex-top' },
      ex.missing ? null : h('span', { class: 'ex-thumb' }, thumb(ex, { zoom: true })),
      h('div', { class: 'ex-id' }, h('h1', { class: 'ex-title', text: dn(ex) }),
        ex.missing ? null : muscleChips(ex, secM))));
    wrap.append(noteBox(() => S.notes[id], (v) => { if (v.trim()) S.notes[id] = v; else delete S.notes[id]; },
      T('Note : réglages, position de la machine…'), T('Note sur l’exercice')));

    const recent = h('div', { class: 'recent' });
    const chartBox = h('div');
    let serie = null;
    const refresh = () => { renderRecent(); renderChart(); if (serie) serie.refresh(); };

    function mine() { return S.entries.filter((e) => e.exerciseId === ex.id).sort((a, b) => a.ts - b.ts || (a.created || 0) - (b.created || 0)); }

    /* « Dernière séance » : les 2 derniers jours où l'exercice a été fait, et l'historique complet à part. */
    const lastSub = h('span', { class: 'fsub' });
    function renderRecent() {
      recent.textContent = '';
      const byDay = new Map();
      for (const e of mine()) { const k = dayKey(e.ts); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(e); }
      const all = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
      const days = all.slice(0, 2);
      const dayName = (k) => (k === todayKey() ? T('Aujourd’hui') : cap(fDayLong.format(keyDate(k))));
      lastSub.textContent = days.length ? (days[0][0] === todayKey() ? T('Aujourd’hui') : cap(fDayShort.format(keyDate(days[0][0])))) + ' · ' + plural(days[0][1].length, 'série', 'séries') : T('Aucune série');
      if (!days.length) { recent.append(h('p', { class: 'empty-note', text: T('Aucune série pour l’instant.') })); return; }
      for (const [k, list] of days) {
        recent.append(h('div', { class: 'day' },
          h('div', { class: 'dlabel', text: dayName(k) }),
          h('div', { class: 'sets' }, list.map((e) => h('span', { class: 'setpair' },
            h('button', { type: 'button', class: 'set', 'aria-label': T('Modifier la série ') + entryText(e), text: entryText(e), onclick: () => editEntry(e, refresh) }),
            h('button', { type: 'button', class: 'setdup', 'aria-label': T('Recopier la série ') + entryText(e), onclick: () => copyToForm(e) }, icon('copy')))))));
      }
      recent.append(h('p', { class: 'hint', text: T('Touche une série pour la modifier ou la supprimer ; le bouton à côté la recopie dans la saisie.') }));
      recent.append(h('button', { type: 'button', class: 'btn ghost wide', onclick: () => go('exhistory', ex.id) }, T('Voir tout l’historique') + (all.length > 2 ? ' (' + plural(all.length, 'jour', 'jours') + ')' : '')));
    }

    /* Une ligne fine : le graphique affiché (touche pour en choisir un autre) et la période. */
    function renderChart() {
      chartBox.textContent = '';
      const M = METRICS[metric];
      const head = h('div', { class: 'chart-head' });
      if (metrics.length > 1) {
        head.append(h('button', { type: 'button', class: 'metric-btn', 'aria-haspopup': 'dialog', 'aria-label': T('Graphique affiché : {0}. Toucher pour en choisir un autre.', M.label), onclick: pickMetric },
          h('span', { text: metric === 'pct' ? T('Répétitions à {0} %', S.settings.pct || 70) : M.label }), icon('down')));
      } else head.append(h('span', { class: 'metric-one', text: M.label }));
      head.append(h('div', { class: 'seg', role: 'group', 'aria-label': T('Période') },
        RANGES.map((r) => h('button', { type: 'button', class: 'segb', 'aria-pressed': String(range === r.k), 'aria-label': r.label, text: r.short, onclick: () => { range = r.k; renderChart(); } }))));
      chartBox.append(head);
      const all = mine();
      const end = Math.max(Date.now(), all.length ? all[all.length - 1].ts : 0);
      const start = end - RANGES.find((r) => r.k === range).days * 86400000;
      chartBox.append(buildChart(all.filter((e) => e.ts >= start && e.ts <= end), start, end, M,
        { hist: all, pct: S.settings.pct || 70, explain: explainOpen, onExplain: (v) => { explainOpen = v; } }));
      if (metric === 'pct') {
        chartBox.append(h('div', { class: 'pctrow' }, h('span', { text: T('Pourcentage de ta force estimée') }),
          h('div', { class: 'seg', role: 'group', 'aria-label': T('Pourcentage') }, [60, 70, 80].map((v) => h('button', { type: 'button', class: 'segb', 'aria-pressed': String((S.settings.pct || 70) === v), text: v + ' %',
            onclick: () => { S.settings.pct = v; saveUser(); renderChart(); } })))));
      }
    }
    /* Liste des graphiques, chacun avec une phrase qui dit ce qu'il mesure. */
    function pickMetric() {
      bottomSheet((box, close) => {
        box.append(h('h2', { class: 'bs-title', text: T('Graphique affiché') }));
        for (const m of metrics) {
          const M = METRICS[m];
          box.append(h('button', { type: 'button', class: 'mrow' + (m === metric ? ' on' : ''), 'aria-pressed': String(m === metric),
            onclick: () => close(() => { metric = m; renderChart(); }) },
          h('span', { class: 'mt' }, h('b', { text: M.label }), h('span', { text: M.desc })), m === metric ? icon('check') : null));
        }
        box.append(h('button', { type: 'button', class: 'btn ghost wide bs-cancel', text: T('Fermer'), onclick: () => close() }));
      });
    }

    /* Section repliable ; son état est gardé quand on revient sur la page. */
    function fold(key, title, body, sub) {
      const d = h('details', { class: 'sec fold' }, h('summary', {}, h('span', { class: 'ft' }, h('h2', { text: title }), sub || null), icon('down')), body);
      d.open = !!openSec[key];
      d.addEventListener('toggle', () => { openSec[key] = d.open; });
      return d;
    }
    let draft = null;
    if (S.draft && S.draft.id === id) { draft = S.draft.rows; S.draft = null; }
    let copyToForm;
    if (!ex.missing) {
      // 0.8.2 : la carte « Série n » pour tous les exercices (musculation, cardio, étirements).
      serie = serieCard(ex, { day: dayCtx, arg }, refresh);
      wrap.append(serie);
      copyToForm = (e) => { serie.setFrom(e); serie.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' }); };
      if (draft) setTimeout(() => serie.openMulti(draft), 50);   // « Annuler » après plusieurs séries : la saisie revient
    } else {
      // Cardio et exercices tenus : la saisie habituelle (durée, distance…).
      const planned = dayCtx && S.days[dayCtx] && S.days[dayCtx].plan[id] && !dayEntries(dayCtx).some((e) => e.exerciseId === id) ? S.days[dayCtx].plan[id] : null;
      const form = buildForm(ex, { day: dayCtx, draft, planned, arg }, refresh);
      const formTitle = form.querySelector('h2');
      const formFold = fold('form', formTitle.textContent, form.querySelector('.card'));
      wrap.append(formFold);
      copyToForm = (e) => {
        formFold.open = true;
        const row = form.fill(e);
        const f = row.nodes && (row.nodes.r || row.nodes.min);
        const line = f && f.closest('.srow, .crow');
        if (!line) return;
        line.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
        line.classList.remove('flash'); void line.offsetWidth; line.classList.add('flash');
      };
    }
    wrap.append(fold('prog', T('Ta progression'), h('div', { class: 'card' }, chartBox)));
    wrap.append(fold('last', T('Dernière séance'), h('div', { class: 'card' }, recent), lastSub));
    refresh();
    return wrap;
  }

  /* Données affichables sur le graphique : un point par jour, calculé à partir des séries du jour.
     agg(séries du jour) → { v : valeur, best : série retenue, n : nombre de séries, mark : petit texte sur le point }. */
  const e1rm = (e) => (e.r <= 1 ? e.w : e.w * (1 + e.r / 30));   // formule d'Epley
  const round1 = (v) => Math.round(v * 10) / 10;
  const maxBy = (list, f) => list.reduce((a, b) => (f(b) > f(a) ? b : a));
  const sumOf = (list, f) => list.reduce((n, e) => n + (fin(f(e)) ? f(e) : 0), 0);
  const isLift = (e) => e.c !== 1 && fin(e.w) && fin(e.r) && e.w > 0 && e.r > 0;
  /* Force de référence d'un jour : la meilleure force estimée des 3 mois qui précèdent (ce jour compris),
     calculée seulement sur les séries de 1 à 10 répétitions (là où la formule est fiable). */
  function refMax(hist, key) {
    const end = keyDate(key).getTime() + 86400000; const start = end - 92 * 86400000;
    let best = null;
    for (const e of hist) {
      if (!isLift(e) || e.r > 10 || e.ts < start || e.ts >= end) continue;
      const v = e1rm(e);
      if (!best || v > best.v) best = { v, e };
    }
    return best;
  }
  const predReps = (R, w) => 30 * (R / w - 1);   // répétitions que la formule d'Epley prévoit à la charge w
  const para = (t) => h('p', { text: t });
  const exLine = (label, formula) => h('p', { class: 'ex' }, label, h('b', { text: formula }));
  /* Historique complet d'un exercice, ouvert par-dessus sa page : toutes les séries, jour par jour. */
  function viewExHistory(arg) {
    const id = String(arg || '');
    const known = S.entries.find((e) => e.exerciseId === id);
    const ex = getEx(id, known && known.name);
    const wrap = h('main', { class: 'page exhistory' });
    wrap.append(h('header', { class: 'bar' }, backBtn(), h('h1', { class: 'grow', text: T('Historique') }), closeBtn()));
    wrap.append(h('p', { class: 'ex-sub', text: dn(ex) }));
    const body = h('div');
    function renderList() {
      body.textContent = '';
      const byDay = new Map();
      for (const e of S.entries.filter((x) => x.exerciseId === id).sort((a, b) => b.ts - a.ts || (b.created || 0) - (a.created || 0))) {
        const k = dayKey(e.ts); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(e);
      }
      if (!byDay.size) { body.append(h('p', { class: 'empty-note', text: T('Aucune série pour cet exercice.') })); return; }
      body.append(h('p', { class: 'hint', text: T('{0} · touche une série pour la modifier ou la supprimer.', plural(byDay.size, 'jour', 'jours')) }));
      const card = h('div', { class: 'card recent' });
      for (const [k, list] of byDay) {
        list.sort((a, b) => a.ts - b.ts || (a.created || 0) - (b.created || 0));
        card.append(h('div', { class: 'day' }, h('div', { class: 'dlabel', text: k === todayKey() ? T('Aujourd’hui') : cap(fDayLong.format(keyDate(k))) + ' ' + keyDate(k).getFullYear() }),
          h('div', { class: 'sets' }, list.map((e) => h('button', { type: 'button', class: 'set', 'aria-label': T('Modifier la série ') + entryText(e), text: entryText(e), onclick: () => editEntry(e, renderList) })))));
      }
      body.append(card);
    }
    renderList();
    wrap.append(h('section', { class: 'sec' }, body));
    return wrap;
  }

  /* Données affichables : un point par jour. agg(séries du jour, contexte) → { v, best, mark… } ;
     explain(point, contexte) → explication affichée avec « En savoir plus ». */
  const METRICS = {
    e1rm: { label: T('Force estimée'), desc: T('Ta force, même si tu changes de charge ou de répétitions'), note: T('Force estimée (kg) : ta meilleure série du jour'),
      agg: (l) => { const ok = l.filter(isLift); if (!ok.length) return null; const b = maxBy(ok, e1rm); return { v: round1(e1rm(b)), best: b }; }, tick: fmtNum,
      detail: (pt) => [fmtNum(pt.v) + ' kg ' + T('estimés'), T('Meilleure série : ') + entryText(pt.best)],
      explain: (pt) => {
        const b = pt.best;
        return [para(T('Pour chaque série : poids × (1 + répétitions ÷ 30). C’est la formule d’Epley, qui estime la charge que tu pourrais soulever une seule fois (ton « 1RM »). Une série d’une seule répétition compte pour son poids.')),
          para(T('Le point du jour est ta meilleure série. Si tu as pris plus lourd en faisant moins de répétitions, le graphique montre quand même ce progrès, ce que le total soulevé (Volume) ne fait pas.')),
          exLine(T('Exemple, ta meilleure série du {0} : ', fDayShort.format(b.ts)), b.r <= 1 ? fmtNum(b.w) + T(' kg × 1 → ') + fmtNum(round1(e1rm(b))) + ' kg'
            : fmtNum(b.w) + T(' kg × ') + fmtNum(b.r) + ' → ' + fmtNum(b.w) + T(' × (1 + ') + fmtNum(b.r) + T(' ÷ 30) = ') + fmtNum(round1(e1rm(b))) + ' kg'),
          h('p', { class: 'small', text: T('L’estimation est plus fiable entre 1 et 12 répétitions. Au poids du corps, le calcul utilise le poids total (poids du corps + lest, ou moins l’assistance).') })];
      } },
    max: { label: T('Charge max'), desc: T('La charge la plus lourde du jour'), note: T('Charge la plus lourde du jour (kg) ; × = répétitions faites à cette charge'),
      agg: (l) => { const ok = l.filter(isLift); if (!ok.length) return null; const w = Math.max(...ok.map((e) => e.w)); const b = maxBy(ok.filter((e) => e.w === w), (e) => e.r); return { v: w, best: b, mark: T('×') + fmtNum(b.r) }; }, tick: fmtNum,
      detail: (pt) => [fmtNum(pt.v) + T(' kg × ') + fmtNum(pt.best.r) + ' ' + T('rép.'), pt.best.bw ? entryText(pt.best) : ''],
      explain: () => [para(T('La charge la plus lourde soulevée ce jour-là. Le petit nombre au-dessus du point (×8, par exemple) indique les répétitions faites à cette charge.')),
        para(T('C’est la mesure la plus parlante, mais elle ne montre pas un progrès en répétitions à charge égale : pour ça, regarde la force estimée.'))] },
    vol: { label: T('Volume'), desc: T('La quantité de travail du jour'), note: T('Volume du jour (kg) : poids × répétitions de toutes les séries'),
      agg: (l) => { const ok = l.filter(isLift); if (!ok.length) return null; return { v: Math.round(sumOf(ok, (e) => e.w * e.r)), n: ok.length }; }, tick: fmtNum,
      detail: (pt) => [fmtNum(pt.v) + ' kg', plural(pt.n, 'série', 'séries')],
      explain: (pt) => [para(T('La somme de poids × répétitions de toutes tes séries du jour. C’est la quantité de travail, un des principaux moteurs de la prise de muscle : il monte si tu fais plus de séries, plus de répétitions ou plus lourd.')),
        exLine(T('Ce jour-là : '), T('{0} pour {1} kg au total', plural(pt.n, 'série', 'séries'), fmtNum(pt.v)))] },
    rel: { label: T('Endurance relative'), desc: T('Tes répétitions comparées à celles que ta force prévoit'), note: T('Endurance relative (%) : 100 % = autant de répétitions que prévu par ta force'),
      empty: () => T('Il faut une série à 85 % de ta force estimée ou moins (une charge plus légère que tes séries lourdes) pour calculer l’endurance relative.'),
      agg: (l, k, c) => {
        const R = refMax(c.hist, k); if (!R) return null;
        // La série qui sert de référence ne se mesure pas contre elle-même.
        const ok = l.filter((e) => isLift(e) && e !== R.e && e.w <= 0.85 * R.v);
        if (!ok.length) return null;
        const ratio = (e) => (e.r / predReps(R.v, e.w)) * 100;
        const b = maxBy(ok, ratio);
        return { v: Math.round(ratio(b)), best: b, R: R.v, pred: predReps(R.v, b.w) };
      }, tick: fmtNum,
      detail: (pt) => [pt.v + ' %', entryText(pt.best) + ' · ' + T('{0} rép. prévues', fmtNum(round1(pt.pred)))],
      explain: (pt) => [para(T('Compare les répétitions faites à une charge légère ou moyenne avec celles que ta force prévoit à cette charge.')),
        para(T('Référence : ta meilleure force estimée des 3 derniers mois (séries de 1 à 10 répétitions). À une charge donnée, la formule d’Epley prévoit 30 × (référence ÷ charge − 1) répétitions. Endurance relative = répétitions faites ÷ répétitions prévues.')),
        para(T('100 % = autant que prévu. Au-dessus, ton muscle tient mieux que ta force ne le laisse prévoir ; en dessous, c’est l’endurance qui te limite. Seules les séries à 85 % de ta référence ou moins comptent ; le point du jour est la meilleure.')),
        exLine(T('Ce jour-là : '), T('référence {0} kg ; à {1} kg, 30 × ({0} ÷ {1} − 1) = {2} rép. prévues ; tu en as fait {3} → {4} %', fmtNum(round1(pt.R)), fmtNum(pt.best.w), fmtNum(round1(pt.pred)), fmtNum(pt.best.r), pt.v))] },
    pct: { label: T('Répétitions à X %'), desc: T('Tes répétitions à un même pourcentage de ta force'), note: T('Répétitions faites à {0} % de ta force estimée', '{pct}'),
      empty: (c) => T('Aucune série autour de {0} % de ta force estimée (entre {1} et {2} %) sur cette période. Choisis un autre pourcentage ci-dessous.', c.pct, c.pct - 5, c.pct + 5),
      agg: (l, k, c) => {
        const R = refMax(c.hist, k); if (!R) return null;
        const X = c.pct / 100;
        const ok = l.filter((e) => isLift(e) && Math.abs(e.w / R.v - X) <= 0.05);
        if (!ok.length) return null;
        const b = maxBy(ok, (e) => e.r);
        return { v: b.r, best: b, R: R.v, mark: fmtNum(b.w) + ' kg' };
      }, tick: fmtNum,
      detail: (pt) => [fmtNum(pt.v) + ' ' + T('rép.'), T('à {0} kg, soit {1} % de {2} kg', fmtNum(pt.best.w), Math.round((pt.best.w / pt.R) * 100), fmtNum(round1(pt.R)))],
      explain: (pt, c) => [para(T('Le nombre de répétitions faites à {0} % de ta force estimée (référence : ta meilleure force estimée des 3 derniers mois, séries de 1 à 10 répétitions). C’est le test d’endurance classique : à charge relative égale, plus de répétitions = plus d’endurance.', c.pct)),
        para(T('Une série compte si sa charge est à 5 points près du pourcentage choisi (entre {0} et {1} % pour {2} %). Choisis le pourcentage avec les boutons sous le graphique.', c.pct - 5, c.pct + 5, c.pct)),
        exLine(T('Ce jour-là : '), T('{0} kg × {1}, soit {2} % de ta référence de {3} kg', fmtNum(pt.best.w), fmtNum(pt.best.r), Math.round((pt.best.w / pt.R) * 100), fmtNum(round1(pt.R))))] },
    fat: { label: T('Indice de fatigue'), desc: T('La baisse de répétitions d’une série à l’autre'), note: T('Indice de fatigue (%) : plus c’est bas, mieux tu tiens'), zero: true,
      empty: () => T('Il faut au moins 2 séries à la même charge le même jour pour calculer l’indice de fatigue.'),
      agg: (l) => {
        const groups = new Map();
        for (const e of l.filter(isLift)) { if (!groups.has(e.w)) groups.set(e.w, []); groups.get(e.w).push(e); }
        let pick = null;
        for (const [w, g] of groups) if (g.length >= 2 && (!pick || g.length > pick.g.length || (g.length === pick.g.length && w > pick.w))) pick = { w, g };
        if (!pick) return null;
        const g = pick.g.slice().sort((a, b) => a.ts - b.ts || (a.created || 0) - (b.created || 0));
        const f = g[0]; const z = g[g.length - 1];
        return { v: Math.max(0, Math.round(((f.r - z.r) / f.r) * 100)), best: f, n: g.length, w: pick.w, r0: f.r, r1: z.r };
      }, tick: fmtNum,
      detail: (pt) => [pt.v + ' %', T('{0} à {1} kg : {2} → {3} rép.', plural(pt.n, 'série', 'séries'), fmtNum(pt.w), fmtNum(pt.r0), fmtNum(pt.r1))],
      explain: (pt) => [para(T('Combien tes répétitions baissent d’une série à l’autre à la même charge : (répétitions de la 1re série − répétitions de la dernière) ÷ répétitions de la 1re série.')),
        para(T('0 % = tu tiens le même nombre de répétitions jusqu’au bout. Plus c’est bas, mieux ton muscle récupère entre les séries. Il faut au moins 2 séries à la même charge le même jour ; s’il y a plusieurs charges, c’est celle où tu as fait le plus de séries qui compte.')),
        exLine(T('Ce jour-là : '), T('{0} à {1} kg, {2} → {3} rép. : ({2} − {3}) ÷ {2} = {4} %', plural(pt.n, 'série', 'séries'), fmtNum(pt.w), fmtNum(pt.r0), fmtNum(pt.r1), pt.v))] },
    dur: { label: T('Durée'), note: T('Durée totale du jour (minutes)'), agg: (l) => ({ v: sumOf(l, (e) => e.dur) / 60, s: sumOf(l, (e) => e.dur), n: l.length }), tick: (v) => fmtNum(Math.round(v)),
      detail: (pt) => [fmtDur(pt.s), plural(pt.n, 'série', 'séries')] },
    speed: { label: T('Vitesse'), note: T('Meilleure vitesse moyenne du jour (km/h)'), agg: (l) => { const ok = l.filter((e) => speedOf(e)); if (!ok.length) return null; const b = maxBy(ok, speedOf); return { v: speedOf(b), best: b }; },
      tick: (v) => fmtNum(Math.round(v)), detail: (pt) => [fmtNum(Math.round(pt.v * 10) / 10) + ' km/h', entryText(pt.best)] },
    hold: { label: T('Durée'), note: T('Plus longue tenue du jour (secondes)'), agg: (l) => { const b = maxBy(l, (e) => e.dur); return { v: b.dur, best: b, n: l.length, s: sumOf(l, (e) => e.dur) }; },
      tick: (v) => fmtNum(Math.round(v)), detail: (pt) => [fmtDur(pt.v), plural(pt.n, 'série', 'séries') + ' · ' + T('total') + ' ' + fmtDur(pt.s)] },
    lvl: { label: T('Niveau'), note: T('Niveau le plus haut du jour'), agg: (l) => { const ok = l.filter((e) => fin(e.lvl)); if (!ok.length) return null; const b = maxBy(ok, (e) => e.lvl); return { v: b.lvl, best: b }; },
      tick: fmtNum, detail: (pt) => [T('niveau') + ' ' + fmtNum(pt.v), entryText(pt.best)] },
    rounds: { label: T('Tours'), note: T('Nombre de tours du jour'), agg: (l) => { const ok = l.filter((e) => fin(e.rounds)); if (!ok.length) return null; return { v: sumOf(ok, (e) => e.rounds), n: ok.length }; },
      tick: fmtNum, detail: (pt) => [plural(pt.v, 'tour', 'tours'), plural(pt.n, 'série', 'séries')] },
  };
  for (const M of Object.values(METRICS)) { if (!M.desc) M.desc = M.note; if (!M.explain) M.explain = () => [para(M.note)]; }

  /* Graphique : un point par jour. Bornes : minimum −10 % arrondi à l'entier inférieur, maximum +10 % arrondi au supérieur.
     c : contexte (toutes les séries de l'exercice, pourcentage choisi, état de « En savoir plus »). */
  function buildChart(all, start, end, M, c) {
    c = c || { hist: all, pct: 70 };
    const box = h('div');
    const byDay = new Map();
    for (const e of all) { const k = dayKey(e.ts); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(e); }
    const pts = [];
    for (const [k, list] of byDay) {
      const a = M.agg(list, k, c);
      if (a && fin(a.v) && (a.v > 0 || M.zero)) pts.push(Object.assign(a, { key: k, t: Math.min(end, keyDate(k).getTime() + 12 * 3600000) }));
    }
    const note = M.note.replace('{pct}', c.pct);
    if (!pts.length) {
      box.append(h('p', { class: 'empty-note', text: !all.length ? T('Aucune série sur cette période.') : M.empty ? M.empty(c) : T('Pas de donnée « {0} » sur cette période.', M.label.toLowerCase()) }));
      if (all.length) box.append(h('p', { class: 'hint', text: M.desc }));
      return box;
    }
    const vals = pts.map((pt) => pt.v);
    const lo = M.zero ? 0 : Math.max(0, Math.floor(Math.min(...vals) * 0.9));
    let hi = Math.ceil(Math.max(...vals) * 1.1);
    if (M.zero) hi = Math.max(hi, 10);
    if (hi <= lo) hi = lo + 1;
    const W = 340; const H = 220; const m = { l: 44, r: 16, t: 22, b: 28 };
    const x = (t) => m.l + ((t - start) / (end - start || 1)) * (W - m.l - m.r);
    const y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
    const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': T('Courbe de progression : {0} jours', pts.length) });

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

    const sorted = pts.sort((a, b) => a.t - b.t);
    if (sorted.length > 1) {
      svg.append(sv('path', { class: 'area', d: 'M' + x(sorted[0].t).toFixed(1) + ' ' + (H - m.b) + sorted.map((pt) => ' L' + x(pt.t).toFixed(1) + ' ' + y(pt.v).toFixed(1)).join('') + ' L' + x(sorted[sorted.length - 1].t).toFixed(1) + ' ' + (H - m.b) + ' Z' }));
      svg.append(sv('path', { class: 'line', d: sorted.map((pt, i) => (i ? 'L' : 'M') + x(pt.t).toFixed(1) + ' ' + y(pt.v).toFixed(1)).join(' ') }));
    }
    // Petit texte au-dessus des points, seulement s'il y a la place.
    if (sorted.some((pt) => pt.mark) && sorted.length <= 14) {
      sorted.forEach((pt) => { if (pt.mark) svg.append(sv('text', { class: 'mark', x: x(pt.t), y: y(pt.v) - 10, 'text-anchor': 'middle' }, pt.mark)); });
    }
    const detail = h('div', { class: 'detail', 'aria-live': 'polite' });
    // « En savoir plus » : l'explication du calcul, repliée par défaut.
    const more = h('button', { type: 'button', class: 'morebtn', 'aria-expanded': String(!!c.explain) });
    const explain = h('div', { class: 'explain', hidden: !c.explain });
    let cur = sorted.length - 1;
    const paintExplain = () => {
      more.textContent = '';
      more.append(h('span', { text: c.explain ? T('Masquer l’explication') : T('En savoir plus') }), icon('down'));
      more.setAttribute('aria-expanded', String(!!c.explain));
      explain.hidden = !c.explain;
      explain.textContent = '';
      if (c.explain) explain.append(h('strong', { text: T('Comment c’est calculé') }), ...M.explain(sorted[cur], c));
    };
    more.addEventListener('click', () => { c.explain = !c.explain; if (c.onExplain) c.onExplain(c.explain); paintExplain(); });
    const dots = [];
    const select = (i) => {
      cur = i;
      dots.forEach((d, j) => d.setAttribute('class', j === i ? 'dot on' : 'dot'));
      const [a, b] = M.detail(sorted[i]);
      detail.textContent = '';
      detail.append(h('strong', { text: a }), h('span', { class: 'sub', text: (b ? b + ' · ' : '') + cap(fDayLong.format(keyDate(sorted[i].key))) }));
      paintExplain();
    };
    sorted.forEach((pt) => {
      const dot = sv('circle', { class: 'dot', cx: x(pt.t), cy: y(pt.v), r: 5.5 });
      dots.push(dot); svg.append(dot);
    });
    sorted.forEach((pt, i) => {
      const hit = sv('circle', { class: 'hit', cx: x(pt.t), cy: y(pt.v), r: 18, tabindex: '0', role: 'button', 'aria-label': M.detail(pt).filter(Boolean).join(', ') + ', ' + fDayShort.format(keyDate(pt.key)) });
      hit.addEventListener('click', () => select(i));
      hit.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); } });
      svg.append(hit);
    });
    box.append(h('p', { class: 'chart-note', text: note }), svg, detail, more, explain);
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
    // Une nouvelle série reprend le mode « poids du corps » de la dernière série de l'exercice.
    const lastBw = () => !kind && S.entries.filter((e) => e.exerciseId === ex.id).reduce((a, b) => (!a || b.ts > a.ts ? b : a), null);
    const newRow = (vals) => {
      const r = { dt: baseDt(rows.length), manual: !!fixedDay };
      for (const k of keys) r[k] = vals && vals[k] != null ? String(vals[k]) : '';
      if (!kind) { const lb = vals && vals.bw !== undefined ? null : lastBw(); r.bw = vals && vals.bw !== undefined ? !!vals.bw : !!(lb && lb.bw); r.neg = !!(vals && vals.neg); }
      return r;
    };
    const isFilled = (r) => keys.some((k) => String(r[k] || '').trim());
    const toStr = (v) => (fin(v) ? fmtIn(v) : typeof v === 'string' ? v : '');

    function renderRows() {
      list.textContent = '';
      rows.forEach((row, i) => {
        row.nodes = {};
        const dIn = h('input', { class: 'field', type: 'datetime-local', 'aria-label': T('Date et heure de la série ') + (i + 1) });
        dIn.value = toLocalInput(row.dt);
        const touch = () => {
          msg.textContent = '';
          if (!row.manual) { row.dt = Date.now(); dIn.value = toLocalInput(row.dt); }
        };
        dIn.addEventListener('change', () => {
          const t = new Date(dIn.value).getTime();
          if (Number.isFinite(t)) { row.dt = t; row.manual = true; } else { row.manual = false; row.dt = Date.now(); dIn.value = toLocalInput(row.dt); }
        });
        const dup = h('button', { type: 'button', class: 'iconbtn plain mini', 'aria-label': T('Dupliquer la série ') + (i + 1),
          onclick: () => { const c = newRow(row); rows.splice(i + 1, 0, c); renderRows(); } }, icon('copy'));
        const rm = rows.length > 1 ? h('button', { type: 'button', class: 'iconbtn plain mini', 'aria-label': T('Retirer la série ') + (i + 1), onclick: () => { rows.splice(i, 1); renderRows(); } }, icon('close')) : null;
        // Boutons de la ligne, alignés à droite sur la même ligne que les champs.
        const acts = h('span', { class: 'racts' }, dup, rm);
        if (kind) {
          const live = h('span', { class: 'live' });
          const upd = () => { const r = readCardio(kind, row); live.textContent = r.ok && speedOf(r.vals) ? fmtNum(Math.round(speedOf(r.vals) * 10) / 10) + ' km/h' : ''; };
          list.append(h('div', { class: 'crow' },
            h('div', { class: 'chead' }, h('span', { class: 'n', text: String(i + 1) }), live, h('span', { class: 'grow' }), acts),
            cardioFields(kind, row, () => { touch(); upd(); }),
            h('div', { class: 'dt-line' }, h('span', { text: T('Le') }), dIn)));
          upd();
        } else {
          let chk = null;
          const wBox = weightField(row, T('Poids de la série ') + (i + 1) + ' en kilos', () => { touch(); if (chk) chk.paint(); });
          const wIn = wBox.inp;
          const rIn = h('input', { class: 'field', type: 'text', inputmode: 'numeric', placeholder: T('rép.'), 'aria-label': T('Répétitions de la série ') + (i + 1), autocomplete: 'off' });
          rIn.value = row.r;
          rIn.addEventListener('input', () => { row.r = rIn.value; rIn.classList.remove('invalid'); touch(); });
          row.nodes = { w: wIn, r: rIn };
          chk = bwCheck(row, () => { wBox.paint(); touch(); });
          list.append(h('div', { class: 'srow' },
            h('span', { class: 'n', text: String(i + 1) }), wBox, h('span', { class: 'times', 'aria-hidden': 'true', text: T('×') }), rIn, acts,
            h('div', { class: 'dt-line' }, chk, h('span', { class: 'dtw' }, h('span', { text: T('Le') }), dIn))));
        }
      });
    }
    if (ctx.draft && ctx.draft.length) ctx.draft.forEach((d) => rows.push(Object.assign(newRow(d), { dt: d.dt, manual: d.manual })));
    else if (ctx.planned && ctx.planned.length && !kind) ctx.planned.forEach((p) => rows.push(newRow(p.bw ? rowVals(p) : { w: toStr(p.w), r: toStr(p.r) })));
    else if (ctx.planned && ctx.planned.length && kind === 'hold') ctx.planned.forEach((p) => rows.push(newRow(fin(p.dur) ? { min: p.dur >= 60 ? Math.floor(p.dur / 60) : '', sec: p.dur % 60 || '' } : null)));
    else rows.push(newRow());
    renderRows();

    /* Enregistre les séries remplies ; renvoie false si une valeur est invalide. */
    async function save() {
      msg.textContent = '';
      rows.forEach((r) => { if (r.nodes && r.nodes.w) finishCalc(r.nodes.w); });
      const filled = rows.filter(isFilled);
      if (!filled.length) { msg.textContent = kind ? T('Renseigne au moins la durée.') : T('Renseigne le poids et les répétitions d’au moins une série.'); return false; }
      let bad = false; let noBw = false;
      const vals = filled.map((row) => {
        if (kind) {
          const r = readCardio(kind, row);
          r.bad.forEach((k) => row.nodes[k] && row.nodes[k].classList.add('invalid'));
          if (!r.ok) bad = true;
          return r.vals;
        }
        const wr = readWeight(row); const r = parseNum(row.r);
        const okR = Number.isInteger(r) && r > 0;
        row.nodes.w.classList.toggle('invalid', !wr.ok); row.nodes.r.classList.toggle('invalid', !okR);
        if (wr.noBw) noBw = true;
        if (!wr.ok || !okR) bad = true;
        return Object.assign({}, wr.vals, { r });
      });
      if (noBw) { msg.textContent = T('Renseigne ton poids du corps dans Réglages (roue crantée de l’accueil) pour les séries au poids du corps.'); return false; }
      if (bad) { msg.textContent = kind ? T('Durée obligatoire ; les autres valeurs doivent être des nombres.') : T('Poids : un nombre positif (au poids du corps, le total doit rester positif). Répétitions : un nombre entier.'); return false; }
      const base = Date.now();
      const created = [];
      filled.forEach((row, i) => {
        const e = Object.assign({ id: uid(), exerciseId: ex.id, name: ex.name, ts: row.dt, created: base + i }, vals[i]);
        S.entries.push(e); created.push(e.id);
        const k = dayKey(e.ts);
        if (S.days[k] && !S.days[k].order.includes(ex.id)) S.days[k].order.push(ex.id);
      });
      await saveUser();
      const draft = filled.map((r) => { const o = { dt: r.dt, manual: r.manual, bw: r.bw, neg: r.neg }; keys.forEach((k) => { o[k] = r[k]; }); return o; });
      const n = filled.length;
      rows.length = 0; rows.push(newRow()); renderRows();
      toast(n + (n > 1 ? T(' séries enregistrées') : T(' série enregistrée')), { ms: 6000, sticky: true, action: () => undoSave(ex.id, created, draft, ctx.arg) });
      onSaved();
      return true;
    }
    S.guard = { dirty: () => rows.some(isFilled), save };
    /* Recopie une série déjà faite (bouton « dupliquer » de « Dernières séances ») dans la première ligne vide. */
    function fill(src) {
      const v = (kind ? cardioRowOf(src) : rowVals(src)) || {};
      let row = rows.find((r) => !isFilled(r));
      if (!row) { row = newRow(); rows.push(row); }
      for (const k of keys) row[k] = v[k] != null ? String(v[k]) : '';
      if (!kind) { row.bw = !!v.bw; row.neg = !!v.neg; }
      if (!row.manual) row.dt = Date.now();
      msg.textContent = '';
      renderRows();
      return row;
    }

    const formSec = h('section', { class: 'sec' },
      h('h2', { text: T('Nouvelle série') + (ex.side ? T(' · durée par côté') : '') + (fixedDay ? ' · ' + cap(fDayLong.format(keyDate(fixedDay))) : '') }),
      h('div', { class: 'card' }, list,
        h('div', { class: 'form-actions' },
          msg,
          h('button', { type: 'button', class: 'btn ghost', onclick: () => { rows.push(newRow()); renderRows(); const last = rows[rows.length - 1]; const f = last.nodes.w || last.nodes.min; if (f) f.focus(); } }, icon('plus'), T('Ajouter une série')),
          h('button', { type: 'button', class: 'btn primary', onclick: onceClick(save), text: T('Valider') }))));
    formSec.fill = fill;
    return formSec;
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
    let chk = null;
    if (kind) { row = cardioRowOf(e); fields = cardioFields(kind, row, () => { msg.textContent = ''; }); } else {
      row = rowVals(e);
      // Série au poids du corps : on garde le poids du corps de l'époque (total − lest).
      if (e.bw) row.base = Math.round((e.w - (e.x || 0)) * 100) / 100;
      const wBox = weightField(row, T('Poids en kilos'), () => { msg.textContent = ''; if (chk) chk.paint(); });
      const wIn = wBox.inp;
      const rIn = h('input', { class: 'field', type: 'text', inputmode: 'numeric', placeholder: T('rép.'), 'aria-label': T('Répétitions'), autocomplete: 'off' }); rIn.value = row.r;
      rIn.addEventListener('input', () => { row.r = rIn.value; rIn.classList.remove('invalid'); });
      row.nodes = { w: wIn, r: rIn };
      chk = bwCheck(row, () => { if (!row.bw) row.base = 0; wBox.paint(); msg.textContent = ''; }, true);
      fields = h('div', { class: 'edw' }, h('div', { class: 'srow edit' }, wBox, h('span', { class: 'times', text: T('×') }), rIn), chk);
    }
    const dIn = h('input', { class: 'field left', type: 'datetime-local', id: 'ed-dt' });
    dIn.value = toLocalInput(e.ts);
    let close = null;
    const save = async () => {
      let vals;
      if (kind) { const r = readCardio(kind, row); r.bad.forEach((k) => row.nodes[k] && row.nodes[k].classList.add('invalid')); if (!r.ok) { msg.textContent = T('Durée obligatoire ; les autres valeurs doivent être des nombres.'); return; } vals = r.vals; } else {
        finishCalc(row.nodes.w);
        const wr = readWeight(row, row.base); const r = parseNum(row.r);
        const okR = Number.isInteger(r) && r > 0;
        row.nodes.w.classList.toggle('invalid', !wr.ok); row.nodes.r.classList.toggle('invalid', !okR);
        if (wr.noBw) { msg.textContent = T('Renseigne ton poids du corps dans Réglages.'); return; }
        if (!wr.ok || !okR) { msg.textContent = T('Poids : un nombre positif. Répétitions : un nombre entier.'); return; }
        vals = Object.assign({}, wr.vals, { r });
      }
      const t = new Date(dIn.value).getTime();
      if (kind) CARDIO_KEYS.forEach((k) => { delete e[k]; });
      if (!kind) { delete e.bw; delete e.x; }
      Object.assign(e, vals, Number.isFinite(t) ? { ts: t } : {});
      await saveUser();
      close(); onDone(); toast(T('Série modifiée'));
    };
    const box = h('div', { class: 'dialog sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' },
      h('h2', { id: 'dlg-t', text: T('Modifier la série') }), h('p', { class: 'ed-name', text: dn(ex) }),
      fields, h('label', { class: 'lbl', for: 'ed-dt', text: T('Date et heure') }), dIn, msg,
      h('div', { class: 'acts' }, h('button', { type: 'button', class: 'btn ghost', text: T('Annuler'), onclick: () => close() }),
        h('button', { type: 'button', class: 'btn primary', text: T('Enregistrer'), onclick: save })),
      h('button', { type: 'button', class: 'textbtn danger center', text: T('Supprimer cette série'), onclick: () => { close(); deleteEntry(e, onDone); } }));
    close = openModal(box, hideCalc);
    const c0 = close; close = () => { hideCalc(); c0(); };
  }
  function deleteEntry(e, onDone) {
    const i = S.entries.findIndex((x) => x.id === e.id);
    if (i < 0) return;
    S.entries.splice(i, 1);
    saveUser(); onDone();
    toast(T('Série supprimée'), { ms: 6000, action: () => { S.entries.push(e); saveUser(); onDone(); } });
  }

  /* ---------- recherche d'exercices ----------
     Chaque mot de la recherche est cherché séparément, en anglais et en français, avec une
     tolérance aux fautes de frappe (« hip trust » trouve « Barbell hip thrust »). Ordre : nom exact,
     puis noms qui commencent par la recherche ou la contiennent telle quelle, puis le plus de mots
     trouvés (mots entiers avant débuts de mots, puis fautes) ; à égalité, le nom le plus court. */
  function editDist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  /* Note d'un mot de la recherche dans un nom : 3 mot entier, 2 début de mot, 1,5 contenu, 1 avec une faute. */
  function tokenScore(t, words, joined) {
    let best = 0;
    for (const w of words) {
      if (w === t) return 3;
      if (w.startsWith(t)) best = Math.max(best, 2);
      else if (t.length >= 3 && w.includes(t)) best = Math.max(best, 1.5);
      else if (best < 1 && t.length >= 4) {
        const max = t.length >= 6 ? 2 : 1;
        if (editDist(t, w, max) <= max || (w.length > t.length && editDist(t, w.slice(0, t.length), 1) <= 1 && t.length >= 5)) best = 1;
      }
    }
    if (!best && t.length >= 3 && joined.includes(t)) best = 1.5;
    return best;
  }
  function searchExercises(raw) {
    const q = skey(raw);
    if (!q) return [];
    const qc = q.replace(/ /g, '');
    const tokens = [...new Set(q.split(' '))];
    const need = tokens.length <= 2 ? tokens.length : Math.ceil(tokens.length * 0.6);
    const out = [];
    for (const ex of S.exercises) {
      let bestRow = null;
      for (const k of [ex.key, ex.fkey]) {
        if (!k) continue;
        const words = k.split(' '); const joined = k.replace(/ /g, '');
        let rank = 4;
        if (k === q || joined === qc) rank = 0;
        else if (k.startsWith(q + ' ')) rank = 1;
        else if ((' ' + k + ' ').includes(' ' + q + ' ')) rank = 2;
        else if (k.startsWith(q) || (qc.length > 3 && joined.includes(qc))) rank = 3;
        let n = 0; let sc = 0;
        for (const t of tokens) { const v = tokenScore(t, words, joined); if (v) { n++; sc += v; } }
        if (rank === 4 && n < need) continue;
        const row = [rank, -n, -sc, k.length];
        if (!bestRow || cmpRow(row, bestRow) < 0) bestRow = row;
      }
      if (bestRow) out.push([bestRow, ex]);
    }
    out.sort((a, b) => cmpRow(a[0], b[0]) || dn(a[1]).localeCompare(dn(b[1]), LANG));
    return out.map((x) => x[1]);
  }
  function cmpRow(a, b) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; }

  /* ---------- bibliothèque : onglets Favoris / Musculation / Étirements ---------- */
  const TABS = [['fav', T('Favoris')], ['musc', T('Musculation')], ['str', T('Étirements')]];
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
          if (dayEntries(pick.id).some((e) => e.exerciseId === ex.id)) { toast(T('Cet exercice a déjà des séries ce jour-là.')); return; }
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
      wrap.append(h('header', { class: 'bar' }, backBtn(), h('h1', { class: 'grow', text: T('Ajouter des exercices') }),
        h('button', { type: 'button', class: 'btn primary okbtn', onclick: goBack }, T('OK '), countEl)));
    } else wrap.append(h('header', { class: 'bar' }, h('h1', { class: 'grow big', text: T('Exercices') })));
    const search = h('input', { class: 'search', type: 'search', placeholder: T('Rechercher un exercice'), 'aria-label': T('Rechercher un exercice'), autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', enterkeyhint: 'search' });
    search.value = ui.q || '';
    const tabBar = h('div', { class: 'tabs', role: 'tablist' });
    const body = h('div');
    const clearBtn = h('button', { type: 'button', class: 'clear', 'aria-label': T('Effacer la recherche'), hidden: !search.value,
      onclick: () => { search.value = ''; clearBtn.hidden = true; render(); search.focus(); } }, icon('close'));
    // Filtres (0.8.1) : type, matériel, groupe musculaire, favoris, déjà faits. Un bouton à côté de la
    // recherche ouvre la fenêtre des filtres ; seuls les filtres choisis restent affichés, en pastilles.
    const F0 = ui.f || {};
    const F = { type: ['all', 'musc', 'str'].includes(F0.type) ? F0.type : 'all', eq: new Set(Array.isArray(F0.eq) ? F0.eq.filter((k) => EQUIP.some((x) => x[0] === k)) : []),
      group: GROUPS.has(F0.group) ? F0.group : 'all', fav: !!F0.fav, done: !!F0.done, uni: !!F0.uni, home: !!F0.home };
    const nF = () => (F.type !== 'all' ? 1 : 0) + F.eq.size + (F.group !== 'all' ? 1 : 0) + (F.fav ? 1 : 0) + (F.done ? 1 : 0) + (F.uni ? 1 : 0) + (F.home ? 1 : 0);
    const doneIds = () => new Set(S.entries.map((e) => e.exerciseId));
    const passF = (ex, dset) => (F.type === 'all' || (F.type === 'str' ? ex.st : !ex.st)) && (!F.eq.size || F.eq.has(eqOf(ex)))
      && (F.group === 'all' || ex.top === F.group) && (!F.fav || S.favs.has(ex.id)) && (!F.done || dset.has(ex.id))
      && (!F.uni || isUni(ex)) && (!F.home || isHome(ex));
    const fBtn = h('button', { type: 'button', class: 'filterbtn', 'aria-haspopup': 'dialog', onclick: () => openFilters() });
    const fRow = h('div', { class: 'fchips-row' });
    function paintF() {
      const n = nF();
      fBtn.textContent = '';
      fBtn.append(icon('sliders'));
      if (n) fBtn.append(h('span', { class: 'fbadge', text: String(n) }));
      fBtn.setAttribute('aria-label', n ? T('Filtres ({0} actifs)', n) : T('Filtres'));
      fBtn.classList.toggle('on', n > 0);
      fRow.textContent = '';
      fRow.hidden = !n;
      const pillX = (label, off) => h('button', { type: 'button', class: 'fchip on', 'aria-label': T('Retirer le filtre {0}', label), onclick: () => { off(); paintF(); render(); } }, label, icon('close'));
      if (F.type !== 'all') fRow.append(pillX(F.type === 'str' ? T('Étirements') : T('Musculation'), () => { F.type = 'all'; }));
      for (const k of F.eq) fRow.append(pillX(eqLabel(k), () => { F.eq.delete(k); }));
      if (F.group !== 'all') fRow.append(pillX(T((TREE.find((t) => t.id === F.group) || {}).label || ''), () => { F.group = 'all'; }));
      if (F.fav) fRow.append(pillX(T('Favoris'), () => { F.fav = false; }));
      if (F.done) fRow.append(pillX(T('Déjà faits'), () => { F.done = false; }));
      if (F.uni) fRow.append(pillX(T('Unilatéral'), () => { F.uni = false; }));
      if (F.home) fRow.append(pillX(T('À la maison'), () => { F.home = false; }));
      if (n > 1) fRow.append(h('button', { type: 'button', class: 'linkbtn', text: T('Tout effacer'), onclick: () => { resetF(); paintF(); render(); } }));
    }
    const resetF = () => { F.type = 'all'; F.eq.clear(); F.group = 'all'; F.fav = false; F.done = false; F.uni = false; F.home = false; };
    function openFilters() {
      bottomSheet((box, close) => {
        const dset = doneIds();
        const countBtn = h('button', { type: 'button', class: 'btn acc wide big', onclick: () => close(() => { paintF(); render(); }) });
        const paintCount = () => {
          const raw = search.value.trim();
          const n = (raw ? searchExercises(raw) : S.exercises).filter((ex) => passF(ex, dset)).length;
          countBtn.textContent = nF() ? T('Voir {0}', plural(n, 'exercice', 'exercices')) : T('Voir tous les exercices');
        };
        const sec = (title, ...kids) => h('section', { class: 'fsec' }, h('h3', { class: 'kicker', text: title }), h('div', { class: 'fchips' }, kids.flat()));
        const toggle = (label, on, fn) => { const b = h('button', { type: 'button', class: 'fchip', 'aria-pressed': String(on), text: label }); b.addEventListener('click', () => { fn(b); paintCount(); }); return b; };
        const single = (opts, get, set) => opts.map(([k, label]) => toggle(label, get() === k, (b) => { set(k); b.parentElement.querySelectorAll('.fchip').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
        box.append(h('div', { class: 'fhead' }, h('h2', { class: 'bs-title', text: T('Filtres') }),
          h('button', { type: 'button', class: 'linkbtn', text: T('Réinitialiser'), onclick: () => { resetF(); close(() => { paintF(); render(); openFilters(); }); } })));
        box.append(
          sec(T('Type'), single([['all', T('Tout')], ['musc', T('Musculation')], ['str', T('Étirements')]], () => F.type, (k) => { F.type = k; })),
          sec(T('Matériel'), EQUIP.map(([k]) => toggle(eqLabel(k), F.eq.has(k), (b) => { if (F.eq.has(k)) F.eq.delete(k); else F.eq.add(k); b.setAttribute('aria-pressed', String(F.eq.has(k))); }))),
          sec(T('Groupe musculaire'), single([['all', T('Tous')]].concat(TREE.map((t) => [t.id, T(t.label)])), () => F.group, (k) => { F.group = k; })),
          sec(T('Autres'), toggle(T('Favoris'), F.fav, (b) => { F.fav = !F.fav; b.setAttribute('aria-pressed', String(F.fav)); }),
            toggle(T('Déjà faits'), F.done, (b) => { F.done = !F.done; b.setAttribute('aria-pressed', String(F.done)); }),
            toggle(T('Unilatéral'), F.uni, (b) => { F.uni = !F.uni; b.setAttribute('aria-pressed', String(F.uni)); }),
            toggle(T('À la maison'), F.home, (b) => { F.home = !F.home; b.setAttribute('aria-pressed', String(F.home)); })),
          countBtn);
        box.classList.add('filters');
        paintCount();
      });
    }
    paintF();
    wrap.append(h('div', { class: 'searchrow' }, h('div', { class: 'searchbox' }, search, clearBtn), fBtn), fRow, tabBar, body);
    let tab = TABS.some((t) => t[0] === ui.tab) ? ui.tab : (S.favs.size ? 'fav' : 'musc');
    // Groupes dépliés (Musculation, Étirements) ou repliés (Favoris, dépliés par défaut).
    const toggled = new Set(Array.isArray(ui.open) ? ui.open : []);
    // Filtres de la recherche : type (favoris, musculation, étirements) et groupe musculaire.
    let sType = ['all', 'fav', 'musc', 'str'].includes(ui.sType) ? ui.sType : 'all';
    let sGroup = GROUPS.has(ui.sGroup) ? ui.sGroup : 'all';
    // 0.8.0 : on choisit d'abord une tuile (Favoris, un muscle, Étirements), puis la liste s'affiche.
    let grp = ui.grp === 'fav' || ui.grp === 'str' || TREE.some((t) => t.id === ui.grp) ? ui.grp : null;
    let sub = typeof ui.sub === 'string' ? ui.sub : 'all';
    S.getUI = () => ({ q: search.value, tab, open: [...toggled], sType, sGroup, grp, sub, f: { type: F.type, eq: [...F.eq], group: F.group, fav: F.fav, done: F.done, uni: F.uni, home: F.home } });
    search.placeholder = T('Ou cherche un exercice');
    const inTab = (ex) => (tab === 'fav' ? S.favs.has(ex.id) : tab === 'str' ? ex.st : !ex.st);
    const favIn = filePicker(async (f) => { if (await importPart(f, 'favs')) render(); });

    function onStar(ex) {
      if (search.value.trim() || tab !== 'fav' || S.favs.has(ex.id)) return;
      render();
      toast(T('Retiré des favoris'), { ms: 5000, action: () => { S.favs.add(ex.id); saveUser(); render(); } });
    }
    const exRow = (ex, showKind) => {
      const label = h('span', { class: 'nm' }, dn(ex), showKind && ex.st ? h('span', { class: 'kind', text: T('Étirement') }) : null);
      if (pick) {
        // Toute la ligne sélectionne ; la loupe agrandit l'animation.
        const row = h('div', { class: 'exrow pickrow' + (picked(ex.id) ? ' picked' : ''), role: 'checkbox', tabindex: '0', 'aria-checked': String(picked(ex.id)) });
        row.addEventListener('click', () => togglePick(ex, row));
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePick(ex, row); } });
        row.append(h('span', { class: 'tw' }, thumb(ex),
          ex.missing ? null : h('button', { type: 'button', class: 'loupe', 'aria-label': T('Agrandir l’animation de ') + dn(ex), onclick: (e) => { e.stopPropagation(); lightbox(ex); } }, icon('zoom'))),
          label, starBtn(ex.id), h('span', { class: 'pick', 'aria-hidden': 'true' }, icon('check')));
        return row;
      }
      return h('div', { class: 'exrow' },
        h('button', { type: 'button', class: 'open', onclick: () => go('exercise', ex.id) }, thumb(ex, { zoom: true }), label),
        starBtn(ex.id, () => onStar(ex)));
    };

    /* Un groupe repliable, fermé par défaut (Favoris compris) ; son contenu n'est construit qu'à
       l'ouverture et il est retiré quand on le referme (moins de mémoire utilisée). */
    function group(gid, label, count, fill, cls) {
      const key = tab + ':' + gid;
      const d = h('details', { class: 'group ' + (cls || '') },
        h('summary', {}, h('span', {}, label, h('span', { class: 'count', text: String(count) })), icon('down')));
      let content = null;
      const ensure = () => { if (!content) { content = fill(); d.append(content); } };
      if (toggled.has(key)) { d.open = true; ensure(); }
      // Une seule catégorie ouverte à la fois (à chaque niveau). La catégorie touchée reste à la même
      // place à l'écran, même si celle qu'on referme au-dessus contenait des centaines d'exercices.
      const sum = d.firstChild;
      sum.addEventListener('click', (e) => {
        e.preventDefault();
        const top = sum.getBoundingClientRect().top;
        const opening = !d.open;
        if (opening && d.parentElement) d.parentElement.querySelectorAll(':scope > details.group[open]').forEach((o) => { if (o !== d) o.open = false; });
        d.open = opening;
        if (opening) ensure();   // contenu ajouté tout de suite, pour que la page ait sa hauteur finale
        const shift = sum.getBoundingClientRect().top - top;
        if (shift) window.scrollBy(0, shift);
      });
      d.addEventListener('toggle', () => {
        if (d.open) { ensure(); toggled.add(key); } else {
          toggled.delete(key);
          if (content) { content.querySelectorAll('.thumb').forEach((t) => { if (thumbIO) thumbIO.unobserve(t); if (t._play) t._play(false); }); content.remove(); content = null; }
        }
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
          h('strong', { text: T('Liste des exercices indisponible') }),
          h('p', { class: 'err', text: T('Le fichier des exercices n’a pas pu être lu. Vérifie ta connexion puis réessaie.') }),
          h('button', { type: 'button', class: 'btn primary', text: T('Réessayer'), onclick: async () => { await loadExercises(); render(); } })));
        return;
      }
      const raw = search.value.trim();
      renderTabs(!!raw);
      if (raw || nF()) {
        // Recherche dans tous les exercices, puis les filtres choisis.
        const dset = doneIds();
        const found = raw ? searchExercises(raw) : S.exercises.slice().sort((a, b) => dn(a).localeCompare(dn(b), 'fr'));
        const hits = found.filter((ex) => passF(ex, dset));
        body.append(h('p', { class: 'res-n', text: plural(hits.length, 'exercice', 'exercices') }));
        if (!hits.length) { body.append(h('p', { class: 'empty-note', text: raw && !found.length ? T('Aucun exercice ne correspond à « {0} ».', raw) : T('Aucun exercice avec ces filtres.') })); return; }
        body.append(h('div', { class: 'results' }, hits.slice(0, 80).map((ex) => exRow(ex, true))));
        if (hits.length > 80) body.append(h('p', { class: 'empty-note more', text: T('{0} résultats, les 80 premiers sont affichés. Précise ta recherche ou ajoute un filtre.', hits.length) }));
        return;
      }
      tabBar.hidden = true;
      const pickGrp = (g) => { grp = g; sub = 'all'; toggled.clear(); render(); window.scrollTo(0, 0); };
      if (!grp) {
        // Les tuiles : Favoris, chaque groupe musculaire, Étirements.
        const nMusc = (id) => S.exercises.filter((ex) => ex.top === id && !ex.st).length;
        const nFav = S.exercises.filter((ex) => S.favs.has(ex.id)).length;
        const nStr = S.exercises.filter((ex) => ex.st).length;
        const tile = (g, label, n, cls, ic) => h('button', { type: 'button', class: 'mtile ' + (cls || ''), style: GROUPS.get(g) ? { '--c': GROUPS.get(g).color } : null, onclick: () => pickGrp(g) },
          h('span', { class: 'mt-top' }, ic ? icon(ic, ic === 'star' ? 'fill' : '') : h('span', { class: 'mt-dot', 'aria-hidden': 'true' }), h('span', { class: 'mt-n', text: fmtNum(n) })),
          h('strong', { text: label }));
        body.append(h('h2', { class: 'lib-q', text: T('Choisis un muscle') }),
          h('div', { class: 'mtiles' },
            tile('fav', T('Favoris'), nFav, 'acc', 'star'),
            TREE.filter((t) => nMusc(t.id)).map((t) => tile(t.id, t.label, nMusc(t.id), '', null)),
            nStr ? tile('str', T('Étirements'), nStr, 'vio', 'body') : null));
        return;
      }
      const gLabel = grp === 'fav' ? T('Favoris') : grp === 'str' ? T('Étirements') : TREE.find((t) => t.id === grp).label;
      body.append(h('div', { class: 'grp-head' },
        h('button', { type: 'button', class: 'pill', onclick: () => pickGrp(null) }, icon('left'), T('Muscles')),
        h('h2', { text: gLabel }),
        grp === 'fav' && !pick ? h('button', { type: 'button', class: 'iconbtn', 'aria-label': T('Exporter ou importer les favoris'), onclick: () => actionSheet(T('Favoris'), [
          { icon: 'export', label: T('Exporter les favoris'), run: exportFavs },
          { icon: 'import', label: T('Importer des favoris'), run: () => favIn.click() }]) }, icon('dots', 'fill')) : null,
        grp === 'fav' ? favIn : null));
      if (grp !== 'fav' && grp !== 'str') {
        // Un groupe musculaire : ses sous-groupes en pastilles, puis la liste.
        tab = 'musc';
        const t = TREE.find((x) => x.id === grp);
        const subs = (t.subs || []).filter((x) => leafList(x.id).length);
        if (subs.length) {
          if (sub !== 'all' && !subs.some((x) => x.id === sub)) sub = 'all';
          body.append(h('div', { class: 'chips scroll', role: 'group', 'aria-label': T('Groupe musculaire') },
            [['all', T('Tout')]].concat(subs.map((x) => [x.id, x.label])).map(([id, label]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(sub === id),
              onclick: () => { sub = id; render(); } }, label))));
        }
        const list = subs.length ? (sub === 'all' ? subs.flatMap((x) => leafList(x.id)) : leafList(sub)) : leafList(t.id);
        if (!list.length) { body.append(h('p', { class: 'empty-note', text: T('Aucun exercice dans cette catégorie.') })); return; }
        body.append(h('div', { class: 'results' }, list.map((ex) => exRow(ex))));
        return;
      }
      tab = grp;
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
      // Favoris : exporter seulement les favoris, ou importer ceux d'un fichier.
      if (!wrapG.childElementCount) {
        body.append(h('p', { class: 'empty-note', text: tab === 'fav' ? T('Aucun favori pour l’instant. Touche l’étoile à côté d’un exercice pour le retrouver ici, rangé par catégorie.') : T('Aucun exercice dans cet onglet.') }));
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
    wrap.append(h('header', { class: 'bar' }, backBtn(), h('h1', { class: 'grow', text: T('Historique') }),
      h('button', { type: 'button', class: 'textbtn danger', text: T('Tout supprimer'), onclick: wipeAll })));
    wrap.append(h('div', { class: 'tools' },
      h('button', { type: 'button', class: 'pill', onclick: exportData }, icon('export'), T('Exporter')),
      h('button', { type: 'button', class: 'pill', onclick: () => fileIn.click() }, icon('import'), T('Importer')), fileIn));
    const list = h('div');
    wrap.append(list);

    function render() {
      list.textContent = '';
      if (!S.entries.length) { list.append(h('p', { class: 'empty-note', text: T('Aucune série enregistrée. Elles apparaîtront ici dès ta première validation.') })); return; }
      const sorted = [...S.entries].sort((a, b) => b.ts - a.ts || (b.created || 0) - (a.created || 0));
      let cur = '';
      for (const e of sorted) {
        const k = dayKey(e.ts);
        if (k !== cur) { cur = k; list.append(h('div', { class: 'dayhead', text: dayLabel(new Date(e.ts)) })); }
        const ex = getEx(e.exerciseId, e.name);
        list.append(h('div', { class: 'hrow' },
          h('button', { type: 'button', class: 'hedit', 'aria-label': T('Modifier : ') + dn(ex) + ', ' + entryText(e), onclick: () => editEntry(e, render) }, h('div', { class: 'nm', text: dn(ex) }),
            h('div', { class: 'meta' }, h('b', { text: entryText(e) }), (e.c === 1 ? '' : T(' · total ') + fmtNum(e.w * e.r)) + ' · ' + fTime.format(e.ts))),
          h('button', { type: 'button', class: 'iconbtn', 'aria-label': T('Supprimer cette série'), onclick: () => removeOne(e) }, icon('trash'))));
      }
    }
    function removeOne(e) {
      const idx = S.entries.findIndex((x) => x.id === e.id);
      if (idx < 0) return;
      S.entries.splice(idx, 1);
      saveUser(); render();
      toast(T('Série supprimée'), { ms: 5000, action: () => { S.entries.push(e); saveUser(); render(); } });
    }
    async function wipeAll() {
      const nSess = Object.keys(S.sessions).length + Object.keys(S.days).length;
      if (!S.entries.length && !nSess) { toast(T('Il n’y a rien à supprimer.')); return; }
      const ok = await confirmDialog({ title: T('Êtes-vous sûr de vouloir faire ça ?'), text: T('Toutes les séries (') + S.entries.length + T('), les noms et notes de séances seront supprimés. Tes favoris, tes notes d’exercices et tes séances types sont conservés.'), yes: T('Oui'), no: T('Non') });
      if (!ok) return;
      S.entries = []; S.sessions = {}; S.days = {}; await saveUser(); render(); toast(T('Historique supprimé'));
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
  /* ---------- export et import ----------
     Export complet (Historique) : tout ce que tu as rempli. Exports partiels : favoris (onglet Favoris
     de la bibliothèque) ou séances types (Mes séances). Un import ajoute ce qui manque, sans rien
     effacer ni créer de doublon. */
  const stamp = () => dayKey(Date.now());
  async function exportData() {
    const data = Object.assign({ app: 'WorkLog', version: DATA_V, kind: 'all', exportedAt: new Date().toISOString() }, userData());
    data.favorites = data.favs; delete data.favs;
    const ok = await shareFile('worklog-' + stamp() + '.json', JSON.stringify(data, null, 2), 'application/json');
    if (ok) toast(T('Sauvegarde prête : enregistre-la dans ton dossier.'));
  }
  async function exportFavs() {
    if (!S.favs.size) { toast(T('Aucun favori à exporter.')); return; }
    const names = {};
    for (const id of S.favs) names[id] = getEx(id).name;
    const data = { app: 'WorkLog', version: DATA_V, kind: 'favorites', exportedAt: new Date().toISOString(), favorites: [...S.favs], names };
    const ok = await shareFile('worklog-favoris-' + stamp() + '.json', JSON.stringify(data, null, 2), 'application/json');
    if (ok) toast(T('{0} prêts : enregistre le fichier.', plural(S.favs.size, 'favori', 'favoris')));
  }
  async function exportPlans(ids) {
    const plans = S.plans.filter((p) => ids.includes(p.id));
    if (!plans.length) return;
    const data = { app: 'WorkLog', version: DATA_V, kind: 'plans', exportedAt: new Date().toISOString(), plans,
      folders: [...new Set(plans.map((p) => p.folder).filter(Boolean))] };
    const ok = await shareFile('worklog-seances-' + stamp() + '.json', JSON.stringify(data, null, 2), 'application/json');
    if (ok) toast(T('{0} prêtes : enregistre le fichier.', plural(plans.length, 'séance', 'séances')));
  }
  /* Choix des séances types à exporter : toutes, ou seulement celles cochées. */
  function exportPlansSheet() {
    if (!S.plans.length) { toast(T('Aucune séance type à exporter.')); return; }
    const sel = new Set(S.plans.map((p) => p.id));
    bottomSheet((box, close) => {
      box.append(h('h2', { class: 'bs-title', text: T('Exporter des séances') }));
      const all = h('input', { type: 'checkbox' });
      const go = h('button', { type: 'button', class: 'btn primary wide' });
      const boxes = [];
      const paint = () => { all.checked = sel.size === S.plans.length; all.indeterminate = sel.size > 0 && sel.size < S.plans.length; go.textContent = T('Exporter ({0})', sel.size); go.disabled = !sel.size; boxes.forEach(([cb, id]) => { cb.checked = sel.has(id); }); };
      all.addEventListener('change', () => { if (all.checked) S.plans.forEach((p) => sel.add(p.id)); else sel.clear(); paint(); });
      box.append(h('label', { class: 'gs-row allrow' }, all, h('span', { class: 'gl', text: T('Tout sélectionner') })));
      const list = h('div', { class: 'gs-list' });
      const folders = allFolders().concat(['']);
      for (const f of folders) {
        const ps = S.plans.filter((p) => p.folder === f).sort((a, b) => planTitle(a).localeCompare(planTitle(b), LANG));
        if (!ps.length) continue;
        list.append(h('p', { class: 'gs-head', text: f || T('Sans dossier') }));
        for (const p of ps) {
          const cb = h('input', { type: 'checkbox' });
          cb.addEventListener('change', () => { if (cb.checked) sel.add(p.id); else sel.delete(p.id); paint(); });
          boxes.push([cb, p.id]);
          list.append(h('label', { class: 'gs-row' }, cb, h('span', { class: 'gl', text: planTitle(p) }), h('span', { class: 'gm', text: plural(p.items.length, 'exercice', 'exercices') })));
        }
      }
      go.addEventListener('click', () => close(() => exportPlans([...sel])));
      box.append(list, go, h('button', { type: 'button', class: 'btn ghost wide bs-cancel', text: T('Annuler'), onclick: () => close() }));
      paint();
    });
  }
  /* Ajoute le contenu d'un fichier WorkLog. parts : ce qu'on prend du fichier ('favs', 'plans') ; absent = tout. */
  function mergeData(d, parts) {
    const want = (k) => !parts || parts.includes(k);
    const res = { added: 0, dupes: 0, invalid: 0, favs: 0, plans: 0, plansDup: 0 };
    if (want('entries') && Array.isArray(d.entries)) {
      // Chaque série a son identifiant : une série déjà présente n'est pas ajoutée deux fois
      // (deux séries identiques faites à la même minute restent bien deux séries).
      const ids = new Set(S.entries.map((e) => e.id));
      for (const raw of d.entries) {
        if (!validEntry(raw)) { res.invalid++; continue; }
        if (ids.has(raw.id)) { res.dupes++; continue; }
        const e = normEntry(raw);
        S.entries.push(e); ids.add(e.id); res.added++;
      }
    }
    if (want('favs')) {
      const favs = Array.isArray(d.favorites) ? d.favorites : Array.isArray(d.favs) ? d.favs : [];
      favs.forEach((id) => { if (typeof id === 'string' && !S.favs.has(id)) { S.favs.add(id); res.favs++; } });
    }
    if (want('all')) {
      // Noms de séances, notes, journées : on ajoute ceux qui manquent, sans écraser ceux déjà présents.
      for (const [k, v] of Object.entries(cleanSessions(d.sessions))) if (!S.sessions[k]) S.sessions[k] = v;
      for (const [k, v] of Object.entries(cleanNotes(d.notes))) if (!S.notes[k]) S.notes[k] = v;
      for (const [k, v] of Object.entries(cleanDays(d.days))) if (!S.days[k]) S.days[k] = v;
    }
    if (want('plans')) {
      const sigOf = (p) => planSig(Object.assign({}, p, { folder: '' }));
      const have = new Set(S.plans.map((p) => p.id)); const sigs = new Set(S.plans.map(sigOf));
      for (const p of cleanPlans(d.plans)) {
        if (have.has(p.id) || sigs.has(sigOf(p))) { res.plansDup++; continue; }
        S.plans.push(p); have.add(p.id); sigs.add(sigOf(p)); res.plans++;
        if (p.folder && !S.folders.includes(p.folder)) S.folders.push(p.folder);
      }
      S.folders = cleanFolders(S.folders.concat(want('all') && Array.isArray(d.folders) ? d.folders : []));
    }
    if (want('all')) {
      const have = new Set(S.schedules.map((x) => x.id));
      for (const sc of cleanSchedules(d.schedules)) if (!have.has(sc.id) && S.plans.some((p) => p.id === sc.plan)) S.schedules.push(sc);
      const st = cleanSettings(d.settings);
      if (st.bw && !bwKg()) S.settings.bw = st.bw;
      for (const [k, v] of Object.entries(st.steps)) if (!S.settings.steps[k]) S.settings.steps[k] = v;
      if (st.diag) S.settings.diag = true;
      if (st.nas.url && !S.settings.nas.url) S.settings.nas = st.nas;
    }
    return res;
  }
  async function readWorkLog(file) {
    if (file.size > 20 * 1024 * 1024) throw new Error('trop gros');
    const d = JSON.parse(await file.text());
    if (!d || d.app !== 'WorkLog') throw new Error('format');
    return d;
  }
  /* Import depuis Historique : tout le contenu du fichier. */
  async function importFile(file) {
    try {
      const d = await readWorkLog(file);
      if (!Array.isArray(d.entries) && !Array.isArray(d.plans) && !Array.isArray(d.favorites)) throw new Error('format');
      const r = mergeData(d, d.kind === 'favorites' ? ['favs'] : d.kind === 'plans' ? ['plans'] : null);
      await saveUser();
      await migrateAliases();
      const bits = [];
      if (Array.isArray(d.entries)) bits.push(plural(r.added, 'série ajoutée', 'séries ajoutées') + (r.dupes ? ', ' + plural(r.dupes, 'déjà présente', 'déjà présentes') : '') + (r.invalid ? ', ' + plural(r.invalid, 'ligne invalide ignorée', 'lignes invalides ignorées') : ''));
      if (r.favs) bits.push(plural(r.favs, 'favori ajouté', 'favoris ajoutés'));
      if (r.plans) bits.push(plural(r.plans, 'séance type ajoutée', 'séances types ajoutées'));
      toast(bits.join(' · ') || T('Rien de nouveau dans ce fichier.'), { ms: 4500 });
      return true;
    } catch (e) {
      toast(T('Fichier non reconnu : choisis une sauvegarde WorkLog (.json).'));
      return false;
    }
  }
  /* Import partiel : seulement les favoris, ou seulement les séances types, d'un fichier WorkLog (partiel ou complet). */
  async function importPart(file, part) {
    try {
      const d = await readWorkLog(file);
      const r = mergeData(d, [part]);
      await saveUser();
      await migrateAliases();
      if (part === 'favs') toast(r.favs ? plural(r.favs, 'favori ajouté', 'favoris ajoutés') : T('Aucun nouveau favori dans ce fichier.'));
      else toast(r.plans ? plural(r.plans, 'séance ajoutée', 'séances ajoutées') + (r.plansDup ? ', ' + plural(r.plansDup, 'déjà présente', 'déjà présentes') : '') : T('Aucune nouvelle séance dans ce fichier.'), { ms: 4500 });
      return true;
    } catch (e) {
      toast(T('Fichier non reconnu : choisis un fichier WorkLog (.json).'));
      return false;
    }
  }
  const filePicker = (onFile) => {
    const inp = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; inp.value = ''; if (f) onFile(f); });
    return inp;
  };

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
  /* 0.8.2 : les séances d'une journée, dans l'ordre où elles ont été prévues (la première en haut,
     celles ajoutées ensuite en dessous), puis les exercices ajoutés à la main.
     La première séance porte le nom donné à la journée (bouton « Modifier »). */
  function dayGroups(key) {
    const d = S.days[key];
    const order = dayOrder(key);
    const groups = [];
    const seen = new Set();
    for (const pid of (d && d.src) || []) {
      const p = S.plans.find((x) => x.id === pid);
      if (!p) continue;
      const inPlan = new Set(p.items.map((it) => it.ex));
      const ids = order.filter((id) => inPlan.has(id) && !seen.has(id));
      if (!ids.length) continue;
      ids.forEach((id) => seen.add(id));
      groups.push({ plan: p, ids });
    }
    const rest = order.filter((id) => !seen.has(id));
    const s = S.sessions[key];
    const own = s && d ? d.own : null;
    if (rest.length) {
      // Une séance recopiée (« Refaire cette séance ») qui a donné son nom à la journée est une séance à part
      // entière : elle a sa carte, et elle passe en haut car elle a été choisie en premier.
      const copy = own === 'copy' && groups.length > 0;
      if (copy) groups.unshift({ plan: null, ids: rest, loose: false });
      else groups.push({ plan: null, ids: rest, loose: groups.length > 0 });
    }
    // Le nom de la journée va à la séance qui l'a donné ; sinon (anciennes données, nom choisi à la main) à la première.
    let named = s ? groups.findIndex((g) => (own === 'copy' ? !g.plan : g.plan && g.plan.id === own)) : -1;
    if (s && named < 0) named = 0;
    groups.forEach((g, i) => {
      if (i === named) { g.title = sessionTitle(s); g.main = s.main; g.sec = s.sec; g.named = true; }
      else if (g.plan) { g.title = planTitle(g.plan); g.main = GROUPS.has(g.plan.main) ? g.plan.main : guessMain(g.ids); g.sec = g.plan.sec || []; }
      else { g.title = T('Exercices ajoutés'); g.main = guessMain(g.ids); g.sec = []; }
    });
    return groups;
  }
  const dayFlow = (key) => dayGroups(key).flatMap((g) => g.ids);
  /* La prochaine série prévue d'un exercice, si elle est complète : elle se valide d'un appui. */
  function plannedNext(key, id) {
    const d = S.days[key];
    const p = d && d.plan[id];
    if (!p || !p.length) return null;
    const n = dayEntries(key).filter((e) => e.exerciseId === id).length;
    const st = p[n];
    const ex = getEx(id);
    if (!st || ex.missing) return null;
    const out = (vals) => ({ n: n + 1, of: p.length, vals, text: plannedText(st) });
    if (cardioKind(ex)) return fin(st.dur) && st.dur > 0 ? out({ c: 1, dur: st.dur }) : null;
    if (st.dur !== undefined || !(fin(st.r) && st.r > 0)) return null;
    if (st.bw) { if (!canBW(ex) || !bwKg()) return null; const r = valsToEntry({ w: fin(st.w) ? st.w : 0, r: st.r, bw: true }); return r.ok ? out(r.vals) : null; }
    return fin(st.w) && st.w > 0 ? out({ w: r2(st.w), r: st.r }) : null;
  }
  async function quickValidate(key, id, after) {
    const q = plannedNext(key, id);
    if (!q) return;
    const e = await saveSet(getEx(id), q.vals, Date.now());
    S.qvSaved = { id: e.id, ex: id, text: T('Série {0} enregistrée · {1}', q.n, entryText(e)) };
    after();
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
    delete d.hidden;
    d.order = dayOrder(key);
    for (const it of src.items) {
      if (!d.order.includes(it.ex)) d.order.push(it.ex);
      const sets = (it.sets || []).filter(keepSet);
      if (sets.length) d.plan[it.ex] = sets.map(cleanSet);
    }
    // La journée garde le lien vers la séance type d'origine (pour la retirer si la séance type est supprimée).
    if (src.id && S.plans.some((p) => p.id === src.id)) d.src = [...new Set((d.src || []).concat(src.id))];
    const main = GROUPS.has(src.main) ? src.main : guessMain(src.items.map((it) => it.ex));
    if (main && !S.sessions[key]) {
      S.sessions[key] = { name: (src.name || '').trim(), main, sec: (src.sec || []).filter((x) => GROUPS.has(x) && x !== main) };
      d.own = src.id && S.plans.some((p) => p.id === src.id) ? src.id : 'copy';
    }
  }
  const sessionTitle = (s) => s.name || GROUPS.get(s.main).label;

  /* ---------- programmation des séances types ----------
     Une date précise : la séance est ajoutée tout de suite à ce jour du calendrier.
     Une répétition (chaque semaine, toutes les 2 à 4 semaines, certains jours) : chaque date est
     affichée dans le calendrier et ajoutée au jour même (ou quand on ouvre ce jour à l'avance). */
  const wdOf = (key) => (keyDate(key).getDay() + 6) % 7;   // 0 = lundi … 6 = dimanche
  const mondayOf = (key) => { const d = keyDate(key); d.setDate(d.getDate() - wdOf(key)); return d.getTime(); };
  const WD = (style) => [0, 1, 2, 3, 4, 5, 6].map((i) => new Intl.DateTimeFormat(LOC(), { weekday: style }).format(new Date(2024, 0, 1 + i)));
  function occurs(sc, key) {
    if (key < sc.start || (sc.until && key > sc.until) || !sc.days.includes(wdOf(key))) return false;
    return Math.round((mondayOf(key) - mondayOf(sc.start)) / (7 * 86400000)) % sc.every === 0;
  }
  const pendingFor = (key) => S.schedules.filter((sc) => !sc.made.includes(key) && occurs(sc, key) && S.plans.some((p) => p.id === sc.plan));
  /* Ajoute au jour les séances programmées (aujourd'hui ou un jour à venir). */
  function materialize(key) {
    const tk = todayKey();
    if (key < tk) return false;
    const list = pendingFor(key);
    if (!list.length) return false;
    for (const sc of list) { startDay(key, S.plans.find((x) => x.id === sc.plan)); sc.made.push(key); }
    S.schedules.forEach((sc) => { sc.made = sc.made.filter((k) => k >= tk); });
    saveUser();
    return true;
  }
  const joinList = (arr) => (arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' ' + T('et') + ' ' + arr[arr.length - 1]);
  function schedText(sc) {
    const names = WD('long'); const days = joinList(sc.days.map((i) => names[i]));
    const rep = sc.every === 1 ? T('chaque {0}', days) : T('toutes les {0} semaines : {1}', sc.every, days);
    return rep + ' · ' + T('à partir du {0}', fDayShort.format(keyDate(sc.start))) + (sc.until ? ' · ' + T('jusqu’au {0}', fDayShort.format(keyDate(sc.until))) : '');
  }
  /* Retire d'un ou plusieurs jours les exercices prévus (pas encore faits) d'une séance type.
     keys absent : tous les jours liés à cette séance type. Les séries déjà faites restent. */
  function unplan(p, keys) {
    const ids = new Set(p.items.map((it) => it.ex));
    const nm = p.name.trim();
    for (const [k, d] of Object.entries(S.days)) {
      if (keys && !keys.includes(k)) continue;
      const linked = (d.src || []).includes(p.id) || (!d.src && nm && S.sessions[k] && S.sessions[k].name === nm);
      if (!linked) continue;
      const done = new Set(dayEntries(k).map((e) => e.exerciseId));
      d.order = d.order.filter((id) => done.has(id) || !ids.has(id));
      for (const id of Object.keys(d.plan)) if (!done.has(id) && ids.has(id)) delete d.plan[id];
      if (d.src) { d.src = d.src.filter((x) => x !== p.id); if (!d.src.length) delete d.src; }
      if (!done.size && S.sessions[k] && (!S.sessions[k].name || S.sessions[k].name === nm)) delete S.sessions[k];
      if (!d.order.length && !d.note) delete S.days[k];
    }
  }
  /* Supprime une séance type : sa programmation et ses exercices prévus non faits disparaissent du calendrier. */
  async function removePlan(p) {
    S.plans = S.plans.filter((x) => x.id !== p.id);
    S.schedules = S.schedules.filter((sc) => sc.plan !== p.id);
    unplan(p);
    await saveUser();
  }
  async function removeSchedule(sc) {
    const p = S.plans.find((x) => x.id === sc.plan);
    S.schedules = S.schedules.filter((x) => x !== sc);
    const tk = todayKey();
    if (p) unplan(p, sc.made.filter((k) => k >= tk && !dayEntries(k).length));
    await saveUser();
  }
  /* Fenêtre « Programmer » : séance type, date, répétition (jours de la semaine, fin facultative). */
  function scheduleDialog(opts) {
    const plans = S.plans.slice().sort((a, b) => planTitle(a).localeCompare(planTitle(b), LANG));
    if (!plans.length) { toast(T('Crée d’abord une séance type (Séances › Créer une séance).')); return; }
    const tk = todayKey();
    let planId = opts.plan ? opts.plan.id : plans[0].id;
    const planSel = opts.plan ? null : h('select', { class: 'field left', id: 'sc-plan' }, plans.map((p) => h('option', { value: p.id, text: planTitle(p) })));
    if (planSel) planSel.addEventListener('change', () => { planId = planSel.value; });
    const dateIn = h('input', { class: 'field left', type: 'date', id: 'sc-date', min: tk });
    dateIn.value = opts.date && opts.date >= tk ? opts.date : tk;
    const repSel = h('select', { class: 'field left', id: 'sc-rep' },
      [['0', T('Une seule fois')], ['1', T('Chaque semaine')], ['2', T('Toutes les 2 semaines')], ['3', T('Toutes les 3 semaines')], ['4', T('Toutes les 4 semaines')]].map(([v, t]) => h('option', { value: v, text: t })));
    const days = new Set([wdOf(dateIn.value)]);
    const dayBox = h('div', { class: 'wdays', role: 'group', 'aria-label': T('Jours de la semaine') });
    const untilIn = h('input', { class: 'field left', type: 'date', id: 'sc-until', min: tk });
    const repBox = h('div', { class: 'repbox', hidden: true }, h('span', { class: 'lbl', text: T('Jours') }), dayBox,
      h('label', { class: 'lbl', for: 'sc-until', text: T('Jusqu’au (facultatif)') }), untilIn);
    const msg = h('p', { class: 'form-msg', role: 'alert' });
    function paintDays() {
      dayBox.textContent = '';
      const short = WD('narrow'); const long = WD('long');
      short.forEach((t, i) => dayBox.append(h('button', { type: 'button', class: 'wd', 'aria-pressed': String(days.has(i)), 'aria-label': long[i], text: t,
        onclick: () => { if (days.has(i)) { if (days.size > 1) days.delete(i); } else days.add(i); paintDays(); } })));
    }
    paintDays();
    repSel.addEventListener('change', () => { repBox.hidden = repSel.value === '0'; });
    dateIn.addEventListener('change', () => { if (isKey(dateIn.value) && days.size === 1) { days.clear(); days.add(wdOf(dateIn.value)); paintDays(); } msg.textContent = ''; });
    let close = null;
    async function save() {
      const date = dateIn.value;
      if (!isKey(date) || date < tk) { msg.textContent = T('Choisis une date à partir d’aujourd’hui.'); return; }
      const p = S.plans.find((x) => x.id === planId);
      if (!p) return;
      if (!p.items.length) { msg.textContent = T('Cette séance type n’a pas encore d’exercice.'); return; }
      const every = Number(repSel.value);
      if (!every) {
        startDay(date, p);
        if (date === tk) p.last = tk;
        await saveUser();
        close();
        toast(T('« {0} » prévue le {1}', planTitle(p), fDayLong.format(keyDate(date))));
      } else {
        const until = untilIn.value;
        if (until && (!isKey(until) || until < date)) { msg.textContent = T('La date de fin doit être après la date de début.'); return; }
        const sc = { id: uid(), plan: p.id, start: date, every, days: [...days].sort(), until: until || '', made: [] };
        S.schedules.push(sc);
        materialize(tk);
        await saveUser();
        close();
        toast(T('« {0} » programmée {1}', planTitle(p), schedText(sc)), { ms: 5000 });
      }
      if (opts.onDone) opts.onDone(date);
    }
    const box = h('div', { class: 'dialog sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' },
      h('h2', { id: 'dlg-t', text: opts.plan ? T('Programmer « {0} »', planTitle(opts.plan)) : T('Prévoir une séance') }),
      planSel ? h('label', { class: 'lbl', for: 'sc-plan', text: T('Séance type') }) : null, planSel,
      h('label', { class: 'lbl', for: 'sc-date', text: T('Date') }), dateIn,
      h('label', { class: 'lbl', for: 'sc-rep', text: T('Répétition') }), repSel, repBox, msg,
      h('div', { class: 'acts' }, h('button', { type: 'button', class: 'btn ghost', text: T('Annuler'), onclick: () => close() }),
        h('button', { type: 'button', class: 'btn primary', text: T('Programmer'), onclick: save })));
    close = openModal(box);
  }

  /* ---------- calendrier ---------- */
  /* Jours où un record de charge a été battu (charge plus lourde que toutes les précédentes de l'exercice). */
  function recordDays() {
    const best = new Map(); const out = new Map();
    const list = S.entries.filter(isLift).slice().sort((a, b) => a.ts - b.ts || (a.created || 0) - (b.created || 0));
    for (const e of list) {
      const prev = best.get(e.exerciseId);
      if (prev !== undefined && e.w > prev) { const k = dayKey(e.ts); out.set(k, (out.get(k) || 0) + 1); }
      if (prev === undefined || e.w > prev) best.set(e.exerciseId, e.w);
    }
    return out;
  }
  /* Semaines d'affilée avec au moins une séance (la semaine en cours compte dès sa première série). */
  function weekStreak(byDay) {
    const weeks = new Set([...byDay.keys()].map(mondayOf));
    let w = mondayOf(todayKey());
    if (!weeks.has(w)) w -= 7 * 86400000;
    let n = 0;
    while (weeks.has(w)) { n++; const d = new Date(w); d.setDate(d.getDate() - 7); w = d.getTime(); }
    return n;
  }
  function viewCalendar(arg, ui) {
    const wrap = h('main', { class: 'page sessions calendar' });
    wrap.append(h('header', { class: 'bar' }, h('h1', { class: 'grow big', text: T('Calendrier') }),
      h('button', { type: 'button', class: 'pill', onclick: () => go('history') }, icon('history'), T('Historique'))));
    let sel = /^\d{4}-\d{2}-\d{2}$/.test(ui.sel || '') ? ui.sel : (arg && arg.day) || todayKey();
    if (!S.cal || (arg && arg.day && !ui.sel)) { const d = keyDate(sel); S.cal = { y: d.getFullYear(), m: d.getMonth() }; }
    S.getUI = () => ({ sel });
    const box = h('div');
    wrap.append(box);
    const select = (k) => { sel = k; const d = keyDate(k); S.cal = { y: d.getFullYear(), m: d.getMonth() }; render(); };

    function render() {
      box.textContent = '';
      materialize(sel);   // séance programmée ce jour-là (aujourd'hui ou à venir) : ajoutée au jour
      const { y, m } = S.cal;
      const now = new Date();
      const isCurrent = y === now.getFullYear() && m === now.getMonth();
      const byDay = daysIndex();
      const recs = recordDays();
      const streak = weekStreak(byDay);
      if (streak) {
        box.append(h('section', { class: 'streak' }, h('span', { class: 'streak-ic' }, icon('flame')),
          h('div', {}, h('strong', { text: streak > 1 ? T('{0} semaines d’affilée', streak) : T('1 semaine d’affilée') }),
            h('span', { text: T('avec au moins une séance par semaine') }))));
      }
      box.append(h('div', { class: 'monthbar' },
        h('button', { type: 'button', class: 'iconbtn', 'aria-label': T('Mois précédent'), onclick: () => { S.cal = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }; render(); } }, icon('left')),
        h('h2', { text: fMonth.format(new Date(y, m, 1)) }),
        h('button', { type: 'button', class: 'iconbtn', 'aria-label': T('Mois suivant'), onclick: () => { S.cal = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }; render(); } }, icon('right'))));
      const grid = h('div', { class: 'cal heat' });
      WD('narrow').forEach((d) => grid.append(h('div', { class: 'wd', 'aria-hidden': 'true', text: d.toUpperCase() })));
      const lead = (new Date(y, m, 1).getDay() + 6) % 7;
      for (let i = 0; i < lead; i++) grid.append(h('div'));
      const nDays = new Date(y, m + 1, 0).getDate();
      let sessions = 0; let nRec = 0; let nSets = 0;
      for (let d = 1; d <= nDays; d++) {
        const k = y + '-' + pad2(m + 1) + '-' + pad2(d);
        const has = byDay.has(k);
        const planned = !has && ((S.days[k] && S.days[k].order.length > 0) || (k >= todayKey() && pendingFor(k).length > 0));
        const rec = recs.get(k) || 0;
        if (has) { sessions++; nSets += byDay.get(k).length; }
        nRec += rec;
        const named = has && S.sessions[k];
        const isToday = isCurrent && d === now.getDate();
        const ng = named && GROUPS.get(named.main);
        grid.append(h('button', {
          type: 'button', class: 'day' + (has ? ' has' : '') + (rec ? ' rec' : '') + (planned ? ' planned' : '') + (isToday ? ' today' : '') + (k === sel ? ' sel' : '') + (ng ? ' named' : ''), text: String(d),
          style: ng ? { '--c': ng.color } : null,
          'aria-pressed': String(k === sel),
          'aria-label': d + ' ' + fMonth.format(new Date(y, m, 1)) + (has ? T(', séance') : planned ? T(', séance prévue') : '') + (rec ? T(', record') : '') + (named ? ' : ' + sessionTitle(named) : ''),
          onclick: () => select(k),
        }));
      }
      box.append(grid);
      box.append(h('div', { class: 'cal-legend', 'aria-hidden': 'true' },
        h('span', {}, h('i', { class: 'lg has' }), T('Séance')), h('span', {}, h('i', { class: 'lg rec' }), T('Record')),
        h('span', {}, h('i', { class: 'lg planned' }), T('Prévue')), h('span', {}, h('i', { class: 'lg today' }), T('Aujourd’hui'))));
      box.append(h('div', { class: 'mstats' },
        h('div', {}, h('strong', { text: String(sessions) }), h('span', { text: sessions > 1 ? T('séances') : T('séance') })),
        h('div', {}, h('strong', { class: 'acc', text: String(nRec) }), h('span', { text: nRec > 1 ? T('records') : T('record') })),
        h('div', {}, h('strong', { text: String(nSets) }), h('span', { text: nSets > 1 ? T('séries') : T('série') }))));
      // Le jour choisi : un résumé et le bouton pour ouvrir la séance.
      const sd = keyDate(sel);
      if (sd.getFullYear() === y && sd.getMonth() === m) {
        const ents = byDay.get(sel) || [];
        const order = dayOrder(sel);
        const s = S.sessions[sel];
        const st = dayStats(ents);
        box.append(h('section', { class: 'daycard' },
          h('span', { class: 'kicker', text: dayLabel(sd) + (sel === todayKey() ? T(' · aujourd’hui') : '') }),
          h('strong', { class: 'daycard-t', text: s ? sessionTitle(s) : ents.length ? T('Séance') : order.length ? T('Séance prévue') : T('Rien ce jour-là') }),
          ents.length ? h('span', { class: 'daycard-s' }, plural(st.nEx, 'exercice', 'exercices') + ' · ' + plural(st.nSets, 'série', 'séries'),
            recs.get(sel) ? h('b', { text: ' · ' + plural(recs.get(sel), 'record', 'records') }) : null)
            : order.length ? h('span', { class: 'daycard-s', text: plural(order.length, 'exercice prévu', 'exercices prévus') }) : null,
          h('button', { type: 'button', class: 'btn ' + (ents.length || order.length ? 'acc' : 'ghost') + ' wide', onclick: () => go('session', sel) },
            ents.length || order.length ? T('Ouvrir la séance') : sel >= todayKey() ? T('Préparer ce jour') : T('Ajouter des séries ce jour-là'))));
      }
    }
    render();
    return wrap;
  }

  /* ---------- une journée d'entraînement (0.8.0 : page à part, en parcours) ---------- */
  function viewSession(arg, ui) {
    const key = isKey(arg) ? arg : todayKey();
    materialize(key);
    const wrap = h('main', { class: 'page session' });
    wrap.append(h('header', { class: 'bar' }, backBtn(), h('span', { class: 'kicker', text: key === todayKey() ? T('Aujourd’hui') : cap(fDayShort.format(keyDate(key))) }), closeBtn()));
    const body = h('div');
    wrap.append(body);
    const refresh = () => { const y = window.scrollY; body.textContent = ''; body.append(dayDetail(key, refresh, (k) => { if (k === key) refresh(); else replaceNow('session', k); }, { timeline: true })); window.scrollTo(0, y); };
    refresh();
    // 0.8.5 : à l'ouverture (et au retour d'une fiche), la carte de l'exercice en cours est entière à l'écran,
    // « Valider la série » compris : on défile juste ce qu'il faut. Après une validation sur place, on ne bouge pas.
    const showNow = () => {
      const c = body.querySelector('.dcard.now');
      if (!c || !c.isConnected) return;
      let top = 0; for (let el = c; el; el = el.offsetParent) top += el.offsetTop;
      const vTop = window.scrollY + 76; const vBot = window.scrollY + window.innerHeight - 16;
      if (top >= vTop && top + c.offsetHeight <= vBot) return;
      const dy = top < vTop ? top - vTop : Math.min(top + c.offsetHeight - vBot, top - vTop);
      window.scrollTo(0, Math.max(0, window.scrollY + dy));
    };
    requestAnimationFrame(() => requestAnimationFrame(showNow));
    // Et encore une fois à la fin de l'animation d'arrivée (certains navigateurs mesurent mal pendant le glissement).
    const root = document.getElementById('app');
    if (root) root.addEventListener('animationend', (e) => { if (e.target === root) showNow(); }, { once: true });
    return wrap;
  }
  function dayDetail(key, refresh, select, opts) {
    const tl = !!(opts && opts.timeline);   // 0.8.0 : page « séance » en parcours
    const body = h('section', { class: 'daydetail' + (tl ? ' tlmode' : ''), 'aria-label': T('Détail du {0}', dayLabel(keyDate(key))) });
    const isToday = key === todayKey();
    const render = refresh;

    function build() {
      body.textContent = '';
      const entries = dayEntries(key);
      const order = dayOrder(key);
      const meta = S.days[key];
      const groups = dayGroups(key);
      if (tl) {
        const s0 = S.sessions[key];
        const top = groups.filter((g) => !g.loose);   // 0.8.3 : plusieurs séances : le titre est celle du haut
        const doneIds = new Set(entries.map((e) => e.exerciseId));
        const k = order.filter((id) => doneIds.has(id)).length;
        body.append(h('div', { class: 'sess-head' },
          h('div', { class: 'sess-top' }, h('span', { class: 'kicker acc', text: isToday ? T('Séance du jour') : dayLabel(keyDate(key)) }), dayMenu()),
          h('h1', { class: 'sess-title', text: top.length > 1 ? top[0].title : s0 ? sessionTitle(s0) : isToday ? T('Aujourd’hui') : dayLabel(keyDate(key)) }),
          order.length ? h('div', { class: 'sess-prog' }, h('strong', { text: T('{0} / {1} exercices', k, order.length) }),
            h('div', { class: 'pbar', 'aria-hidden': 'true' }, h('div', { style: { width: Math.round(100 * k / order.length) + '%' } }))) : null));
      } else body.append(h('h2', { class: 'dd-title', text: dayLabel(keyDate(key)) + (isToday ? T(' · aujourd’hui') : '') }));
      const seances = groups.filter((g) => !g.loose);
      const qs = S.qvSaved; S.qvSaved = null;
      if (seances.length > 1) {
        // Plusieurs séances prévues. 0.8.5 : une seule ligne (au lieu d'une carte par séance) ; chaque nom
        // ramène à sa partie de la liste, qui a déjà son titre et son avancement.
        const line = h('div', { class: 'sess-line', role: 'group', 'aria-label': T('Séances du jour') });
        seances.forEach((g, i) => {
          const gc = GROUPS.get(g.main);
          line.append(h('button', { type: 'button', class: 'sl-item', style: gc ? { '--c': gc.color } : null,
            onclick: () => { const t = body.querySelector('#grp-' + i); if (t) t.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); } }, g.title));
        });
        const ni = seances.findIndex((g) => g.named);
        if (ni >= 0 || !S.sessions[key]) line.append(h('button', { type: 'button', class: 'textbtn', text: T('Modifier'), onclick: () => sessionDialog(key, entries.length ? entries : order.map((id) => ({ exerciseId: id })), render) }));
        body.append(h('div', { class: 'sess-name' }, line));
      } else if (entries.length || order.length) {
        const nameBox = h('div', { class: 'sess-name' });
        const s = S.sessions[key];
        if (!s) nameBox.append(h('button', { type: 'button', class: 'btn ghost wide', onclick: () => sessionDialog(key, entries.length ? entries : order.map((id) => ({ exerciseId: id })), render) }, icon('tag'), T('Nommer la séance')));
        else {
          nameBox.append(h('div', { class: 'card named', style: { '--c': GROUPS.get(s.main).color } },
            h('div', { class: 'row' }, h('strong', { class: 'nm', text: sessionTitle(s) }),
              h('button', { type: 'button', class: 'textbtn', text: T('Modifier'), onclick: () => sessionDialog(key, entries, render) })),
            h('div', { class: 'tags' }, tag(s.main, true), s.sec.map((id) => tag(id)))));
        }
        body.append(nameBox);
      }
      if (!order.length) {
        body.append(h('p', { class: 'empty-note pad', text: isToday ? T('Rien de prévu aujourd’hui. Ajoute des exercices ou lance une de tes séances types.') : T('Aucun exercice ce jour-là.') }));
      } else {
        const cur = tl ? currentTodo(key) : null;
        const many = groups.length > 1;
        groups.forEach((g, gi) => {
        const list = h('div', { class: 'dlist' + (tl ? ' tl2' : '') });
        let num = 0;
        for (const id of g.ids) {
          num++;
          const sets = entries.filter((e) => e.exerciseId === id);
          const ex = getEx(id, sets[0] && sets[0].name);
          const planned = !sets.length && meta && meta.plan[id] ? meta.plan[id] : null;
          const planAll = meta && meta.plan[id] ? meta.plan[id] : null;
          const state = id === cur ? 'now' : sets.length && !(planAll && sets.length < planAll.length) ? 'done' : 'todo';
          const same = planned ? plannedSame(planned) : null;   // 0.8.5 : « 3 × 10 · 80 kg » au lieu de 3 pastilles identiques
          const status = sets.length ? plural(sets.length, 'série', 'séries') : planned ? T('À faire · ') + (same || plural(planned.length, 'série prévue', 'séries prévues')) : T('À faire');
          const head = h('div', { class: 'dhead' },
            h('span', { class: 'handle', role: 'button', 'aria-label': T('Déplacer ') + dn(ex), title: T('Maintenir et glisser pour déplacer') }, icon('grip')),
            h('button', { type: 'button', class: 'open', onclick: () => go('exercise', { id, day: key }) }, thumb(ex, { zoom: true }),
              h('div', { class: 'txt' }, h('div', { class: 'nm', text: dn(ex) }), h('div', { class: 'st' + (sets.length ? '' : ' todo'), text: status }))),
            h('span', { class: 'chev' }, icon('right')));
          const node = tl ? h('span', { class: 'node ' + state, 'aria-hidden': 'true' }, state === 'done' ? icon('check') : String(num)) : null;
          const qv = tl && state === 'now' && isToday ? plannedNext(key, id) : null;
          const nowFoot = tl && state === 'now' ? h('div', { class: 'now-foot' },
            planAll && planAll.length ? h('div', { class: 'sdots', 'aria-label': T('{0} séries faites sur {1}', sets.length, planAll.length) },
              planAll.map((p, i) => h('i', { class: i < sets.length ? 'on' : '' })), h('span', { text: T('{0} / {1} séries', sets.length, planAll.length) })) : null,
            qv ? h('button', { type: 'button', class: 'btn acc wide big next qv', onclick: onceClick(() => quickValidate(key, id, render)) }, icon('check'),
              h('span', { class: 'nx' }, h('small', { text: T('Série {0} sur {1} · {2}', qv.n, qv.of, qv.text) }), h('b', { text: T('Valider la série') })))
              : h('button', { type: 'button', class: 'btn acc wide', onclick: () => go('exercise', { id, day: key }) }, icon('play'), sets.length ? T('Continuer') : T('C’est parti'))) : null;
          const qline = qs && qs.ex === id && S.entries.some((x) => x.id === qs.id) ? h('div', { class: 'saved-line', role: 'status' }, icon('check'), h('span', { text: qs.text }),
            h('button', { type: 'button', class: 'undo', text: T('Annuler'), onclick: () => { S.entries = S.entries.filter((x) => x.id !== qs.id); saveUser(); render(); } })) : null;
          list.append(h('div', { class: 'sitem' + (tl ? ' st-' + state : ''), 'data-id': id }, node,
            h('article', { class: 'dcard' + (sets.length ? '' : ' todo') + (tl && state === 'now' ? ' now' : '') },
              swipeable(head, () => removeFromDay(id), T('Retirer ') + dn(ex) + T(' de la séance')),
              sets.map((e) => swipeable(h('button', { type: 'button', class: 'line-set', 'aria-label': T('Modifier la série ') + entryText(e), onclick: () => editEntry(e, render) },
                h('span', { class: 'tm', text: fTime.format(e.ts) }), h('b', { text: entryText(e) }), e.c === 1 ? null : h('span', { class: 'tot', text: fmtNum(e.w * e.r) })),
                () => deleteEntry(e, render), T('Supprimer la série'))),
              planned && !same ? h('div', { class: 'sets planned' }, planned.map((p) => h('span', { class: 'set', text: plannedText(p) }))) : null, qline, nowFoot)));
        }
        sortable(list, (ids) => { const d = dayMeta(key, true); d.order = groups.flatMap((x) => (x === g ? ids : x.ids)); saveUser(); if (tl) render(); });
        if (many) {
          const gc = GROUPS.get(g.main);
          const k3 = g.ids.filter((id) => entries.some((e) => e.exerciseId === id)).length;
          body.append(h('h3', { class: 'grp-h', id: 'grp-' + gi, style: gc ? { '--c': gc.color } : null }, h('span', { class: 'grp-dot', 'aria-hidden': 'true' }),
            h('span', { class: 'grp-t', text: g.title }), h('span', { class: 'grp-n', text: T('{0} / {1}', k3, g.ids.length) })));
        }
        body.append(list);
        });
        body.append(h('p', { class: 'hint', text: T('Maintiens la poignée pour changer l’ordre. Glisse une ligne vers la gauche pour la supprimer.') }));
      }
      body.append(h('button', { type: 'button', class: 'btn ghost wide addex', onclick: () => go('library', { pick: 'day', id: key }) }, icon('plus'), T('Ajouter un exercice')));
      // Rien de prévu : lancer une séance type reste en vue (sinon, c'est dans le « … »).
      if (!order.length && key >= todayKey() && S.plans.length) {
        body.append(h('button', { type: 'button', class: 'btn ghost wide', onclick: () => scheduleDialog({ date: key, onDone: (k) => (select ? select(k) : render()) }) }, icon('folder'), isToday ? T('Lancer ou programmer une séance type') : T('Prévoir une séance type')));
      }
      const scs = S.schedules.filter((sc) => occurs(sc, key) && S.plans.some((p) => p.id === sc.plan));
      if (scs.length) {
        body.append(h('div', { class: 'sched-note' }, scs.map((sc) => h('p', {}, h('b', { text: planTitle(S.plans.find((p) => p.id === sc.plan)) }), ' · ' + schedText(sc)))));
      }
      // 0.8.5 : le résumé et la note passent en bas (la liste d'abord) ; les autres actions sont dans le « … ».
      if (entries.length) {
        const st = dayStats(entries);
        body.append(h('p', { class: 'sum pad', text: plural(st.nEx, 'exercice', 'exercices') + ' · ' + plural(st.nSets, 'série', 'séries') + (st.load ? ' · ' + fmtNum(Math.round(st.load)) + ' ' + T('kg au total') : '') }));
      }
      body.append(noteBox(() => (S.days[key] || {}).note, (v) => { const d = dayMeta(key, true); d.note = v; },
        T('Note de séance : sensations, fatigue…'), T('Note de la séance')));
    }
    /* 0.8.5 : page de la séance : les actions rares sont dans le « … » en haut à droite (« Retirer » en dernier). */
    function dayMenu() {
      const entries = dayEntries(key);
      const order = dayOrder(key);
      const doneIds = new Set(entries.map((e) => e.exerciseId));
      const items = [
        order.length && key >= todayKey() && S.plans.length ? { icon: 'folder', label: isToday ? T('Lancer ou programmer une séance type') : T('Prévoir une séance type'), run: () => scheduleDialog({ date: key, onDone: (k) => (select ? select(k) : render()) }) } : null,
        entries.length && !isToday ? { icon: 'copy', label: T('Refaire cette séance aujourd’hui'), run: () => redoDay(key, select) } : null,
        entries.length ? { icon: 'folder', label: T('Enregistrer comme séance type'), run: () => dayToPlan(key) } : null,
        entries.length ? { icon: 'copy', label: T('Copier pour Strava'), run: () => copySummary(key) } : null,
        entries.length ? { icon: 'export', label: T('Exporter l’activité (fichier)'), run: () => exportActivity(key) } : null,
        order.some((id) => !doneIds.has(id)) ? { icon: 'trash', danger: true, label: entries.length ? T('Retirer les exercices prévus non faits') : T('Retirer la séance prévue'), run: () => clearPlanned(key, render) } : null,
      ].filter(Boolean);
      if (!items.length) return null;
      return h('button', { type: 'button', class: 'iconbtn', 'aria-label': T('Autres actions de la séance'), onclick: () => actionSheet(isToday ? T('Séance du jour') : dayLabel(keyDate(key)), items) }, icon('dots', 'fill'));
    }
    function removeFromDay(id) {
      const removed = S.entries.filter((e) => e.exerciseId === id && dayKey(e.ts) === key);
      const old = S.days[key] ? JSON.parse(JSON.stringify(S.days[key])) : null;
      S.entries = S.entries.filter((e) => !(e.exerciseId === id && dayKey(e.ts) === key));
      const d = S.days[key];
      if (d) { d.order = d.order.filter((x) => x !== id); delete d.plan[id]; }
      saveUser(); render();
      toast(removed.length ? T('Exercice et {0} supprimés', plural(removed.length, 'série', 'séries')) : T('Exercice retiré'), { ms: 6000,
        action: () => { S.entries.push(...removed); if (old) S.days[key] = old; saveUser(); render(); } });
    }
    build();
    return body;
  }
  /* Retire ce qui était prévu pour un jour (séance lancée avec « Aujourd'hui ») ;
     les séries déjà enregistrées restent. Annulable quelques secondes. */
  function clearPlanned(key, after, fromHome) {
    const oldD = S.days[key] ? JSON.parse(JSON.stringify(S.days[key])) : null;
    const oldS = S.sessions[key] ? JSON.parse(JSON.stringify(S.sessions[key])) : null;
    const done = new Set(dayEntries(key).map((e) => e.exerciseId));
    const d = S.days[key];
    if (d) {
      d.order = d.order.filter((id) => done.has(id));
      for (const id of Object.keys(d.plan)) if (!done.has(id)) delete d.plan[id];
      // Depuis l'accueil, la carte « Séance du jour » disparaît même si des séries sont déjà faites
      // (elles restent dans le calendrier et l'historique).
      if (fromHome) d.hidden = true;
      if (!d.order.length && !d.note) delete S.days[key];
    }
    if (!done.size) delete S.sessions[key];
    saveUser(); after();
    toast(fromHome && done.size ? T('Séance du jour retirée de l’accueil, tes séries sont gardées') : done.size ? T('Exercices prévus retirés') : T('Séance prévue retirée'), { ms: 6000, action: () => {
      if (oldD) S.days[key] = oldD; else delete S.days[key];
      if (oldS) S.sessions[key] = oldS; else delete S.sessions[key];
      saveUser(); after();
    } });
  }
  /* Séries faites d'un exercice, sous forme de séries prévues (charges, ou durée pour un exercice tenu). */
  const plannedText = (p) => (p.dur !== undefined ? (p.dur !== '' ? fmtDur(p.dur) : T('… s'))
    : (p.bw ? bwText(fin(p.w) ? p.w : 0) : p.w !== '' ? fmtNum(p.w) + ' kg' : T('… kg')) + T(' × ') + (p.r !== '' ? fmtNum(p.r) : '…'));
  /* 0.8.5 : séries prévues toutes identiques, en une ligne : « 3 × 10 · 80 kg », « 2 × 30 s ». Sinon null. */
  function plannedSame(arr) {
    if (!arr || arr.length < 2) return null;
    const k = (p) => JSON.stringify([p.w, p.r, p.dur, !!p.bw]);
    if (arr.some((p) => k(p) !== k(arr[0]))) return null;
    const p = arr[0]; const n = fmtNum(arr.length) + T(' × ');
    if (p.dur !== undefined) return n + (p.dur !== '' ? fmtDur(p.dur) : T('… s'));
    return n + (p.r !== '' ? fmtNum(p.r) : '…') + ' · ' + (p.bw ? bwText(fin(p.w) ? p.w : 0) : p.w !== '' ? fmtNum(p.w) + ' kg' : T('… kg'));
  }
  const isHold = (id) => cardioKind(S.byId.get(id)) === 'hold';
  const doneSets = (entries, id) => entries.filter((e) => e.exerciseId === id && (e.c !== 1 || isHold(id))).map((e) => (e.c === 1 ? { w: '', r: '', dur: e.dur } : e.bw ? { w: e.x || '', r: e.r, bw: 1 } : { w: e.w, r: e.r }));
  function redoDay(key, select) {
    const tk = todayKey();
    const entries = dayEntries(key);
    const s = S.sessions[key];
    startDay(tk, { name: s ? s.name : '', main: s ? s.main : '', sec: s ? s.sec : [],
      items: dayOrder(key).map((id) => ({ ex: id, sets: doneSets(entries, id) })) });
    saveUser();
    if (select) select(tk); else go('session', tk);
    toast(T('Séance recopiée pour aujourd’hui : ajuste les charges si besoin.'));
  }
  function dayToPlan(key) {
    const entries = dayEntries(key);
    const s = S.sessions[key];
    const p = { id: uid(), name: s ? sessionTitle(s) : T('Séance du {0}', fDayShort.format(keyDate(key))), folder: '', main: s ? s.main : '', sec: s ? s.sec.slice() : [],
      items: dayOrder(key).map((id) => ({ ex: id, sets: doneSets(entries, id) })), created: Date.now(), last: key };
    S.planDraft = { p, isNew: true, base: planSig(emptyPlan()) };
    go('plan', p.id);
    toast(T('Vérifie la séance puis touche « Valider »'));
  }
  /* Résumé texte d'une journée, à coller dans la description de l'activité enregistrée par ta montre
     sur Strava : nom de la séance, puis chaque exercice avec ses séries. */
  function summaryText(key) {
    const ents = dayEntries(key);
    const s = S.sessions[key];
    const lines = [(s ? sessionTitle(s) : T('Séance')) + T(' – WorkLog')];
    for (const id of dayOrder(key)) {
      const sets = ents.filter((e) => e.exerciseId === id);
      if (!sets.length) continue;
      const ex = getEx(id, sets[0].name);
      // Séries identiques regroupées : « 3 × 10 à 52 kg » devient « 52 kg × 10 (×3) ».
      const parts = []; let prev = null; let n = 0;
      const flush = () => { if (prev) parts.push(prev + (n > 1 ? T(' (×') + n + ')' : '')); };
      for (const e of sets) { const t = entryText(e); if (t === prev) n++; else { flush(); prev = t; n = 1; } }
      flush();
      lines.push('• ' + dn(ex) + ' : ' + parts.join(', '));
    }
    const st = dayStats(ents);
    lines.push(plural(st.nEx, 'exercice', 'exercices') + ' · ' + plural(st.nSets, 'série', 'séries') + (st.load ? ' · ' + fmtNum(Math.round(st.load)) + ' ' + T('kg au total') : ''));
    if (S.days[key] && S.days[key].note) lines.push('', S.days[key].note);
    return lines.join('\n');
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* on essaie autrement */ }
    const ta = h('textarea', { style: { position: 'fixed', top: '0', left: '0', opacity: '0' } });
    ta.value = text; document.body.append(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
  async function copySummary(key) {
    const text = summaryText(key);
    if (await copyText(text)) toast(T('Résumé copié : colle-le dans la description de ton activité sur Strava.'), { ms: 5000 });
    else {
      // Copie impossible : on affiche le texte pour le sélectionner à la main.
      let close = null;
      const ta = h('textarea', { class: 'field left sumtext', rows: '8', readonly: true }); ta.value = text;
      close = openModal(h('div', { class: 'dialog sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' },
        h('h2', { id: 'dlg-t', text: T('Résumé de la séance') }), h('p', { text: T('Sélectionne le texte puis copie-le.') }), ta,
        h('button', { type: 'button', class: 'btn primary wide', text: T('Fermer'), onclick: () => close() })));
      setTimeout(() => ta.select(), 50);
    }
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
    const lines = [s ? sessionTitle(s) : T('Séance WorkLog')];
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
      if (ok) toast(T('Fichier prêt : importe-le sur strava.com (Téléverser une activité > Fichier).'), { ms: 6000 });
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

    const nameIn = h('input', { class: 'field left', type: 'text', id: 'sess-nm', maxlength: '60', placeholder: T('Ex. Push, Haut du corps, Jambes lourdes'), autocomplete: 'off', enterkeyhint: 'done' });
    nameIn.value = cur ? cur.name : '';
    const sel = h('select', { class: 'field left', id: 'sess-main' },
      h('option', { value: '', text: T('Choisir un groupe') }),
      GROUP_LIST.map((g) => h('option', { value: g.id, text: g.full })));
    sel.value = main;
    const msg = h('p', { class: 'form-msg', role: 'alert' });
    const chipBox = groupsField(() => [...sec], (v) => { sec.clear(); v.forEach((x) => sec.add(x)); }, () => main, 'sess-sec');
    sel.addEventListener('change', () => { main = sel.value; msg.textContent = ''; sec.delete(main); chipBox.repaint(); });

    let close = null;
    async function save() {
      if (!GROUPS.has(main)) { msg.textContent = T('Choisis le groupe musculaire principal.'); sel.focus(); return; }
      S.sessions[key] = { name: nameIn.value.trim().slice(0, 60), main, sec: [...sec] };
      await saveUser();
      close(); onDone(); toast(T('Séance enregistrée'));
    }
    /* « Supprimer la séance » : le nom et les exercices prévus pas encore faits disparaissent,
       les séries déjà faites restent ; retour à la page précédente. */
    async function remove() {
      close();
      const done = new Set(dayEntries(key).map((e) => e.exerciseId));
      const ok = await confirmDialog({ title: T('Supprimer la séance du {0} ?', fDayLong.format(keyDate(key))),
        text: done.size ? T('Les exercices prévus pas encore faits sont retirés. Tes séries déjà faites restent dans le calendrier.') : T('La séance prévue et son nom sont retirés du calendrier.'), yes: T('Supprimer'), no: T('Annuler') });
      if (!ok) return;
      const oldD = S.days[key] ? JSON.parse(JSON.stringify(S.days[key])) : null;
      const oldS = S.sessions[key] ? JSON.parse(JSON.stringify(S.sessions[key])) : null;
      delete S.sessions[key];
      const d = S.days[key];
      if (d) {
        d.order = d.order.filter((id) => done.has(id));
        for (const id of Object.keys(d.plan)) if (!done.has(id)) delete d.plan[id];
        delete d.src;
        if (!d.order.length && !d.note) delete S.days[key];
      }
      await saveUser();
      backNow();
      toast(done.size ? T('Séance supprimée, tes séries déjà faites sont gardées') : T('Séance supprimée'), { ms: 6000, sticky: true, action: () => {
        if (oldD) S.days[key] = oldD; else delete S.days[key];
        if (oldS) S.sessions[key] = oldS;
        saveUser(); go('session', key);
      } });
    }
    const box = h('div', { class: 'dialog sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' },
      h('h2', { id: 'dlg-t', text: cur ? T('Modifier la séance') : T('Nommer la séance') }),
      h('label', { class: 'lbl', for: 'sess-nm', text: T('Nom de la séance') }), nameIn,
      h('label', { class: 'lbl', for: 'sess-main', text: T('Groupe musculaire principal') }), sel,
      h('label', { class: 'lbl', for: 'sess-sec', text: T('Groupes secondaires') }), chipBox,
      msg,
      h('div', { class: 'acts' },
        h('button', { type: 'button', class: 'btn ghost', text: T('Annuler'), onclick: () => close() }),
        h('button', { type: 'button', class: 'btn primary', text: T('Enregistrer'), onclick: save })),
      cur || (S.days[key] && S.days[key].order.length) ? h('button', { type: 'button', class: 'textbtn danger center', text: T('Supprimer la séance'), onclick: remove }) : null);
    close = openModal(box);
  }

  /* ---------- page Séances : séances types (en dossiers) et séances réalisées ---------- */
  const emptyPlan = () => ({ id: uid(), name: '', folder: '', main: '', sec: [], items: [], created: Date.now(), last: null });
  const clonePlan = (p) => JSON.parse(JSON.stringify(p));
  const planSig = (p) => JSON.stringify([p.name.trim(), p.folder, p.main, [...p.sec].sort(), p.items.map((it) => [it.ex, it.sets.map((x) => [x.bw ? signedOrBlank(x.w) : numOrBlank(x.w), numOrBlank(x.r), x.dur === undefined ? null : durOrBlank(x.dur), x.bw ? 1 : 0])])]);
  const planMissing = (p) => [!p.name.trim() ? T('un nom') : null, !p.items.length ? T('au moins un exercice') : null].filter(Boolean);
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
    p.items.forEach((it) => { it.sets = it.sets.map(cleanSet).filter(keepSet); });
    if (p.folder && !S.folders.includes(p.folder)) S.folders.push(p.folder);
    const copy = clonePlan(p);
    const i = S.plans.findIndex((x) => x.id === p.id);
    if (i >= 0) S.plans[i] = copy; else S.plans.push(copy);
    d.isNew = false; d.base = planSig(p);
    saveUser();
  }
  const planTitle = (p) => p.name.trim() || T('Séance sans nom');
  /* Séance d'étirements ou de mobilité : la plupart de ses exercices sont des étirements ou des exercices tenus. */
  const isStretchPlan = (p) => p.items.length > 0 && p.items.filter((it) => { const ex = getEx(it.ex); return ex.st || cardioKind(ex) === 'hold'; }).length * 2 >= p.items.length;
  /* Durée estimée d'une séance d'étirements : temps prévus (30 s par défaut) + 10 s pour changer de position. */
  function planMinutes(p) {
    let sec = 0;
    for (const it of p.items) {
      const sets = (it.sets || []).filter(keepSet);
      if (!sets.length) { sec += 30 + 10; continue; }
      for (const x of sets) sec += (fin(x.dur) && x.dur > 0 ? x.dur : 30) + 10;
    }
    return Math.max(1, Math.round(sec / 60));
  }
  /* « Aujourd'hui » sur une séance type. Étirements / mobilité : ajoutés à ce qui est prévu. Musculation
     avec une autre séance déjà prévue : on demande quoi remplacer. Les exercices déjà commencés aujourd'hui
     ne sont jamais retirés. Avec plusieurs séances prévues (Jambes + Étirements, par exemple), on peut
     remplacer seulement la séance de musculation, ou tout ce qui est prévu. */
  function startPlanToday(p) {
    if (!p.items.length) { toast(T('Ajoute au moins un exercice à cette séance.')); return; }
    const tk = todayKey();
    materialize(tk);
    const d = S.days[tk];
    const done = new Set(dayEntries(tk).map((e) => e.exerciseId));
    const order = d && !d.hidden ? dayOrder(tk) : [];
    // Ce qui est prévu et pas encore commencé, regroupé par séance type d'origine.
    const groups = [];
    const seen = new Set();
    for (const pid of (d && d.src) || []) {
      const sp = S.plans.find((x) => x.id === pid);
      if (!sp || sp.id === p.id) continue;
      const ids = sp.items.map((it) => it.ex).filter((id) => order.includes(id) && !done.has(id) && !seen.has(id));
      ids.forEach((id) => seen.add(id));
      if (ids.length) groups.push({ plan: sp, ids, stretch: isStretchPlan(sp) });
    }
    const loose = order.filter((id) => !done.has(id) && !seen.has(id) && !p.items.some((it) => it.ex === id));
    if (loose.length) groups.push({ plan: null, ids: loose, stretch: false });
    const run = (remove) => {
      let at = -1;
      if (remove && remove.length) {
        const dd = dayMeta(tk, true);
        const ids0 = remove.filter((g) => g.plan).map((g) => g.plan.id);
        at = (dd.src || []).findIndex((id) => ids0.includes(id));
        const drop = new Set(remove.flatMap((g) => g.ids));
        // 0.8.3 : une séance recopiée qui était en haut est remplacée à sa place, en haut.
        const g0 = dayGroups(tk)[0];
        if (g0 && !g0.plan && g0.ids.some((id) => drop.has(id))) at = 0;
        dd.order = dayOrder(tk).filter((id) => !drop.has(id));
        for (const id of drop) delete dd.plan[id];
        const gone = new Set(remove.filter((g) => g.plan).map((g) => g.plan.id));
        dd.src = (dd.src || []).filter((id) => !gone.has(id));
        // Le nom de la journée suit la nouvelle séance de musculation.
        if (remove.some((g) => !g.stretch)) delete S.sessions[tk];
      }
      startDay(tk, p);
      const d2 = S.days[tk];
      if (at >= 0 && d2 && d2.src) { d2.src = d2.src.filter((id) => id !== p.id); d2.src.splice(Math.min(at, d2.src.length), 0, p.id); }
      p.last = tk;
      saveUser();
      go('session', tk);
    };
    if (!groups.length || isStretchPlan(p)) { run(null); return; }
    const copyName = d && d.own === 'copy' && S.sessions[tk] ? sessionTitle(S.sessions[tk]) : null;
    const name = (g) => (g.plan ? planTitle(g.plan) : copyName || T('exercices ajoutés à la main'));
    const list = (gs) => { const a = gs.map((g) => '« ' + name(g) + ' »'); return a.length > 1 ? a.slice(0, -1).join(', ') + T(' et ') + a[a.length - 1] : a[0] || ''; };
    const muscu = groups.filter((g) => !g.stretch);
    const others = groups.filter((g) => g.stretch);
    bottomSheet((box, close) => {
      const opt = (ic, title, sub, remove) => h('button', { type: 'button', class: 'bs-item two', onclick: () => close(() => run(remove)) }, icon(ic),
        h('span', { class: 'bs-tt' }, h('b', { text: title }), sub ? h('small', { text: sub }) : null));
      box.append(h('h2', { class: 'bs-title', text: groups.length > 1 ? T('Plusieurs séances sont prévues aujourd’hui') : T('Une séance est déjà prévue aujourd’hui') }),
        h('p', { class: 'bs-note', text: T('Prévu : {0}. Les exercices déjà commencés restent.', list(groups)) }));
      if (groups.length === 1) {
        box.append(opt('swap', T('Remplacer « {0} »', name(groups[0])), T('par « {0} »', planTitle(p)), groups));
      } else if (muscu.length && others.length) {
        // Cas Jambes + Étirements : remplacer la musculation en gardant les étirements, ou tout remplacer.
        box.append(opt('swap', T('Remplacer {0}', list(muscu)), T('et garder {0}', list(others)), muscu),
          opt('swap', T('Remplacer {0}', list(groups)), T('tout ce qui est prévu est remplacé par « {0} »', planTitle(p)), groups));
      } else {
        for (const g of groups) box.append(opt('swap', T('Remplacer « {0} »', name(g)), T('et garder le reste'), [g]));
        box.append(opt('swap', T('Tout remplacer'), T('retire {0}', list(groups)), groups));
      }
      box.append(opt('plus', T('Ajouter à ce qui est prévu'), T('« {0} » à la suite', planTitle(p)), null),
        h('button', { type: 'button', class: 'btn ghost wide bs-cancel', text: T('Annuler'), onclick: () => close() }));
    });
  }
  async function newFolder(after) {
    const n = await promptDialog(T('Nouveau dossier'), T('Nom du dossier'), '');
    if (!n) return null;
    if (allFolders().some((f) => f.toLowerCase() === n.toLowerCase())) { toast(T('Ce dossier existe déjà.')); return allFolders().find((f) => f.toLowerCase() === n.toLowerCase()); }
    S.folders.push(n);
    await saveUser();
    if (after) after(n);
    return n;
  }
  function viewSeances(arg, ui) {
    let tab = ui.tab || (arg && arg.tab) || (S.plans.length ? 'plans' : 'done');
    let filter = GROUPS.has(ui.filter) ? ui.filter : 'all';
    let pfilter = GROUPS.has(ui.pfilter) ? ui.pfilter : 'all';
    // Dossiers fermés par défaut ; on garde ceux qu'on a ouverts en revenant sur la page.
    const openF = new Set(Array.isArray(ui.openF) ? ui.openF : []);
    S.getUI = () => ({ tab, filter, pfilter, openF: [...openF] });
    const wrap = h('main', { class: 'page seances' });
    // « … » en haut à droite : exporter (toutes les séances types ou certaines) ou importer.
    wrap.append(h('header', { class: 'bar' }, h('h1', { class: 'grow big', text: T('Séances') }),
      h('button', { type: 'button', class: 'iconbtn', 'aria-label': T('Exporter ou importer des séances'), onclick: () => actionSheet(T('Séances types'), [
        S.plans.length ? { icon: 'export', label: T('Exporter des séances'), run: exportPlansSheet } : null,
        { icon: 'import', label: T('Importer des séances'), run: () => { const inp = wrap.querySelector('input[type=file]'); if (inp) inp.click(); } }].filter(Boolean)) }, icon('dots', 'fill'))));
    const tabBar = h('div', { class: 'tabs two', role: 'tablist' });
    const body = h('div');
    wrap.append(tabBar, body);
    const chipsFor = (tops, cur, count, set) => h('div', { class: 'chips scroll', role: 'group', 'aria-label': T('Filtrer par groupe musculaire') },
      [['all', T('Toutes')]].concat(tops.map((t) => [t.id, t.label])).map(([id, label]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(cur === id),
        onclick: () => { set(id); render(); window.scrollTo(0, 0); } }, label, h('span', { class: 'n', text: String(count(id)) }))));

    function renderTabs() {
      tabBar.textContent = '';
      [['plans', T('Mes séances')], ['done', T('Réalisées')]].forEach(([id, label]) => tabBar.append(h('button', { type: 'button', role: 'tab', class: 'tab',
        'aria-selected': String(tab === id), text: label, onclick: () => { if (tab !== id) { tab = id; render(); window.scrollTo(0, 0); } } })));
    }

    function movePlan(id, folder) {
      const p = S.plans.find((x) => x.id === id);
      if (!p || p.folder === folder) return;
      p.folder = folder;
      if (folder && !S.folders.includes(folder)) S.folders.push(folder);
      openF.add(folder || '__none');
      saveUser(); render();
      toast(T('« {0} » déplacée dans « {1} »', planTitle(p), folder || T('Sans dossier')));
    }
    function moveMenu(p) {
      const items = allFolders().filter((f) => f !== p.folder).map((f) => ({ label: f, icon: 'folder', run: () => movePlan(p.id, f) }));
      if (p.folder) items.push({ label: T('Sans dossier'), run: () => movePlan(p.id, '') });
      items.push({ label: T('Nouveau dossier…'), icon: 'folderplus', run: () => newFolder((n) => movePlan(p.id, n)) });
      actionSheet(T('Déplacer « {0} » vers', planTitle(p)), items);
    }
    function planMenu(p) {
      actionSheet(planTitle(p), [
        { label: T('Programmer…'), icon: 'play', run: () => scheduleDialog({ plan: p, onDone: () => render() }) },
        { label: T('Déplacer vers…'), icon: 'folder', run: () => moveMenu(p) },
        { label: T('Renommer'), icon: 'tag', run: async () => {
          const n = await promptDialog(T('Renommer la séance'), T('Nom de la séance'), p.name, 60);
          if (n) { p.name = n; await saveUser(); render(); toast(T('Séance renommée')); }
        } },
        { label: T('Dupliquer'), icon: 'copy', run: () => {
          const c = clonePlan(p); c.id = uid(); c.name = (p.name + ' (copie)').slice(0, 60); c.created = Date.now(); c.last = null;
          S.plans.push(c); saveUser(); render(); toast(T('Séance dupliquée'));
        } },
        { label: T('Supprimer'), icon: 'trash', danger: true, run: async () => {
          const ok = await confirmDialog({ title: T('Supprimer « {0} » ?', planTitle(p)), text: T('Ses exercices prévus pas encore faits et sa programmation sont retirés du calendrier. Tes séries déjà faites restent.'), yes: T('Supprimer'), no: T('Annuler') });
          if (!ok) return;
          await removePlan(p); render(); toast(T('Séance supprimée'));
        } },
      ]);
    }
    function folderMenu(f) {
      actionSheet(T('Dossier « {0} »', f), [
        { label: T('Renommer le dossier'), icon: 'tag', run: async () => {
          const n = await promptDialog(T('Renommer le dossier'), T('Nom du dossier'), f);
          if (!n || n === f) return;
          if (allFolders().some((x) => x !== f && x.toLowerCase() === n.toLowerCase())) { toast(T('Ce dossier existe déjà.')); return; }
          S.folders = S.folders.map((x) => (x === f ? n : x));
          if (!S.folders.includes(n)) S.folders.push(n);
          S.plans.forEach((x) => { if (x.folder === f) x.folder = n; });
          await saveUser(); render(); toast(T('Dossier renommé'));
        } },
        { label: T('Supprimer le dossier'), icon: 'trash', danger: true, run: async () => {
          const n = S.plans.filter((x) => x.folder === f).length;
          const ok = await confirmDialog({ title: T('Supprimer le dossier « {0} » ?', f), text: n ? T('{0} dans « Sans dossier ». Aucune séance n’est supprimée.', plural(n, 'séance passe', 'séances passent')) : T('Le dossier est vide.'), yes: T('Supprimer'), no: T('Annuler') });
          if (!ok) return;
          S.folders = S.folders.filter((x) => x !== f);
          S.plans.forEach((x) => { if (x.folder === f) x.folder = ''; });
          await saveUser(); render(); toast(T('Dossier supprimé'));
        } },
      ]);
    }

    const plansIn = filePicker(async (f) => { if (await importPart(f, 'plans')) render(); });
    function renderPlans() {
      body.append(h('div', { class: 'plan-btns' },
        h('button', { type: 'button', class: 'btn primary wide', onclick: () => createPlan() }, icon('plus'), T(' Créer une séance')),
        h('button', { type: 'button', class: 'newfolder', onclick: () => newFolder(() => render()) }, icon('folderplus'), h('span', { text: T('Nouveau dossier') }))));
      body.append(plansIn);
      if (!S.plans.length && !allFolders().length) {
        body.append(h('div', { class: 'card empty-card' }, h('strong', { text: T('Aucune séance type') }),
          h('p', { text: T('Crée une séance (Push, Jambes…), ajoute ses exercices et, si tu veux, les séries et charges prévues. Range-la dans un dossier, puis lance-la le jour où tu la fais.') })));
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
        d.open = openF.has(key);
        d.addEventListener('toggle', () => { if (d.open) openF.add(key); else openF.delete(key); });
        d.append(ps.length ? h('div', { class: 'pcards' }, ps.map(planCard)) : h('p', { class: 'empty-note pad', text: emptyText }));
        return d;
      };
      for (const f of allFolders()) {
        const ps = sorted(list.filter((p) => p.folder === f));
        if (!ps.length && pfilter !== 'all') continue;
        box.append(section(f, 'group folder', h('summary', {},
          h('span', { class: 'fsum' }, icon('folder'), h('span', { class: 'fname', text: f }), h('span', { class: 'count', text: String(ps.length) })),
          h('button', { type: 'button', class: 'fmore', 'aria-label': T('Options du dossier ') + f, onclick: (e) => { e.preventDefault(); e.stopPropagation(); folderMenu(f); } }, icon('dots', 'fill')),
          icon('down')), ps, T('Dossier vide : glisse une séance ici avec sa poignée, ou utilise « … » puis « Déplacer vers ».')));
      }
      const loose = sorted(list.filter((p) => !p.folder));
      if (loose.length || S.plans.length) {
        box.append(section('__none', 'loose', h('summary', {}, h('span', { class: 'lsum' }, T('Sans dossier'), h('span', { class: 'count', text: String(loose.length) })), icon('down')),
          loose, T('Aucune séance hors dossier.')));
      }
      body.append(box);
      planDrag(box, movePlan);
    }
    function planCard(p) {
      const g = GROUPS.get(p.main);
      const nSets = p.items.reduce((n, it) => n + it.sets.length, 0);
      return h('div', { class: 'pcard', 'data-id': p.id, style: g ? { '--c': g.color } : null },
        h('span', { class: 'handle phandle', role: 'button', 'aria-label': T('Glisser « {0} » vers un autre dossier', planTitle(p)) }, icon('grip')),
        h('button', { type: 'button', class: 'pmain', onclick: () => go('plan', p.id) },
          h('div', { class: 'nm', text: planTitle(p) }),
          g ? h('div', { class: 'tags' }, tag(p.main, true)) : null,
          h('div', { class: 'meta' }, isStretchPlan(p) ? h('b', { class: 'pmin' }, icon('clock'), T('≈ {0} min', planMinutes(p))) : null,
            (isStretchPlan(p) ? ' · ' : '') + plural(p.items.length, 'exercice', 'exercices') + (nSets && !isStretchPlan(p) ? ' · ' + plural(nSets, 'série prévue', 'séries prévues') : '') + (p.last ? ' · ' + T('faite {0}', ago(p.last)) : ''))),
        h('button', { type: 'button', class: 'pgo', 'aria-label': T('Faire « {0} » aujourd’hui', planTitle(p)), onclick: () => startPlanToday(p) }, icon('play'), h('span', { text: T('Aujourd’hui') })),
        h('button', { type: 'button', class: 'pmore', 'aria-label': T('Options de « {0} »', planTitle(p)), onclick: () => planMenu(p) }, icon('dots', 'fill')));
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
          h('strong', { text: T('Aucune séance nommée') }),
          h('p', { text: T('Ouvre un jour d’entraînement dans le calendrier, puis touche « Nommer la séance ». Elle apparaîtra ici, classée par groupe musculaire.') }),
          h('button', { type: 'button', class: 'btn primary', text: T('Ouvrir le calendrier'), onclick: () => tabGo('calendar') })));
        return;
      }
      const works = (x, top) => topOf(x.s.main) === top || x.s.sec.some((id) => topOf(id) === top);
      const tops = TREE.filter((t) => all.some((x) => works(x, t.id)));
      if (filter !== 'all' && !tops.some((t) => t.id === filter)) filter = 'all';
      body.append(chipsFor(tops, filter, (id) => (id === 'all' ? all.length : all.filter((x) => works(x, id)).length), (v) => { filter = v; }));
      const list = filter === 'all' ? all : all.filter((x) => works(x, filter));
      if (filter === 'all') {
        body.append(h('section', { class: 'sec tight' }, h('h2', { text: T('Dernière fois par groupe') }),
          h('div', { class: 'card lastlist' }, tops.map((t) => {
            const last = all.find((x) => works(x, t.id));
            return h('button', { type: 'button', class: 'lastrow', onclick: () => { filter = t.id; render(); window.scrollTo(0, 0); } },
              h('span', { class: 'dot', style: { '--c': t.color } }), h('span', { class: 'g', text: t.label }),
              h('span', { class: 'w', text: ago(last.key) + ' · ' + fDayShort.format(keyDate(last.key)) }));
          }))));
      } else {
        body.append(h('p', { class: 'sum pad', text: plural(list.length, 'séance', 'séances') + ' · ' + T('dernière {0}', ago(list[0].key)) }));
      }
      body.append(h('section', { class: 'sec tight' }, filter === 'all' ? h('h2', { text: T('Toutes les séances') }) : null, h('div', { class: 'scards' }, list.map(card))));
    }
    function card(x) {
      const g = GROUPS.get(x.s.main);
      return h('button', { type: 'button', class: 'scard', style: { '--c': g.color }, onclick: () => go('session', x.key) },
        h('div', { class: 'top' }, h('span', { class: 'date', text: dayLabel(keyDate(x.key)) }), h('span', { class: 'ago', text: ago(x.key) })),
        h('div', { class: 'nm', text: sessionTitle(x.s) }),
        h('div', { class: 'tags' }, tag(x.s.main, true), x.s.sec.map((id) => tag(id))),
        h('div', { class: 'figs' },
          h('div', {}, h('b', { text: String(x.st.nEx) }), h('span', { text: x.st.nEx > 1 ? T('exercices') : T('exercice') })),
          h('div', {}, h('b', { text: String(x.st.nSets) }), h('span', { text: x.st.nSets > 1 ? T('séries') : T('série') })),
          h('div', {}, h('b', { text: fmtNum(Math.round(x.st.load)) }), h('span', { text: T('kg soulevés') }))));
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
    const valBtn = h('button', { type: 'button', class: 'btn primary okbtn valbtn' }, icon('check'), T(' Valider'));
    wrap.append(h('header', { class: 'bar' }, backBtn(), h('h1', { class: 'grow', text: d && d.isNew ? T('Nouvelle séance') : T('Séance type') }), d ? valBtn : null, closeBtn()));
    if (!d) { wrap.append(h('p', { class: 'empty-note', text: T('Cette séance type n’existe plus.') })); return wrap; }
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
      toast(isNew ? T('Séance « {0} » créée', planTitle(p)) : T('Modifications enregistrées'));
      return true;
    }
    valBtn.addEventListener('click', async () => {
      if (!(await validate())) return;
      S.guard = null; S.planDraft = null;
      if (prevView() === 'seances') backNow(); else replaceNow('seances', { tab: 'plans' }, 'back');
    });
    S.guard = {
      dirty, save: async () => { commitPlan(d); toast(T('Séance enregistrée')); S.planDraft = null; return true; },
      missing: () => planMissing(p), discard: () => { S.planDraft = null; },
      title: d.isNew ? T('Enregistrer la séance ?') : T('Enregistrer les changements ?'),
      text: d.isNew ? T('Cette séance n’est pas encore créée.') : T('Tu as modifié cette séance sans valider.'),
      no: d.isNew ? T('Ne pas enregistrer') : T('Ne pas enregistrer les changements'),
    };

    const nameIn = h('input', { class: 'field left big', type: 'text', maxlength: '60', placeholder: T('Nom de la séance (ex. Push A)'), 'aria-label': T('Nom de la séance'), autocomplete: 'off', enterkeyhint: 'done' });
    nameIn.value = p.name;
    nameIn.addEventListener('input', () => { p.name = nameIn.value; changed(); });

    const folderSel = h('select', { class: 'field left', id: 'pl-folder' });
    function fillFolders() {
      folderSel.textContent = '';
      folderSel.append(h('option', { value: '', text: T('Sans dossier') }), ...allFolders().concat(p.folder && !allFolders().includes(p.folder) ? [p.folder] : []).map((f) => h('option', { value: f, text: f })), h('option', { value: '__new', text: T('+ Nouveau dossier…') }));
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

    const mainSel = h('select', { class: 'field left', id: 'pl-main' }, h('option', { value: '', text: T('Aucun') }), GROUP_LIST.map((g) => h('option', { value: g.id, text: g.full })));
    mainSel.value = p.main;
    const secField = groupsField(() => p.sec, (v) => { p.sec = v; changed(); }, () => p.main, 'pl-sec');
    mainSel.addEventListener('change', () => { p.main = mainSel.value; p.sec = p.sec.filter((x) => x !== p.main); secField.repaint(); changed(); });

    wrap.append(nameIn, h('div', { class: 'card pform' },
      h('label', { class: 'lbl', for: 'pl-folder', text: T('Dossier') }), folderSel,
      h('label', { class: 'lbl', for: 'pl-main', text: T('Groupe musculaire principal') }), mainSel,
      h('label', { class: 'lbl', for: 'pl-sec', text: T('Groupes secondaires') }), secField));

    const listBox = h('div');
    wrap.append(h('section', { class: 'sec' }, h('h2', { text: T('Exercices') }), listBox,
      h('button', { type: 'button', class: 'btn ghost wide addex', onclick: () => goNow('library', { pick: 'plan', id: p.id }) }, icon('plus'), T('Ajouter des exercices'))));

    function setRows(it) {
      const box = h('div', { class: 'psets' });
      const hold = isHold(it.ex);
      const blank = () => (hold ? { w: '', r: '', dur: '' } : { w: '', r: '' });
      if (!it.sets.length) {
        box.append(h('p', { class: 'empty-note', text: T('Pas de séries prévues : tu les choisiras le jour même.') }),
          h('button', { type: 'button', class: 'textbtn', onclick: () => { it.sets.push(blank()); changed(); renderList(); } }, T('Prévoir des séries')));
        return box;
      }
      it.sets.forEach((st, j) => {
        if (hold) {   // exercice à la durée : une durée prévue en secondes (vide = libre)
          const dIn = h('input', { class: 'field', type: 'text', inputmode: 'numeric', placeholder: T('secondes'), 'aria-label': T('Durée prévue en secondes, série ') + (j + 1), autocomplete: 'off' });
          dIn.value = fin(st.dur) ? String(st.dur) : '';
          dIn.addEventListener('input', () => { st.dur = durOrBlank(dIn.value); changed(); });
          box.append(h('div', { class: 'srow hold' }, h('span', { class: 'n', text: String(j + 1) }), dIn, h('span', { class: 'times', text: 's' }),
            h('span', { class: 'racts' },
              h('button', { type: 'button', class: 'iconbtn plain mini', 'aria-label': T('Dupliquer la série ') + (j + 1), onclick: () => { it.sets.splice(j + 1, 0, { w: '', r: '', dur: durOrBlank(st.dur) }); changed(); renderList(); } }, icon('copy')),
              h('button', { type: 'button', class: 'iconbtn plain mini', 'aria-label': T('Retirer la série ') + (j + 1), onclick: () => { it.sets.splice(j, 1); changed(); renderList(); } }, icon('close')))));
          return;
        }
        // Série prévue : charge en kg, ou au poids du corps (PDC) avec un lest + / − facultatif.
        const ui = { w: st.bw ? (fin(st.w) && st.w ? fmtIn(Math.abs(st.w)) : (typeof st.w === 'string' ? st.w.replace(/^[-−]/, '') : '')) : fin(st.w) ? fmtIn(st.w) : st.w || '',
          bw: !!st.bw, neg: !!st.bw && ((fin(st.w) && st.w < 0) || !!st.neg) };
        let chk = null;
        const sync = () => {
          if (chk) chk.paint();
          if (ui.bw) { st.bw = 1; const a = String(ui.w).trim() ? calcEval(ui.w) : ''; st.w = a === '' || !Number.isFinite(a) ? '' : (ui.neg ? -1 : 1) * a; st.neg = ui.neg; } else { delete st.bw; delete st.neg; st.w = numOrBlank(ui.w); }
          changed();
        };
        const wBox = weightField(ui, T('Poids prévu, série ') + (j + 1), sync);
        const rIn = h('input', { class: 'field', type: 'text', inputmode: 'numeric', placeholder: T('rép.'), 'aria-label': T('Répétitions prévues, série ') + (j + 1), autocomplete: 'off' });
        rIn.value = fin(st.r) ? String(st.r) : st.r || '';
        rIn.addEventListener('input', () => { const n = parseNum(rIn.value); st.r = Number.isFinite(n) && n > 0 ? Math.round(n) : ''; changed(); });
        chk = bwCheck(Object.assign(ui, { base: 0 }), () => { wBox.paint(); sync(); }, true);
        box.append(h('div', { class: 'srow' }, h('span', { class: 'n', text: String(j + 1) }), wBox, h('span', { class: 'times', text: T('×') }), rIn,
          h('span', { class: 'racts' },
            h('button', { type: 'button', class: 'iconbtn plain mini', 'aria-label': T('Dupliquer la série ') + (j + 1), onclick: () => { it.sets.splice(j + 1, 0, Object.assign({}, st)); changed(); renderList(); } }, icon('copy')),
            h('button', { type: 'button', class: 'iconbtn plain mini', 'aria-label': T('Retirer la série ') + (j + 1), onclick: () => { it.sets.splice(j, 1); changed(); renderList(); } }, icon('close'))),
          h('div', { class: 'dt-line' }, chk)));
      });
      box.append(h('button', { type: 'button', class: 'textbtn', onclick: () => { const l = it.sets[it.sets.length - 1]; it.sets.push(hold ? { w: '', r: '', dur: l ? durOrBlank(l.dur) : '' } : l ? Object.assign({}, l) : { w: '', r: '' }); changed(); renderList(); } }, T('+ Ajouter une série')));
      return box;
    }
    function renderList() {
      listBox.textContent = '';
      if (!p.items.length) { listBox.append(h('p', { class: 'empty-note pad', text: T('Aucun exercice pour l’instant.') })); return; }
      const list = h('div', { class: 'dlist' });
      p.items.forEach((it) => {
        const ex = getEx(it.ex);
        const n = it.sets.length;
        const isOpen = open.has(it.ex);
        const head = h('div', { class: 'dhead' },
          h('span', { class: 'handle', role: 'button', 'aria-label': T('Déplacer ') + dn(ex) }, icon('grip')),
          h('button', { type: 'button', class: 'open', 'aria-expanded': String(isOpen), onclick: () => { if (open.has(it.ex)) open.delete(it.ex); else open.add(it.ex); renderList(); } }, thumb(ex, { zoom: true }),
            h('div', { class: 'txt' }, h('div', { class: 'nm', text: dn(ex) }), h('div', { class: 'st', text: n ? plural(n, 'série prévue', 'séries prévues') : T('Séries libres') }))),
          h('span', { class: 'chev' + (isOpen ? ' up' : '') }, icon('down')));
        list.append(h('div', { class: 'sitem', 'data-id': it.ex },
          h('article', { class: 'dcard' }, swipeable(head, () => {
            const i = p.items.indexOf(it);
            p.items.splice(i, 1); changed(); renderList();
            toast(T('Exercice retiré'), { ms: 6000, action: () => { p.items.splice(i, 0, it); changed(); renderList(); } });
          }, T('Retirer ') + dn(ex)), isOpen ? setRows(it) : null)));
      });
      sortable(list, (ids) => { p.items = ids.map((x) => p.items.find((it) => it.ex === x)).filter(Boolean); changed(); });
      listBox.append(list, h('p', { class: 'hint', text: T('Touche un exercice pour prévoir ses séries. Poignée ═ : changer l’ordre. Glisser à gauche : retirer.') }));
    }
    renderList();

    /* Programmations de cette séance type, chacune avec un bouton pour l'arrêter. */
    const schedBox = h('div', { class: 'schedlist' });
    function renderSched() {
      schedBox.textContent = '';
      const list = S.schedules.filter((sc) => sc.plan === p.id);
      if (!list.length) return;
      schedBox.append(h('p', { class: 'lbl', text: T('Programmée') }));
      for (const sc of list) {
        schedBox.append(h('div', { class: 'schedrow' }, h('span', { text: schedText(sc) }),
          h('button', { type: 'button', class: 'iconbtn plain mini', 'aria-label': T('Arrêter cette programmation'), onclick: async () => {
            const ok = await confirmDialog({ title: T('Arrêter cette programmation ?'), text: T('Les dates à venir disparaissent du calendrier. Tes séries déjà faites restent.'), yes: T('Arrêter'), no: T('Annuler') });
            if (!ok) return;
            await removeSchedule(sc); renderSched(); toast(T('Programmation arrêtée'));
          } }, icon('close'))));
      }
    }
    if (!d.isNew) {
      wrap.append(h('section', { class: 'sec plan-acts' },
        h('button', { type: 'button', class: 'btn ghost wide', onclick: async () => {
          if (dirty() && !(await validate())) return;
          S.guard = null; S.planDraft = null;
          const saved = S.plans.find((x) => x.id === p.id);
          if (saved) startPlanToday(saved);
        } }, icon('play'), T(' Faire cette séance aujourd’hui')),
        h('button', { type: 'button', class: 'btn ghost wide', onclick: async () => {
          if (dirty() && !(await validate())) return;
          const saved = S.plans.find((x) => x.id === p.id);
          if (saved) scheduleDialog({ plan: saved, onDone: () => renderSched() });
        } }, icon('folder'), T(' Programmer cette séance')),
        schedBox,
        h('button', { type: 'button', class: 'textbtn danger center', text: T('Supprimer cette séance type'), onclick: async () => {
          const ok = await confirmDialog({ title: T('Supprimer « {0} » ?', planTitle(p)), text: T('Ses exercices prévus pas encore faits et sa programmation sont retirés du calendrier. Tes séries déjà faites restent.'), yes: T('Supprimer'), no: T('Annuler') });
          if (!ok) return;
          await removePlan(p);
          S.guard = null; S.planDraft = null; backNow(); toast(T('Séance type supprimée'));
        } })));
      renderSched();
    }
    return wrap;
  }

  /* ---------- synchronisation avec ton NAS (PocketBase) ----------
     Seule l'adresse que tu as saisie dans Réglages est contactée : rien n'est écrit dans le code de
     l'app ni envoyé ailleurs. Le jeton de connexion reste sur ce téléphone (jamais exporté) et le mot
     de passe n'est pas enregistré. Un seul enregistrement par compte, qui contient toutes tes données. */
  function loadNas() { try { const o = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  let NAS = loadNas();   // { token, uid, at (date du jeton), base (données communes au téléphone et au NAS), auto, last, err }
  function saveNas() { try { localStorage.setItem(SYNC_KEY, JSON.stringify(NAS)); } catch (e) { /* ignoré */ } }
  const nasUrl = () => String(S.settings.nas.url || '').replace(/\/+$/, '');
  const nasOn = () => !!(nasUrl() && NAS.token && NAS.uid);
  async function nasFetch(path, opts) {
    const o = Object.assign({}, opts || {});
    o.headers = Object.assign({ 'Content-Type': 'application/json' }, NAS.token ? { Authorization: NAS.token } : {});
    const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 20000); o.signal = ctrl.signal;
    let r;
    try { r = await fetch(nasUrl() + path, o); } catch (e) { throw Object.assign(new Error('net'), { code: 'net' }); } finally { clearTimeout(tm); }
    let body = null;
    try { body = await r.json(); } catch (e) { body = null; }
    if (!r.ok) throw Object.assign(new Error('http'), { code: r.status, body });
    return body;
  }
  function nasMsg(e) {
    if (e.code === 'url') return T('Adresse invalide : elle doit commencer par https://');
    if (e.code === 'net') return T('Serveur injoignable : vérifie l’adresse et ta connexion.');
    if (e.code === 400 && e.body && /auth/i.test(JSON.stringify(e.body))) return T('E-mail ou mot de passe incorrect.');
    if (e.code === 401 || e.code === 403) return T('Connexion refusée ou expirée : reconnecte-toi.');
    if (e.code === 404) return T('Collection « worklog » introuvable sur le serveur : suis le guide d’installation.');
    if (e.code === 400) return T('Le serveur a refusé les données : vérifie les réglages de la collection « worklog » (voir le guide).');
    return T('Erreur du serveur ({0}).', e.code);
  }
  async function nasLogin(url, email, pw) {
    url = url.trim().replace(/\/+$/, '');
    if (!/^https:\/\/[^\s/]+/i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url)) throw Object.assign(new Error('url'), { code: 'url' });
    S.settings.nas = { url, email: email.trim() };
    NAS = { auto: NAS.auto !== false };
    const r = await nasFetch('/api/collections/users/auth-with-password', { method: 'POST', body: JSON.stringify({ identity: email.trim(), password: pw }) });
    NAS.token = r && r.token; NAS.uid = r && r.record && r.record.id; NAS.at = Date.now();
    if (!NAS.token || !NAS.uid) throw Object.assign(new Error('http'), { code: 401 });
    saveNas();
    await saveUser({ quiet: true });
  }
  function nasLogout() { NAS = { auto: NAS.auto !== false }; saveNas(); }
  /* Le jeton est renouvelé quand l'app s'ouvre (il reste valable tant que tu ouvres l'app régulièrement). */
  async function nasRefresh() {
    if (Date.now() - (NAS.at || 0) < 86400000) return;
    const r = await nasFetch('/api/collections/users/auth-refresh', { method: 'POST' });
    if (r && r.token) { NAS.token = r.token; NAS.at = Date.now(); saveNas(); }
  }
  async function nasGet() {
    const r = await nasFetch('/api/collections/worklog/records?perPage=1&filter=' + encodeURIComponent('user="' + NAS.uid + '"'));
    return r && Array.isArray(r.items) && r.items[0] ? r.items[0] : null;
  }
  async function nasPush(rec) {
    const data = Object.assign({ app: 'WorkLog', version: DATA_V, kind: 'all', savedAt: S.savedAt }, userData());
    const body = JSON.stringify({ user: NAS.uid, savedAt: S.savedAt, data });
    if (rec) await nasFetch('/api/collections/worklog/records/' + rec.id, { method: 'PATCH', body });
    else await nasFetch('/api/collections/worklog/records', { method: 'POST', body });
    NAS.base = S.savedAt;
  }
  function applyRemote(d) {
    S.entries = (Array.isArray(d.entries) ? d.entries : []).filter(validEntry).map(normEntry);
    S.favs = new Set((Array.isArray(d.favs) ? d.favs : Array.isArray(d.favorites) ? d.favorites : []).filter((x) => typeof x === 'string'));
    S.sessions = cleanSessions(d.sessions); S.days = cleanDays(d.days); S.notes = cleanNotes(d.notes);
    S.plans = cleanPlans(d.plans); S.folders = cleanFolders(d.folders); S.schedules = cleanSchedules(d.schedules);
    S.settings.bw = cleanSettings(d.settings).bw;   // l'adresse du NAS reste celle de ce téléphone
  }
  const remoteAt = (rec) => (rec && fin(rec.savedAt) && rec.savedAt ? rec.savedAt : rec && rec.data && fin(rec.data.savedAt) ? rec.data.savedAt : 0);
  let nasBusy = null; let nasTimer = null; let nasQuiet = false;
  function nasSoon() {
    if (!nasOn() || NAS.auto === false || nasQuiet) return;
    clearTimeout(nasTimer);
    nasTimer = setTimeout(() => { nasSync(); }, 4000);
  }
  function rerender() { if (!guarded()) { snapshot(); render(S.stack[S.stack.length - 1]); } }
  /* Synchronise : envoie les changements faits sur ce téléphone et récupère ceux faits ailleurs.
     Si les deux ont changé depuis la dernière fois, les données sont fusionnées (rien n'est perdu). */
  async function nasSync(opts) {
    if (!nasOn()) return false;
    if (nasBusy) return nasBusy;
    nasBusy = (async () => {
      let pulled = false;
      try {
        await nasRefresh();
        const rec = await nasGet();
        const base = NAS.base || 0;
        const rAt = remoteAt(rec);
        const localChanged = S.savedAt > base;
        if (!rec) await nasPush(null);
        else if (rAt > base) {
          nasQuiet = true;
          try {
            if (localChanged) {   // modifié ici et ailleurs : on fusionne puis on renvoie le tout
              mergeData(rec.data || {});
              await saveUser({ quiet: true });
              await nasPush(rec);
            } else {   // modifié seulement ailleurs : on reprend les données du NAS
              applyRemote(rec.data || {});
              await saveUser({ quiet: true, at: rAt });
              NAS.base = rAt;
            }
          } finally { nasQuiet = false; }
          pulled = true;
        } else if (localChanged) await nasPush(rec);
        NAS.last = Date.now(); NAS.err = '';
        saveNas();
        if (pulled) { rerender(); toast(T('Données mises à jour depuis ton NAS')); } else if (opts && opts.loud) toast(T('Synchronisation terminée'));
        return true;
      } catch (e) {
        NAS.err = nasMsg(e); saveNas();
        if (opts && opts.loud) toast(NAS.err, { ms: 5000 });
        return false;
      } finally { nasBusy = null; if (opts && opts.after) opts.after(); }
    })();
    return nasBusy;
  }
  /* Remplace les données de ce téléphone par celles du NAS. */
  async function nasPullAll() {
    try {
      const rec = await nasGet();
      if (!rec) { toast(T('Aucune donnée sur ton NAS pour l’instant.')); return false; }
      nasQuiet = true;
      try { applyRemote(rec.data || {}); await saveUser({ quiet: true, at: remoteAt(rec) }); } finally { nasQuiet = false; }
      NAS.base = remoteAt(rec); NAS.last = Date.now(); NAS.err = ''; saveNas();
      toast(T('Données récupérées depuis ton NAS'));
      return true;
    } catch (e) { NAS.err = nasMsg(e); saveNas(); toast(NAS.err, { ms: 5000 }); return false; }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && nasOn() && NAS.auto !== false && Date.now() - (NAS.last || 0) > 60000) nasSync();
  });

  /* ---------- diagnostic (Réglages › Diagnostic, désactivé par défaut) ----------
     Un petit compteur en direct en bas de l'écran, et un relevé enregistré toutes les 2 secondes.
     Si l'app se fige ou s'arrête sans être fermée normalement, le dernier relevé s'affiche à la
     réouverture, prêt à être copié et envoyé. */
  const DIAG_KEY = 'worklog.diag';     // compteur à l'écran
  const CRASH_KEY = 'worklog.crash';   // rapports de plantage
  const DIAG_LOG = 'worklog.diag.log';
  let diagBox = null; let diagTimer = null; let diagLast = 0; let diagGap = 0;
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignoré */ } };
  const diagOn = () => lsGet(DIAG_KEY) === '1';
  // Rapports de plantage : réglage à part ; s'il n'a jamais été choisi, il suit le compteur (comme en 0.7.1 et 0.7.2).
  const crashOn = () => { const v = lsGet(CRASH_KEY); return v == null ? diagOn() : v === '1'; };
  function diagRead() { try { const a = JSON.parse(localStorage.getItem(DIAG_LOG) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function diagWrite(a) { try { localStorage.setItem(DIAG_LOG, JSON.stringify(a.slice(-40))); } catch (e) { /* ignoré */ } }
  function diagSnap() {
    const imgs = [...document.images];
    const top = S.stack[S.stack.length - 1];
    return { t: Date.now(), v: top ? top.view : '', rows: document.querySelectorAll('.exrow').length, open: document.querySelectorAll('details.group[open]').length,
      img: imgs.filter((i) => i.getAttribute('src')).length, gif: imgs.filter((i) => /\.gif/.test(i.getAttribute('src') || '')).length,
      cv: document.querySelectorAll('canvas').length, an: ANIM.size, px: [...document.querySelectorAll('canvas')].reduce((n, c) => n + c.width * c.height, 0),
      el: document.getElementsByTagName('*').length, y: Math.round(window.scrollY), gap: diagGap };
  }
  function diagTick() {
    const now = Date.now();
    // Retard du relevé : si l'app a été bloquée, ce relevé arrive en retard.
    const late = diagLast ? now - diagLast - 2000 : 0;
    diagLast = now;
    if (late > diagGap) diagGap = late;
    const sn = diagSnap();
    if (diagBox && !diagOn()) { diagBox.remove(); diagBox = null; }
    if (!diagBox && diagOn()) { diagBox = h('div', { class: 'diagbox', 'aria-hidden': 'true' }); document.body.append(diagBox); }
    if (diagBox) diagBox.textContent = T('{0} lignes · {1} animées · {2} cat. ouvertes · {3} éléments', sn.rows, sn.an, sn.open, sn.el) + (late > 400 ? ' · ' + T('bloqué {0} s', (late / 1000).toFixed(1)) : '');
    if (crashOn()) { const log = diagRead(); log.push(sn); diagWrite(log); }
  }
  /* Lance ou arrête le relevé selon les deux réglages (compteur, rapports de plantage). */
  function diagApply() {
    if (diagOn() || crashOn()) {
      if (!diagTimer) { diagLast = 0; diagGap = 0; diagTimer = setInterval(diagTick, 2000); }
      diagTick();
    } else {
      clearInterval(diagTimer); diagTimer = null;
      if (diagBox) { diagBox.remove(); diagBox = null; }
    }
    if (!crashOn()) diagWrite([]);
  }
  // Fermeture normale (changement d'app, fermeture) : le relevé est marqué « propre ».
  const diagClean = () => { if (!diagTimer || !crashOn()) return; const log = diagRead(); log.push({ t: Date.now(), clean: true }); diagWrite(log); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') diagClean(); else if (diagTimer) { diagLast = 0; diagTick(); } });
  window.addEventListener('pagehide', diagClean);
  function diagReport(log) {
    const fmt = (x) => fTime.format(x.t) + ' · ' + x.v + ' · ' + T('{0} lignes · {1} animées · {2} cat. ouvertes · {3} éléments', x.rows, x.an, x.open, x.el) + ' · img ' + x.img + ' · canvas ' + x.cv + ' (' + Math.round((x.px || 0) * 4 / 1048576) + ' Mo) · y ' + x.y + (x.gap > 400 ? ' · ' + T('bloqué {0} s', (x.gap / 1000).toFixed(1)) : '');
    const last = log.filter((x) => !x.clean).slice(-8);
    return [T('WorkLog {0} · rapport de diagnostic', APP_VERSION), navigator.userAgent, ...last.map(fmt)].join('\n');
  }
  /* À l'ouverture : si la dernière session s'est arrêtée sans fermeture normale, on montre son relevé. */
  function diagBoot() {
    if (!diagOn() && !crashOn()) return;
    const log = crashOn() ? diagRead() : [];
    const last = log[log.length - 1];
    if (last && !last.clean && Date.now() - last.t < 86400000) {
      const text = diagReport(log);
      let close = null;
      const ta = h('textarea', { class: 'field left sumtext', rows: '8', readonly: true }); ta.value = text;
      close = openModal(h('div', { class: 'dialog sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' },
        h('h2', { id: 'dlg-t', text: T('WorkLog s’est arrêté') }),
        h('p', { text: T('La dernière fois, l’app s’est figée ou arrêtée sans être fermée normalement. Voici ce qui se passait juste avant : copie-le et envoie-le.') }), ta,
        h('div', { class: 'acts' }, h('button', { type: 'button', class: 'btn ghost', text: T('Fermer'), onclick: () => close() }),
          h('button', { type: 'button', class: 'btn primary', text: T('Copier le rapport'), onclick: async () => { if (await copyText(text)) { toast(T('Rapport copié')); close(); } else ta.select(); } }))));
    }
    diagWrite([]);
    diagApply();
  }

  /* ---------- réglages ---------- */
  function viewSettings() {
    const wrap = h('main', { class: 'page settings' });
    wrap.append(h('header', { class: 'bar' }, backBtn(), h('h1', { class: 'grow', text: T('Réglages') }), h('span')));

    // Langue de l'application (les noms d'exercices suivent la langue).
    const setLang = (l) => {
      if (l === LANG) return;
      try { localStorage.setItem(LANG_KEY, l); } catch (e) { /* ignoré */ }
      location.reload();
    };
    wrap.append(h('section', { class: 'sec' }, h('h2', { text: T('Langue') }),
      h('div', { class: 'tabs two', role: 'tablist', 'aria-label': T('Langue') },
        [['fr', 'Français'], ['en', 'English']].map(([l, label]) => h('button', { type: 'button', role: 'tab', class: 'tab', 'aria-selected': String(LANG === l), text: label, onclick: () => setLang(l) }))),
      h('p', { class: 'hint', text: T('Toute l’application, y compris les noms des exercices.') })));

    // Poids du corps : utilisé pour les séries « PDC ».
    const bwIn = h('input', { class: 'field', type: 'text', inputmode: 'decimal', id: 'st-bw', placeholder: 'kg', autocomplete: 'off', enterkeyhint: 'done' });
    bwIn.value = bwKg() ? fmtIn(bwKg()) : '';
    const bwMsg = h('p', { class: 'form-msg', role: 'alert' });
    const saveBw = async () => {
      const v = bwIn.value.trim();
      if (!v) { if (S.settings.bw !== '') { S.settings.bw = ''; await saveUser(); } return; }
      const n = calcEval(v);
      if (!(n > 0 && n < 400)) { bwMsg.textContent = T('Poids du corps : un nombre en kilos.'); bwIn.classList.add('invalid'); return; }
      bwMsg.textContent = ''; bwIn.classList.remove('invalid');
      const r = Math.round(n * 10) / 10;
      if (r !== S.settings.bw) { S.settings.bw = r; await saveUser(); toast(T('Poids du corps enregistré : {0} kg', fmtNum(r))); }
      bwIn.value = fmtIn(r);
    };
    bwIn.addEventListener('change', saveBw);
    bwIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') bwIn.blur(); });
    wrap.append(h('section', { class: 'sec' }, h('h2', { text: T('Poids du corps') }),
      h('div', { class: 'card' }, h('div', { class: 'bwrow' }, h('label', { for: 'st-bw', text: T('Ton poids') }), bwIn, h('span', { text: 'kg' })), bwMsg,
        h('p', { class: 'hint', text: T('Utilisé pour les séries au poids du corps (case « PDC ») : le poids soulevé = ton poids + le lest, ou − l’assistance. Les séries déjà enregistrées gardent le poids de l’époque.') }))));

    // Synchronisation avec le NAS.
    const nasBox = h('div', { class: 'card nas' });
    wrap.append(h('section', { class: 'sec' }, h('h2', { text: T('Synchronisation avec ton NAS') }), nasBox));
    function renderNas() {
      nasBox.textContent = '';
      const guide = h('a', { class: 'textbtn guide', href: 'docs/synchronisation-nas.html', target: '_blank', rel: 'noopener' }, T('Guide d’installation (Synology + PocketBase)'));
      if (!nasOn()) {
        const url = h('input', { class: 'field left', type: 'url', id: 'nas-url', placeholder: 'https://worklog.exemple.synology.me', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
        const mail = h('input', { class: 'field left', type: 'email', id: 'nas-mail', placeholder: T('e-mail du compte PocketBase'), autocomplete: 'username', autocapitalize: 'none' });
        const pw = h('input', { class: 'field left', type: 'password', id: 'nas-pw', autocomplete: 'current-password' });
        url.value = S.settings.nas.url || ''; mail.value = S.settings.nas.email || '';
        const msg = h('p', { class: 'form-msg', role: 'alert', text: NAS.err || '' });
        const btn = h('button', { type: 'button', class: 'btn primary wide', text: T('Se connecter') });
        btn.addEventListener('click', async () => {
          msg.textContent = '';
          if (!url.value.trim() || !mail.value.trim() || !pw.value) { msg.textContent = T('Remplis l’adresse, l’e-mail et le mot de passe.'); return; }
          btn.disabled = true; btn.textContent = T('Connexion…');
          try {
            await nasLogin(url.value, mail.value, pw.value);
            NAS.err = ''; saveNas();
            await nasSync({ loud: true });
          } catch (e) { msg.textContent = nasMsg(e); }
          btn.disabled = false; btn.textContent = T('Se connecter');
          if (nasOn()) renderNas();
        });
        nasBox.append(h('p', { class: 'intro', text: T('Sauvegarde automatique de toutes tes données sur ton propre serveur PocketBase (par exemple sur ton Synology). Rien ne part ailleurs : l’app ne contacte que l’adresse ci-dessous.') }),
          h('label', { class: 'lbl', for: 'nas-url', text: T('Adresse du serveur') }), url,
          h('label', { class: 'lbl', for: 'nas-mail', text: T('E-mail') }), mail,
          h('label', { class: 'lbl', for: 'nas-pw', text: T('Mot de passe') }), pw, msg, btn,
          h('p', { class: 'hint', text: T('Le mot de passe n’est pas enregistré : seul un jeton de connexion reste sur ce téléphone.') }), guide);
        return;
      }
      const auto = h('input', { type: 'checkbox' });
      auto.checked = NAS.auto !== false;
      auto.addEventListener('change', () => { NAS.auto = auto.checked; saveNas(); if (auto.checked) nasSync(); });
      const status = NAS.err ? h('p', { class: 'nas-err', text: NAS.err })
        : h('p', { class: 'nas-ok', text: NAS.last ? T('Dernière synchronisation : {0}', fDateTime.format(NAS.last)) : T('Pas encore synchronisé') });
      const syncBtn = h('button', { type: 'button', class: 'btn primary wide', text: T('Synchroniser maintenant') });
      syncBtn.addEventListener('click', async () => { syncBtn.disabled = true; syncBtn.textContent = T('Synchronisation…'); await nasSync({ loud: true }); renderNas(); });
      nasBox.append(
        h('p', { class: 'nas-who' }, h('b', { text: S.settings.nas.url }), h('br'), S.settings.nas.email || ''),
        status,
        h('label', { class: 'gs-row' }, auto, h('span', { class: 'gl', text: T('Synchroniser automatiquement') })),
        h('p', { class: 'hint', text: T('À l’ouverture de l’app et quelques secondes après chaque modification. iOS ne laisse pas une app web travailler quand elle est fermée.') }),
        syncBtn,
        h('button', { type: 'button', class: 'btn ghost wide', text: T('Remplacer par les données du NAS'), onclick: async () => {
          const ok = await confirmDialog({ title: T('Remplacer les données de ce téléphone ?'), text: T('Les données de ce téléphone sont remplacées par celles enregistrées sur ton NAS.'), yes: T('Remplacer'), no: T('Annuler') });
          if (ok && await nasPullAll()) renderNas();
        } }),
        h('button', { type: 'button', class: 'textbtn danger center', text: T('Se déconnecter'), onclick: () => { nasLogout(); renderNas(); toast(T('Déconnecté du NAS : tes données restent sur ce téléphone.')); } }),
        guide);
    }
    renderNas();

    // Diagnostic : deux réglages indépendants, le compteur à l'écran et les rapports de plantage.
    const dg = h('input', { type: 'checkbox' });
    dg.checked = diagOn();
    dg.addEventListener('change', () => { lsSet(DIAG_KEY, dg.checked ? '1' : '0'); diagApply(); });
    const cr = h('input', { type: 'checkbox' });
    cr.checked = crashOn();
    cr.addEventListener('change', () => { lsSet(CRASH_KEY, cr.checked ? '1' : '0'); diagWrite([]); diagApply(); });
    if (S.settings.diag) wrap.append(h('section', { class: 'sec' }, h('h2', { text: T('Diagnostic') }),
      h('div', { class: 'card' },
        h('label', { class: 'gs-row' }, dg, h('span', { class: 'gl', text: T('Afficher le compteur') })),
        h('p', { class: 'hint', text: T('Affiche en bas de l’écran le nombre de lignes, de vignettes animées et de catégories ouvertes.') }),
        h('label', { class: 'gs-row' }, cr, h('span', { class: 'gl', text: T('Rapports de plantage') })),
        h('p', { class: 'hint', text: T('L’app note discrètement son état toutes les 2 secondes, sur ce téléphone uniquement. Si elle se fige ou s’arrête sans être fermée normalement, le relevé de juste avant s’affiche à la réouverture, prêt à être copié.') }))));
    // Diagnostic caché : 7 appuis sur la version le font apparaître (gardé dans l'export complet).
    let taps = 0; let tapT = 0;
    const ver = h('button', { type: 'button', class: 'ver-line', text: T('WorkLog version {0}', APP_VERSION) });
    ver.addEventListener('click', () => {
      if (S.settings.diag) return;
      const now = Date.now(); taps = now - tapT < 1500 ? taps + 1 : 1; tapT = now;
      const left = 7 - taps;
      if (left <= 0) { S.settings.diag = true; saveUser(); snapshot(); render(S.stack[S.stack.length - 1]); return; }
      ver.textContent = left <= 4 ? T('Encore {0} appui(s) pour le diagnostic', left) : T('WorkLog version {0}', APP_VERSION);
    });
    wrap.append(ver);
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
    if (nasOn() && NAS.auto !== false) nasSync();
    diagBoot();
    // Écran « Tourne ton téléphone », affiché seulement en paysage (l'app est faite pour le portrait).
    document.body.append(h('div', { id: 'rotate', 'aria-hidden': 'true' }, h('div', {}, h('b', { text: T('Tourne ton téléphone') }), h('span', { text: T('WorkLog s’utilise en portrait.') }))));
  }
  boot();
})();
