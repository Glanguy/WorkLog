'use strict';
/* =====================================================================
   WorkLog : mannequin 3D des exercices « maison » (étirements, mobilité).
   Le corps est un modèle réaliste articulé (mannequin.bin, mannequin-peau.jpg), dessiné par
   le téléphone (WebGL), sans réseau :
   - les muscles ciblés sont colorés sur le corps ;
   - l'animation tourne en boucle entre les positions de l'exercice ;
   - on fait tourner le mannequin au doigt dans tous les sens, y compris par en dessous, sans zoom.
   Il n'y a ni sol ni ombre à l'écran : un repère de sol invisible sert seulement à poser les
   mains, les genoux et les pieds. Les exercices sont décrits dans exercices-3d.js.
   Modèle 3D : « Male base muscular anatomy » par Harshit Prajapati, licence CC BY 4.0, modifié.
   ===================================================================== */
(function () {
  const PI = Math.PI; const D2R = PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ---------- vecteurs et quaternions ---------- */
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a, fb) => { const l = len(a); return l > 1e-7 ? [a[0] / l, a[1] / l, a[2] / l] : (fb || [0, 1, 0]); };
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const nlerp = (a, b, t) => norm(lerp(a, b, t), a);
  const perp = (v, n) => sub(v, mul(n, dot(v, n)));       // v privé de sa composante sur n (n unitaire)
  const QI = [0, 0, 0, 1];
  const qAxis = (ax, ang) => { const s = Math.sin(ang / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(ang / 2)]; };
  const qX = (d) => qAxis([1, 0, 0], d * D2R); const qY = (d) => qAxis([0, 1, 0], d * D2R); const qZ = (d) => qAxis([0, 0, 1], d * D2R);
  const qConj = (q) => [-q[0], -q[1], -q[2], q[3]];
  const qMul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  function qRot(q, v) {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
    return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
  }
  function qNorm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }
  function qSlerp(a, b, t) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    let bb = b; if (d < 0) { d = -d; bb = [-b[0], -b[1], -b[2], -b[3]]; }
    let s0 = 1 - t, s1 = t;
    if (d < 0.9995) { const th = Math.acos(d); const s = Math.sin(th); s0 = Math.sin((1 - t) * th) / s; s1 = Math.sin(t * th) / s; }
    return qNorm([a[0] * s0 + bb[0] * s1, a[1] * s0 + bb[1] * s1, a[2] * s0 + bb[2] * s1, a[3] * s0 + bb[3] * s1]);
  }
  /* Quaternion d'un repère orthonormé (trois vecteurs colonnes). */
  function qBasis(x, y, z) {
    const m00 = x[0], m10 = x[1], m20 = x[2], m01 = y[0], m11 = y[1], m21 = y[2], m02 = z[0], m12 = z[1], m22 = z[2];
    const tr = m00 + m11 + m22; let q;
    if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4]; }
    else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
    else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s]; }
    else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s]; }
    return qNorm(q);
  }
  /* Plus petite rotation qui amène la direction a sur la direction b. */
  function qArc(a, b) {
    const d = dot(a, b);
    if (d > 0.999999) return QI;
    if (d < -0.999999) { const ax = norm(cross(Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], a)); return [ax[0], ax[1], ax[2], 0]; }
    const c = cross(a, b); return qNorm([c[0], c[1], c[2], 1 + d]);
  }

  /* ---------- matrices 4x4 (colonnes) ---------- */
  function mMul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  }
  function mPersp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2); const o = new Float32Array(16);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o;
  }
  function mLook(eye, tgt, up) {
    const z = norm(sub(eye, tgt)); const x = norm(cross(up, z)); const y = cross(z, x);
    const o = new Float32Array(16);
    o[0] = x[0]; o[4] = x[1]; o[8] = x[2]; o[12] = -dot(x, eye);
    o[1] = y[0]; o[5] = y[1]; o[9] = y[2]; o[13] = -dot(y, eye);
    o[2] = z[0]; o[6] = z[1]; o[10] = z[2]; o[14] = -dot(z, eye);
    o[15] = 1; return o;
  }
  function mFrame(o, x, y, z, s) {
    const m = new Float32Array(16); const sx = s ? s[0] : 1, sy = s ? s[1] : 1, sz = s ? s[2] : 1;
    m[0] = x[0] * sx; m[1] = x[1] * sx; m[2] = x[2] * sx;
    m[4] = y[0] * sy; m[5] = y[1] * sy; m[6] = y[2] * sy;
    m[8] = z[0] * sz; m[9] = z[1] * sz; m[10] = z[2] * sz;
    m[12] = o[0]; m[13] = o[1]; m[14] = o[2]; m[15] = 1; return m;
  }

  /* ---------- squelette du modèle ---------- */
  const NB = 26;
  const BN = ['Hips', 'Spine1', 'Spine2', 'Spine3', 'Spine4', 'Spine5', 'Neck1', 'Neck2', 'Neck3', 'Head', 'Clavicle_L', 'UpperArm_L', 'LowerArm_L', 'Hand_L',
    'Clavicle_R', 'UpperArm_R', 'LowerArm_R', 'Hand_R', 'UpperLeg_L', 'LowerLeg_L', 'Foot_L', 'Toes_L', 'UpperLeg_R', 'LowerLeg_R', 'Foot_R', 'Toes_R'];
  const X = {}; BN.forEach((n, i) => { X[n] = i; });
  const LIMBS = ['lL', 'lR', 'aL', 'aR'];
  const LB = {   // os de chaque membre : racine, milieu, extrémité (et orteils)
    lL: [X.UpperLeg_L, X.LowerLeg_L, X.Foot_L, X.Toes_L], lR: [X.UpperLeg_R, X.LowerLeg_R, X.Foot_R, X.Toes_R],
    aL: [X.UpperArm_L, X.LowerArm_L, X.Hand_L], aR: [X.UpperArm_R, X.LowerArm_R, X.Hand_R],
  };
  let RIG = null;   // { bones, bw (repos monde), dims, repères de repos des membres, tableaux du maillage }
  const B = { thigh: 0.434, shin: 0.405, ankle: 0.1, upper: 0.3, fore: 0.31 };
  function parseRig(buf) {
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x314d4c57) throw new Error('fichier mannequin inattendu');
    const hl = dv.getUint32(4, true);
    const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl)));
    const base = 8 + hl; const view = (k, T, n) => new T(buf, base + head.views[k][0], n);
    const r = { head, nv: head.nv, ni: head.ni, groups: head.groups, zones: head.zones, credit: head.credit };
    r.pos = view('pos', Uint16Array, head.nv * 3); r.nrm = view('nrm', Int8Array, head.nv * 4); r.uv = view('uv', Uint16Array, head.nv * 2);
    r.jnt = view('jnt', Uint8Array, head.nv * 4); r.wgt = view('wgt', Uint8Array, head.nv * 4); r.zone = view('zone', Uint8Array, head.nv * 4); r.idx = view('idx', Uint16Array, head.ni);
    const bones = head.bones; if (bones.length !== NB || bones.some((b, i) => b.n !== BN[i])) throw new Error('squelette inattendu');
    r.bones = bones; r.bw = [];
    for (let i = 0; i < NB; i++) {
      const b = bones[i]; const p = b.p >= 0 ? r.bw[b.p] : { p: [0, 0, 0], q: QI };
      r.bw.push({ p: add(p.p, qRot(p.q, b.t)), q: qNorm(qMul(p.q, b.r)) });
    }
    const bp = (n) => r.bw[X[n]].p; const dirOf = (a, b) => norm(sub(bp(b), bp(a)));
    B.thigh = len(sub(bp('LowerLeg_L'), bp('UpperLeg_L'))); B.shin = len(sub(bp('Foot_L'), bp('LowerLeg_L'))); B.ankle = bp('Foot_L')[1];
    B.upper = len(sub(bp('LowerArm_L'), bp('UpperArm_L'))); B.fore = len(sub(bp('Hand_L'), bp('LowerArm_L')));
    r.hipMid = mul(add(bp('UpperLeg_L'), bp('UpperLeg_R')), 0.5); r.hipOff = sub(r.hipMid, bp('Hips'));
    const shMid = mul(add(bp('UpperArm_L'), bp('UpperArm_R')), 0.5);
    r.cOff = sub(sub(shMid, [0, 0.212, -0.005]), bp('Spine5'));   // origine du repère « thorax » des poses, 21 cm sous les épaules
    // Repère anatomique de chaque segment dans la pose de repos du modèle (jambes écartées, bras en croix, paumes vers le bas).
    r.mb = {};
    const seg = (bone, d, ax) => { const y = mul(d, -1); const x = norm(perp(ax, y)); r.mb[bone] = qBasis(x, y, cross(x, y)); };
    for (const s of ['L', 'R']) {
      const sg = s === 'L' ? 1 : -1;
      seg(X['UpperLeg_' + s], dirOf('UpperLeg_' + s, 'LowerLeg_' + s), [1, 0, 0]); seg(X['LowerLeg_' + s], dirOf('LowerLeg_' + s, 'Foot_' + s), [1, 0, 0]);
      seg(X['UpperArm_' + s], dirOf('UpperArm_' + s, 'LowerArm_' + s), [0, sg, 0]); seg(X['LowerArm_' + s], dirOf('LowerArm_' + s, 'Hand_' + s), [0, sg, 0]);
      const toe = norm(perp(dirOf('Foot_' + s, 'Toes_' + s), [0, 1, 0])); r.mb[X['Foot_' + s]] = qBasis(cross([0, 1, 0], toe), [0, 1, 0], toe);
      const fing = qRot(r.bw[X['Hand_' + s]].q, [0, 1, 0]); const hy = mul(fing, -1); const hz = norm(perp([0, -1, 0], hy)); r.mb[X['Hand_' + s]] = qBasis(cross(hy, hz), hy, hz);
    }
    return r;
  }

  /* ---------- pose : de la description aux articulations ----------
     Repère : le personnage debout regarde vers +Z, sa gauche est +X, le haut est +Y.
     Une pose donne le bassin (position, orientation), la colonne, la tête, puis pour chaque
     membre soit une cible (main ou cheville posée quelque part), soit des directions. */
  function jq(e) { e = e || [0, 0, 0]; return qMul(qMul(qY(e[2] || 0), qZ(-(e[1] || 0))), qX(e[0] || 0)); }
  function prep(s) {
    const r = s.rot || [0, 0, 0, 0];
    const half = s.spine ? s.spine.map((v) => v / 2) : null;
    const k = {
      pos: (s.pelvis || [0, 0.94, 0]).slice(),
      pq: qMul(qMul(qMul(qY(r[1] || 0), qX(r[0] || 0)), qZ(-(r[2] || 0))), qY(r[3] || 0)),
      lq: jq(s.lumbar || half), cq: jq(s.chest || half), nq: jq(s.neck), hq: jq(s.head), limbs: {},
    };
    for (const id of LIMBS) k.limbs[id] = Object.assign({}, s[id] || {});
    return k;
  }
  const toW = (f, v) => add(f.o, qRot(f.q, v));
  const dirW = (f, v) => qRot(f.q, v);
  const part = (q, f) => qSlerp(QI, q, f);
  /* Tronc : la flexion des lombaires est répartie sur 2 vertèbres du modèle, celle du thorax sur 3, celle du cou sur 3. */
  const TWIST = 0.75, TWMAX = 115 * D2R;   // part de la torsion de la main donnée à l'avant-bras, et son maximum
  function torso(pos, pq, lq, cq, nq, hq, W, P) {
    const R = RIG; const D = new Array(10);
    D[0] = pq; D[1] = qMul(pq, part(lq, 0.5)); D[2] = qMul(pq, lq);
    D[3] = qMul(D[2], part(cq, 1 / 3)); D[4] = qMul(D[2], part(cq, 2 / 3)); D[5] = qMul(D[2], cq);
    D[6] = qMul(D[5], part(nq, 1 / 3)); D[7] = qMul(D[5], part(nq, 2 / 3)); D[8] = qMul(D[5], nq); D[9] = qMul(D[8], hq);
    for (let i = 0; i < 10; i++) W[i] = qMul(D[i], R.bw[i].q);
    P[0] = sub(pos, qRot(pq, R.hipOff));
    for (let i = 1; i < 10; i++) P[i] = add(P[i - 1], qRot(W[i - 1], R.bones[i].t));
    for (const c of [X.Clavicle_L, X.Clavicle_R]) { W[c] = qMul(D[5], R.bw[c].q); P[c] = add(P[5], qRot(W[5], R.bones[c].t)); }
  }
  /* Repères « bassin » et « thorax » des poses, et points utiles, d'après les os. */
  function frames(W, P) {
    const R = RIG;
    const dP = qMul(W[0], qConj(R.bw[0].q)), dC = qMul(W[5], qConj(R.bw[5].q)), dH = qMul(W[9], qConj(R.bw[9].q));
    const Pf = { o: add(P[0], qRot(dP, R.hipOff)), q: dP }; const Cf = { o: add(P[5], qRot(dC, R.cOff)), q: dC };
    return { P: Pf, C: Cf, A: { o: P[2], q: qMul(W[2], qConj(R.bw[2].q)) }, H: { o: P[9], q: dH } };
  }
  function rootOf(id, W, P) { const c = id === 'aL' ? X.Clavicle_L : id === 'aR' ? X.Clavicle_R : 0; return add(P[c], qRot(W[c], RIG.bones[LB[id][0]].t)); }
  function ik(a, c, l1, l2, pole) {
    const d = sub(c, a); let dl = len(d);
    const max = (l1 + l2) * 0.9995, min = Math.abs(l1 - l2) + 0.01;
    const n = norm(d, [0, -1, 0]); dl = clamp(dl, min, max);
    const x = (l1 * l1 - l2 * l2 + dl * dl) / (2 * dl); const hgt = Math.sqrt(Math.max(l1 * l1 - x * x, 0));
    const pp = norm(perp(pole, n), norm(perp([0.3, 0.2, 1], n)));
    const mid = add(a, add(mul(n, x), mul(pp, hgt)));
    const end = add(a, mul(n, dl));
    return { d1: norm(sub(mid, a)), d2: norm(sub(end, mid)), pole: pp };
  }
  /* Cible d'un membre dans une pose : fixe dans l'espace (at), attachée au corps (atb) ou à une articulation (on). */
  /* Repère d'un os : pour un segment de membre, X = axe du pli, Y = vers la racine du membre, Z = devant ; sinon l'orientation du corps. */
  function boneQ(name, W) { const i = X[name]; const d = qMul(W[i], qConj(RIG.bw[i].q)); return RIG.mb[i] ? qMul(d, RIG.mb[i]) : d; }
  function onTarget(on, off, J, W) { return add(J[on[0]], on[2] ? qRot(boneQ(on[2], W), off) : off); }
  function targetOf(id, L, F, J, W) {
    const arm = id[0] === 'a'; const base = arm ? F.C : F.P;
    if (L.at) return L.at;
    if (L.atb) return toW(base, L.atb);
    if (L.on) return onTarget(L.on, L.on[1] || [0, 0, 0], J, W);
    return null;
  }
  function limbOf(id, L, F, J, root, W) {
    const arm = id[0] === 'a'; const side = id[1] === 'L' ? 1 : -1;
    const base = arm ? F.C : F.P;
    const l1 = arm ? B.upper : B.thigh, l2 = arm ? B.fore : B.shin;
    const pole = norm(L.p ? L.p : L.pb ? dirW(base, L.pb) : dirW(base, arm ? [side * 0.5, -0.6, -0.8] : [side * 0.1, 0.1, 1]));
    const tgt = targetOf(id, L, F, J, W);
    if (tgt) { const r = ik(root, tgt, l1, l2, pole); return { root, ik: true, tgt, pole: r.pole, d1: r.d1, d2: r.d2 }; }
    let d1 = L.d ? L.d : L.db ? dirW(base, L.db) : dirW(base, [0, -1, 0]);
    let d2 = L.e ? L.e : L.eb ? dirW(base, L.eb) : d1;
    d1 = norm(d1); d2 = norm(d2);
    return { root, ik: false, pole, d1, d2 };
  }
  function limbFrames(id, r, l1, l2) {
    const arm = id[0] === 'a';
    // Axe du pli (coude, genou) : perpendiculaire aux deux segments ; membre tendu : donné par le « pôle ».
    const viaPole = norm(arm ? cross(r.d1, r.pole) : cross(r.pole, r.d1), [1, 0, 0]);
    let ax = arm ? cross(r.d2, r.d1) : cross(r.d1, r.d2);
    if (dot(ax, viaPole) < 0 && len(ax) < 0.2) ax = mul(ax, -1);
    ax = norm(add(ax, mul(viaPole, 0.04)), viaPole);
    const y1 = mul(r.d1, -1); const x1 = norm(perp(ax, y1), viaPole); const z1 = cross(x1, y1);
    const y2 = mul(r.d2, -1); const x2 = norm(perp(ax, y2), viaPole); const z2 = cross(x2, y2);
    const mid = add(r.root, mul(r.d1, l1)); const end = add(mid, mul(r.d2, l2));
    return { root: r.root, mid, end, x1, y1, z1, x2, y2, z2 };
  }
  /* Orientation du pied (orteils, dessus) ou de la main (doigts, paume). */
  function endOf(id, L, fr, F, W) {
    const arm = id[0] === 'a'; const side = id[1] === 'L' ? 1 : -1;
    const d2 = mul(fr.y2, -1);
    if (!arm) {
      let mode = L.foot;
      if (mode == null) mode = (fr.end[1] < B.ankle + 0.04 && d2[1] < -0.45) ? 'flat' : 28;
      if (mode === 'flat') {
        let toe = L.toe ? L.toe : perp(fr.z2, [0, 1, 0]);
        if (len(toe) < 0.2) toe = perp(dirW(F.P, [0, 0, 1]), [0, 1, 0]);
        toe = norm(perp(toe, [0, 1, 0]), [0, 0, 1]);
        return { a: toe, b: [0, 1, 0] };
      }
      if (typeof mode === 'object') { const a = norm(mode.toe); return { a, b: norm(perp(mode.up || [0, 1, 0], a)) }; }
      const p = mode * D2R; const a = norm(add(mul(fr.z2, Math.cos(p)), mul(d2, Math.sin(p))));
      return { a, b: norm(cross(a, fr.x2)) };
    }
    let mode = L.hand;
    if (mode == null) mode = (fr.end[1] < 0.055) ? 'flat' : 'line';
    if (mode === 'flat') {
      let dir = L.hdir ? L.hdir : perp(dirW(F.C, [0, 1, 0]), [0, 1, 0]);
      if (len(dir) < 0.3) dir = perp(dirW(F.P, [0, 0, 1]), [0, 1, 0]);
      return { a: norm(perp(dir, [0, 1, 0]), [0, 0, 1]), b: [0, -1, 0] };
    }
    if (typeof mode === 'object') {
      if (mode.bone) { const q = boneQ(mode.bone, W); const a = norm(qRot(q, mode.dl)); return { a, b: norm(perp(qRot(q, mode.nl), a)) }; }
      const a = norm(mode.db ? dirW(F.C, mode.db) : mode.d || d2); return { a, b: norm(perp(mode.nb ? dirW(F.C, mode.nb) : mode.n, a)) };
    }
    const pr = (L.pron == null ? 90 : L.pron) * D2R * -side;   // 0 : paume vers l'avant du bras ; 90 : paume vers le corps
    const n = add(mul(fr.z2, Math.cos(pr)), mul(fr.x2, Math.sin(pr)));
    let a = d2;
    if (L.wrist) a = norm(add(mul(d2, Math.cos(L.wrist * D2R)), mul(n, -Math.sin(L.wrist * D2R))));   // + : poignet en extension
    return { a, b: norm(perp(n, a)) };
  }
  /* Points nommés (pour les accessoires, les mains posées sur un genou, le cadrage). */
  function joints(W, P) {
    const J = { pelvis: P[0], chest: P[5], neck: P[6], head: add(P[9], qRot(W[9], [0, 0.09, 0.02])), top: add(P[9], qRot(W[9], [0, 0.215, 0.02])) };
    for (const s of ['L', 'R']) {
      const h = X['Hand_' + s], f = X['Foot_' + s];
      J['sh' + s] = P[X['UpperArm_' + s]]; J['elbow' + s] = P[X['LowerArm_' + s]]; J['wrist' + s] = P[h];
      const fy = qRot(W[h], [0, 1, 0]); J['hand' + s] = add(P[h], mul(fy, 0.085)); J['tip' + s] = add(P[h], mul(fy, 0.18));
      J['hip' + s] = P[X['UpperLeg_' + s]]; J['knee' + s] = P[X['LowerLeg_' + s]]; J['ankle' + s] = P[f];
      const mb = qMul(qMul(W[f], qConj(RIG.bw[f].q)), RIG.mb[f]);   // repère du pied : Z orteils, Y dessus
      const ez = qRot(mb, [0, 0, 1]), ey = qRot(mb, [0, 1, 0]);
      const tb = X['Toes_' + s]; J['toe' + s] = add(P[tb], add(mul(qRot(W[tb], [0, 1, 0]), 0.07), mul(qRot(W[tb], [0, 0, 1]), 0.005))); J['heel' + s] = add(P[f], add(mul(ez, -0.055), mul(ey, 0.022 - B.ankle))); J['ball' + s] = add(P[f], add(mul(ez, 0.15), mul(ey, 0.016 - B.ankle)));
    }
    return J;
  }
  /* Pose complète : orientation et position de chaque os, le point le plus bas du corps posé sur le sol invisible. */
  function solvePose(K) {
    const R = RIG; const pos = K.pos.slice(); let out = null;
    for (let pass = 0; pass < 3; pass++) {
      const W = new Array(NB), P = new Array(NB);
      torso(pos, K.pq, K.lq, K.cq, K.nq, K.hq, W, P);
      const F = frames(W, P); const J = {}; const lim = {};
      const put = (i, parent) => { P[i] = add(P[parent], qRot(W[parent], R.bones[i].t)); };
      for (const id of LIMBS) {
        const arm = id[0] === 'a'; const sfx = id[1]; const [u, l, e, toes] = LB[id];
        const L = K.limbs[id]; const root = rootOf(id, W, P);
        const r = limbOf(id, L, F, J, root, W);
        const fr = limbFrames(id, r, arm ? B.upper : B.thigh, arm ? B.fore : B.shin);
        const en = endOf(id, L, fr, F, W); const eb = norm(perp(en.b, en.a));
        const qe = arm ? qBasis(cross(mul(en.a, -1), eb), mul(en.a, -1), eb) : qBasis(cross(eb, en.a), eb, en.a);
        const setB = (i, q) => { W[i] = qNorm(qMul(qMul(q, qConj(R.mb[i])), R.bw[i].q)); };
        P[u] = root; setB(u, qBasis(fr.x1, fr.y1, fr.z1)); put(l, u); setB(l, qBasis(fr.x2, fr.y2, fr.z2)); put(e, l); setB(e, qe);
        if (arm) {   // la rotation de la main (pronation, supination) est portée par l'avant-bras et, bras tendu, par l'épaule ; pas par le poignet
          const wtw = () => { const d = qMul(qConj(R.bones[e].r), qMul(qConj(W[l]), W[e])); let ang = 2 * Math.atan2(d[1], d[3]); if (ang > PI) ang -= 2 * PI; if (ang < -PI) ang += 2 * PI; return ang; };
          const bend = Math.acos(clamp(dot(fr.y1, fr.y2), -1, 1));
          const k = 0.5 * clamp(1 - bend / (35 * D2R), 0, 1);   // bras presque tendu : l'épaule tourne aussi (le coude bouge à peine)
          if (k > 0) {
            const g = wtw() * k; const ax = norm(sub(P[e], P[u])); const qg = qAxis(ax, g);
            W[u] = qNorm(qMul(qg, W[u])); W[l] = qNorm(qMul(qg, W[l])); P[l] = add(P[u], qRot(qg, sub(P[l], P[u])));
          }
          const f = clamp(wtw() * TWIST, -TWMAX, TWMAX);
          if (Math.abs(f) > 1e-4) W[l] = qNorm(qMul(qAxis(norm(sub(P[e], P[l])), f), W[l]));
        }
        if (toes != null) { W[toes] = qMul(qMul(qMul(W[e], qConj(R.bw[e].q)), R.bw[toes].q), qX(L.toes || 0)); put(toes, e); }
        lim[id] = { ik: r.ik, kind: L.at ? 'at' : L.atb ? 'atb' : L.on ? 'on' : null, tgt: r.tgt || null, atb: L.atb || null, on: L.on || null, pole: r.pole, grip: !!L.grip, free: !arm && !r.ik };
        if (arm) { J['wrist' + sfx] = P[e]; J['elbow' + sfx] = P[l]; J['sh' + sfx] = P[u]; J['hand' + sfx] = add(P[e], mul(en.a, 0.085)); }
        else { J['hip' + sfx] = P[u]; J['knee' + sfx] = P[l]; J['ankle' + sfx] = P[e]; }
      }
      const JJ = joints(W, P);
      out = { hp: P[0], W, P, J: JJ, lim };
      if (pass === 2) break;
      const C = F.C;
      const probes = [
        [JJ.heelL, 0.022], [JJ.heelR, 0.022], [JJ.ballL, 0.016], [JJ.ballR, 0.016], [JJ.toeL, 0.012], [JJ.toeR, 0.012], [JJ.ankleL, 0.04], [JJ.ankleR, 0.04],
        [JJ.kneeL, 0.058], [JJ.kneeR, 0.058], [toW(F.P, [0.09, -0.02, -0.06]), 0.1], [toW(F.P, [-0.09, -0.02, -0.06]), 0.1], [toW(F.P, [0, 0.01, 0.02]), 0.1], [toW(F.P, [0, -0.07, 0]), 0.075],
        [toW(F.A, [0, 0.03, 0]), 0.105], [toW(C, [0, 0.08, 0.005]), 0.125], [toW(C, [0.1, 0.17, -0.02]), 0.1], [toW(C, [-0.1, 0.17, -0.02]), 0.1],
        [JJ.shL, 0.07], [JJ.shR, 0.07], [JJ.elbowL, 0.045], [JJ.elbowR, 0.045], [JJ.wristL, 0.028], [JJ.wristR, 0.028], [JJ.handL, 0.02], [JJ.handR, 0.02], [JJ.tipL, 0.011], [JJ.tipR, 0.011], [JJ.head, 0.105],
      ];
      let low = Infinity; for (const [p, rr] of probes) low = Math.min(low, p[1] - rr);
      if (Math.abs(low) < 1e-4) break;
      pos[1] -= low;
    }
    // Rotations de chaque os par rapport à son parent : c'est elles qu'on fait varier d'une pose à l'autre.
    for (const id of ['lL', 'lR']) { const m = out.lim[id]; if (m.free && out.P[LB[id][2]][1] < 0.135) { m.ik = true; m.kind = 'at'; m.tgt = out.P[LB[id][2]]; } }
    out.ql = out.W.map((q, i) => (R.bones[i].p >= 0 ? qNorm(qMul(qConj(out.W[R.bones[i].p]), q)) : q));
    return out;
  }
  /* Entre deux poses : chaque articulation tourne en douceur, puis les mains et les pieds posés
     quelque part sont ramenés exactement sur leur appui. Aucun seuil, donc aucun à-coup. */
  function blend(A, Bp, t) {
    const R = RIG; const W = new Array(NB), P = new Array(NB);
    for (let i = 0; i < NB; i++) {
      const p = R.bones[i].p; const ql = A === Bp ? A.ql[i] : qSlerp(A.ql[i], Bp.ql[i], t);
      if (p < 0) { W[i] = ql; P[i] = A === Bp ? A.hp : lerp(A.hp, Bp.hp, t); } else { W[i] = qNorm(qMul(W[p], ql)); P[i] = add(P[p], qRot(W[p], R.bones[i].t)); }
    }
    if (A !== Bp) {
      let F = null; const J = {};
      for (const id of LIMBS) {
        const arm = id[0] === 'a'; const sfx = id[1]; const [u, l, e, toes] = LB[id];
        const a = A.lim[id], b = Bp.lim[id];
        if (a.ik && b.ik) {
          if (!F) F = frames(W, P);
          let tgt;
          if (a.kind === 'on' && b.kind === 'on' && a.on[0] === b.on[0] && a.on[2] === b.on[2] && J[a.on[0]]) tgt = onTarget(a.on, lerp(a.on[1] || [0, 0, 0], b.on[1] || [0, 0, 0], t), J, W);
          else if (a.kind === 'atb' && b.kind === 'atb') tgt = toW(arm ? F.C : F.P, lerp(a.atb, b.atb, t));
          else tgt = lerp(a.tgt, b.tgt, t);
          const l1 = arm ? B.upper : B.thigh, l2 = arm ? B.fore : B.shin;
          const root = P[u]; const n = norm(sub(tgt, root), [0, -1, 0]);
          let pole = perp(sub(P[l], root), n); if (len(pole) < 0.004) pole = nlerp(a.pole, b.pole, t);
          const k = ik(root, tgt, l1, l2, pole);
          const q1 = qArc(norm(sub(P[l], root)), k.d1); const d2 = qRot(q1, norm(sub(P[e], P[l]))); const q2 = qArc(d2, k.d2); const q21 = qMul(q2, q1);
          const wToes = toes != null ? qMul(qConj(W[e]), W[toes]) : null;
          W[u] = qNorm(qMul(q1, W[u])); W[l] = qNorm(qMul(q21, W[l]));
          // appui qui ne bouge pas : la main ou le pied garde son orientation dans l'espace ; sinon il suit le membre (pas de vrille)
          W[e] = (a.kind === 'at' && b.kind === 'at' && len(sub(a.tgt, b.tgt)) < 0.03) ? qSlerp(A.W[e], Bp.W[e], t) : qNorm(qMul(q21, W[e]));
          P[l] = add(root, mul(k.d1, l1)); P[e] = add(P[l], mul(k.d2, l2));
          if (toes != null) { W[toes] = qNorm(qMul(W[e], wToes)); P[toes] = add(P[e], qRot(W[e], R.bones[toes].t)); }
        }
        if (arm) { J['wrist' + sfx] = P[e]; J['elbow' + sfx] = P[l]; J['sh' + sfx] = P[u]; J['hand' + sfx] = add(P[e], mul(qRot(W[e], [0, 1, 0]), 0.085)); }
        else { J['hip' + sfx] = P[u]; J['knee' + sfx] = P[l]; J['ankle' + sfx] = P[e]; }
      }
    }
    return { W, P, J: joints(W, P), grip: { L: (t < 0.5 ? A : Bp).lim.aL.grip, R: (t < 0.5 ? A : Bp).lim.aR.grip } };
  }

  /* ---------- exercices ---------- */
  const EX = new Map();
  /* Clés des muscles dans les exercices -> groupe du modèle (g) ou zone peinte (z). */
  const MG = { quad: 'quadriceps', ham: 'ischios', add: 'adducteurs', abd: 'abducteurs', calf: 'mollets', tib: 'jambiers', glute: 'fessiers', obl: 'obliques', low: 'lombaires',
    lat: 'dorsaux', pec: 'pectoraux', trap: 'trapezes', neck: 'cou', cuff: 'coiffe', delt: 'deltoides', biceps: 'biceps', triceps: 'triceps', forearm: 'avant_bras', serr: 'dentele', abs: 'abdominaux' };
  const MZ = { psoas: 'psoas', pir: 'piriforme', tfl: 'tfl', rhomb: 'rhomboides', deltP: 'deltpost' };
  function define(list) { for (const e of list) EX.set(e.id, Object.assign({}, e, { K: null, S: null, fit: null, tint: null })); }
  function ready(ex) {
    if (ex.S) return;
    ex.K = {}; ex.S = {};
    for (const [k, v] of Object.entries(ex.poses)) { ex.K[k] = prep(v); ex.S[k] = solvePose(ex.K[k]); }
  }
  function timeline(ex, time) {
    const seq = ex.seq; let total = 0; for (const s of seq) total += s[1] + s[2];
    let t = (time * (ex.speed || 1)) % total;
    for (let i = 0; i < seq.length; i++) {
      const [k, hold, move] = seq[i];
      if (t < hold) return [ex.S[k], ex.S[k], 0];
      t -= hold;
      if (t < move) { const u = t / move; return [ex.S[k], ex.S[seq[(i + 1) % seq.length][0]], u * u * (3 - 2 * u)]; }
      t -= move;
    }
    return [ex.S[seq[0][0]], ex.S[seq[0][0]], 0];
  }
  function fitOf(ex) {
    if (ex.fit) return ex.fit;
    ready(ex); const pts = [];
    for (const s of Object.values(ex.S)) {
      for (const [n, p] of Object.entries(s.J)) pts.push([p, /^(tip|toe|heel|ball|hand|wrist|top)/.test(n) ? 0.035 : 0.1]);
      for (const pr of ex.props || []) {
        if (pr.type === 'box') for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const sy of [0, 1]) pts.push([add(pr.pos, [sx * pr.size[0] / 2, sy * pr.size[1], sz * pr.size[2] / 2]), 0]);
        if (pr.type === 'dumbbell') pts.push([add(pr.pos, [0.17, 0.05, 0]), 0.05], [add(pr.pos, [-0.17, 0.05, 0]), 0.05]);
        if (pr.type === 'post') pts.push([pr.a, 0.03], [pr.b, 0.03]);
      }
    }
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const [p, r] of pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k] - r); hi[k] = Math.max(hi[k], p[k] + r); }
    const c = mul(add(lo, hi), 0.5); let rad = 0;
    for (const [p, r] of pts) rad = Math.max(rad, len(sub(p, c)) + r);
    ex.fit = { c, rad: Math.max(rad, 0.5) };
    return ex.fit;
  }
  const COL = { prim: [0.400, 0.290, 0.760, 0.95], sec: [0.640, 0.540, 0.950, 0.86], ink: [0.22, 0.15, 0.2],
    wood: [0.905, 0.800, 0.640], woodDark: [0.800, 0.660, 0.450], band: [0.250, 0.640, 0.560], steel: [0.420, 0.400, 0.480] };
  /* Teinte de chaque groupe du modèle et de chaque zone peinte pour un exercice. */
  function tintOf(ex, primOnly) {
    if (ex.tint && !primOnly) return ex.tint;
    const R = RIG; const g = R.groups.map(() => null); const z = new Float32Array(11 * 4);
    for (const [key, lvl] of Object.entries(ex.mus || {})) {
      if (primOnly && lvl !== 1) continue;
      const m = /^(.*?)(L|R)?$/.exec(key); const base = m[1]; const sides = m[2] ? [m[2]] : ['L', 'R'];
      const c = lvl === 1 ? COL.prim : COL.sec;
      for (const s of sides) {
        if (MG[base]) { const i = R.groups.findIndex((x) => x.n === MG[base] + '_' + s); if (i >= 0 && !(g[i] === COL.prim)) g[i] = c; }
        else if (MZ[base]) { const zi = 1 + (s === 'L' ? 0 : R.zones.length) + R.zones.indexOf(MZ[base]); if (!(z[zi * 4 + 3] > c[3])) z.set(c, zi * 4); }
      }
    }
    if (primOnly) return { g, z };
    ex.tint = { g, z }; return ex.tint;
  }

  /* ---------- accessoires ---------- */
  const M = {};
  function buildProps() {
    // cube unité centré
    const pos = [], nrm = [], idx = [];
    const Fc = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
    for (const [n, u, v] of Fc) {
      const b = pos.length / 3;
      for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = add(mul(n, 0.5), add(mul(u, a * 0.5), mul(v, c * 0.5))); pos.push(p[0], p[1], p[2]); nrm.push(n[0], n[1], n[2]); }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    M.box = { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
    // cylindre unité : rayon 1, de y = 0 à y = 1, fermé
    const cp = [], cn = [], ci = []; const S = 14;
    for (let j = 0; j <= S; j++) { const a = (2 * PI * j) / S; const x = Math.sin(a), z = Math.cos(a); cp.push(x, 0, z, x, 1, z); cn.push(x, 0, z, x, 0, z); }
    for (let j = 0; j < S; j++) { const a = j * 2; ci.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    for (const y of [0, 1]) {
      const c = cp.length / 3; cp.push(0, y, 0); cn.push(0, y ? 1 : -1, 0);
      for (let j = 0; j <= S; j++) { const a = (2 * PI * j) / S; cp.push(Math.sin(a), y, Math.cos(a)); cn.push(0, y ? 1 : -1, 0); }
      for (let j = 0; j < S; j++) { if (y) ci.push(c, c + 1 + j, c + 2 + j); else ci.push(c, c + 2 + j, c + 1 + j); }
    }
    M.cyl = { pos: new Float32Array(cp), nrm: new Float32Array(cn), idx: new Uint16Array(ci) };
    for (const m of Object.values(M)) fixWinding(m);
  }
  function fixWinding(m) {   // faces vers l'extérieur
    let vol = 0; const p = m.pos; const ix = m.idx;
    for (let i = 0; i < ix.length; i += 3) {
      const a = ix[i] * 3, b = ix[i + 1] * 3, c = ix[i + 2] * 3;
      vol += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
    }
    if (vol < 0) for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  }
  function propParts(props, J) {
    const out = [];
    const cyl = (a, b, r, col) => {
      const d = sub(b, a); const l = len(d); if (l < 1e-4) return;
      const y = mul(d, 1 / l); const x = norm(perp(Math.abs(y[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], y)); const z = cross(x, y);
      out.push({ mesh: M.cyl, model: mFrame(a, x, y, z, [r, l, r]), base: col });
    };
    const pt = (v) => (typeof v === 'string' ? J[v] : v);
    for (const p of props || []) {
      if (p.type === 'box') out.push({ mesh: M.box, model: mFrame(add(p.pos, [0, p.size[1] / 2, 0]), [1, 0, 0], [0, 1, 0], [0, 0, 1], p.size), base: p.col || COL.wood });
      else if (p.type === 'stick') {   // bâton tenu par les deux mains, qui dépasse de chaque côté
        const a = pt(p.a), b = pt(p.b); const d = norm(sub(b, a)); const ext = p.ext || [0.15, 0.15];
        cyl(sub(a, mul(d, ext[0])), add(b, mul(d, ext[1])), p.r || 0.014, p.col || COL.woodDark);
      } else if (p.type === 'band') cyl(pt(p.a), pt(p.b), 0.009, COL.band);   // élastique entre un point fixe et la main
      else if (p.type === 'post') cyl(p.a, p.b, p.r || 0.03, COL.steel);
      else if (p.type === 'dumbbell') {   // haltère posé, manche le long de X
        const c = p.pos; const r = p.r || 0.07; const hw = 0.11;
        cyl([c[0] - hw, r, c[2]], [c[0] + hw, r, c[2]], 0.016, COL.steel);
        cyl([c[0] - hw - 0.06, r, c[2]], [c[0] - hw, r, c[2]], r, COL.steel); cyl([c[0] + hw, r, c[2]], [c[0] + hw + 0.06, r, c[2]], r, COL.steel);
      }
    }
    return out;
  }

  /* ---------- rendu ---------- */
  const VS_BODY = 'attribute vec3 aP;attribute vec3 aN;attribute vec2 aU;attribute vec4 aJ;attribute vec4 aW;attribute vec4 aZ;'
    + 'uniform mat4 uVP;uniform vec4 uB[52];uniform vec3 uLo;uniform vec3 uSc;uniform vec4 uZc[11];uniform float uOut;uniform mediump vec3 uCam;'
    + 'varying vec3 vN;varying vec3 vW;varying vec2 vU;varying vec4 vZ;'
    + 'void main(){vec3 p=aP*uSc+uLo;'
    + 'int i0=int(aJ.x+0.5)*2;int i1=int(aJ.y+0.5)*2;int i2=int(aJ.z+0.5)*2;int i3=int(aJ.w+0.5)*2;'
    + 'vec4 r0=uB[i0];vec4 r1=uB[i1];vec4 r2=uB[i2];vec4 r3=uB[i3];'
    + 'float s1=dot(r0,r1)<0.0?-1.0:1.0;float s2=dot(r0,r2)<0.0?-1.0:1.0;float s3=dot(r0,r3)<0.0?-1.0:1.0;'
    + 'vec4 r=aW.x*r0+aW.y*s1*r1+aW.z*s2*r2+aW.w*s3*r3;'
    + 'vec4 d=aW.x*uB[i0+1]+aW.y*s1*uB[i1+1]+aW.z*s2*uB[i2+1]+aW.w*s3*uB[i3+1];'
    + 'float l=length(r);r/=l;d/=l;'
    + 'vec3 op=p+2.0*cross(r.xyz,cross(r.xyz,p)+r.w*p)+2.0*(r.w*d.xyz-d.w*r.xyz+cross(r.xyz,d.xyz));'
    + 'vec3 on=aN+2.0*cross(r.xyz,cross(r.xyz,aN)+r.w*aN);'
    + 'vec3 n=normalize(on);op+=n*uOut;if(uOut>0.0){op+=normalize(op-uCam)*uOut*4.0;}'
    + 'vN=n;vW=op;vU=aU;vec4 zc=uZc[int(aZ.x*255.0+0.5)];vZ=vec4(zc.rgb,1.0)*(step(0.01,zc.a)*aZ.y);gl_Position=uVP*vec4(op,1.0);}';
  const FS_BODY = 'precision mediump float;varying vec3 vN;varying vec3 vW;varying vec2 vU;varying vec4 vZ;'
    + 'uniform sampler2D uTex;uniform vec4 uTint;uniform vec3 uL;uniform mediump vec3 uCam;uniform float uMode;uniform vec4 uFlat;'
    + 'void main(){if(uMode>1.5){float m=max(step(0.01,uTint.a),step(0.3,vZ.a));gl_FragColor=vec4(m,0.0,0.0,1.0);return;}if(uMode>0.5){gl_FragColor=uFlat;return;}'
    + 'vec3 tex=texture2D(uTex,vU).rgb;float lum=dot(tex,vec3(0.3,0.5,0.2));float k=0.5+0.8*lum;'
    + 'vec3 col=mix(tex,uTint.rgb*k,uTint.a);col=mix(col,vZ.rgb/max(vZ.a,0.001)*k,smoothstep(0.05,0.6,vZ.a)*0.9);'
    + 'vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;vec3 v=normalize(uCam-vW);float nl=dot(n,uL)*0.5+0.5;float hemi=n.y*0.5+0.5;'
    + 'float rim=pow(1.0-max(dot(n,v),0.0),2.4);'
    + 'vec3 c=col*(0.50+0.50*nl*nl+0.10*hemi);c=mix(c,col*0.50,rim*0.55);'
    + 'c+=vec3(pow(max(dot(n,normalize(uL+v)),0.0),26.0)*0.10);gl_FragColor=vec4(c,1.0);}';
  const VS_PROP = 'attribute vec3 aP;attribute vec3 aN;uniform mat4 uVP;uniform mat4 uM;uniform float uOut;uniform mediump vec3 uCam;varying vec3 vN;varying vec3 vW;'
    + 'void main(){vec3 n=normalize(mat3(uM)*aN);vec4 w=uM*vec4(aP,1.0);w.xyz+=n*uOut;if(uOut>0.0){w.xyz+=normalize(w.xyz-uCam)*uOut*4.0;}vN=n;vW=w.xyz;gl_Position=uVP*w;}';
  const FS_PROP = 'precision mediump float;varying vec3 vN;varying vec3 vW;uniform vec3 uBase;uniform vec3 uL;uniform mediump vec3 uCam;uniform float uMode;uniform vec4 uFlat;'
    + 'void main(){if(uMode>0.5){gl_FragColor=uFlat;return;}vec3 n=normalize(vN);vec3 v=normalize(uCam-vW);float nl=dot(n,uL)*0.5+0.5;'
    + 'vec3 c=uBase*(0.58+0.40*nl*nl+0.08*(n.y*0.5+0.5));c=mix(c,uBase*0.6,pow(1.0-max(dot(n,v),0.0),2.2)*0.45);gl_FragColor=vec4(c,1.0);}';

  let GL = null;   // { canvas, gl, body, prop }
  let ASSET = null;   // promesse du chargement ; 'ok' ou 'ko' une fois réglé
  let state = 'wait';
  function program(gl, vs, fs, attrs, unis) {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const loc = {}; unis.forEach((n) => { loc[n] = gl.getUniformLocation(p, n); });
    return { p, loc };
  }
  function initGL(img) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: true, premultipliedAlpha: true });
    if (!gl) throw new Error('WebGL indisponible');
    const body = program(gl, VS_BODY, FS_BODY, ['aP', 'aN', 'aU', 'aJ', 'aW', 'aZ'], ['uVP', 'uB', 'uLo', 'uSc', 'uZc', 'uOut', 'uCam', 'uTex', 'uTint', 'uL', 'uMode', 'uFlat']);
    const prop = program(gl, VS_PROP, FS_PROP, ['aP', 'aN'], ['uVP', 'uM', 'uOut', 'uCam', 'uBase', 'uL', 'uMode', 'uFlat']);
    const R = RIG; const buf = (target, data) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b; };
    R.vb = { pos: buf(gl.ARRAY_BUFFER, R.pos), nrm: buf(gl.ARRAY_BUFFER, R.nrm), uv: buf(gl.ARRAY_BUFFER, R.uv), jnt: buf(gl.ARRAY_BUFFER, R.jnt), wgt: buf(gl.ARRAY_BUFFER, R.wgt), zone: buf(gl.ARRAY_BUFFER, R.zone), idx: buf(gl.ELEMENT_ARRAY_BUFFER, R.idx) };
    buildProps();
    for (const m of Object.values(M)) { m.vp = buf(gl.ARRAY_BUFFER, m.pos); m.vn = buf(gl.ARRAY_BUFFER, m.nrm); m.vi = buf(gl.ELEMENT_ARRAY_BUFFER, m.idx); }
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); state = 'ko'; });
    GL = { canvas, gl, body, prop, tex, bones: new Float32Array(52 * 4) };
  }
  function load() {
    if (ASSET) return ASSET;
    ASSET = Promise.all([
      fetch('models/mannequin.bin').then((r) => { if (!r.ok) throw new Error('mannequin.bin ' + r.status); return r.arrayBuffer(); }),
      new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('mannequin-peau.jpg')); im.src = 'models/mannequin-peau.jpg'; }),
    ]).then(([buf, img]) => { RIG = parseRig(buf); initGL(img); state = 'ok'; kick(); return true; })
      .catch((e) => { state = 'ko'; views.forEach((v) => v.canvas.classList.add('ko')); if (window.console) console.warn('WL3D', e); return false; });
    return ASSET;
  }
  function drawScene(ex, time, cam, w, h, thick, mask) {
    const g = GL; const gl = g.gl; const R = RIG;
    ready(ex);
    const [sa, sb, t] = timeline(ex, time);
    const s = blend(sa, sb, t);
    const fit = fitOf(ex);
    const fov = 26 * D2R; const asp = w / h;
    const dist = fit.rad / Math.sin(Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * asp)) / 2);
    const cy = Math.cos(cam.pitch), sy = Math.sin(cam.pitch);
    const eye = add(fit.c, [Math.sin(cam.yaw) * cy * dist, sy * dist, Math.cos(cam.yaw) * cy * dist]);
    const view = mLook(eye, fit.c, [0, 1, 0]);
    const vp = mMul(mPersp(fov, asp, Math.max(0.05, dist - fit.rad * 1.6), dist + fit.rad * 1.6), view);
    const right = [view[0], view[4], view[8]], up = [view[1], view[5], view[9]], back = [view[2], view[6], view[10]];
    const light = norm(add(add(mul(right, -0.5), mul(up, 0.72)), mul(back, 0.62)));
    // os : rotation et translation qui amènent le repos sur la pose, en quaternion dual (partie réelle, partie duale)
    const bm = g.bones;
    for (let i = 0; i < NB; i++) {
      const q = qMul(s.W[i], qConj(R.bw[i].q)); const tr = sub(s.P[i], qRot(q, R.bw[i].p));
      const dq = qMul([tr[0], tr[1], tr[2], 0], q); const o = i * 8;
      bm[o] = q[0]; bm[o + 1] = q[1]; bm[o + 2] = q[2]; bm[o + 3] = q[3];
      bm[o + 4] = dq[0] * 0.5; bm[o + 5] = dq[1] * 0.5; bm[o + 6] = dq[2] * 0.5; bm[o + 7] = dq[3] * 0.5;
    }
    gl.viewport(0, 0, w, h); gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE);
    const tint = mask ? tintOf(ex, true) : tintOf(ex);
    // --- corps
    let L = g.body.loc; gl.useProgram(g.body.p);
    for (let i = 0; i < 6; i++) gl.enableVertexAttribArray(i);
    const vb = R.vb;
    gl.bindBuffer(gl.ARRAY_BUFFER, vb.pos); gl.vertexAttribPointer(0, 3, gl.UNSIGNED_SHORT, true, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, vb.nrm); gl.vertexAttribPointer(1, 3, gl.BYTE, true, 4, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, vb.uv); gl.vertexAttribPointer(2, 2, gl.UNSIGNED_SHORT, true, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, vb.jnt); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, vb.wgt); gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, vb.zone); gl.vertexAttribPointer(5, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vb.idx);
    gl.uniformMatrix4fv(L.uVP, false, vp); gl.uniform4fv(L.uB, bm); gl.uniform3fv(L.uCam, eye); gl.uniform3fv(L.uL, light);
    const hd = R.head; gl.uniform3fv(L.uLo, hd.lo); gl.uniform3f(L.uSc, hd.hi[0] - hd.lo[0], hd.hi[1] - hd.lo[1], hd.hi[2] - hd.lo[2]);
    gl.uniform4fv(L.uZc, tint.z); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, g.tex); gl.uniform1i(L.uTex, 0);
    gl.uniform1f(L.uOut, 0); gl.uniform1f(L.uMode, mask ? 2 : 0); gl.cullFace(gl.BACK);
    for (let i = 0; i < R.groups.length; i++) {
      const gr = R.groups[i]; const c = tint.g[i];
      if (c) gl.uniform4fv(L.uTint, c); else gl.uniform4f(L.uTint, 0, 0, 0, 0);
      gl.drawElements(gl.TRIANGLES, gr.ic, gl.UNSIGNED_SHORT, gr.i0 * 2);
    }
    if (thick > 0) {   // fin contour
      gl.cullFace(gl.FRONT); gl.uniform1f(L.uMode, 1); gl.uniform4f(L.uFlat, COL.ink[0], COL.ink[1], COL.ink[2], 1); gl.uniform1f(L.uOut, dist * thick);
      gl.drawElements(gl.TRIANGLES, R.ni, gl.UNSIGNED_SHORT, 0);
    }
    for (let i = 2; i < 6; i++) gl.disableVertexAttribArray(i);
    // --- accessoires
    const parts = propParts(ex.props, s.J);
    if (parts.length) {
      L = g.prop.loc; gl.useProgram(g.prop.p);
      gl.uniformMatrix4fv(L.uVP, false, vp); gl.uniform3fv(L.uCam, eye); gl.uniform3fv(L.uL, light);
      for (const pass of [0, 1]) {
        gl.cullFace(pass ? gl.FRONT : gl.BACK); gl.uniform1f(L.uMode, pass); gl.uniform1f(L.uOut, pass ? dist * Math.max(thick, 0.0012) : 0);
        if (pass) gl.uniform4f(L.uFlat, COL.ink[0], COL.ink[1], COL.ink[2], 1);
        for (const p of parts) {
          gl.bindBuffer(gl.ARRAY_BUFFER, p.mesh.vp); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, p.mesh.vn); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, p.mesh.vi);
          gl.uniformMatrix4fv(L.uM, false, p.model); if (!pass) gl.uniform3fv(L.uBase, p.base);
          gl.drawElements(gl.TRIANGLES, p.mesh.idx.length, gl.UNSIGNED_SHORT, 0);
        }
      }
    }
    gl.cullFace(gl.BACK); gl.disable(gl.SCISSOR_TEST);
  }

  /* ---------- vues : chaque vue est un <canvas> 2D qui reçoit l'image du rendu commun ---------- */
  const views = new Set(); let raf = 0; const T0ms = performance.now();
  function ensureSize(px) {
    const g = GL; const need = Math.min(2048, Math.max(px, 64));
    if (g.canvas.width < need) { g.canvas.width = g.canvas.height = Math.min(2048, Math.ceil(need / 256) * 256); }
  }
  function paint(v, now) {
    const c = v.canvas; const dpr = Math.min(window.devicePixelRatio || 1, 3);
    let w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (!w || !h) return;
    const mx = Math.max(w, h); if (mx > 1400) { w = Math.round(w * 1400 / mx); h = Math.round(h * 1400 / mx); }
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    ensureSize(Math.max(w, h));
    const time = v.fixed != null ? v.fixed : (now - T0ms) / 1000;
    drawScene(v.ex, time, v.cam, w, h, c.clientWidth < 200 ? 0.0022 : 0.0009);
    const ctx = v.ctx; ctx.clearRect(0, 0, w, h);
    ctx.drawImage(GL.canvas, 0, GL.canvas.height - h, w, h, 0, 0, w, h);
    if (!v.shown) { v.shown = true; c.classList.add('ready'); }
  }
  function loop(now) {
    raf = 0;
    if (state === 'ko') { views.clear(); return; }
    let alive = false;
    for (const v of [...views]) {
      if (!v.canvas.isConnected) { if (v.seen || now - v.born > 4000) { views.delete(v); continue; } alive = true; continue; }
      v.seen = true;
      if (!v.on) continue;
      alive = true;
      if (state !== 'ok') continue;
      if (v.thumb && now - v.last < 45) continue;
      v.last = now;
      try { paint(v, now); } catch (e) { views.delete(v); if (window.console) console.warn('WL3D', e); }
    }
    if (alive && views.size) raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf && views.size) raf = requestAnimationFrame(loop); };
  let io = null;
  /* Crée la vue d'un exercice. opts.thumb : vignette (angle fixe) ; sinon grande vue qu'on fait tourner au doigt. */
  function view(id, opts) {
    const ex = EX.get(id); if (!ex || state === 'ko') return null;
    try { const t = document.createElement('canvas'); if (!window.WebGLRenderingContext || !t.getContext) return null; } catch (e) { return null; }
    load();
    opts = opts || {};
    const canvas = document.createElement('canvas');
    canvas.className = 'm3d' + (opts.thumb ? ' m3d-thumb' : '') + (opts.cls ? ' ' + opts.cls : '');
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', (opts.thumb ? 'Animation : ' : 'Animation en 3D, à faire tourner au doigt : ') + ex.name);
    const c0 = ex.cam || {};
    const v = { canvas, ctx: canvas.getContext('2d'), ex, thumb: !!opts.thumb, on: !opts.thumb, last: 0, seen: false, shown: false, born: performance.now(), fixed: opts.time,
      cam: { yaw: (c0.yaw == null ? 60 : c0.yaw) * D2R, pitch: (c0.pitch == null ? 14 : c0.pitch) * D2R } };
    canvas._play = (on) => { v.on = !!on; if (on) kick(); };
    canvas._view = v;
    if (!opts.thumb) {
      let drag = null;
      canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ignoré */ } canvas.classList.add('drag'); });
      canvas.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        // gauche-droite : tour complet ; haut-bas : du dessus jusqu'au dessous du mannequin
        v.cam.yaw -= (e.clientX - drag.x) * 0.011; v.cam.pitch = clamp(v.cam.pitch + (e.clientY - drag.y) * 0.010, -1.5, 1.5);
        drag.x = e.clientX; drag.y = e.clientY; e.preventDefault();
      });
      const end = (e) => { if (drag && e.pointerId === drag.id) { drag = null; canvas.classList.remove('drag'); } };
      canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
      canvas.addEventListener('click', (e) => e.stopPropagation());
      canvas.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
    } else if ('IntersectionObserver' in window) {
      if (!io) io = new IntersectionObserver((ents) => ents.forEach((en) => en.target._play && en.target._play(en.isIntersecting)), { rootMargin: '40px 0px' });
      io.observe(canvas);
    } else v.on = true;
    views.add(v); kick();
    return canvas;
  }

  window.WL3D = {
    define, view, has: (id) => EX.has(id),
    credit: 'Modèle 3D : « Male base muscular anatomy » par Harshit Prajapati, CC BY 4.0, modifié.',
    list: () => [...EX.values()].map((e) => ({ id: e.id, name: e.name, leaf: e.leaf, p: e.p, s: e.s || [], side: !!e.side, dup: e.dup || [] })),
    _dbg: { snap: (id, yaw, pitch, time, n) => { const ex = EX.get(id); ensureSize(n); drawScene(ex, time, { yaw: yaw * D2R, pitch: pitch * D2R }, n, n, 0, true); const gl = GL.gl; const px = new Uint8Array(n * n * 4); gl.readPixels(0, 0, n, n, gl.RGBA, gl.UNSIGNED_BYTE, px); let c = 0, b = 0; for (let i = 0; i < px.length; i += 4) { if (px[i + 3] > 0) { b++; if (px[i] > 128) c++; } } return [c, b]; }, load, state: () => state, EX, timeline, fitOf, ready, blend, solvePose, B, X, BN, qRot, loadRig: (buf) => { RIG = parseRig(buf); return RIG; }, rig: () => RIG, state: () => state },
  };
})();
