'use strict';
/* =====================================================================
   WorkLog : mannequin 3D des exercices « maison » (étirements, mobilité).
   Tout est dessiné par le téléphone (WebGL), sans image ni réseau :
   - un mannequin articulé, les muscles étirés colorés sur le corps ;
   - une animation en boucle entre les positions de l'exercice ;
   - on fait tourner le mannequin au doigt (gauche-droite, haut-bas), sans zoom.
   Les exercices eux-mêmes sont décrits dans exercices-3d.js.
   ===================================================================== */
(function () {
  const PI = Math.PI; const D2R = PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

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
  function slerpV(a, b, t) {
    const d = clamp(dot(a, b), -1, 1);
    if (d > 0.9995) return nlerp(a, b, t);
    const th = Math.acos(d); const s = Math.sin(th);
    if (s < 1e-4) return nlerp(a, b, t);
    return add(mul(a, Math.sin((1 - t) * th) / s), mul(b, Math.sin(t * th) / s));
  }
  const qAxis = (ax, ang) => { const s = Math.sin(ang / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(ang / 2)]; };
  const qX = (d) => qAxis([1, 0, 0], d * D2R); const qY = (d) => qAxis([0, 1, 0], d * D2R); const qZ = (d) => qAxis([0, 0, 1], d * D2R);
  const qMul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  function qRot(q, v) {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
    return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
  }
  function qSlerp(a, b, t) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    let bb = b; if (d < 0) { d = -d; bb = [-b[0], -b[1], -b[2], -b[3]]; }
    let s0 = 1 - t, s1 = t;
    if (d < 0.9995) { const th = Math.acos(d); const s = Math.sin(th); s0 = Math.sin((1 - t) * th) / s; s1 = Math.sin(t * th) / s; }
    const q = [a[0] * s0 + bb[0] * s1, a[1] * s0 + bb[1] * s1, a[2] * s0 + bb[2] * s1, a[3] * s0 + bb[3] * s1];
    const l = Math.hypot(q[0], q[1], q[2], q[3]); return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
  }
  const qBasis = (q) => [qRot(q, [1, 0, 0]), qRot(q, [0, 1, 0]), qRot(q, [0, 0, 1])];

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
  const IDENT = mFrame([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);

  /* ---------- maillages ---------- */
  /* Anneaux de contrôle { y, rx, rz, zo, xo } lissés (Catmull-Rom) puis fermés par des calottes. */
  function refine(ctrl, sub) {
    const out = []; const g = (i) => ctrl[clamp(i, 0, ctrl.length - 1)];
    const keys = ['y', 'rx', 'rz', 'zo', 'xo'];
    for (let i = 0; i < ctrl.length - 1; i++) {
      for (let k = 0; k < sub; k++) {
        const t = k / sub; const r = {};
        for (const key of keys) {
          const p0 = g(i - 1)[key] || 0, p1 = g(i)[key] || 0, p2 = g(i + 1)[key] || 0, p3 = g(i + 2)[key] || 0;
          r[key] = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
        }
        out.push(r);
      }
    }
    const l = ctrl[ctrl.length - 1]; out.push({ y: l.y, rx: l.rx, rz: l.rz, zo: l.zo || 0, xo: l.xo || 0 });
    return out;
  }
  function withCaps(rings, capA, capB) {
    const out = []; const n = 4;
    const a = rings[0], b = rings[rings.length - 1]; const dir = Math.sign(b.y - a.y) || 1;
    if (capA) for (let k = n; k >= 1; k--) { const ph = (k / n) * PI / 2; const c = Math.max(Math.cos(ph), 0.02); out.push({ y: a.y - dir * capA * Math.sin(ph), rx: a.rx * c, rz: a.rz * c, zo: a.zo, xo: a.xo, cap: true }); }
    rings.forEach((r) => out.push(r));
    if (capB) for (let k = 1; k <= n; k++) { const ph = (k / n) * PI / 2; const c = Math.max(Math.cos(ph), 0.02); out.push({ y: b.y + dir * capB * Math.sin(ph), rx: b.rx * c, rz: b.rz * c, zo: b.zo, xo: b.xo, cap: true }); }
    return out;
  }
  /* Surface de révolution à section elliptique. t0/t1 : hauteurs qui valent 0 et 1 dans la coordonnée « longueur ». */
  function lathe(rings, segs, t0, t1, map) {
    const R = rings.length; const W = segs + 1;
    const pos = new Float32Array(R * W * 3), uv = new Float32Array(R * W * 2);
    for (let r = 0; r < R; r++) {
      const g = rings[r];
      for (let j = 0; j < W; j++) {
        const th = -PI + (2 * PI * j) / segs; const i = r * W + j;
        let p = [(g.xo || 0) + g.rx * Math.sin(th), g.y, (g.zo || 0) + g.rz * Math.cos(th)];
        if (map) p = map(p);
        pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
        uv[i * 2] = th; uv[i * 2 + 1] = (g.y - t0) / (t1 - t0);
      }
    }
    const idx = new Uint16Array((R - 1) * segs * 6); let k = 0;
    for (let r = 0; r < R - 1; r++) for (let j = 0; j < segs; j++) {
      const a = r * W + j, b = a + 1, c = a + W, d = c + 1;
      idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
    }
    const m = { pos, uv, idx, nrm: new Float32Array(R * W * 3), R, W, segs };
    orient(m); normals(m);
    return m;
  }
  function orient(m) {   // faces vers l'extérieur (volume signé positif)
    let vol = 0; const p = m.pos; const ix = m.idx;
    for (let i = 0; i < ix.length; i += 3) {
      const a = ix[i] * 3, b = ix[i + 1] * 3, c = ix[i + 2] * 3;
      vol += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
    }
    if (vol < 0) for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  }
  function normals(m) {
    const p = m.pos, n = m.nrm, ix = m.idx; n.fill(0);
    for (let i = 0; i < ix.length; i += 3) {
      const a = ix[i] * 3, b = ix[i + 1] * 3, c = ix[i + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      n[a] += nx; n[a + 1] += ny; n[a + 2] += nz; n[b] += nx; n[b + 1] += ny; n[b + 2] += nz; n[c] += nx; n[c + 1] += ny; n[c + 2] += nz;
    }
    if (m.W) {   // couture : les deux bords partagent la même normale
      for (let r = 0; r < m.R; r++) {
        const a = (r * m.W) * 3, b = (r * m.W + m.segs) * 3;
        for (let k = 0; k < 3; k++) { const s = n[a + k] + n[b + k]; n[a + k] = s; n[b + k] = s; }
      }
      // calottes : tous les points d'un anneau quasi ponctuel prennent la même normale
      for (const r of [0, m.R - 1]) {
        let sx = 0, sy = 0, sz = 0;
        for (let j = 0; j < m.W; j++) { const a = (r * m.W + j) * 3; sx += n[a]; sy += n[a + 1]; sz += n[a + 2]; }
        for (let j = 0; j < m.W; j++) { const a = (r * m.W + j) * 3; n[a] = sx; n[a + 1] = sy; n[a + 2] = sz; }
      }
    }
    for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  }
  function merge(list) {
    let nv = 0, ni = 0; list.forEach((m) => { nv += m.pos.length / 3; ni += m.idx.length; });
    const o = { pos: new Float32Array(nv * 3), nrm: new Float32Array(nv * 3), uv: new Float32Array(nv * 2), idx: new Uint16Array(ni) };
    let v = 0, i = 0;
    for (const m of list) {
      o.pos.set(m.pos, v * 3); o.nrm.set(m.nrm, v * 3); o.uv.set(m.uv, v * 2);
      for (let k = 0; k < m.idx.length; k++) o.idx[i + k] = m.idx[k] + v;
      v += m.pos.length / 3; i += m.idx.length;
    }
    return o;
  }
  function ellipsoid(c, r, segs, rings) {
    const rs = [];
    for (let k = 0; k <= rings; k++) { const ph = -PI / 2 + (PI * k) / rings; const s = Math.max(Math.cos(ph), 0.015); rs.push({ y: c[1] + r[1] * Math.sin(ph), rx: r[0] * s, rz: r[2] * s, xo: c[0], zo: c[2] }); }
    return lathe(rs, segs, c[1] - r[1], c[1] + r[1]);
  }
  function tilt(m, ax, deg, piv) {   // incline un maillage autour d'un pivot
    const q = qAxis(ax, deg * D2R);
    for (let i = 0; i < m.pos.length; i += 3) {
      const p = add(qRot(q, sub([m.pos[i], m.pos[i + 1], m.pos[i + 2]], piv)), piv); m.pos[i] = p[0]; m.pos[i + 1] = p[1]; m.pos[i + 2] = p[2];
      const n = qRot(q, [m.nrm[i], m.nrm[i + 1], m.nrm[i + 2]]); m.nrm[i] = n[0]; m.nrm[i + 1] = n[1]; m.nrm[i + 2] = n[2];
    }
    return m;
  }
  function boxMesh() {   // cube unité centré, arêtes vives
    const pos = [], nrm = [], idx = [];
    const F = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
    for (const [n, u, v] of F) {
      const b = pos.length / 3;
      for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = add(mul(n, 0.5), add(mul(u, a * 0.5), mul(v, c * 0.5))); pos.push(p[0], p[1], p[2]); nrm.push(n[0], n[1], n[2]); }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const m = { pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(pos.length / 3 * 2), idx: new Uint16Array(idx) };
    orient(m); return m;
  }
  function cylMesh(segs) {   // cylindre unité : rayon 1, de y = 0 à y = 1
    return lathe(withCaps([{ y: 0, rx: 1, rz: 1 }, { y: 1, rx: 1, rz: 1 }], 0.001, 0.001), segs, 0, 1);
  }

  /* ---------- morphologie (mètres) ---------- */
  const B = { hipX: 0.098, thigh: 0.43, shin: 0.42, ankle: 0.07, lum: 0.106, tho: 0.17, neck: 0.265, neckL: 0.085, shX: 0.202, shY: 0.212, upper: 0.29, fore: 0.26, hand: 0.165 };
  const TS = 1.06;   // les hauteurs du tronc ci-dessous sont multipliées par TS
  const TORSO_CTRL = [
    { y: -0.105, rx: 0.090, rz: 0.080, zo: -0.005 }, { y: -0.05, rx: 0.168, rz: 0.114, zo: -0.012 }, { y: 0.0, rx: 0.186, rz: 0.122, zo: -0.016 },
    { y: 0.07, rx: 0.172, rz: 0.112, zo: -0.010 }, { y: 0.15, rx: 0.150, rz: 0.097, zo: -0.002 }, { y: 0.22, rx: 0.156, rz: 0.100, zo: 0 },
    { y: 0.30, rx: 0.176, rz: 0.112, zo: 0.005 }, { y: 0.38, rx: 0.192, rz: 0.122, zo: 0.008 }, { y: 0.45, rx: 0.190, rz: 0.112, zo: 0 },
    { y: 0.495, rx: 0.150, rz: 0.094, zo: -0.004 }, { y: 0.53, rx: 0.080, rz: 0.070, zo: -0.008 }].map((r) => Object.assign(r, { y: r.y * TS }));
  const T0 = -0.105 * TS, T1 = 0.53 * TS;
  const ty = (y) => (y * TS - T0) / (T1 - T0);
  const SEG = 28;
  const M = {};
  function buildMeshes() {
    const torsoRings = withCaps(refine(TORSO_CTRL, 3), 0.03, 0.02);
    M.torso = lathe(torsoRings, SEG, T0, T1); M.torso.rings = torsoRings; M.torso.dynamic = true;
    M.neck = lathe(withCaps([{ y: -0.03, rx: 0.064, rz: 0.060 }, { y: 0.04, rx: 0.054, rz: 0.055 }, { y: 0.11, rx: 0.052, rz: 0.053 }], 0.01, 0.01), 18, 0, 0.1);
    const head = ellipsoid([0, 0.108, 0.014], [0.086, 0.116, 0.102], 22, 14);
    const nose = ellipsoid([0, 0.088, 0.113], [0.013, 0.022, 0.016], 8, 6);
    const earL = ellipsoid([0.085, 0.10, 0.008], [0.010, 0.026, 0.016], 8, 6), earR = ellipsoid([-0.085, 0.10, 0.008], [0.010, 0.026, 0.016], 8, 6);
    [nose, earL, earR].forEach((m) => m.uv.fill(9));   // hors des zones colorées
    M.head = merge([head, nose, earL, earR]);
    M.upper = lathe(withCaps(refine([{ y: 0, rx: 0.066, rz: 0.068 }, { y: -0.07, rx: 0.060, rz: 0.062 }, { y: -0.15, rx: 0.053, rz: 0.058 }, { y: -0.24, rx: 0.045, rz: 0.047 }, { y: -B.upper, rx: 0.042, rz: 0.043 }], 3), 0.06, 0.03), 18, 0, -B.upper);
    M.fore = lathe(withCaps(refine([{ y: 0, rx: 0.040, rz: 0.040 }, { y: -0.07, rx: 0.047, rz: 0.045 }, { y: -0.16, rx: 0.038, rz: 0.035 }, { y: -B.fore, rx: 0.030, rz: 0.025 }], 3), 0.03, 0.015), 16, 0, -B.fore);
    const palm = () => lathe(withCaps(refine([{ y: 0.01, rx: 0.029, rz: 0.021 }, { y: -0.04, rx: 0.041, rz: 0.018 }, { y: -0.09, rx: 0.042, rz: 0.015 }, { y: -0.14, rx: 0.035, rz: 0.012 }, { y: -0.165, rx: 0.024, rz: 0.009 }], 2), 0.012, 0.01), 14, 0, -0.165);
    const thumb = (s) => tilt(ellipsoid([s * 0.044, -0.062, 0.006], [0.013, 0.036, 0.012], 8, 6), [0, 0, 1], s * 22, [s * 0.03, -0.03, 0]);
    M.handL = merge([palm(), thumb(1)]); M.handR = merge([palm(), thumb(-1)]);
    M.fist = ellipsoid([0, -0.048, 0.004], [0.040, 0.050, 0.034], 14, 10);
    M.thigh = lathe(withCaps(refine([{ y: 0.01, rx: 0.086, rz: 0.098 }, { y: -0.08, rx: 0.091, rz: 0.099 }, { y: -0.20, rx: 0.083, rz: 0.089 }, { y: -0.33, rx: 0.067, rz: 0.071 }, { y: -B.thigh, rx: 0.058, rz: 0.061 }], 3), 0.075, 0.04), 22, 0, -B.thigh);
    M.shin = lathe(withCaps(refine([{ y: 0, rx: 0.057, rz: 0.060, zo: 0 }, { y: -0.10, rx: 0.059, rz: 0.066, zo: -0.013 }, { y: -0.22, rx: 0.049, rz: 0.053, zo: -0.008 }, { y: -0.35, rx: 0.036, rz: 0.039, zo: 0 }, { y: -B.shin, rx: 0.034, rz: 0.038, zo: 0 }], 3), 0.04, 0.03), 20, 0, -B.shin);
    // Pied : origine à la cheville, +Z vers les orteils, +Y vers le dessus du pied, semelle plate à y = -0.07.
    M.foot = lathe(withCaps(refine([{ y: -0.055, rx: 0.028, rz: 0.030, zo: -0.038 }, { y: -0.02, rx: 0.036, rz: 0.040, zo: -0.032 }, { y: 0.04, rx: 0.040, rz: 0.034, zo: -0.038 },
      { y: 0.10, rx: 0.045, rz: 0.026, zo: -0.046 }, { y: 0.155, rx: 0.045, rz: 0.019, zo: -0.052 }, { y: 0.19, rx: 0.034, rz: 0.014, zo: -0.057 }], 2), 0.012, 0.014), 16, 0, 1,
    (p) => [p[0], Math.max(p[2], -B.ankle), p[1]]);
    M.ball = ellipsoid([0, 0, 0], [1, 1, 1], 14, 9);
    M.box = boxMesh(); M.cyl = cylMesh(14);
    const q = new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]);
    M.ground = { pos: q, nrm: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), uv: new Float32Array(8), idx: new Uint16Array([0, 2, 1, 0, 3, 2]) };
  }

  /* ---------- zones musculaires ----------
     Chaque zone est une tache sur une partie du corps : angle autour du membre (0° = devant,
     90° = côté gauche du corps, 180° = derrière), position sur la longueur, demi-largeurs.
     Les clés finissent par L (gauche) ou R (droite) ; « mir » retourne l'angle pour le côté droit. */
  const deg = (d) => d * D2R;
  function zone(key, th, t, a, b, sq) { return { key, th: deg(th), t, ia: 1 / deg(a), ib: 1 / b, sq: sq || 0 }; }
  function sides(base, th, t, a, b, sq) { return [zone(base + 'L', th, t, a, b, sq), zone(base + 'R', -th, t, a, b, sq)]; }
  const hy = (h) => h * TS / (T1 - T0);
  const ZONES = {
    torsoLow: [].concat(
      [zone('abs', 0, ty(0.20), 21, hy(0.125), 0.8)], sides('obl', 62, ty(0.19), 24, hy(0.105), 0.4), sides('low', 166, ty(0.14), 14, hy(0.10), 0.5),
      sides('lat', 124, ty(0.27), 30, hy(0.13), 0.3), sides('glute', 146, ty(-0.018), 32, hy(0.088), 0.35), sides('pir', 142, ty(0.008), 17, hy(0.027), 0),
      sides('hipf', 31, ty(0.03), 17, hy(0.062), 0.2), sides('tfl', 84, ty(-0.005), 13, hy(0.055), 0.2)),
    torsoUp: [].concat(
      [zone('abs', 0, ty(0.20), 21, hy(0.125), 0.8)], sides('obl', 62, ty(0.19), 24, hy(0.105), 0.4), sides('low', 166, ty(0.14), 14, hy(0.10), 0.5),
      sides('lat', 124, ty(0.27), 30, hy(0.13), 0.3), sides('pec', 30, ty(0.385), 29, hy(0.064), 0.6), sides('mid', 163, ty(0.345), 16, hy(0.065), 0.4),
      sides('trap', 158, ty(0.465), 27, hy(0.055), 0.3), sides('cuff', 138, ty(0.405), 15, hy(0.045), 0.2)),
    neckL: [zone('trapL', 115, 0.35, 60, 0.75, 0.3), zone('trapR', -115, 0.35, 60, 0.75, 0.3)],
    upperL: [zone('bicepsL', 0, 0.62, 52, 0.26, 0.4), zone('tricepsL', 180, 0.6, 58, 0.30, 0.4), zone('deltAL', 28, 0.10, 44, 0.22, 0.2), zone('deltML', 92, 0.10, 34, 0.22, 0.2), zone('deltPL', 156, 0.10, 44, 0.22, 0.2)],
    foreL: [zone('forearmL', 0, 0.36, 130, 0.33, 0.3)],
    thighL: [zone('quadL', 8, 0.52, 58, 0.41, 0.5), zone('hamL', 180, 0.56, 50, 0.36, 0.5), zone('addL', -102, 0.38, 36, 0.33, 0.3), zone('tflL', 92, 0.22, 20, 0.24, 0.3), zone('gluteL', 172, 0.05, 78, 0.17, 0.3)],
    shinL: [zone('calfL', 180, 0.29, 64, 0.27, 0.4), zone('tibL', 24, 0.42, 22, 0.32, 0.3)],
  };
  const mir = (list) => list.map((z) => ({ key: z.key.replace(/L$/, 'R'), th: -z.th, t: z.t, ia: z.ia, ib: z.ib, sq: z.sq }));
  ZONES.upperR = mir(ZONES.upperL); ZONES.foreR = mir(ZONES.foreL); ZONES.thighR = mir(ZONES.thighL); ZONES.shinR = mir(ZONES.shinL);
  ZONES.head = [{ key: 'hair', th: PI, t: 0.80, ia: 1 / deg(150), ib: 1 / 0.36, sq: 0.2 }];

  const COL = {
    body: [0.874, 0.846, 0.930], skin: [0.918, 0.900, 0.952], zone: [0.800, 0.762, 0.886], hair: [0.560, 0.510, 0.690],
    prim: [0.416, 0.310, 0.753], sec: [0.733, 0.659, 0.925], ink: [0.200, 0.170, 0.300],
    wood: [0.905, 0.800, 0.640], woodDark: [0.800, 0.660, 0.450], band: [0.250, 0.640, 0.560], steel: [0.420, 0.400, 0.480],
  };
  const MAXZ = 16;
  /* Tableaux d'uniformes des zones d'une partie du corps pour un exercice donné. */
  function zoneUniforms(list, mus) {
    const order = (list || []).slice().sort((a, b) => rank(a) - rank(b));
    function rank(z) { const l = mus[z.key]; return z.key === 'hair' ? 0 : l === 1 ? 3 : l === 2 ? 2 : 1; }
    const n = Math.min(order.length, MAXZ);
    const pa = new Float32Array(MAXZ * 4), pc = new Float32Array(MAXZ * 4), ps = new Float32Array(MAXZ);
    for (let i = 0; i < n; i++) {
      const z = order[i]; const l = mus[z.key];
      const c = z.key === 'hair' ? COL.hair : l === 1 ? COL.prim : l === 2 ? COL.sec : COL.zone;
      pa.set([z.th, z.t, z.ia, z.ib], i * 4); pc.set([c[0], c[1], c[2], l || z.key === 'hair' ? 1 : 0.5], i * 4); ps[i] = z.sq;
    }
    return { n, pa, pc, ps };
  }

  /* ---------- pose : de la description aux articulations ----------
     Repère : le personnage debout regarde vers +Z, sa gauche est +X, le haut est +Y.
     Une pose donne le bassin (position, orientation), la colonne, la tête, puis pour chaque
     membre soit une cible (main ou cheville posée quelque part), soit des directions. */
  const LIMBS = ['lL', 'lR', 'aL', 'aR'];
  function jq(e) { e = e || [0, 0, 0]; return qMul(qMul(qY(e[2] || 0), qZ(-(e[1] || 0))), qX(e[0] || 0)); }
  function prep(s) {
    const r = s.rot || [0, 0, 0, 0];
    const half = s.spine ? s.spine.map((v) => v / 2) : null;
    const k = {
      pos: (s.pelvis || [0, B.thigh + B.shin + B.ankle, 0]).slice(),
      pq: qMul(qMul(qMul(qY(r[1] || 0), qX(r[0] || 0)), qZ(-(r[2] || 0))), qY(r[3] || 0)),
      lq: jq(s.lumbar || half), cq: jq(s.chest || half), nq: jq(s.neck), hq: jq(s.head),
      free: !!s.free, limbs: {},
    };
    for (const id of LIMBS) k.limbs[id] = Object.assign({}, s[id] || {});
    return k;
  }
  function torsoFrames(pos, pq, lq, cq, nq, hq) {
    const P = { o: pos, q: pq };
    const A = { o: add(P.o, qRot(P.q, [0, B.lum, 0])), q: qMul(P.q, lq) };
    const C = { o: add(A.o, qRot(A.q, [0, B.tho, 0])), q: qMul(A.q, cq) };
    const N = { o: add(C.o, qRot(C.q, [0, B.neck, 0])), q: qMul(C.q, nq) };
    const H = { o: add(N.o, qRot(N.q, [0, B.neckL, 0])), q: qMul(N.q, hq) };
    return { P, A, C, N, H };
  }
  const toW = (f, v) => add(f.o, qRot(f.q, v));
  const dirW = (f, v) => qRot(f.q, v);
  function ik(a, c, l1, l2, pole) {
    let d = sub(c, a); let dl = len(d);
    const max = (l1 + l2) * 0.9995, min = Math.abs(l1 - l2) + 0.01;
    const n = norm(d, [0, -1, 0]); dl = clamp(dl, min, max);
    const x = (l1 * l1 - l2 * l2 + dl * dl) / (2 * dl); const hgt = Math.sqrt(Math.max(l1 * l1 - x * x, 0));
    const pp = norm(perp(pole, n), norm(perp([0.3, 0.2, 1], n)));
    const mid = add(a, add(mul(n, x), mul(pp, hgt)));
    const end = add(a, mul(n, dl));
    return { d1: norm(sub(mid, a)), d2: norm(sub(end, mid)), pole: pp };
  }
  /* Un membre pour une pose : directions du premier et du second segment, et côté du pli. */
  function limbOf(id, L, F, J) {
    const arm = id[0] === 'a'; const side = id[1] === 'L' ? 1 : -1;
    const base = arm ? F.C : F.P;
    const root = arm ? toW(F.C, add([side * B.shX, B.shY, -0.005], L.sh || [0, 0, 0])) : toW(F.P, [side * B.hipX, 0, 0]);
    const l1 = arm ? B.upper : B.thigh, l2 = arm ? B.fore : B.shin;
    let pole = L.p ? L.p : L.pb ? dirW(base, L.pb) : dirW(base, arm ? [side * 0.5, -0.6, -0.8] : [side * 0.1, 0.1, 1]);
    pole = norm(pole);
    let tgt = null;
    if (L.at) tgt = L.at;
    else if (L.atb) tgt = toW(base, L.atb);
    else if (L.on) tgt = add(J[L.on[0]], L.on[1] || [0, 0, 0]);
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
  function endOf(id, L, fr, F) {
    const arm = id[0] === 'a'; const side = id[1] === 'L' ? 1 : -1;
    const d2 = mul(fr.y2, -1);
    if (!arm) {
      let mode = L.foot;
      if (mode == null) mode = (fr.end[1] < 0.11 && d2[1] < -0.45) ? 'flat' : 28;
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
    if (typeof mode === 'object') { const a = norm(mode.d || d2); return { a, b: norm(perp(mode.n, a)) }; }
    const pr = (L.pron == null ? 90 : L.pron) * D2R * -side;   // 0 : paume vers l'avant du bras ; 90 : paume vers le corps
    const n = add(mul(fr.z2, Math.cos(pr)), mul(fr.x2, Math.sin(pr)));
    let a = d2;
    if (L.wrist) a = norm(add(mul(d2, Math.cos(L.wrist * D2R)), mul(n, -Math.sin(L.wrist * D2R))));   // + : poignet en extension
    return { a, b: norm(perp(n, a)) };
  }
  function solve(A, Bp, t) {
    const pos = lerp(A.pos, Bp.pos, t);
    const pq = qSlerp(A.pq, Bp.pq, t), lq = qSlerp(A.lq, Bp.lq, t), cq = qSlerp(A.cq, Bp.cq, t), nq = qSlerp(A.nq, Bp.nq, t), hq = qSlerp(A.hq, Bp.hq, t);
    let out = null;
    for (let pass = 0; pass < 2; pass++) {
      const F = torsoFrames(pos, pq, lq, cq, nq, hq);
      const J = { pelvis: F.P.o, chest: F.C.o, neck: F.N.o, head: toW(F.H, [0, 0.108, 0.014]) };
      const limbs = {};
      for (const id of LIMBS) {
        const arm = id[0] === 'a'; const sfx = id[1];
        const l1 = arm ? B.upper : B.thigh, l2 = arm ? B.fore : B.shin;
        const la = A.limbs[id], lb = Bp.limbs[id];
        const ra = limbOf(id, la, F, J); const rb = t > 0 && Bp !== A ? limbOf(id, lb, F, J) : ra;
        let r;
        if (ra === rb) r = ra;
        else if (ra.ik && rb.ik) { const k = ik(ra.root, lerp(ra.tgt, rb.tgt, t), l1, l2, nlerp(ra.pole, rb.pole, t)); r = { root: ra.root, pole: k.pole, d1: k.d1, d2: k.d2 }; }
        else r = { root: ra.root, pole: nlerp(ra.pole, rb.pole, t), d1: slerpV(ra.d1, rb.d1, t), d2: slerpV(ra.d2, rb.d2, t) };
        const fr = limbFrames(id, r, l1, l2);
        const ea = endOf(id, la, fr, F); const eb = ra === rb ? ea : endOf(id, lb, fr, F);
        const ea2 = ra === rb ? ea : { a: nlerp(ea.a, eb.a, t), b: nlerp(ea.b, eb.b, t) };
        const ya = arm ? mul(ea2.a, -1) : null;
        // main : Y = -doigts, Z = paume ; pied : Z = orteils, Y = dessus
        fr.ex = arm ? norm(cross(ya, norm(perp(ea2.b, ea2.a)))) : norm(cross(norm(perp(ea2.b, ea2.a)), ea2.a));
        fr.ey = arm ? ya : norm(perp(ea2.b, ea2.a)); fr.ez = arm ? norm(perp(ea2.b, ea2.a)) : ea2.a;
        fr.grip = (t < 0.5 ? la.grip : lb.grip) || false;
        limbs[id] = fr;
        if (arm) { J['sh' + sfx] = fr.root; J['elbow' + sfx] = fr.mid; J['wrist' + sfx] = fr.end; J['hand' + sfx] = add(fr.end, mul(fr.ey, -0.075)); J['tip' + sfx] = add(fr.end, mul(fr.ey, fr.grip ? -0.09 : -0.17)); }
        else { J['hip' + sfx] = fr.root; J['knee' + sfx] = fr.mid; J['ankle' + sfx] = fr.end; J['toe' + sfx] = add(fr.end, add(mul(fr.ez, 0.19), mul(fr.ey, -0.055))); J['heel' + sfx] = add(fr.end, add(mul(fr.ez, -0.05), mul(fr.ey, -0.05))); J['ball' + sfx] = add(fr.end, add(mul(fr.ez, 0.13), mul(fr.ey, -0.055))); }
      }
      out = { F, J, limbs };
      if (pass === 1 || (A.free && Bp.free)) break;
      // Le point le plus bas du corps touche le sol.
      const probes = [
        [J.heelL, 0.02], [J.heelR, 0.02], [J.ballL, 0.015], [J.ballR, 0.015], [J.toeL, 0.012], [J.toeR, 0.012], [J.ankleL, 0.034], [J.ankleR, 0.034],
        [J.kneeL, 0.054], [J.kneeR, 0.054], [toW(F.P, [0.09, -0.03, -0.035]), 0.105], [toW(F.P, [-0.09, -0.03, -0.035]), 0.105], [toW(F.P, [0, -0.01, 0.02]), 0.1], [toW(F.P, [0, -0.07, 0]), 0.075],
        [toW(F.A, [0, 0.07, 0]), 0.094], [toW(F.C, [0, 0.10, 0.005]), 0.114], [toW(F.C, [0.07, 0.17, 0]), 0.105], [toW(F.C, [-0.07, 0.17, 0]), 0.105],
        [J.shL, 0.062], [J.shR, 0.062], [J.elbowL, 0.038], [J.elbowR, 0.038], [J.wristL, 0.026], [J.wristR, 0.026], [J.handL, 0.018], [J.handR, 0.018], [J.tipL, 0.01], [J.tipR, 0.01], [J.head, 0.1],
      ];
      let low = Infinity; for (const [p, r] of probes) low = Math.min(low, p[1] - r);
      if (Math.abs(low) < 1e-4) break;
      pos[1] -= low;
    }
    return out;
  }

  /* Tronc : anneaux portés par le bassin, la taille et le thorax, mélangés près des articulations. */
  function skinTorso(mesh, F) {
    const fr = [F.P, F.A, F.C].map((f) => ({ o: f.o, b: qBasis(f.q) }));
    const rest = [0, B.lum, B.lum + B.tho];
    const p = mesh.pos; const W = mesh.W; let i = 0;
    for (let r = 0; r < mesh.R; r++) {
      const g = mesh.rings[r];
      const s1 = sstep(B.lum - 0.075, B.lum + 0.075, g.y), s2 = sstep(B.lum + B.tho - 0.075, B.lum + B.tho + 0.075, g.y);
      const w = [1 - s1, s1 * (1 - s2), s1 * s2];
      let c = [0, 0, 0], X = [0, 0, 0], Y = [0, 0, 0], Z = [0, 0, 0];
      for (let k = 0; k < 3; k++) {
        if (w[k] < 1e-4) continue; const f = fr[k];
        c = add(c, mul(add(f.o, mul(f.b[1], g.y - rest[k])), w[k]));
        X = add(X, mul(f.b[0], w[k])); Y = add(Y, mul(f.b[1], w[k])); Z = add(Z, mul(f.b[2], w[k]));
      }
      Y = norm(Y); X = norm(perp(X, Y)); Z = cross(X, Y);
      for (let j = 0; j < W; j++) {
        const th = -PI + (2 * PI * j) / mesh.segs; const sx = g.rx * Math.sin(th), sz = (g.zo || 0) + g.rz * Math.cos(th);
        p[i++] = c[0] + X[0] * sx + Z[0] * sz; p[i++] = c[1] + X[1] * sx + Z[1] * sz; p[i++] = c[2] + X[2] * sx + Z[2] * sz;
      }
    }
    normals(mesh);
  }

  /* ---------- accessoires ---------- */
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
      } else if (p.type === 'band') {   // élastique entre un point fixe et la main
        cyl(pt(p.a), pt(p.b), 0.009, COL.band);
      } else if (p.type === 'post') cyl(p.a, p.b, p.r || 0.03, COL.steel);
      else if (p.type === 'dumbbell') {   // haltère posé au sol, manche le long de X
        const c = p.pos; const r = p.r || 0.07; const hw = 0.11;
        cyl([c[0] - hw, r, c[2]], [c[0] + hw, r, c[2]], 0.016, COL.steel);
        cyl([c[0] - hw - 0.06, r, c[2]], [c[0] - hw, r, c[2]], r, COL.steel); cyl([c[0] + hw, r, c[2]], [c[0] + hw + 0.06, r, c[2]], r, COL.steel);
      }
    }
    return out;
  }

  /* ---------- exercices ---------- */
  const EX = new Map();
  function define(list) {
    for (const e of list) {
      const poses = {}; for (const [k, v] of Object.entries(e.poses)) poses[k] = prep(v);
      EX.set(e.id, Object.assign({}, e, { K: poses, fit: null, zu: null }));
    }
  }
  function timeline(ex, time) {
    const seq = ex.seq; let total = 0; for (const s of seq) total += s[1] + s[2];
    let t = (time * (ex.speed || 1)) % total;
    for (let i = 0; i < seq.length; i++) {
      const [k, hold, move] = seq[i];
      if (t < hold) return [ex.K[k], ex.K[k], 0];
      t -= hold;
      if (t < move) { const u = t / move; return [ex.K[k], ex.K[seq[(i + 1) % seq.length][0]], u * u * (3 - 2 * u)]; }
      t -= move;
    }
    return [ex.K[seq[0][0]], ex.K[seq[0][0]], 0];
  }
  function fitOf(ex) {
    if (ex.fit) return ex.fit;
    const pts = [];
    for (const k of Object.values(ex.K)) {
      const s = solve(k, k, 0);
      for (const [n, p] of Object.entries(s.J)) pts.push([p, /^(tip|toe|heel|ball|hand|wrist)/.test(n) ? 0.03 : 0.08]);
      pts.push([toW(s.F.H, [0, 0.215, 0.01]), 0.02]);
      for (const pr of ex.props || []) {
        if (pr.type === 'box') for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const sy of [0, 1]) pts.push([add(pr.pos, [sx * pr.size[0] / 2, sy * pr.size[1], sz * pr.size[2] / 2]), 0]);
        if (pr.type === 'dumbbell') pts.push([add(pr.pos, [0.17, 0.05, 0]), 0.05], [add(pr.pos, [-0.17, 0.05, 0]), 0.05]);
        if (pr.type === 'post') pts.push([pr.a, 0.03], [pr.b, 0.03]);
      }
    }
    const lo = [1e9, 0, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const [p, r] of pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k] - r); hi[k] = Math.max(hi[k], p[k] + r); }
    const c = mul(add(lo, hi), 0.5); let rad = 0;
    for (const [p, r] of pts) rad = Math.max(rad, len(sub(p, c)) + r);
    ex.fit = { c, rad: Math.max(rad, 0.5) };
    return ex.fit;
  }
  function zonesOf(ex) {
    if (ex.zu) return ex.zu;
    const mus = ex.mus || {}; const z = {};
    for (const k of Object.keys(ZONES)) z[k] = zoneUniforms(ZONES[k], mus);
    z.none = zoneUniforms([], mus);
    ex.zu = z; return z;
  }

  /* ---------- rendu ---------- */
  const VS = 'attribute vec3 aP;attribute vec3 aN;attribute vec2 aU;uniform mat4 uVP;uniform mat4 uM;uniform float uOut;uniform vec4 uSh;uniform mediump vec3 uCam;varying vec3 vN;varying vec3 vW;varying vec2 vU;'
    + 'void main(){vec3 n=normalize(mat3(uM)*aN);vec4 w=uM*vec4(aP,1.0);w.xyz+=n*uOut;if(uOut>0.0){w.xyz+=normalize(w.xyz-uCam)*uOut*5.0;}'
    + 'if(uSh.w>0.5){w.xz-=uSh.xz*(w.y/uSh.y);w.y=0.002;}vN=n;vW=w.xyz;vU=aU;gl_Position=uVP*w;}';
  const FS = 'precision mediump float;varying vec3 vN;varying vec3 vW;varying vec2 vU;uniform vec3 uBase;uniform mediump vec3 uCam;uniform vec3 uL;uniform float uMode;uniform vec4 uFlat;uniform vec4 uG;'
    + 'uniform int uZn;uniform vec4 uZa[16];uniform vec4 uZc[16];uniform float uZs[16];'
    + 'void main(){'
    + 'if(uMode>1.5){vec2 d=vW.xz-uG.xy;float r=length(d)/uG.z;float a=(1.0-smoothstep(0.55,1.0,r));'
    + 'vec2 g=abs(fract(vW.xz/0.25)-0.5);float ln=1.0-smoothstep(0.0,uG.w,min(g.x,g.y));'
    + 'vec3 c=mix(vec3(0.925,0.905,0.972),vec3(0.84,0.80,0.93),ln*0.55);gl_FragColor=vec4(c*a*0.9,a*0.9);return;}'
    + 'if(uMode>0.5){gl_FragColor=uFlat;return;}'
    + 'vec3 col=uBase;'
    + 'for(int i=0;i<16;i++){if(i>=uZn)break;vec4 a=uZa[i];float dt=mod(vU.x-a.x+3.14159265,6.2831853)-3.14159265;'
    + 'float x=dt*a.z;float y=(vU.y-a.y)*a.w;float x2=x*x;float y2=y*y;float d=mix(x2+y2,sqrt(x2*x2+y2*y2),uZs[i]);'
    + 'float m=1.0-smoothstep(0.78,1.0,d);col=mix(col,uZc[i].rgb,m*uZc[i].a);}'
    + 'vec3 n=normalize(vN);vec3 v=normalize(uCam-vW);float nl=dot(n,uL)*0.5+0.5;float hemi=n.y*0.5+0.5;'
    + 'float rim=pow(1.0-max(dot(n,v),0.0),2.2);'
    + 'vec3 c=col*(0.60+0.36*nl*nl+0.09*hemi);c=mix(c,col*0.62,rim*0.5);'
    + 'c+=vec3(pow(max(dot(n,normalize(uL+v)),0.0),30.0)*0.07);gl_FragColor=vec4(c,1.0);}';

  let GL = null;   // { canvas, gl, prog, loc, size }
  function initGL() {
    if (GL) return GL.ok ? GL : null;
    GL = { ok: false };
    try {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
      const gl = canvas.getContext('webgl', { alpha: true, antialias: true, stencil: true, depth: true, premultipliedAlpha: true });
      if (!gl) return null;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.bindAttribLocation(prog, 0, 'aP'); gl.bindAttribLocation(prog, 1, 'aN'); gl.bindAttribLocation(prog, 2, 'aU');
      gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      const loc = {}; ['uVP', 'uM', 'uOut', 'uSh', 'uBase', 'uCam', 'uL', 'uMode', 'uFlat', 'uG', 'uZn', 'uZa', 'uZc', 'uZs'].forEach((n) => { loc[n] = gl.getUniformLocation(prog, n); });
      buildMeshes();
      for (const m of Object.values(M)) {
        m.vp = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.vp); gl.bufferData(gl.ARRAY_BUFFER, m.pos, m.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
        m.vn = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.vn); gl.bufferData(gl.ARRAY_BUFFER, m.nrm, m.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
        m.vu = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.vu); gl.bufferData(gl.ARRAY_BUFFER, m.uv, gl.STATIC_DRAW);
        m.vi = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.vi); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
      }
      // Tronc : moitié basse (bassin, taille) et moitié haute (thorax), chacune avec ses zones.
      const cut = Math.floor(M.torso.R * 0.5) * M.torso.segs * 6;
      M.torso.ranges = [[0, cut], [cut, M.torso.idx.length - cut]];
      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); GL = null; });
      Object.assign(GL, { ok: true, canvas, gl, prog, loc });
      return GL;
    } catch (e) { if (window.console) console.warn('WL3D', e); return null; }
  }
  function bindMesh(gl, m) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vp); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vn); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vu); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.vi);
  }
  /* Liste des pièces à dessiner pour une pose résolue. */
  function partsOf(ex, s) {
    const z = zonesOf(ex); const parts = []; const { F, limbs } = s;
    const fm = (f, off) => { const b = qBasis(f.q); return mFrame(off ? toW(f, off) : f.o, b[0], b[1], b[2]); };
    parts.push({ mesh: M.torso, model: IDENT, base: COL.body, zones: z.torsoLow, range: 0 }, { mesh: M.torso, model: IDENT, base: COL.body, zones: z.torsoUp, range: 1 });
    parts.push({ mesh: M.neck, model: fm(F.N), base: COL.body, zones: z.neckL }, { mesh: M.head, model: fm(F.H), base: COL.skin, zones: z.head });
    for (const id of LIMBS) {
      const f = limbs[id]; const arm = id[0] === 'a'; const sfx = id[1];
      parts.push({ mesh: arm ? M.upper : M.thigh, model: mFrame(f.root, f.x1, f.y1, f.z1), base: COL.body, zones: z[(arm ? 'upper' : 'thigh') + sfx] });
      parts.push({ mesh: arm ? M.fore : M.shin, model: mFrame(f.mid, f.x2, f.y2, f.z2), base: COL.body, zones: z[(arm ? 'fore' : 'shin') + sfx] });
      const jr = arm ? 0.039 : 0.055;
      parts.push({ mesh: M.ball, model: mFrame(f.mid, f.x2, f.y2, f.z2, [jr, jr, jr]), base: COL.body, zones: z.none });
      if (arm) parts.push({ mesh: f.grip ? M.fist : (sfx === 'L' ? M.handL : M.handR), model: mFrame(f.end, f.ex, f.ey, f.ez), base: COL.skin, zones: z.none });
      else {
        parts.push({ mesh: M.ball, model: mFrame(f.end, f.x2, f.y2, f.z2, [0.035, 0.035, 0.038]), base: COL.body, zones: z.none });
        parts.push({ mesh: M.foot, model: mFrame(f.end, f.ex, f.ey, f.ez), base: COL.skin, zones: z.none });
      }
    }
    for (const p of propParts(ex.props, s.J)) { p.zones = z.none; p.prop = true; parts.push(p); }
    return parts;
  }
  function drawScene(ex, time, cam, w, h, thick) {
    const g = GL; const gl = g.gl; const L = g.loc;
    const [ka, kb, t] = timeline(ex, time);
    const s = solve(ka, kb, t);
    skinTorso(M.torso, s.F);
    gl.bindBuffer(gl.ARRAY_BUFFER, M.torso.vp); gl.bufferSubData(gl.ARRAY_BUFFER, 0, M.torso.pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, M.torso.vn); gl.bufferSubData(gl.ARRAY_BUFFER, 0, M.torso.nrm);
    const parts = partsOf(ex, s);
    const fit = fitOf(ex);
    const fov = 26 * D2R; const asp = w / h;
    const dist = fit.rad / Math.sin(Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * asp)) / 2) * 1.0;
    const cy = Math.cos(cam.pitch), sy = Math.sin(cam.pitch);
    const eye = add(fit.c, [Math.sin(cam.yaw) * cy * dist, sy * dist, Math.cos(cam.yaw) * cy * dist]);
    const view = mLook(eye, fit.c, [0, 1, 0]);
    const vp = mMul(mPersp(fov, asp, Math.max(0.05, dist - fit.rad * 2.2), dist + fit.rad * 3), view);
    const right = [view[0], view[4], view[8]], up = [view[1], view[5], view[9]], back = [view[2], view[6], view[10]];
    const light = norm(add(add(mul(right, -0.5), mul(up, 0.72)), mul(back, 0.62)));

    gl.viewport(0, 0, w, h); gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clearStencil(0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.useProgram(g.prog); gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2);
    gl.uniformMatrix4fv(L.uVP, false, vp); gl.uniform3fv(L.uCam, eye); gl.uniform3fv(L.uL, light);
    gl.uniform1f(L.uOut, 0); gl.uniform4f(L.uSh, 0, 1, 0, 0); gl.uniform1i(L.uZn, 0);

    // sol
    gl.disable(gl.CULL_FACE); gl.depthMask(false); gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const gr = fit.rad * 1.5;
    gl.uniform1f(L.uMode, 2); gl.uniform4f(L.uG, fit.c[0], fit.c[2], gr, 0.035);
    gl.uniformMatrix4fv(L.uM, false, mFrame([fit.c[0], 0, fit.c[2]], [1, 0, 0], [0, 1, 0], [0, 0, 1], [gr, 1, gr]));
    bindMesh(gl, M.ground); gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    // ombres portées au sol (une seule couche grâce au pochoir)
    gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.EQUAL, 0, 255); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
    gl.uniform1f(L.uMode, 1); gl.uniform4f(L.uFlat, 0.29 * 0.17, 0.24 * 0.17, 0.43 * 0.17, 0.17); gl.uniform4f(L.uSh, 0.32, 1, 0.22, 1);
    for (const p of parts) drawPart(gl, L, p, true);
    gl.disable(gl.STENCIL_TEST); gl.uniform4f(L.uSh, 0, 1, 0, 0); gl.disable(gl.BLEND);
    // corps
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.uniform1f(L.uMode, 0);
    for (const p of parts) drawPart(gl, L, p, false);
    // contour
    gl.cullFace(gl.FRONT); gl.uniform1f(L.uMode, 1); gl.uniform4f(L.uFlat, COL.ink[0], COL.ink[1], COL.ink[2], 1); gl.uniform1f(L.uOut, dist * thick);
    for (const p of parts) drawPart(gl, L, p, true);
    gl.uniform1f(L.uOut, 0); gl.cullFace(gl.BACK); gl.disable(gl.SCISSOR_TEST);
    return s;
  }
  function drawPart(gl, L, p, flat) {
    bindMesh(gl, p.mesh);
    gl.uniformMatrix4fv(L.uM, false, p.model);
    if (!flat) {
      gl.uniform3fv(L.uBase, p.base);
      const z = p.zones; gl.uniform1i(L.uZn, z.n);
      if (z.n) { gl.uniform4fv(L.uZa, z.pa); gl.uniform4fv(L.uZc, z.pc); gl.uniform1fv(L.uZs, z.ps); }
    }
    if (p.range != null) { const r = p.mesh.ranges[p.range]; gl.drawElements(gl.TRIANGLES, r[1], gl.UNSIGNED_SHORT, r[0] * 2); }
    else gl.drawElements(gl.TRIANGLES, p.mesh.idx.length, gl.UNSIGNED_SHORT, 0);
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
    drawScene(v.ex, time, v.cam, w, h, c.clientWidth < 200 ? 0.0030 : 0.0016);
    const ctx = v.ctx; ctx.clearRect(0, 0, w, h);
    ctx.drawImage(GL.canvas, 0, GL.canvas.height - h, w, h, 0, 0, w, h);
  }
  function loop(now) {
    raf = 0;
    if (!initGL()) { views.clear(); return; }
    let alive = false;
    for (const v of [...views]) {
      if (!v.canvas.isConnected) { if (v.seen || now - v.born > 4000) { views.delete(v); continue; } alive = true; continue; }
      v.seen = true;
      if (!v.on) continue;
      alive = true;
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
    const ex = EX.get(id); if (!ex || !initGL()) return null;
    opts = opts || {};
    const canvas = document.createElement('canvas');
    canvas.className = 'm3d' + (opts.thumb ? ' m3d-thumb' : '') + (opts.cls ? ' ' + opts.cls : '');
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', (opts.thumb ? 'Animation : ' : 'Animation en 3D, à faire tourner au doigt : ') + ex.name);
    const c0 = ex.cam || {};
    const v = { canvas, ctx: canvas.getContext('2d'), ex, thumb: !!opts.thumb, on: !opts.thumb, last: 0, seen: false, born: performance.now(), fixed: opts.time,
      cam: { yaw: (c0.yaw == null ? 60 : c0.yaw) * D2R, pitch: (c0.pitch == null ? 14 : c0.pitch) * D2R } };
    canvas._play = (on) => { v.on = !!on; if (on) kick(); };
    canvas._view = v;
    if (!opts.thumb) {
      let drag = null;
      canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ignoré */ } canvas.classList.add('drag'); });
      canvas.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        v.cam.yaw -= (e.clientX - drag.x) * 0.011; v.cam.pitch = clamp(v.cam.pitch + (e.clientY - drag.y) * 0.009, -0.12, 1.45);
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
    list: () => [...EX.values()].map((e) => ({ id: e.id, name: e.name, leaf: e.leaf, p: e.p, s: e.s || [], side: !!e.side, dup: e.dup || [] })),
    _dbg: { solve, EX, timeline, fitOf, B },
  };
})();
