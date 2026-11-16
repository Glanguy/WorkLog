'use strict';
/* =====================================================================
   WorkLog : exercices « maison » en 3D (étirements et mobilité).
   Chaque exercice : son nom, sa catégorie dans la bibliothèque, les muscles
   (p : principal, s : secondaires), les zones colorées sur le mannequin
   (mus : 1 = principal, 2 = secondaire), ses positions et leur enchaînement.
   Repère : le personnage debout regarde vers +Z, sa gauche est +X, le haut est +Y (mètres).
   Membres : lL / lR (jambes gauche, droite), aL / aR (bras).
     at  : cheville ou poignet posé à cet endroit      atb : idem, par rapport au bassin (jambe) ou au thorax (bras)
     on  : ['articulation', [décalage]]                d, e : directions du 1er et du 2e segment (db, eb : par rapport au corps)
     p, pb : côté vers lequel pointe le genou ou le coude
   ===================================================================== */
(function () {
  const sup = [-95, 0, 0];            // allongé sur le dos, tête vers -Z
  const KN = (s, o) => Object.assign({ d: [s * 0.02, -1, 0], e: [0, -0.04, -1], foot: 76 }, o);          // jambe à genou, tibia au sol
  const HEEL = { toe: [0, 1, 0.16], up: [0, 0.16, -1] };                                                // jambe tendue au sol, orteils en l'air
  const sitHeels = (s) => ({ d: [s * 0.05, -0.5, 0.87], e: [0, -0.03, -1], foot: 80 });                // assis sur les talons
  const m2 = (k, v) => ({ [k + 'L']: v, [k + 'R']: v });
  const mus = (...parts) => Object.assign({}, ...parts);
  const hang = (s) => ({ db: [s * 0.08, -1, 0.04], eb: [s * 0.04, -1, 0.12] });

  WL3D.define([
    /* ------------------------- Étirements : bas du corps ------------------------- */
    { id: 'wl01', name: 'Quadriceps assis', leaf: 'quadriceps', p: 'quadriceps', s: ['hip flexors'], side: true,
      mus: { quadR: 1, hipfR: 2 }, cam: { yaw: -48, pitch: 20 },
      poses: {
        a: { pelvis: [0, 0.12, 0], rot: [-4, 0, 0], spine: [8, 0, 0],
          lL: { d: [0.22, -0.04, 1], foot: HEEL }, lR: { d: [-0.42, -0.14, 1], e: [-0.2, -0.02, -1], foot: 60 },
          aL: { at: [0.33, 0.03, 0.02], hdir: [0.3, 0, 1], p: [0.3, 0.2, -1] }, aR: { at: [-0.36, 0.03, 0.22], hdir: [-0.3, 0, 1], p: [-0.5, 0.2, -1] } },
        b: { pelvis: [0, 0.12, 0], rot: [-36, 0, 0], spine: [-4, 0, 0], neck: [18, 0, 0],
          lL: { d: [0.22, -0.04, 1], foot: HEEL }, lR: { d: [-0.42, -0.14, 1], e: [-0.2, -0.02, -1], foot: 60 },
          aL: { at: [0.26, 0.03, -0.50], hdir: [0.5, 0, -1], p: [0.2, 0.3, -1] }, aR: { at: [-0.26, 0.03, -0.50], hdir: [-0.5, 0, -1], p: [-0.2, 0.3, -1] } },
      },
      seq: [['a', 0.7, 1.4], ['b', 2.2, 1.4]] },

    { id: 'wl02', name: 'Ischio unilat assis', leaf: 'fessiers-ischios', p: 'hamstrings', s: ['calves', 'glutes'], side: true,
      mus: { hamL: 1, calfL: 2, gluteL: 2 }, cam: { yaw: 68, pitch: 12 },
      poses: {
        a: { pelvis: [0, 0.46, 0], lR: KN(-1), lL: { at: [0.11, 0.07, 0.44], foot: 'flat' },
          aL: { on: ['hipL', [0.10, 0.08, 0.04]], pb: [1, 0, -0.6] }, aR: { on: ['hipR', [-0.10, 0.08, 0.04]], pb: [-1, 0, -0.6] } },
        b: { pelvis: [0, 0.27, -0.33], rot: [38, 0, 0], spine: [26, 0, 0], neck: [-12, 0, 0],
          lR: { d: [-0.02, -0.245, 0.34], e: [0, -0.03, -1], foot: 80 }, lL: { at: [0.11, 0.075, 0.46], foot: HEEL },
          aL: { at: [0.30, 0.03, 0.24], p: [1, 0.3, -0.5] }, aR: { at: [-0.10, 0.03, 0.24], p: [-1, 0.3, -0.5] } },
      },
      seq: [['a', 0.7, 1.5], ['b', 2.2, 1.5]] },

    { id: 'wl03', name: 'Piriforme', leaf: 'fessiers-ischios', p: 'glutes', s: ['abductors'], side: true,
      mus: { pirR: 1, gluteR: 1 }, cam: { yaw: -35, pitch: 14 },
      poses: {
        a: { pelvis: [0, 0.1, 0], rot: sup,
          lL: { at: [0.10, 0.07, 0.43], p: [0, 1, 0.3] }, lR: { on: ['kneeL', [0, 0.085, -0.07]], p: [-1, 0.25, 0.3], foot: 5 },
          aL: { at: [0.36, 0.035, -0.22], hdir: [0, 0, 1], p: [1, 0.3, 0] }, aR: { at: [-0.36, 0.035, -0.22], hdir: [0, 0, 1], p: [-1, 0.3, 0] } },
        b: { pelvis: [0, 0.1, 0], rot: [-100, 0, 0], neck: [10, 0, 0],
          lL: { d: [0, 0.82, -0.57], e: [0, 0.12, 1], foot: 10 }, lR: { on: ['kneeL', [0.02, -0.02, 0.125]], p: [-1, 0.15, 0.3], foot: 5 },
          aL: { on: ['kneeL', [0.05, -0.06, -0.10]], p: [1, -0.2, 0], grip: true }, aR: { on: ['kneeL', [-0.03, -0.07, -0.10]], p: [-0.6, -0.5, 0.3], grip: true } },
      },
      seq: [['a', 0.7, 1.4], ['b', 2.2, 1.4]] },

    { id: 'wl04', name: 'Piriforme avec torsion', leaf: 'fessiers-ischios', p: 'glutes', s: ['lower back', 'obliques'], side: true,
      mus: { pirR: 1, gluteR: 1, lowR: 2, oblR: 2 }, cam: { yaw: -70, pitch: 28 },
      poses: {
        a: { pelvis: [0, 0.1, 0], rot: sup,
          lL: { at: [0.10, 0.07, 0.43], p: [0, 1, 0.3] }, lR: { on: ['kneeL', [0, 0.085, -0.07]], p: [-1, 0.25, 0.3], foot: 5 },
          aL: { at: [0.66, 0.035, -0.50], hdir: [1, 0, 0], p: [0, 0.3, 1] }, aR: { at: [-0.66, 0.035, -0.50], hdir: [-1, 0, 0], p: [0, 0.3, 1] } },
        b: { pelvis: [0.04, 0.1, 0], rot: [-95, 0, 0, 58], lumbar: [0, 0, -26], chest: [0, 0, -30],
          lL: { d: [0.80, -0.16, 0.56], e: [-0.45, 0.02, 0.9], foot: 20 }, lR: { on: ['kneeL', [0.0, 0.10, 0.03]], p: [0.2, 1, 0.1], foot: 5 },
          aL: { at: [0.66, 0.035, -0.50], hdir: [1, 0, 0], p: [0, 0.3, 1] }, aR: { at: [-0.66, 0.035, -0.50], hdir: [-1, 0, 0], p: [0, 0.3, 1] } },
      },
      seq: [['a', 0.9, 1.6], ['b', 2.2, 1.6]] },

    { id: 'wl05', name: 'Psoas fente + inclinaison', leaf: 'quadriceps', p: 'hip flexors', s: ['quadriceps', 'obliques', 'lats'], side: true,
      mus: { hipfL: 1, quadL: 2, oblL: 2, latL: 2 }, cam: { yaw: 28, pitch: 10 },
      poses: {
        a: { pelvis: [0, 0.46, 0], lL: KN(1), lR: { at: [-0.11, 0.07, 0.58], foot: 'flat' },
          aL: { atb: [0.03, 0.72, 0.04], pb: [1, 0.1, -0.2], grip: true }, aR: { atb: [-0.03, 0.72, 0.04], pb: [-1, 0.1, -0.2], grip: true } },
        b: { pelvis: [0, 0.40, 0.22], rot: [-6, 0, 0], lumbar: [-6, -17, 0], chest: [0, -20, 0], neck: [0, -8, 0],
          lL: { d: [0.02, -0.365, -0.22], e: [0, -0.04, -1], foot: 76 }, lR: { at: [-0.11, 0.07, 0.58], foot: 'flat' },
          aL: { atb: [0.03, 0.72, 0.04], pb: [1, 0.1, -0.2], grip: true }, aR: { atb: [-0.03, 0.72, 0.04], pb: [-1, 0.1, -0.2], grip: true } },
      },
      seq: [['a', 0.7, 1.5], ['b', 2.2, 1.5]] },

    { id: 'wl06', name: 'Adducteurs ventral', leaf: 'abducteurs', p: 'adductors', s: [],
      mus: m2('add', 1), cam: { yaw: 165, pitch: 16 },
      poses: {
        a: { pelvis: [0, 0.36, 0], rot: [78, 0, 0],
          lL: { d: [0.62, -0.76, 0.1], e: [0, -0.04, -1], foot: 30 }, lR: { d: [-0.62, -0.76, 0.1], e: [0, -0.04, -1], foot: 30 },
          aL: { at: [0.20, 0.03, 0.50], p: [0.3, 0, -1] }, aR: { at: [-0.20, 0.03, 0.50], p: [-0.3, 0, -1] } },
        b: { pelvis: [0, 0.12, -0.06], rot: [72, 0, 0], lumbar: [-6, 0, 0], neck: [-8, 0, 0],
          lL: { d: [0.92, -0.2, 0.22], e: [0, -0.02, -1], foot: 30 }, lR: { d: [-0.92, -0.2, 0.22], e: [0, -0.02, -1], foot: 30 },
          aL: { at: [0.17, 0.035, 0.62], p: [0.5, -1, -0.4] }, aR: { at: [-0.17, 0.035, 0.62], p: [-0.5, -1, -0.4] } },
      },
      seq: [['a', 0.7, 1.5], ['b', 2.2, 1.5]] },

    { id: 'wl07', name: 'TFL assis', leaf: 'abducteurs', p: 'abductors', s: ['glutes'], side: true,
      mus: { tflR: 1, gluteR: 2 }, cam: { yaw: -40, pitch: 22 },
      poses: {
        a: { pelvis: [0, 0.12, 0], rot: [-26, 0, 0], neck: [14, 0, 0],
          lL: { d: [0.18, -0.04, 1], foot: HEEL }, lR: { at: [-0.34, 0.07, 0.42], p: [-0.2, 1, 0.3], foot: 'flat', toe: [-0.25, 0, 1] },
          aL: { at: [0.25, 0.03, -0.42], hdir: [0.5, 0, -1], p: [0.2, 0.3, -1] }, aR: { at: [-0.25, 0.03, -0.42], hdir: [-0.5, 0, -1], p: [-0.2, 0.3, -1] } },
        b: { pelvis: [0, 0.12, 0], rot: [-26, 0, 0], lumbar: [0, 0, -10], neck: [14, 0, 0],
          lL: { d: [0.18, -0.04, 1], foot: HEEL }, lR: { at: [-0.34, 0.075, 0.42], p: [1, 0.12, 0.35], foot: { toe: [-0.3, 0, 1], up: [0.75, 0.66, 0] } },
          aL: { at: [0.25, 0.03, -0.42], hdir: [0.5, 0, -1], p: [0.2, 0.3, -1] }, aR: { at: [-0.25, 0.03, -0.42], hdir: [-0.5, 0, -1], p: [-0.2, 0.3, -1] } },
      },
      seq: [['a', 0.7, 1.4], ['b', 2.2, 1.4]] },

    { id: 'wl08', name: 'Mollet unilatéral', leaf: 'mollets', p: 'calves', s: [], side: true,
      mus: { calfR: 1 }, cam: { yaw: -115, pitch: 8 },
      props: [{ type: 'dumbbell', pos: [0.04, 0, 0.31], r: 0.046 }],
      poses: {
        a: { pelvis: [0, 0.88, -0.04], lL: { at: [0.11, 0.07, -0.10], foot: 'flat' },
          lR: { at: [-0.11, 0.088, 0.17], foot: { toe: [0, 0.5, 0.87], up: [0, 0.87, -0.5] } }, aL: hang(1), aR: hang(-1) },
        b: { pelvis: [0, 0.875, 0.13], rot: [7, 0, 0], lL: { at: [0.11, 0.07, -0.10], foot: 'flat' },
          lR: { at: [-0.11, 0.088, 0.17], foot: { toe: [0, 0.5, 0.87], up: [0, 0.87, -0.5] } }, aL: hang(1), aR: hang(-1) },
      },
      seq: [['a', 0.7, 1.3], ['b', 2.2, 1.3]] },

    /* ------------------------- Étirements : haut du corps ------------------------- */
    { id: 'wl09', name: 'Rotateurs épaule', leaf: 'epaules', p: 'shoulders', s: [], side: true,
      mus: { cuffR: 1, deltPR: 2, deltAR: 2 }, cam: { yaw: -35, pitch: 10 },
      props: [{ type: 'stick', a: 'handR', b: 'handL', ext: [0.42, 0.30] }],
      poses: {
        a: { pelvis: [0, 0.46, 0], lR: KN(-1), lL: { at: [0.11, 0.07, 0.44], foot: 'flat' },
          aR: { atb: [-0.20, 0.36, 0.22], pb: [-0.5, -1, 0.2], grip: true }, aL: { atb: [-0.17, -0.10, 0.27], pb: [1, -0.4, -0.3], grip: true } },
        b: { pelvis: [0, 0.46, 0], lR: KN(-1), lL: { at: [0.11, 0.07, 0.44], foot: 'flat' }, neck: [6, 0, -14],
          aR: { db: [-0.88, 0.02, 0.48], eb: [0.72, 0.52, -0.42], grip: true }, aL: { atb: [0.13, -0.06, 0.29], pb: [1, -0.4, -0.3], grip: true } },
      },
      seq: [['a', 0.7, 1.4], ['b', 2.2, 1.4]] },

    { id: 'wl10', name: 'Deltoïde post 4 pattes', leaf: 'epaules', p: 'shoulders', s: ['middle back', 'traps'], side: true,
      mus: { deltPR: 1, midR: 2, trapR: 2 }, cam: { yaw: 215, pitch: 22 },
      poses: {
        a: { pelvis: [0, 0.46, 0], rot: [79, 0, 0], neck: [-12, 0, 0], lL: KN(1), lR: KN(-1),
          aL: { at: [0.20, 0.03, 0.50], p: [0.3, 0, -1] }, aR: { at: [-0.20, 0.03, 0.50], p: [-0.3, 0, -1] } },
        b: { pelvis: [0, 0.46, -0.03], rot: [112, 0, 0], lumbar: [6, 0, 14], chest: [8, 0, 34], neck: [0, 0, 30],
          lL: KN(1, { d: [0.02, -1, 0.07] }), lR: KN(-1, { d: [-0.02, -1, 0.07] }),
          aL: { at: [0.26, 0.03, 0.66], p: [1, 0.6, -0.2] }, aR: { at: [0.42, 0.04, 0.40], p: [0, 0, -1], hand: { d: [1, 0, 0], n: [0, 1, 0] } } },
      },
      seq: [['a', 0.7, 1.5], ['b', 2.2, 1.5]] },

    { id: 'wl11', name: 'Pec élastique', leaf: 'pectoraux', p: 'chest', s: ['shoulders', 'biceps'], side: true,
      mus: { pecR: 1, deltAR: 2, bicepsR: 2 }, cam: { yaw: -22, pitch: 10 },
      props: [{ type: 'post', a: [-1.0, 0, -0.95], b: [-1.0, 1.95, -0.95] }, { type: 'band', a: [-1.0, 1.88, -0.95], b: 'handR' }],
      poses: {
        a: { pelvis: [0, 0.46, 0], lR: KN(-1), lL: { at: [0.11, 0.07, 0.44], foot: 'flat' },
          aR: { db: [-1, 0.06, -0.05], pb: [0, -0.3, -1], pron: 0, grip: true }, aL: { on: ['hipL', [0.10, 0.08, 0.04]], pb: [1, 0, -0.6] } },
        b: { pelvis: [0, 0.44, 0.10], rot: [4, 14, 0], chest: [-4, 0, 16], neck: [0, 0, 14],
          lR: KN(-1, { d: [-0.02, -1, -0.24] }), lL: { at: [0.11, 0.07, 0.44], foot: 'flat' },
          aR: { db: [-0.80, 0.10, -0.60], pb: [0, -0.3, -1], pron: 0, grip: true }, aL: { on: ['hipL', [0.10, 0.08, 0.04]], pb: [1, 0, -0.6] } },
      },
      seq: [['a', 0.7, 1.4], ['b', 2.2, 1.4]] },

    { id: 'wl12', name: 'Grand dorsal caisse', leaf: 'dos', p: 'lats', s: ['triceps', 'shoulders'],
      mus: mus(m2('lat', 1), m2('triceps', 2), m2('deltP', 2)), cam: { yaw: 75, pitch: 12 },
      props: [{ type: 'box', pos: [0, 0, 1.02], size: [0.55, 0.5, 0.4] }],
      poses: {
        a: { pelvis: [0, 0.46, 0], rot: [50, 0, 0], neck: [-10, 0, 0], lL: KN(1), lR: KN(-1),
          aL: { at: [0.13, 0.535, 0.88], hand: 'flat', hdir: [0, 0, 1], p: [0.4, -1, -0.3] }, aR: { at: [-0.13, 0.535, 0.88], hand: 'flat', hdir: [0, 0, 1], p: [-0.4, -1, -0.3] } },
        b: { pelvis: [0, 0.44, -0.12], rot: [96, 0, 0], lumbar: [-10, 0, 0], chest: [-16, 0, 0], neck: [14, 0, 0],
          lL: KN(1, { d: [0.02, -1, 0.28] }), lR: KN(-1, { d: [-0.02, -1, 0.28] }),
          aL: { at: [0.13, 0.535, 0.88], hand: 'flat', hdir: [0, 0, 1], p: [0.4, -1, -0.3] }, aR: { at: [-0.13, 0.535, 0.88], hand: 'flat', hdir: [0, 0, 1], p: [-0.4, -1, -0.3] } },
      },
      seq: [['a', 0.7, 1.5], ['b', 2.2, 1.5]] },

    { id: 'wl13', name: 'Trapèzes', leaf: 'dos', p: 'traps', s: ['neck'], side: true,
      mus: { trapR: 1 }, cam: { yaw: 198, pitch: 12 },
      poses: {
        a: { pelvis: [0, 0.24, 0], lL: sitHeels(1), lR: sitHeels(-1),
          aL: { atb: [0.03, -0.26, -0.17], pb: [1, 0, -0.5], grip: true }, aR: { atb: [-0.02, -0.28, -0.16], pb: [-1, 0, -0.5] } },
        b: { pelvis: [0, 0.24, 0], lL: sitHeels(1), lR: sitHeels(-1), neck: [8, 22, 0], head: [4, 16, 0],
          aL: { atb: [0.07, -0.27, -0.17], pb: [1, 0, -0.5], grip: true }, aR: { atb: [0.03, -0.31, -0.16], pb: [-1, 0, -0.5], sh: [0, -0.025, 0] } },
      },
      seq: [['a', 0.7, 1.3], ['b', 2.2, 1.3]] },

    { id: 'wl14', name: 'Phoque', leaf: 'abdos', p: 'abdominals', s: ['hip flexors'],
      mus: mus({ abs: 1 }, m2('hipf', 2), m2('obl', 2)), cam: { yaw: 62, pitch: 12 },
      poses: {
        a: { pelvis: [0, 0.1, 0], rot: [92, 0, 0], neck: [-18, 0, 0],
          lL: { d: [0.03, -0.02, -1], foot: 80 }, lR: { d: [-0.03, -0.02, -1], foot: 80 },
          aL: { at: [0.23, 0.03, 0.47], p: [0.5, 1, -0.6] }, aR: { at: [-0.23, 0.03, 0.47], p: [-0.5, 1, -0.6] } },
        b: { pelvis: [0, 0.1, 0], rot: [74, 0, 0], lumbar: [-36, 0, 0], chest: [-30, 0, 0], neck: [-6, 0, 0],
          lL: { d: [0.03, -0.02, -1], foot: 80 }, lR: { d: [-0.03, -0.02, -1], foot: 80 },
          aL: { at: [0.23, 0.03, 0.47], p: [0.3, 0.2, -1] }, aR: { at: [-0.23, 0.03, 0.47], p: [-0.3, 0.2, -1] } },
      },
      seq: [['a', 0.7, 1.5], ['b', 2.2, 1.5]] },

    { id: 'wl15', name: 'Prière', leaf: 'dos', p: 'lats', s: ['lower back', 'shoulders'], dup: ['Childs_Pose'],
      mus: mus(m2('lat', 1), m2('low', 2), m2('deltP', 2)), cam: { yaw: 64, pitch: 14 },
      poses: {
        a: { pelvis: [0, 0.46, 0], rot: [79, 0, 0], neck: [-12, 0, 0], lL: KN(1), lR: KN(-1),
          aL: { at: [0.20, 0.03, 0.62], p: [0.3, 0, -1] }, aR: { at: [-0.20, 0.03, 0.62], p: [-0.3, 0, -1] } },
        b: { pelvis: [0, 0.22, -0.37], rot: [70, 0, 0], lumbar: [15, 0, 0], chest: [12, 0, 0], neck: [6, 0, 0],
          lL: { d: [0.03, -0.19, 0.38], e: [0, -0.03, -1], foot: 80 }, lR: { d: [-0.03, -0.19, 0.38], e: [0, -0.03, -1], foot: 80 },
          aL: { at: [0.17, 0.03, 0.62], p: [0.3, 1, 0] }, aR: { at: [-0.17, 0.03, 0.62], p: [-0.3, 1, 0] } },
      },
      seq: [['a', 0.7, 1.5], ['b', 2.2, 1.5]] },

    { id: 'wl16', name: 'Prière latérale', leaf: 'dos', p: 'lats', s: ['obliques', 'lower back'], side: true,
      mus: { latR: 1, oblR: 2, lowR: 2 }, cam: { yaw: -30, pitch: 32 },
      poses: {
        a: { pelvis: [0, 0.22, -0.37], rot: [70, 0, 0], lumbar: [15, 0, 0], chest: [12, 0, 0], neck: [6, 0, 0],
          lL: { d: [0.03, -0.19, 0.38], e: [0, -0.03, -1], foot: 80 }, lR: { d: [-0.03, -0.19, 0.38], e: [0, -0.03, -1], foot: 80 },
          aL: { at: [0.17, 0.03, 0.62], p: [0.3, 1, 0] }, aR: { at: [-0.17, 0.03, 0.62], p: [-0.3, 1, 0] } },
        b: { pelvis: [0, 0.22, -0.37], rot: [70, 0, 0], lumbar: [15, 14, 0], chest: [12, 18, 0], neck: [6, 0, 0],
          lL: { d: [0.03, -0.19, 0.38], e: [0, -0.03, -1], foot: 80 }, lR: { d: [-0.03, -0.19, 0.38], e: [0, -0.03, -1], foot: 80 },
          aL: { at: [0.52, 0.03, 0.42], hdir: [0.5, 0, 1], p: [0.3, 1, 0] }, aR: { at: [0.36, 0.03, 0.56], hdir: [0.5, 0, 1], p: [-0.3, 1, 0] } },
      },
      seq: [['a', 0.7, 1.5], ['b', 2.2, 1.5]] },

    /* ------------------------- Mobilité : bas du corps ------------------------- */
    { id: 'wl17', name: 'Cheville dynamique en fente', leaf: 'mollets', p: 'calves', s: [], side: true,
      mus: { calfR: 1 }, cam: { yaw: -112, pitch: 9 },
      poses: {
        a: { pelvis: [0, 0.46, 0], rot: [6, 0, 0], lL: KN(1), lR: { at: [-0.11, 0.07, 0.40], foot: 'flat' },
          aL: { on: ['kneeR', [0.04, 0.075, 0]], p: [1, 0, -0.5] }, aR: { on: ['kneeR', [-0.04, 0.075, 0]], p: [-1, 0, -0.5] } },
        b: { pelvis: [0, 0.43, 0.17], rot: [20, 0, 0], neck: [-12, 0, 0],
          lL: KN(1, { d: [0.02, -0.395, -0.16] }), lR: { at: [-0.11, 0.07, 0.40], foot: 'flat' },
          aL: { on: ['kneeR', [0.04, 0.075, 0]], p: [1, 0, -0.5] }, aR: { on: ['kneeR', [-0.04, 0.075, 0]], p: [-1, 0, -0.5] } },
      },
      seq: [['a', 0.35, 1.0], ['b', 0.5, 1.0]] },

    { id: 'wl18', name: 'Ischios allongé', leaf: 'fessiers-ischios', p: 'hamstrings', s: ['calves'], side: true,
      mus: { hamR: 1, calfR: 2 }, cam: { yaw: -62, pitch: 15 },
      poses: {
        a: { pelvis: [0, 0.1, 0], rot: sup, lL: { at: [0.10, 0.078, 0.84], foot: HEEL },
          lR: { d: [0, 0.97, -0.24], e: [0, -0.2, 1], foot: 10 },
          aL: { on: ['kneeR', [0.05, -0.12, -0.09]], p: [1, -0.3, 0], grip: true }, aR: { on: ['kneeR', [-0.04, -0.12, -0.09]], p: [-1, -0.3, 0], grip: true } },
        b: { pelvis: [0, 0.1, 0], rot: sup, lL: { at: [0.10, 0.078, 0.84], foot: HEEL },
          lR: { d: [0, 0.97, -0.24], e: [0, 1, 0.10], p: [0, 0.2, -1], foot: -8 },
          aL: { on: ['kneeR', [0.05, -0.12, -0.09]], p: [1, -0.3, 0], grip: true }, aR: { on: ['kneeR', [-0.04, -0.12, -0.09]], p: [-1, -0.3, 0], grip: true } },
      },
      seq: [['a', 0.35, 1.1], ['b', 0.6, 1.1]] },

    { id: 'wl19', name: 'Foulée au sol', leaf: 'fessiers-ischios', p: 'hamstrings', s: ['hip flexors', 'glutes'], side: true,
      mus: { hamR: 1, hipfR: 2, gluteR: 2 }, cam: { yaw: -62, pitch: 14 },
      poses: {
        a: { pelvis: [0, 0.1, 0], rot: sup, lL: { at: [0.10, 0.078, 0.84], foot: HEEL }, lR: { d: [-0.02, 0.22, 1], p: [0, 1, 0], foot: 0 },
          aL: { at: [0.44, 0.035, -0.20], hdir: [0.4, 0, 1], p: [1, 0.3, 0] }, aR: { at: [-0.44, 0.035, -0.20], hdir: [-0.4, 0, 1], p: [-1, 0.3, 0] } },
        b: { pelvis: [0, 0.1, 0], rot: sup, lL: { at: [0.10, 0.078, 0.84], foot: HEEL }, lR: { d: [-0.02, 0.95, 0.30], p: [0, 0.3, -1], foot: 0 },
          aL: { at: [0.44, 0.035, -0.20], hdir: [0.4, 0, 1], p: [1, 0.3, 0] }, aR: { at: [-0.44, 0.035, -0.20], hdir: [-0.4, 0, 1], p: [-1, 0.3, 0] } },
        c: { pelvis: [0, 0.1, 0], rot: sup, lL: { at: [0.10, 0.078, 0.84], foot: HEEL }, lR: { d: [-0.02, 0.80, 0.60], e: [0, -0.93, 0.36], foot: 20 },
          aL: { at: [0.44, 0.035, -0.20], hdir: [0.4, 0, 1], p: [1, 0.3, 0] }, aR: { at: [-0.44, 0.035, -0.20], hdir: [-0.4, 0, 1], p: [-1, 0.3, 0] } },
      },
      seq: [['a', 0.15, 0.9], ['b', 0.25, 0.8], ['c', 0.15, 0.8]] },

    { id: 'wl20', name: 'Hanche et adducteur unilat', leaf: 'abducteurs', p: 'adductors', s: ['hamstrings', 'glutes'], side: true,
      mus: { addL: 1, hamL: 2 }, cam: { yaw: 18, pitch: 14 },
      poses: {
        a: { pelvis: [0, 0.46, 0], lR: KN(-1), lL: { at: [0.82, 0.07, 0.04], p: [0.2, 0.6, 1], foot: 'flat', toe: [0.2, 0, 1] },
          aL: { on: ['hipL', [0.10, 0.08, 0.04]], pb: [1, 0, -0.6] }, aR: { on: ['hipR', [-0.10, 0.08, 0.04]], pb: [-1, 0, -0.6] } },
        b: { pelvis: [0, 0.34, -0.29], rot: [42, 0, 0], neck: [-18, 0, 0],
          lR: KN(-1, { d: [-0.02, -0.31, 0.29] }), lL: { at: [0.82, 0.07, 0.04], p: [0.2, 0.6, 1], foot: 'flat', toe: [0.2, 0, 1] },
          aL: { on: ['hipL', [0.10, 0.08, 0.04]], pb: [1, 0, -0.6] }, aR: { on: ['hipR', [-0.10, 0.08, 0.04]], pb: [-1, 0, -0.6] } },
      },
      seq: [['a', 0.35, 1.1], ['b', 0.6, 1.1]] },

    { id: 'wl21', name: 'Chaîne post position chien', leaf: 'fessiers-ischios', p: 'hamstrings', s: ['calves', 'lats', 'shoulders'],
      mus: mus(m2('ham', 1), m2('calf', 1), m2('lat', 2), m2('deltP', 2)), cam: { yaw: 72, pitch: 10 },
      poses: {
        a: { pelvis: [0, 0.46, 0], rot: [118, 0, 0], chest: [-14, 0, 0], neck: [6, 0, 0], lL: KN(1), lR: KN(-1),
          aL: { at: [0.19, 0.03, 0.93], p: [0.3, 1, 0] }, aR: { at: [-0.19, 0.03, 0.93], p: [-0.3, 1, 0] } },
        b: { pelvis: [0, 0.64, 0.10], rot: [128, 0, 0], chest: [-8, 0, 0], neck: [6, 0, 0],
          lL: { at: [0.11, 0.15, -0.36], p: [0, -0.2, 1], foot: { toe: [0, -0.55, 0.83], up: [0, 0.83, 0.55] } }, lR: { at: [-0.11, 0.15, -0.36], p: [0, -0.2, 1], foot: { toe: [0, -0.55, 0.83], up: [0, 0.83, 0.55] } },
          aL: { at: [0.19, 0.03, 0.93], p: [0.3, 1, 0] }, aR: { at: [-0.19, 0.03, 0.93], p: [-0.3, 1, 0] } },
        c: { pelvis: [0, 0.74, 0.158], rot: [133, 0, 0], chest: [-6, 0, 0], neck: [6, 0, 0],
          lL: { at: [0.11, 0.07, -0.36], p: [0, 0, 1], foot: 'flat', toe: [0, 0, 1] }, lR: { at: [-0.11, 0.07, -0.36], p: [0, 0, 1], foot: 'flat', toe: [0, 0, 1] },
          aL: { at: [0.19, 0.03, 0.93], p: [0.3, 1, 0] }, aR: { at: [-0.19, 0.03, 0.93], p: [-0.3, 1, 0] } },
      },
      seq: [['a', 0.6, 1.3], ['b', 0.5, 1.1], ['c', 1.2, 1.1], ['b', 0.3, 1.3]] },

    /* ------------------------- Mobilité : haut du corps ------------------------- */
    { id: 'wl22', name: 'T spine 4 pattes', leaf: 'dos', p: 'middle back', s: ['obliques', 'chest'], side: true,
      mus: mus(m2('mid', 1), m2('obl', 2), { pecR: 2 }), cam: { yaw: 40, pitch: 16 },
      poses: {
        a: { pelvis: [0, 0.46, 0], rot: [82, 0, 0], lumbar: [4, 0, 8], chest: [6, 0, 24], neck: [0, 0, 10], lL: KN(1), lR: KN(-1),
          aL: { at: [0.20, 0.03, 0.50], p: [0.3, 0, -1] }, aR: { atb: [-0.05, 0.445, -0.105], pb: [-1, 0.25, 0.25] } },
        b: { pelvis: [0, 0.46, 0], rot: [80, 0, 0], lumbar: [-2, 0, -14], chest: [-4, 0, -40], neck: [0, 0, -22], lL: KN(1), lR: KN(-1),
          aL: { at: [0.20, 0.03, 0.50], p: [0.3, 0, -1] }, aR: { atb: [-0.05, 0.445, -0.105], pb: [-1, 0.25, 0.0] } },
      },
      seq: [['a', 0.35, 1.2], ['b', 0.6, 1.2]] },

    { id: 'wl23', name: 'Grand dorsal/triceps avec barre', leaf: 'dos', p: 'lats', s: ['triceps', 'middle back'],
      mus: mus(m2('lat', 1), m2('triceps', 2), m2('mid', 2)), cam: { yaw: 66, pitch: 12 },
      props: [{ type: 'box', pos: [0, 0, 0.84], size: [0.55, 0.5, 0.4] }, { type: 'stick', a: 'handR', b: 'handL', ext: [0.28, 0.28] }],
      poses: {
        a: { pelvis: [0, 0.44, -0.10], rot: [84, 0, 0], neck: [-14, 0, 0], lL: KN(1, { d: [0.02, -1, 0.23] }), lR: KN(-1, { d: [-0.02, -1, 0.23] }),
          aL: { d: [-0.07, 0.03, 0.27], e: [0, 0.92, -0.38], grip: true, pron: 0 }, aR: { d: [0.07, 0.03, 0.27], e: [0, 0.92, -0.38], grip: true, pron: 0 } },
        b: { pelvis: [0, 0.42, -0.19], rot: [99, 0, 0], lumbar: [-8, 0, 0], chest: [-14, 0, 0], neck: [16, 0, 0], lL: KN(1, { d: [0.02, -1, 0.44] }), lR: KN(-1, { d: [-0.02, -1, 0.44] }),
          aL: { d: [-0.07, 0.17, 0.24], e: [0, 0.34, -0.94], grip: true, pron: 0 }, aR: { d: [0.07, 0.17, 0.24], e: [0, 0.34, -0.94], grip: true, pron: 0 } },
      },
      seq: [['a', 0.35, 1.3], ['b', 0.7, 1.3]] },

    { id: 'wl24', name: 'Papillon', leaf: 'epaules', p: 'shoulders', s: ['middle back', 'traps'],
      mus: mus(m2('deltP', 1), m2('deltM', 1), m2('mid', 2), m2('trap', 2)), cam: { yaw: 150, pitch: 34 },
      poses: {
        a: { pelvis: [0, 0.1, 0], rot: [92, 0, 0], neck: [-6, 0, 0], lL: { d: [0.04, -0.02, -1], foot: 80 }, lR: { d: [-0.04, -0.02, -1], foot: 80 },
          aL: { atb: [0.07, -0.25, -0.17], pb: [1, 0, -0.5], pron: 180 }, aR: { atb: [-0.07, -0.25, -0.17], pb: [-1, 0, -0.5], pron: 180 } },
        b: { pelvis: [0, 0.1, 0], rot: [92, 0, 0], neck: [-6, 0, 0], lL: { d: [0.04, -0.02, -1], foot: 80 }, lR: { d: [-0.04, -0.02, -1], foot: 80 },
          aL: { d: [1, 0.10, 0.05], p: [0, 1, 0], pron: 0 }, aR: { d: [-1, 0.10, 0.05], p: [0, 1, 0], pron: 0 } },
        c: { pelvis: [0, 0.1, 0], rot: [92, 0, 0], neck: [-6, 0, 0], lL: { d: [0.04, -0.02, -1], foot: 80 }, lR: { d: [-0.04, -0.02, -1], foot: 80 },
          aL: { d: [0.30, 0.12, 1], p: [0, 1, 0], pron: 0 }, aR: { d: [-0.30, 0.12, 1], p: [0, 1, 0], pron: 0 } },
      },
      seq: [['a', 0.3, 1.0], ['b', 0.15, 0.9], ['c', 0.4, 0.9], ['b', 0.15, 1.0]] },

    { id: 'wl25', name: 'Skierg', leaf: 'dos', p: 'lats', s: ['shoulders', 'hamstrings'],
      mus: mus(m2('lat', 1), m2('deltM', 2), m2('ham', 2)), cam: { yaw: 76, pitch: 8 },
      poses: {
        a: { pelvis: [0, 0.9, 0], rot: [4, 0, 0], lumbar: [-4, 0, 0], lL: { at: [0.12, 0.07, 0], foot: 'flat' }, lR: { at: [-0.12, 0.07, 0], foot: 'flat' },
          aL: { db: [0.14, 1, 0.16], pb: [0.3, 0, -1] }, aR: { db: [-0.14, 1, 0.16], pb: [-0.3, 0, -1] } },
        b: { pelvis: [0, 0.86, -0.07], rot: [26, 0, 0], neck: [-10, 0, 0], lL: { at: [0.12, 0.07, 0], foot: 'flat' }, lR: { at: [-0.12, 0.07, 0], foot: 'flat' },
          aL: { db: [0.12, -0.1, 1], eb: [0.1, -0.45, 1], pb: [0.3, -1, 0] }, aR: { db: [-0.12, -0.1, 1], eb: [-0.1, -0.45, 1], pb: [-0.3, -1, 0] } },
        c: { pelvis: [0, 0.76, -0.17], rot: [52, 0, 0], spine: [8, 0, 0], neck: [-26, 0, 0], lL: { at: [0.12, 0.07, 0], foot: 'flat' }, lR: { at: [-0.12, 0.07, 0], foot: 'flat' },
          aL: { db: [0.14, -0.5, -0.86], pb: [0.3, 0.3, -1] }, aR: { db: [-0.14, -0.5, -0.86], pb: [-0.3, 0.3, -1] } },
      },
      seq: [['a', 0.3, 0.55], ['b', 0, 0.5], ['c', 0.35, 0.65], ['b', 0, 0.6]] },

    { id: 'wl26', name: 'Dos rond/dos creux', leaf: 'dos', p: 'lower back', s: ['middle back', 'abdominals'], dup: ['Cat_Stretch'],
      mus: mus(m2('low', 1), m2('mid', 2), { abs: 2 }), cam: { yaw: 70, pitch: 12 },
      poses: {
        a: { pelvis: [0, 0.46, 0], rot: [53, 0, 0], lumbar: [28, 0, 0], chest: [28, 0, 0], neck: [32, 0, 0], lL: KN(1), lR: KN(-1),
          aL: { at: [0.20, 0.03, 0.47], p: [0.3, 0, -1] }, aR: { at: [-0.20, 0.03, 0.47], p: [-0.3, 0, -1] } },
        b: { pelvis: [0, 0.46, 0], rot: [104, 0, 0], lumbar: [-22, 0, 0], chest: [-18, 0, 0], neck: [-36, 0, 0], lL: KN(1), lR: KN(-1),
          aL: { at: [0.20, 0.03, 0.47], p: [0.3, 0, -1] }, aR: { at: [-0.20, 0.03, 0.47], p: [-0.3, 0, -1] } },
      },
      seq: [['a', 0.5, 1.4], ['b', 0.5, 1.4]] },
  ]);
})();
