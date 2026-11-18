// ============================================================================
// the neighbourhood: row houses, trees, parked and moving vehicles, stop signs, the park (load-time only)
// ============================================================================
// Everything here is a prototype mesh drawn many times, through the same instance format as the yard's solid meshes.
// The copies are sorted by culling chunk (one block each, see math.js) and by prototype. A prototype can have a simpler
// mesh for far away. The vehicles that drive are kept in one extra chunk that is always drawn: the vertex shader moves them.
function buildCity(meshes) {
  const P = [];   // per prototype: mesh, far mesh (-1: not drawn far away), 1 if it goes into the shadow map
  const reg = (m) => { meshes.push(m.build()); return meshes.length - 1; };
  const proto = (m, lod, sh = 1) => { const a = reg(m); P.push(a, lod === m ? a : lod ? reg(lod) : -1, sh); return P.length / 3 - 1; };
  // copy src into dst, moved and scaled
  const put = (dst, src, tx, ty, tz, sx = 1, sy = sx, sz = sx) => {
    const o = dst.p.length / 3;
    for (let k = 0; k < src.p.length; k += 3) { dst.p.push(src.p[k] * sx + tx, src.p[k + 1] * sy + ty, src.p[k + 2] * sz + tz); dst.aux.push(src.aux[k / 3]); }
    for (const i of src.i) dst.i.push(i + o);
  };
  const lump = (sub, seed, rough) => icosphere(sub, (x, y, z) => { const r = 1 + (fbm(x * 1.6 + seed, y * 1.6 + 3, z * 1.6, 3) - 0.5) * rough; return [x * r, y * r, z * r]; });

  // ---- row houses, one lot wide: the front (+z) has a garage door, an entry and a bay, the back (-z) plain windows.
  // Each is three meshes: walls, glass, and trim with the roof. The origin is at the foot of the front wall.
  const HOUSE = [], DEPTH = [19, 18.5, 20, 19, 18, 17, 19.5, 18.5], HGT = [6.9, 7.2, 6.8, 7.3, 7.0, 6.9, 7.1, 6.8], GAB = [0, 0, 0, 1, 0, 0, 0, 0];
  // Most houses have a one-storey addition out the back, at yard level (the yard is a storey above the street): how far it
  // juts into the yard, and how much of the lot's width it takes. It is what makes the yards L-shaped
  const POPD = [3.5, 0, 4, 3, 2.5, 4.5, 3, 3.5], POPF = [0.6, 0, 0.55, 0.7, 1, 0.6, 0.5, 0.65];
  // for the camera, for each lot: the house's front and back (distance from its block's middle line) and the height of its
  // roof; then the addition's back, its sides (across the lot, from the lot's middle) and the height of its roof
  const LV7 = 7, LOTS = new Float32Array((3 - CI0) * NCJ * NLOT * 2 * LV7);
  for (let v = 0; v < 8; v++) {
    rseed(900 + v);
    const W = new Mesh(), G = new Mesh(), T = new Mesh(), WL = new Mesh(), TL = new Mesh(), { win, roof, gable } = houseKit(G, T), far = houseKit(new Mesh(), TL);
    // two storeys, a garage and a floor above it, give or take
    const hw = LOTW / 2, D = DEPTH[v], h = HGT[v], gab = !!GAB[v], ff = v === 4 || v === 7, gs = v % 2 ? 1 : -1, rise = 2.2, lit = () => (rnd() < 0.25 ? 1 : 0);
    for (const m of [W, WL]) box(m, -hw, -6, -D, hw, h, 0);
    // the addition out the back: walls from below the yard up one storey, a flat roof, a sliding door onto the yard
    const pd = POPD[v], pw = POPF[v] * LOTW, px0 = gs > 0 ? hw - pw : -hw, px1 = px0 + pw;
    if (pd) {
      for (const m of [W, WL]) box(m, px0, STEP - 0.4, -D - pd, px1, STEP + 3.1, -D);
      for (const t of [T, TL]) aux(t, 0, () => box(t, px0 - 0.03, STEP + 3.1, -D - pd - 0.05, px1 + 0.03, STEP + 3.22, -D));
      win((px0 + px1) / 2, STEP + 1.1, -D - pd, min(2.2, pw - 0.8), 2.1, 0, -1, lit());
    }
    if (gab) {
      roof(-hw, hw, -D, 0, h, rise, true); far.roof(-hw, hw, -D, 0, h, rise, true);
      for (const m of [W, WL]) { gable(m, -hw, hw, 0, h, rise); gable(m, -hw, hw, -D, h, rise); }
      win(0, h + rise * 0.36, 0, 0.8, 0.8, 0, 1, 0);
    } else for (const t of [T, TL]) {
      // a flat roof behind a cornice, or behind a false front that stands well above it
      aux(t, 0, () => box(t, -hw, h, -D, hw, h + 0.12, 0));
      if (ff) { box(W, -hw, h, -0.3, hw, h + 1.4, 0); aux(t, 1, () => { box(t, -hw - 0.05, h + 1.1, -0.35, hw + 0.05, h + 1.55, 0.3); box(t, -hw, h - 0.45, 0, hw, h - 0.3, 0.16); }); }
      else aux(t, 1, () => box(t, -hw, h - 0.5, 0, hw, h + 0.32, 0.24));
    }
    // street level: garage door, a stoop and the front door
    const xd = -gs * 2.35, gx = gs * 1.5;
    aux(T, 0.5, () => { box(T, gx - 1.35, 0.04, 0, gx + 1.35, 2.2, 0.07); box(T, xd - 0.5, 0.75, 0, xd + 0.5, 2.85, 0.07); });
    aux(T, 1, () => box(T, gx - 1.5, 2.2, 0, gx + 1.5, 2.36, 0.1));
    box(W, xd - 0.75, -1, 0, xd + 0.75, 0.72, 1.1);
    // upstairs: a square bay over the garage and a window beside it
    const b0 = gx - 1.45, b1 = gx + 1.45, top = h - 0.95;
    for (const m of [W, WL]) box(m, b0, 3.05, 0, b1, top, 0.8);
    aux(T, 1, () => { box(T, b0 - 0.07, top, 0, b1 + 0.07, top + 0.16, 0.88); box(T, b0 - 0.05, 2.92, 0, b1 + 0.05, 3.05, 0.85); });
    for (let y = 4.45; y + 1 < top; y += 2.75) {
      win(gx, y, 0.8, 1.6, 1.6, 0, 1, lit()); win(b1, y, 0.4, 0.42, 1.4, 1, 0, 0); win(b0, y, 0.4, 0.42, 1.4, -1, 0, 0);
      win(xd + gs * 0.15, y, 0, 1.15, 1.5, 0, 1, lit());
      // the back wall
      win(-1.85, y, -D, 1.2, 1.5, 0, -1, lit()); win(1.85, y, -D, 1.2, 1.5, 0, -1, lit());
      // the side walls: hidden by the neighbours, except at the end of a row
      for (const s of [-1, 1]) for (const z of [-2.6, 2.6 - D]) win(s * hw, y, z, 1.0, 1.4, s, 0, lit());
    }
    // the back door, out onto the yard (a storey up from the street)
    aux(T, 0.5, () => box(T, -gs * 2.3 - 0.45, STEP + 0.05, -D - 0.07, -gs * 2.3 + 0.45, STEP + 2.1, -D));
    HOUSE.push([proto(W, WL), proto(G, 0, 0), proto(T, TL)]);
  }

  // a lot's fences: down one side from the back of the house to the middle of the block, and (north row only, so the two
  // rows don't both build one) across the end of the yard
  const fs = new Mesh(), fr = new Mesh();
  wood(fs, 2, () => box(fs, -LOTW / 2 - 0.03, -4, -ROW, -LOTW / 2 + 0.03, 1.8, -16.8)); wood(fr, 0, () => box(fr, -LOTW / 2, -4, -ROW - 0.03, LOTW / 2, 1.8, -ROW + 0.03));
  const FSIDE = proto(fs, fs, 0), FREAR = proto(fr, fr, 0);
  const shw = new Mesh(), sht = new Mesh(); box(shw, -1.3, -3, -1, 1.3, 2.1, 1); aux(sht, 0, () => box(sht, -1.45, 2.1, -1.15, 1.45, 2.22, 1.15));
  const SHED = [proto(shw, shw, 0), proto(sht, sht, 0)];
  // ---- back-yard things, built facing +z with the yard toward -z: a stone patio or a deck by the house, a picnic table, a
  // kettle grill, an umbrella, a lamp post, a string of bulbs from the house to a post, a planter box
  const PROP = {};
  {
    rseed(940);
    const pa = new Mesh(); box(pa, -2.6, -0.3, -1.6, 2.6, 0.08, 1.6); PROP.patio = proto(pa, pa);
    const dk = new Mesh();
    for (let x = -2.8; x < 2.8; x += 0.15) wood(dk, 2, () => box(dk, x, 0.4, -1.7, x + 0.14, 0.45, 1.7));
    wood(dk, 0, () => box(dk, -2.85, -0.3, -1.75, 2.85, 0.4, 1.75));
    for (const x of [-2.75, 2.75]) for (let z = -1.5; z <= 1.5; z += 0.3) wood(dk, 1, () => box(dk, x - 0.02, 0.45, z - 0.02, x + 0.02, 1.35, z + 0.02));
    for (const x of [-2.75, 2.75]) wood(dk, 2, () => box(dk, x - 0.04, 1.32, -1.7, x + 0.04, 1.38, 1.7));
    PROP.deck = proto(dk, dk);
    const tb = new Mesh();
    for (let i = 0; i < 4; i++) wood(tb, 0, () => box(tb, -0.9, 0.72, -0.37 + i * 0.185, 0.9, 0.76, -0.2 + i * 0.185));
    for (const z of [-0.62, 0.62]) wood(tb, 0, () => box(tb, -0.9, 0.42, z - 0.13, 0.9, 0.46, z + 0.13));
    for (const x of [-0.7, 0.7]) for (const k of [-1, 1]) wood(tb, 1, () => tb.sweep([[x, 0, k * 0.72], [x, 0.74, k * 0.05]], 0.07, 0.05, () => [1, 0, 0]));
    PROP.table = proto(tb, tb);
    const gr = new Mesh();
    lathe(gr, [[0.01, 0.62], [0.26, 0.66], [0.3, 0.8], [0.29, 0.86], [0.24, 0.98], [0.1, 1.04], [0.05, 1.07], [0.01, 1.08]], 16);
    for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; gr.tube([[cos(a) * 0.22, 0.66, sin(a) * 0.22], [cos(a) * 0.32, 0, sin(a) * 0.32]], 0.018, 4); }
    PROP.grill = proto(gr, gr);
    const up = new Mesh(); up.tube([[0, 0, 0], [0, 2.45, 0]], 0.025, 5); PROP.pole = proto(up, 0);
    const uc = new Mesh(); lathe(uc, [[1.35, 1.98], [0.7, 2.25], [0.03, 2.42]], 8); PROP.canopy = proto(uc, uc);
    const lp = new Mesh(); lp.tube([[0, -0.2, 0], [0, 2.1, 0]], 0.04, 6); PROP.lamppost = proto(lp, 0, 0);
    const lh = new Mesh(); aux(lh, 1, () => box(lh, -0.12, 2.1, -0.12, 0.12, 2.42, 0.12)); PROP.lamp = proto(lh, 0, 0);
    // a string of bulbs, sagging from the back wall of the house to a post 7 m out
    const sw = new Mesh(), sb = new Mesh(), pts = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push([-1.8 + 3 * t, 2.7 - 0.5 * t - 0.6 * 4 * t * (1 - t), -7 * t]); }
    sw.tube(pts, 0.008, 3, false); sw.tube([[1.2, -0.2, -7], [1.2, 2.25, -7]], 0.04, 5);
    aux(sb, 1, () => { for (let i = 1; i < 20; i++) { const [x, y, z] = pts[i]; box(sb, x - 0.03, y - 0.1, z - 0.03, x + 0.03, y - 0.04, z + 0.03); } });
    PROP.wire = proto(sw, 0, 0); PROP.bulbs = proto(sb, 0, 0);
    const pl = new Mesh(); wood(pl, 2, () => box(pl, -0.5, -0.3, -1.2, 0.5, 0.45, 1.2)); PROP.planter = proto(pl, pl);
    // a hedge or a big shrub: a run of foliage about 3 m long and taller than the fence
    const hg = new Mesh(); for (let i = 0; i < 6; i++) put(hg, lump(LV > 1 ? 1 : 2, rnd() * 40, 0.6), rr(-0.25, 0.25), rr(1.2, 2.1), -1.3 + i * 0.52 + rr(-0.2, 0.2), rr(0.75, 1.05), rr(1.1, 1.5), rr(0.75, 1.05));
    PROP.hedge = proto(hg, hg);
    // the retaining wall at the end of a block, holding the yards up a storey above the cross street, a fence on top
    const rw = new Mesh(); box(rw, -0.15, -STEP - 1.5, -(ROW - 16.5), 0.15, 1.8, ROW - 16.5); PROP.wall = proto(rw, rw);
    const ps = new Mesh(); box(ps, -0.44, 0.38, -1.14, 0.44, 0.42, 1.14); PROP.soil = proto(ps, 0, 0);
  }
  // ---- trees: a trunk and a canopy of lumps. 0 eucalyptus, 1 cypress, 2 pine, 3 street tree
  const TREE = [];
  for (let k = 0; k < 4; k++) {
    rseed(920 + k);
    const C = new Mesh(), K = new Mesh(), b = (x, y, z, r, sy = 1) => put(C, lump(LV > 1 ? 1 : 2, rnd() * 50, k === 3 ? 0.55 : 0.95), x, y, z, r, r * sy, r);
    let L;
    if (k === 0) {
      // eucalyptus: a tall pale trunk that forks, loose clumps of foliage up high
      K.tube([[0, -1.5, 0], [0.2, 5, 0.1], [0.1, 10, -0.2], [0.3, 14, 0]], (i) => 0.36 - 0.08 * i, 7);
      for (const sx of [-1, 1]) K.tube([[0.1, 10, -0.2], [sx * 1.6, 13.5, rr(-0.8, 0.8)], [sx * 2.2, 16, rr(-1, 1)]], (i) => 0.18 - 0.05 * i, 6);
      // the foliage hangs in narrow drooping clumps, with sky between them
      for (let i = 0; i < 30; i++) { const a = rnd() * TAU, d = rr(0.6, 3.8), y = rr(9.5, 18.5); b(cos(a) * d, y - d * 0.4, sin(a) * d, rr(0.4, 0.85), rr(2.2, 3.2)); }
      L = [0, 11.5, 0, 3.7, 5.2];
    } else if (k === 1) {
      // Monterey cypress: a stout trunk, limbs reaching out to wind-flattened pads of foliage
      K.tube([[0, -1.5, 0], [0.3, 3, 0.2], [0.8, 6.6, 0.3]], (i) => 0.46 - 0.12 * i, 7);
      for (let i = 0; i < 9; i++) { const a = rnd() * TAU, d = rr(0.8, 3.8), x = 0.4 + cos(a) * d, z = 0.2 + sin(a) * d, y = rr(5.6, 8.6); K.tube([[0.4, rr(3.5, 5.5), 0.2], [x * 0.6, y - 0.6, z * 0.6], [x, y, z]], (j) => 0.2 - 0.06 * j, 5); b(x, y + 0.3, z, rr(1.4, 2.3), 0.5); }
      L = [0, 7.5, 0, 5.6, 1.9];
    } else if (k === 2) {
      // pine: ragged cones, one above the other
      K.tube([[0, -1.5, 0], [0, 9.5, 0]], (i) => 0.3 - 0.2 * i, 7);
      for (let i = 0; i < 7; i++) {
        // each tier droops at its edge and is ragged all round
        const y0 = 2.4 + i * 1.2, R = 3 - i * 0.38, ph = rnd() * 9, t = new Mesh();
        lathe(t, [[0.05, y0 + 0.1], [R, y0 - 0.35], [R * 0.9, y0 - 0.1], [R * 0.45, y0 + 0.9], [0.02, y0 + 2.1 - i * 0.1]], 18, (a) => 1 + 0.2 * sin(a * 5 + ph) + 0.14 * sin(a * 13 + ph * 2) + 0.08 * sin(a * 29 + ph));
        put(C, t, 0, 0, 0);
      }
      L = [0, 6.6, 0, 2.4, 5];
    } else {
      K.tube([[0, -1, 0], [0.05, 3.2, 0]], (i) => 0.11 - 0.03 * i, 6);
      for (let i = 0; i < 18; i++) { const a = rnd() * TAU, d = rr(0, 1.25), y = rr(3.4, 5.4); b(cos(a) * d, y - d * 0.3, sin(a) * d, rr(0.45, 0.8), rr(0.8, 1.1)); }
      for (const sx of [-1, 1]) K.tube([[0.05, 3, 0], [sx * 0.6, 4, sx * 0.2]], (i) => 0.06 - 0.02 * i, 5);
      L = [0, 4.2, 0, 1.9, 1.7];
    }
    const far = new Mesh(); put(far, lump(1, k * 7, 0.5), L[0], L[1], L[2], L[3], L[4], L[3]);
    TREE.push([proto(C, far), proto(K, 0)]);
  }

  // ---- vehicles, nose toward +z. Vertex code: 1 paint, 0.75 glass, 0.5 tyres, 0.25 lamps
  // a wheel: the tyre, and a flat outer face of its own (a shared cap would shade as a wedge)
  const wheel = (m, x, z, r) => aux(m, 0.5, () => { const sx = Math.sign(x); m.tube([[x - sx * 0.22, r, z], [x, r, z]], r, 16, false); const c = m.v(x + sx * 0.001, r, z), q = []; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; q.push(m.v(x + sx * 0.001, r + cos(a) * r, z + sin(a) * r)); } for (let k = 0; k < 16; k++) if (sx > 0) m.tri(c, q[k], q[(k + 1) % 16]); else m.tri(c, q[(k + 1) % 16], q[k]); });
  const lamps = (m, w2, y, hl) => aux(m, 0.25, () => { for (const s of [-1, 1]) for (const e of [-1, 1]) box(m, s * w2 - 0.2 - s * 0.28, y - 0.07, e * hl - 0.03, s * w2 + 0.2 - s * 0.28, y + 0.09, e * hl + 0.03); });
  const carMesh = (L, Wd, hb, hc, c0, c1) => {
    const m = new Mesh(), hl = L / 2, yb = 0.28 + hb / 2, yt = 0.28 + hb, up = () => [0, 1, 0];
    aux(m, 1, () => m.sweep([[0, yb, -hl], [0, yb, -hl + 0.25], [0, yb, hl - 0.3], [0, yb, hl]], (k) => Wd * [0.86, 1, 1, 0.84][k], (k) => hb * [0.75, 1, 1, 0.7][k], up));
    aux(m, 0.75, () => m.sweep([[0, yt, c0], [0, yt + hc / 2 - 0.02, c0 + 0.5], [0, yt + hc / 2 - 0.02, c1 - 0.75], [0, yt, c1]], (k) => Wd * [0.9, 0.8, 0.8, 0.9][k], (k) => [0.04, hc, hc, 0.04][k], up));
    aux(m, 1, () => box(m, -Wd * 0.4, yt + hc - 0.05, c0 + 0.55, Wd * 0.4, yt + hc + 0.01, c1 - 0.8));
    for (const s of [-1, 1]) for (const e of [-1, 1]) wheel(m, s * Wd / 2, e * (hl - 0.85), 0.33);
    lamps(m, Wd / 2, yb + 0.05, hl);
    return m;
  };
  const boxCar = (L, Wd, H, c0, c1) => { const m = new Mesh(); aux(m, 1, () => box(m, -Wd / 2, 0.28, -L / 2, Wd / 2, H * 0.6, L / 2)); aux(m, 0.75, () => box(m, -Wd * 0.4, H * 0.6, c0 + 0.3, Wd * 0.4, H, c1 - 0.4)); return m; };
  const SEDAN = proto(carMesh(4.4, 1.76, 0.6, 0.5, -1.5, 1.0), boxCar(4.4, 1.76, 1.38, -1.5, 1.0));
  const WAGON = proto(carMesh(4.5, 1.84, 0.68, 0.62, -2.1, 1.05), boxCar(4.5, 1.84, 1.58, -2.1, 1.05));
  const busM = new Mesh(), busL = new Mesh();
  for (const m of [busM, busL]) aux(m, 1, () => box(m, -1.275, 0.38, -5.5, 1.275, 3.05, 5.5));
  aux(busM, 0.75, () => { for (const s of [-1, 1]) box(busM, s * 1.29 - 0.02, 1.45, -5.0, s * 1.29 + 0.02, 2.45, 4.4); box(busM, -1.15, 1.3, 5.49, 1.15, 2.6, 5.53); box(busM, -1, 1.6, -5.53, 1, 2.5, -5.49); });
  aux(busL, 0.75, () => { for (const s of [-1, 1]) box(busL, s * 1.29 - 0.02, 1.45, -5.0, s * 1.29 + 0.02, 2.45, 4.4); });
  for (const s of [-1, 1]) for (const z of [3.5, -3.1]) wheel(busM, s * 1.28, z, 0.5);
  // a trolley bus: the destination sign over the windscreen, folding doors on the kerb side, two poles up to the wires
  aux(busM, 0.25, () => box(busM, -0.9, 2.68, 5.5, 0.9, 2.92, 5.56));
  aux(busM, 0.75, () => { box(busM, 1.27, 0.5, 3.6, 1.31, 2.7, 4.7); box(busM, 1.27, 0.5, -0.6, 1.31, 2.7, 0.5); });
  aux(busM, 0.5, () => { box(busM, -0.6, 3.05, -2.5, 0.6, 3.3, -1.2); for (const x of [-0.3, 0.3]) busM.tube([[x, 3.25, -1.6], [x, 5.62, -6.4]], 0.035, 5); });
  aux(busL, 0.5, () => { for (const x of [-0.3, 0.3]) busL.tube([[x, 3.25, -1.6], [x, 5.62, -6.4]], 0.05, 4); });
  lamps(busM, 1.275, 0.85, 5.5);
  const BUS = proto(busM, busL);

  // ---- a stop sign: a post and an octagonal plate facing +z (the lettering is drawn by the shader)
  const sg = new Mesh();
  aux(sg, 0, () => box(sg, -0.03, -1, -0.03, 0.03, 2.72, 0.03));
  aux(sg, 1, () => { for (const z of [0.045, 0.03]) { const c = sg.v(0, 2.3, z), r = []; for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * TAU; r.push(sg.v(cos(a) * 0.41, 2.3 + sin(a) * 0.41, z)); } for (let k = 0; k < 8; k++) if (z > 0.04) sg.tri(c, r[k], r[(k + 1) % 8]); else sg.tri(c, r[(k + 1) % 8], r[k]); } });
  const SIGN = proto(sg, 0, 0);
  // ---- the park's water tank and its pond
  const tk = new Mesh(); aux(tk, 1, () => lathe(tk, [[14, 0.9], [14, 19], [14.25, 19.1], [14.25, 19.6], [13.4, 20.2], [0.01, 23.6]], 48));
  // its concrete ring footing and a ladder up the side
  aux(tk, 0.5, () => lathe(tk, [[14.9, -9], [14.9, 0.95], [13.9, 0.95]], 48));
  aux(tk, 0.25, () => { for (const x of [-0.3, 0.3]) tk.tube([[x, 0.9, 14.2], [x, 20.3, 14.2]], 0.06, 5); box(tk, -0.36, 0.9, 14.05, 0.36, 20.3, 14.12); });
  const TANKP = proto(tk, tk);
  // the water: a disc that follows the shore's wandering radius (see HT), a little past it, under the bank
  const pd = new Mesh(), pc = pd.v(0, 0, 0); { const r = []; for (let k = 0; k < 64; k++) { const a = k / 64 * TAU, q = 1 / (1 + 0.12 * sin(a * 3 + 1) + 0.07 * sin(a * 5 + 4)); r.push(pd.v(cos(a) * q, 0, sin(a) * q)); } for (let k = 0; k < 64; k++) pd.tri(pc, r[(k + 1) % 64], r[k]); }
  // a clump of reeds
  const rd = new Mesh(); rseed(990); aux(rd, 1, () => { for (let i = 0; i < 9; i++) { const a = rnd() * TAU, d = rr(0, 0.25), h = rr(1, 1.8); rd.tube([[cos(a) * d, -0.3, sin(a) * d], [cos(a) * (d + 0.1), h * 0.6, sin(a) * (d + 0.1)], [cos(a) * (d + 0.25), h, sin(a) * (d + 0.25)]], (j) => 0.025 - 0.01 * j, 3); } });
  const REED = proto(rd, 0, 0);
  const PONDP = proto(pd, pd, 0);

  // ---- where the copies stand
  let NP = P.length / 3; const I = Array.from({ length: NCH + 1 }, () => []), ZD = [0, 0, 0, 0], Q0 = [0, 0, 0, 1], QY = (a) => qAxis(0, 1, 0, a);
  const chunkOf = (x, z) => clamp(round(x / BLX), CI0, CI1) - CI0 + NCI * (clamp(round((z - BCZ) / BLZ), CJ0, CJ1) - CJ0);
  const add = (ch, p, x, y, z, sc, q, mat, seed, asp = 1, d = ZD) => { (I[ch][p] ||= []).push(x, y, z, sc, q[0], q[1], q[2], q[3], mat, seed, 0, asp, d[0], d[1], d[2], d[3]); };
  const at = (p, x, y, z, sc, q, mat, seed, asp) => add(chunkOf(x, z), p, x, y, z, sc, q, mat, seed, asp);
  const tree = (k, x, z, sc) => { const q = k ? QY(rnd() * TAU) : qMul(qAxis(rr(-1, 1), 0, rr(-1, 1), rr(0, 0.12)), QY(rnd() * TAU)), y = HT(x, z), a = rr(0.85, 1.2); at(TREE[k][0], x, y, z, sc, q, 17, k + rnd() * 0.99, a); at(TREE[k][1], x, y, z, sc, q, 6, 4 + (k ? 0.5 : 0) + rnd() * 0.49, a); };
  const park = (x, z, a) => at(rnd() < 0.3 ? WAGON : SEDAN, x, HT(x, z), z, 1, QY(a), 18, (rnd() * 7 | 0) + rnd() * 0.99);
  rseed(950);
  const QB = QY(PI);
  // furnish one lot's back yard. (x, zf): the middle of the lot at the street, s: which way the house faces, d: its depth
  // hedge: which side (in the lot's own frame) must have a tall hedge along its fence, 0 for none
  const yard = (x, y0, zf, s, d, hedge = 0) => {
    const q = s > 0 ? Q0 : QB, L = ROW - d, P = (dx, t) => [x + dx * s, zf - s * (d + t)], put1 = (p, dx, t, mat, seed, qq = q) => { const [px, pz] = P(dx, t); at(p, px, HT(px, pz), pz, 1, qq, mat, seed); };
    const r = rnd();
    if (r < 0.42) put1(PROP.patio, 0, 1.6, 16, rnd() * 0.99);
    else if (r < 0.62) put1(PROP.deck, 0, 1.75, 3, 0.25 + rnd() * 0.24);
    if (r < 0.62) {
      const tx = rr(-1.2, 1.2), qt = qMul(q, QY(rr(-0.15, 0.15)));
      if (rnd() < 0.55) { put1(PROP.table, tx, 1.7, 3, 0.5 + rnd() * 0.49, qt); if (rnd() < 0.35) { put1(PROP.pole, tx, 1.7, 14, 0.5); put1(PROP.canopy, tx, 1.7, 10, 6 + (rnd() * 6 | 0) + rnd() * 0.99); } }
      if (rnd() < 0.45) put1(PROP.grill, rnd() < 0.5 ? -2.6 : 2.6, rr(0.6, 2.4), 14, 0.5);
    }
    if (rnd() < 0.3) { const dx = (rnd() < 0.5 ? -1 : 1) * (LOTW / 2 - 0.45), t = rr(4, L - 1); put1(PROP.lamppost, dx, t, 14, 0.5); put1(PROP.lamp, dx, t, 11, 1.5); }
    if (rnd() < 0.14) { put1(PROP.wire, 0, 0, 14, 0.5); put1(PROP.bulbs, 0, 0, 11, 1.5); }
    // shrubs and hedges along the fences, taller than the fence; the garden's neighbours have a row of them along its fences
    for (const sd of [-1, 1]) {
      if (hedge === sd) { for (let t = 0.5; t < L - 1.5; t += rr(2.4, 3.2)) put1(PROP.hedge, sd * (LOTW / 2 - 0.9), t, 17, 3 + rnd() * 0.99, qMul(q, QY(rr(-0.2, 0.2)))); }
      else if (rnd() < 0.35) put1(PROP.hedge, sd * (LOTW / 2 - 0.9), rr(1, L - 3), 17, 3 + rnd() * 0.99, qMul(q, QY(rr(-0.2, 0.2))));
    }
    if (rnd() < 0.22) { const sd = rnd() < 0.5 ? -1 : 1, t = rr(6, L - 2); put1(PROP.planter, sd * (LOTW / 2 - 0.65), t, 3, 0.5 + rnd() * 0.49); put1(PROP.soil, sd * (LOTW / 2 - 0.65), t, 0, 0); }
  };
  for (let bi = CI0; bi <= 2; bi++) for (let bj = CJ0; bj <= CJ1; bj++) {
    const cx = BLX * bi, cz = BLZ * bj + BCZ;
    // two rows of fourteen lots, back to back: every lot has its house on the street and its yard behind, against the yard of
    // a house in the other row
    for (let l = 0; l < NLOT; l++) for (const s of [-1, 1]) {
      let zf = cz + s * ROW; const x = cx - ROWL / 2 + LOTW * (l + 0.5), hv = rnd() * 8 | 0, H = HOUSE[hv], k = (rnd() < 0.32 ? 6 + rnd() * 6 | 0 : rnd() < 0.85 ? 12 + rnd() * 4 | 0 : rnd() * 6 | 0) + rnd() * 0.99, a = rr(0.97, 1.03), r1 = rnd(), r2 = rnd();
      const lo = (((bi - CI0) * NCJ + bj - CJ0) * NLOT * 2 + l * 2 + (s > 0 ? 1 : 0)) * LV7;
      // the garden's own lot: its house is built by hand (see meshHouses in world.js)
      if (!bi && !bj && s > 0 && abs(x) < 1) { LOTS.set([-9, 99, 0, 99, 0, 0, 0], lo); continue; }   // (its own walls stop the camera: see home.js)
      const y = HT(x, zf), q = s > 0 ? Q0 : QB;
      zf -= s * (rnd() < 0.3 ? rr(0.2, 0.9) : 0);   // not every house stands on the building line
      { const pw = POPF[hv] * LOTW, gs = hv % 2 ? 1 : -1, p0 = gs > 0 ? LOTW / 2 - pw : -LOTW / 2;
        LOTS.set([abs(zf - cz), abs(zf - cz) - DEPTH[hv], y + HGT[hv] * a + (GAB[hv] ? 2.2 : 0.6), abs(zf - cz) - DEPTH[hv] - (POPD[hv] || -1), s > 0 ? p0 : -p0 - pw, s > 0 ? p0 + pw : -p0, y + STEP + 3.3], lo); }
      at(H[0], x, y, zf, 1, q, 10, k, a); at(H[1], x, y, zf, 1, q, 11, 3 + r1 * 0.99, a); at(H[2], x, y, zf, 1, q, 12, r2 * 0.99, a);
      // behind it: the lot's fences, perhaps a tree and a shed
      // on a slope the lot's fences would stand out of the ground. The lot east of the garden has no side fence of its own:
      // the garden's fence is the line
      // the yard is a storey up from the street: the fences stand on it
      const home = !bi && !bj, yy = HT(x, zf - s * (ROW - 4)), fl = abs(HT(x, zf - s * ROW) - yy) < 0.35;
      if (fl && !(home && s > 0 && abs(x - LOTW) < 1)) at(FSIDE, x, yy, zf, 1, q, 2, rnd() * 0.99);
      yard(x, yy, zf, s, DEPTH[hv] + POPD[hv], home && s > 0 && abs(abs(x) - LOTW) < 1 ? -Math.sign(x) * s : 0);
      if (fl && s > 0) at(FREAR, x, yy, zf, 1, q, 2, rnd() * 0.99);
      if (rnd() < 0.4) tree(3, x + rr(-2, 2), zf - s * rr(21, 32), rr(0.8, 1.35));
      if (rnd() < 0.3) { const sx = x + rr(-2, 2), sz = zf - s * rr(27.5, 32.5), sy = HT(sx, sz), sq = QY(rr(-0.1, 0.1)); at(SHED[0], sx, sy, sz, 1, sq, 10, (rnd() * 12 | 0) + rnd() * 0.99); at(SHED[1], sx, sy, sz, 1, sq, 12, rnd() * 0.99); }
    }
    // cars parked along the street south of the block and the avenue east of it, a few street trees
    for (let x = cx - ROWL / 2 + 6; x <= cx + ROWL / 2 - 6; x += 6.1) for (const s of [-1, 1]) if (rnd() < 0.55) park(x + rr(-0.4, 0.4), cz + ROW + WALKW + s * 3.5, s * PI / 2);
    for (let z = cz - 30; z <= cz + 30; z += 6.1) for (const s of [-1, 1]) if (rnd() < 0.45) park(cx + AV0 + s * 3.5, z + rr(-0.4, 0.4), s > 0 ? PI : 0);
    for (let i = 0; i < 5; i++) { const s = rnd() < 0.5 ? -1 : 1; tree(3, cx + rr(-ROWL / 2 + 3, ROWL / 2 - 3), cz + ROW + WALKW + s * 5.9, rr(0.75, 1.05)); }
    for (const ex of [-1, 1]) at(PROP.wall, cx + ex * (ROWL / 2 + 0.1), HTb(cx + ex * (ROWL / 2 - 2), cz), cz, 1, Q0, 16, 0.3);
    // a stop sign for each way into the crossing at the block's south-east corner
    const xi = cx + AV0, zi = cz + ROW + WALKW, S = (x, z, a) => at(SIGN, x, HT(x, z), z, 1, QY(a), 20, rnd() * 0.99);
    S(xi - 8.4, zi + 5.3, -PI / 2); S(xi - 5.3, zi - 8.4, PI); S(xi + 5.3, zi + 8.4, 0); if (bi < 2) S(xi + 8.4, zi - 5.3, PI / 2);
  }
  // the park: groves where the noise is high, open meadow elsewhere
  rseed(970);
  const used = new Set();
  for (let n = 0; n < 12000; n++) {
    const x = rr(PARKX + 9, 900), z = rr(-470, 440), d = fbm(x * 0.006, 3, z * 0.006, 3), e = fbm(x * 0.02, 9, z * 0.02, 2);
    if (d + e * 0.35 < 0.72 || hypot(x - TANK[0], z - TANK[1]) < 24 || hypot(x - POND[0], z - POND[1]) < 46) continue;
    const g = (round(x / 4.2) + 4000) * 8000 + round(z / 4.2) + 4000; if (used.has(g)) continue; used.add(g);   // one tree per 4 m square
    const k = e > 0.56 ? 2 : d > 0.6 ? 0 : 1; tree(k, x, z, k ? rr(0.8, 1.45) : rr(0.55, 1.6) * (0.8 + 0.5 * sstep(0.72, 0.9, d)));   // taller in the heart of a grove
  }
  at(TANKP, TANK[0], TKY - STEP, TANK[1], 1, Q0, 18, 7.5);
  // the pond: still water in its basin (see HT)
  at(PONDP, POND[0], PONDY, POND[1], 34.5, Q0, 21, 0.5);
  rseed(991);
  for (let i = 0; i < 160; i++) { const a = rnd() * TAU, q = 1 / (1 + 0.12 * sin(a * 3 + 1) + 0.07 * sin(a * 5 + 4)), d = rr(27, 34) * q, x = POND[0] + cos(a) * d, z = POND[1] + sin(a) * d; if (rnd() < 0.55) at(REED, x, max(HT(x, z), PONDY), z, rr(0.7, 1.3), QY(rnd() * TAU), 17, 3 + rnd() * 0.99); }
  // traffic. d = distance between stops, speed, length of the route, where on it the vehicle starts (in stops)
  rseed(980);
  const drive = (x, z, a, per, len, n, bus) => { let ph = rnd() * 3; for (let i = 0; i < n; i++, ph += rr(0.45, 1.6)) add(NCH, bus ? BUS : rnd() < 0.3 ? WAGON : SEDAN, x, 0, z, 1, QY(a), 19, (bus ? 8 : rnd() * 7 | 0) + rnd() * 0.99, 1, [per, 9, len, ph]); };
  for (let j = CJ0 - 1; j <= CJ1; j++) { const z = ST0 + BLZ * j; drive(-249, z + 1.25, PI / 2, BLX, 10 * BLX, 3); drive(-351, z - 1.25, -PI / 2, BLX, 10 * BLX, 3); }
  for (let i = -8; i <= 2; i++) { const x = AV0 + BLX * i, b = i === -2 || i === 0; drive(x - 1.25, -23, 0, BLZ, (CJ1 - CJ0 + 1) * BLZ, 3); drive(x + 1.25, -5, PI, BLZ, (CJ1 - CJ0 + 1) * BLZ, 3); if (b) { drive(x - 1.25, -23, 0, BLZ, (CJ1 - CJ0 + 1) * BLZ, 2, 1); drive(x + 1.25, -5, PI, BLZ, (CJ1 - CJ0 + 1) * BLZ, 2, 1); } }

  // overhead wires for the trolley buses on the two bus avenues: two wires over each lane, poles at the kerbs with span wires
  {
    const m = new Mesh();
    aux(m, 1, () => {
      for (const ax of [AV0 - 2 * BLX, AV0]) {
        for (const lx of [-1.55, -0.95, 0.95, 1.55]) { const pts = []; for (let z = -534; z <= 506; z += 4) pts.push([ax + lx, HT(ax + lx, z) + 5.62 + 0.15 * sin((z + 534) / 36 * PI) ** 2, z]); m.tube(pts, 0.014, 3, false); }
        for (let z = -534; z <= 506; z += 36) {
          const y = HT(ax, z); for (const s of [-1, 1]) m.tube([[ax + s * (ROADW + 0.4), y - 1, z], [ax + s * (ROADW + 0.4), y + 7.2, z]], 0.12, 6);
          m.tube([[ax - ROADW - 0.4, y + 6, z], [ax, y + 5.75, z], [ax + ROADW + 0.4, y + 6, z]], 0.012, 3, false);
        }
      }
    });
    add(NCH, proto(m, 0, 0), 0, 0, 0, 1, Q0, 14, 0.5);
  }
  // ---- pack: by chunk, then by prototype
  NP = P.length / 3;
  const start = new Uint32Array((NCH + 1) * NP), count = new Uint32Array((NCH + 1) * NP); let n = 0;
  for (let c = 0; c <= NCH; c++) for (let p = 0; p < NP; p++) { const a = I[c][p]; start[c * NP + p] = n; if (a) { count[c * NP + p] = a.length / 16; n += a.length / 16; } }
  const data = new Float32Array(n * 16); let o = 0;
  for (let c = 0; c <= NCH; c++) for (let p = 0; p < NP; p++) { const a = I[c][p]; if (a) { data.set(a, o); o += a.length; } }
  // height of the ground in the middle of each chunk, for culling
  const cy = new Float32Array(NCH);
  for (let c = 0; c < NCH; c++) cy[c] = HT(BLX * (c % NCI + CI0), BLZ * ((c / NCI | 0) + CJ0) + BCZ);
  return { data, start, count, cy, NP, P: new Int32Array(P), n, lots: LOTS };
}

// the ground beyond the yard: grids of decreasing detail, each with a hole where a finer one lies (the shader paints
// streets, lots and park on them). The yard's own ground covers the middle; a fine patch the pond's shore
function buildFar() {
  const V = [], I = [];
  // a grid of n x n cells of size st from (x0, z0), height h, leaving out the cells for which skip(x, z, x + st, z + st)
  const grid = (x0, z0, st, nx, nz, h, skip) => {
    const o = V.length / 4;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = x0 + i * st, z = z0 + j * st; V.push(x, h(x, z), z, st); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + i * st, z = z0 + j * st; if (skip(x, z, x + st, z + st)) continue;
      const a = o + i + (nx + 1) * j; I.push(a, a + nx + 1, a + nx + 2, a, a + nx + 2, a + 1);
    }
  };
  const inside = (a, b) => (x0, z0, x1, z1) => x0 >= a[0] && x1 <= a[1] && z0 >= b[0] && z1 <= b[1];
  // near the yard the sheet lies a little lower, under the yard's own ground
  const h = (x, z) => HT(x, z) - 0.05 - 0.05 * sstep(70, 50, hypot(x, z + 14));
  const PX = [POND[0] - 48, POND[0] + 48], PZ = [POND[1] - 48, POND[1] + 48];
  grid(PX[0], PZ[0], 1.5, 64, 64, h, () => false);
  grid(-1000, -800, 8, 250, 197, h, (x0, z0, x1, z1) => (x0 >= -24 && x1 <= 24 && z0 >= -24 && z1 <= 24) || inside(PX, PZ)(x0, z0, x1, z1));
  grid(-5000, -5000, 100, 100, 100, (x, z) => HT(x, z) - 0.3, inside([-1000, 1000], [-800, 776]));
  // normals from the height function, over the cell size
  const n = V.length / 4, vb = new ArrayBuffer(n * 16), f = new Float32Array(vb), s8 = new Int8Array(vb);
  for (let k = 0; k < n; k++) {
    const x = V[k * 4], z = V[k * 4 + 2], e = V[k * 4 + 3] / 2, dx = HT(x + e, z) - HT(x - e, z), dz = HT(x, z + e) - HT(x, z - e), l = hypot(dx, 2 * e, dz);
    f[k * 4] = x; f[k * 4 + 1] = V[k * 4 + 1]; f[k * 4 + 2] = z;
    s8[k * 16 + 12] = round(-dx / l * 127); s8[k * 16 + 13] = round(2 * e / l * 127); s8[k * 16 + 14] = round(-dz / l * 127);
  }
  return { vb, ib: new Uint32Array(I) };
}
