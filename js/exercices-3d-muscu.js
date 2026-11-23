'use strict';
/* =====================================================================
   WorkLog 0.7.4 (revu en 0.7.6) : mannequin 3D des exercices de musculation mis en favoris.
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
  const grip = (G, d, n, o) => { d = norm(d); n = ortho(n, d); return Object.assign({ at: sub(sub(G, mul(d, 0.075)), mul(n, 0.028)), hand: { d, n }, close: 1 }, o); };
  /* Idem dans le repère du thorax (l'objet suit le buste : barre sur le dos, poignée contre la poitrine…). */
  const gripB = (G, d, n, o) => { d = norm(d); n = ortho(n, d); return Object.assign({ atb: sub(sub(G, mul(d, 0.075)), mul(n, 0.028)), hand: { db: d, nb: n }, close: 1 }, o); };


  /* Main au bout du bras (écartés, élévations) : doigts dans l'axe épaule → main, paume vers « pv ». sh : épaule approximative. */
  const SH = (s, y, z) => [s * 0.205, y == null ? 1.43 : y, z == null ? -0.01 : z];
  const reach = (sh, G, pv, o) => grip(G, sub(G, sh), pv, o);

  /* Curl (0.7.6) : bras fixe le long du buste, seul l'avant-bras tourne autour du coude ; tout dans le repère du thorax.
     s : 1 gauche, -1 droite ; th : flexion du coude en degrés ; o.u : direction du bras (repère du thorax, côté gauche) ;
     o.palm : 'sup' (paume vers le biceps, curl classique), 'neutre' (marteau) ou 'dos' ; o.carry : angle de port. À utiliser avec interp: 'fk'.
     Sert aussi aux extensions des triceps (bras vers le haut). */
  const CSH = [0.205, 0.212, -0.005];                // épaule dans le repère du thorax
  const curlB = (s, th, o) => {
    o = o || {}; const u = norm(o.u ? [s * o.u[0], o.u[1], o.u[2]] : [s * 0.03, -1, 0.08]);
    const ud = norm([0, u[1], u[2]]);               // l'avant-bras plie dans le plan avant-arrière, même bras un peu écarté
    const w = norm(cross(ud, [1, 0, 0]));           // sens de la flexion (vers l'avant quand le bras pend)
    const t = th * D2R;   // angle de port (carry) : avant-bras un peu en dehors quand le bras est tendu
    const fAt = (tt) => norm(add(add(mul(ud, Math.cos(tt)), mul(w, Math.sin(tt))), [s * (o.carry == null ? 0.3 : o.carry) * Math.max(0, Math.cos(tt)), 0, 0]));
    const f = fAt(t);
        const fl = norm(sub(fAt(t + 0.05), f));   // sens où va l'avant-bras quand le coude plie
    const n = o.palm === 'neutre' ? [-s, 0, 0] : o.palm === 'dos' ? mul(fl, -1) : fl;   // supination : la paume regarde là où va l'avant-bras ; 'dos' : à l'opposé (extensions au-dessus de la tête)
    return Object.assign({ db: u, eb: f, hand: { db: f, nb: ortho(n, f) }, close: 1 }, o.x || {});   // directions imposées : pas de cinématique inverse, le bras ne bouge pas
  };

  /* Mains derrière la tête (doigts sur l'arrière du crâne, coudes ouverts) : repère du thorax. */
  const HBH = (s, o) => Object.assign({ atb: [s * 0.12, 0.40, -0.09], hand: { db: [-s * 0.55, 0.25, -0.8], nb: [-s * 0.75, 0, 0.6] }, pb: [s, 0.3, -0.2] }, o);

  /* ---------- matériel ---------- */
  const PAD = [0.27, 0.26, 0.30], FRAME = [0.80, 0.80, 0.83], BAR = [0.56, 0.56, 0.62], PLATE = [0.22, 0.22, 0.25], CABLE = [0.14, 0.14, 0.16], BALL = [0.88, 0.88, 0.92], BAND = [0.25, 0.64, 0.56], KB = [0.24, 0.24, 0.27];
  const fn = (f, o) => Object.assign({ type: 'fn', f }, o || {});
  /* Matériel en maillage (models/mat/<m>.bin, modèles 3D d'auteurs crédités dans CREDITS.txt) : c = origine, x/y/z = axes, s = échelle. */
  const MESH = (m, c, o) => Object.assign({ k: 'mesh', m, c }, o);
  const yawAx = (deg) => { const a = deg * Math.PI / 180; return { x: [Math.cos(a), 0, -Math.sin(a)], y: [0, 1, 0], z: [Math.sin(a), 0, Math.cos(a)] }; };
  const hid = (q) => Object.assign(q, { hide: true });   // volume invisible : sert aux contrôles (contact, collisions)
  /* Pièce mobile d'une machine (bras de levier, rouleau, plateau) qui tourne d'un angle `ang` (radians) autour d'un axe passant par `piv`
     (dans le repère du modèle) : axe 'x' (horizontal, la pièce monte vers +y quand ang > 0) ou 'y' (vertical). c : position du modèle. */
  const HACK0 = 0.715;   // position (le long des rails) du bassin quand le chariot du hack squat est à sa place d'origine
  const ROTM = (m, part, c, piv, ax, ang, o) => {
    const cs = Math.cos(ang), sn = Math.sin(ang);
    const X = ax === 'x' ? [1, 0, 0] : [cs, 0, -sn], Y = ax === 'x' ? [0, cs, -sn] : [0, 1, 0], Z = ax === 'x' ? [0, sn, cs] : [sn, 0, cs];
    const Rp = add(add(mul(X, piv[0]), mul(Y, piv[1])), mul(Z, piv[2])); const k = (o && o.s) || 1;
    return MESH(m, add(c, mul(sub(piv, Rp), k)), Object.assign({ part, x: X, y: Y, z: Z }, o, { s: k }));
  };
  /* Angle d'un point autour d'un axe x passant par P (dans le plan y-z), mesuré depuis +z vers +y. */
  const angX = (p, P) => Math.atan2(p[1] - P[1], p[2] - P[2]);
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
      const pin = o.pin || 0.80, pw = o.pw || 0.07; const p0 = add(m, mul(u, s * pin));
      out.push(hid(cyl(p0, add(m, mul(u, s * (pin + pw))), pr, PLATE, { name: 'disque' })));
      const ax = mul(u, s); const ay = norm(sub([0, 1, 0], mul(ax, dot([0, 1, 0], ax)))); 
      out.push(MESH('disques', add(m, mul(u, s * (pin + pw / 2))), { x: ax, y: ay, z: cross(ax, ay), s: [pw / 0.176, pr / 0.132, pr / 0.132], tint: [0.34, 0.34, 0.37] }));
    }
    return out;
  }, o && o.static ? { nofit: false } : null);
  /* Haltère dans une main : manche en travers de la paume. */
  const dbIn = (sd, o) => fn((C) => {
    o = o || {}; const h = C.hand(sd); const k = (o.r || 0.065) / 0.097;   // haltère du pack « Gym Tools » : têtes octogonales
    const hw = 0.088 * k, r = 0.097 * k, end = 0.167 * k;
    return [hid(cyl(add(h.grip, mul(h.across, -end)), add(h.grip, mul(h.across, end)), 0.016, BAR, { held: true, name: 'haltère' })),
      hid(cyl(add(h.grip, mul(h.across, 0.059 * k / 0.67)), add(h.grip, mul(h.across, hw)), r, PLATE, { held: true, name: 'haltère' })),
      hid(cyl(add(h.grip, mul(h.across, -hw)), add(h.grip, mul(h.across, -0.059 * k / 0.67)), r, PLATE, { held: true, name: 'haltère' })),
      MESH('haltere', h.grip, { x: h.across, y: h.fing, z: cross(h.across, h.fing), s: k })];
  });
  const dbs = (o) => [dbIn('L', o), dbIn('R', o)];
  /* Kettlebell dans une main : la boule pend sous la poignée, ou repose sur le dos de l'avant-bras quand la main est en l'air. */
  const kbIn = (sd) => fn((C) => {
    const h = C.hand(sd); const k = Math.min(1, Math.max(0, (h.fing[1] + 0.2) / 0.6));
    const dir = C.norm(C.add(C.mul([0, -1, 0], 1 - k), C.mul(C.add(C.mul(h.palm, -1), C.mul(h.fing, -0.25)), k)));
    const y = mul(dir, -1); const x = norm(sub(h.across, mul(y, dot(h.across, y)))); const z = cross(x, y);   // modèle « Kettlebell » (plaggy) : poignée en haut
    return [hid(cyl(C.add(h.grip, C.mul(h.across, -0.065)), C.add(h.grip, C.mul(h.across, 0.065)), 0.013, KB, { held: true, name: 'kettlebell' })),
      hid(sph(C.add(h.grip, C.mul(dir, 0.137)), 0.10, KB, { held: true, name: 'kettlebell' })),
      MESH('kettlebell', sub(h.grip, add(mul(y, 0.212), mul(z, 0.0075))), { x, y, z, s: [1, 1, 1.5], held: true })];
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
  const tower = (x, z, h) => fn(() => {
    const d = Math.abs(x) >= Math.abs(z) ? [-Math.sign(x), 0, 0] : [0, 0, -Math.sign(z) || -1];   // de la colonne vers le pratiquant
    const ax = cross([0, 1, 0], d); const c = [x, 0, z]; const sy = (h || 2.2) / 2.2;
    return [MESH('colonne', c, { x: ax, y: [0, 1, 0], z: d, s: [1, sy, 1] }),
      hid(box(add(c, add(mul(d, -0.17), [0, 1.1 * sy, 0])), [0.70, 2.2 * sy, 0.34], FRAME, { name: 'poulie', x: ax, y: [0, 1, 0], z: d }))];
  });
  /* Vis-à-vis (double poulie) : faces intérieures des colonnes en x = ±xi, à la profondeur z. */
  const crossover = (xi, z) => fn(() => [MESH('vis_a_vis', [0, 0, z], { s: [xi / 1.05, 1, 1] }),
    hid(box([xi + 0.17, 1.1, z], [0.34, 2.2, 0.70], FRAME, { name: 'poulie' })), hid(box([-xi - 0.17, 1.1, z], [0.34, 2.2, 0.70], FRAME, { name: 'poulie' }))]);
  /* Banc plat : plateau (haut à la hauteur h), de z0 à z1, et ses pieds. */
  const bench = (z0, z1, h, o) => { o = o || {}; const x = o.x || 0, w = o.w || 0.27, t = 0.07; return [
    hid(box([x, h - t / 2, (z0 + z1) / 2], [w, t, z1 - z0], PAD, { name: 'banc' })),
    hid(box([x, (h - t) / 2, z0 + 0.08], [w * 0.8, h - t, 0.05], FRAME, { name: 'banc' })), hid(box([x, (h - t) / 2, z1 - 0.08], [w * 0.8, h - t, 0.05], FRAME, { name: 'banc' })),
    MESH('banc_plat', [x, 0, (z0 + z1) / 2], { s: [(w + 0.02) / 0.415, (h - 0.008) / 0.438, (z1 - z0) / 1.402] })]; };   // mousse un peu enfoncée sous le corps

  /* Banc réglable (modèle « Training Bench, Incline Bench », XaaH, CC BY 4.0) : dossier tourné autour de sa charnière
     jusqu'à `ang` degrés au-dessus de l'horizontale (39° dans le modèle). o.c : position du banc, o.yaw : orientation, o.sy : hauteur. */
  const ADJ = (ang, o) => {
    o = o || {}; const c = o.c || [0, 0, 0]; const A = yawAx(o.yaw || 0); const sy = o.sy || 1; const H = [0, 0.44, 0.06];
    const th = (ang - 39) * Math.PI / 180, ct = Math.cos(th), st = Math.sin(th);
    const M = (v) => add(add(mul(A.x, v[0]), mul(A.y, v[1] * sy)), mul(A.z, v[2]));   // repère du banc -> monde (échelle en hauteur)
    const RH = [0, H[1] * ct - H[2] * st, H[1] * st + H[2] * ct];
    const part = (n) => MESH('adjbench', c, { part: n, x: A.x, y: A.y, z: A.z, s: [1, sy, 1] });
    return [part('frame'), ...(ang < 50 ? [part('support')] : []), ...(o.noSeat ? [] : [part('siege')]), ...(o.noSeat || o.noRoll ? [] : [part('rouleaux')]),
      MESH('adjbench', add(c, M(sub(H, RH))), { part: 'dossier', x: M([1, 0, 0]), y: M([0, ct, st]), z: M([0, -st, ct]), s: 1 })];
  };
  /* Banc droit à dossier (assis) et banc incliné (dossier à 50°). */
  const UPB = () => [...ADJ(80, { c: [0, 0, -0.27], sy: 1.075, noRoll: true }),   // assis droit : sans les boudins de pieds (ils gênent les tibias)
    ...[box([0, 0.42, -0.03], [0.34, 0.07, 0.34], PAD, { name: 'banc' }), tbox([0, 0.88, -0.27], [0.32, 0.72, 0.07], -10, PAD, { name: 'dossier' }), box([0, 0.19, 0.0], [0.10, 0.38, 0.10], FRAME)].map(hid)];
  /* Banc réglable à 55° (curls inclinés, comme sur les images de référence) */
  const INB55 = () => [...ADJ(55, { c: [0, 0.015, -0.155], sy: 1.083, noRoll: true }), hid(box([0, 0.42, 0.08], [0.32, 0.07, 0.34], PAD, { name: 'siège' }))];
  const INB = () => [...ADJ(40, { c: [0, 0.015, -0.155], sy: 1.083, noRoll: true }), ...[box([0, 0.42, 0.08], [0.32, 0.07, 0.34], PAD, { name: 'siège' }), tbox([0, 0.748, -0.411], [0.30, 0.80, 0.07], -50, PAD, { name: 'dossier' }), box([0, 0.20, -0.1], [0.10, 0.40, 0.10], FRAME)].map(hid)];
  /* Station de dips : deux barres parallèles à 1,25 m. */
  /* Station traction / dips (pack « Gym Tools ») tournée : accoudoirs vers l'avant, dossier derrière le pratiquant. */
  const DIPS = () => fn(() => { const out = [MESH('station', [0, 0, -0.31], Object.assign({ held: true }, yawAx(180)))]; for (const s of [1, -1]) out.push(hid(cyl([s * 0.27, 1.25, -0.30], [s * 0.27, 1.25, 0.40], 0.02, BAR, { held: true, name: 'barre' }))); return out; });

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
          aL: grip([0.17, 0.70, 0.235], [0, -1, 0], [0, 0, -1], { p: [0.3, 0, -1] }), aR: grip([-0.17, 0.70, 0.235], [0, -1, 0], [0, 0, -1], { p: [-0.3, 0, -1] }) },
        b: { pelvis: [0, 0.79, -0.20], rot: [66, 0, 0], neck: [-28, 0, 0], lL: flatF(0.12, 0.02, { p: [0, 0, 1] }), lR: flatF(-0.12, 0.02, { p: [0, 0, 1] }),
          aL: grip([0.17, 0.34, 0.27], [0, -1, 0], [0, 0, -1], { p: [0.3, 0, -1] }), aR: grip([-0.17, 0.34, 0.27], [0, -1, 0], [0, 0, -1], { p: [-0.3, 0, -1] }) },
      },
      seq: [['a', 0.5, 1.5], ['b', 0.3, 1.4]] },

    /* ======================= DOS ======================= */
    { id: 'e0652', lib: true, name: 'Traction', en: 'Pull-up', mus: mus(m2('lat', 1), m2('rhomb', 2), m2('biceps', 2)), cam: { yaw: 200, pitch: 6 },
      props: [fn(() => [hid(cyl([-0.75, 2.25, 0], [0.75, 2.25, 0], 0.016, BAR, { held: true, name: 'barre' })), MESH('station', [0, 0, 0.45], { s: [0.89, 1.023, 1], held: true })])],
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
      props: [fn(() => [MESH('hack', [0, 0, 0], { part: 'frame' })]),
        /* Modèle « Movement Hack Machine » : le chariot (dossier, épaulières, poignées) glisse sur les rails à 45° et suit le bassin. */
        fn((C) => { const t = (C.J.pelvis[1] - C.J.pelvis[2]) * Math.SQRT1_2 - HACK0; return [MESH('hack', [0, t * Math.SQRT1_2, -t * Math.SQRT1_2], { part: 'chariot', held: true })]; })],
      poses: {
        a: { float: true, pelvis: [0, 0.951, -0.011], rot: [-45, 0, 0], neck: [10, 0, 0], lL: { at: [0.16, 0.429, 0.675], p: [0.25, 0.7, 0.7], foot: { toe: [0.25, 0.69, 0.69], up: [0, 0.707, -0.707] } }, lR: { at: [-0.16, 0.429, 0.675], p: [-0.25, 0.7, 0.7], foot: { toe: [-0.25, 0.69, 0.69], up: [0, 0.707, -0.707] } }, aL: grip([0.28, 1.503, -0.343], [0, 0.707, -0.707], [-1, 0, 0], { p: [1, -0.5, 0.3] }), aR: grip([-0.28, 1.503, -0.343], [0, 0.707, -0.707], [1, 0, 0], { p: [-1, -0.5, 0.3] }) },
        b: { float: true, pelvis: [0, 0.633, 0.308], rot: [-45, 0, 0], neck: [10, 0, 0], lL: { at: [0.16, 0.429, 0.675], p: [0.4, 0.7, 0.7], foot: { toe: [0.25, 0.69, 0.69], up: [0, 0.707, -0.707] } }, lR: { at: [-0.16, 0.429, 0.675], p: [-0.4, 0.7, 0.7], foot: { toe: [-0.25, 0.69, 0.69], up: [0, 0.707, -0.707] } }, aL: grip([0.28, 1.184, -0.025], [0, 0.707, -0.707], [-1, 0, 0], { p: [1, -0.5, 0.3] }), aR: grip([-0.28, 1.184, -0.025], [0, 0.707, -0.707], [1, 0, 0], { p: [-1, -0.5, 0.3] }) },
      },
      seq: [['a', 0.5, 1.4], ['b', 0.3, 1.3]] },

    { id: 'e0585', lib: true, name: 'Leg extension à la machine', en: 'Lever leg extension', mus: mus(m2('quad', 1)), cam: { yaw: 50, pitch: 10 },
      props: [fn(() => [MESH('legext', [-0.225, 0, -0.03], { part: 'frame', held: true }), MESH('legext', [-0.225, 0.10, -0.03], { part: 'cuisses' })]),
        /* Machine assise (« Seated Leg Curl Trainer », Gerhald, CC BY 4.0) utilisée en leg extension : le levier et son rouleau tournent
           autour de l'axe des genoux (y 0,598, z 0,45 dans le modèle) et restent devant les tibias. */
        fn((C) => { const A = C.mul(C.add(C.bone('LowerLeg_L').at([0, -0.33, 0.085]), C.bone('LowerLeg_R').at([0, -0.33, 0.085])), 0.5);
          const a = Math.atan2(A[1] - 0.598, A[2] - 0.42) - Math.atan2(-0.118, 0.17);
          return [ROTM('legext', 'levier', [-0.225, 0, -0.03], [0, 0.598, 0.45], 'x', a, { nocheck: true })]; })],
      poses: {
        a: { float: true, pelvis: [0, 0.69, -0.08], rot: [-10, 0, 0], neck: [6, 0, 0], lL: { d: [0.03, -0.04, 1], e: [0, -1, 0.12], foot: 0 }, lR: { d: [-0.03, -0.04, 1], e: [0, -1, 0.12], foot: 0 },
          aL: grip([0.30, 0.595, -0.17], [-0.2, -0.98, 0], [-0.98, 0.2, 0], { p: [1, 0.2, -0.6] }), aR: grip([-0.30, 0.595, -0.17], [0.2, -0.98, 0], [0.98, 0.2, 0], { p: [-1, 0.2, -0.6] }) },
        b: { float: true, pelvis: [0, 0.69, -0.08], rot: [-10, 0, 0], neck: [6, 0, 0], lL: { d: [0.03, -0.04, 1], e: [0, 0.10, 1], foot: -5 }, lR: { d: [-0.03, -0.04, 1], e: [0, 0.10, 1], foot: -5 },
          aL: grip([0.30, 0.595, -0.17], [-0.2, -0.98, 0], [-0.98, 0.2, 0], { p: [1, 0.2, -0.6] }), aR: grip([-0.30, 0.595, -0.17], [0.2, -0.98, 0], [0.98, 0.2, 0], { p: [-1, 0.2, -0.6] }) },
      },
      seq: [['a', 0.4, 1.1], ['b', 0.4, 1.2]] },

    { id: 'e0598', lib: true, name: 'Adduction de hanche assis à la machine', en: 'Lever seated hip adduction', mus: mus(m2('add', 1)), cam: { yaw: 55, pitch: 22 },
      props: [fn(() => [MESH('adduct', [0, 0, 0], { part: 'frame', held: true })]),
        /* Modèle « Movement EDGE Abdutor/Adutor » : chaque bras (coussin + repose-pieds) tourne autour d'un axe vertical sous la hanche. */
        fn((C) => { const out = []; for (const [sd, s] of [['L', 1], ['R', -1]]) { const K = C.J['ankle' + sd]; const P = [s * 0.126, 0, -0.397];   // les pieds sont posés sur les barres du bras
          const a = Math.atan2(K[0] - P[0], K[2] - P[2]) - Math.atan2(s * 0.014, 0.517); out.push(ROTM('adduct', 'pad' + sd, [0, 0, 0], P, 'y', a)); } return out; })],
      poses: {
        a: { float: true, pelvis: [0, 0.66, -0.40], rot: [-22, 0, 0], neck: [14, 0, 0], lL: { at: [0.412, 0.310, 0.034], p: [0.795, 0.500, 0.329], foot: { toe: [0.519, -0.200, 0.831], up: [0, 1, 0.2] } }, lR: { at: [-0.412, 0.310, 0.034], p: [-0.795, 0.500, 0.329], foot: { toe: [-0.519, -0.200, 0.831], up: [0, 1, 0.2] } },
          aL: grip([0.255, 0.45, -0.46], [0.1, -0.91, 0.39], [-0.99, -0.09, 0.04], { p: [1, 0.2, -0.6] }), aR: grip([-0.255, 0.45, -0.46], [-0.1, -0.91, 0.39], [0.99, -0.09, 0.04], { p: [-1, 0.2, -0.6] }) },
        b: { float: true, pelvis: [0, 0.66, -0.40], rot: [-22, 0, 0], neck: [14, 0, 0], lL: { at: [0.158, 0.310, 0.119], p: [0.524, 0.500, 0.682], foot: { toe: [0.034, -0.200, 0.979], up: [0, 1, 0.2] } }, lR: { at: [-0.158, 0.310, 0.119], p: [-0.524, 0.500, 0.682], foot: { toe: [-0.034, -0.200, 0.979], up: [0, 1, 0.2] } },
          aL: grip([0.255, 0.45, -0.46], [0.1, -0.91, 0.39], [-0.99, -0.09, 0.04], { p: [1, 0.2, -0.6] }), aR: grip([-0.255, 0.45, -0.46], [-0.1, -0.91, 0.39], [0.99, -0.09, 0.04], { p: [-1, 0.2, -0.6] }) },
      },
      seq: [['a', 0.4, 1.2], ['b', 0.4, 1.2]] },
    { id: 'e0586', lib: true, name: 'Leg curl allongé à la machine', en: 'Lever lying leg curl', mus: mus(m2('ham', 1), m2('calf', 2)), cam: { yaw: 75, pitch: 14 },
      props: [fn(() => [MESH('legcurl', [-0.175, 0, -0.12], { part: 'frame', held: true })]),
        /* Modèle « Le Forzz LFI-013A Mesa Flexora » : le levier et son boudin tournent autour du moyeu (y 0,588, z -0,41 dans le modèle). */
        fn((C) => { const A = C.mul(C.add(C.bone('LowerLeg_L').at([0, -0.355, -0.095]), C.bone('LowerLeg_R').at([0, -0.355, -0.095])), 0.5); const a = Math.atan2(A[1] - 0.588, A[2] + 0.53) - Math.atan2(-0.168, -0.36);
          return [ROTM('legcurl', 'levier', [-0.175, 0, -0.12], [0, 0.588, -0.41], 'x', a, { nocheck: true })]; })],
      poses: {
        a: { float: true, pelvis: [0, 0.81, -0.06], rot: [86, 0, 0], neck: [-18, 0, 0], lL: { d: [0.05, -0.12, -1], e: [0, -0.05, -1], foot: 10 }, lR: { d: [-0.05, -0.12, -1], e: [0, -0.05, -1], foot: 10 },
          aL: grip([0.24, 0.38, 0.50], [0, -1, 0.25], [-1, 0, 0], { p: [1, 0.3, -0.2] }), aR: grip([-0.24, 0.38, 0.50], [0, -1, 0.25], [1, 0, 0], { p: [-1, 0.3, -0.2] }) },
        b: { float: true, pelvis: [0, 0.81, -0.06], rot: [86, 0, 0], neck: [-18, 0, 0], lL: { d: [0.05, -0.12, -1], e: [0, 0.95, 0.30], foot: 10 }, lR: { d: [-0.05, -0.12, -1], e: [0, 0.95, 0.30], foot: 10 },
          aL: grip([0.24, 0.38, 0.50], [0, -1, 0.25], [-1, 0, 0], { p: [1, 0.3, -0.2] }), aR: grip([-0.24, 0.38, 0.50], [0, -1, 0.25], [1, 0, 0], { p: [-1, 0.3, -0.2] }) },
      },
      seq: [['a', 0.4, 1.1], ['b', 0.4, 1.3]] },

    { id: 'e3195', lib: true, name: 'Leg curl allongé deux jambes, une jambe à la machine', en: 'Lever lying two-one leg curl', mus: mus(m2('ham', 1), m2('calf', 2)), cam: { yaw: 75, pitch: 14 },
      props: [fn(() => [MESH('legcurl', [-0.175, 0, -0.12], { part: 'frame', held: true })]),
        /* Modèle « Le Forzz LFI-013A Mesa Flexora » : le levier et son boudin tournent autour du moyeu (y 0,588, z -0,41 dans le modèle). */
        fn((C) => { const A = C.bone('LowerLeg_L').at([0, -0.355, -0.095]); const a = Math.atan2(A[1] - 0.588, A[2] + 0.53) - Math.atan2(-0.168, -0.36);
          return [ROTM('legcurl', 'levier', [-0.175, 0, -0.12], [0, 0.588, -0.41], 'x', a, { nocheck: true })]; })],
      poses: {
        a: { float: true, pelvis: [0, 0.81, -0.06], rot: [86, 0, 0], neck: [-18, 0, 0], lL: { d: [0.05, -0.12, -1], e: [0, -0.05, -1], foot: 10 }, lR: { d: [-0.05, -0.12, -1], e: [0, -0.05, -1], foot: 10 },
          aL: grip([0.24, 0.38, 0.50], [0, -1, 0.25], [-1, 0, 0], { p: [1, 0.3, -0.2] }), aR: grip([-0.24, 0.38, 0.50], [0, -1, 0.25], [1, 0, 0], { p: [-1, 0.3, -0.2] }) },
        b: { float: true, pelvis: [0, 0.81, -0.06], rot: [86, 0, 0], neck: [-18, 0, 0], lL: { d: [0.05, -0.12, -1], e: [0, 0.95, 0.30], foot: 10 }, lR: { d: [-0.05, -0.12, -1], e: [0, 0.95, 0.30], foot: 10 },
          aL: grip([0.24, 0.38, 0.50], [0, -1, 0.25], [-1, 0, 0], { p: [1, 0.3, -0.2] }), aR: grip([-0.24, 0.38, 0.50], [0, -1, 0.25], [1, 0, 0], { p: [-1, 0.3, -0.2] }) },
        c: { float: true, pelvis: [0, 0.81, -0.06], rot: [86, 0, 0], neck: [-18, 0, 0], lL: { d: [0.05, -0.12, -1], e: [0, 0.95, 0.30], foot: 10 }, lR: { d: [-0.05, -0.12, -1], e: [0, -0.05, -1], foot: 10 },
          aL: grip([0.24, 0.38, 0.50], [0, -1, 0.25], [-1, 0, 0], { p: [1, 0.3, -0.2] }), aR: grip([-0.24, 0.38, 0.50], [0, -1, 0.25], [1, 0, 0], { p: [-1, 0.3, -0.2] }) },
      },
      seq: [['a', 0.3, 1.0], ['b', 0.3, 0.6], ['c', 0.2, 1.8]] },

    { id: 'e1463', lib: true, name: 'Presse à cuisses 45°', en: 'Sled 45° leg press', mus: mus(m2('quad', 1)), cam: { yaw: 95, pitch: 8 },
      props: [fn(() => [MESH('legpress', [0, 0, 0], { part: 'frame', fit: [[0, 0.05, -0.95], [0, 1.45, 0.80], [0, 0.05, 0.80]] })]),
        /* Modèle « Leg Press Machine » (silentsheri, CC BY 4.0) : le chariot (plateau + disques) glisse sur les rails à 45° et suit les pieds. */
        fn((C) => { const t = ((C.J.ankleL[1] + C.J.ankleR[1]) + (C.J.ankleL[2] + C.J.ankleR[2])) * 0.5 * Math.SQRT1_2 + 0.075 - 0.785; return [MESH('legpress', [0, t * Math.SQRT1_2, t * Math.SQRT1_2], { part: 'chariot', held: true })]; })],
      poses: {
        a: { float: true, pelvis: [0, 0.362, -0.212], rot: [-45, 0, 0], neck: [47, 0, 0], lL: { at: [0.15, 0.863, 0.354], p: [0.3, 0.7, -0.4], foot: { toe: [0.15, 0.7, -0.7], up: [0, -0.71, -0.71] } }, lR: { at: [-0.15, 0.863, 0.354], p: [-0.3, 0.7, -0.4], foot: { toe: [-0.15, 0.7, -0.7], up: [0, -0.71, -0.71] } }, aL: grip([0.484, 0.41, 0.01], [0.54, -0.45, 0.71], [-0.63, -0.77, -0.01], { p: [1, 0.35, -0.6] }), aR: grip([-0.484, 0.41, 0.01], [-0.54, -0.45, 0.71], [0.63, -0.77, -0.01], { p: [-1, 0.35, -0.6] }) },
        b: { float: true, pelvis: [0, 0.362, -0.212], rot: [-45, 0, 0], neck: [47, 0, 0], lL: { at: [0.16, 0.764, 0.17], p: [0.3, 0.7, -0.25], foot: { toe: [0.15, 0.7, -0.7], up: [0, -0.71, -0.71] } }, lR: { at: [-0.16, 0.764, 0.17], p: [-0.3, 0.7, -0.25], foot: { toe: [-0.15, 0.7, -0.7], up: [0, -0.71, -0.71] } }, aL: grip([0.484, 0.41, 0.01], [0.54, -0.45, 0.71], [-0.63, -0.77, -0.01], { p: [1, 0.35, -0.6] }), aR: grip([-0.484, 0.41, 0.01], [-0.54, -0.45, 0.71], [0.63, -0.77, -0.01], { p: [-1, 0.35, -0.6] }) },
      },
      seq: [['a', 0.4, 1.3], ['b', 0.3, 1.3]] },

    { id: 'e0058', lib: true, name: 'Relevé de bassin allongé à la barre', en: 'Barbell lying lifting (on hip)', mus: mus(m2('quad', 1), m2('ham', 2)), cam: { yaw: 60, pitch: 18 },
      props: [barbell(), fn(() => [box([0, 0.303, -0.52], [1.10, 0.07, 0.30], PAD, { name: 'banc' }), box([0.45, 0.134, -0.52], [0.05, 0.268, 0.24], FRAME, { name: 'banc' }), box([-0.45, 0.134, -0.52], [0.05, 0.268, 0.24], FRAME, { name: 'banc' })])],
      poses: {
        a: { pelvis: [0, 0.342, -0.02], rot: [-66, 0, 0], neck: [26, 0, 0], lL: flatF(0.16, 0.44, { p: [0.25, 1, 0.3] }), lR: flatF(-0.16, 0.44, { p: [-0.25, 1, 0.3] }),
          aL: grip([0.32, 0.44, 0.07], [0, 0.25, 1], [0, -1, 0.25], { p: [1, 0.4, -0.4] }), aR: grip([-0.32, 0.44, 0.07], [0, 0.25, 1], [0, -1, 0.25], { p: [-1, 0.4, -0.4] }) },
        b: { pelvis: [0, 0.512, 0.03], rot: [-88, 0, 0], neck: [32, 0, 0], lL: flatF(0.16, 0.44, { p: [0.25, 1, 0.3] }), lR: flatF(-0.16, 0.44, { p: [-0.25, 1, 0.3] }),
          aL: grip([0.32, 0.625, 0.07], [0, 0.1, 1], [0, -1, 0.1], { p: [1, 0.4, -0.4] }), aR: grip([-0.32, 0.625, 0.07], [0, 0.1, 1], [0, -1, 0.1], { p: [-1, 0.4, -0.4] }) },
      },
      seq: [['a', 0.4, 1.2], ['b', 0.5, 1.3]] },

    { id: 'e1408', lib: true, noFloor: true, name: 'Relevé de bassin à l’élastique', en: 'Band hip lift', mus: mus(m2('glute', 1), m2('ham', 2)), cam: { yaw: 70, pitch: 22 },
      props: [fn((C) => { const h = C.bone('Hips'); const pL = h.at([0.17, 0.0, 0.11]), pR = h.at([-0.17, 0.0, 0.11]), pc = h.at([0, 0.0, 0.14]);
        return [cyl([0.40, 0.02, 0.0], pL, 0.009, BAND, { soft: true }), cyl(pL, pc, 0.009, BAND, { soft: true }), cyl(pc, pR, 0.009, BAND, { soft: true }), cyl(pR, [-0.40, 0.02, 0.0], 0.009, BAND, { soft: true }),
          cyl([0.40, 0, 0.0], [0.40, 0.03, 0.0], 0.06, PLATE, { name: 'poids' }), cyl([-0.40, 0, 0.0], [-0.40, 0.03, 0.0], 0.06, PLATE, { name: 'poids' })]; })],
      poses: {
        a: { pelvis: [0, 0.1, 0], rot: [-95, 0, 0], neck: [10, 0, 0], lL: flatF(0.13, 0.40, { p: [0.2, 1, 0.2] }), lR: flatF(-0.13, 0.40, { p: [-0.2, 1, 0.2] }),
          aL: { at: [0.26, 0.03, -0.17], hand: 'flat', hdir: [0, 0, 1], p: [0.4, 0.4, -1] }, aR: { at: [-0.26, 0.03, -0.17], hand: 'flat', hdir: [0, 0, 1], p: [-0.4, 0.4, -1] } },
        b: { pelvis: [0, 0.37, 0.04], rot: [-118, 0, 0], neck: [40, 0, 0], lL: flatF(0.13, 0.40, { p: [0.2, 1, 0.2] }), lR: flatF(-0.13, 0.40, { p: [-0.2, 1, 0.2] }),
          aL: { at: [0.26, 0.03, -0.17], hand: 'flat', hdir: [0, 0, 1], p: [0.4, 0.4, -1] }, aR: { at: [-0.26, 0.03, -0.17], hand: 'flat', hdir: [0, 0, 1], p: [-0.4, 0.4, -1] } },
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
      props: [barbell(), fn(() => [...bench(-0.75, 0.25, 0.44), hid(cyl([0.55, 0, -0.62], [0.55, 1.25, -0.62], 0.03, FRAME)), hid(cyl([-0.55, 0, -0.62], [-0.55, 1.25, -0.62], 0.03, FRAME)), MESH('banc_couche', [0, 0, -0.13], { part: 'montants', s: [1.72, 1.74, 1] })])],
      poses: {
        a: { float: true, pelvis: [0, 0.605, 0.05], rot: [-90, 0, 0], neck: [8, 0, 0], lL: flatF(0.25, 0.50, { p: [0.5, 1, 0.2] }), lR: flatF(-0.25, 0.50, { p: [-0.5, 1, 0.2] }),
          aL: grip([0.40, 1.235, -0.42], [0, 1, -0.12], [0, 0.12, 1], { p: [1, -0.3, 0.2] }), aR: grip([-0.40, 1.235, -0.42], [0, 1, -0.12], [0, 0.12, 1], { p: [-1, -0.3, 0.2] }) },
        b: { float: true, pelvis: [0, 0.605, 0.05], rot: [-90, 0, 0], neck: [8, 0, 0], lL: flatF(0.25, 0.50, { p: [0.5, 1, 0.2] }), lR: flatF(-0.25, 0.50, { p: [-0.5, 1, 0.2] }),
          aL: grip([0.40, 0.805, -0.33], [0, 1, -0.05], [0, 0.05, 1], { p: [1, -0.4, 0.3] }), aR: grip([-0.40, 0.805, -0.33], [0, 1, -0.05], [0, 0.05, 1], { p: [-1, -0.4, 0.3] }) },
      },
      seq: [['a', 0.4, 1.3], ['b', 0.2, 1.1]] },

    { id: 'e0289', lib: true, name: 'Développé couché aux haltères', en: 'Dumbbell bench press', mus: mus(m2('pec', 1), m2('delt', 2), m2('triceps', 2)), cam: { yaw: 55, pitch: 22 },
      props: [...dbs(), fn(() => bench(-0.75, 0.25, 0.44))],
      poses: {
        a: { float: true, pelvis: [0, 0.605, 0.05], rot: [-90, 0, 0], neck: [8, 0, 0], lL: flatF(0.25, 0.50, { p: [0.5, 1, 0.2] }), lR: flatF(-0.25, 0.50, { p: [-0.5, 1, 0.2] }),
          aL: grip([0.16, 1.235, -0.42], [0, 1, -0.12], [0, 0.12, 1], { p: [1, -0.3, 0.2] }), aR: grip([-0.16, 1.235, -0.42], [0, 1, -0.12], [0, 0.12, 1], { p: [-1, -0.3, 0.2] }) },
        b: { float: true, pelvis: [0, 0.605, 0.05], rot: [-90, 0, 0], neck: [8, 0, 0], lL: flatF(0.25, 0.50, { p: [0.5, 1, 0.2] }), lR: flatF(-0.25, 0.50, { p: [-0.5, 1, 0.2] }),
          aL: grip([0.40, 0.845, -0.36], [0, 1, -0.05], [0, 0.05, 1], { p: [1, -0.4, 0.3] }), aR: grip([-0.40, 0.845, -0.36], [0, 1, -0.05], [0, 0.05, 1], { p: [-1, -0.4, 0.3] }) },
      },
      seq: [['a', 0.4, 1.3], ['b', 0.2, 1.1]] },

    { id: 'e0047', lib: true, name: 'Développé incliné à la barre', en: 'Barbell incline bench press', mus: mus(m2('pec', 1), m2('triceps', 2)), cam: { yaw: 60, pitch: 18 },
      props: [barbell(), fn(() => [...INB(), hid(cyl([0.55, 0, -0.30], [0.55, 1.65, -0.30], 0.03, FRAME)), hid(cyl([-0.55, 0, -0.30], [-0.55, 1.65, -0.30], 0.03, FRAME)),
        MESH('banc_couche', [0, 0, 0.19], { part: 'montants', s: [1.72, 2.3, 1] })])],
      poses: {
        a: { float: true, pelvis: [0, 0.621, 0.05], rot: [-50, 0, 0], neck: [10, 0, 0], lL: flatF(0.24, 0.56, { p: [0.4, 1, 0.3] }), lR: flatF(-0.24, 0.56, { p: [-0.4, 1, 0.3] }),
          aL: grip([0.40, 1.690, -0.10], [0, 0.9, -0.45], [0, 0.45, 0.9], { p: [1, -0.3, 0.3] }), aR: grip([-0.40, 1.690, -0.10], [0, 0.9, -0.45], [0, 0.45, 0.9], { p: [-1, -0.3, 0.3] }) },
        b: { float: true, pelvis: [0, 0.621, 0.05], rot: [-50, 0, 0], neck: [10, 0, 0], lL: flatF(0.24, 0.56, { p: [0.4, 1, 0.3] }), lR: flatF(-0.24, 0.56, { p: [-0.4, 1, 0.3] }),
          aL: grip([0.40, 1.280, -0.10], [0, 0.9, -0.45], [0, 0.45, 0.9], { p: [1, -0.4, 0.3] }), aR: grip([-0.40, 1.280, -0.10], [0, 0.9, -0.45], [0, 0.45, 0.9], { p: [-1, -0.4, 0.3] }) },
      },
      seq: [['a', 0.4, 1.3], ['b', 0.2, 1.1]] },

    { id: 'e0757', lib: true, name: 'Développé incliné à la Smith machine', en: 'Smith incline bench press', mus: mus(m2('pec', 1), m2('delt', 2)), cam: { yaw: 60, pitch: 18 },
      props: [fn(() => [...INB(), hid(cyl([-0.75, 1.5, -0.10], [0.75, 1.5, -0.10], 0.016, BAR, { held: true }))]),
        /* Smith machine (« Smith training equipment », MrdT, CC BY 4.0) : la barre et ses crochets coulissent sur les montants. */
        fn((C) => { const g = mul(add(C.hand('L').grip, C.hand('R').grip), 0.5);
          return [MESH('smith', [0, 0, -0.165], { part: 'frame' }), MESH('smith', [0, g[1] - 1.505, -0.165], { part: 'barre', held: true }),
            hid(cyl(add(g, [-0.75, 0, 0]), add(g, [0.75, 0, 0]), 0.016, BAR, { held: true, name: 'barre' }))]; })],
      poses: {
        a: { float: true, pelvis: [0, 0.605, 0.05], rot: [-50, 0, 0], neck: [10, 0, 0], lL: flatF(0.24, 0.50, { p: [0.4, 1, 0.3] }), lR: flatF(-0.24, 0.50, { p: [-0.4, 1, 0.3] }),
          aL: grip([0.38, 1.670, -0.10], [0, 0.9, -0.45], [0, 0.45, 0.9], { p: [1, -0.3, 0.3] }), aR: grip([-0.38, 1.670, -0.10], [0, 0.9, -0.45], [0, 0.45, 0.9], { p: [-1, -0.3, 0.3] }) },
        b: { float: true, pelvis: [0, 0.605, 0.05], rot: [-50, 0, 0], neck: [10, 0, 0], lL: flatF(0.24, 0.50, { p: [0.4, 1, 0.3] }), lR: flatF(-0.24, 0.50, { p: [-0.4, 1, 0.3] }),
          aL: grip([0.38, 1.280, -0.10], [0, 0.9, -0.45], [0, 0.45, 0.9], { p: [1, -0.4, 0.3] }), aR: grip([-0.38, 1.280, -0.10], [0, 0.9, -0.45], [0, 0.45, 0.9], { p: [-1, -0.4, 0.3] }) },
      },
      seq: [['a', 0.4, 1.3], ['b', 0.2, 1.1]] },
    { id: 'Cable_Crossover', lib: true, interp: 'arc', tendu: 14, name: 'Vis-à-vis à la poulie', en: 'Cable crossover', mus: mus(m2('pec', 1), m2('delt', 2)), cam: { yaw: 25, pitch: 10 },
      props: [crossover(1.10, -0.15), cableTo('L', [1.05, 2.0, -0.15]), cableTo('R', [-1.05, 2.0, -0.15])],
      poses: {
        a: { pelvis: [0, 0.915, -0.02], rot: [12, 0, 0], neck: [-8, 0, 0], lL: flatF(0.13, 0.20), lR: flatF(-0.13, -0.16, { foot: { toe: [0, -0.5, 0.87], up: [0, 0.87, 0.5] }, at: [-0.13, 0.13, -0.18] }),
          aL: reach(SH(1, 1.42, 0.07), [0.80, 1.52, 0.10], [0, -0.3, 1], { p: [0.2, -0.5, -1] }), aR: reach(SH(-1, 1.42, 0.07), [-0.80, 1.52, 0.10], [0, -0.3, 1], { p: [-0.2, -0.5, -1] }) },
        b: { pelvis: [0, 0.915, -0.02], rot: [12, 0, 0], neck: [-8, 0, 0], lL: flatF(0.13, 0.20), lR: flatF(-0.13, -0.16, { foot: { toe: [0, -0.5, 0.87], up: [0, 0.87, 0.5] }, at: [-0.13, 0.13, -0.18] }),
          aL: reach(SH(1, 1.42, 0.07), [0.07, 1.02, 0.44], [-1, 0.3, 0], { p: [1, -0.2, -0.3] }), aR: reach(SH(-1, 1.42, 0.07), [-0.07, 1.06, 0.46], [1, 0.3, 0], { p: [-1, -0.2, -0.3] }) },
        m: { pelvis: [0, 0.915, -0.02], rot: [12, 0, 0], neck: [-8, 0, 0], lL: flatF(0.13, 0.20), lR: flatF(-0.13, -0.16, { foot: { toe: [0, -0.5, 0.87], up: [0, 0.87, 0.5] }, at: [-0.13, 0.13, -0.18] }),
          aL: reach(SH(1, 1.42, 0.07), [0.50, 1.25, 0.52], [0, -0.3, 1], { p: [1, -0.2, -0.3] }), aR: reach(SH(-1, 1.42, 0.07), [-0.50, 1.25, 0.52], [0, -0.3, 1], { p: [-1, -0.2, -0.3] }) },
      },
      seq: [['a', 0.4, 0.65], ['m', 0, 0.65], ['b', 0.4, 0.65], ['m', 0, 0.65]] },

    { id: 'e1269', lib: true, interp: 'arc', tendu: 14, name: 'Écarté croisé debout, buste droit, à la poulie', en: 'Cable standing up straight crossovers', mus: mus(m2('pec', 1), m2('delt', 2)), cam: { yaw: 20, pitch: 8 },
      props: [crossover(1.10, -0.10), cableTo('L', [1.05, 1.95, -0.10]), cableTo('R', [-1.05, 1.95, -0.10])],
      poses: {
        a: { pelvis: [0, 0.92, 0], rot: [2, 0, 0], lL: flatF(0.12, 0.02), lR: flatF(-0.12, 0.02),
          aL: reach(SH(1), [0.86, 1.42, 0.02], [0, -0.2, 1], { p: [0.2, -0.5, -1] }), aR: reach(SH(-1), [-0.86, 1.42, 0.02], [0, -0.2, 1], { p: [-0.2, -0.5, -1] }) },
        b: { pelvis: [0, 0.92, 0], rot: [2, 0, 0], lL: flatF(0.12, 0.02), lR: flatF(-0.12, 0.02),
          aL: reach(SH(1), [-0.08, 0.92, 0.42], [-1, 0.3, 0], { p: [1, -0.2, -0.3] }), aR: reach(SH(-1), [0.08, 1.06, 0.40], [1, 0.3, 0], { p: [-1, -0.2, -0.3] }) },
        m: { pelvis: [0, 0.92, 0], rot: [2, 0, 0], lL: flatF(0.12, 0.02), lR: flatF(-0.12, 0.02),
          aL: reach(SH(1), [0.50, 1.22, 0.50], [0, -0.3, 1], { p: [1, -0.2, -0.3] }), aR: reach(SH(-1), [-0.50, 1.22, 0.50], [0, -0.3, 1], { p: [-1, -0.2, -0.3] }) },
      },
      seq: [['a', 0.4, 0.65], ['m', 0, 0.65], ['b', 0.4, 0.65], ['m', 0, 0.65]] },

    { id: 'e0179', lib: true, interp: 'arc', tendu: 14, name: 'Écarté bas à la poulie', en: 'Cable low fly', mus: mus(m2('pec', 1), m2('delt', 2)), cam: { yaw: 25, pitch: 6 },
      props: [crossover(1.05, -0.10), cableTo('L', [1.00, 0.15, -0.10]), cableTo('R', [-1.00, 0.15, -0.10])],
      poses: {
        a: { pelvis: [0, 0.915, 0], rot: [6, 0, 0], lL: flatF(0.14, 0.18), lR: flatF(-0.14, -0.18, { foot: { toe: [0, -0.5, 0.87], up: [0, 0.87, 0.5] }, at: [-0.14, 0.13, -0.20] }),
          aL: reach(SH(1, 1.43, 0.03), [0.56, 0.86, 0.14], [0, 0.3, 1], { p: [0.4, -0.2, -1] }), aR: reach(SH(-1, 1.43, 0.03), [-0.56, 0.86, 0.14], [0, 0.3, 1], { p: [-0.4, -0.2, -1] }) },
        b: { pelvis: [0, 0.915, 0], rot: [6, 0, 0], lL: flatF(0.14, 0.18), lR: flatF(-0.14, -0.18, { foot: { toe: [0, -0.5, 0.87], up: [0, 0.87, 0.5] }, at: [-0.14, 0.13, -0.20] }),
          aL: reach(SH(1, 1.43, 0.03), [0.08, 1.30, 0.50], [-1, 0.4, 0], { p: [1, -0.6, -0.2] }), aR: reach(SH(-1, 1.43, 0.03), [-0.08, 1.30, 0.50], [1, 0.4, 0], { p: [-1, -0.6, -0.2] }) },
      },
      seq: [['a', 0.4, 1.2], ['b', 0.4, 1.3]] },

    { id: 'e0188', lib: true, interp: 'arc', tendu: 14, name: 'Écarté à mi-hauteur à la poulie', en: 'Cable middle fly', mus: mus(m2('pec', 1), m2('delt', 2)), cam: { yaw: 25, pitch: 10 },
      props: [crossover(1.10, -0.15), cableTo('L', [1.05, 1.36, -0.15]), cableTo('R', [-1.05, 1.36, -0.15])],
      poses: {
        a: { pelvis: [0, 0.915, 0], rot: [6, 0, 0], lL: flatF(0.14, 0.18), lR: flatF(-0.14, -0.18, { foot: { toe: [0, -0.5, 0.87], up: [0, 0.87, 0.5] }, at: [-0.14, 0.13, -0.20] }),
          aL: reach(SH(1, 1.43, 0.03), [0.82, 1.36, 0.04], [0, 0, 1], { p: [0.2, -1, -0.4] }), aR: reach(SH(-1, 1.43, 0.03), [-0.82, 1.36, 0.04], [0, 0, 1], { p: [-0.2, -1, -0.4] }) },
        b: { pelvis: [0, 0.915, 0], rot: [6, 0, 0], lL: flatF(0.14, 0.18), lR: flatF(-0.14, -0.18, { foot: { toe: [0, -0.5, 0.87], up: [0, 0.87, 0.5] }, at: [-0.14, 0.13, -0.20] }),
          aL: reach(SH(1, 1.43, 0.03), [0.08, 1.34, 0.56], [-1, 0, 0], { p: [1, -0.8, 0] }), aR: reach(SH(-1, 1.43, 0.03), [-0.08, 1.34, 0.56], [1, 0, 0], { p: [-1, -0.8, 0] }) },
      },
      seq: [['a', 0.4, 1.2], ['b', 0.4, 1.3]] },

    { id: 'Cable_Chest_Press', lib: true, interp: 'fk', name: 'Développé pectoraux à la poulie', en: 'Cable chest press', mus: mus(m2('pec', 1), m2('delt', 2), m2('triceps', 2)), cam: { yaw: 60, pitch: 12 },
      props: [tower(0.82, -0.62, 2.2), tower(-0.82, -0.62, 2.2), cableTo('L', [0.80, 1.00, -0.56]), cableTo('R', [-0.80, 1.00, -0.56]), fn(() => UPB())],   // banc réglable redressé entre deux colonnes
      poses: {
        a: { float: true, pelvis: [0, 0.625, 0], rot: [-6, 0, 0], neck: [6, 0, 0], lL: flatF(0.20, 0.45), lR: flatF(-0.20, 0.45),
          aL: grip([0.34, 1.20, 0.05], [0, 0.1, 1], [0, -1, 0.1], { p: [1, 0.1, -1] }), aR: grip([-0.34, 1.20, 0.05], [0, 0.1, 1], [0, -1, 0.1], { p: [-1, 0.1, -1] }) },
        b: { float: true, pelvis: [0, 0.625, 0], rot: [-6, 0, 0], neck: [6, 0, 0], lL: flatF(0.20, 0.45), lR: flatF(-0.20, 0.45),
          aL: grip([0.13, 1.190, 0.60], [0, 0, 1], [-0.3, -1, 0], { p: [1, -0.5, -0.4] }), aR: grip([-0.13, 1.190, 0.60], [0, 0, 1], [0.3, -1, 0], { p: [-1, -0.5, -0.4] }) },
      },
      seq: [['a', 0.4, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e2144', lib: true, interp: 'fk', name: 'Développé poitrine assis à la poulie', en: 'Cable seated chest press', mus: mus(m2('pec', 1), m2('delt', 2)), cam: { yaw: 35, pitch: 10 },
      props: [tower(0.80, -0.60, 2.2), tower(-0.80, -0.60, 2.2), cableTo('L', [0.78, 1.42, -0.56]), cableTo('R', [-0.78, 1.42, -0.56]),
        fn(() => [MESH('chest', [0, 0, -0.275]), hid(tbox([0, 0.894, -0.27], [0.34, 0.62, 0.07], -8, PAD, { name: 'dossier' }))])],
      poses: {
        a: { float: true, pelvis: [0, 0.689, 0.0], rot: [-6, 0, 0], neck: [6, 0, 0], lL: flatF(0.22, 0.45), lR: flatF(-0.22, 0.45),
          aL: grip([0.42, 1.294, 0.02], [-0.07, 0.58, 0.81], [-0.05, -0.81, 0.58], { p: [1, 0, -0.5] }), aR: grip([-0.42, 1.294, 0.02], [0.07, 0.58, 0.81], [0.05, -0.81, 0.58], { p: [-1, 0, -0.5] }) },
        b: { float: true, pelvis: [0, 0.689, 0.0], rot: [-6, 0, 0], neck: [6, 0, 0], lL: flatF(0.22, 0.45), lR: flatF(-0.22, 0.45),
          aL: grip([0.14, 1.294, 0.60], [0, 0, 1], [0, -1, 0], { p: [1, -0.9, -0.4] }), aR: grip([-0.14, 1.294, 0.60], [0, 0, 1], [0, -1, 0], { p: [-1, -0.9, -0.4] }) },
      },
      seq: [['a', 0.4, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e0576', lib: true, interp: 'fk', name: 'Développé poitrine à la machine', en: 'Lever chest press', mus: mus(m2('pec', 1), m2('delt', 2)), cam: { yaw: 30, pitch: 10 },
      props: [cableTo('L', [0.74, 1.32, -0.54]), cableTo('R', [-0.74, 1.32, -0.54]),
        fn(() => [MESH('chest', [0, 0, -0.27]), hid(tbox([0, 0.894, -0.27], [0.34, 0.62, 0.07], -8, PAD, { name: 'dossier' }))])],
      poses: {
        a: { float: true, pelvis: [0, 0.705, 0], rot: [-4, 0, 0], neck: [4, 0, 0], lL: flatF(0.20, 0.43), lR: flatF(-0.20, 0.43),
          aL: grip([0.29, 1.294, 0.10], [-0.46, 0.58, 0.67], [-0.89, -0.3, -0.35], { p: [1, -0.5, -0.3] }), aR: grip([-0.29, 1.294, 0.10], [0.46, 0.58, 0.67], [0.89, -0.3, -0.35], { p: [-1, -0.5, -0.3] }) },
        b: { float: true, pelvis: [0, 0.705, 0], rot: [-4, 0, 0], neck: [4, 0, 0], lL: flatF(0.20, 0.43), lR: flatF(-0.20, 0.43),
          aL: grip([0.20, 1.294, 0.60], [-0.01, 0.05, 1], [-1, 0, -0.01], { p: [1, -0.8, 0] }), aR: grip([-0.20, 1.294, 0.60], [0.01, 0.05, 1], [1, 0, -0.01], { p: [-1, -0.8, 0] }) },
      },
      seq: [['a', 0.4, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e1300', lib: true, interp: 'fk', name: 'Développé décliné à la machine', en: 'Lever decline chest press', mus: mus(m2('pec', 1), m2('delt', 2)), cam: { yaw: 50, pitch: 12 },
      props: [fn(() => [box([0, 0.44, 0.02], [0.40, 0.07, 0.40], PAD, { name: 'siège' }), tbox([0, 0.88, -0.36], [0.38, 0.74, 0.07], -28, PAD, { name: 'dossier' }), box([0, 0.20, -0.05], [0.10, 0.40, 0.10], FRAME),
          cyl([0.55, 0, -0.60], [0.55, 2.0, -0.60], 0.03, FRAME), cyl([-0.55, 0, -0.60], [-0.55, 2.0, -0.60], 0.03, FRAME), cyl([-0.55, 2.0, -0.60], [0.55, 2.0, -0.60], 0.03, FRAME)]),
        fn((C) => { const out = []; for (const sd of ['L', 'R']) { const h = C.hand(sd); const s = sd === 'L' ? 1 : -1; const piv = [s * 0.66, 1.90, -0.42];
          const top = C.add(h.grip, C.mul(h.across, 0.07)), bot = C.add(h.grip, C.mul(h.across, -0.07));
          out.push(cyl(bot, top, 0.017, BAR, { held: true }), cyl(piv, top, 0.025, FRAME, { name: 'bras', held: true }), cyl(C.lerp(piv, top, 0.3), C.add(C.lerp(piv, top, 0.3), [s * 0.08, 0, 0]), 0.20, PLATE, { name: 'disque' })); } return out; })],
      poses: {
        a: { float: true, pelvis: [0, 0.663, 0], rot: [-26, 0, 0], neck: [12, 0, 0], lL: flatF(0.20, 0.45), lR: flatF(-0.20, 0.45),
          aL: grip([0.30, 1.148, 0.02], [-0.45, 0.44, 0.78], [-0.89, -0.22, -0.39], { p: [1, -0.5, -0.3] }), aR: grip([-0.30, 1.148, 0.02], [0.45, 0.44, 0.78], [0.89, -0.22, -0.39], { p: [-1, -0.5, -0.3] }) },
        b: { float: true, pelvis: [0, 0.663, 0], rot: [-26, 0, 0], neck: [12, 0, 0], lL: flatF(0.20, 0.45), lR: flatF(-0.20, 0.45),
          aL: grip([0.20, 0.928, 0.50], [0, -0.24, 0.97], [-1, 0.15, 0], { p: [1, -0.8, 0] }), aR: grip([-0.20, 0.928, 0.50], [0, -0.24, 0.97], [1, 0.15, 0], { p: [-1, -0.8, 0] }) },
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
    { id: 'Alternating_Deltoid_Raise', lib: true, interp: 'arc', tendu: 18, name: 'Élévation deltoïdes alternée aux haltères', en: 'Alternating deltoid raise', mus: mus(m2('delt', 1)), cam: { yaw: 40, pitch: 8 },
      /* Consigne : les deux haltères ensemble, une répétition devant soi, la suivante sur les côtés, coudes légèrement fléchis. */
      props: dbs(),
      poses: {
        a: { pelvis: [0, 0.92, 0], lL: flatF(0.12, 0.02), lR: flatF(-0.12, 0.02),
          aL: reach(SH(1), [0.28, 0.75, 0.10], [-1, 0, 0.2], { p: [0.2, 0, -1] }), aR: reach(SH(-1), [-0.28, 0.75, 0.10], [1, 0, 0.2], { p: [-0.2, 0, -1] }) },
        f: { pelvis: [0, 0.92, 0], rot: [-3, 0, 0], lL: flatF(0.12, 0.02), lR: flatF(-0.12, 0.02),
          aL: reach(SH(1), [0.22, 1.40, 0.66], [-0.3, -1, 0], { p: [1, -0.2, 0] }), aR: reach(SH(-1), [-0.22, 1.40, 0.66], [0.3, -1, 0], { p: [-1, -0.2, 0] }) },
        l: { pelvis: [0, 0.92, 0], lL: flatF(0.12, 0.02), lR: flatF(-0.12, 0.02),
          aL: reach(SH(1), [0.80, 1.38, 0.10], [0, -1, 0], { p: [0.2, 0.2, -1] }), aR: reach(SH(-1), [-0.80, 1.38, 0.10], [0, -1, 0], { p: [-0.2, 0.2, -1] }) },
      },
      seq: [['a', 0.3, 1.0], ['f', 0.3, 1.0], ['a', 0.3, 1.0], ['l', 0.3, 1.0]] },

    { id: 'e0091', lib: true, interp: 'fk', name: 'Développé au-dessus de la tête assis à la barre', en: 'Barbell seated overhead press', mus: mus(m2('delt', 1), m2('pec', 2), m2('triceps', 2)), cam: { yaw: 40, pitch: 8 },
      props: [barbell(), fn(() => bench(-0.40, 0.24, 0.45))],
      poses: {
        a: { float: true, pelvis: [0, 0.606, -0.05], rot: [2, 0, 0], neck: [-4, 0, 0], lL: flatF(0.22, 0.42), lR: flatF(-0.22, 0.42),
          aL: grip([0.29, 1.186, 0.16], [0, 1, 0.3], [0, -0.3, 1], { p: [1, -0.4, 0.15] }), aR: grip([-0.29, 1.186, 0.16], [0, 1, 0.3], [0, -0.3, 1], { p: [-1, -0.4, 0.15] }) },
        b: { float: true, pelvis: [0, 0.606, -0.05], rot: [2, 0, 0], neck: [-4, 0, 0], lL: flatF(0.22, 0.42), lR: flatF(-0.22, 0.42),
          aL: grip([0.29, 1.766, 0.03], [0, 1, 0.05], [0, -0.05, 1], { p: [0.7, -0.7, 0.4] }), aR: grip([-0.29, 1.766, 0.03], [0, 1, 0.05], [0, -0.05, 1], { p: [-0.7, -0.7, 0.4] }) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.3, 1.2]] },

    { id: 'e0405', lib: true, name: 'Développé épaules assis aux haltères', en: 'Dumbbell seated shoulder press', mus: mus(m2('delt', 1), m2('pec', 2), m2('triceps', 2)), cam: { yaw: 35, pitch: 8 },
      props: [...dbs(), fn(() => UPB())],
      poses: {
        a: { float: true, pelvis: [0, 0.607, -0.02], rot: [-8, 0, 0], neck: [4, 0, 0], lL: flatF(0.24, 0.40), lR: flatF(-0.24, 0.40),
          aL: grip([0.36, 1.157, 0.02], [0, 1, 0.05], [0, -0.05, 1], { p: [1, -0.6, 0] }), aR: grip([-0.36, 1.157, 0.02], [0, 1, 0.05], [0, -0.05, 1], { p: [-1, -0.6, 0] }) },
        b: { float: true, pelvis: [0, 0.607, -0.02], rot: [-8, 0, 0], neck: [4, 0, 0], lL: flatF(0.24, 0.40), lR: flatF(-0.24, 0.40),
          aL: grip([0.17, 1.757, -0.06], [0, 1, 0.05], [0, -0.05, 1], { p: [1, -0.2, 0] }), aR: grip([-0.17, 1.757, -0.06], [0, 1, 0.05], [0, -0.05, 1], { p: [-1, -0.2, 0] }) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.3, 1.2]] },

    { id: 'e2318', lib: true, name: 'Développé épaules à la machine', en: 'Lever shoulder press v. 3', mus: mus(m2('delt', 1), m2('pec', 2), m2('serr', 2)), cam: { yaw: 35, pitch: 8 },
      /* Modèle « Intenza EL04 Shoulder Press » : les deux bras tournent autour de l'axe arrière (y 1,31, z -0,61 dans le modèle). */
      props: [fn(() => [MESH('shoulder', [-0.137, 0, -0.60], { part: 'frame' }), hid(tbox([0, 1.005, -0.27], [0.36, 0.76, 0.07], -10, PAD, { name: 'dossier' }))]),
        fn((C) => { const g = mul(add(C.hand('L').grip, C.hand('R').grip), 0.5); const P = [0, 1.31, -1.21];
          return [ROTM('shoulder', 'bras', [-0.137, 0, -0.60], [0.137, 1.31, -0.61], 'x', angX(g, P) - Math.atan2(-0.395, 1.12), { held: true })]; })],
      poses: {
        a: { float: true, pelvis: [0, 0.691, -0.02], rot: [-8, 0, 0], neck: [4, 0, 0], lL: flatF(0.22, 0.42), lR: flatF(-0.22, 0.42),
          aL: grip([0.41, 1.25, -0.034], [0, 1, 0.05], [0, -0.05, 1], { p: [1, -0.6, 0] }), aR: grip([-0.41, 1.25, -0.034], [0, 1, 0.05], [0, -0.05, 1], { p: [-1, -0.6, 0] }) },
        b: { float: true, pelvis: [0, 0.691, -0.02], rot: [-8, 0, 0], neck: [4, 0, 0], lL: flatF(0.22, 0.42), lR: flatF(-0.22, 0.42),
          aL: grip([0.41, 1.83, -0.153], [0, 1, -0.2], [0, 0.2, 1], { p: [1, -0.2, 0] }), aR: grip([-0.41, 1.83, -0.153], [0, 1, -0.2], [0, 0.2, 1], { p: [-1, -0.2, 0] }) },
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

    { id: 'e0162', lib: true, interp: 'arc', tendu: 12, name: 'Élévation frontale à la poulie', en: 'Cable front raise', mus: mus(m2('delt', 1), m2('pec', 2)), cam: { yaw: 50, pitch: 8 },
      /* Référence : barre droite tenue à deux mains, câble de la poulie basse derrière soi qui passe entre les jambes. */
      props: [tower(0, -0.62, 2.2), fn((C) => { const a = C.hand('L').grip, b = C.hand('R').grip; const m = C.mul(C.add(a, b), 0.5); const u = C.norm(C.sub(a, b));
        return [cyl(C.add(m, C.mul(u, -0.30)), C.add(m, C.mul(u, 0.30)), 0.014, BAR, { held: true, name: 'barre' }), cyl(m, [0, 0.12, -0.56], 0.006, CABLE, { soft: true }), sph([0, 0.12, -0.56], 0.035, FRAME, { name: 'poulie' })]; })],
      poses: {
        a: { pelvis: [0, 0.92, 0], rot: [2, 0, 0], lL: flatF(0.15, 0.02), lR: flatF(-0.15, 0.02),
          aL: reach(SH(1), [0.17, 0.76, 0.17], [0, 0, -1], { p: [0.3, 0, -1] }), aR: reach(SH(-1), [-0.17, 0.76, 0.17], [0, 0, -1], { p: [-0.3, 0, -1] }) },
        b: { pelvis: [0, 0.92, 0], rot: [-2, 0, 0], lL: flatF(0.15, 0.02), lR: flatF(-0.15, 0.02),
          aL: reach(SH(1), [0.17, 1.44, 0.70], [0, -1, 0], { p: [0.7, -0.3, -0.6] }), aR: reach(SH(-1), [-0.17, 1.44, 0.70], [0, -1, 0], { p: [-0.7, -0.3, -0.6] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e0164', lib: true, interp: 'arc', tendu: 12, name: 'Élévation frontale des épaules à la poulie', en: 'Cable front shoulder raise', mus: mus(m2('delt', 1)), cam: { yaw: 20, pitch: 8 },
      /* Référence : une poignée dans chaque main, chaque câble vient de la poulie basse du même côté. */
      props: [crossover(1.05, -0.10), cableTo('L', [1.00, 0.15, -0.10]), cableTo('R', [-1.00, 0.15, -0.10])],
      poses: {
        a: { pelvis: [0, 0.92, 0], lL: flatF(0.19, 0.02), lR: flatF(-0.19, 0.02),
          aL: reach(SH(1), [0.30, 0.78, 0.10], [-0.5, 0, -1], { p: [0.4, 0, -1] }), aR: reach(SH(-1), [-0.30, 0.78, 0.10], [0.5, 0, -1], { p: [-0.4, 0, -1] }) },
        b: { pelvis: [0, 0.92, 0], lL: flatF(0.19, 0.02), lR: flatF(-0.19, 0.02),
          aL: reach(SH(1), [0.13, 1.44, 0.68], [0, -1, 0], { p: [1, -0.2, 0] }), aR: reach(SH(-1), [-0.13, 1.44, 0.68], [0, -1, 0], { p: [-1, -0.2, 0] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e0178', lib: true, interp: 'arc', tendu: 12, name: 'Élévation latérale à la poulie', en: 'Cable lateral raise', mus: mus(m2('delt', 1)), cam: { yaw: 10, pitch: 8 },
      /* Référence : vis-à-vis, chaque main tient le câble de la poulie basse du côté opposé ; les câbles se croisent devant le bassin. */
      props: [crossover(1.05, 0.30), cableTo('L', [-1.00, 0.15, 0.30]), cableTo('R', [1.00, 0.15, 0.30])],
      poses: {
        a: { pelvis: [0, 0.92, 0], lL: flatF(0.15, 0.02), lR: flatF(-0.15, 0.02),
          aL: reach(SH(1), [0.08, 0.84, 0.36], [0, 0, -1], { p: [1, 0, -0.5] }), aR: reach(SH(-1), [-0.08, 0.84, 0.36], [0, 0, -1], { p: [-1, 0, -0.5] }) },
        b: { pelvis: [0, 0.92, 0], lL: flatF(0.15, 0.02), lR: flatF(-0.15, 0.02),
          aL: reach(SH(1), [0.80, 1.40, 0.06], [0, -1, 0], { p: [0.2, 0.2, -1] }), aR: reach(SH(-1), [-0.80, 1.40, 0.06], [0, -1, 0], { p: [-0.2, 0.2, -1] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },

    { id: 'Car_Drivers', lib: true, name: 'Car drivers', en: 'Car drivers', mus: mus(m2('delt', 1), m2('forearm', 2)), cam: { yaw: 12, pitch: 8 },
      props: [fn((C) => { const a = C.hand('L').grip, b = C.hand('R').grip; const c = C.mul(C.add(a, b), 0.5); const u = C.norm(C.sub(a, b)); const n = C.norm(C.cross(u, [0, 1, 0])); const nn = C.dot(n, [0, 0, 1]) < 0 ? C.mul(n, -1) : n;
        return [cyl(C.add(c, C.mul(nn, -0.018)), C.add(c, C.mul(nn, 0.018)), 0.225, PLATE, { held: true, name: 'disque' }), cyl(C.add(c, C.mul(nn, -0.02)), C.add(c, C.mul(nn, 0.02)), 0.03, BAR, { held: true })]; })],
      poses: (() => { const P = {}; for (const [k, th] of [['a', -40], ['b', 40]]) { const c = [0, 1.36, 0.56]; const u = [Math.cos(th * D2R), Math.sin(th * D2R), 0]; const up = [-Math.sin(th * D2R), Math.cos(th * D2R), 0];
        P[k] = { pelvis: [0, 0.92, 0], lL: flatF(0.14, 0.02), lR: flatF(-0.14, 0.02),
          aL: grip(add(c, mul(u, 0.21)), norm(add(mul(up, 0.25), [0, 0, 0.8])), mul(u, -1), { p: [1, -0.4, -0.2] }), aR: grip(sub(c, mul(u, 0.21)), norm(add(mul(up, 0.25), [0, 0, 0.8])), u, { p: [-1, -0.4, -0.2] }) }; } return P; })(),
      seq: [['a', 0.3, 1.0], ['b', 0.3, 1.0]] },

    { id: 'e0356', lib: true, interp: 'arc', tendu: 14, name: 'Élévation latérale unilatérale avec appui à l’haltère', en: 'Dumbbell one arm lateral raise with support', side: true, mus: { deltR: 1, pecR: 2 }, cam: { yaw: 20, pitch: 8 },
      props: [dbIn('R'), fn(() => [hid(tbox([0.62, 0.62, 0.02], [0.30, 0.95, 0.07], -38, PAD, { name: 'banc' })), hid(box([0.62, 0.15, 0.10], [0.12, 0.30, 0.50], FRAME)), ...ADJ(52, { c: [0.62, 0, 0.037], sy: 1.184 })])],
      poses: {
        a: { pelvis: [0, 0.92, 0], rot: [0, 0, -4], lL: flatF(0.14, 0.02), lR: flatF(-0.14, 0.02),
          aL: grip([0.56, 1.06, -0.20], [0.55, -0.55, -0.3], [0.3, -1, 0.1], { p: [0.3, -0.5, -1], tendu: false }), aR: reach(SH(-1), [-0.26, 0.74, 0.08], [1, 0, 0], { p: [-0.3, 0, -1] }) },
        b: { pelvis: [0, 0.92, 0], rot: [0, 0, -4], lL: flatF(0.14, 0.02), lR: flatF(-0.14, 0.02),
          aL: grip([0.56, 1.06, -0.20], [0.55, -0.55, -0.3], [0.3, -1, 0.1], { p: [0.3, -0.5, -1], tendu: false }), aR: reach(SH(-1), [-0.82, 1.42, 0.06], [0, -1, 0], { p: [-0.2, 0.2, -1] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e3237', lib: true, interp: 'arc', tendu: 14, name: 'Élévation latérale à la landmine', en: 'Landmine lateral raise', side: true, mus: { deltR: 1 }, cam: { yaw: -10, pitch: 10 },
      props: [fn((C) => { const h = C.hand('R'); const piv = [0.95, 0.04, 0.55]; const d = C.norm(C.sub(h.grip, piv)); const end = C.add(h.grip, C.mul(d, 0.12));
        return [cyl(piv, end, 0.016, BAR, { held: true, name: 'barre' }), cyl(C.add(h.grip, C.mul(d, 0.12)), C.add(h.grip, C.mul(d, 0.16)), 0.12, PLATE, { name: 'disque', held: true }), box([0.95, 0.03, 0.55], [0.22, 0.06, 0.22], PLATE, { name: 'socle' })]; })],
      poses: {
        a: { pelvis: [0, 0.92, 0], lL: flatF(0.15, 0.02), lR: flatF(-0.15, 0.02),
          aL: reach(SH(1), [0.27, 0.74, 0.03], [-1, 0, 0], { p: [0.2, 0, -1] }), aR: reach(SH(-1), [-0.04, 0.92, 0.36], [0.6, 0, -0.8], { p: [-0.6, 0, -1] }) },
        b: { pelvis: [0, 0.92, 0], lL: flatF(0.15, 0.02), lR: flatF(-0.15, 0.02),
          aL: reach(SH(1), [0.27, 0.74, 0.03], [-1, 0, 0], { p: [0.2, 0, -1] }), aR: reach(SH(-1), [-0.72, 1.55, 0.14], [0, -1, 0.2], { p: [-0.2, 0.2, -1] }) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.3, 1.3]] },

    { id: 'e0154', lib: true, interp: 'arc', tendu: 14, name: 'Oiseau croisé à la poulie (vis-à-vis)', en: 'Cable cross-over revers fly', mus: mus(m2('deltP', 1), m2('rhomb', 2)), cam: { yaw: 150, pitch: 22 },
      props: [crossover(1.05, 0.25), cableTo('L', [-1.00, 0.12, 0.25]), cableTo('R', [1.00, 0.12, 0.25])],
      poses: {
        a: { pelvis: [0, 0.88, -0.14], rot: [76, 0, 0], neck: [-30, 0, 0], lL: flatF(0.15, 0.02, { p: [0.2, 0, 1] }), lR: flatF(-0.15, 0.02, { p: [-0.2, 0, 1] }),
          aL: grip([-0.05, 0.47, 0.34], [0, -1, 0], [-1, 0, 0], { p: [1, 0.3, 0] }), aR: grip([0.05, 0.58, 0.44], [0, -1, 0], [1, 0, 0], { p: [-1, 0.3, 0] }) },
        b: { pelvis: [0, 0.88, -0.14], rot: [76, 0, 0], neck: [-30, 0, 0], lL: flatF(0.15, 0.02, { p: [0.2, 0, 1] }), lR: flatF(-0.15, 0.02, { p: [-0.2, 0, 1] }),
          aL: grip([0.80, 0.96, 0.36], [1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }), aR: grip([-0.80, 0.96, 0.36], [-1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e0380', lib: true, interp: 'arc', tendu: 14, name: 'Élévation latérale arrière aux haltères', en: 'Dumbbell rear lateral raise', mus: mus(m2('deltP', 1), m2('rhomb', 2), m2('trap', 2)), cam: { yaw: 150, pitch: 22 },
      props: dbs(),
      poses: {
        a: { pelvis: [0, 0.80, -0.24], rot: [80, 0, 0], neck: [-12, 0, 0], lL: flatF(0.14, 0.04, { p: [0.2, 0, 1] }), lR: flatF(-0.14, 0.04, { p: [-0.2, 0, 1] }),
          aL: grip([0.15, 0.30, 0.24], [0, -1, 0], [-1, 0, 0], { p: [1, 0.3, 0] }), aR: grip([-0.15, 0.30, 0.24], [0, -1, 0], [1, 0, 0], { p: [-1, 0.3, 0] }) },
        b: { pelvis: [0, 0.80, -0.24], rot: [80, 0, 0], neck: [-12, 0, 0], lL: flatF(0.14, 0.04, { p: [0.2, 0, 1] }), lR: flatF(-0.14, 0.04, { p: [-0.2, 0, 1] }),
          aL: grip([0.78, 0.86, 0.20], [1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }), aR: grip([-0.78, 0.86, 0.20], [-1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e0379', lib: true, interp: 'arc', tendu: 14, name: 'Élévation latérale arrière aux haltères (tête en appui)', en: 'Dumbbell rear lateral raise (support head)', mus: mus(m2('deltP', 1), m2('rhomb', 2), m2('trap', 2)), cam: { yaw: 140, pitch: 22 },
      props: [...dbs(), fn(() => [hid(tbox([0, 0.655, 0.835], [0.30, 0.80, 0.07], -40, PAD, { name: 'banc' })), hid(box([0, 0.17, 0.98], [0.12, 0.34, 0.46], FRAME)), ...ADJ(50, { c: [0, 0, 0.93], sy: 1.10 })])],
      poses: {
        a: { pelvis: [0, 0.88, -0.20], rot: [78, 0, 0], neck: [-15, 0, 0], lL: flatF(0.13, 0.02, { p: [0.15, 0, 1] }), lR: flatF(-0.13, 0.02, { p: [-0.15, 0, 1] }),
          aL: grip([0.14, 0.42, 0.32], [0, -1, 0], [-1, 0, 0], { p: [1, 0.3, 0] }), aR: grip([-0.14, 0.42, 0.32], [0, -1, 0], [1, 0, 0], { p: [-1, 0.3, 0] }) },
        b: { pelvis: [0, 0.88, -0.20], rot: [78, 0, 0], neck: [-15, 0, 0], lL: flatF(0.13, 0.02, { p: [0.15, 0, 1] }), lR: flatF(-0.13, 0.02, { p: [-0.15, 0, 1] }),
          aL: grip([0.78, 0.92, 0.30], [1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }), aR: grip([-0.78, 0.92, 0.30], [-1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },

    { id: 'Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench', lib: true, interp: 'arc', tendu: 14, name: 'Oiseau penché aux haltères tête sur banc', en: 'Bent over dumbbell rear delt raise with head on bench', mus: mus(m2('deltP', 1)), cam: { yaw: 140, pitch: 22 },
      props: [...dbs(), fn(() => [hid(tbox([0, 0.655, 0.835], [0.30, 0.80, 0.07], -40, PAD, { name: 'banc' })), hid(box([0, 0.17, 0.98], [0.12, 0.34, 0.46], FRAME)), ...ADJ(50, { c: [0, 0, 0.93], sy: 1.10 })])],
      poses: {
        a: { pelvis: [0, 0.88, -0.20], rot: [78, 0, 0], neck: [-15, 0, 0], lL: flatF(0.13, 0.02, { p: [0.15, 0, 1] }), lR: flatF(-0.13, 0.02, { p: [-0.15, 0, 1] }),
          aL: grip([0.14, 0.42, 0.32], [0, -1, 0], [-1, 0, 0], { p: [1, 0.3, 0] }), aR: grip([-0.14, 0.42, 0.32], [0, -1, 0], [1, 0, 0], { p: [-1, 0.3, 0] }) },
        b: { pelvis: [0, 0.88, -0.20], rot: [78, 0, 0], neck: [-15, 0, 0], lL: flatF(0.13, 0.02, { p: [0.15, 0, 1] }), lR: flatF(-0.13, 0.02, { p: [-0.15, 0, 1] }),
          aL: grip([0.78, 0.92, 0.30], [1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }), aR: grip([-0.78, 0.92, 0.30], [-1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e0326', lib: true, interp: 'arc', tendu: 14, name: 'Élévation latérale arrière sur banc incliné aux haltères', en: 'Dumbbell incline rear lateral raise', mus: mus(m2('deltP', 1), m2('trap', 2)), cam: { yaw: 140, pitch: 25 },
      props: [...dbs(), fn(() => [hid(box([0, 0.18, 0.05], [0.12, 0.36, 0.60], FRAME)), ...ADJ(40, { yaw: 180, c: [0, 0, -0.16], sy: 1.04, noSeat: true })])],
      poses: {
        a: { float: true, pelvis: [0, 0.665, -0.22], rot: [50, 0, 0], neck: [-24, 0, 0], lL: { at: [0.13, 0.15, -0.95], p: [0, -1, 0.3], foot: { toe: [0, -0.35, 0.94], up: [0, 0.94, 0.35] } }, lR: { at: [-0.13, 0.15, -0.95], p: [0, -1, 0.3], foot: { toe: [0, -0.35, 0.94], up: [0, 0.94, 0.35] } },
          aL: grip([0.20, 0.36, 0.17], [0, -1, 0], [-1, 0, 0], { p: [1, 0.3, 0] }), aR: grip([-0.20, 0.36, 0.17], [0, -1, 0], [1, 0, 0], { p: [-1, 0.3, 0] }) },
        b: { float: true, pelvis: [0, 0.665, -0.22], rot: [50, 0, 0], neck: [-24, 0, 0], lL: { at: [0.13, 0.15, -0.95], p: [0, -1, 0.3], foot: { toe: [0, -0.35, 0.94], up: [0, 0.94, 0.35] } }, lR: { at: [-0.13, 0.15, -0.95], p: [0, -1, 0.3], foot: { toe: [0, -0.35, 0.94], up: [0, 0.94, 0.35] } },
          aL: grip([0.80, 0.930, 0.34], [1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }), aR: grip([-0.80, 0.930, 0.34], [-1, 0, 0], [0, -1, 0], { p: [0, 1, -0.4] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },

    { id: 'e0240', lib: true, interp: 'arc', tendu: 14, name: 'Oiseau allongé sur le dos à la poulie', en: 'Cable supine reverse fly', mus: mus(m2('deltP', 1)), cam: { yaw: 50, pitch: 25 },
      props: [fn(() => bench(-0.80, 0.13, 0.44)), crossover(0.95, -0.30), cableTo('L', [-0.90, 2.05, -0.30]), cableTo('R', [0.90, 2.05, -0.30])],
      poses: {
        a: { float: true, pelvis: [0, 0.605, 0.05], rot: [-90, 0, 0], neck: [8, 0, 0], lL: flatF(0.22, 0.60, { p: [0.2, 1, 0.4] }), lR: flatF(-0.22, 0.60, { p: [-0.2, 1, 0.4] }),
          aL: grip([0.12, 1.22, -0.44], [0, 1, 0], [-1, 0, 0], { p: [1, -0.2, 0] }), aR: grip([-0.12, 1.22, -0.44], [0, 1, 0], [1, 0, 0], { p: [-1, -0.2, 0] }) },
        b: { float: true, pelvis: [0, 0.605, 0.05], rot: [-90, 0, 0], neck: [8, 0, 0], lL: flatF(0.22, 0.60, { p: [0.2, 1, 0.4] }), lR: flatF(-0.22, 0.60, { p: [-0.2, 1, 0.4] }),
          aL: grip([0.80, 0.66, -0.42], [1, 0, 0], [0, 1, 0], { p: [0, -1, 0.3] }), aR: grip([-0.80, 0.66, -0.42], [-1, 0, 0], [0, 1, 0], { p: [0, -1, 0.3] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.2]] },
    /* ======================= DOS ======================= */
    { id: 'e1314', lib: true, name: 'Extension du dos sur swiss ball', en: 'Back extension on exercise ball', mus: mus(m2('low', 1)), cam: { yaw: 120, pitch: 30 },
      props: [fn(() => [hid(sph([0, 0.30, 0.04], 0.30, BALL, { name: 'ballon' })), MESH('ballon', [0, 0, 0.04], { s: 0.857 })])],
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
      props: [fn(() => [hid(sph([0, 0.30, 0.04], 0.30, BALL, { name: 'ballon' })), MESH('ballon', [0, 0, 0.04], { s: 0.857 })])],
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
      props: [fn(() => [MESH('hyper', [0, 0, -0.25], { s: 0.9 })])],
      poses: {
        a: { float: true, pelvis: [0, 1.026, -0.056], rot: [128, 0, 0], spine: [10, 0, 0], neck: [8, 0, 0],
          lL: { at: [0.12, 0.296, -0.523], foot: { toe: [0, -0.555, 0.832], up: [0, 0.832, 0.555] } }, lR: { at: [-0.12, 0.296, -0.523], foot: { toe: [0, -0.555, 0.832], up: [0, 0.832, 0.555] } },
          aL: HBH(1), aR: HBH(-1) },
        b: { float: true, pelvis: [0, 1.026, -0.056], rot: [56, 0, 0], spine: [-4, 0, 0], neck: [-6, 0, 0],
          lL: { at: [0.12, 0.296, -0.523], foot: { toe: [0, -0.555, 0.832], up: [0, 0.832, 0.555] } }, lR: { at: [-0.12, 0.296, -0.523], foot: { toe: [0, -0.555, 0.832], up: [0, 0.832, 0.555] } },
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
          aL: { grab: { bone: 'UpperLeg_L', h: 0.80, ang: 5, f: 1, tilt: 25 }, p: [0.6, 0, -1] }, aR: grip([-0.21, 0.40, 0.36], [0, -1, 0], [1, 0, 0], { p: [-0.3, 0, -1] }) },
        b: { pelvis: [0, 0.86, -0.12], rot: [58, 0, 0], neck: [-22, 0, 0], lL: flatF(0.15, 0.02, { p: [0.2, 0, 1] }), lR: flatF(-0.15, 0.02, { p: [-0.2, 0, 1] }),
          aL: { grab: { bone: 'UpperLeg_L', h: 0.80, ang: 5, f: 1, tilt: 25 }, p: [0.6, 0, -1] }, aR: grip([-0.28, 0.75, 0.10], [0, -1, 0], [1, 0, 0], { p: [-0.2, 1, -0.6] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.4, 1.1]] },

    { id: 'e0983', lib: true, name: 'Tirage vertical unilatéral à genoux à l’élastique', en: 'Band kneeling one arm pulldown', side: true, mus: { latR: 1, rhombR: 2 }, cam: { yaw: 210, pitch: 12 },
      props: [bandTo('R', [-0.35, 2.4, 1.4]), fn(() => [sph([-0.35, 2.4, 1.4], 0.03, FRAME, { name: 'ancrage' })])],
      poses: {
        a: { pelvis: [0, 0.62, -0.05], rot: [28, 0, 0], neck: [-6, 0, 0], lL: KN(1), lR: flatF(-0.17, 0.48, { p: [-0.2, 0, 1] }),
          aL: { grab: { bone: 'UpperLeg_L', h: 0.30, ang: 30, f: 1, tilt: 25 }, p: [0.8, 0, -0.5] }, aR: reach(SH(-1, 1.30, 0.30), [-0.30, 1.85, 0.75], [1, 0, 0], { p: [-1, -0.3, 0] }) },
        b: { pelvis: [0, 0.62, -0.05], rot: [28, 0, 0], neck: [-6, 0, 0], lL: KN(1), lR: flatF(-0.17, 0.48, { p: [-0.2, 0, 1] }),
          aL: { grab: { bone: 'UpperLeg_L', h: 0.30, ang: 30, f: 1, tilt: 25 }, p: [0.8, 0, -0.5] }, aR: grip([-0.26, 1.08, 0.26], [0, 1, 0.3], [0.8, 0, 0.3], { p: [-0.6, -1, -0.5] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.4, 1.1]] },

    { id: 'e0238', lib: true, interp: 'arc', tendu: 14, name: 'Tirage bras tendus à la poulie', en: 'Cable straight arm pulldown', mus: mus(m2('lat', 1), m2('deltP', 2), m2('triceps', 2)), cam: { yaw: 120, pitch: 10 },
      props: [tower(0, 0.85, 2.3, { w: 0.6 }), fn((C) => { const a = C.hand('L').grip, b = C.hand('R').grip; const m = C.mul(C.add(a, b), 0.5); const u = C.norm(C.sub(a, b));
        return [cyl(C.add(m, C.mul(u, -0.33)), C.add(m, C.mul(u, 0.33)), 0.014, BAR, { held: true, name: 'barre' }), cyl(m, [0, 2.15, 0.75], 0.006, CABLE, { soft: true }), sph([0, 2.15, 0.75], 0.04, FRAME, { name: 'poulie' })]; })],
      poses: {
        a: { pelvis: [0, 0.91, -0.05], rot: [16, 0, 0], neck: [-6, 0, 0], lL: flatF(0.14, -0.02), lR: flatF(-0.14, -0.02),
          aL: grip([0.24, 1.55, 0.60], [0, 0.75, 0.66], [0, -1, 0.8], { p: [1, 0, 0] }), aR: grip([-0.24, 1.55, 0.60], [0, 0.75, 0.66], [0, -1, 0.8], { p: [-1, 0, 0] }) },
        b: { pelvis: [0, 0.91, -0.05], rot: [16, 0, 0], neck: [-6, 0, 0], lL: flatF(0.14, -0.02), lR: flatF(-0.14, -0.02),
          aL: grip([0.24, 0.86, 0.26], [0, -0.9, 0.4], [0, -0.4, -1], { p: [1, 0, -0.3] }), aR: grip([-0.24, 0.86, 0.26], [0, -0.9, 0.4], [0, -0.4, -1], { p: [-1, 0, -0.3] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.4, 1.1]] },

    { id: 'e0150', lib: true, name: 'Tirage vertical à la barre, poulie haute', en: 'Cable bar lateral pulldown', mus: mus(m2('lat', 1), m2('rhomb', 2), m2('biceps', 2)), cam: { yaw: 200, pitch: 10 },
      props: [fn(() => [MESH('lat', [0, 0, 0.40], { part: 'frame' }), MESH('lat', [0, 0.11, 0.40], { part: 'genoux' }), hid(box([0, 0.44, -0.01], [0.26, 0.07, 0.47], PAD, { name: 'siège' }))]), fn((C) => { const a = C.hand('L').grip, b = C.hand('R').grip; const m = C.mul(C.add(a, b), 0.5); const u = C.norm(C.sub(a, b));
        return [cyl(C.add(m, C.mul(u, -0.60)), C.add(m, C.mul(u, 0.60)), 0.014, BAR, { held: true, name: 'barre' }), cyl(m, [0, 2.13, 0.103], 0.006, CABLE, { soft: true }), sph([0, 2.13, 0.103], 0.04, FRAME, { name: 'poulie' })]; })],
      poses: {
        a: { float: true, pelvis: [0, 0.632, 0.000], rot: [-6, 0, 0], neck: [6, 0, 0], lL: flatF(0.22, 0.42), lR: flatF(-0.22, 0.42),
          aL: grip([0.45, 1.906, 0.16], [0, 1, 0.1], [0, -0.1, 1], { p: [1, 0, -0.3] }), aR: grip([-0.45, 1.906, 0.16], [0, 1, 0.1], [0, -0.1, 1], { p: [-1, 0, -0.3] }) },
        b: { float: true, pelvis: [0, 0.632, 0.000], rot: [-10, 0, 0], neck: [10, 0, 0], lL: flatF(0.22, 0.42), lR: flatF(-0.22, 0.42),
          aL: grip([0.42, 1.326, 0.20], [0, 1, 0.1], [0, -0.1, 1], { p: [1, -0.8, -0.3] }), aR: grip([-0.42, 1.326, 0.20], [0, 1, 0.1], [0, -0.1, 1], { p: [-1, -0.8, -0.3] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.4, 1.1]] },

    { id: 'e0214', lib: true, name: 'Rowing assis unilatéral alterné à la poulie', en: 'Cable seated one arm alternate row', mus: mus(m2('rhomb', 1), m2('lat', 2), m2('deltP', 2), m2('trap', 2)), cam: { yaw: 230, pitch: 10 },
      props: [fn(() => bench(-1.10, 0.20, 0.45)), tower(0, 1.75, 2.1, { w: 0.6 }), cableTo('L', [0.10, 1.05, 1.62]), cableTo('R', [-0.10, 1.05, 1.62])],
      poses: {
        a: { float: true, pelvis: [0, 0.606, 0.0], rot: [0, 0, 0], lL: flatF(0.20, 0.45), lR: flatF(-0.20, 0.45),
          aL: grip([0.18, 1.08, 0.62], [-0.03, 0.01, 1], [-1, 0, -0.03], { p: [1, -0.4, 0] }), aR: grip([-0.20, 1.02, 0.18], [0.72, -0.13, 0.69], [0.7, 0.14, -0.7], { p: [-0.4, 0.3, -1] }) },
        b: { float: true, pelvis: [0, 0.606, 0.0], rot: [0, 0, 0], lL: flatF(0.20, 0.45), lR: flatF(-0.20, 0.45),
          aL: grip([0.20, 1.02, 0.18], [-0.72, -0.13, 0.69], [-0.7, 0.14, -0.7], { p: [0.4, 0.3, -1] }), aR: grip([-0.18, 1.08, 0.62], [0.03, 0.01, 1], [1, 0, -0.03], { p: [-1, -0.4, 0] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.1]] },

    { id: 'e0861', lib: true, interp: 'fk', name: 'Tirage horizontal assis à la poulie', en: 'Cable seated row', mus: mus(m2('rhomb', 1), m2('trap', 2), m2('lat', 2), m2('deltP', 2)), cam: { yaw: 230, pitch: 10 },
      props: [fn(() => [MESH('rowc', [0, 0, 0.66]), hid(box([0, 0.475, -0.14], [0.26, 0.07, 0.77], PAD, { name: 'banc' }))]),
        fn((C) => { const a = C.hand('L').grip, b = C.hand('R').grip; const m = C.mul(C.add(a, b), 0.5); const fw = C.norm(C.sub([0, 0.585, 1.205], m)); const tip = C.add(m, C.mul(fw, 0.12));
          return [cyl(C.add(a, C.mul(C.hand('L').across, 0.06)), C.add(a, C.mul(C.hand('L').across, -0.06)), 0.015, PLATE, { held: true, name: 'poignée' }), cyl(C.add(b, C.mul(C.hand('R').across, 0.06)), C.add(b, C.mul(C.hand('R').across, -0.06)), 0.015, PLATE, { held: true, name: 'poignée' }),
            cyl(a, tip, 0.012, BAR, { held: true }), cyl(b, tip, 0.012, BAR, { held: true }), cyl(tip, [0, 0.585, 1.205], 0.006, CABLE, { soft: true }), sph([0, 0.585, 1.205], 0.04, FRAME, { name: 'poulie' })]; })],
      poses: {
        a: { float: true, pelvis: [0, 0.666, -0.050], rot: [40, 0, 0], neck: [-20, 0, 0],
          lL: { at: [0.13, 0.42, 0.74], foot: { toe: [0, 0.95, 0.3], up: [0, 0.3, -0.95] }, p: [0.2, 1, 0] }, lR: { at: [-0.13, 0.42, 0.74], foot: { toe: [0, 0.95, 0.3], up: [0, 0.3, -0.95] }, p: [-0.2, 1, 0] },
          aL: grip([0.06, 0.910, 0.80], [0, -0.15, 1], [-1, 0, 0], { p: [0.3, -1, -0.2] }), aR: grip([-0.06, 0.910, 0.80], [0, -0.15, 1], [1, 0, 0], { p: [-0.3, -1, -0.2] }) },
        b: { float: true, pelvis: [0, 0.666, -0.050], rot: [-8, 0, 0], neck: [6, 0, 0],
          lL: { at: [0.13, 0.42, 0.74], foot: { toe: [0, 0.95, 0.3], up: [0, 0.3, -0.95] }, p: [0.2, 1, 0] }, lR: { at: [-0.13, 0.42, 0.74], foot: { toe: [0, 0.95, 0.3], up: [0, 0.3, -0.95] }, p: [-0.2, 1, 0] },
          aL: grip([0.10, 0.880, 0.30], [0, -0.1, 1], [-1, 0, 0], { p: [0.6, -0.4, -1] }), aR: grip([-0.10, 0.880, 0.30], [0, -0.1, 1], [1, 0, 0], { p: [-0.6, -0.4, -1] }) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.4, 1.2]] },

    { id: 'e0571', lib: true, name: 'Tirage horizontal assis prise serrée alterné à la machine', en: 'Lever alternating narrow grip seated row', mus: mus(m2('rhomb', 1), m2('lat', 2), m2('trap', 2), m2('deltP', 2)), cam: { yaw: 230, pitch: 12 },
      props: [fn(() => [MESH('row', [0, 0, 0], { part: 'frame' })]),
        /* Modèle « Seated Row Machine » (louis_l2y, CC BY 4.0) : chaque bras tourne autour de son axe bas (y 0,354, z 0,331) et suit la main qui tire. */
        fn((C) => ['L', 'R'].map((sd) => ROTM('row', 'levier' + sd, [0, 0, 0], [0, 0.354, 0.331], 'x', angX(C.hand(sd).grip, [0, 0.354, 0.331]) - 1.4029, { held: true })))],
      poses: {
        a: { float: true, pelvis: [0, 1.054, -0.588], rot: [17, 0, 0], neck: [-12, 0, 0], lL: { at: [0.075, 0.405, -0.24], p: [0.6, 0.3, 1], foot: { toe: [0.1, -0.25, 1], up: [0, 1, 0.25] } }, lR: { at: [-0.075, 0.405, -0.24], p: [-0.6, 0.3, 1], foot: { toe: [-0.1, -0.25, 1], up: [0, 1, 0.25] } }, aL: grip([0.091, 1.474, 0.174], [-0.21, -0.04, 0.98], [-0.97, -0.09, -0.21], { p: [1, -0.6, -0.3] }), aR: grip([-0.091, 1.403, -0.093], [0.71, 0.31, 0.63], [0.7, -0.41, -0.59], { p: [-1, -0.6, -0.3] }) },
        b: { float: true, pelvis: [0, 1.054, -0.588], rot: [17, 0, 0], neck: [-12, 0, 0], lL: { at: [0.075, 0.405, -0.24], p: [0.6, 0.3, 1], foot: { toe: [0.1, -0.25, 1], up: [0, 1, 0.25] } }, lR: { at: [-0.075, 0.405, -0.24], p: [-0.6, 0.3, 1], foot: { toe: [-0.1, -0.25, 1], up: [0, 1, 0.25] } }, aL: grip([0.091, 1.403, -0.093], [-0.71, 0.31, 0.63], [-0.7, -0.41, -0.59], { p: [1, -0.6, -0.3] }), aR: grip([-0.091, 1.474, 0.174], [0.21, -0.04, 0.98], [0.97, -0.09, -0.21], { p: [-1, -0.6, -0.3] }) },
      },
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.1]] },

    { id: 'e0499', lib: true, name: 'Rowing inversé (traction australienne)', en: 'Inverted row', mus: mus(m2('rhomb', 1), m2('lat', 2), m2('biceps', 2)), cam: { yaw: 70, pitch: 10 },
      props: [fn(() => [cyl([-0.75, 1.08, -0.33], [0.75, 1.08, -0.33], 0.016, BAR, { held: true, name: 'barre' }), MESH('cage', [0, 0, -0.122], { s: [1.94, 1.74, 0.5] })])],
      poses: {
        a: { float: true, pelvis: [0, 0.33, 0.12], rot: [-75, 0, 0], neck: [10, 0, 0],
          lL: { at: [0.11, 0.10, 0.95], foot: { toe: [0, 0.7, 0.7], up: [0, 0.7, -0.7] } }, lR: { at: [-0.11, 0.10, 0.95], foot: { toe: [0, 0.7, 0.7], up: [0, 0.7, -0.7] } },
          aL: grip([0.40, 1.08, -0.33], [0, 1, 0], [0, 0, 1], { p: [1, 0, 0.2] }), aR: grip([-0.40, 1.08, -0.33], [0, 1, 0], [0, 0, 1], { p: [-1, 0, 0.2] }) },
        b: { float: true, pelvis: [0, 0.56, 0.24], rot: [-57, 0, 0], neck: [-6, 0, 0],
          lL: { at: [0.11, 0.10, 0.95], foot: { toe: [0, 0.7, 0.7], up: [0, 0.7, -0.7] } }, lR: { at: [-0.11, 0.10, 0.95], foot: { toe: [0, 0.7, 0.7], up: [0, 0.7, -0.7] } },
          aL: grip([0.40, 1.08, -0.33], [0, 1, 0], [0, 0, 1], { p: [1, -0.6, 0.6] }), aR: grip([-0.40, 1.08, -0.33], [0, 1, 0], [0, 0, 1], { p: [-1, -0.6, 0.6] }) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.4, 1.2]] },

    { id: 'e0017', lib: true, name: 'Traction assistée', en: 'Assisted pull-up', mus: mus(m2('lat', 1), m2('rhomb', 2), m2('trap', 2), m2('deltP', 2)), cam: { yaw: 200, pitch: 8 },
      props: [fn(() => [MESH('chin', [0, 0, 0.30], { part: 'frame', s: 0.94, held: true })]),
        /* Modèle « Intenza DL12 Assisted Chin/Dip » : le plateau des genoux tourne autour de son axe (y 0,975, z -0,124 dans le modèle). */
        fn((C) => { const K = C.mul(C.add(C.bone('LowerLeg_L').at([0, -0.08, 0.06]), C.bone('LowerLeg_R').at([0, -0.08, 0.06])), 0.5); const P = [0, 0.975 * 0.94, 0.30 - 0.124 * 0.94];
          const r = 0.391 * 0.94; const a = Math.PI - Math.asin(Math.max(-1, Math.min(1, (K[1] - P[1]) / r))) - Math.atan2(0.085, -0.382);   // le plateau suit la hauteur des genoux
          return [ROTM('chin', 'plateau', [0, 0, 0.30], [0, 0.975, -0.124], 'x', a, { s: 0.94, nocheck: true })]; })],
      poses: {
        a: { float: true, pelvis: [0, 1.14, -0.02], rot: [-4, 0, 0], neck: [-6, 0, 0],
          lL: { db: [0.08, -1, 0.05], eb: [0.02, 0, -1], foot: 30 }, lR: { db: [-0.08, -1, 0.05], eb: [-0.02, 0, -1], foot: 30 },
          aL: grip([0.42, 2.16, 0.02], [0, 1, 0], [-1, 0, 0], { p: [1, 0, -0.3] }), aR: grip([-0.42, 2.16, 0.02], [0, 1, 0], [1, 0, 0], { p: [-1, 0, -0.3] }) },
        b: { float: true, pelvis: [0, 1.55, -0.06], rot: [-8, 0, 0], neck: [-14, 0, 0],
          lL: { db: [0.08, -1, 0.05], eb: [0.02, 0, -1], foot: 30 }, lR: { db: [-0.08, -1, 0.05], eb: [-0.02, 0, -1], foot: 30 },
          aL: grip([0.42, 2.16, 0.02], [0, 1, 0], [-1, 0, 0], { p: [1, -0.6, -0.5] }), aR: grip([-0.42, 2.16, 0.02], [0, 1, 0], [1, 0, 0], { p: [-1, -0.6, -0.5] }) },
      },
      seq: [['a', 0.4, 1.3], ['b', 0.4, 1.3]] },
    /* ======================= BRAS ======================= */
    { id: 'e0447', lib: true, interp: 'fk', name: 'Curl à la barre EZ', en: 'Ez barbell curl', mus: mus(m2('biceps', 1), m2('forearm', 2)), cam: { yaw: 35, pitch: 8 },
      props: [barbell({ half: 0.62, plate: 0.17, pin: 0.48, pw: 0.05 })],
      poses: (() => { const base = { pelvis: [0, 0.92, 0], lL: flatF(0.13, 0.02), lR: flatF(-0.13, 0.02) }; const U = { u: [0.18, -1, 0.18] };
        return { a: Object.assign({}, base, { aL: curlB(1, 22, U), aR: curlB(-1, 22, U) }), b: Object.assign({}, base, { aL: curlB(1, 135, U), aR: curlB(-1, 135, U) }) }; })(),
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.1]] },

    { id: 'e0391', lib: true, interp: 'fk', name: 'Curl assis aux haltères', en: 'Dumbbell seated curl', mus: mus(m2('biceps', 1), m2('forearm', 2)), cam: { yaw: 35, pitch: 8 },
      props: [...dbs(), fn(() => bench(-0.90, 0.15, 0.45))],
      poses: (() => { const base = { float: true, pelvis: [0, 0.606, -0.02], lL: flatF(0.22, 0.42), lR: flatF(-0.22, 0.42) }; const U = { u: [0.30, -1, -0.02], carry: 0.15 };
        return { a: Object.assign({}, base, { aL: curlB(1, 8, U), aR: curlB(-1, 8, U) }), b: Object.assign({}, base, { aL: curlB(1, 135, U), aR: curlB(-1, 135, U) }) }; })(),
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.1]] },

    { id: 'e1677', lib: true, interp: 'fk', name: 'Curl biceps assis aux haltères', en: 'Dumbbell seated bicep curl', mus: mus(m2('biceps', 1), m2('forearm', 2)), cam: { yaw: 30, pitch: 8 },
      props: [...dbs(), fn(() => UPB())],
      poses: (() => { const base = { float: true, pelvis: [0, 0.610, -0.02], rot: [-8, 0, 0], neck: [4, 0, 0], lL: flatF(0.24, 0.40), lR: flatF(-0.24, 0.40) }; const U = { u: [0.30, -1, -0.02], carry: 0.15 };
        return { a: Object.assign({}, base, { aL: curlB(1, 8, U), aR: curlB(-1, 8, U) }), b: Object.assign({}, base, { aL: curlB(1, 135, U), aR: curlB(-1, 135, U) }) }; })(),
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.1]] },

    { id: 'e1648', lib: true, interp: 'fk', name: 'Curl marteau alterné assis aux haltères', en: 'Dumbbell alternate seated hammer curl', mus: mus(m2('biceps', 1), m2('forearm', 2)), cam: { yaw: 30, pitch: 8 },
      props: [...dbs(), fn(() => UPB())],
      poses: (() => { const U = { u: [0.36, -1, -0.02], carry: 0.30, palm: 'neutre' };
        const base = { float: true, pelvis: [0, 0.610, -0.02], rot: [-8, 0, 0], neck: [4, 0, 0], lL: flatF(0.24, 0.40), lR: flatF(-0.24, 0.40) };
        return { a: Object.assign({}, base, { aL: curlB(1, 8, U), aR: curlB(-1, 8, U) }), b: Object.assign({}, base, { aL: curlB(1, 135, U), aR: curlB(-1, 8, U) }), c: Object.assign({}, base, { aL: curlB(1, 8, U), aR: curlB(-1, 135, U) }) }; })(),
      seq: [['b', 0.3, 1.3], ['c', 0.3, 1.3]] },   // comme la référence : un bras monte pendant que l'autre descend

    { id: 'e3547', lib: true, interp: 'fk', name: 'Curl biceps puis développé épaules assis aux haltères', en: 'Dumbbell seated biceps curl to shoulder press', mus: mus(m2('biceps', 1), m2('delt', 2), m2('forearm', 2)), cam: { yaw: 30, pitch: 8 },
      props: [...dbs(), fn(() => UPB())],
      poses: (() => { const base = { float: true, pelvis: [0, 0.618, -0.02], rot: [-8, 0, 0], neck: [4, 0, 0], lL: flatF(0.24, 0.42), lR: flatF(-0.24, 0.42) }; const U = { u: [0.30, -1, -0.02], carry: 0.15 };
        /* développé : bras écartés, avant-bras verticaux, paumes vers l'avant (directions dans le repère du thorax) */
        const pr = (s, up) => ({ db: norm([s * (up ? 0.45 : 0.98), up ? 0.89 : -0.12, 0.05]), eb: norm([s * (up ? -0.12 : 0), 1, 0.04]), hand: { db: norm([s * (up ? -0.12 : 0), 1, 0.04]), nb: [0, 0, 1] }, close: 1 });
        return { a: Object.assign({}, base, { aL: curlB(1, 8, U), aR: curlB(-1, 8, U) }), m: Object.assign({}, base, { aL: curlB(1, 135, U), aR: curlB(-1, 135, U) }),
          r: Object.assign({}, base, { aL: pr(1, false), aR: pr(-1, false) }), b: Object.assign({}, base, { aL: pr(1, true), aR: pr(-1, true) }) }; })(),
      seq: [['a', 0.2, 0.9], ['m', 0.1, 0.6], ['r', 0, 0.6], ['b', 0.3, 0.9], ['r', 0, 0.6], ['m', 0.1, 0.9]] },

    { id: 'e0315', lib: true, interp: 'fk', name: 'Curl biceps sur banc incliné aux haltères', en: 'Dumbbell incline biceps curl', mus: mus(m2('biceps', 1), m2('forearm', 2)), cam: { yaw: 60, pitch: 12 },
      props: [...dbs(), fn(() => INB55())],
      poses: (() => { const base = { float: true, pelvis: [0, 0.645, 0.04], rot: [-35, 0, 0], neck: [6, 0, 0], lL: flatF(0.22, 0.39), lR: flatF(-0.22, 0.39) }; const U = { u: [0.30, -0.82, -0.57], carry: 0.25 };   // bras à la verticale : vers l'arrière dans le repère du buste incliné
        return { a: Object.assign({}, base, { aL: curlB(1, 8, U), aR: curlB(-1, 8, U) }), b: Object.assign({}, base, { aL: curlB(1, 140, U), aR: curlB(-1, 140, U) }) }; })(),
      seq: [['a', 0.3, 1.2], ['b', 0.3, 1.2]] },

    { id: 'e0318', lib: true, interp: 'fk', name: 'Curl incliné aux haltères', en: 'Dumbbell incline curl', mus: mus(m2('biceps', 1)), cam: { yaw: 60, pitch: 12 },
      props: [...dbs(), fn(() => INB55())],
      poses: (() => { const base = { float: true, pelvis: [0, 0.645, 0.04], rot: [-35, 0, 0], neck: [6, 0, 0], lL: flatF(0.22, 0.39), lR: flatF(-0.22, 0.39) }; const U = { u: [0.30, -0.82, -0.57], carry: 0.25 };   // bras à la verticale : vers l'arrière dans le repère du buste incliné
        return { b: Object.assign({}, base, { aL: curlB(1, 8, U), aR: curlB(-1, 140, U) }), c: Object.assign({}, base, { aL: curlB(1, 140, U), aR: curlB(-1, 8, U) }) }; })(),
      seq: [['b', 0.3, 1.3], ['c', 0.3, 1.3]] },

    { id: 'e0297', lib: true, interp: 'fk', name: 'Curl concentré à l’haltère', en: 'Dumbbell concentration curl', side: true, mus: { bicepsR: 1, forearmR: 2 }, cam: { yaw: 20, pitch: 15 },
      props: [dbIn('R'), fn(() => bench(-0.90, 0.12, 0.45))],
      poses: (() => { /* bras droit vertical, coude contre l'intérieur de la cuisse ; buste penché de 38° (bras vers l'avant dans le repère du buste) */
        const base = { float: true, pelvis: [0, 0.606, -0.04], rot: [42, 15, 0], neck: [-14, 0, 0], lL: flatF(0.28, 0.42, { p: [0.6, 0.3, 0.6] }), lR: flatF(-0.32, 0.42, { p: [-0.6, 0.3, 0.6] }),
          aL: grip([0.25, 0.64, 0.30], [0, -0.35, 1], [0, -1, -0.3], { p: [1, 0, -0.3], close: 0.3 }) };
        const U = { u: [-0.20, -0.79, 0.62], carry: 0 };
        return { a: Object.assign({}, base, { aR: curlB(-1, 10, U) }), b: Object.assign({}, base, { aR: curlB(-1, 140, U) }) }; })(),
      seq: [['a', 0.3, 1.1], ['b', 0.3, 1.1]] },

    { id: 'e1749', lib: true, interp: 'fk', name: 'Développé français debout à la barre EZ', en: 'Ez bar standing french press', mus: mus(m2('triceps', 1)), cam: { yaw: 50, pitch: 8 },
      props: [barbell({ half: 0.62, plate: 0.17, pin: 0.48, pw: 0.05 })],
      poses: (() => { const base = { pelvis: [0, 0.92, 0], lL: flatF(0.14, 0.02), lR: flatF(-0.14, 0.02) }; const U = { u: [-0.22, 1, 0.25], palm: 'dos', carry: 0 };   // bras verticaux, coudes près de la tête
        return { a: Object.assign({}, base, { aL: curlB(1, 22, U), aR: curlB(-1, 22, U) }), b: Object.assign({}, base, { aL: curlB(1, 140, U), aR: curlB(-1, 140, U) }) }; })(),
      seq: [['a', 0.3, 1.2], ['b', 0.3, 1.2]] },

    { id: 'e1731', lib: true, name: 'Développé prise serrée aux haltères', en: 'Dumbbell close grip press', mus: mus(m2('triceps', 1)), cam: { yaw: 55, pitch: 22 },
      props: [...dbs(), fn(() => bench(-0.75, 0.25, 0.44))],
      poses: {
        a: { float: true, pelvis: [0, 0.605, 0.05], rot: [-90, 0, 0], neck: [8, 0, 0], lL: flatF(0.25, 0.50, { p: [0.5, 1, 0.2] }), lR: flatF(-0.25, 0.50, { p: [-0.5, 1, 0.2] }),
          aL: grip([0.065, 1.22, -0.40], [-0.11, 0.99, -0.04], [-0.99, -0.11, 0], { p: [1, -0.3, 0.6] }), aR: grip([-0.065, 1.22, -0.40], [0.11, 0.99, -0.04], [0.99, -0.11, 0], { p: [-1, -0.3, 0.6] }) },
        b: { float: true, pelvis: [0, 0.605, 0.05], rot: [-90, 0, 0], neck: [8, 0, 0], lL: flatF(0.25, 0.50, { p: [0.5, 1, 0.2] }), lR: flatF(-0.25, 0.50, { p: [-0.5, 1, 0.2] }),
          aL: grip([0.07, 0.86, -0.30], [-0.33, 0.83, -0.46], [-0.94, -0.29, 0.16], { p: [0.5, -0.6, 1] }), aR: grip([-0.07, 0.86, -0.30], [0.33, 0.83, -0.46], [0.94, -0.29, 0.16], { p: [-0.5, -0.6, 1] }) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.3, 1.2]] },

    { id: 'e1399', lib: true, name: 'Dips au sol (sur banc)', en: 'Bench dip on floor', mus: mus(m2('triceps', 1), m2('pec', 2), m2('lat', 2), m2('trap', 2)), cam: { yaw: 105, pitch: 10 },
      props: [fn(() => [box([0, 0.415, -0.38], [1.20, 0.07, 0.30], PAD, { name: 'banc' }), box([0.48, 0.19, -0.38], [0.05, 0.38, 0.24], FRAME), box([-0.48, 0.19, -0.38], [0.05, 0.38, 0.24], FRAME)])],
      poses: {
        a: { float: true, pelvis: [0, 0.56, -0.05], rot: [2, 0, 0], neck: [-4, 0, 0],
          lL: { at: [0.11, 0.08, 0.85], foot: { toe: [0, 0.75, 0.66], up: [0, 0.66, -0.75] } }, lR: { at: [-0.11, 0.08, 0.85], foot: { toe: [0, 0.75, 0.66], up: [0, 0.66, -0.75] } },
          aL: { at: [0.21, 0.487, -0.27], hand: 'flat', hdir: [0, 0, 1], p: [0.2, 0, -1] }, aR: { at: [-0.21, 0.487, -0.27], hand: 'flat', hdir: [0, 0, 1], p: [-0.2, 0, -1] } },
        b: { float: true, pelvis: [0, 0.30, -0.01], rot: [6, 0, 0], neck: [-4, 0, 0],
          lL: { at: [0.11, 0.08, 0.85], foot: { toe: [0, 0.75, 0.66], up: [0, 0.66, -0.75] } }, lR: { at: [-0.11, 0.08, 0.85], foot: { toe: [0, 0.75, 0.66], up: [0, 0.66, -0.75] } },
          aL: { at: [0.21, 0.487, -0.27], hand: 'flat', hdir: [0, 0, 1], p: [0.2, 0.3, -1] }, aR: { at: [-0.21, 0.487, -0.27], hand: 'flat', hdir: [0, 0, 1], p: [-0.2, 0.3, -1] } },
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
          aL: grip([0.27, 1.25, 0.02], [0, -1, 0.4], [-1, 0, 0], { p: [-0.05, 0.4, -1] }), aR: grip([-0.27, 1.25, 0.02], [0, -1, 0.4], [1, 0, 0], { p: [0.05, 0.4, -1] }) },
      },
      seq: [['a', 0.3, 1.2], ['b', 0.3, 1.2]] },

    { id: 'e1755', lib: true, name: 'Dips triceps lestés', en: 'Weighted tricep dips', mus: mus(m2('triceps', 1), m2('pec', 2), m2('delt', 2)), cam: { yaw: 125, pitch: 8 },
      props: [DIPS(), fn((C) => { const h = C.bone('Hips'); const pL = h.at([0.16, 0.02, 0.115]), pR = h.at([-0.16, 0.02, 0.115]); const kz = Math.max(C.J ? 0 : 0, 0);
        const c = [0, h.o[1] - 0.50, h.o[2] + 0.24]; const top = [0, c[1] + 0.17, c[2]];
        return [cyl(pL, top, 0.006, CABLE, { soft: true }), cyl(pR, top, 0.006, CABLE, { soft: true }), cyl(C.sub(c, [0, 0, 0.02]), C.add(c, [0, 0, 0.02]), 0.17, PLATE, { name: 'disque' }), cyl(pL, h.at([0, 0.02, 0.165]), 0.02, PLATE, { soft: true }), cyl(h.at([0, 0.02, 0.165]), pR, 0.02, PLATE, { soft: true })]; })],
      poses: {
        a: { float: true, pelvis: [0, 1.36, -0.02], rot: [4, 0, 0], neck: [-4, 0, 0],
          lL: { db: [0.05, -1, 0.0], eb: [0.02, -0.5, -0.85], foot: 30 }, lR: { db: [-0.05, -1, 0.0], eb: [-0.02, -0.5, -0.85], foot: 30 },
          aL: grip([0.27, 1.25, 0.02], [0, -1, 0], [-1, 0, 0], { p: [0.2, 0, -1] }), aR: grip([-0.27, 1.25, 0.02], [0, -1, 0], [1, 0, 0], { p: [-0.2, 0, -1] }) },
        b: { float: true, pelvis: [0, 1.06, -0.06], rot: [12, 0, 0], neck: [-6, 0, 0],
          lL: { db: [0.05, -1, 0.0], eb: [0.02, -0.5, -0.85], foot: 30 }, lR: { db: [-0.05, -1, 0.0], eb: [-0.02, -0.5, -0.85], foot: 30 },
          aL: grip([0.27, 1.25, 0.02], [0, -1, 0.4], [-1, 0, 0], { p: [-0.05, 0.4, -1] }), aR: grip([-0.27, 1.25, 0.02], [0, -1, 0.4], [1, 0, 0], { p: [0.05, 0.4, -1] }) },
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
  if (WL3D._dbg) WL3D._dbg.__ADJ = ADJ;   // réglages (outils de contrôle)
})();
