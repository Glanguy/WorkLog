'use strict';
/* =====================================================================
   WorkLog 0.7.4 : mannequin 3D des exercices de musculation mis en favoris.
   Ces exercices restent ceux de la bibliothèque (même identifiant, mêmes séries, mêmes graphiques,
   on y note toujours poids × répétitions) : seul le visuel change, le mannequin remplace le gif ou les photos.
   Même description des poses que exercices-3d.js (repère : debout, le personnage regarde vers +Z, sa gauche est +X,
   le haut est +Y, en mètres). En plus :
     float : true       corps porté (barre de traction, siège de machine) : il n'est pas recalé sur le sol
     props : [fn(...)]  matériel dessiné à chaque image d'après la pose (barre dans les mains, câble qui suit la main,
                        bras de machine qui suit la jambe…). Pièces : cyl (a, b, r), box (c, s, axes x y z), sph (c, r).
                        held : pièce tenue en main ; le contrôle qa.js vérifie que le corps n'entre pas dans le reste.
   ===================================================================== */
(function () {
  /* ---------- outils ---------- */
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const ortho = (n, d) => norm(sub(n, mul(d, dot(n, d))));   // n rendu perpendiculaire à d
  const D2R = Math.PI / 180;
  const rotX = (v, deg) => { const c = Math.cos(deg * D2R), s = Math.sin(deg * D2R); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };
  const rotY = (v, deg) => { const c = Math.cos(deg * D2R), s = Math.sin(deg * D2R); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };

  const AH = 0.10;                                   // hauteur de la cheville, pied à plat
  const flatF = (x, z, o) => Object.assign({ at: [x, AH, z], foot: 'flat' }, o);
  const KN = (s, o) => Object.assign({ d: [s * 0.02, -1, 0], e: [0, -0.02, -1], foot: 76 }, o);   // genou au sol, tibia au sol
  const m2 = (k, v) => ({ [k + 'L']: v, [k + 'R']: v });
  const mus = (...parts) => Object.assign({}, ...parts);

  /* Main qui tient quelque chose au point G (monde) : doigts d, paume n (vers l'objet). Renvoie la cible du poignet et l'orientation. */
  const grip = (G, d, n, o) => { d = norm(d); n = ortho(n, d); return Object.assign({ at: sub(sub(G, mul(d, 0.075)), mul(n, 0.028)), hand: { d, n } }, o); };
  /* Idem dans le repère du thorax (l'objet suit le buste : barre sur le dos, poignée contre la poitrine…). */
  const gripB = (G, d, n, o) => { d = norm(d); n = ortho(n, d); return Object.assign({ atb: sub(sub(G, mul(d, 0.075)), mul(n, 0.028)), hand: { db: d, nb: n } }, o); };


  /* Main au bout du bras (écartés, élévations) : doigts dans l'axe épaule → main, paume vers « pv ». sh : épaule approximative. */
  const SH = (s, y, z) => [s * 0.205, y == null ? 1.43 : y, z == null ? -0.01 : z];
  const reach = (sh, G, pv, o) => grip(G, sub(G, sh), pv, o);

  /* Mains derrière la tête (doigts sur l'arrière du crâne, coudes ouverts) : repère du thorax. */
  const HBH = (s, o) => Object.assign({ atb: [s * 0.12, 0.40, -0.09], hand: { db: [-s * 0.55, 0.25, -0.8], nb: [-s * 0.75, 0, 0.6] }, pb: [s, 0.3, -0.2] }, o);

  /* ---------- matériel ---------- */
  const PAD = [0.27, 0.26, 0.30], FRAME = [0.80, 0.80, 0.83], BAR = [0.56, 0.56, 0.62], PLATE = [0.22, 0.22, 0.25], CABLE = [0.14, 0.14, 0.16], BALL = [0.88, 0.88, 0.92], BAND = [0.25, 0.64, 0.56], KB = [0.24, 0.24, 0.27];
  const fn = (f, o) => Object.assign({ type: 'fn', f }, o || {});
  const cyl = (a, b, r, col, o) => Object.assign({ k: 'cyl', a, b, r, col }, o);
  const box = (c, s, col, o) => Object.assign({ k: 'box', c, s, col }, o);
  const sph = (c, r, col, o) => Object.assign({ k: 'sph', c, r, col }, o);
  /* Boîte inclinée autour de l'axe X (dossier de banc incliné, plateau de machine) : ang en degrés, + = haut vers +Z. */
  const tbox = (c, s, ang, col, o) => box(c, s, col, Object.assign({ x: [1, 0, 0], y: rotX([0, 1, 0], ang), z: rotX([0, 0, 1], ang) }, o));
  /* Barre tenue à deux mains : passe par les deux paumes ; disques de chaque côté. */
  const barbell = (o) => fn((C) => {
    o = o || {}; const gl = C.hand('L').grip, gr = C.hand('R').grip; const m = mul(add(gl, gr), 0.5); const u = norm(sub(gl, gr));
    const half = o.half || 1.0, pr = o.plate == null ? 0.2 : o.plate; const out = [cyl(add(m, mul(u, -half)), add(m, mul(u, half)), o.r || 0.014, BAR, { held: true, name: 'barre' })];
    if (pr) for (const s of [-1, 1]) {
      const p0 = add(m, mul(u, s * (o.pin || 0.80))); out.push(cyl(p0, add(m, mul(u, s * ((o.pin || 0.80) + (o.pw || 0.07)))), pr, PLATE, { name: 'disque' }));
    }
    return out;
  }, o && o.static ? { nofit: false } : null);
  /* Haltère dans une main : manche en travers de la paume. */
  const dbIn = (sd, o) => fn((C) => {
    o = o || {}; const h = C.hand(sd); const r = o.r || 0.055, hw = o.hw || 0.065;
    return [cyl(add(h.grip, mul(h.across, -hw - 0.05)), add(h.grip, mul(h.across, hw + 0.05)), 0.016, BAR, { held: true, name: 'haltère' }),
      cyl(add(h.grip, mul(h.across, hw)), add(h.grip, mul(h.across, hw + 0.05)), r, PLATE, { held: true, name: 'haltère' }),
      cyl(add(h.grip, mul(h.across, -hw - 0.05)), add(h.grip, mul(h.across, -hw)), r, PLATE, { held: true, name: 'haltère' })];
  });
  const dbs = (o) => [dbIn('L', o), dbIn('R', o)];
  /* Kettlebell dans une main : la boule pend sous la poignée, ou repose sur le dos de l'avant-bras quand la main est en l'air. */
  const kbIn = (sd) => fn((C) => {
    const h = C.hand(sd); const k = Math.min(1, Math.max(0, (h.fing[1] + 0.2) / 0.6));
    const dir = C.norm(C.add(C.mul([0, -1, 0], 1 - k), C.mul(C.add(C.mul(h.palm, -1), C.mul(h.fing, -0.25)), k)));
    return [cyl(C.add(h.grip, C.mul(h.across, -0.065)), C.add(h.grip, C.mul(h.across, 0.065)), 0.013, KB, { held: true, name: 'kettlebell' }),
      cyl(C.add(h.grip, C.mul(h.across, -0.06)), C.add(C.add(h.grip, C.mul(h.across, -0.05)), C.mul(dir, 0.07)), 0.012, KB, { held: true }),
      cyl(C.add(h.grip, C.mul(h.across, 0.06)), C.add(C.add(h.grip, C.mul(h.across, 0.05)), C.mul(dir, 0.07)), 0.012, KB, { held: true }),
      sph(C.add(h.grip, C.mul(dir, 0.115)), 0.075, KB, { held: true, name: 'kettlebell' })];
  });

  /* Poignée de câble dans la main + câble jusqu'à la poulie (point fixe). */
  const cableTo = (sd, from, o) => fn((C) => {
    o = o || {}; const h = C.hand(sd); const end = add(h.grip, mul(norm(sub(from, h.grip)), 0.05));
    const out = [cyl(add(h.grip, mul(h.across, -0.065)), add(h.grip, mul(h.across, 0.065)), 0.015, PLATE, { held: true, name: 'poignée' }),
      cyl(end, from, 0.006, CABLE, { soft: true }), sph(from, 0.035, FRAME, { name: 'poulie' })];
    return out;
  });
  /* Élastique d'un point fixe à la main. */
  const bandTo = (sd, from) => fn((C) => { const h = C.hand(sd); return [cyl(h.grip, from, 0.009, BAND, { soft: true })]; });
  /* Colonne de poulie (cadre + pile de poids), posée au sol. */
  const tower = (x, z, h, o) => fn(() => { o = o || {}; const w = o.w || 0.5; return [
    cyl([x - w / 2, 0, z], [x - w / 2, h, z], 0.03, FRAME, { name: 'poulie' }), cyl([x + w / 2, 0, z], [x + w / 2, h, z], 0.03, FRAME, { name: 'poulie' }),
    cyl([x - w / 2, h, z], [x + w / 2, h, z], 0.03, FRAME, { name: 'poulie' }), box([x, 0.45, z], [w * 0.6, 0.7, 0.12], PLATE, { name: 'poulie' })]; });
  /* Banc plat : plateau (haut à la hauteur h), de z0 à z1, et ses pieds. */
  const bench = (z0, z1, h, o) => { o = o || {}; const x = o.x || 0, w = o.w || 0.27, t = 0.07; return [
    box([x, h - t / 2, (z0 + z1) / 2], [w, t, z1 - z0], PAD, { name: 'banc' }),
    box([x, (h - t) / 2, z0 + 0.08], [w * 0.8, h - t, 0.05], FRAME, { name: 'banc' }), box([x, (h - t) / 2, z1 - 0.08], [w * 0.8, h - t, 0.05], FRAME, { name: 'banc' })]; };

  /* Banc droit à dossier (assis) et banc incliné (dossier à 50°). */
  const UPB = () => [box([0, 0.42, 0.0], [0.34, 0.07, 0.40], PAD, { name: 'banc' }), tbox([0, 0.88, -0.27], [0.32, 0.72, 0.07], -10, PAD, { name: 'dossier' }), box([0, 0.19, 0.0], [0.10, 0.38, 0.10], FRAME)];
  const INB = () => [box([0, 0.42, 0.08], [0.32, 0.07, 0.34], PAD, { name: 'siège' }), tbox([0, 0.748, -0.411], [0.30, 0.80, 0.07], -50, PAD, { name: 'dossier' }), box([0, 0.20, -0.1], [0.10, 0.40, 0.10], FRAME)];
  /* Station de dips : deux barres parallèles à 1,25 m. */
  const DIPS = () => fn(() => { const out = []; for (const s of [1, -1]) { out.push(cyl([s * 0.27, 1.25, -0.30], [s * 0.27, 1.25, 0.40], 0.02, BAR, { held: true, name: 'barre' }),
    cyl([s * 0.27, 1.25, 0.40], [s * 0.34, 0, 0.45], 0.03, FRAME, { name: 'cadre' }), cyl([s * 0.27, 1.25, -0.30], [s * 0.34, 0, -0.35], 0.03, FRAME, { name: 'cadre' })); } return out; });

  WL3D.define([
    /* ======================= JAMBES ======================= */
    { id: 'e0043', lib: true, name: 'Squat complet à la barre', en: 'Barbell full squat', mus: mus(m2('quad', 1), m2('calf', 2)), cam: { yaw: 35, pitch: 8 },
      props: [barbell()],
      poses: {
        a: { pelvis: [0, 0.915, 0], rot: [6, 0, 0], neck: [-4, 0, 0], lL: flatF(0.17, 0.02, { toe: [0.25, 0, 1] }), lR: flatF(-0.17, 0.02, { toe: [-0.25, 0, 1] }),
          aL: gripB([0.45, 0.235, -0.06], [0, 1, 0.15], [0, -0.15, 1], { pb: [0.75, -1, -0.8] }), aR: gripB([-0.45, 0.235, -0.06], [0, 1, 0.15], [0, -0.15, 1], { pb: [-0.75, -1, -0.8] }) },
        b: { pelvis: [0, 0.45, -0.21], rot: [38, 0, 0], neck: [-22, 0, 0], lL: flatF(0.17, 0.02, { toe: [0.25, 0, 1], p: [0.45, 0, 1] }), lR: flatF(-0.17, 0.02, { toe: [-0.25, 0, 1], p: [-0.45, 0, 1] }),
          aL: gripB([0.45, 0.235, -0.06], [0, 1, 0.15], [0, -0.15, 1], { pb: [0.75, -1, -0.8] }), aR: gripB([-0.45, 0.235, -0.06], [0, 1, 0.15], [0, -0.15, 1], { pb: [-0.75, -1, -0.8] }) },
      },
      seq: [['a', 0.5, 1.3], ['b', 0.3, 1.3]] },

    { id: 'e0085', lib: true, name: 'Soulevé de terre roumain à la barre', en: 'Barbell romanian deadlift', mus: mus(m2('glute', 1), m2('ham', 2), m2('low', 2), m2('calf', 2)), cam: { yaw: 95, pitch: 8 },
      props: [barbell()],
      poses: {
        a: { pelvis: [0, 0.92, 0], rot: [4, 0, 0], lL: flatF(0.12, 0.02), lR: flatF(-0.12, 0.02),
          aL: grip([0.24, 0.70, 0.13], [0, -1, 0], [0, 0, -1], { p: [0.3, 0, -1] }), aR: grip([-0.24, 0.70, 0.13], [0, -1, 0], [0, 0, -1], { p: [-0.3, 0, -1] }) },
        b: { pelvis: [0, 0.86, -0.25], rot: [72, 0, 0], neck: [-28, 0, 0], lL: flatF(0.12, 0.02, { p: [0, 0, 1] }), lR: flatF(-0.12, 0.02, { p: [0, 0, 1] }),
          aL: grip([0.24, 0.36, 0.17], [0, -1, 0], [0, 0, -1], { p: [0.3, 0, -1] }), aR: grip([-0.24, 0.36, 0.17], [0, -1, 0], [0, 0, -1], { p: [-0.3, 0, -1] }) },
      },
      seq: [['a', 0.5, 1.5], ['b', 0.3, 1.4]] },

    { id: 'e1459', lib: true, name: 'Soulevé de terre roumain aux haltères', en: 'Dumbbell romanian deadlift', mus: mus(m2('glute', 1), m2('ham', 2), m2('calf', 2)), cam: { yaw: 95, pitch: 8 },
      props: dbs(),
      poses: {
        a: { pelvis: [0, 0.92, 0], rot: [4, 0, 0], lL: flatF(0.12, 0.02), lR: flatF(-0.12, 0.02),
          aL: grip([0.17, 0.70, 0.16], [0, -1, 0], [0, 0, -1], { p: [0.3, 0, -1] }), aR: grip([-0.17, 0.70, 0.16], [0, -1, 0], [0, 0, -1], { p: [-0.3, 0, -1] }) },
        b: { pelvis: [0, 0.86, -0.25], rot: [72, 0, 0], neck: [-28, 0, 0], lL: flatF(0.12, 0.02, { p: [0, 0, 1] }), lR: flatF(-0.12, 0.02, { p: [0, 0, 1] }),
          aL: grip([0.17, 0.38, 0.22], [0, -1, 0], [0, 0, -1], { p: [0.3, 0, -1] }), aR: grip([-0.17, 0.38, 0.22], [0, -1, 0], [0, 0, -1], { p: [-0.3, 0, -1] }) },
      },
      seq: [['a', 0.5, 1.5], ['b', 0.3, 1.4]] },

    /* ======================= DOS ======================= */
    { id: 'e0652', lib: true, name: 'Traction', en: 'Pull-up', mus: mus(m2('lat', 1), m2('rhomb', 2), m2('biceps', 2)), cam: { yaw: 200, pitch: 6 },
      props: [fn(() => [cyl([-0.75, 2.25, 0], [0.75, 2.25, 0], 0.016, BAR, { held: true, name: 'barre' }), cyl([0.75, 2.25, 0], [0.75, 2.25, -0.25], 0.03, FRAME), cyl([-0.75, 2.25, 0], [-0.75, 2.25, -0.25], 0.03, FRAME)])],
      poses: {
        a: { float: true, pelvis: [0, 1.11, -0.02], rot: [-4, 0, 0], neck: [-6, 0, 0],
          lL: { db: [0.06, -1, 0.18], eb: [0.02, -0.6, -0.8], foot: 30 }, lR: { db: [-0.06, -1, 0.18], eb: [-0.02, -0.6, -0.8], foot: 30 },
          aL: grip([0.40, 2.25, 0], [0, 1, 0], [0, 0, 1], { p: [1, 0, -0.3] }), aR: grip([-0.40, 2.25, 0], [0, 1, 0], [0, 0, 1], { p: [-1, 0, -0.3] }) },
        b: { float: true, pelvis: [0, 1.60, -0.06], rot: [-8, 0, 0], neck: [-14, 0, 0],
          lL: { db: [0.06, -1, 0.25], eb: [0.02, -0.55, -0.83], foot: 30 }, lR: { db: [-0.06, -1, 0.25], eb: [-0.02, -0.55, -0.83], foot: 30 },
          aL: grip([0.40, 2.25, 0], [0, 1, 0], [0, 0, 1], { p: [1, -0.6, -0.5] }), aR: grip([-0.40, 2.25, 0], [0, 1, 0], [0, 0, 1], { p: [-1, -0.6, -0.5] }) },
      },
      seq: [['a', 0.5, 1.2], ['b', 0.4, 1.3]] },
    { id: 'e0068', lib: true, name: 'Squat sur une jambe à la barre', en: 'Barbell one leg squat', side: true, mus: { quadR: 1, gluteR: 2, calfR: 2 }, cam: { yaw: -70, pitch: 8 },
      props: [barbell(), fn(() => bench(-1.05, -0.47, 0.44))],
      poses: {
        a: { pelvis: [0, 0.86, 0.10], rot: [4, 0, 0], neck: [-4, 0, 0], lR: flatF(-0.12, 0.30, { p: [0, 0, 1] }),
          lL: { at: [0.12, 0.515, -0.485], p: [0, -0.4, 1], foot: { toe: [0, -0.30, -0.95], up: [0, -0.95, 0.30] } },
          aL: gripB([0.45, 0.235, -0.06], [0, 1, 0.15], [0, -0.15, 1], { pb: [0.75, -1, -0.8] }), aR: gripB([-0.45, 0.235, -0.06], [0, 1, 0.15], [0, -0.15, 1], { pb: [-0.75, -1, -0.8] }) },
        b: { pelvis: [0, 0.50, 0.02], rot: [14, 0, 0], neck: [-10, 0, 0], lR: flatF(-0.12, 0.30, { p: [0, 0, 1] }),
          lL: { at: [0.12, 0.515, -0.485], p: [0, -1, 0.15], foot: { toe: [0, -0.30, -0.95], up: [0, -0.95, 0.30] } },
          aL: gripB([0.45, 0.235, -0.06], [0, 1, 0.15], [0, -0.15, 1], { pb: [0.75, -1, -0.8] }), aR: gripB([-0.45, 0.235, -0.06], [0, 1, 0.15], [0, -0.15, 1], { pb: [-0.75, -1, -0.8] }) },
      },
      seq: [['a', 0.5, 1.3], ['b', 0.3, 1.3]] },

    { id: 'e0743', lib: true, name: 'Hack squat à la machine', en: 'Sled hack squat', mus: mus(m2('quad', 1), m2('calf', 2)), cam: { yaw: 70, pitch: 10 },
      props: [fn((C) => { const t = C.bone('Spine3'); return [
        box(t.at([0, 0.02, -0.165]), [0.36, 0.62, 0.06], PAD, { x: t.dir([1, 0, 0]), y: t.dir([0, 1, 0]), z: t.dir([0, 0, 1]), name: 'dossier' }),
        cyl(t.at([0.15, 0.43, -0.13]), t.at([0.15, 0.43, 0.07]), 0.04, PAD, { name: 'épaulière' }), cyl(t.at([-0.15, 0.43, -0.13]), t.at([-0.15, 0.43, 0.07]), 0.04, PAD, { name: 'épaulière' }),
        cyl(t.at([0.30, 0.38, -0.10]), t.at([0.30, 0.38, 0.10]), 0.016, BAR, { held: true }), cyl(t.at([-0.30, 0.38, -0.10]), t.at([-0.30, 0.38, 0.10]), 0.016, BAR, { held: true }),
        cyl(t.at([0.30, 0.38, -0.10]), t.at([0.15, 0.43, -0.13]), 0.016, FRAME), cyl(t.at([-0.30, 0.38, -0.10]), t.at([-0.15, 0.43, -0.13]), 0.016, FRAME)]; }),
        fn(() => [box([0, 0.08, 0.40], [0.62, 0.06, 0.42], PLATE, { name: 'plateau' }),
          cyl([0.30, 0.10, 0.15], [0.30, 1.55, -1.13], 0.03, FRAME, { name: 'rail' }), cyl([-0.30, 0.10, 0.15], [-0.30, 1.55, -1.13], 0.03, FRAME, { name: 'rail' })])],
      poses: {
        a: { float: true, pelvis: [0, 0.83, -0.12], rot: [-36, 0, 0], neck: [10, 0, 0], lL: flatF(0.15, 0.36, { at: [0.15, 0.21, 0.36], toe: [0.15, 0, 1] }), lR: flatF(-0.15, 0.36, { at: [-0.15, 0.21, 0.36], toe: [-0.15, 0, 1] }),
          aL: gripB([0.30, 0.38, 0.02], [0, -0.1, 1], [-1, 0, 0], { pb: [1, -0.8, 0] }), aR: gripB([-0.30, 0.38, 0.02], [0, -0.1, 1], [1, 0, 0], { pb: [-1, -0.8, 0] }) },
        b: { float: true, pelvis: [0, 0.50, 0.16], rot: [-36, 0, 0], neck: [12, 0, 0], lL: flatF(0.15, 0.36, { at: [0.15, 0.21, 0.36], toe: [0.15, 0, 1], p: [0.35, 0.3, 1] }), lR: flatF(-0.15, 0.36, { at: [-0.15, 0.21, 0.36], toe: [-0.15, 0, 1], p: [-0.35, 0.3, 1] }),
          aL: gripB([0.30, 0.38, 0.02], [0, -0.1, 1], [-1, 0, 0], { pb: [1, -0.8, 0] }), aR: gripB([-0.30, 0.38, 0.02], [0, -0.1, 1], [1, 0, 0], { pb: [-1, -0.8, 0] }) },
      },
      seq: [['a', 0.5, 1.4], ['b', 0.3, 1.3]] },

    { id: 'e0585', lib: true, name: 'Leg extension à la machine', en: 'Lever leg extension', mus: mus(m2('quad', 1)), cam: { yaw: 50, pitch: 10 },
      props: [fn(() => [box([0, 0.445, -0.07], [0.42, 0.08, 0.44], PAD, { name: 'siège' }), tbox([0, 0.82, -0.36], [0.40, 0.60, 0.08], -12, PAD, { name: 'dossier' }),
        box([0, 0.22, -0.07], [0.10, 0.44, 0.10], FRAME), cyl([0.30, 0.52, -0.05], [0.30, 0.52, -0.30], 0.02, FRAME, { name: 'poignée' }), cyl([-0.30, 0.52, -0.05], [-0.30, 0.52, -0.30], 0.02, FRAME, { name: 'poignée' })]),
        fn((C) => { const l = C.bone('LowerLeg_L'), r = C.bone('LowerLeg_R'); const a = l.at([0, -0.33, 0.085]), b = r.at([0, -0.33, 0.085]); const u = C.norm(C.sub(a, b));
          const piv = C.mul(C.add(C.J.kneeL, C.J.kneeR), 0.5); const pa = C.add(piv, [0.27, 0, 0]); const ea = C.add(a, C.mul(u, 0.16));
          return [cyl(C.add(a, C.mul(u, 0.16)), C.sub(b, C.mul(u, 0.16)), 0.045, PAD, { name: 'boudin' }), cyl(pa, ea, 0.022, FRAME, { name: 'bras' })]; })],
      poses: {
        a: { float: true, pelvis: [0, 0.615, -0.08], rot: [-10, 0, 0], neck: [6, 0, 0], lL: { d: [0.03, -0.04, 1], e: [0, -1, 0.12], foot: 0 }, lR: { d: [-0.03, -0.04, 1], e: [0, -1, 0.12], foot: 0 },
          aL: grip([0.30, 0.52, -0.17], [0, 0, 1], [-1, 0, 0], { p: [1, 0.2, -0.6] }), aR: grip([-0.30, 0.52, -0.17], [0, 0, 1], [1, 0, 0], { p: [-1, 0.2, -0.6] }) },
        b: { float: true, pelvis: [0, 0.615, -0.08], rot: [-10, 0, 0], neck: [6, 0, 0], lL: { d: [0.03, -0.04, 1], e: [0, 0.10, 1], foot: -5 }, lR: { d: [-0.03, -0.04, 1], e: [0, 0.10, 1], foot: -5 },
          aL: grip([0.30, 0.52, -0.17], [0, 0, 1], [-1, 0, 0], { p: [1, 0.2, -0.6] }), aR: grip([-0.30, 0.52, -0.17], [0, 0, 1], [1, 0, 0], { p: [-1, 0.2, -0.6] }) },
      },
      seq: [['a', 0.4, 1.1], ['b', 0.4, 1.2]] },

    { id: 'e0598', lib: true, name: 'Adduction de hanche assis à la machine', en: 'Lever seated hip adduction', mus: mus(m2('add', 1)), cam: { yaw: 20, pitch: 14 },
      props: [fn(() => [box([0, 0.445, -0.05], [0.44, 0.08, 0.42], PAD, { name: 'siège' }), tbox([0, 0.84, -0.33], [0.42, 0.62, 0.08], -8, PAD, { name: 'dossier' }), box([0, 0.22, -0.05], [0.10, 0.44, 0.10], FRAME),
        cyl([0.29, 0.55, -0.1], [0.29, 0.55, -0.32], 0.02, FRAME, { name: 'poignée' }), cyl([-0.29, 0.55, -0.1], [-0.29, 0.55, -0.32], 0.02, FRAME, { name: 'poignée' })]),
        fn((C) => { const out = []; for (const [sd, s] of [['L', 1], ['R', -1]]) { const t = C.bone('UpperLeg_' + sd); out.push(box(t.at([s * -0.115, -0.33, 0.0]), [0.05, 0.20, 0.15], PAD, { x: t.dir([1, 0, 0]), y: t.dir([0, 1, 0]), z: t.dir([0, 0, 1]), name: 'coussin', soft: true }),
          box(t.at([s * -0.03, -0.44, -0.12]), [0.10, 0.03, 0.12], FRAME, { x: t.dir([1, 0, 0]), y: t.dir([0, 1, 0]), z: t.dir([0, 0, 1]), name: 'repose-pied', soft: true })); } return out; })],
      poses: {
        a: { float: true, pelvis: [0, 0.615, -0.03], rot: [-4, 0, 0], lL: { d: [0.62, -0.08, 0.78], e: [0.05, -1, 0.05], foot: 'flat' }, lR: { d: [-0.62, -0.08, 0.78], e: [-0.05, -1, 0.05], foot: 'flat' },
          aL: grip([0.29, 0.55, -0.20], [0, 0, 1], [-1, 0, 0], { p: [1, 0.2, -0.6] }), aR: grip([-0.29, 0.55, -0.20], [0, 0, 1], [1, 0, 0], { p: [-1, 0.2, -0.6] }) },
        b: { float: true, pelvis: [0, 0.615, -0.03], rot: [-4, 0, 0], lL: { d: [0.16, -0.08, 1], e: [0.02, -1, 0.05], foot: 'flat' }, lR: { d: [-0.16, -0.08, 1], e: [-0.02, -1, 0.05], foot: 'flat' },
          aL: grip([0.29, 0.55, -0.20], [0, 0, 1], [-1, 0, 0], { p: [1, 0.2, -0.6] }), aR: grip([-0.29, 0.55, -0.20], [0, 0, 1], [1, 0, 0], { p: [-1, 0.2, -0.6] }) },
      },
      seq: [['a', 0.4, 1.2], ['b', 0.4, 1.2]] },
    { id: 'e0586', lib: true, name: 'Leg curl allongé à la machine', en: 'Lever lying leg curl', mus: mus(m2('ham', 1), m2('calf', 2)), cam: { yaw: -75, pitch: 14 },
      props: [fn(() => [box([0, 0.515, 0.31], [0.36, 0.07, 0.62], PAD, { name: 'banc' }), box([0, 0.49, -0.24], [0.36, 0.07, 0.48], PAD, { name: 'banc' }),
        box([0, 0.26, 0.05], [0.10, 0.48, 0.10], FRAME), cyl([0.20, 0.40, 0.60], [0.20, 0.52, 0.66], 0.016, BAR, { held: true }), cyl([-0.20, 0.40, 0.60], [-0.20, 0.52, 0.66], 0.016, BAR, { held: true })]),
        fn((C) => { const l = C.bone('LowerLeg_L'), r = C.bone('LowerLeg_R'); const a = l.at([0, -0.355, -0.095]), b = r.at([0, -0.355, -0.095]); const u = C.norm(C.sub(a, b));
          const piv = C.mul(C.add(C.J.kneeL, C.J.kneeR), 0.5); const pa = C.add(piv, [0.27, 0, 0]);
          return [cyl(C.add(a, C.mul(u, 0.15)), C.sub(b, C.mul(u, 0.15)), 0.045, PAD, { name: 'boudin' }), cyl(pa, C.add(a, C.mul(u, 0.15)), 0.022, FRAME, { name: 'bras' })]; })],
      poses: {
        a: { float: true, pelvis: [0, 0.66, -0.06], rot: [86, 0, 0], neck: [-18, 0, 0], lL: { d: [0.05, -0.12, -1], e: [0, -0.05, -1], foot: 10 }, lR: { d: [-0.05, -0.12, -1], e: [0, -0.05, -1], foot: 10 },
          aL: grip([0.20, 0.46, 0.63], [0, 1, 0.45], [-1, 0, 0], { p: [1, 0.3, -0.2] }), aR: grip([-0.20, 0.46, 0.63], [0, 1, 0.45], [1, 0, 0], { p: [-1, 0.3, -0.2] }) },
        b: { float: true, pelvis: [0, 0.66, -0.06], rot: [86, 0, 0], neck: [-18, 0, 0], lL: { d: [0.05, -0.12, -1], e: [0, 0.95, 0.30], foot: 10 }, lR: { d: [-0.05, -0.12, -1], e: [0, 0.95, 0.30], foot: 10 },
          aL: grip([0.20, 0.46, 0.63], [0, 1, 0.45], [-1, 0, 0], { p: [1, 0.3, -0.2] }), aR: grip([-0.20, 0.46, 0.63], [0, 1, 0.45], [1, 0, 0], { p: [-1, 0.3, -0.2] }) },
      },
      seq: [['a', 0.4, 1.1], ['b', 0.4, 1.3]] },

    { id: 'e3195', lib: true, name: 'Leg curl allongé deux jambes, une jambe à la machine', en: 'Lever lying two-one leg curl', mus: mus(m2('ham', 1), m2('calf', 2)), cam: { yaw: -75, pitch: 14 },
      props: [fn(() => [box([0, 0.515, 0.31], [0.36, 0.07, 0.62], PAD, { name: 'banc' }), box([0, 0.49, -0.24], [0.36, 0.07, 0.48], PAD, { name: 'banc' }),
        box([0, 0.26, 0.05], [0.10, 0.48, 0.10], FRAME), cyl([0.20, 0.40, 0.60], [0.20, 0.52, 0.66], 0.016, BAR, { held: true }), cyl([-0.20, 0.40, 0.60], [-0.20, 0.52, 0.66], 0.016, BAR, { held: true })]),
        fn((C) => { const l = C.bone('LowerLeg_L'); const a = l.at([0, -0.355, -0.095]); const u = [1, 0, 0];
          const pa = C.add(C.J.kneeL, [0.18, 0, 0]);
          return [cyl(C.add(a, C.mul(u, 0.15)), C.sub(a, C.mul(u, 0.30)), 0.045, PAD, { name: 'boudin', soft: true }), cyl(pa, C.add(a, C.mul(u, 0.15)), 0.022, FRAME, { name: 'bras' })]; })],
      poses: {
        a: { float: true, pelvis: [0, 0.66, -0.06], rot: [86, 0, 0], neck: [-18, 0, 0], lL: { d: [0.05, -0.12, -1], e: [0, -0.05, -1], foot: 10 }, lR: { d: [-0.05, -0.12, -1], e: [0, -0.05, -1], foot: 10 },
          aL: grip([0.20, 0.46, 0.63], [0, 1, 0.45], [-1, 0, 0], { p: [1, 0.3, -0.2] }), aR: grip([-0.20, 0.46, 0.63], [0, 1, 0.45], [1, 0, 0], { p: [-1, 0.3, -0.2] }) },
        b: { float: true, pelvis: [0, 0.66, -0.06], rot: [86, 0, 0], neck: [-18, 0, 0], lL: { d: [0.05, -0.12, -1], e: [0, 0.95, 0.30], foot: 10 }, lR: { d: [-0.05, -0.12, -1], e: [0, 0.95, 0.30], foot: 10 },
          aL: grip([0.20, 0.46, 0.63], [0, 1, 0.45], [-1, 0, 0], { p: [1, 0.3, -0.2] }), aR: grip([-0.20, 0.46, 0.63], [0, 1, 0.45], [1, 0, 0], { p: [-1, 0.3, -0.2] }) },
        c: { float: true, pelvis: [0, 0.66, -0.06], rot: [86, 0, 0], neck: [-18, 0, 0], lL: { d: [0.05, -0.12, -1], e: [0, 0.95, 0.30], foot: 10 }, lR: { d: [-0.05, -0.12, -1], e: [0, -0.05, -1], foot: 10 },
          aL: grip([0.20, 0.46, 0.63], [0, 1, 0.45], [-1, 0, 0], { p: [1, 0.3, -0.2] }), aR: grip([-0.20, 0.46, 0.63], [0, 1, 0.45], [1, 0, 0], { p: [-1, 0.3, -0.2] }) },
      },
      seq: [['a', 0.3, 1.0], ['b', 0.3, 0.6], ['c', 0.2, 1.8]] },

    { id: 'e1463', lib: true, name: 'Presse à cuisses 45°', en: 'Sled 45° leg press', mus: mus(m2('quad', 1)), cam: { yaw: 95, pitch: 8 },
      props: [fn(() => [box([0, 0.358, 0.05], [0.46, 0.08, 0.40], PAD, { name: 'siège' }), tbox([0, 0.670, -0.40], [0.46, 0.68, 0.08], -45, PAD, { name: 'dossier' }),
        box([0, 0.18, -0.05], [0.12, 0.36, 0.12], FRAME), cyl([0.36, 0.30, 0.25], [0.36, 1.55, 1.50], 0.03, FRAME, { name: 'rail' }), cyl([-0.36, 0.30, 0.25], [-0.36, 1.55, 1.50], 0.03, FRAME, { name: 'rail' }),
        cyl([0.30, 0.45, 0.05], [0.30, 0.45, 0.22], 0.016, BAR, { held: true }), cyl([-0.30, 0.45, 0.05], [-0.30, 0.45, 0.22], 0.016, BAR, { held: true })]),
        fn((C) => { const r = C.norm([0, 0.71, 0.71]); const toe = C.norm([0, 0.71, -0.71]); const m = C.mul(C.add(C.J.ballL, C.J.ballR), 0.5); const c = C.add(C.add(m, C.mul(r, 0.035)), C.mul(toe, -0.06));
          return [box(c, [0.74, 0.60, 0.05], PLATE, { x: [1, 0, 0], y: toe, z: r, name: 'plateau' }), box(C.add(c, C.mul(r, 0.10)), [0.70, 0.10, 0.14], FRAME, { x: [1, 0, 0], y: toe, z: r })]; })],
      poses: {
        a: { float: true, pelvis: [0, 0.545, 0.0], rot: [-45, 0, 0], neck: [24, 0, 0],
          lL: { at: [0.15, 1.10, 0.55], p: [0.2, 0.6, 0.3], foot: { toe: [0, 0.71, -0.71], up: [0, -0.71, -0.71] } }, lR: { at: [-0.15, 1.10, 0.55], p: [-0.2, 0.6, 0.3], foot: { toe: [0, 0.71, -0.71], up: [0, -0.71, -0.71] } },
          aL: grip([0.30, 0.45, 0.13], [0, 0, 1], [-1, 0, 0], { p: [1, 0.3, -0.6] }), aR: grip([-0.30, 0.45, 0.13], [0, 0, 1], [1, 0, 0], { p: [-1, 0.3, -0.6] }) },
        b: { float: true, pelvis: [0, 0.545, 0.0], rot: [-45, 0, 0], neck: [24, 0, 0],
          lL: { at: [0.15, 0.90, 0.35], p: [0.25, 0.8, 0.2], foot: { toe: [0, 0.71, -0.71], up: [0, -0.71, -0.71] } }, lR: { at: [-0.15, 0.90, 0.35], p: [-0.25, 0.8, 0.2], foot: { toe: [0, 0.71, -0.71], up: [0, -0.71, -0.71] } },
          aL: grip([0.30, 0.45, 0.13], [0, 0, 1], [-1, 0, 0], { p: [1, 0.3, -0.6] }), aR: grip([-0.30, 0.45, 0.13], [0, 0, 1], [1, 0, 0], { p: [-1, 0.3, -0.6] }) },
      },
      seq: [['a', 0.4, 1.3], ['b', 0.3, 1.3]] },

    { id: 'e0058', lib: true, name: 'Relevé de bassin allongé à la barre', en: 'Barbell lying lifting (on hip)', mus: mus(m2('quad', 1), m2('ham', 2)), cam: { yaw: 60, pitch: 18 },
      props: [barbell(), fn(() => [box([0, 0.303, -0.52], [1.10, 0.07, 0.30], PAD, { name: 'banc' }), box([0.45, 0.134, -0.52], [0.05, 0.268, 0.24], FRAME, { name: 'banc' }), box([-0.45, 0.134, -0.52], [0.05, 0.268, 0.24], FRAME, { name: 'banc' })])],
      poses: {
        a: { pelvis: [0, 0.33, -0.02], rot: [-66, 0, 0], neck: [26, 0, 0], lL: flatF(0.16, 0.44, { p: [0.25, 1, 0.3] }), lR: flatF(-0.16, 0.44, { p: [-0.25, 1, 0.3] }),
          aL: grip([0.32, 0.44, 0.07], [0, 0.25, 1], [0, -1, 0.25], { p: [1, 0.4, -0.4] }), aR: grip([-0.32, 0.44, 0.07], [0, 0.25, 1], [0, -1, 0.25], { p: [-1, 0.4, -0.4] }) },
        b: { pelvis: [0, 0.50, 0.03], rot: [-88, 0, 0], neck: [32, 0, 0], lL: flatF(0.16, 0.44, { p: [0.25, 1, 0.3] }), lR: flatF(-0.16, 0.44, { p: [-0.25, 1, 0.3] }),
          aL: grip([0.32, 0.625, 0.07], [0, 0.1, 1], [0, -1, 0.1], { p: [1, 0.4, -0.4] }), aR: grip([-0.32, 0.625, 0.07], [0, 0.1, 1], [0, -1, 0.1], { p: [-1, 0.4, -0.4] }) },
      },
      seq: [['a', 0.4, 1.2], ['b', 0.5, 1.3]] },

    { id: 'e1408', lib: true, noFloor: true, name: 'Relevé de bassin à l’élastique', en: 'Band hip lift', mus: mus(m2('glute', 1), m2('ham', 2)), cam: { yaw: 70, pitch: 22 },
      props: [fn((C) => { const h = C.bone('Hips'); const pL = h.at([0.17, 0.0, 0.11]), pR = h.at([-0.17, 0.0, 0.11]), pc = h.at([0, 0.0, 0.14]);
        return [cyl([0.32, 0.02, 0.0], pL, 0.009, BAND, { soft: true }), cyl(pL, pc, 0.009, BAND, { soft: true }), cyl(pc, pR, 0.009, BAND, { soft: true }), cyl(pR, [-0.32, 0.02, 0.0], 0.009, BAND, { soft: true }),
          cyl([0.32, 0, 0.0], [0.32, 0.03, 0.0], 0.06, PLATE, { name: 'poids' }), cyl([-0.32, 0, 0.0], [-0.32, 0.03, 0.0], 0.06, PLATE, { name: 'poids' })]; })],
      poses: {
        a: { pelvis: [0, 0.1, 0], rot: [-95, 0, 0], neck: [10, 0, 0], lL: flatF(0.13, 0.40, { p: [0.2, 1, 0.2] }), lR: flatF(-0.13, 0.40, { p: [-0.2, 1, 0.2] }),
          aL: { at: [0.27, 0.03, -0.12], hand: 'flat', hdir: [0, 0, 1], p: [0.4, 0.4, -1] }, aR: { at: [-0.27, 0.03, -0.12], hand: 'flat', hdir: [0, 0, 1], p: [-0.4, 0.4, -1] } },
        b: { pelvis: [0, 0.37, 0.04], rot: [-118, 0, 0], neck: [40, 0, 0], lL: flatF(0.13, 0.40, { p: [0.2, 1, 0.2] }), lR: flatF(-0.13, 0.40, { p: [-0.2, 1, 0.2] }),
          aL: { at: [0.27, 0.03, -0.12], hand: 'flat', hdir: [0, 0, 1], p: [0.4, 0.4, -1] }, aR: { at: [-0.27, 0.03, -0.12], hand: 'flat', hdir: [0, 0, 1], p: [-0.4, 0.4, -1] } },
      },
      seq: [['a', 0.4, 1.2], ['b', 0.6, 1.2]] },

    { id: 'e1023', lib: true, name: 'Soulevé de terre jambes tendues à l’élastique', en: 'Band straight back stiff leg deadlift', mus: mus(m2('glute', 1), m2('ham', 2)), cam: { yaw: 95, pitch: 8 },
      props: [bandTo('L', [0.10, 0.03, 0.05]), bandTo('R', [-0.10, 0.03, 0.05])],
      poses: {
        a: { pelvis: [0, 0.925, 0], rot: [3, 0, 0], lL: flatF(0.11, 0.02), lR: flatF(-0.11, 0.02),
          aL: grip([0.20, 0.72, 0.15], [0, -1, 0], [0, 0, -1], { p: [0.3, 0, -1] }), aR: grip([-0.20, 0.72, 0.15], [0, -1, 0], [0, 0, -1], { p: [-0.3, 0, -1] }) },
        b: { pelvis: [0, 0.90, -0.22], rot: [76, 0, 0], neck: [-26, 0, 0], lL: flatF(0.11, 0.02, { p: [0, 0, 1] }), lR: flatF(-0.11, 0.02, { p: [0, 0, 1] }),
          aL: grip([0.20, 0.34, 0.24], [0, -1, 0], [0, 0, -1], { p: [0.3, 0, -1] }), aR: grip([-0.20, 0.34, 0.24], [0, -1, 0], [0, 0, -1], { p: [-0.3, 0, -1] }) },
      },
      seq: [['a', 0.5, 1.5], ['b', 0.3, 1.4]] },
    /* ======================= PECTORAUX ======================= */
    { id: 'e0025', lib: true, name: 'Développé couché à la barre', en: 'Barbell bench press', mus: mus(m2('pec', 1), m2('triceps', 2), m2('delt', 2)), cam: { yaw: 55, pitch: 22 },
      props: [barbell(), fn(() => [...bench(-0.75, 0.25, 0.44), cyl([0.55, 0, -0.62], [0.55, 1.25, -0.62], 0.03, FRAME), cyl([-0.55, 0, -0.62], [-0.55, 1.25, -0.62], 0.03, FRAME)])],
      poses: {
        a: { float: true, pelvis: [0, 0.595, 0.05], rot: [-90, 0, 0], neck: [8, 0, 0], lL: flatF(0.25, 0.50, { p: [0.5, 1, 0.2] }), lR: flatF(-0.25, 0.50, { p: [-0.5, 1, 0.2] }),
          aL: grip([0.40, 1.235, -0.42], [0, 1, -0.12], [0, 0.12, 1], { p: [1, -0.3, 0.2] }), aR: grip([-0.40, 1.235, -0.42], [0, 1, -0.12], [0, 0.12, 1], { p: [-1, -0.3, 0.2] }) },
        b: { float: true, pelvis: [0, 0.595, 0.05], rot: [-90, 0, 0], neck: [8, 0, 0], lL: flatF(0.25, 0.50, { p: [0.5, 1, 0.2] }), lR: flatF(-0.25, 0.50, { p: [-0.5, 1, 0.2] }),
          aL: grip([0.40, 0.805, -0.33], [0, 1, -0.05], [0, 0.05, 1], { p: [1, -0.4, 0.3] }), aR: grip([-0.40, 0.805, -0.33], [0, 1, -0.05], [0, 0.05, 1], { p: [-1, -0.4, 0.3] }) },
      },
      seq: [['a', 0.4, 1.3], ['b', 0.2, 1.1]] },

    { id: 'e0289', lib: true, name: 'Développé couché aux haltères', en: 'Dumbbell bench press', mus: mus(m2('pec', 1), m2('delt', 2), m2('triceps', 2)), cam: { yaw: 55, pitch: 22 },
      props: [...dbs(), fn(() => bench(-0.75, 0.25, 0.44))],
      poses: {
        a: { float: true, pelvis: [0, 0.595, 0.05], rot: [-90, 0, 0], neck: [8, 0, 0], lL: flatF(0.25, 0.50, { p: [0.5, 1, 0.2] }), lR: flatF(-0.25, 0.50, { p: [-0.5, 1, 0.2] }),
          aL: grip([0.16, 1.235, -0.42], [0, 1, -0.12], [0, 0.12, 1], { p: [1, -0.3, 0.2] }), aR: grip([-0.16, 1.235, -0.42], [0, 1, -0.12], [0, 0.12, 1], { p: [-1, -0.3, 0.2] }) },
        b: { float: true, pelvis: [0, 0.595, 0.05], rot: [-90, 0, 0], neck: [8, 0, 0], lL: flatF(0.25, 0.50, { p: [0.5, 1, 0.2] }), lR: flatF(-0.25, 0.50, { p: [-0.5, 1, 0.2] }),
          aL: grip([0.40, 0.845, -0.36], [0, 1, -0.05], [0, 0.05, 1], { p: [1, -0.4, 0.3] }), aR: grip([-0.40, 0.845, -0.36], [0, 1, -0.05], [0, 0.05, 1], { p: [-1, -0.4, 0.3] }) },
      },
      seq: [['a', 0.4, 1.3], ['b', 0.2, 1.1]] },

    { id: 'e0047', lib: true, name: 'Développé incliné à la barre', en: 'Barbell incline bench press', mus: mus(m2('pec', 1), m2('triceps', 2)), cam: { yaw: 60, pitch: 18 },
      props: [barbell(), fn(() => [box([0, 0.42, 0.08], [0.32, 0.07, 0.34], PAD, { name: 'siège' }), tbox([0, 0.748, -0.411], [0.30, 0.80, 0.07], -50, PAD, { name: 'dossier' }), box([0, 0.20, -0.1], [0.10, 0.40, 0.10], FRAME),
        cyl([0.55, 0, -0.30], [0.55, 1.65, -0.30], 0.03, FRAME), cyl([-0.55, 0, -0.30], [-0.55, 1.65, -0.30], 0.03, FRAME)])],
      poses: {
        a: { float: true, pelvis: [0, 0.605, 0.05], rot: [-50, 0, 0], neck: [10, 0, 0], lL: flatF(0.24, 0.50, { p: [0.4, 1, 0.3] }), lR: flatF(-0.24, 0.50, { p: [-0.4, 1, 0.3] }),
          aL: grip([0.40, 1.690, -0.10], [0, 0.9, -0.45], [0, 0.45, 0.9], { p: [1, -0.3, 0.3] }), aR: grip([-0.40, 1.690, -0.10], [0, 0.9, -0.45], [0, 0.45, 0.9], { p: [-1, -0.3, 0.3] }) },
        b: { float: true, pelvis: [0, 0.605, 0.05], rot: [-50, 0, 0], neck: [10, 0, 0], lL: flatF(0.24, 0.50, { p: [0.4, 1, 0.3] }), lR: flatF(-0.24, 0.50, { p: [-0.4, 1, 0.3] }),
          aL: grip([0.40, 1.280, -0.10], [0, 0.9, -0.45], [0, 0.45, 0.9], { p: [1, -0.4, 0.3] }), aR: grip([-0.40, 1.280, -0.10], [0, 0.9, -0.45], [0, 0.45, 0.9], { p: [-1, -0.4, 0.3] }) },
      },
      seq: [['a', 0.4, 1.3], ['b', 0.2, 1.1]] },

    { id: 'e0757', lib: true, name: 'Développé incliné à la Smith machine', en: 'Smith incline bench press', mus: mus(m2('pec', 1), m2('delt', 2)), cam: { yaw: 60, pitch: 18 },
      props: [barbell({ half: 0.75, pin: 0.62 }), fn(() => [box([0, 0.42, 0.08], [0.32, 0.07, 0.34], PAD, { name: 'siège' }), tbox([0, 0.748, -0.411], [0.30, 0.80, 0.07], -50, PAD, { name: 'dossier' }), box([0, 0.20, -0.1], [0.10, 0.40, 0.10], FRAME),
        cyl([0.70, 0, -0.10], [0.70, 2.10, -0.10], 0.025, FRAME, { name: 'rail' }), cyl([-0.70, 0, -0.10], [-0.70, 2.10, -0.10], 0.025, FRAME, { name: 'rail' }), cyl([-0.70, 2.10, -0.10], [0.70, 2.10, -0.10], 0.025, FRAME)])],
      poses: {
        a: { float: true, pelvis: [0, 0.605, 0.05], rot: [-50, 0, 0], neck: [10, 0, 0], lL: flatF(0.24, 0.50, { p: [0.4, 1, 0.3] }), lR: flatF(-0.24, 0.50, { p: [-0.4, 1, 0.3] }),
          aL: grip([0.38, 1.670, -0.10], [0, 0.9, -0.45], [0, 0.45, 0.9], { p: [1, -0.3, 0.3] }), aR: grip([-0.38, 1.670, -0.10], [0, 0.9, -0.45], [0, 0.45, 0.9], { p: [-1, -0.3, 0.3] }) },
        b: { float: true, pelvis: [0, 0.605, 0.05], rot: [-50, 0, 0], neck: [10, 0, 0], lL: flatF(0.24, 0.50, { p: [0.4, 1, 0.3] }), lR: flatF(-0.24, 0.50, { p: [-0.4, 1, 0.3] }),
          aL: grip([0.38, 1.280, -0.10], [0, 0.9, -0.45], [0, 0.45, 0.9], { p: [1, -0.4, 0.3] }), aR: grip([-0.38, 1.280, -0.10], [0, 0.9, -0.45], [0, 0.45, 0.9], { p: [-1, -0.4, 0.3] }) },
      },
      seq: [['a', 0.4, 1.3], ['b', 0.2, 1.1]] },
    { id: 'Cable_Crossover', lib: true, name: 'Vis-à-vis à la poulie', en: 'Cable crossover', mus: mus(m2('pec', 1), m2('delt', 2)), cam: { yaw: 25, pitch: 10 },
      props: [tower(1.10, -0.15, 2.15, { w: 0.3 }), tower(-1.10, -0.15, 2.15, { w: 0.3 }), cableTo('L', [1.05, 2.0, -0.15]), cableTo('R', [-1.05, 2.0, -0.15])],
      poses: {
        a: { pelvis: [0, 0.915, -0.02], rot: [12, 0, 0], neck: [-8, 0, 0], lL: flatF(0.13, 0.20), lR: flatF(-0.13, -0.16, { foot: { toe: [0, -0.5, 0.87], up: [0, 0.87, 0.5] }, at: [-0.13, 0.13, -0.18] }),
          aL: reach(SH(1, 1.42, 0.07), [0.80, 1.52, 0.10], [0, -0.3, 1], { p: [0.2, -0.5, -1] }), aR: reach(SH(-1, 1.42, 0.07), [-0.80, 1.52, 0.10], [0, -0.3, 1], { p: [-0.2, -0.5, -1] }) },
        b: { pelvis: [0, 0.915, -0.02], rot: [12, 0, 0], neck: [-8, 0, 0], lL: flatF(0.13, 0.20), lR: flatF(-0.13, -0.16, { foot: { toe: [0, -0.5, 0.87], up: [0, 0.87, 0.5] }, at: [-0.13, 0.13, -0.18] }),
          aL: reach(SH(1, 1.42, 0.07), [0.07, 1.02, 0.44], [-1, 0.3, 0], { p: [1, -0.2, -0.3] }), aR: reach(SH(-1, 1.42, 0.07), [-0.07, 1.06, 0.46], [1, 0.3, 0], { p: [-1, -0.2, -0.3] }) },
      },
      seq: [['a', 0.4, 1.2], ['b', 0.4, 1.3]] },

    { id: 'e1269', lib: true, name: 'Écarté croisé debout, buste droit, à la poulie', en: 'Cable standing up straight crossovers', mus: mus(m2('pec', 1), m2('delt', 2)), cam: { yaw: 20, pitch: 8 },
      props: [tower(1.10, -0.10, 2.15, { w: 0.3 }), tower(-1.10, -0.10, 2.15, { w: 0.3 }), cableTo('L', [1.05, 1.95, -0.10]), cableTo('R', [-1.05, 1.95, -0.10])],
      poses: {
        a: { pelvis: [0, 0.92, 0], rot: [2, 0, 0], lL: flatF(0.12, 0.02), lR: flatF(-0.12, 0.02),
          aL: reach(SH(1), [0.86, 1.42, 0.02], [0, -0.2, 1], { p: [0.2, -0.5, -1] }), aR: reach(SH(-1), [-0.86, 1.42, 0.02], [0, -0.2, 1], { p: [-0.2, -0.5, -1] }) },
        b: { pelvis: [0, 0.92, 0], rot: [2, 0, 0], lL: flatF(0.12, 0.02), lR: flatF(-0.12, 0.02),
          aL: reach(SH(1), [-0.04, 0.99, 0.32], [-1, 0.3, 0], { p: [1, -0.2, -0.3] }), aR: reach(SH(-1), [0.04, 1.03, 0.35], [1, 0.3, 0], { p: [-1, -0.2, -0.3] }) },
      },
      seq: [['a', 0.4, 1.2], ['b', 0.4, 1.3]] },

    { id: 'e0179', lib: true, name: 'Écarté bas à la poulie', en: 'Cable low fly', mus: mus(m2('pec', 1), m2('delt', 2)), cam: { yaw: 25, pitch: 6 },
      props: [tower(1.05, -0.10, 2.15, { w: 0.3 }), tower(-1.05, -0.10, 2.15, { w: 0.3 }), cableTo('L', [1.00, 0.15, -0.10]), cableTo('R', [-1.00, 0.15, -0.10])],
      poses: {
        a: { pelvis: [0, 0.915, 0], rot: [6, 0, 0], lL: flatF(0.14, 0.18), lR: flatF(-0.14, -0.18, { foot: { toe: [0, -0.5, 0.87], up: [0, 0.87, 0.5] }, at: [-0.14, 0.13, -0.20] }),
          aL: reach(SH(1, 1.43, 0.03), [0.56, 0.86, 0.14], [0, 0.3, 1], { p: [0.4, -0.2, -1] }), aR: reach(SH(-1, 1.43, 0.03), [-0.56, 0.86, 0.14], [0, 0.3, 1], { p: [-0.4, -0.2, -1] }) },
        b: { pelvis: [0, 0.915, 0], rot: [6, 0, 0], lL: flatF(0.14, 0.18), lR: flatF(-0.14, -0.18, { foot: { toe: [0, -0.5, 0.87], up: [0, 0.87, 0.5] }, at: [-0.14, 0.13, -0.20] }),
          aL: reach(SH(1, 1.43, 0.03), [0.08, 1.30, 0.50], [-1, 0.4, 0], { p: [1, -0.6, -0.2] }), aR: reach(SH(-1, 1.43, 0.03), [-0.08, 1.30, 0.50], [1, 0.4, 0], { p: [-1, -0.6, -0.2] }) },
      },
      seq: [['a', 0.4, 1.2], ['b', 0.4, 1.3]] },

    { id: 'e0188', lib: true, name: 'Écarté à mi-hauteur à la poulie', en: 'Cable middle fly', mus: mus(m2('pec', 1), m2('delt', 2)), cam: { yaw: 25, pitch: 10 },
      props: [tower(1.10, -0.15, 2.15, { w: 0.3 }), tower(-1.10, -0.15, 2.15, { w: 0.3 }), cableTo('L', [1.05, 1.36, -0.15]), cableTo('R', [-1.05, 1.36, -0.15])],
      poses: {
        a: { pelvis: [0, 0.915, 0], rot: [6, 0, 0], lL: flatF(0.14, 0.18), lR: flatF(-0.14, -0.18, { foot: { toe: [0, -0.5, 0.87], up: [0, 0.87, 0.5] }, at: [-0.14, 0.13, -0.20] }),
          aL: reach(SH(1, 1.43, 0.03), [0.82, 1.36, 0.04], [0, 0, 1], { p: [0.2, -1, -0.4] }), aR: reach(SH(-1, 1.43, 0.03), [-0.82, 1.36, 0.04], [0, 0, 1], { p: [-0.2, -1, -0.4] }) },
        b: { pelvis: [0, 0.915, 0], rot: [6, 0, 0], lL: flatF(0.14, 0.18), lR: flatF(-0.14, -0.18, { foot: { toe: [0, -0.5, 0.87], up: [0, 0.87, 0.5] }, at: [-0.14, 0.13, -0.20] }),
          aL: reach(SH(1, 1.43, 0.03), [0.08, 1.34, 0.56], [-1, 0, 0], { p: [1, -0.8, 0] }), aR: reach(SH(-1, 1.43, 0.03), [-0.08, 1.34, 0.56], [1, 0, 0], { p: [-1, -0.8, 0] }) },
      },
      seq: [['a', 0.4, 1.2], ['b', 0.4, 1.3]] },

    { id: 'Cable_Chest_Press', lib: true, name: 'Développé pectoraux à la poulie', en: 'Cable chest press', mus: mus(m2('pec', 1), m2('delt', 2), m2('triceps', 2)), cam: { yaw: 60, pitch: 12 },
      props: [tower(0.62, -0.75, 2.1, { w: 0.25 }), tower(-0.62, -0.75, 2.1, { w: 0.25 }), cableTo('L', [0.55, 1.180, -0.70]), cableTo('R', [-0.55, 1.180, -0.70]),
        fn(() => [box([0, 0.42, 0.02], [0.36, 0.07, 0.40], PAD, { name: 'banc' }), tbox([0, 0.82, -0.27], [0.34, 0.62, 0.07], -8, PAD, { name: 'dossier' }), box([0, 0.19, 0.02], [0.10, 0.38, 0.10], FRAME)])],
      poses: {
        a: { float: true, pelvis: [0, 0.615, 0.0], rot: [-6, 0, 0], neck: [6, 0, 0], lL: flatF(0.20, 0.45), lR: flatF(-0.20, 0.45),
          aL: grip([0.33, 1.190, 0.06], [0, 0, 1], [0, -1, 0], { p: [1, -0.2, -0.6] }), aR: grip([-0.33, 1.190, 0.06], [0, 0, 1], [0, -1, 0], { p: [-1, -0.2, -0.6] }) },
        b: { float: true, pelvis: [0, 0.615, 0.0], rot: [-6, 0, 0], neck: [6, 0, 0], lL: flatF(0.20, 0.45), lR: flatF(-0.20, 0.45),
          aL: grip([0.13, 1.190, 0.60], [0, 0, 1], [0, -1, 0], { p: [1, -0.5, -0.4] }), aR: grip([-0.13, 1.190, 0.60], [0, 0, 1], [0, -1, 0], { p: [-1, -0.5, -0.4] }) },
      },
      seq: [['a', 0.4, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e2144', lib: true, name: 'Développé poitrine assis à la poulie', en: 'Cable seated chest press', mus: mus(m2('pec', 1), m2('delt', 2)), cam: { yaw: 35, pitch: 10 },
      props: [tower(0.85, -0.55, 2.2, { w: 0.35 }), tower(-0.85, -0.55, 2.2, { w: 0.35 }), cableTo('L', [0.80, 1.240, -0.50]), cableTo('R', [-0.80, 1.240, -0.50]),
        fn(() => [box([0, 0.42, 0.02], [0.36, 0.07, 0.40], PAD, { name: 'banc' }), tbox([0, 0.82, -0.27], [0.34, 0.62, 0.07], -8, PAD, { name: 'dossier' }), box([0, 0.19, 0.02], [0.10, 0.38, 0.10], FRAME)])],
      poses: {
        a: { float: true, pelvis: [0, 0.615, 0.0], rot: [-6, 0, 0], neck: [6, 0, 0], lL: flatF(0.22, 0.45), lR: flatF(-0.22, 0.45),
          aL: grip([0.42, 1.220, 0.02], [0, 0, 1], [0, -1, 0], { p: [1, 0, -0.5] }), aR: grip([-0.42, 1.220, 0.02], [0, 0, 1], [0, -1, 0], { p: [-1, 0, -0.5] }) },
        b: { float: true, pelvis: [0, 0.615, 0.0], rot: [-6, 0, 0], neck: [6, 0, 0], lL: flatF(0.22, 0.45), lR: flatF(-0.22, 0.45),
          aL: grip([0.14, 1.220, 0.60], [0, 0, 1], [0, -1, 0], { p: [1, -0.5, -0.4] }), aR: grip([-0.14, 1.220, 0.60], [0, 0, 1], [0, -1, 0], { p: [-1, -0.5, -0.4] }) },
      },
      seq: [['a', 0.4, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e0576', lib: true, name: 'Développé poitrine à la machine', en: 'Lever chest press', mus: mus(m2('pec', 1), m2('delt', 2)), cam: { yaw: 30, pitch: 10 },
      props: [fn(() => [box([0, 0.44, 0.0], [0.40, 0.07, 0.40], PAD, { name: 'siège' }), box([0, 0.97, -0.27], [0.38, 0.72, 0.07], PAD, { name: 'dossier' }), box([0, 0.20, -0.05], [0.10, 0.40, 0.10], FRAME),
          cyl([0.45, 0, -0.40], [0.45, 2.0, -0.40], 0.03, FRAME), cyl([-0.45, 0, -0.40], [-0.45, 2.0, -0.40], 0.03, FRAME), cyl([-0.45, 2.0, -0.40], [0.45, 2.0, -0.40], 0.03, FRAME)]),
        fn((C) => { const out = []; for (const sd of ['L', 'R']) { const h = C.hand(sd); const s = sd === 'L' ? 1 : -1; const piv = [s * 0.64, 1.95, -0.25];
          const top = C.add(h.grip, C.mul(h.across, 0.07)), bot = C.add(h.grip, C.mul(h.across, -0.07));
          out.push(cyl(bot, top, 0.017, BAR, { held: true }), cyl(piv, top, 0.025, FRAME, { name: 'bras', held: true }), cyl(C.lerp(piv, top, 0.35), C.add(C.lerp(piv, top, 0.35), [s * 0.08, 0, 0]), 0.20, PLATE, { name: 'disque' })); } return out; })],
      poses: {
        a: { float: true, pelvis: [0, 0.643, -0.02], rot: [-4, 0, 0], neck: [4, 0, 0], lL: flatF(0.20, 0.42), lR: flatF(-0.20, 0.42),
          aL: grip([0.29, 1.268, 0.10], [0, 0, 1], [-1, 0, 0], { p: [1, -0.5, -0.3] }), aR: grip([-0.29, 1.268, 0.10], [0, 0, 1], [1, 0, 0], { p: [-1, -0.5, -0.3] }) },
        b: { float: true, pelvis: [0, 0.643, -0.02], rot: [-4, 0, 0], neck: [4, 0, 0], lL: flatF(0.20, 0.42), lR: flatF(-0.20, 0.42),
          aL: grip([0.20, 1.268, 0.60], [0, 0, 1], [-1, 0, 0], { p: [1, -0.8, 0] }), aR: grip([-0.20, 1.268, 0.60], [0, 0, 1], [1, 0, 0], { p: [-1, -0.8, 0] }) },
      },
      seq: [['a', 0.4, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e1300', lib: true, name: 'Développé décliné à la machine', en: 'Lever decline chest press', mus: mus(m2('pec', 1), m2('delt', 2)), cam: { yaw: 50, pitch: 12 },
      props: [fn(() => [box([0, 0.44, 0.02], [0.40, 0.07, 0.40], PAD, { name: 'siège' }), tbox([0, 0.88, -0.36], [0.38, 0.74, 0.07], -28, PAD, { name: 'dossier' }), box([0, 0.20, -0.05], [0.10, 0.40, 0.10], FRAME),
          cyl([0.55, 0, -0.60], [0.55, 2.0, -0.60], 0.03, FRAME), cyl([-0.55, 0, -0.60], [-0.55, 2.0, -0.60], 0.03, FRAME), cyl([-0.55, 2.0, -0.60], [0.55, 2.0, -0.60], 0.03, FRAME)]),
        fn((C) => { const out = []; for (const sd of ['L', 'R']) { const h = C.hand(sd); const s = sd === 'L' ? 1 : -1; const piv = [s * 0.66, 1.90, -0.42];
          const top = C.add(h.grip, C.mul(h.across, 0.07)), bot = C.add(h.grip, C.mul(h.across, -0.07));
          out.push(cyl(bot, top, 0.017, BAR, { held: true }), cyl(piv, top, 0.025, FRAME, { name: 'bras', held: true }), cyl(C.lerp(piv, top, 0.3), C.add(C.lerp(piv, top, 0.3), [s * 0.08, 0, 0]), 0.20, PLATE, { name: 'disque' })); } return out; })],
      poses: {
        a: { float: true, pelvis: [0, 0.643, 0.0], rot: [-26, 0, 0], neck: [12, 0, 0], lL: flatF(0.20, 0.45), lR: flatF(-0.20, 0.45),
          aL: grip([0.30, 1.148, 0.02], [0, -0.25, 1], [-1, 0, 0], { p: [1, -0.5, -0.3] }), aR: grip([-0.30, 1.148, 0.02], [0, -0.25, 1], [1, 0, 0], { p: [-1, -0.5, -0.3] }) },
        b: { float: true, pelvis: [0, 0.643, 0.0], rot: [-26, 0, 0], neck: [12, 0, 0], lL: flatF(0.20, 0.45), lR: flatF(-0.20, 0.45),
          aL: grip([0.20, 0.928, 0.50], [0, -0.25, 1], [-1, 0, 0], { p: [1, -0.8, 0] }), aR: grip([-0.20, 0.928, 0.50], [0, -0.25, 1], [1, 0, 0], { p: [-1, -0.8, 0] }) },
      },
      seq: [['a', 0.4, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e3216', lib: true, name: 'Pompe avec touche de poitrine', en: 'Chest tap push-up (male)', mus: mus(m2('pec', 1), m2('triceps', 2), m2('delt', 2)), cam: { yaw: 70, pitch: 18 },
      poses: {
        a: { pelvis: [0, 0.48, -0.05], rot: [74, 0, 0], neck: [-14, 0, 0], lL: { at: [0.10, 0.17, -0.92], foot: { toe: [0, -0.72, 0.69], up: [0, 0.69, 0.72] }, toes: 30 }, lR: { at: [-0.10, 0.17, -0.92], foot: { toe: [0, -0.72, 0.69], up: [0, 0.69, 0.72] }, toes: 30 },
          aL: { at: [0.24, 0.03, 0.50], hand: 'flat', hdir: [0.1, 0, 1], p: [1, 0.3, -0.5] }, aR: { at: [-0.24, 0.03, 0.50], hand: 'flat', hdir: [-0.1, 0, 1], p: [-1, 0.3, -0.5] } },
        b: { pelvis: [0, 0.22, -0.05], rot: [86, 0, 0], neck: [-14, 0, 0], lL: { at: [0.10, 0.17, -0.92], foot: { toe: [0, -0.55, 0.83], up: [0, 0.83, 0.55] }, toes: 30 }, lR: { at: [-0.10, 0.17, -0.92], foot: { toe: [0, -0.55, 0.83], up: [0, 0.83, 0.55] }, toes: 30 },
          aL: { at: [0.24, 0.03, 0.50], hand: 'flat', hdir: [0.1, 0, 1], p: [1, 0.6, -0.4] }, aR: { at: [-0.24, 0.03, 0.50], hand: 'flat', hdir: [-0.1, 0, 1], p: [-1, 0.6, -0.4] } },
        c: { pelvis: [0, 0.48, -0.05], rot: [74, 0, 6], neck: [-14, 0, 0], lL: { at: [0.10, 0.17, -0.92], foot: { toe: [0, -0.72, 0.69], up: [0, 0.69, 0.72] }, toes: 30 }, lR: { at: [-0.10, 0.17, -0.92], foot: { toe: [0, -0.72, 0.69], up: [0, 0.69, 0.72] }, toes: 30 },
          aL: { at: [0.26, 0.03, 0.50], hand: 'flat', hdir: [0.1, 0, 1], p: [1, 0.3, -0.5] }, aR: { atb: [-0.02, 0.10, 0.18], pb: [-1, -0.3, 0.3], hand: { db: [1, 0.2, 0], nb: [0, 0, -1] } } },
        d: { pelvis: [0, 0.48, -0.05], rot: [74, 0, -6], neck: [-14, 0, 0], lL: { at: [0.10, 0.17, -0.92], foot: { toe: [0, -0.72, 0.69], up: [0, 0.69, 0.72] }, toes: 30 }, lR: { at: [-0.10, 0.17, -0.92], foot: { toe: [0, -0.72, 0.69], up: [0, 0.69, 0.72] }, toes: 30 },
          aR: { at: [-0.26, 0.03, 0.50], hand: 'flat', hdir: [-0.1, 0, 1], p: [-1, 0.3, -0.5] }, aL: { atb: [0.02, 0.10, 0.18], pb: [1, -0.3, 0.3], hand: { db: [-1, 0.2, 0], nb: [0, 0, -1] } } },
      },
      seq: [['a', 0.2, 0.8], ['b', 0.1, 0.8], ['a', 0.1, 0.5], ['c', 0.3, 0.5], ['a', 0.2, 0.8], ['b', 0.1, 0.8], ['a', 0.1, 0.5], ['d', 0.3, 0.5]] },
    /* ======================= ÉPAULES ======================= */
    { id: 'Alternating_Deltoid_Raise', lib: true, name: 'Élévation deltoïdes alternée aux haltères', en: 'Alternating deltoid raise', mus: mus(m2('delt', 1)), cam: { yaw: 40, pitch: 8 },
      props: dbs(),
      poses: {
        a: { pelvis: [0, 0.92, 0], lL: flatF(0.12, 0.02), lR: flatF(-0.12, 0.02),
          aL: reach(SH(1), [0.25, 0.74, 0.04], [-1, 0, 0], { p: [0.2, 0, -1] }), aR: reach(SH(-1), [-0.25, 0.74, 0.04], [1, 0, 0], { p: [-0.2, 0, -1] }) },
        b: { pelvis: [0, 0.92, 0], lL: flatF(0.12, 0.02), lR: flatF(-0.12, 0.02),
          aL: reach(SH(1), [0.22, 1.40, 0.68], [0, -1, 0], { p: [1, -0.2, 0] }), aR: reach(SH(-1), [-0.25, 0.74, 0.04], [1, 0, 0], { p: [-0.2, 0, -1] }) },
        c: { pelvis: [0, 0.92, 0], lL: flatF(0.12, 0.02), lR: flatF(-0.12, 0.02),
          aL: reach(SH(1), [0.25, 0.74, 0.04], [-1, 0, 0], { p: [0.2, 0, -1] }), aR: reach(SH(-1), [-0.22, 1.40, 0.68], [0, -1, 0], { p: [-1, -0.2, 0] }) },
      },
      seq: [['a', 0.3, 1.0], ['b', 0.3, 1.0], ['a', 0.3, 1.0], ['c', 0.3, 1.0]] },

    { id: 'e0091', lib: true, name: 'Développé au-dessus de la tête assis à la barre', en: 'Barbell seated overhead press', mus: mus(m2('delt', 1), m2('pec', 2), m2('triceps', 2)), cam: { yaw: 40, pitch: 8 },
      props: [barbell(), fn(() => bench(-0.40, 0.24, 0.45))],
      poses: {
        a: { float: true, pelvis: [0, 0.606, -0.05], rot: [2, 0, 0], neck: [-4, 0, 0], lL: flatF(0.22, 0.42), lR: flatF(-0.22, 0.42),
          aL: grip([0.29, 1.186, 0.13], [0, 1, 0.1], [0, -0.1, 1], { p: [0.6, -1, 0.3] }), aR: grip([-0.29, 1.186, 0.13], [0, 1, 0.1], [0, -0.1, 1], { p: [-0.6, -1, 0.3] }) },
        b: { float: true, pelvis: [0, 0.606, -0.05], rot: [2, 0, 0], neck: [-4, 0, 0], lL: flatF(0.22, 0.42), lR: flatF(-0.22, 0.42),
          aL: grip([0.29, 1.766, 0.0], [0, 1, 0.05], [0, -0.05, 1], { p: [1, -0.2, 0] }), aR: grip([-0.29, 1.766, 0.0], [0, 1, 0.05], [0, -0.05, 1], { p: [-1, -0.2, 0] }) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.3, 1.2]] },

    { id: 'e0405', lib: true, name: 'Développé épaules assis aux haltères', en: 'Dumbbell seated shoulder press', mus: mus(m2('delt', 1), m2('pec', 2), m2('triceps', 2)), cam: { yaw: 35, pitch: 8 },
      props: [...dbs(), fn(() => [box([0, 0.42, 0.0], [0.34, 0.07, 0.40], PAD, { name: 'banc' }), tbox([0, 0.88, -0.27], [0.32, 0.72, 0.07], -10, PAD, { name: 'dossier' }), box([0, 0.19, 0.0], [0.10, 0.38, 0.10], FRAME)])],
      poses: {
        a: { float: true, pelvis: [0, 0.607, -0.02], rot: [-8, 0, 0], neck: [4, 0, 0], lL: flatF(0.24, 0.42), lR: flatF(-0.24, 0.42),
          aL: grip([0.36, 1.157, 0.02], [0, 1, 0.05], [0, -0.05, 1], { p: [1, -0.6, 0] }), aR: grip([-0.36, 1.157, 0.02], [0, 1, 0.05], [0, -0.05, 1], { p: [-1, -0.6, 0] }) },
        b: { float: true, pelvis: [0, 0.607, -0.02], rot: [-8, 0, 0], neck: [4, 0, 0], lL: flatF(0.24, 0.42), lR: flatF(-0.24, 0.42),
          aL: grip([0.17, 1.757, -0.06], [0, 1, 0.05], [0, -0.05, 1], { p: [1, -0.2, 0] }), aR: grip([-0.17, 1.757, -0.06], [0, 1, 0.05], [0, -0.05, 1], { p: [-1, -0.2, 0] }) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.3, 1.2]] },

    { id: 'e2318', lib: true, name: 'Développé épaules à la machine', en: 'Lever shoulder press v. 3', mus: mus(m2('delt', 1), m2('pec', 2), m2('serr', 2)), cam: { yaw: 35, pitch: 8 },
      props: [fn(() => [box([0, 0.42, 0.0], [0.38, 0.07, 0.40], PAD, { name: 'siège' }), tbox([0, 0.92, -0.27], [0.36, 0.76, 0.07], -10, PAD, { name: 'dossier' }), box([0, 0.19, 0.0], [0.10, 0.38, 0.10], FRAME)]),
        fn((C) => { const out = []; for (const sd of ['L', 'R']) { const h = C.hand(sd); const s = sd === 'L' ? 1 : -1; const piv = [s * 0.50, 0.95, -0.55];
          const a = C.add(h.grip, C.mul(h.across, 0.07)), b = C.add(h.grip, C.mul(h.across, -0.07)); const outer = s * (a[0] - b[0]) > 0 ? a : b;
          out.push(cyl(a, b, 0.017, BAR, { held: true }), cyl(piv, outer, 0.025, FRAME, { name: 'bras', held: true }), cyl(C.lerp(piv, outer, 0.3), C.add(C.lerp(piv, outer, 0.3), [s * 0.08, 0, 0]), 0.19, PLATE, { name: 'disque' })); } return out; })],
      poses: {
        a: { float: true, pelvis: [0, 0.606, -0.02], rot: [-8, 0, 0], neck: [4, 0, 0], lL: flatF(0.22, 0.42), lR: flatF(-0.22, 0.42),
          aL: grip([0.33, 1.166, 0.03], [0, 1, 0.05], [-1, 0, 0], { p: [1, -0.6, 0] }), aR: grip([-0.33, 1.166, 0.03], [0, 1, 0.05], [1, 0, 0], { p: [-1, -0.6, 0] }) },
        b: { float: true, pelvis: [0, 0.606, -0.02], rot: [-8, 0, 0], neck: [4, 0, 0], lL: flatF(0.22, 0.42), lR: flatF(-0.22, 0.42),
          aL: grip([0.20, 1.746, -0.04], [0, 1, 0.05], [-1, 0, 0], { p: [1, -0.2, 0] }), aR: grip([-0.20, 1.746, -0.04], [0, 1, 0.05], [1, 0, 0], { p: [-1, -0.2, 0] }) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.3, 1.2]] },

    { id: 'e0520', lib: true, name: 'Développé alterné au kettlebell', en: 'Kettlebell alternating press', mus: mus(m2('delt', 1), m2('pec', 2), m2('triceps', 2)), cam: { yaw: 30, pitch: 8 },
      props: [kbIn('L'), kbIn('R')],
      poses: {
        a: { pelvis: [0, 0.92, 0], lL: flatF(0.13, 0.02), lR: flatF(-0.13, 0.02),
          aL: grip([0.22, 1.40, 0.21], [-0.25, 1, 0.1], [-1, -0.2, 0.3], { p: [0.4, -1, 0.3] }), aR: grip([-0.22, 1.40, 0.21], [0.25, 1, 0.1], [1, -0.2, 0.3], { p: [-0.4, -1, 0.3] }) },
        b: { pelvis: [0, 0.92, 0], lL: flatF(0.13, 0.02), lR: flatF(-0.13, 0.02),
          aL: grip([0.22, 2.05, 0.02], [0, 1, 0], [0, 0, 1], { p: [1, -0.2, 0] }), aR: grip([-0.22, 1.40, 0.21], [0.25, 1, 0.1], [1, -0.2, 0.3], { p: [-0.4, -1, 0.3] }) },
        c: { pelvis: [0, 0.92, 0], lL: flatF(0.13, 0.02), lR: flatF(-0.13, 0.02),
          aL: grip([0.22, 1.40, 0.21], [-0.25, 1, 0.1], [-1, -0.2, 0.3], { p: [0.4, -1, 0.3] }), aR: grip([-0.22, 2.05, 0.02], [0, 1, 0], [0, 0, 1], { p: [-1, -0.2, 0] }) },
      },
      seq: [['a', 0.3, 1.0], ['b', 0.3, 1.0], ['a', 0.3, 1.0], ['c', 0.3, 1.0]] },

    { id: 'e0552', lib: true, name: 'Épaulé à deux bras au kettlebell', en: 'Kettlebell two arm clean', mus: mus(m2('delt', 1), m2('quad', 2), m2('pec', 2), { abs: 2 }, m2('obl', 2), m2('add', 2), m2('trap', 2), m2('calf', 2), m2('biceps', 2)), cam: { yaw: 40, pitch: 8 },
      props: [kbIn('L'), kbIn('R')],
      poses: {
        a: { pelvis: [0, 0.76, -0.22], rot: [50, 0, 0], neck: [-26, 0, 0], lL: flatF(0.30, 0.04, { toe: [0.3, 0, 1], p: [0.7, 0, 1] }), lR: flatF(-0.30, 0.04, { toe: [-0.3, 0, 1], p: [-0.7, 0, 1] }),
          aL: { at: [0.11, 0.56, 0.22], hand: { d: [0, -1, 0], n: [-1, 0, 0] }, p: [0.3, 0, -1] }, aR: { at: [-0.11, 0.56, 0.22], hand: { d: [0, -1, 0], n: [1, 0, 0] }, p: [-0.3, 0, -1] } },
        m: { pelvis: [0, 0.86, -0.06], rot: [14, 0, 0], neck: [-8, 0, 0], lL: flatF(0.30, 0.04, { toe: [0.3, 0, 1], p: [0.7, 0, 1] }), lR: flatF(-0.30, 0.04, { toe: [-0.3, 0, 1], p: [-0.7, 0, 1] }),
          aL: grip([0.14, 0.98, 0.34], [0, -0.2, 1], [-1, 0, 0], { p: [0.5, -1, -0.2] }), aR: grip([-0.14, 0.98, 0.34], [0, -0.2, 1], [1, 0, 0], { p: [-0.5, -1, -0.2] }) },
        b: { pelvis: [0, 0.90, 0], rot: [0, 0, 0], lL: flatF(0.30, 0.04, { toe: [0.3, 0, 1] }), lR: flatF(-0.30, 0.04, { toe: [-0.3, 0, 1] }),
          aL: grip([0.22, 1.40, 0.21], [-0.25, 1, 0.1], [-1, -0.2, 0.3], { p: [0.4, -1, 0.3] }), aR: grip([-0.22, 1.40, 0.21], [0.25, 1, 0.1], [1, -0.2, 0.3], { p: [-0.4, -1, 0.3] }) },
      },
      seq: [['a', 0.3, 0.5], ['m', 0, 0.5], ['b', 0.5, 0.5], ['m', 0, 0.5]] },

    { id: 'e0162', lib: true, name: 'Élévation frontale à la poulie', en: 'Cable front raise', side: true, mus: { deltR: 1, pecR: 2 }, cam: { yaw: -45, pitch: 8 },
      props: [cableTo('R', [-0.06, 0.12, -0.55]), fn(() => [box([-0.06, 0.06, -0.62], [0.20, 0.12, 0.12], FRAME, { name: 'poulie' })])],
      poses: {
        a: { pelvis: [0, 0.92, 0], lL: flatF(0.13, 0.02), lR: flatF(-0.13, 0.02),
          aL: reach(SH(1), [0.25, 0.74, 0.03], [-1, 0, 0], { p: [0.2, 0, -1] }), aR: reach(SH(-1), [-0.16, 0.76, 0.16], [0, 0, -1], { p: [-0.3, 0, -1] }) },
        b: { pelvis: [0, 0.92, 0], lL: flatF(0.13, 0.02), lR: flatF(-0.13, 0.02),
          aL: reach(SH(1), [0.25, 0.74, 0.03], [-1, 0, 0], { p: [0.2, 0, -1] }), aR: reach(SH(-1), [-0.20, 1.44, 0.70], [0, -1, 0], { p: [-1, -0.2, 0] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e0164', lib: true, name: 'Élévation frontale des épaules à la poulie', en: 'Cable front shoulder raise', mus: mus(m2('delt', 1)), cam: { yaw: 20, pitch: 8 },
      props: [tower(1.05, -0.10, 2.15, { w: 0.3 }), tower(-1.05, -0.10, 2.15, { w: 0.3 }), cableTo('L', [-1.00, 0.15, -0.10]), cableTo('R', [1.00, 0.15, -0.10])],
      poses: {
        a: { pelvis: [0, 0.92, 0], lL: flatF(0.15, 0.02), lR: flatF(-0.15, 0.02),
          aL: reach(SH(1), [0.20, 0.78, 0.15], [-0.4, 0, -1], { p: [0.4, 0, -1] }), aR: reach(SH(-1), [-0.20, 0.78, 0.15], [0.4, 0, -1], { p: [-0.4, 0, -1] }) },
        b: { pelvis: [0, 0.92, 0], lL: flatF(0.15, 0.02), lR: flatF(-0.15, 0.02),
          aL: reach(SH(1), [0.10, 1.46, 0.68], [0, -1, 0], { p: [1, -0.2, 0] }), aR: reach(SH(-1), [-0.10, 1.46, 0.68], [0, -1, 0], { p: [-1, -0.2, 0] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e0178', lib: true, name: 'Élévation latérale à la poulie', en: 'Cable lateral raise', side: true, mus: { deltR: 1 }, cam: { yaw: 10, pitch: 8 },
      props: [tower(0.95, 0.0, 2.15, { w: 0.3 }), cableTo('R', [0.90, 0.15, 0.0])],
      poses: {
        a: { pelvis: [0, 0.92, 0], lL: flatF(0.13, 0.02), lR: flatF(-0.13, 0.02),
          aL: reach(SH(1), [0.27, 0.74, 0.03], [-1, 0, 0], { p: [0.2, 0, -1] }), aR: reach(SH(-1), [-0.04, 0.92, 0.34], [0.6, 0, -0.8], { p: [-0.6, 0, -1] }) },
        b: { pelvis: [0, 0.92, 0], lL: flatF(0.13, 0.02), lR: flatF(-0.13, 0.02),
          aL: reach(SH(1), [0.27, 0.74, 0.03], [-1, 0, 0], { p: [0.2, 0, -1] }), aR: reach(SH(-1), [-0.80, 1.44, 0.08], [0, -1, 0], { p: [-0.2, 0.2, -1] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },

    { id: 'Car_Drivers', lib: true, name: 'Car drivers', en: 'Car drivers', mus: mus(m2('delt', 1), m2('forearm', 2)), cam: { yaw: 12, pitch: 8 },
      props: [fn((C) => { const a = C.hand('L').grip, b = C.hand('R').grip; const c = C.mul(C.add(a, b), 0.5); const u = C.norm(C.sub(a, b)); const n = C.norm(C.cross(u, [0, 1, 0])); const nn = C.dot(n, [0, 0, 1]) < 0 ? C.mul(n, -1) : n;
        return [cyl(C.add(c, C.mul(nn, -0.018)), C.add(c, C.mul(nn, 0.018)), 0.225, PLATE, { held: true, name: 'disque' }), cyl(C.add(c, C.mul(nn, -0.02)), C.add(c, C.mul(nn, 0.02)), 0.03, BAR, { held: true })]; })],
      poses: (() => { const P = {}; for (const [k, th] of [['a', -40], ['b', 40]]) { const c = [0, 1.36, 0.56]; const u = [Math.cos(th * D2R), Math.sin(th * D2R), 0]; const up = [-Math.sin(th * D2R), Math.cos(th * D2R), 0];
        P[k] = { pelvis: [0, 0.92, 0], lL: flatF(0.14, 0.02), lR: flatF(-0.14, 0.02),
          aL: grip(add(c, mul(u, 0.21)), norm(add(mul(up, 0.5), [0, 0, 0.6])), mul(u, -1), { p: [1, -0.4, -0.2] }), aR: grip(sub(c, mul(u, 0.21)), norm(add(mul(up, 0.5), [0, 0, 0.6])), u, { p: [-1, -0.4, -0.2] }) }; } return P; })(),
      seq: [['a', 0.3, 1.0], ['b', 0.3, 1.0]] },

    { id: 'e0356', lib: true, name: 'Élévation latérale unilatérale avec appui à l’haltère', en: 'Dumbbell one arm lateral raise with support', side: true, mus: { deltR: 1, pecR: 2 }, cam: { yaw: 20, pitch: 8 },
      props: [dbIn('R'), fn(() => [tbox([0.62, 0.62, 0.02], [0.30, 0.95, 0.07], -38, PAD, { name: 'banc' }), box([0.62, 0.15, 0.10], [0.12, 0.30, 0.50], FRAME)])],
      poses: {
        a: { pelvis: [0, 0.92, 0], rot: [0, 0, -4], lL: flatF(0.14, 0.02), lR: flatF(-0.14, 0.02),
          aL: grip([0.56, 1.06, -0.20], [0.3, 0.2, 0.93], [0, -1, 0.2], { p: [0.3, -0.5, -1] }), aR: reach(SH(-1), [-0.20, 0.74, 0.08], [1, 0, 0], { p: [-0.3, 0, -1] }) },
        b: { pelvis: [0, 0.92, 0], rot: [0, 0, -4], lL: flatF(0.14, 0.02), lR: flatF(-0.14, 0.02),
          aL: grip([0.56, 1.06, -0.20], [0.3, 0.2, 0.93], [0, -1, 0.2], { p: [0.3, -0.5, -1] }), aR: reach(SH(-1), [-0.82, 1.42, 0.06], [0, -1, 0], { p: [-0.2, 0.2, -1] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e3237', lib: true, name: 'Élévation latérale à la landmine', en: 'Landmine lateral raise', side: true, mus: { deltR: 1 }, cam: { yaw: -10, pitch: 10 },
      props: [fn((C) => { const h = C.hand('R'); const piv = [0.95, 0.04, 0.55]; const d = C.norm(C.sub(h.grip, piv)); const end = C.add(h.grip, C.mul(d, 0.12));
        return [cyl(piv, end, 0.016, BAR, { held: true, name: 'barre' }), cyl(C.add(h.grip, C.mul(d, 0.12)), C.add(h.grip, C.mul(d, 0.16)), 0.12, PLATE, { name: 'disque', held: true }), box([0.95, 0.03, 0.55], [0.22, 0.06, 0.22], PLATE, { name: 'socle' })]; })],
      poses: {
        a: { pelvis: [0, 0.92, 0], lL: flatF(0.15, 0.02), lR: flatF(-0.15, 0.02),
          aL: reach(SH(1), [0.27, 0.74, 0.03], [-1, 0, 0], { p: [0.2, 0, -1] }), aR: reach(SH(-1), [-0.04, 0.92, 0.36], [0.6, 0, -0.8], { p: [-0.6, 0, -1] }) },
        b: { pelvis: [0, 0.92, 0], lL: flatF(0.15, 0.02), lR: flatF(-0.15, 0.02),
          aL: reach(SH(1), [0.27, 0.74, 0.03], [-1, 0, 0], { p: [0.2, 0, -1] }), aR: reach(SH(-1), [-0.72, 1.55, 0.14], [0, -1, 0.2], { p: [-0.2, 0.2, -1] }) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.3, 1.3]] },

    { id: 'e0154', lib: true, name: 'Oiseau croisé à la poulie (vis-à-vis)', en: 'Cable cross-over revers fly', mus: mus(m2('deltP', 1), m2('rhomb', 2)), cam: { yaw: 150, pitch: 22 },
      props: [tower(1.05, 0.25, 2.15, { w: 0.3 }), tower(-1.05, 0.25, 2.15, { w: 0.3 }), cableTo('L', [-1.00, 0.12, 0.25]), cableTo('R', [1.00, 0.12, 0.25])],
      poses: {
        a: { pelvis: [0, 0.88, -0.14], rot: [76, 0, 0], neck: [-30, 0, 0], lL: flatF(0.15, 0.02, { p: [0.2, 0, 1] }), lR: flatF(-0.15, 0.02, { p: [-0.2, 0, 1] }),
          aL: grip([-0.05, 0.50, 0.38], [0, -1, 0], [-1, 0, 0], { p: [1, 0.3, 0] }), aR: grip([0.05, 0.52, 0.40], [0, -1, 0], [1, 0, 0], { p: [-1, 0.3, 0] }) },
        b: { pelvis: [0, 0.88, -0.14], rot: [76, 0, 0], neck: [-30, 0, 0], lL: flatF(0.15, 0.02, { p: [0.2, 0, 1] }), lR: flatF(-0.15, 0.02, { p: [-0.2, 0, 1] }),
          aL: grip([0.80, 0.96, 0.36], [1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }), aR: grip([-0.80, 0.96, 0.36], [-1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e0380', lib: true, name: 'Élévation latérale arrière aux haltères', en: 'Dumbbell rear lateral raise', mus: mus(m2('deltP', 1), m2('rhomb', 2), m2('trap', 2)), cam: { yaw: 150, pitch: 22 },
      props: dbs(),
      poses: {
        a: { pelvis: [0, 0.86, -0.16], rot: [70, 0, 0], neck: [-26, 0, 0], lL: flatF(0.13, 0.02, { p: [0.15, 0, 1] }), lR: flatF(-0.13, 0.02, { p: [-0.15, 0, 1] }),
          aL: grip([0.14, 0.48, 0.36], [0, -1, 0], [-1, 0, 0], { p: [1, 0.3, 0] }), aR: grip([-0.14, 0.48, 0.36], [0, -1, 0], [1, 0, 0], { p: [-1, 0.3, 0] }) },
        b: { pelvis: [0, 0.86, -0.16], rot: [70, 0, 0], neck: [-26, 0, 0], lL: flatF(0.13, 0.02, { p: [0.15, 0, 1] }), lR: flatF(-0.13, 0.02, { p: [-0.15, 0, 1] }),
          aL: grip([0.78, 0.98, 0.32], [1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }), aR: grip([-0.78, 0.98, 0.32], [-1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e0379', lib: true, name: 'Élévation latérale arrière aux haltères (tête en appui)', en: 'Dumbbell rear lateral raise (support head)', mus: mus(m2('deltP', 1), m2('rhomb', 2), m2('trap', 2)), cam: { yaw: 140, pitch: 22 },
      props: [...dbs(), fn(() => [tbox([0, 0.655, 0.835], [0.30, 0.80, 0.07], -40, PAD, { name: 'banc' }), box([0, 0.17, 0.98], [0.12, 0.34, 0.46], FRAME)])],
      poses: {
        a: { pelvis: [0, 0.88, -0.20], rot: [78, 0, 0], neck: [-10, 0, 0], lL: flatF(0.13, 0.02, { p: [0.15, 0, 1] }), lR: flatF(-0.13, 0.02, { p: [-0.15, 0, 1] }),
          aL: grip([0.14, 0.42, 0.32], [0, -1, 0], [-1, 0, 0], { p: [1, 0.3, 0] }), aR: grip([-0.14, 0.42, 0.32], [0, -1, 0], [1, 0, 0], { p: [-1, 0.3, 0] }) },
        b: { pelvis: [0, 0.88, -0.20], rot: [78, 0, 0], neck: [-10, 0, 0], lL: flatF(0.13, 0.02, { p: [0.15, 0, 1] }), lR: flatF(-0.13, 0.02, { p: [-0.15, 0, 1] }),
          aL: grip([0.78, 0.92, 0.30], [1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }), aR: grip([-0.78, 0.92, 0.30], [-1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },

    { id: 'Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench', lib: true, name: 'Oiseau penché aux haltères tête sur banc', en: 'Bent over dumbbell rear delt raise with head on bench', mus: mus(m2('deltP', 1)), cam: { yaw: 140, pitch: 22 },
      props: [...dbs(), fn(() => [tbox([0, 0.655, 0.835], [0.30, 0.80, 0.07], -40, PAD, { name: 'banc' }), box([0, 0.17, 0.98], [0.12, 0.34, 0.46], FRAME)])],
      poses: {
        a: { pelvis: [0, 0.88, -0.20], rot: [78, 0, 0], neck: [-10, 0, 0], lL: flatF(0.13, 0.02, { p: [0.15, 0, 1] }), lR: flatF(-0.13, 0.02, { p: [-0.15, 0, 1] }),
          aL: grip([0.13, 0.42, 0.32], [0, -1, 0], [0, 0, -1], { p: [1, 0.3, 0] }), aR: grip([-0.13, 0.42, 0.32], [0, -1, 0], [0, 0, -1], { p: [-1, 0.3, 0] }) },
        b: { pelvis: [0, 0.88, -0.20], rot: [78, 0, 0], neck: [-10, 0, 0], lL: flatF(0.13, 0.02, { p: [0.15, 0, 1] }), lR: flatF(-0.13, 0.02, { p: [-0.15, 0, 1] }),
          aL: grip([0.78, 0.92, 0.30], [1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }), aR: grip([-0.78, 0.92, 0.30], [-1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e0326', lib: true, name: 'Élévation latérale arrière sur banc incliné aux haltères', en: 'Dumbbell incline rear lateral raise', mus: mus(m2('deltP', 1), m2('trap', 2)), cam: { yaw: 140, pitch: 25 },
      props: [...dbs(), fn(() => [tbox([0, 0.70, 0.18], [0.30, 0.82, 0.07], 50, PAD, { name: 'banc' }), box([0, 0.18, 0.05], [0.12, 0.36, 0.60], FRAME)])],
      poses: {
        a: { float: true, pelvis: [0, 0.78, -0.22], rot: [50, 0, 0], neck: [-24, 0, 0], lL: { at: [0.14, 0.17, -0.88], foot: { toe: [0, -0.6, 0.8], up: [0, 0.8, 0.6] } }, lR: { at: [-0.14, 0.17, -0.88], foot: { toe: [0, -0.6, 0.8], up: [0, 0.8, 0.6] } },
          aL: grip([0.20, 0.55, 0.42], [0, -1, 0], [-1, 0, 0], { p: [1, 0.3, 0] }), aR: grip([-0.20, 0.55, 0.42], [0, -1, 0], [1, 0, 0], { p: [-1, 0.3, 0] }) },
        b: { float: true, pelvis: [0, 0.78, -0.22], rot: [50, 0, 0], neck: [-24, 0, 0], lL: { at: [0.14, 0.17, -0.88], foot: { toe: [0, -0.6, 0.8], up: [0, 0.8, 0.6] } }, lR: { at: [-0.14, 0.17, -0.88], foot: { toe: [0, -0.6, 0.8], up: [0, 0.8, 0.6] } },
          aL: grip([0.80, 1.06, 0.34], [1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }), aR: grip([-0.80, 1.06, 0.34], [-1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e0240', lib: true, name: 'Oiseau allongé sur le dos à la poulie', en: 'Cable supine reverse fly', mus: mus(m2('deltP', 1)), cam: { yaw: 50, pitch: 25 },
      props: [fn(() => bench(-0.75, 0.25, 0.44)), tower(0.95, -0.30, 2.2, { w: 0.3 }), tower(-0.95, -0.30, 2.2, { w: 0.3 }), cableTo('L', [0.90, 2.05, -0.30]), cableTo('R', [-0.90, 2.05, -0.30])],
      poses: {
        a: { float: true, pelvis: [0, 0.595, 0.05], rot: [-90, 0, 0], neck: [8, 0, 0], lL: flatF(0.25, 0.50, { p: [0.5, 1, 0.2] }), lR: flatF(-0.25, 0.50, { p: [-0.5, 1, 0.2] }),
          aL: grip([0.12, 1.22, -0.44], [0, 1, 0], [-1, 0, 0], { p: [1, -0.2, 0] }), aR: grip([-0.12, 1.22, -0.44], [0, 1, 0], [1, 0, 0], { p: [-1, -0.2, 0] }) },
        b: { float: true, pelvis: [0, 0.595, 0.05], rot: [-90, 0, 0], neck: [8, 0, 0], lL: flatF(0.25, 0.50, { p: [0.5, 1, 0.2] }), lR: flatF(-0.25, 0.50, { p: [-0.5, 1, 0.2] }),
          aL: grip([0.78, 0.82, -0.44], [1, 0, 0], [0, 1, 0], { p: [0, -1, 0.3] }), aR: grip([-0.78, 0.82, -0.44], [-1, 0, 0], [0, 1, 0], { p: [0, -1, 0.3] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },
    /* ======================= DOS ======================= */
    { id: 'e1314', lib: true, name: 'Extension du dos sur swiss ball', en: 'Back extension on exercise ball', mus: mus(m2('low', 1)), cam: { yaw: 120, pitch: 30 },
      props: [fn(() => [sph([0, 0.30, 0.04], 0.30, BALL, { name: 'ballon' })])],
      poses: {
        a: { float: true, pelvis: [0, 0.74, -0.06], rot: [96, 0, 0], spine: [12, 0, 0], neck: [10, 0, 0],
          lL: { at: [0.13, 0.17, -0.95], foot: { toe: [0, -0.72, 0.69], up: [0, 0.69, 0.72] }, toes: 30 }, lR: { at: [-0.13, 0.17, -0.95], foot: { toe: [0, -0.72, 0.69], up: [0, 0.69, 0.72] }, toes: 30 },
          aL: HBH(1), aR: HBH(-1) },
        b: { float: true, pelvis: [0, 0.685, -0.06], rot: [80, 0, 0], spine: [-8, 0, 0], neck: [-14, 0, 0],
          lL: { at: [0.13, 0.17, -0.95], foot: { toe: [0, -0.72, 0.69], up: [0, 0.69, 0.72] }, toes: 30 }, lR: { at: [-0.13, 0.17, -0.95], foot: { toe: [0, -0.72, 0.69], up: [0, 0.69, 0.72] }, toes: 30 },
          aL: HBH(1), aR: HBH(-1) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.5, 1.2]] },

    { id: 'e1335', lib: true, name: 'Extension du dos sur swiss ball, genoux décollés du sol', en: 'Exercise ball back extension with knees off ground', mus: mus(m2('low', 1), m2('glute', 2)), cam: { yaw: 120, pitch: 30 },
      props: [fn(() => [sph([0, 0.30, 0.04], 0.30, BALL, { name: 'ballon' })])],
      poses: {
        a: { float: true, pelvis: [0, 0.74, -0.10], rot: [96, 0, 0], spine: [12, 0, 0], neck: [10, 0, 0],
          lL: { at: [0.14, 0.17, -1.00], foot: { toe: [0, -0.72, 0.69], up: [0, 0.69, 0.72] }, toes: 30 }, lR: { at: [-0.14, 0.17, -1.00], foot: { toe: [0, -0.72, 0.69], up: [0, 0.69, 0.72] }, toes: 30 },
          aL: HBH(1), aR: HBH(-1) },
        b: { float: true, pelvis: [0, 0.67, -0.10], rot: [78, 0, 0], spine: [-6, 0, 0], neck: [-12, 0, 0],
          lL: { at: [0.14, 0.17, -1.00], foot: { toe: [0, -0.72, 0.69], up: [0, 0.69, 0.72] }, toes: 30 }, lR: { at: [-0.14, 0.17, -1.00], foot: { toe: [0, -0.72, 0.69], up: [0, 0.69, 0.72] }, toes: 30 },
          aL: HBH(1), aR: HBH(-1) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.5, 1.2]] },

    { id: 'e0489', lib: true, name: 'Hyperextension (extension lombaire)', en: 'Hyperextension', mus: mus(m2('low', 1), m2('glute', 2), m2('ham', 2)), cam: { yaw: 80, pitch: 10 },
      props: [fn(() => [tbox([0, 0.593, -0.003], [0.40, 0.26, 0.08], 45, PAD, { name: 'banc' }), cyl([-0.22, 0.36, -0.655], [0.22, 0.36, -0.655], 0.05, PAD, { name: 'rouleau' }),
        tbox([0, 0.19, -0.62], [0.40, 0.26, 0.04], -45, PLATE, { name: 'repose-pieds' }), cyl([0, 0.04, -0.75], [0, 0.04, 0.55], 0.035, FRAME), cyl([0, 0.04, 0.45], [0, 0.58, 0.15], 0.035, FRAME),
        cyl([0, 0.04, -0.62], [0, 0.10, -0.62], 0.03, FRAME), cyl([-0.35, 0.03, 0.45], [0.35, 0.03, 0.45], 0.03, FRAME), cyl([-0.35, 0.03, -0.75], [0.35, 0.03, -0.75], 0.03, FRAME)])],
      poses: {
        a: { float: true, pelvis: [0, 0.90, 0.05], rot: [128, 0, 0], spine: [10, 0, 0], neck: [8, 0, 0],
          lL: { at: [0.12, 0.25, -0.55], foot: { toe: [0, -0.707, 0.707], up: [0, 0.707, 0.707] } }, lR: { at: [-0.12, 0.25, -0.55], foot: { toe: [0, -0.707, 0.707], up: [0, 0.707, 0.707] } },
          aL: HBH(1), aR: HBH(-1) },
        b: { float: true, pelvis: [0, 0.90, 0.05], rot: [45, 0, 0], spine: [-4, 0, 0], neck: [-6, 0, 0],
          lL: { at: [0.12, 0.25, -0.55], foot: { toe: [0, -0.707, 0.707], up: [0, 0.707, 0.707] } }, lR: { at: [-0.12, 0.25, -0.55], foot: { toe: [0, -0.707, 0.707], up: [0, 0.707, 0.707] } },
          aL: HBH(1), aR: HBH(-1) },
      },
      seq: [['a', 0.3, 1.3], ['b', 0.5, 1.3]] },
    { id: 'e0292', lib: true, name: 'Rowing unilatéral buste penché à l’haltère', en: 'Dumbbell one arm bent-over row', side: true, mus: { rhombR: 1, trapR: 2, latR: 1, bicepsR: 2, forearmR: 2 }, cam: { yaw: -100, pitch: 15 },
      props: [dbIn('R'), fn(() => bench(-0.62, 0.62, 0.45, { x: 0.17 }))],
      poses: {
        a: { float: true, pelvis: [0, 0.98, -0.18], rot: [78, -6, 0], neck: [-20, 0, 0],
          lL: KN(1, { d: [0.02, -1, 0.05] }), lR: flatF(-0.30, -0.10, { p: [-0.3, 0, 1] }),
          aL: { at: [0.20, 0.49, 0.36], hand: 'flat', hdir: [0, 0, 1], p: [0.5, 0, -1] }, aR: grip([-0.20, 0.50, 0.30], [0, -1, 0], [1, 0, 0], { p: [-0.3, 0, -1] }) },
        b: { float: true, pelvis: [0, 0.98, -0.18], rot: [78, -6, 0], neck: [-20, 0, 0],
          lL: KN(1, { d: [0.02, -1, 0.05] }), lR: flatF(-0.30, -0.10, { p: [-0.3, 0, 1] }),
          aL: { at: [0.20, 0.49, 0.36], hand: 'flat', hdir: [0, 0, 1], p: [0.5, 0, -1] }, aR: grip([-0.24, 0.92, 0.02], [0, -1, 0], [1, 0, 0], { p: [-0.2, 1, -0.6] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.4, 1.1]] },

    { id: 'e0064', lib: true, name: 'Rowing buste penché unilatéral à la barre', en: 'Barbell one arm bent over row', side: true, mus: { rhombR: 1, trapR: 2, latR: 2, bicepsR: 2, deltPR: 2 }, cam: { yaw: -55, pitch: 12 },
      props: [fn((C) => { const h = C.hand('R'); const piv = [-0.50, 0.02, -0.95]; const d = C.norm(C.sub(h.grip, piv)); const e = C.add(h.grip, C.mul(d, 0.10));
        return [cyl(piv, C.add(e, C.mul(d, 0.10)), 0.016, BAR, { held: true, name: 'barre' }), cyl(C.add(e, C.mul(d, 0.0)), C.add(e, C.mul(d, 0.04)), 0.20, PLATE, { name: 'disque' }), cyl(C.add(e, C.mul(d, -0.02)), e, 0.03, BAR, { name: 'barre' })]; })],
      poses: {
        a: { pelvis: [0, 0.86, -0.12], rot: [58, 0, 0], neck: [-22, 0, 0], lL: flatF(0.15, 0.02, { p: [0.2, 0, 1] }), lR: flatF(-0.15, 0.02, { p: [-0.2, 0, 1] }),
          aL: { grab: { bone: 'UpperLeg_L', h: 0.80, ang: 5, f: 1, tilt: 0 }, p: [0.6, 0, -1] }, aR: grip([-0.20, 0.40, 0.36], [0, -1, 0], [1, 0, 0], { p: [-0.3, 0, -1] }) },
        b: { pelvis: [0, 0.86, -0.12], rot: [58, 0, 0], neck: [-22, 0, 0], lL: flatF(0.15, 0.02, { p: [0.2, 0, 1] }), lR: flatF(-0.15, 0.02, { p: [-0.2, 0, 1] }),
          aL: { grab: { bone: 'UpperLeg_L', h: 0.80, ang: 5, f: 1, tilt: 0 }, p: [0.6, 0, -1] }, aR: grip([-0.23, 0.78, 0.08], [0, -1, 0], [1, 0, 0], { p: [-0.2, 1, -0.6] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.4, 1.1]] },

    { id: 'e0983', lib: true, name: 'Tirage vertical unilatéral à genoux à l’élastique', en: 'Band kneeling one arm pulldown', side: true, mus: { latR: 1, rhombR: 2 }, cam: { yaw: 210, pitch: 12 },
      props: [bandTo('R', [-0.35, 2.4, 1.4]), fn(() => [sph([-0.35, 2.4, 1.4], 0.03, FRAME, { name: 'ancrage' })])],
      poses: {
        a: { pelvis: [0, 0.62, -0.05], rot: [28, 0, 0], neck: [-6, 0, 0], lL: KN(1), lR: flatF(-0.17, 0.48, { p: [-0.2, 0, 1] }),
          aL: { grab: { bone: 'UpperLeg_L', h: 0.30, ang: 30, f: 1, tilt: 0 }, p: [0.8, 0, -0.5] }, aR: reach(SH(-1, 1.30, 0.30), [-0.30, 1.85, 0.75], [1, 0, 0], { p: [-1, -0.3, 0] }) },
        b: { pelvis: [0, 0.62, -0.05], rot: [28, 0, 0], neck: [-6, 0, 0], lL: KN(1), lR: flatF(-0.17, 0.48, { p: [-0.2, 0, 1] }),
          aL: { grab: { bone: 'UpperLeg_L', h: 0.30, ang: 30, f: 1, tilt: 0 }, p: [0.8, 0, -0.5] }, aR: grip([-0.26, 1.08, 0.26], [0, 1, 0.3], [0.8, 0, 0.3], { p: [-0.6, -1, -0.5] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.4, 1.1]] },

    { id: 'e0238', lib: true, name: 'Tirage bras tendus à la poulie', en: 'Cable straight arm pulldown', mus: mus(m2('lat', 1), m2('deltP', 2), m2('triceps', 2)), cam: { yaw: 120, pitch: 10 },
      props: [tower(0, 0.85, 2.3, { w: 0.6 }), fn((C) => { const a = C.hand('L').grip, b = C.hand('R').grip; const m = C.mul(C.add(a, b), 0.5); const u = C.norm(C.sub(a, b));
        return [cyl(C.add(m, C.mul(u, -0.33)), C.add(m, C.mul(u, 0.33)), 0.014, BAR, { held: true, name: 'barre' }), cyl(m, [0, 2.15, 0.75], 0.006, CABLE, { soft: true }), sph([0, 2.15, 0.75], 0.04, FRAME, { name: 'poulie' })]; })],
      poses: {
        a: { pelvis: [0, 0.91, -0.05], rot: [16, 0, 0], neck: [-6, 0, 0], lL: flatF(0.14, -0.02), lR: flatF(-0.14, -0.02),
          aL: grip([0.24, 1.58, 0.56], [0, 0.6, 0.8], [0, -1, 0.6], { p: [1, 0, 0] }), aR: grip([-0.24, 1.58, 0.56], [0, 0.6, 0.8], [0, -1, 0.6], { p: [-1, 0, 0] }) },
        b: { pelvis: [0, 0.91, -0.05], rot: [16, 0, 0], neck: [-6, 0, 0], lL: flatF(0.14, -0.02), lR: flatF(-0.14, -0.02),
          aL: grip([0.24, 0.86, 0.26], [0, -0.9, 0.4], [0, -0.4, -1], { p: [1, 0, -0.3] }), aR: grip([-0.24, 0.86, 0.26], [0, -0.9, 0.4], [0, -0.4, -1], { p: [-1, 0, -0.3] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.4, 1.1]] },

    { id: 'e0150', lib: true, name: 'Tirage vertical à la barre, poulie haute', en: 'Cable bar lateral pulldown', mus: mus(m2('lat', 1), m2('rhomb', 2), m2('biceps', 2)), cam: { yaw: 200, pitch: 10 },
      props: [fn(() => bench(-0.90, 0.28, 0.45)), tower(0, 0.62, 2.4, { w: 0.6 }), fn((C) => { const a = C.hand('L').grip, b = C.hand('R').grip; const m = C.mul(C.add(a, b), 0.5); const u = C.norm(C.sub(a, b));
        return [cyl(C.add(m, C.mul(u, -0.60)), C.add(m, C.mul(u, 0.60)), 0.014, BAR, { held: true, name: 'barre' }), cyl(m, [0, 2.30, 0.50], 0.006, CABLE, { soft: true }), sph([0, 2.30, 0.50], 0.04, FRAME, { name: 'poulie' })]; })],
      poses: {
        a: { float: true, pelvis: [0, 0.606, 0.0], rot: [-6, 0, 0], neck: [6, 0, 0], lL: flatF(0.22, 0.42), lR: flatF(-0.22, 0.42),
          aL: grip([0.45, 1.88, 0.16], [0, 1, 0.1], [0, -0.1, 1], { p: [1, 0, -0.3] }), aR: grip([-0.45, 1.88, 0.16], [0, 1, 0.1], [0, -0.1, 1], { p: [-1, 0, -0.3] }) },
        b: { float: true, pelvis: [0, 0.606, 0.0], rot: [-10, 0, 0], neck: [10, 0, 0], lL: flatF(0.22, 0.42), lR: flatF(-0.22, 0.42),
          aL: grip([0.42, 1.30, 0.20], [0, 1, 0.1], [0, -0.1, 1], { p: [1, -0.8, -0.3] }), aR: grip([-0.42, 1.30, 0.20], [0, 1, 0.1], [0, -0.1, 1], { p: [-1, -0.8, -0.3] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.4, 1.1]] },

    { id: 'e0214', lib: true, name: 'Rowing assis unilatéral alterné à la poulie', en: 'Cable seated one arm alternate row', mus: mus(m2('rhomb', 1), m2('lat', 2), m2('deltP', 2), m2('trap', 2)), cam: { yaw: 230, pitch: 10 },
      props: [fn(() => bench(-1.10, 0.20, 0.45)), tower(0, 1.75, 2.1, { w: 0.6 }), cableTo('L', [0.10, 1.05, 1.62]), cableTo('R', [-0.10, 1.05, 1.62])],
      poses: {
        a: { float: true, pelvis: [0, 0.606, 0.0], rot: [0, 0, 0], lL: flatF(0.20, 0.45), lR: flatF(-0.20, 0.45),
          aL: grip([0.18, 1.08, 0.62], [0, 0, 1], [-1, 0, 0], { p: [1, -0.4, 0] }), aR: grip([-0.20, 1.02, 0.18], [0, 0, 1], [1, 0, 0], { p: [-0.4, 0.3, -1] }) },
        b: { float: true, pelvis: [0, 0.606, 0.0], rot: [0, 0, 0], lL: flatF(0.20, 0.45), lR: flatF(-0.20, 0.45),
          aL: grip([0.20, 1.02, 0.18], [0, 0, 1], [-1, 0, 0], { p: [0.4, 0.3, -1] }), aR: grip([-0.18, 1.08, 0.62], [0, 0, 1], [1, 0, 0], { p: [-1, -0.4, 0] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.1]] },

    { id: 'e0861', lib: true, name: 'Tirage horizontal assis à la poulie', en: 'Cable seated row', mus: mus(m2('rhomb', 1), m2('trap', 2), m2('lat', 2), m2('deltP', 2)), cam: { yaw: 230, pitch: 10 },
      props: [fn(() => [...bench(-0.80, 0.30, 0.42), box([0, 0.30, 0.90], [0.40, 0.30, 0.04], PLATE, { name: 'repose-pieds' }), box([0, 0.08, 0.60], [0.10, 0.16, 0.70], FRAME)]), tower(0, 1.30, 2.1, { w: 0.6 }),
        fn((C) => { const a = C.hand('L').grip, b = C.hand('R').grip; const m = C.mul(C.add(a, b), 0.5); const fw = C.norm(C.sub([0, 0.40, 1.20], m)); const tip = C.add(m, C.mul(fw, 0.12));
          return [cyl(C.add(a, C.mul(C.hand('L').across, 0.06)), C.add(a, C.mul(C.hand('L').across, -0.06)), 0.015, PLATE, { held: true, name: 'poignée' }), cyl(C.add(b, C.mul(C.hand('R').across, 0.06)), C.add(b, C.mul(C.hand('R').across, -0.06)), 0.015, PLATE, { held: true, name: 'poignée' }),
            cyl(a, tip, 0.012, BAR, { held: true }), cyl(b, tip, 0.012, BAR, { held: true }), cyl(tip, [0, 0.40, 1.20], 0.006, CABLE, { soft: true }), sph([0, 0.40, 1.20], 0.04, FRAME, { name: 'poulie' })]; })],
      poses: {
        a: { float: true, pelvis: [0, 0.576, -0.05], rot: [30, 0, 0], neck: [-14, 0, 0],
          lL: { at: [0.13, 0.40, 0.78], foot: { toe: [0, 0.95, 0.3], up: [0, 0.3, -0.95] }, p: [0.2, 1, 0] }, lR: { at: [-0.13, 0.40, 0.78], foot: { toe: [0, 0.95, 0.3], up: [0, 0.3, -0.95] }, p: [-0.2, 1, 0] },
          aL: grip([0.06, 0.82, 0.80], [0, -1, 0], [-1, 0, 0], { p: [1, -0.2, 0] }), aR: grip([-0.06, 0.82, 0.80], [0, -1, 0], [1, 0, 0], { p: [-1, -0.2, 0] }) },
        b: { float: true, pelvis: [0, 0.576, -0.05], rot: [-4, 0, 0], neck: [4, 0, 0],
          lL: { at: [0.13, 0.40, 0.78], foot: { toe: [0, 0.95, 0.3], up: [0, 0.3, -0.95] }, p: [0.2, 1, 0] }, lR: { at: [-0.13, 0.40, 0.78], foot: { toe: [0, 0.95, 0.3], up: [0, 0.3, -0.95] }, p: [-0.2, 1, 0] },
          aL: grip([0.07, 0.86, 0.26], [0, -1, 0], [-1, 0, 0], { p: [0.4, 0.2, -1] }), aR: grip([-0.07, 0.86, 0.26], [0, -1, 0], [1, 0, 0], { p: [-0.4, 0.2, -1] }) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.4, 1.2]] },

    { id: 'e0571', lib: true, name: 'Tirage horizontal assis prise serrée alterné à la machine', en: 'Lever alternating narrow grip seated row', mus: mus(m2('rhomb', 1), m2('lat', 2), m2('trap', 2), m2('deltP', 2)), cam: { yaw: 230, pitch: 12 },
      props: [fn(() => [box([0, 0.43, -0.02], [0.38, 0.07, 0.36], PAD, { name: 'siège' }), box([0, 0.20, -0.02], [0.10, 0.40, 0.10], FRAME), tbox([0, 1.02, 0.30], [0.28, 0.34, 0.07], 0, PAD, { name: 'pupitre' }), box([0, 0.55, 0.40], [0.08, 0.90, 0.08], FRAME)]),
        fn((C) => { const out = []; for (const sd of ['L', 'R']) { const h = C.hand(sd); const s = sd === 'L' ? 1 : -1; const piv = [s * 0.30, 0.30, 1.10];
          const top = C.add(h.grip, C.mul(h.across, 0.07)), bot = C.add(h.grip, C.mul(h.across, -0.07)); const lo = top[1] < bot[1] ? top : bot;
          out.push(cyl(top, bot, 0.016, PLATE, { held: true, name: 'poignée' }), cyl(lo, [s * 0.30, lo[1] - 0.05, lo[2] + 0.05], 0.02, FRAME, { held: true }), cyl([s * 0.30, lo[1] - 0.05, lo[2] + 0.05], piv, 0.025, FRAME, { name: 'bras' }),
            cyl([s * 0.30, 0.55, 1.05], [s * 0.42, 0.55, 1.05], 0.20, PLATE, { name: 'disque' })); } return out; })],
      poses: {
        a: { float: true, pelvis: [0, 0.616, -0.02], rot: [10, 0, 0], neck: [-4, 0, 0], lL: flatF(0.22, 0.35), lR: flatF(-0.22, 0.35),
          aL: grip([0.09, 1.06, 0.86], [0, 0, 1], [-1, 0, 0], { p: [1, -0.2, -0.4] }), aR: grip([-0.09, 1.06, 0.48], [0, 0, 1], [1, 0, 0], { p: [-1, -0.2, -0.4] }) },
        b: { float: true, pelvis: [0, 0.616, -0.02], rot: [10, 0, 0], neck: [-4, 0, 0], lL: flatF(0.22, 0.35), lR: flatF(-0.22, 0.35),
          aL: grip([0.09, 1.06, 0.48], [0, 0, 1], [-1, 0, 0], { p: [1, -0.2, -0.4] }), aR: grip([-0.09, 1.06, 0.86], [0, 0, 1], [1, 0, 0], { p: [-1, -0.2, -0.4] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.1]] },

    { id: 'e0499', lib: true, name: 'Rowing inversé (traction australienne)', en: 'Inverted row', mus: mus(m2('rhomb', 1), m2('lat', 2), m2('biceps', 2)), cam: { yaw: 70, pitch: 10 },
      props: [fn(() => [cyl([-0.75, 1.08, -0.33], [0.75, 1.08, -0.33], 0.016, BAR, { held: true, name: 'barre' }),
        cyl([0.68, 0, -0.45], [0.68, 2.1, -0.45], 0.035, FRAME, { name: 'cadre' }), cyl([-0.68, 0, -0.45], [-0.68, 2.1, -0.45], 0.035, FRAME, { name: 'cadre' }), cyl([0.68, 2.1, -0.45], [-0.68, 2.1, -0.45], 0.035, FRAME, { name: 'cadre' }),
        cyl([0.68, 1.08, -0.45], [0.68, 1.08, -0.33], 0.03, FRAME), cyl([-0.68, 1.08, -0.45], [-0.68, 1.08, -0.33], 0.03, FRAME)])],
      poses: {
        a: { float: true, pelvis: [0, 0.33, 0.12], rot: [-75, 0, 0], neck: [10, 0, 0],
          lL: { at: [0.11, 0.10, 0.95], foot: { toe: [0, 0.7, 0.7], up: [0, 0.7, -0.7] } }, lR: { at: [-0.11, 0.10, 0.95], foot: { toe: [0, 0.7, 0.7], up: [0, 0.7, -0.7] } },
          aL: grip([0.40, 1.08, -0.33], [0, 1, 0], [0, 0, 1], { p: [1, 0, 0.2] }), aR: grip([-0.40, 1.08, -0.33], [0, 1, 0], [0, 0, 1], { p: [-1, 0, 0.2] }) },
        b: { float: true, pelvis: [0, 0.56, 0.24], rot: [-57, 0, 0], neck: [4, 0, 0],
          lL: { at: [0.11, 0.10, 0.95], foot: { toe: [0, 0.7, 0.7], up: [0, 0.7, -0.7] } }, lR: { at: [-0.11, 0.10, 0.95], foot: { toe: [0, 0.7, 0.7], up: [0, 0.7, -0.7] } },
          aL: grip([0.40, 1.08, -0.33], [0, 1, 0], [0, 0, 1], { p: [1, -0.6, 0.6] }), aR: grip([-0.40, 1.08, -0.33], [0, 1, 0], [0, 0, 1], { p: [-1, -0.6, 0.6] }) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.4, 1.2]] },

    { id: 'e0017', lib: true, name: 'Traction assistée', en: 'Assisted pull-up', mus: mus(m2('lat', 1), m2('rhomb', 2), m2('trap', 2), m2('deltP', 2)), cam: { yaw: 200, pitch: 8 },
      props: [fn(() => [cyl([0.40, 0, 0.30], [0.40, 2.30, 0.30], 0.035, FRAME, { name: 'cadre' }), cyl([-0.40, 0, 0.30], [-0.40, 2.30, 0.30], 0.035, FRAME, { name: 'cadre' }), cyl([0.40, 2.30, 0.30], [-0.40, 2.30, 0.30], 0.035, FRAME, { name: 'cadre' }),
        cyl([0.40, 2.18, 0.30], [0.30, 2.18, 0.05], 0.03, FRAME, { held: true }), cyl([-0.40, 2.18, 0.30], [-0.30, 2.18, 0.05], 0.03, FRAME, { held: true }), box([0, 0.25, 0.35], [0.50, 0.50, 0.12], PLATE, { name: 'poids' })]),
        fn((C) => { const kL = C.bone('LowerLeg_L'), kR = C.bone('LowerLeg_R'); const k = C.mul(C.add(kL.o, kR.o), 0.5); const y = Math.min(kL.o[1], kR.o[1]) - 0.095;
          return [box([0, y - 0.035, k[2] - 0.17], [0.46, 0.07, 0.42], PAD, { name: 'plateau' }), cyl([0, y - 0.07, k[2] - 0.05], [0, y - 0.07, 0.30], 0.03, FRAME, { name: 'bras' })]; }),
        fn((C) => [cyl(C.add(C.hand('L').grip, C.mul(C.hand('L').across, 0.07)), C.add(C.hand('L').grip, C.mul(C.hand('L').across, -0.07)), 0.017, PLATE, { held: true, name: 'poignée' }),
          cyl(C.add(C.hand('R').grip, C.mul(C.hand('R').across, 0.07)), C.add(C.hand('R').grip, C.mul(C.hand('R').across, -0.07)), 0.017, PLATE, { held: true, name: 'poignée' })])],
      poses: {
        a: { float: true, pelvis: [0, 1.06, -0.02], rot: [-4, 0, 0], neck: [-6, 0, 0],
          lL: { db: [0.08, -1, 0.05], eb: [0.02, 0, -1], foot: 30 }, lR: { db: [-0.08, -1, 0.05], eb: [-0.02, 0, -1], foot: 30 },
          aL: grip([0.30, 2.18, 0.05], [0, 1, 0], [-1, 0, 0], { p: [1, 0, -0.3] }), aR: grip([-0.30, 2.18, 0.05], [0, 1, 0], [1, 0, 0], { p: [-1, 0, -0.3] }) },
        b: { float: true, pelvis: [0, 1.55, -0.06], rot: [-8, 0, 0], neck: [-14, 0, 0],
          lL: { db: [0.08, -1, 0.05], eb: [0.02, 0, -1], foot: 30 }, lR: { db: [-0.08, -1, 0.05], eb: [-0.02, 0, -1], foot: 30 },
          aL: grip([0.30, 2.18, 0.05], [0, 1, 0], [-1, 0, 0], { p: [1, -0.6, -0.5] }), aR: grip([-0.30, 2.18, 0.05], [0, 1, 0], [1, 0, 0], { p: [-1, -0.6, -0.5] }) },
      },
      seq: [['a', 0.4, 1.3], ['b', 0.4, 1.3]] },
    /* ======================= BRAS ======================= */
    { id: 'e0447', lib: true, name: 'Curl à la barre EZ', en: 'Ez barbell curl', mus: mus(m2('biceps', 1), m2('forearm', 2)), cam: { yaw: 35, pitch: 8 },
      props: [barbell({ half: 0.62, plate: 0.17, pin: 0.48, pw: 0.05 })],
      poses: {
        a: { pelvis: [0, 0.92, 0], lL: flatF(0.13, 0.02), lR: flatF(-0.13, 0.02),
          aL: grip([0.18, 0.83, 0.21], [0, -1, 0.2], [0, 0.2, 1], { p: [0.2, 0, -1] }), aR: grip([-0.18, 0.83, 0.21], [0, -1, 0.2], [0, 0.2, 1], { p: [-0.2, 0, -1] }) },
        b: { pelvis: [0, 0.92, 0], lL: flatF(0.13, 0.02), lR: flatF(-0.13, 0.02),
          aL: grip([0.17, 1.30, 0.20], [0, 0.85, -0.5], [0, 0.5, 0.85], { p: [0.2, -1, -0.2] }), aR: grip([-0.17, 1.30, 0.20], [0, 0.85, -0.5], [0, 0.5, 0.85], { p: [-0.2, -1, -0.2] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.1]] },

    { id: 'e0391', lib: true, name: 'Curl assis aux haltères', en: 'Dumbbell seated curl', mus: mus(m2('biceps', 1), m2('forearm', 2)), cam: { yaw: 35, pitch: 8 },
      props: [...dbs(), fn(() => bench(-0.90, 0.15, 0.45))],
      poses: {
        a: { float: true, pelvis: [0, 0.606, -0.02], lL: flatF(0.22, 0.42), lR: flatF(-0.22, 0.42),
          aL: grip([0.28, 0.66, 0.0], [0, -1, 0], [-1, 0, 0], { p: [0.2, 0, -1] }), aR: grip([-0.28, 0.66, 0.0], [0, -1, 0], [1, 0, 0], { p: [-0.2, 0, -1] }) },
        b: { float: true, pelvis: [0, 0.606, -0.02], lL: flatF(0.22, 0.42), lR: flatF(-0.22, 0.42),
          aL: grip([0.24, 1.08, 0.20], [0, 0.85, -0.5], [0, 0.5, 0.85], { p: [0.2, -1, -0.2] }), aR: grip([-0.24, 1.08, 0.20], [0, 0.85, -0.5], [0, 0.5, 0.85], { p: [-0.2, -1, -0.2] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.1]] },

    { id: 'e1677', lib: true, name: 'Curl biceps assis aux haltères', en: 'Dumbbell seated bicep curl', mus: mus(m2('biceps', 1), m2('forearm', 2)), cam: { yaw: 30, pitch: 8 },
      props: [...dbs(), fn(() => UPB())],
      poses: {
        a: { float: true, pelvis: [0, 0.606, -0.02], rot: [-8, 0, 0], neck: [4, 0, 0], lL: flatF(0.24, 0.42), lR: flatF(-0.24, 0.42),
          aL: grip([0.30, 0.68, -0.04], [0, -1, 0], [-1, 0, 0], { p: [0.2, 0, -1] }), aR: grip([-0.30, 0.68, -0.04], [0, -1, 0], [1, 0, 0], { p: [-0.2, 0, -1] }) },
        b: { float: true, pelvis: [0, 0.606, -0.02], rot: [-8, 0, 0], neck: [4, 0, 0], lL: flatF(0.24, 0.42), lR: flatF(-0.24, 0.42),
          aL: grip([0.25, 1.07, 0.14], [0, 0.85, -0.5], [0, 0.5, 0.85], { p: [0.2, -1, -0.2] }), aR: grip([-0.25, 1.07, 0.14], [0, 0.85, -0.5], [0, 0.5, 0.85], { p: [-0.2, -1, -0.2] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.1]] },

    { id: 'e1648', lib: true, name: 'Curl marteau alterné assis aux haltères', en: 'Dumbbell alternate seated hammer curl', mus: mus(m2('biceps', 1), m2('forearm', 2)), cam: { yaw: 30, pitch: 8 },
      props: [...dbs(), fn(() => UPB())],
      poses: (() => { const lo = (s) => grip([s * 0.30, 0.68, -0.04], [0, -1, 0], [-s, 0, 0], { p: [s * 0.2, 0, -1] }); const hi = (s) => grip([s * 0.25, 1.08, 0.12], [0, 0.9, -0.4], [-s, 0, 0], { p: [s * 0.2, -1, -0.2] });
        const base = { float: true, pelvis: [0, 0.606, -0.02], rot: [-8, 0, 0], neck: [4, 0, 0], lL: flatF(0.24, 0.42), lR: flatF(-0.24, 0.42) };
        return { a: Object.assign({}, base, { aL: lo(1), aR: lo(-1) }), b: Object.assign({}, base, { aL: hi(1), aR: lo(-1) }), c: Object.assign({}, base, { aL: lo(1), aR: hi(-1) }) }; })(),
      seq: [['a', 0.2, 1.0], ['b', 0.3, 1.0], ['a', 0.2, 1.0], ['c', 0.3, 1.0]] },

    { id: 'e3547', lib: true, name: 'Curl biceps puis développé épaules assis aux haltères', en: 'Dumbbell seated biceps curl to shoulder press', mus: mus(m2('biceps', 1), m2('delt', 2), m2('forearm', 2)), cam: { yaw: 30, pitch: 8 },
      props: [...dbs(), fn(() => UPB())],
      poses: (() => { const base = { float: true, pelvis: [0, 0.606, -0.02], rot: [-8, 0, 0], neck: [4, 0, 0], lL: flatF(0.24, 0.42), lR: flatF(-0.24, 0.42) };
        return {
          a: Object.assign({}, base, { aL: grip([0.30, 0.68, -0.04], [0, -1, 0], [-1, 0, 0], { p: [0.2, 0, -1] }), aR: grip([-0.30, 0.68, -0.04], [0, -1, 0], [1, 0, 0], { p: [-0.2, 0, -1] }) }),
          m: Object.assign({}, base, { aL: grip([0.25, 1.07, 0.14], [0, 0.85, -0.5], [0, 0.5, 0.85], { p: [0.2, -1, -0.2] }), aR: grip([-0.25, 1.07, 0.14], [0, 0.85, -0.5], [0, 0.5, 0.85], { p: [-0.2, -1, -0.2] }) }),
          r: Object.assign({}, base, { aL: grip([0.34, 1.16, 0.02], [0, 1, 0.05], [0, -0.05, 1], { p: [1, -0.6, 0] }), aR: grip([-0.34, 1.16, 0.02], [0, 1, 0.05], [0, -0.05, 1], { p: [-1, -0.6, 0] }) }),
          b: Object.assign({}, base, { aL: grip([0.17, 1.76, -0.06], [0, 1, 0.05], [0, -0.05, 1], { p: [1, -0.2, 0] }), aR: grip([-0.17, 1.76, -0.06], [0, 1, 0.05], [0, -0.05, 1], { p: [-1, -0.2, 0] }) }) }; })(),
      seq: [['a', 0.2, 0.9], ['m', 0.1, 0.6], ['r', 0, 0.6], ['b', 0.3, 0.9], ['r', 0, 0.6], ['m', 0.1, 0.9]] },

    { id: 'e0315', lib: true, name: 'Curl biceps sur banc incliné aux haltères', en: 'Dumbbell incline biceps curl', mus: mus(m2('biceps', 1), m2('forearm', 2)), cam: { yaw: 60, pitch: 12 },
      props: [...dbs(), fn(() => INB())],
      poses: {
        a: { float: true, pelvis: [0, 0.605, 0.05], rot: [-50, 0, 0], neck: [10, 0, 0], lL: flatF(0.24, 0.50, { p: [0.4, 1, 0.3] }), lR: flatF(-0.24, 0.50, { p: [-0.4, 1, 0.3] }),
          aL: grip([0.26, 0.27, -0.30], [0, -1, 0], [0, 0, 1], { p: [0.2, 0, -1] }), aR: grip([-0.26, 0.27, -0.30], [0, -1, 0], [0, 0, 1], { p: [-0.2, 0, -1] }) },
        b: { float: true, pelvis: [0, 0.605, 0.05], rot: [-50, 0, 0], neck: [10, 0, 0], lL: flatF(0.24, 0.50, { p: [0.4, 1, 0.3] }), lR: flatF(-0.24, 0.50, { p: [-0.4, 1, 0.3] }),
          aL: grip([0.29, 0.84, -0.03], [0, 0.74, 0.67], [0, 0.67, -0.74], { p: [0.1, -1, -0.3] }), aR: grip([-0.29, 0.84, -0.03], [0, 0.74, 0.67], [0, 0.67, -0.74], { p: [-0.1, -1, -0.3] }) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.3, 1.2]] },

    { id: 'e0318', lib: true, name: 'Curl incliné aux haltères', en: 'Dumbbell incline curl', mus: mus(m2('biceps', 1)), cam: { yaw: 60, pitch: 12 },
      props: [...dbs(), fn(() => INB())],
      poses: (() => { const lo = (s) => grip([s * 0.26, 0.27, -0.30], [0, -1, 0], [0, 0, 1], { p: [s * 0.2, 0, -1] }); const hi = (s) => grip([s * 0.29, 0.84, -0.03], [0, 0.74, 0.67], [0, 0.67, -0.74], { p: [s * 0.1, -1, -0.3] });
        const base = { float: true, pelvis: [0, 0.605, 0.05], rot: [-50, 0, 0], neck: [10, 0, 0], lL: flatF(0.24, 0.50, { p: [0.4, 1, 0.3] }), lR: flatF(-0.24, 0.50, { p: [-0.4, 1, 0.3] }) };
        return { a: Object.assign({}, base, { aL: lo(1), aR: lo(-1) }), b: Object.assign({}, base, { aL: lo(1), aR: hi(-1) }), c: Object.assign({}, base, { aL: hi(1), aR: lo(-1) }) }; })(),
      seq: [['a', 0.2, 1.1], ['b', 0.3, 1.1], ['a', 0.2, 1.1], ['c', 0.3, 1.1]] },

    { id: 'e0297', lib: true, name: 'Curl concentré à l’haltère', en: 'Dumbbell concentration curl', side: true, mus: { bicepsR: 1, forearmR: 2 }, cam: { yaw: 20, pitch: 15 },
      props: [dbIn('R'), fn(() => bench(-0.90, 0.12, 0.45))],
      poses: {
        a: { float: true, pelvis: [0, 0.606, -0.04], rot: [38, 0, 0], neck: [-10, 0, 0], lL: flatF(0.36, 0.40, { p: [1, 0.3, 0.6] }), lR: flatF(-0.36, 0.40, { p: [-1, 0.3, 0.6] }),
          aL: { grab: { bone: 'UpperLeg_L', h: 0.80, ang: 10, f: 1, tilt: 0 }, p: [0.8, 0, -0.5] }, aR: grip([-0.07, 0.30, 0.40], [0.1, -1, 0], [1, 0, 0.3], { p: [-1, -0.6, 0] }) },
        b: { float: true, pelvis: [0, 0.606, -0.04], rot: [38, 0, 0], neck: [-10, 0, 0], lL: flatF(0.36, 0.40, { p: [1, 0.3, 0.6] }), lR: flatF(-0.36, 0.40, { p: [-1, 0.3, 0.6] }),
          aL: { grab: { bone: 'UpperLeg_L', h: 0.80, ang: 10, f: 1, tilt: 0 }, p: [0.8, 0, -0.5] }, aR: grip([-0.06, 0.78, 0.42], [0.25, 0.9, -0.2], [0.5, 0.2, -1], { p: [-1, -0.6, 0] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.1]] },

    { id: 'e1749', lib: true, name: 'Développé français debout à la barre EZ', en: 'Ez bar standing french press', mus: mus(m2('triceps', 1)), cam: { yaw: 50, pitch: 8 },
      props: [barbell({ half: 0.62, plate: 0.17, pin: 0.48, pw: 0.05 })],
      poses: {
        a: { pelvis: [0, 0.92, 0], lL: flatF(0.14, 0.02), lR: flatF(-0.14, 0.02),
          aL: grip([0.10, 2.06, 0.02], [0, 1, 0], [0, 0, 1], { p: [1, 0, 0.2] }), aR: grip([-0.10, 2.06, 0.02], [0, 1, 0], [0, 0, 1], { p: [-1, 0, 0.2] }) },
        b: { pelvis: [0, 0.92, 0], lL: flatF(0.14, 0.02), lR: flatF(-0.14, 0.02),
          aL: grip([0.10, 1.56, -0.22], [0, -0.55, -0.83], [0, 0.83, -0.55], { p: [0.3, 1, 0.3] }), aR: grip([-0.10, 1.56, -0.22], [0, -0.55, -0.83], [0, 0.83, -0.55], { p: [-0.3, 1, 0.3] }) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.3, 1.2]] },

    { id: 'e1731', lib: true, name: 'Développé prise serrée aux haltères', en: 'Dumbbell close grip press', mus: mus(m2('triceps', 1)), cam: { yaw: 55, pitch: 22 },
      props: [...dbs(), fn(() => bench(-0.75, 0.25, 0.44))],
      poses: {
        a: { float: true, pelvis: [0, 0.595, 0.05], rot: [-90, 0, 0], neck: [8, 0, 0], lL: flatF(0.25, 0.50, { p: [0.5, 1, 0.2] }), lR: flatF(-0.25, 0.50, { p: [-0.5, 1, 0.2] }),
          aL: grip([0.065, 1.22, -0.40], [0, 1, 0], [-1, 0, 0], { p: [1, -0.3, 0.6] }), aR: grip([-0.065, 1.22, -0.40], [0, 1, 0], [1, 0, 0], { p: [-1, -0.3, 0.6] }) },
        b: { float: true, pelvis: [0, 0.595, 0.05], rot: [-90, 0, 0], neck: [8, 0, 0], lL: flatF(0.25, 0.50, { p: [0.5, 1, 0.2] }), lR: flatF(-0.25, 0.50, { p: [-0.5, 1, 0.2] }),
          aL: grip([0.07, 0.86, -0.30], [0, 1, 0.1], [-1, 0, 0], { p: [0.5, -0.6, 1] }), aR: grip([-0.07, 0.86, -0.30], [0, 1, 0.1], [1, 0, 0], { p: [-0.5, -0.6, 1] }) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.3, 1.2]] },

    { id: 'e1399', lib: true, name: 'Dips au sol (sur banc)', en: 'Bench dip on floor', mus: mus(m2('triceps', 1), m2('pec', 2), m2('lat', 2), m2('trap', 2)), cam: { yaw: 105, pitch: 10 },
      props: [fn(() => [box([0, 0.415, -0.38], [1.20, 0.07, 0.30], PAD, { name: 'banc' }), box([0.48, 0.19, -0.38], [0.05, 0.38, 0.24], FRAME), box([-0.48, 0.19, -0.38], [0.05, 0.38, 0.24], FRAME)])],
      poses: {
        a: { float: true, pelvis: [0, 0.56, -0.05], rot: [2, 0, 0], neck: [-4, 0, 0],
          lL: { at: [0.11, 0.08, 0.85], foot: { toe: [0, 0.75, 0.66], up: [0, 0.66, -0.75] } }, lR: { at: [-0.11, 0.08, 0.85], foot: { toe: [0, 0.75, 0.66], up: [0, 0.66, -0.75] } },
          aL: { at: [0.21, 0.47, -0.27], hand: 'flat', hdir: [0, 0, 1], p: [0.2, 0, -1] }, aR: { at: [-0.21, 0.47, -0.27], hand: 'flat', hdir: [0, 0, 1], p: [-0.2, 0, -1] } },
        b: { float: true, pelvis: [0, 0.30, -0.01], rot: [6, 0, 0], neck: [-4, 0, 0],
          lL: { at: [0.11, 0.08, 0.85], foot: { toe: [0, 0.75, 0.66], up: [0, 0.66, -0.75] } }, lR: { at: [-0.11, 0.08, 0.85], foot: { toe: [0, 0.75, 0.66], up: [0, 0.66, -0.75] } },
          aL: { at: [0.21, 0.47, -0.27], hand: 'flat', hdir: [0, 0, 1], p: [0.2, 0.3, -1] }, aR: { at: [-0.21, 0.47, -0.27], hand: 'flat', hdir: [0, 0, 1], p: [-0.2, 0.3, -1] } },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.3, 1.2]] },

    { id: 'e0814', lib: true, name: 'Dips triceps', en: 'Triceps dip', mus: mus(m2('triceps', 1), m2('pec', 2), m2('delt', 2)), cam: { yaw: 125, pitch: 8 },
      props: [DIPS()],
      poses: {
        a: { float: true, pelvis: [0, 1.36, -0.02], rot: [4, 0, 0], neck: [-4, 0, 0],
          lL: { db: [0.05, -1, 0.15], eb: [0.02, -0.5, -0.85], foot: 30 }, lR: { db: [-0.05, -1, 0.15], eb: [-0.02, -0.5, -0.85], foot: 30 },
          aL: grip([0.27, 1.25, 0.02], [0, -1, 0], [-1, 0, 0], { p: [0.2, 0, -1] }), aR: grip([-0.27, 1.25, 0.02], [0, -1, 0], [1, 0, 0], { p: [-0.2, 0, -1] }) },
        b: { float: true, pelvis: [0, 1.06, -0.06], rot: [12, 0, 0], neck: [-6, 0, 0],
          lL: { db: [0.05, -1, 0.15], eb: [0.02, -0.5, -0.85], foot: 30 }, lR: { db: [-0.05, -1, 0.15], eb: [-0.02, -0.5, -0.85], foot: 30 },
          aL: grip([0.27, 1.25, 0.02], [0, -1, 0], [-1, 0, 0], { p: [0.2, 0.4, -1] }), aR: grip([-0.27, 1.25, 0.02], [0, -1, 0], [1, 0, 0], { p: [-0.2, 0.4, -1] }) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.3, 1.2]] },

    { id: 'e1755', lib: true, name: 'Dips triceps lestés', en: 'Weighted tricep dips', mus: mus(m2('triceps', 1), m2('pec', 2), m2('delt', 2)), cam: { yaw: 125, pitch: 8 },
      props: [DIPS(), fn((C) => { const h = C.bone('Hips'); const pL = h.at([0.15, 0.02, 0.10]), pR = h.at([-0.15, 0.02, 0.10]); const kz = Math.max(C.J ? 0 : 0, 0);
        const c = [0, h.o[1] - 0.50, h.o[2] + 0.24]; const top = [0, c[1] + 0.17, c[2]];
        return [cyl(pL, top, 0.006, CABLE, { soft: true }), cyl(pR, top, 0.006, CABLE, { soft: true }), cyl(C.sub(c, [0, 0, 0.02]), C.add(c, [0, 0, 0.02]), 0.17, PLATE, { name: 'disque' }), cyl(pL, pR, 0.02, PLATE, { soft: true })]; })],
      poses: {
        a: { float: true, pelvis: [0, 1.36, -0.02], rot: [4, 0, 0], neck: [-4, 0, 0],
          lL: { db: [0.05, -1, 0.0], eb: [0.02, -0.5, -0.85], foot: 30 }, lR: { db: [-0.05, -1, 0.0], eb: [-0.02, -0.5, -0.85], foot: 30 },
          aL: grip([0.27, 1.25, 0.02], [0, -1, 0], [-1, 0, 0], { p: [0.2, 0, -1] }), aR: grip([-0.27, 1.25, 0.02], [0, -1, 0], [1, 0, 0], { p: [-0.2, 0, -1] }) },
        b: { float: true, pelvis: [0, 1.06, -0.06], rot: [12, 0, 0], neck: [-6, 0, 0],
          lL: { db: [0.05, -1, 0.0], eb: [0.02, -0.5, -0.85], foot: 30 }, lR: { db: [-0.05, -1, 0.0], eb: [-0.02, -0.5, -0.85], foot: 30 },
          aL: grip([0.27, 1.25, 0.02], [0, -1, 0], [-1, 0, 0], { p: [0.2, 0.4, -1] }), aR: grip([-0.27, 1.25, 0.02], [0, -1, 0], [1, 0, 0], { p: [-0.2, 0.4, -1] }) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.3, 1.2]] },

    { id: 'e0200', lib: true, name: 'Extension triceps à la corde, poulie haute', en: 'Cable pushdown (with rope attachment)', mus: mus(m2('triceps', 1)), cam: { yaw: 70, pitch: 8 },
      props: [tower(0, 0.70, 2.3, { w: 0.6 }), fn((C) => { const a = C.hand('L'), b = C.hand('R'); const m = C.mul(C.add(a.grip, b.grip), 0.5); const j = C.add(m, [0, 0.16, 0.03]); const RO = [0.42, 0.38, 0.32];
        return [cyl(C.add(a.grip, [0, -0.06, 0]), j, 0.012, RO, { held: true, name: 'corde' }), cyl(C.add(b.grip, [0, -0.06, 0]), j, 0.012, RO, { held: true, name: 'corde' }),
          sph(C.add(a.grip, [0, -0.07, 0]), 0.02, RO, { held: true }), sph(C.add(b.grip, [0, -0.07, 0]), 0.02, RO, { held: true }), cyl(j, [0, 2.15, 0.62], 0.006, CABLE, { soft: true }), sph([0, 2.15, 0.62], 0.04, FRAME, { name: 'poulie' })]; })],
      poses: {
        a: { pelvis: [0, 0.91, -0.02], rot: [8, 0, 0], neck: [-6, 0, 0], lL: flatF(0.14, 0.0), lR: flatF(-0.14, 0.0),
          aL: grip([0.07, 1.20, 0.28], [-0.35, 0.3, 0.88], [-1, 0, 0.4], { p: [0.3, -0.3, -1] }), aR: grip([-0.07, 1.20, 0.28], [0.35, 0.3, 0.88], [1, 0, 0.4], { p: [-0.3, -0.3, -1] }) },
        b: { pelvis: [0, 0.91, -0.02], rot: [8, 0, 0], neck: [-6, 0, 0], lL: flatF(0.14, 0.0), lR: flatF(-0.14, 0.0),
          aL: grip([0.17, 0.78, 0.22], [0.1, -1, 0.15], [-1, 0, 0], { p: [0.2, 0, -1] }), aR: grip([-0.17, 0.78, 0.22], [-0.1, -1, 0.15], [1, 0, 0], { p: [-0.2, 0, -1] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.1]] },

    { id: 'e0247', lib: true, name: 'Curl poignets à la poulie', en: 'Cable wrist curl', mus: mus(m2('forearm', 1)), cam: { yaw: 50, pitch: 15 },
      props: [fn(() => bench(-0.90, 0.12, 0.45)), tower(0, 1.30, 2.0, { w: 0.6 }), fn((C) => { const a = C.hand('L').grip, b = C.hand('R').grip; const m = C.mul(C.add(a, b), 0.5); const u = C.norm(C.sub(a, b));
        return [cyl(C.add(m, C.mul(u, -0.28)), C.add(m, C.mul(u, 0.28)), 0.014, BAR, { held: true, name: 'barre' }), cyl(m, [0, 0.15, 1.20], 0.006, CABLE, { soft: true }), sph([0, 0.15, 1.20], 0.04, FRAME, { name: 'poulie' })]; })],
      poses: {
        a: { float: true, pelvis: [0, 0.606, -0.04], rot: [34, 0, 0], neck: [-14, 0, 0], lL: flatF(0.16, 0.45), lR: flatF(-0.16, 0.45),
          aL: { at: [0.15, 0.68, 0.52], hand: { d: [0, -0.6, 0.8], n: [0, 0.8, 0.6] }, p: [0.3, -1, 0] }, aR: { at: [-0.15, 0.68, 0.52], hand: { d: [0, -0.6, 0.8], n: [0, 0.8, 0.6] }, p: [-0.3, -1, 0] } },
        b: { float: true, pelvis: [0, 0.606, -0.04], rot: [34, 0, 0], neck: [-14, 0, 0], lL: flatF(0.16, 0.45), lR: flatF(-0.16, 0.45),
          aL: { at: [0.15, 0.68, 0.52], hand: { d: [0, 0.6, 0.8], n: [0, 0.8, -0.6] }, p: [0.3, -1, 0] }, aR: { at: [-0.15, 0.68, 0.52], hand: { d: [0, 0.6, 0.8], n: [0, 0.8, -0.6] }, p: [-0.3, -1, 0] } },
      },
      seq: [['a', 0.3, 1.0], ['b', 0.3, 1.0]] },
  ]);
})();
