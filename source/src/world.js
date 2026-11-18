// ============================================================================
// the garden: layout + procedural content generation (load-time only)
// ============================================================================
// A fenced backyard, 12 m x 18 m: fences at x = ±6 and z = -9 (the sun comes up behind that one), the house at z = +9.

// The garden is one lot wide (10.5 m) and 18 m deep, from the back of the house (z = 9) to the back fence (z = -9), a storey
// above the street. Seen from the garden: on the left a one-storey addition juts out of the house (x > -0.4, back to z = 5.6)
// with a sliding door; on the right the house steps back, with the back door, a window and seats. A low deck runs across the
// whole back (to z = 4.45); a paved patio runs across in front of it and down the left fence; cream-painted beds stand in red
// lava rock, a long one down the right fence.
// raised beds: centre x, z, size x, z, height, crop (0 tomatoes, 1 zucchini, 2 herbs)
const BEDS = [[-4.25, -3.2, 1.2, 8.8, 0.42, 0], [-1.25, -4.2, 1.7, 3.4, 0.36, 1], [1.75, -5.6, 1.3, 4.2, 0.42, 0], [1.75, -0.2, 1.3, 2.6, 0.48, 2], [-1.4, 1.6, 1.3, 2.0, 0.4, 2], [1.75, 2.45, 1.3, 1.9, 0.42, 1], [-1.4, -1.2, 1.3, 1.9, 0.38, 2]];
// the deck: x0, x1, z0, z1, height
const DECK = [-5.23, 5.23, 4.45, 10.15, 0.3];
const onDeck = (x, z) => x > DECK[0] && x < DECK[1] && z > DECK[2] && z < DECK[3];
const POTS = [[4.75, -6.8, 0.27, 0.46, 0.2, 0], [4.72, -5.0, 0.3, 0.5, 0.9, 0], [4.75, -3.2, 0.27, 0.46, 0.4, 0], [-4.55, 8.35, 0.25, 0.42, 0.55, 0],
  [-1.12, 5.4, 0.15, 0.24, 0.3, 1], [-1.12, 5.95, 0.13, 0.2, 0.1, 4], [-4.85, 5.35, 0.17, 0.27, 0.62, 2],
  [-4.6, 2.0, 0.2, 0.32, 0.45, 2], [-4.75, 2.7, 0.16, 0.26, 0.15, 1], [-4.15, 2.35, 0.14, 0.22, 0.85, 3], [4.6, 1.4, 0.19, 0.3, 0.35, 6], [3.35, 4.25, 0.18, 0.28, 0.25, 5],
  [4.7, -8.2, 0.24, 0.4, 0.3, 2], [4.65, 2.6, 0.2, 0.32, 0.8, 6], [-1.85, 5.15, 0.26, 0.44, 0.5, 0], [4.72, 0.2, 0.22, 0.36, 0.2, 1], [-2.7, 3.3, 0.18, 0.3, 0.85, 4]];
const BIN = [4.6, -1.4, 0.1];    // worm bin: x, z, yaw
const CAT = [1.9, 2.224, -9];      // the cat sits on the back fence
const FTOP = 2.2;                 // top of the fences
// tomato plants: bed, position along it, side
const TOMS = [];
for (const [b, n] of [[0, 6], [2, 5]]) for (let i = 0; i < n; i++) { const B = BEDS[b]; TOMS.push([B[0] + (i % 2 ? 0.13 : -0.13), B[1] - B[3] / 2 + 0.5 + i * (B[3] - 1) / (n - 1), B[4] - 0.06, TOMS.length]); }
// gravel paths: polylines (x, z ...) and half width
// the patio (paved: see the ground shader): polylines and half width
const PATHS = [[[4.6, -8.6, 4.6, 3.9], 0.68], [[-5.2, 3.95, 5.2, 3.95], 0.55]];
const PAVERS = [];
// what the camera can't enter: x0, x1, z0, z1, top (beds, pots, the worm bin)
const COL = new Float64Array((BEDS.length + POTS.length + 2) * 5);
{
  let k = 0;
  for (const b of BEDS) { COL[k++] = b[0] - b[2] / 2; COL[k++] = b[0] + b[2] / 2; COL[k++] = b[1] - b[3] / 2; COL[k++] = b[1] + b[3] / 2; COL[k++] = b[4]; }
  for (const p of POTS) { COL[k++] = p[0] - p[2]; COL[k++] = p[0] + p[2]; COL[k++] = p[1] - p[2]; COL[k++] = p[1] + p[2]; COL[k++] = p[3] + (onDeck(p[0], p[1]) ? DECK[4] : 0); }
  for (let q = 0; q < 5; q++) COL[k++] = DECK[q];
  COL[k++] = BIN[0] - 0.25; COL[k++] = BIN[0] + 0.25; COL[k++] = BIN[1] - 0.25; COL[k++] = BIN[1] + 0.25; COL[k++] = 0.75;
}
const segD = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, h = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1); return hypot(x - ax - dx * h, z - az - dz * h); };
const pathAt = (x, z) => { let m = 0; for (const [p, w] of PATHS) for (let i = 0; i < p.length - 2; i += 2) m = max(m, sstep(w + 0.035, w - 0.035, segD(x, z, p[i], p[i + 1], p[i + 2], p[i + 3]) + (fbm(x * 2.1, 2, z * 2.1, 2) - 0.5) * 0.1)); return m; };
// distance outside a rectangle (0 inside)
const boxD = (x, z, cx, cz, hx, hz) => hypot(max(abs(x - cx) - hx, 0), max(abs(z - cz) - hz, 0));
// the yard is two lots wide: its side fences stand on the lot lines, x = ±YX
const YX = LOTW / 2;
const inYard = (x, z) => abs(x) < YX && abs(z) < 9;
// the ground rolls a few centimetres; soil in a bed is mounded and raked
// (the noise is read along slanted planes, so its lattice does not show up as squares in low sunlight)
const gh = (x, z) => (fbm(x * 0.29 + z * 0.2, x * 0.13 - z * 0.11, z * 0.29 - x * 0.2, 3) - 0.5) * 0.05 + (fbm(x * 1.5 + z * 1.1, x * 0.7 - z * 0.9, z * 1.5 - x * 1.1, 2) - 0.5) * 0.006;
const soilH = (b, x, z) => b[4] - 0.075 + (fbm(x * 1.3, 5, z * 1.3, 3) - 0.5) * 0.07 + (fbm(x * 6, 7, z * 6, 2) - 0.5) * 0.02 - 0.03 * sstep(0.12, 0, min(b[2] / 2 - abs(x - b[0]), b[3] / 2 - abs(z - b[1])));
// is (x, z) taken by a bed, pot, the bin or a paver? (margin m)
const taken = (x, z, m = 0) => {
  for (const b of BEDS) if (abs(x - b[0]) < b[2] / 2 + m && abs(z - b[1]) < b[3] / 2 + m) return true;
  for (const p of POTS) if (hypot(x - p[0], z - p[1]) < p[2] * 0.75 + m) return true;
  for (const p of PAVERS) if (abs(x - p[0]) < 0.23 + m && abs(z - p[1]) < 0.23 + m) return true;
  return hypot(x - BIN[0], z - BIN[1]) < 0.27 + m || z > 4.4;   // (the deck, the house)
};

// ---------------------------------------------------------------- ground mesh: grid patches sorted into the culling grid
function buildTerrain() {
  const P = [], Q = [];
  const patch = (x0, z0, x1, z1, st, h, soil) => {
    const nx = Math.ceil((x1 - x0) / st), nz = Math.ceil((z1 - z0) / st), o = P.length / 7, e = st * 0.5;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz;
      const dx = h(x + e, z) - h(x - e, z), dz = h(x, z + e) - h(x, z - e), l = hypot(dx, 2 * e, dz);
      P.push(x, h(x, z), z, -dx / l, 2 * e / l, -dz / l, soil);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = o + i + (nx + 1) * j; Q.push(a, a + nx + 1, a + nx + 2, a + 1); }
  };
  patch(-32, -32, 32, 32, 1.6, (x, z) => HT(x, z) + gh(x, z) - 0.05, 0);                     // the neighbourhood, coarse
  patch(-YX - 0.3, -9.3, YX + 0.3, 9.3, LV > 1 ? 0.12 : 0.06, gh, 0);                        // the yard
  for (const b of BEDS) patch(b[0] - b[2] / 2 + 0.03, b[1] - b[3] / 2 + 0.03, b[0] + b[2] / 2 - 0.03, b[1] + b[3] / 2 - 0.03, 0.035, (x, z) => soilH(b, x, z), 1);
  const nv = P.length / 7, vb = new ArrayBuffer(nv * 16), vf = new Float32Array(vb), v8 = new Int8Array(vb);
  for (let k = 0; k < nv; k++) {
    vf[k * 4] = P[k * 7]; vf[k * 4 + 1] = P[k * 7 + 1]; vf[k * 4 + 2] = P[k * 7 + 2];
    v8[k * 16 + 12] = round(P[k * 7 + 3] * 127); v8[k * 16 + 13] = round(P[k * 7 + 4] * 127); v8[k * 16 + 14] = round(P[k * 7 + 5] * 127); v8[k * 16 + 15] = P[k * 7 + 6] * 127;
  }
  const nq = Q.length / 4, nC = CELLS * CELLS, key = new Uint16Array(nq), cnt = new Uint32Array(nC + 1);
  const lo = new Float32Array(nC).fill(1e9), hi = new Float32Array(nC).fill(-1e9);
  for (let q = 0; q < nq; q++) {
    const a = Q[q * 4] * 7, c = clamp(floor((P[a] - OX) / CELLW), 0, CELLS - 1) + CELLS * clamp(floor((P[a + 2] - OZ) / CELLW), 0, CELLS - 1);
    key[q] = c; cnt[c + 1]++;
    for (let j = 0; j < 4; j++) { const y = P[Q[q * 4 + j] * 7 + 1]; if (y < lo[c]) lo[c] = y; if (y > hi[c]) hi[c] = y; }
  }
  for (let c = 0; c < nC; c++) cnt[c + 1] += cnt[c];
  const ib = new Uint32Array(nq * 6), fill = cnt.slice();
  for (let q = 0; q < nq; q++) { const o = fill[key[q]]++ * 6, a = Q[q * 4], b = Q[q * 4 + 1], c = Q[q * 4 + 2], d = Q[q * 4 + 3]; ib[o] = a; ib[o + 1] = b; ib[o + 2] = c; ib[o + 3] = a; ib[o + 4] = c; ib[o + 5] = d; }
  return { vb, ib, nv, start: cnt, lo, hi };
}

// ---------------------------------------------------------------- procedural meshes
// mesh ids. 0-11 are built in place (one instance each), the rest are instanced
const M_HGLASS = 8, M_FENCE = 0, M_BEDS = 1, M_STAKES = 2, M_DRIP = 3, M_BIN = 4, M_STONE = 5, M_WALLS = 6, M_GLASS = 10, M_TRIM = 11,
  M_POT = 12, M_SEG = 13, M_TOM = 14, M_ZUC = 15, M_BER = 16, M_BLOB = 17, M_SOIL = 18, M_METAL = 19, M_POLE = 20, NSOL = 21,
  M_CHIP = 21, M_CAT = 25, M_BIRD = 26;
// material + seed (its whole part is the kind) of the meshes built in place
const STATIC = [[2, 0.3], [3, 0.2], [3, 0.7], [5, 0.2], [5, 0.8], [16, 0.4], [10, 0.5], [22, 0.5], [11, 0.5], [10, 3.5], [11, 0.5], [12, 0.5], , , , , , , , [14, 0.5], [12, 0.1]];
const vAdd = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const vNrm = (v) => { const l = hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const vCrs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// everything added inside f() becomes one board: its vertex code says which way the grain runs (0 x, 1 y, 2 z) and which board it is
const wood = (m, ax, f) => { const n = m.aux.length; f(); const c = ((rnd() * 42 | 0) * 3 + ax) / 127; for (let k = n; k < m.aux.length; k++) m.aux[k] = c; };
const aux = (m, a, f) => { const n = m.aux.length; f(); for (let k = n; k < m.aux.length; k++) m.aux[k] = a; };
const box = (m, x0, y0, z0, x1, y1, z1) => m.sweep([[x0, (y0 + y1) / 2, (z0 + z1) / 2], [x1, (y0 + y1) / 2, (z0 + z1) / 2]], z1 - z0, y1 - y0, () => [0, 1, 0]);
const lathe = (m, prof, seg, fn) => {
  const rings = prof.map(([r, y, ao = 1]) => { const ring = []; for (let s = 0; s < seg; s++) { const a = s / seg * TAU, q = fn ? fn(a, y) : 1; ring.push(m.v(cos(a) * r * q, y, sin(a) * r * q, ao)); } return ring; });
  for (let k = 0; k < rings.length - 1; k++) for (let s = 0; s < seg; s++) { const s2 = (s + 1) % seg; m.quad(rings[k][s], rings[k + 1][s], rings[k + 1][s2], rings[k][s2]); }
};
// a pipe with rounded corners through pts
const pipe = (m, pts, r, sides = 6) => {
  const o = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1], la = hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), lc = hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]), e = min(0.04, la * 0.45, lc * 0.45);
    const p0 = vAdd(b, vNrm(vAdd(a, b, -1)), e), p1 = vAdd(b, vNrm(vAdd(c, b, -1)), e);
    for (let k = 0; k <= 3; k++) { const t = k / 3, u = 1 - t; o.push([u * u * p0[0] + 2 * u * t * b[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * b[1] + t * t * p1[1], u * u * p0[2] + 2 * u * t * b[2] + t * t * p1[2]]); }
  }
  o.push(pts[pts.length - 1]);
  m.tube(o, r, sides, true, () => 1);
};

// the fences: posts, rails, plain boards up to the cap. (They had a strip of diagonal lattice and a flat cap
function meshFence() {
  rseed(300); const m = new Mesh();
  // one run from (x0, z0) along (dx, dz); (ix, iz) points into the yard
  const run = (x0, z0, dx, dz, len, ix, iz) => {
    const ax = dx ? 0 : 2, P = (s, y, o = 0) => [x0 + dx * s + ix * o, y, z0 + dz * s + iz * o], nrm = () => [ix, 0, iz], up = () => [0, 1, 0];
    let nb = 0;
    for (let s = 0.02; s < len - 0.1;) {
      const w = rr(0.135, 0.145), dh = rr(-0.004, 0.004);
      // each board is set a hair in or out; a dark backing shows in the gaps, so no light flickers through
      const o = (nb++ % 2 ? 0.0025 : -0.0025) + rr(-0.001, 0.001);
      wood(m, 1, () => m.sweep([P(s + w / 2, 0.04, o), P(s + w / 2, FTOP - 0.06 + dh, o)], w, 0.019, nrm));
      s += w + 0.006;
    }
    aux(m, 126 / 127, () => m.sweep([P(0, 0.93, -0.011), P(len, 0.93, -0.011)], 1.76, 0.004, nrm));
    for (let s = 0; s <= len + 0.01; s += len / round(len / 2.4)) {
      wood(m, 1, () => m.sweep([P(s, 0, 0.056), P(s, FTOP - 0.02, 0.056)], 0.09, 0.09, nrm));
    }
    for (const y of [0.38, 1.5]) wood(m, ax, () => m.sweep([P(0, y, 0.03), P(len, y, 0.03)], 0.04, 0.09, up));
    wood(m, ax, () => m.sweep([P(-0.06, FTOP, 0), P(len + 0.06, FTOP, 0)], 0.15, 0.04, up));
  };
  run(-YX, -9, 1, 0, 2 * YX, 0, 1); run(-YX, -9, 0, 1, 19.15, 1, 0); run(YX, -9, 0, 1, 14.6, -1, 0);
  // (the neighbours' lots have fences of their own: see FENCE in city.js)
  return m;
}
// raised beds: two courses of boards, corner posts and a flat rail to sit on
function meshBeds() {
  rseed(310); const m = new Mesh(), up = () => [0, 1, 0];
  for (const [cx, cz, sx, sz, h] of BEDS) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, ch = (h - 0.03) / 2;
    for (let c = 0; c < 2; c++) {
      const y = ch * (c + 0.5);
      for (const x of [x0, x1]) wood(m, 2, () => m.sweep([[x, y, z0 - 0.02], [x, y, z1 + 0.02]], 0.04, ch - 0.004, up));
      for (const z of [z0, z1]) wood(m, 0, () => m.sweep([[x0 + 0.02, y, z], [x1 - 0.02, y, z]], 0.04, ch - 0.004, up));
    }
    for (const x of [x0 + 0.065, x1 - 0.065]) for (const z of [z0 + 0.065, z1 - 0.065]) wood(m, 1, () => m.sweep([[x, 0, z], [x, h - 0.03, z]], 0.09, 0.09, () => [1, 0, 0]));
    for (const x of [x0, x1]) wood(m, 2, () => m.sweep([[x, h - 0.015, z0 - 0.07], [x, h - 0.015, z1 + 0.07]], 0.13, 0.03, up));
    for (const z of [z0, z1]) wood(m, 0, () => m.sweep([[x0 + 0.065, h - 0.015, z], [x1 - 0.065, h - 0.015, z]], 0.13, 0.03, up));
  }
  return m;
}
const stakeAt = (t) => [t[0] + 0.06, t[1] + 0.035];
function meshStakes() {
  rseed(320); const m = new Mesh();
  for (const t of TOMS) { const [x, z] = stakeAt(t); wood(m, 1, () => m.sweep([[x, t[2] - 0.3, z], [x + rr(-0.03, 0.03), t[2] + 1.72, z + rr(-0.03, 0.03)]], 0.026, 0.026, () => [1, 0, 0.3])); }
  // the deck across the back of the house: boards along x on a frame, a step down to the patio
  // (behind the bedroom that juts out, and round the kitchen door, but not over the window well: see home.js)
  for (const [x0, x1, z0, z1] of [[DECK[0], DECK[1], DECK[2], HAZ], [DECK[0], WELL[0], HAZ, DECK[3]], [WELL[2], HAX, HAZ, DECK[3]], [WELL[0], WELL[2], HAZ, WELL[1]]]) {
    for (let x = DECK[0] + 0.03; x < x1 - 0.05; x += 0.15) { const a = max(x, x0), b = min(x + 0.14, x1); if (b - a > 0.02) wood(m, 2, () => box(m, a, DECK[4] - 0.06, z0, b, DECK[4], z1 === DECK[3] ? z1 - 0.05 : z1)); }
    wood(m, 0, () => box(m, x0 + (x0 === DECK[0] ? 0.02 : 0), -0.1, z0 - (z0 === DECK[2] ? 0.02 : 0), x1, DECK[4] - 0.06, z1));
  }
  wood(m, 0, () => box(m, DECK[0] + 0.03, -0.05, DECK[2] - 0.3, DECK[1] - 0.03, 0.14, DECK[2]));
  // plant labels in the herb bed
  const B = BEDS[3];
  for (let i = 0; i < 6; i++) { const x = B[0] + (i % 2 ? 0.42 : -0.42), z = B[1] - 0.85 + (i >> 1) * 0.85, y = B[4] - 0.08; wood(m, 1, () => m.sweep([[x, y, z], [x + 0.01, y + 0.13, z + 0.01]], 0.022, 0.003, () => [1, 0, 0])); }
  return m;
}
// drip irrigation: where each line runs (also used to place emitters, falling drops and damp soil)
const EMIT = [];
function meshDrip() {
  rseed(330); const m = new Mesh(), g = 0.014;
  const wig = (pts, a = 0.012) => pts.map((p, i) => i && i < pts.length - 1 ? [p[0] + rr(-a, a), p[1], p[2] + rr(-a, a)] : p);
  const emit = (x, y, z) => { m.tube([[x, y - 0.02, z], [x, y + 0.045, z]], 0.004, 5, true, () => 1); m.tube([[x - 0.03, y + 0.004, z], [x, y + 0.03, z], [x, y + 0.05, z]], 0.0035, 5, true, () => 1); m.tube([[x, y + 0.04, z], [x, y + 0.07, z]], 0.016, 8, true, () => 1); EMIT.push([x, y + 0.04, z]); };
  // main line: from the tap on the house wall, along the left fence, then along the back fence
  pipe(m, [[-4.9, 0.62, 10.05], [-4.9, 0.62, 9.97], [-4.9, g, 9.93], [-YX + 0.32, g, 4.4], [-YX + 0.3, g, -7.95], [YX - 0.4, g, -8.0], [YX - 0.28, g, -7.6]], 0.014, 8);
  box(m, -4.96, 0.5, 9.98, -4.84, 0.68, 10.08);
  const line = (b, from, n) => {
    // up the side of the bed, over the rail, then along the soil with an emitter at every plant
    const B = BEDS[b], y = B[4], pts = [from, [from[0], g, B[1] - B[3] / 2 - 0.09], [from[0], y + 0.012, B[1] - B[3] / 2 - 0.09], [from[0], y + 0.012, B[1] - B[3] / 2 + 0.09]];
    for (let i = 0; i <= n; i++) { const z = B[1] - B[3] / 2 + 0.2 + i * (B[3] - 0.5) / n, x = B[0] + (i ? rr(-0.04, 0.04) : 0); pts.push([x, soilH(B, x, z) + 0.006, z]); }
    pipe(m, wig(pts, 0.006), 0.0085, 6);
  };
  line(0, [BEDS[0][0], g, -7.95], 14); line(1, [BEDS[1][0] + 0.3, g, -7.98], 8); line(2, [BEDS[2][0] - 0.3, g, -7.99], 10);
  for (const t of TOMS) emit(t[0] + 0.05, soilH(BEDS[t[3] < 6 ? 0 : 2], t[0], t[1]) + 0.012, t[1] - 0.06);
  for (let i = 0; i < 3; i++) emit(0.5 + 0.04, soilH(BEDS[1], 0.5, -5.6 + i), -5.6 + i + 0.08);
  {
    // herb bed: its line comes up out of the path
    for (const B of [BEDS[3], BEDS[4]]) { const pts = [[B[0], 0.005, B[1] - B[3] / 2 - 0.09], [B[0], B[4] + 0.012, B[1] - B[3] / 2 - 0.09], [B[0], B[4] + 0.012, B[1] - B[3] / 2 + 0.09]];
    for (let i = 0; i <= 6; i++) { const z = B[1] - B[3] / 2 + 0.2 + i * (B[3] - 0.45) / 6; pts.push([B[0] + rr(-0.03, 0.03), soilH(B, B[0], z) + 0.006, z]); if (i % 2 === 0) emit(B[0] + 0.03, soilH(B, B[0], z) + 0.012, z + 0.04); }
    pipe(m, wig(pts, 0.006), 0.0085, 6); }
  }
  for (const p of POTS) if (p[0] > 4 && !p[5]) {
    // a thin tube up the side of each blueberry pot
    const x = p[0] + p[2] * 0.97, y = p[3];
    pipe(m, wig([[YX - 0.3, 0.01, p[1] + 0.3], [x + 0.12, 0.008, p[1] + 0.08], [x + 0.01, 0.01, p[1]], [x + 0.005, y + 0.01, p[1]], [x - 0.07, y + 0.012, p[1]], [p[0] + 0.09, y - 0.035, p[1] + 0.02]], 0.004), 0.0085, 6);
    emit(p[0] + 0.09, y - 0.03, p[1] + 0.02);
  }
  return m;
}
// stacked-tray worm bin on legs, with a pitched lid and a tap
function meshBin() {
  rseed(340); const m = new Mesh(), [x, z, yaw] = BIN, c = cos(yaw), s = sin(yaw), R = (a, y, b) => [x + a * c + b * s, y, z - a * s + b * c], u = () => [c, 0, -s];
  for (const a of [-0.17, 0.17]) for (const b of [-0.17, 0.17]) m.sweep([R(a, 0, b), R(a * 0.94, 0.15, b * 0.94)], 0.04, 0.04, u);
  m.sweep([R(0, 0.13, 0), R(0, 0.25, 0)], (k) => 0.4 + k * 0.03, (k) => 0.4 + k * 0.03, u);
  for (let i = 0; i < 3; i++) { const y = 0.255 + i * 0.135; m.sweep([R(0, y, 0), R(0, y + 0.105, 0), R(0, y + 0.107, 0), R(0, y + 0.13, 0)], (k) => [0.4, 0.425, 0.45, 0.45][k], (k) => [0.4, 0.425, 0.45, 0.45][k], u); }
  m.sweep([R(0, 0.66, 0), R(0, 0.685, 0), R(0, 0.75, 0)], (k) => [0.47, 0.47, 0.16][k], (k) => [0.47, 0.47, 0.16][k], u);
  m.sweep([R(0, 0.745, 0), R(0, 0.775, 0)], 0.1, 0.03, u);
  m.tube([R(0, 0.17, 0.2), R(0, 0.17, 0.25), R(0, 0.14, 0.262)], 0.012, 7, true, () => 1);
  // a garden hose coiled by the tap
  { const pts = []; for (let i = 0; i <= 150; i++) { const a = i * 0.21, r = 0.3 - 0.0006 * i + 0.012 * sin(i * 1.7); pts.push([-4.4 + cos(a) * r, 0.022 + i * 0.0007 + 0.006 * sin(i * 0.9), 3.75 + sin(a) * r * 0.9]); } pts.push([-4.85, 0.02, 4.1], [-5.0, 0.02, 4.4]); m.tube(pts, 0.011, 6, true, () => 1); }
  return m;
}
// stepping stones, the door step and the foot of the house wall
function meshStone() {
  rseed(350); const m = new Mesh();
  for (const [x, z, a] of PAVERS) { const c = cos(a) * 0.23, s = sin(a) * 0.23, y = gh(x, z) + 0.012; m.sweep([[x - c, y + rr(-0.004, 0.004), z - s], [x + c, y + rr(-0.004, 0.004), z + s]], 0.46, 0.045, () => [0, 1, 0]); }
  return m;
}
// builders shared by every house: windows go into the glass mesh G, their frames and the roofs into the trim mesh T
const houseKit = (G, T) => {
  // a window on a wall facing (nx, nz): centre, size
  const win = (x, y, z, w, h, nx, nz, lit) => {
    const tx = -nz, tz = nx, e = 0.03;
    aux(G, lit, () => G.sweep([[x - tx * w / 2 + nx * e, y, z - tz * w / 2 + nz * e], [x + tx * w / 2 + nx * e, y, z + tz * w / 2 + nz * e]], 0.03, h, () => [0, 1, 0]));
    aux(T, 1, () => {
      for (const s of [-1, 1]) T.sweep([[x + tx * s * (w / 2 + 0.04) + nx * e, y - h / 2 - 0.08, z + tz * s * (w / 2 + 0.04) + nz * e], [x + tx * s * (w / 2 + 0.04) + nx * e, y + h / 2 + 0.08, z + tz * s * (w / 2 + 0.04) + nz * e]], 0.09, 0.07, () => [nx, 0, nz]);
      for (const s of [-1, 1]) T.sweep([[x - tx * (w / 2 + 0.1) + nx * e, y + s * (h / 2 + 0.045), z - tz * (w / 2 + 0.1) + nz * e], [x + tx * (w / 2 + 0.1) + nx * e, y + s * (h / 2 + 0.045), z + tz * (w / 2 + 0.1) + nz * e]], 0.08, 0.09, () => [0, 1, 0]);
    });
  };
  // a roof with its ridge along z (or x): two slabs
  const roof = (x0, x1, z0, z1, y, rise, alongZ) => aux(T, 0, () => {
    if (alongZ) { const xm = (x0 + x1) / 2, w = hypot((x1 - x0) / 2 + 0.3, rise); for (const s of [-1, 1]) { const n = vNrm([s * rise, (x1 - x0) / 2, 0]); T.sweep([[xm + s * (x1 - x0) / 4, y + rise / 2, z0 - 0.3], [xm + s * (x1 - x0) / 4, y + rise / 2, z1 + 0.3]], w, 0.14, () => n); } }
    else { const zm = (z0 + z1) / 2, w = hypot((z1 - z0) / 2 + 0.3, rise); for (const s of [-1, 1]) { const n = vNrm([0, (z1 - z0) / 2, s * rise]); T.sweep([[x0 - 0.3, y + rise / 2, zm + s * (z1 - z0) / 4], [x1 + 0.3, y + rise / 2, zm + s * (z1 - z0) / 4]], w, 0.14, () => n); } }
  });
  const gable = (m, x0, x1, z, y, rise) => { const a = m.v(x0, y, z), b = m.v(x1, y, z), c = m.v((x0 + x1) / 2, y + rise, z); m.tri(a, b, c); };
  return { win, roof, gable };
};
// the houses around the yard, as [walls, walls, walls, walls, glass, trim + roofs]. Lit windows carry aux 1
function meshHouses() {
  rseed(360);
  const W = [new Mesh(), new Mesh(), new Mesh(), new Mesh()], G = new Mesh(), T = new Mesh();

  // our house, inside and out: see home.js. W[1] is its inside (material 22)
  buildHome(W[0], T, W[1], W[2]);   // (W[2]: its window glass, drawn on its own: see pGlass in main.js)
  return [...W, G, T];
}
// utility pole with a crossarm and sagging wires
function meshPole() {
  const m = new Mesh(), x = 8.6, z = -10.4;
  aux(m, 0, () => {
    // dark boards behind the fences, so the gaps between planks are seams and not slits of light
    box(m, -YX, 0.05, -9.018, YX, 1.8, -9.012); box(m, -YX - 0.018, 0.05, -9, -YX - 0.012, 1.8, 10.15); box(m, YX + 0.012, 0.05, -9, YX + 0.018, 1.8, 5.6);
    m.tube([[x, -0.2, z], [x + 0.05, 9.6, z]], (k) => 0.13 - k * 0.03, 8);
    m.sweep([[x - 1.2, 8.9, z], [x + 1.3, 8.9, z]], 0.1, 0.12, () => [0, 1, 0]);
    for (const [ox, y, tx, ty, tz] of [[-1.1, 8.98, -34, 8.4, -13], [0, 8.98, -34, 8.6, -13.4], [1.2, 8.98, -34, 8.2, -12.6], [0.05, 7.6, 9, 7.4, 2]]) {
      const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([mix(x + ox, tx, t), mix(y, ty, t) - 4 * t * (1 - t) * (tx < 0 ? 1.4 : 0.35), mix(z, tz, t)]); }
      m.tube(pts, 0.011, 4, false);
    }
  });
  return m;
}
const meshPot = () => { const m = new Mesh(); lathe(m, [[0, 0.02, 0.6], [0.6, 0.0, 0.7], [0.66, 0.03, 0.8], [0.96, 0.88, 1], [1.04, 0.885, 1], [1.05, 1.0, 1], [0.97, 1.0, 0.8], [0.93, 0.9, 0.35], [0.9, 0.87, 0.15]], LV > 1 ? 24 : 48); return m; };
const meshSoil = () => { const m = new Mesh(), c = m.v(0, 0.02, 0, 1), n = 20, r = []; for (let s = 0; s < n; s++) { const a = s / n * TAU; r.push(m.v(cos(a), 0, sin(a), 1)); } for (let s = 0; s < n; s++) m.tri(c, r[(s + 1) % n], r[s]); return m; };
// one piece of stem: along +y from 0 to 1, radius 1
const meshSeg = () => { const m = new Mesh(); lathe(m, [[1, 0], [0.98, 0.5], [0.96, 0.99], [0.95, 1.0], [0, 1.03]], LV > 1 ? 5 : 7); return m; };
// heirloom tomato: squat, ribbed, hanging from its stem end at the origin
const meshTomato = () => icosphere(2, (x, y, z) => {
  const a = atan2(z, x), q = sqrt(max(1 - y * y, 0)), rib = 1 + 0.1 * cos(a * 6 + 0.6 * sin(a * 2)) * q * (0.4 + 0.6 * sstep(-0.6, 0.7, y)) + 0.05 * (fbm(x * 1.5, y * 1.5, z * 1.5, 2) - 0.5);
  return [x * rib, (y - 0.3 * sstep(0.6, 1, y)) * 0.93 - 0.65, z * rib];
});
// zucchini: along +y from the stem end at the origin, 1 long
const meshZuc = () => { const m = new Mesh(); lathe(m, [[0, -0.01], [0.045, 0], [0.085, 0.05], [0.1, 0.2], [0.112, 0.5], [0.118, 0.78], [0.105, 0.92], [0.07, 0.985], [0, 1]], 14, (a) => 1 + 0.035 * cos(a * 5)); return m; };
const meshBerry = () => icosphere(LV > 1 ? 1 : 2, (x, y, z) => { const c = sstep(-0.86, -1, y); return [x * (1 + c * 0.25), y * (1 - c * 0.22) - 1, z * (1 + c * 0.25)]; });
const meshBlob = () => icosphere(3, (x, y, z) => { const r = 1 + (fbm(x * 1.7 + 3, y * 1.7, z * 1.7, 3) - 0.5) * 0.8 + (fbm(x * 5 + 1, y * 5, z * 5, 2) - 0.5) * 0.3; return [x * r, y * r * 0.85, z * r]; });
// mulch chips, pebbles and clods: 0-1 flat splinters, 2 pebble, 3 clod
const meshChip = (k) => { rseed(370 + k); return icosphere(k > 2 && LV < 2 ? 1 : 0, (x, y, z) => { const r = 1 + (fbm(x * 1.6 + k * 9, y * 1.6, z * 1.6, 2) - 0.5) * (k > 2 ? 1.1 : 0.7); return k < 2 ? [x * r * (k ? 1.3 : 1.1), y * r * 0.7, z * r * (k ? 0.9 : 1)] : [x * r, y * r * (k > 2 ? 0.45 : 0.6), z * r * 0.8]; }); };
// a small bird: body along +x, wings along ±z (aux = how far out the wing a vertex is)
function meshBird() {
  const m = icosphere(1, (x, y, z) => [x * 0.5 + 0.08 * x * x, y * 0.13, z * 0.13]);
  for (const s of [-1, 1]) { const a = m.v(0.16, 0.02, s * 0.08, 0), b = m.v(-0.18, 0.02, s * 0.08, 0), c = m.v(-0.14, 0.02, s, s), d = m.v(0.04, 0.02, s * 0.9, s * 0.9); m.quad(a, b, c, d); }
  const a = m.v(-0.4, 0, 0, 0), b = m.v(-0.68, 0, 0.12, 0), c = m.v(-0.68, 0, -0.12, 0); m.tri(a, b, c);
  return m;
}
// the cat, sitting in profile (+x ahead) with its tail lying along the fence cap behind it: tapered capsules blended
// into one surface. Vertex aux: > 0 along the tail, < 0 how much the vertex turns with the head
function meshCat() {
  const C = [], S = (z) => [z, -z];
  const cap = (a, b, kind = 0) => C.push([...a, ...b, kind]);
  cap([-0.075, 0.1, 0, 0.09], [0.04, 0.2, 0, 0.072]); cap([0.05, 0.2, 0, 0.065], [0.07, 0.25, 0, 0.052]); cap([0.07, 0.25, 0, 0.05], [0.085, 0.3, 0, 0.047]);
  cap([0.092, 0.335, 0, 0.054], [0.105, 0.338, 0, 0.05]); cap([0.13, 0.322, 0, 0.03], [0.15, 0.318, 0, 0.021]);
  for (const s of [1, -1]) {
    cap([-0.06, 0.07, s * 0.055, 0.064], [-0.03, 0.06, s * 0.06, 0.055]); cap([0.085, 0.37, s * 0.03, 0.018], [0.079, 0.417, s * 0.042, 0.004]);
    cap([0.07, 0.19, s * 0.03, 0.027], [0.085, 0.03, s * 0.03, 0.02]); cap([0.085, 0.016, s * 0.03, 0.02], [0.108, 0.014, s * 0.03, 0.018]);
    cap([-0.03, 0.018, s * 0.062, 0.022], [0.035, 0.014, s * 0.064, 0.018]);
  }
  const TL = [[-0.13, 0.06, 0, 0.025], [-0.185, 0.03, 0.02, 0.023], [-0.25, 0.024, 0.036, 0.022], [-0.31, 0.023, 0.026, 0.021], [-0.365, 0.024, 0, 0.02], [-0.405, 0.03, -0.028, 0.019], [-0.425, 0.05, -0.045, 0.016]];
  for (let i = 0; i < 6; i++) cap(TL[i], TL[i + 1], 1 + i);
  let tailK = 0;
  const sdf = (x, y, z) => {
    let d = 1e9, best = 1e9;
    for (const c of C) {
      const bax = c[4] - c[0], bay = c[5] - c[1], baz = c[6] - c[2], pax = x - c[0], pay = y - c[1], paz = z - c[2];
      const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
      const e = hypot(pax - bax * h, pay - bay * h, paz - baz * h) - mix(c[3], c[7], h);
      if (e < best) { best = e; tailK = c[8] ? (c[8] - 1 + h) / 6 : 0; }
      const k = 0.022, hh = max(k - abs(d - e), 0) / k;
      d = min(d, e) - hh * hh * k * 0.25;
    }
    return d;
  };
  const vs = LV > 1 ? 0.008 : 0.005, ox = -0.47, oy = -0.03, oz = -0.11, nx = Math.ceil(0.66 / vs), ny = Math.ceil(0.48 / vs), nz = Math.ceil(0.23 / vs), D = new Float32Array(nx * ny * nz);
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) D[x + nx * (y + ny * z)] = -sdf(ox + x * vs, oy + y * vs, oz + z * vs);
  const sn = surfaceNets(D, nx, ny, nz), smp = sampler3(D, nx, ny, nz);
  const vb = new ArrayBuffer(sn.nv * 16), f = new Float32Array(vb), s = new Int8Array(vb);
  for (let k = 0; k < sn.nv; k++) {
    const x = sn.pos[k * 3], y = sn.pos[k * 3 + 1], z = sn.pos[k * 3 + 2], e = 0.7;
    const ax = smp(x - e, y, z) - smp(x + e, y, z), ay = smp(x, y - e, z) - smp(x, y + e, z), az = smp(x, y, z - e) - smp(x, y, z + e), l = hypot(ax, ay, az) || 1;
    const X = ox + x * vs, Y = oy + y * vs, Z = oz + z * vs;
    sdf(X, Y, Z);
    f[k * 4] = X; f[k * 4 + 1] = Y; f[k * 4 + 2] = Z;
    s[k * 16 + 12] = round(ax / l * 127); s[k * 16 + 13] = round(ay / l * 127); s[k * 16 + 14] = round(az / l * 127);
    s[k * 16 + 15] = round((tailK > 0 ? max(tailK, 0.01) : -sstep(0.265, 0.305, Y)) * 127);
  }
  return { vb, ib: new Uint32Array(sn.idx), nv: sn.nv };
}
function buildMeshes() {
  const H = meshHouses();
  const m = [meshFence(), meshBeds(), meshStakes(), meshDrip(), meshBin(), meshStone(), H[0], H[1], H[2], H[3], H[4], H[5],
    meshPot(), meshSeg(), meshTomato(), meshZuc(), meshBerry(), meshBlob(), meshSoil(), null, meshPole(),
    meshChip(0), meshChip(1), meshChip(2), meshChip(3)].map((x) => x ? x.build() : { vb: new ArrayBuffer(0), ib: new Uint32Array(0), nv: 0 });
  // the tap on the house wall
  { const t = new Mesh(); t.tube([[-4.9, 0.62, 10.15], [-4.9, 0.62, 10.05]], 0.014, 8); t.tube([[-4.9, 0.66, 10.07], [-4.9, 0.7, 10.07]], 0.03, 8);
    // a metal trellis in front of the sliding door, for a climbing rose
    for (const x of [1.45, 2.4, 3.35]) t.tube([[x, 0.3, 5.42], [x, 2.75, 5.42]], 0.012, 5);
    for (const y of [0.9, 1.6, 2.3]) t.tube([[1.25, y, 5.42], [3.55, y, 5.42]], 0.01, 5); m[M_METAL] = t.build(); }
  m.push(meshCat(), meshBird().build());
  return m;
}

// ---------------------------------------------------------------- everything that is placed: plants, clutter, dew, fog
function makeWorld() {
  const nCells = CELLS * CELLS;
  const cellOf = (x, z) => clamp(floor((x - OX) / CELLW), 0, CELLS - 1) + CELLS * clamp(floor((z - OZ) / CELLW), 0, CELLS - 1);
  const big = Array.from({ length: nCells }, () => []), small = Array.from({ length: nCells }, () => []);
  const chunks = Array.from({ length: NCHUNK }, () => Array.from({ length: nCells }, () => []));
  const solids = [], glints = [], drops = [], shade = [];
  const Z4 = [0, 0, 0, 0];
  // growth timing of a part, see gro() in shaders.js: born at t0, full size dur later (in seasons: 0 seedling .. 1 harvest)
  const pk = (t0, dur) => max(1, round(dur * 64)) + clamp(t0, 0, 0.995);
  let nth = 0;
  // Medium and Low keep every 2nd / 4th of the leaves there are many of (grass, needles, trees), made wider
  const leaf = (L, p, len, dir, wid, fl, ao, type, s1, bend, an = Z4, t0 = 0, thin = 0) => {
    if (thin && nth++ % THIN) return;
    const l = hypot(dir[0], dir[1], dir[2]) || 1;
    L[cellOf(p[0], p[2])].push(p[0], p[1], p[2], len, atan2(dir[2], dir[0]), Math.acos(clamp(dir[1] / l, -1, 1)), thin ? wid * (1 + LV / 2) : wid,
      floor(clamp(fl, 0, 1.9) * 64) + clamp(ao, 0, 0.99), an[0], an[1], an[2], an[3], type, clamp(s1, 0, 1), clamp(t0, 0, 1), clamp(bend, 0, 1));
  };
  const solid = (mesh, p, sc, q, mat, seed, own = 0, asp = 1, an = Z4, fl = 0) => { (solids[mesh] ||= []).push(p[0], p[1], p[2], sc, q[0], q[1], q[2], q[3], mat + clamp(fl, 0, 1.98) / 2, seed, own, asp, an[0], an[1], an[2], an[3]); };
  // a piece of stem from a to b
  const seg = (a, b, r, kind, own = 0, an = Z4, fl = 0) => { const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = hypot(dx, dy, dz) || 1e-6; solid(M_SEG, a, r, qFromY(dx / l, dy / l, dz / l), 6, kind + rnd() * 0.99, own, l * 1.05 / r, an, fl); };
  // a stem from p along d that bends toward `to` as it goes: n + 1 points over length len
  const arc = (p, d, to, k, n, len, jit = 0) => { const pts = [p]; d = vNrm(d); for (let i = 0; i < n; i++) { d = vNrm([d[0] + to[0] * k + rr(-jit, jit), d[1] + to[1] * k + rr(-jit, jit) * 0.5, d[2] + to[2] * k + rr(-jit, jit)]); p = vAdd(p, d, len / n); pts.push(p); } return pts; };
  // a bead of dew that sparkles, part way along a leaf (the leaf shader's curve, without the wind)
  const dew = (p, dir, len, bend, an, fl, n = 1, sz = 1) => {
    const d = vNrm(dir), st = sqrt(max(1 - d[1] * d[1], 0)), yw = atan2(d[2], d[0]), pe = [d[1] * cos(yw), -st, d[1] * sin(yw)], kq = (bend - 0.3) * 3.4, ka = abs(kq) < 0.06 ? 0.06 : kq;
    for (let i = 0; i < n; i++) { const v = rr(0.3, 1), a = sin(ka * v) / ka, b = (1 - cos(ka * v)) / ka; glints.push(p[0] + len * (d[0] * a + pe[0] * b), p[1] + len * (d[1] * a + pe[1] * b) + 0.002, p[2] + len * (d[2] * a + pe[2] * b), fl, rnd(), rnd(), rr(0.0011, 0.0022) * sz, an[3]); }
  };

  // ---- tomatoes: a vine tied up its stake, a compound leaf at every node, a truss of fruit at every third, a few side shoots
  const cleaf = (p, az, t0, L, aoB, flB) => {
    const an = [p[0], p[1], p[2], pk(t0, 0.11)], roll = rr(-0.6, 0.6), sv = [-sin(az) * cos(roll), sin(roll), cos(az) * cos(roll)], el = rr(0.2, 1.05), droop = rr(0.5, 2.2), curl = rr(-0.22, 0.22), n = 6, pts = [p], dirs = [];
    // the stalk leaves the vine pointing up and out, then arches over
    for (let i = 0, q = p; i < n; i++) { const a = el - droop * pow((i + 0.5) / n, 1.2), zz = az + curl * i, dv = [cos(zz) * cos(a), sin(a), sin(zz) * cos(a)], q2 = vAdd(q, dv, L / n); dirs.push(dv); seg(q, q2, mix(0.0032, 0.0012, i / n) * L / 0.32, 0, an[3], an, flB + 0.5 * (i + 1) / n); q = q2; pts.push(q); }
    // leaflets in pairs, larger toward the tip, small ones between them, and one at the end
    const s1 = rnd();
    const lf = (u, side, sc) => {
      const i = min(floor(u), n - 1), f = min(u - i, 1), a = pts[i], b = pts[i + 1], pp = [mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f)], dv = dirs[i];
      const fw = rr(0.05, 0.75), dd = side ? vNrm([dv[0] * fw + sv[0] * side, dv[1] * fw + sv[1] * side - rr(0.05, 0.6), dv[2] * fw + sv[2] * side]) : dv, l = L * sc * rr(0.6, 1.3), bend = rr(0.36, 0.78), fl = flB + 0.25 + 0.6 * u / n;
      leaf(big, pp, l, dd, l * rr(0.36, 0.46), fl, aoB * mix(0.6, 1, u / n), 0, s1 + rr(-0.12, 0.12), bend, an);
      if (sc > 0.1 && rnd() < 0.5) dew(pp, dd, l * rr(0.5, 0.95), bend, an, fl, 2, rr(0.7, 1.5));
    };
    const np = 3 + (rnd() * 3 | 0), u0 = rr(1.1, 1.9);
    for (let j = 0; j < np; j++) { const u = u0 + j * (5.2 - u0) / (np - 1) + rr(-0.15, 0.15), sc = 0.2 + 0.2 * (j + 1) / np; lf(u, 1, sc); lf(u + rr(-0.25, 0.25), -1, sc * rr(0.7, 1.1)); if (j < np - 1 && rnd() < 0.7) lf(u + 0.48, rnd() < 0.5 ? 1 : -1, rr(0.07, 0.13)); }
    lf(n, 0, 0.42);
  };
  const truss = (p, az, t0, small) => {
    const an = [p[0], p[1], p[2], pk(t0, 0.1)], o = [cos(az), 0, sin(az)], nf = 2 + (rnd() * 3 | 0), pts = arc(p, [o[0], 0.3, o[2]], [0, -1, 0], 0.3, nf + 1, rr(0.2, 0.3));
    for (let i = 0; i < pts.length - 1; i++) seg(pts[i], pts[i + 1], 0.0022, 0, an[3], an, 0.3);
    for (let i = 1; i <= nf; i++) {
      const b = pts[i], s = i % 2 ? 1 : -1, ped = vAdd(b, [-o[2] * s * rr(0.035, 0.055) + rr(-0.01, 0.01), -rr(0.02, 0.045), o[0] * s * rr(0.035, 0.055) + rr(-0.01, 0.01)]);
      seg(b, ped, 0.0016, 0, an[3], an, 0.35);
      const tf = t0 + 0.08 + i * 0.02, R = rr(0.036, 0.055) * small, up = vNrm([rr(-0.25, 0.25), 1, rr(-0.25, 0.25)]);
      solid(M_TOM, ped, R, qMul(qFromY(up[0], up[1], up[2]), qAxis(0, 1, 0, rnd() * TAU)), 7, rnd(), pk(tf, 0.22), 1, an, 0.4);
      for (let j = 0; j < 5; j++) {
        const a = j * TAU / 5 + rnd();
        leaf(big, ped, 0.024 + R * 0.85, [cos(a), rr(-0.2, 0.2), sin(a)], 0.016, 0.4, 0.9, 9, rnd(), rr(0.1, 0.5), an, tf - 0.07);   // calyx
        leaf(big, ped, 0.014, [cos(a + 0.6), -0.3, sin(a + 0.6)], 0.007, 0.4, 1, 8, rnd(), 0.2, an, tf - 0.075);                     // flower
      }
    }
  };
  const tomato = ([bx, bz, , id]) => {
    rseed(400 + id);
    const by = soilH(BEDS[id < 6 ? 0 : 2], bx, bz);
    const [sx, sz] = stakeAt([bx, bz]), N = 22 + (rnd() * 6 | 0), H = rr(1.6, 1.95), a0 = rnd() * TAU, st = H / N, tk = (k) => 0.03 + 0.6 * pow(k / N, 0.85);
    let p = [bx, by - 0.02, bz], d = [0, 1, 0];
    shade.push([bx, bz, 0.55, 0.4]);
    for (let k = 0; k < N; k++) {
      // climb around the stake; past its top the vine flops over
      const h = p[1] - by, over = sstep(1.55, 1.8, h), ph = a0 + h * 2.6, t0 = tk(k);
      d = vNrm([d[0] + (sx + cos(ph) * 0.045 - p[0]) * 2.5 * (1 - over) + rr(-0.12, 0.12) + over * cos(a0) * 0.5, d[1] + 0.6 * (1 - over) - over * 0.35, d[2] + (sz + sin(ph) * 0.045 - p[2]) * 2.5 * (1 - over) + rr(-0.12, 0.12) + over * sin(a0) * 0.5]);
      const q = vAdd(p, d, st * rr(0.85, 1.15)), az = a0 + k * 2.4 + rr(-0.3, 0.3);
      seg(p, q, mix(0.0095, 0.0032, pow(k / N, 0.8)), 0, pk(t0, tk(k + 1) - t0), Z4, 0.05 + 0.3 * k / N);
      if (k % 4 === 2 && h < 1.35) {
        // a loop of twine round the vine and the stake
        const c = [(q[0] + sx) / 2, q[1], (q[2] + sz) / 2], r = hypot(q[0] - sx, q[2] - sz) / 2 + 0.016, own = pk(t0 + 0.06, 0.02);
        for (let j = 0; j < 14; j++) { const a = j * TAU / 14, b = a + TAU / 14; seg([c[0] + cos(a) * r, c[1] + sin(a * 2) * 0.006, c[2] + sin(a) * r], [c[0] + cos(b) * r, c[1] + sin(b * 2) * 0.006, c[2] + sin(b) * r], 0.0024, 3, own); }
      }
      cleaf(q, az, t0 + 0.012, k < 3 ? rr(0.18, 0.26) : rr(0.26, 0.5) * (1 - 0.25 * k / N), mix(0.6, 1, k / N), 0.25);
      if (k > 3 && k % 3 === 1 && k < N - 1) truss(vAdd(p, d, st * 0.5), az + 2.1, t0 + 0.04, mix(1.15, 0.85, k / N));
      if (k > 2 && k < N - 5 && rnd() < 0.75) {
        // a side shoot
        let e = [cos(az + 1) * 0.8, 0.6, sin(az + 1) * 0.8], a = q; const n = 6 + (rnd() * 5 | 0);
        for (let i = 0; i < n; i++) {
          const ti = t0 + 0.1 + i * 0.03; if (ti > 0.97) break;
          e = vNrm([e[0] + rr(-0.15, 0.15), e[1] + 0.22, e[2] + rr(-0.15, 0.15)]); const b = vAdd(a, e, rr(0.06, 0.085));
          seg(a, b, mix(0.005, 0.0025, i / n), 0, pk(ti, 0.03), Z4, 0.3 + 0.4 * i / n); cleaf(b, az + i * 2.4 + rr(-0.3, 0.3), ti + 0.01, rr(0.22, 0.34), 0.8, 0.3);
          if (i === 3 && rnd() < 0.6) truss(b, az + 3, ti + 0.05, 0.85);
          a = b;
        }
      }
      p = q;
    }
  };
  // ---- zucchini: big lobed leaves on long hollow stalks around a short crown, fruit lying out from under them
  const zucchini = (bx, by, bz, id, B1 = BEDS[1]) => {
    rseed(500 + id);
    const a0 = rnd() * TAU, nL = 20 + (rnd() * 5 | 0), cd = [cos(a0), 0.35, sin(a0)], c0 = [bx, by - 0.01, bz];
    shade.push([bx, bz, 0.8, 0.5]);
    for (let i = 0; i < 4; i++) seg(vAdd(c0, cd, i * 0.05), vAdd(c0, cd, (i + 1) * 0.05), 0.016, 1, pk(0.03 + i * 0.15, 0.15));
    for (let i = 0; i < nL; i++) {
      const u = i / nL, t0 = 0.025 + 0.85 * pow(u, 0.9), az = a0 + i * 2.4 + rr(-0.25, 0.25), o = [cos(az), 0, sin(az)], c = vAdd(c0, cd, u * 0.2), an = [c[0], c[1], c[2], pk(t0, 0.22)];
      // older leaves lie low and wide, young ones stand
      const sz = 0.25 + 0.75 * sstep(0, 0.85, u), el = mix(0.62, 1.2, pow(u, 1.3)) + rr(-0.1, 0.1), Lp = mix(0.16, rr(0.42, 0.62), sz);
      const pts = arc(c, [o[0] * cos(el), sin(el), o[2] * cos(el)], [o[0] * 0.5, -0.45, o[2] * 0.5], 0.13, 5, Lp);
      for (let j = 0; j < 5; j++) seg(pts[j], pts[j + 1], mix(0.0085, 0.0055, j / 5) * mix(0.6, 1, sz), 1, an[3], an, 0.15 + 0.5 * (j + 1) / 5);
      // the blade: seven overlapping lobes around the end of the stalk
      const tip = pts[5], S = mix(0.12, rr(0.26, 0.36), sz), s1 = rnd(), ax = vNrm([o[0], rr(-0.4, 0.05), o[2]]), sv = [-o[2], 0, o[0]];
      for (const [ph, ls, ws] of [[0, 1.1, 0.62], [0.72, 0.92, 0.62], [-0.72, 0.92, 0.62], [1.45, 0.74, 0.66], [-1.45, 0.74, 0.66], [2.2, 0.5, 0.8], [-2.2, 0.5, 0.8]]) {
        const dd = [ax[0] * cos(ph) + sv[0] * sin(ph), ax[1] * cos(ph) - abs(sin(ph)) * 0.14, ax[2] * cos(ph) + sv[2] * sin(ph)], l = S * ls * rr(0.92, 1.08), bend = rr(0.36, 0.5);
        leaf(big, tip, l, dd, l * ws, 0.5 + 0.5 * u, mix(0.55, 1, u), 2, s1 + rr(-0.05, 0.05), bend, an);
        dew(tip, dd, l, bend, an, 0.5 + 0.5 * u, 4, 1.3);
      }
    }
    for (let j = 0; j < 7; j++) {
      // fruit lie on the soil, pointing out from the crown
      const tf = 0.3 + j * 0.085 + rr(0, 0.03); if (tf > 0.88) break;
      const az = a0 + 1 + j * 2.1, Lz = rr(0.26, 0.36), h0 = [cos(az), sin(az)], y0 = soilH(B1, c0[0] + h0[0] * 0.28, c0[2] + h0[1] * 0.28) + Lz * 0.085, y1 = soilH(B1, c0[0] + h0[0] * (0.28 + Lz), c0[2] + h0[1] * (0.28 + Lz)) + Lz * 0.1;
      const o = vNrm([h0[0] * Lz, y1 - y0, h0[1] * Lz]), c = [c0[0] + h0[0] * 0.28, y0, c0[2] + h0[1] * 0.28], own = pk(tf, 0.3);
      solid(M_ZUC, c, Lz, qMul(qFromY(o[0], o[1], o[2]), qAxis(0, 1, 0, rnd() * TAU)), 8, rnd(), own, 1);
      // the blossom rides the end of the fruit, then withers
      const tp = vAdd(c, o, Lz), an = [c[0], c[1], c[2], own], w = vNrm(vCrs(o, [0, 1, 0])), v = vCrs(w, o);
      for (let q = 0; q < 5; q++) { const a = q * TAU / 5; leaf(big, tp, 0.11, [o[0] + (w[0] * cos(a) + v[0] * sin(a)) * 0.75, o[1] + (w[1] * cos(a) + v[1] * sin(a)) * 0.75, o[2] + (w[2] * cos(a) + v[2] * sin(a)) * 0.75], 0.07, 0.3, 1, 8, rnd(), 0.55, an, tf + 0.01); }
    }
    for (let j = 0; j < 3; j++) {
      // male flowers on thin stalks
      const tm = 0.3 + j * 0.2, az = a0 + 3 + j * 2.3, pts = arc(c0, [cos(az) * 0.3, 1, sin(az) * 0.3], [0, 1, 0], 0.06, 4, rr(0.3, 0.45)), an = [c0[0], c0[1], c0[2], pk(tm, 0.12)];
      for (let i = 0; i < 4; i++) seg(pts[i], pts[i + 1], 0.003, 1, an[3], an, 0.4);
      for (let q = 0; q < 5; q++) { const a = q * TAU / 5; leaf(big, pts[4], 0.1, [cos(a) * 0.75, 0.9, sin(a) * 0.75], 0.07, 0.5, 1, 8, rnd(), 0.55, an, tm + 0.1); }
    }
  };
  // ---- blueberries: woody canes that fork twice, small oval leaves, clusters of berries
  const blueberry = (bx, by, bz, id, S) => {
    rseed(600 + id);
    shade.push([bx, bz, 0.5, 0.35]);
    const twig = (p, d, len, r, depth) => {
      const n = 3 + depth * 2, pts = arc(p, d, [0, 1, 0], 0.1, n, len, 0.13);
      for (let i = 0; i < n; i++) seg(pts[i], pts[i + 1], r * (1 - 0.45 * i / n), 2, 0, Z4, depth ? 0.1 : 0.35);
      if (depth) for (let b = 0, nb = 4 + (rnd() * 2 | 0); b < nb; b++) {
        const i = b ? 1 + (rnd() * (n - 1) | 0) : n, a = pts[i - 1], e = pts[i], t = vNrm(vAdd(e, a, -1));
        twig(e, b ? [t[0] + rr(-0.9, 0.9), t[1] + rr(-0.2, 0.5), t[2] + rr(-0.9, 0.9)] : t, len * rr(0.5, 0.7), r * 0.6, depth - 1);
      }
      // leaves alternate along the thin wood
      if (depth < 2) for (let s = depth ? 0.3 : 0.1, az = rnd() * TAU; s < 1; s += 0.0105 / len, az += 2.4) {
        const u = s * n, i = min(floor(u), n - 1), f = u - i, a = pts[i], b = pts[i + 1], pp = [mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f)], t = vNrm(vAdd(b, a, -1));
        const w = vNrm(vCrs(t, [0.3, 1, 0.2])), v = vCrs(t, w), dd = [t[0] * 0.5 + w[0] * cos(az) + v[0] * sin(az), t[1] * 0.5 + w[1] * cos(az) + v[1] * sin(az) + 0.15, t[2] * 0.5 + w[2] * cos(az) + v[2] * sin(az)], l = rr(0.04, 0.066) * S;
        const an = [pp[0], pp[1], pp[2], pk(0.03 + rnd() * 0.2 + 0.08 * hypot(pp[0] - bx, pp[2] - bz), 0.16)], bend = rr(0.25, 0.5);
        leaf(big, pp, l, dd, l * rr(0.44, 0.55), 0.5, mix(0.5, 1, clamp(hypot(pp[0] - bx, pp[1] - by - 0.4, pp[2] - bz) / (0.55 * S), 0, 1)), 3, rnd(), bend, an);
        if (rnd() < 0.5) dew(pp, dd, l, bend, an, 0.5, 2, rr(0.7, 1.4));
      }
      if (!depth && rnd() < 0.75) for (let j = 0, nb = 5 + (rnd() * 6 | 0), e = pts[n - 1 - (rnd() * 2 | 0)]; j < nb; j++) {
        const up = vNrm([rr(-0.5, 0.5), 1, rr(-0.5, 0.5)]);
        solid(M_BER, [e[0] + rr(-0.02, 0.02), e[1] - rr(0.002, 0.03), e[2] + rr(-0.02, 0.02)], rr(0.007, 0.0105), qFromY(up[0], up[1], up[2]), 9, rnd(), pk(0.38 + rnd() * 0.2, 0.28), 1, Z4, 0.35);
      }
    };
    for (let i = 0, n = 6 + (rnd() * 2 | 0); i < n; i++) { const a = i * TAU / n + rr(-0.3, 0.3), e = rr(0.25, 0.6); twig([bx + cos(a) * 0.03, by - 0.01, bz + sin(a) * 0.03], [cos(a) * e, 1, sin(a) * e], rr(0.36, 0.52) * S, 0.0065 * S, 2); }
  };
  // ---- herbs: each clump grows from nothing around its base
  const herb = (kind, x, y, z, id, S = 1) => {
    rseed(700 + id);
    const an = [x, y, z, pk(0.02 + rnd() * 0.05, 0.5)], base = (r) => { const a = rnd() * TAU, d = sqrt(rnd()) * r; return [x + cos(a) * d, y - 0.005, z + sin(a) * d, a]; };
    shade.push([x, z, 0.3 * S, 0.3]);
    if (kind === 1) for (let i = 0; i < 8; i++) {          // basil: pairs of cupped leaves, each pair turned a quarter
      const b = base(0.06), pts = arc(b, [cos(b[3]) * 0.4, 1, sin(b[3]) * 0.4], [0, 1, 0], 0.15, 6, rr(0.2, 0.32) * sqrt(S));
      for (let j = 0; j < 6; j++) {
        seg(pts[j], pts[j + 1], 0.0036 * S, 5, an[3], an, 0.3 + 0.1 * j);
        for (const s of [1, -1]) { const a = b[3] + j * 1.57, l = mix(0.085, 0.035, j / 6) * rr(0.85, 1.15) * S, dd = [cos(a) * s, 0.3, sin(a) * s]; leaf(big, pts[j + 1], l, dd, l * 0.62, 0.5 + 0.1 * j, mix(0.6, 1, j / 6), 4, rnd(), rr(0.48, 0.65), an); if (rnd() < 0.5) dew(pts[j + 1], dd, l, 0.55, an, 0.5); }
      }
    } else if (kind === 2) for (let i = 0; i < 14; i++) {  // rosemary: upright woody stems packed with needles
      const b = base(0.07), len = rr(0.34, 0.6) * S, pts = arc(b, [cos(b[3]) * 0.5, 1, sin(b[3]) * 0.5], [0, 1, 0], 0.12, 7, len, 0.08);
      for (let j = 0; j < 7; j++) seg(pts[j], pts[j + 1], 0.0024, 2, an[3], an, 0.2 + 0.08 * j);
      for (let s = 0.08, az = 0; s < 1; s += 0.0042 * S / len, az += 2.4) { const u = s * 7, j = min(floor(u), 6), f = u - j, a = pts[j], c = pts[j + 1], t = vNrm(vAdd(c, a, -1)); leaf(big, [mix(a[0], c[0], f), mix(a[1], c[1], f), mix(a[2], c[2], f)], rr(0.02, 0.032) * sqrt(S), [t[0] * 0.9 + cos(az), t[1] * 0.9 + 0.2, t[2] * 0.9 + sin(az)], 0.006 * sqrt(S), 0.3 + 0.5 * s, mix(0.55, 1, s), 5, rnd(), rr(0.25, 0.4), an, 0, 1); }
    } else if (kind === 3) for (let i = 0; i < 46; i++) {  // thyme: a low mat of wiry stems and tiny leaves
      const b = base(0.05), len = rr(0.09, 0.2) * S, pts = arc(b, [cos(b[3]), 0.25, sin(b[3])], [0, -0.25, 0], 0.06, 4, len, 0.1);
      for (let j = 0; j < 4; j++) seg(pts[j], pts[j + 1], 0.0009, 2, an[3], an, 0.2);
      for (let s = 0.1; s < 1; s += 0.008 / len) { const u = s * 4, j = min(floor(u), 3), f = u - j, a = pts[j], c = pts[j + 1]; for (const sg of [1, -1]) leaf(big, [mix(a[0], c[0], f), mix(a[1], c[1], f), mix(a[2], c[2], f)], rr(0.005, 0.008), [-sin(b[3]) * sg + rr(-0.3, 0.3), 0.5, cos(b[3]) * sg + rr(-0.3, 0.3)], 0.0045, 0.3, mix(0.6, 1, s), 11, rnd(), 0.4, an, 0, 1); }
    } else if (kind === 4) {                               // chives: a clump of hollow blades and a few purple heads
      for (let i = 0; i < 70; i++) { const b = base(0.045), e = rr(0.05, 0.35); leaf(big, b, rr(0.2, 0.34) * S, [cos(b[3]) * e, 1, sin(b[3]) * e], 0.0048, 0.8, mix(0.6, 1, e * 2.5), 10, rnd(), rr(0.3, 0.52), an); }
      for (let i = 0; i < 5; i++) { const b = base(0.03), pts = arc(b, [cos(b[3]) * 0.15, 1, sin(b[3]) * 0.15], [0, 1, 0], 0.1, 4, rr(0.3, 0.38) * S), a2 = [x, y, z, pk(0.55 + rnd() * 0.12, 0.12)]; for (let j = 0; j < 4; j++) seg(pts[j], pts[j + 1], 0.0014, 5, a2[3], a2, 0.7); solid(M_BER, vAdd(pts[4], [0, 0.03, 0]), 0.015, qRand(), 15, rnd(), a2[3], 1, a2, 0.7); }
    } else if (kind === 5) for (let i = 0; i < 18; i++) {  // parsley: thin stalks, three sprays of toothed leaflets each
      const b = base(0.04), pts = arc(b, [cos(b[3]) * 0.6, 1, sin(b[3]) * 0.6], [cos(b[3]), -0.3, sin(b[3])], 0.1, 4, rr(0.14, 0.27) * S);
      for (let j = 0; j < 4; j++) seg(pts[j], pts[j + 1], 0.0015, 5, an[3], an, 0.4);
      for (let k = 0; k < 3; k++) { const a = b[3] + (k - 1) * 1.1, e = vAdd(pts[4], [cos(a) * 0.02, 0.005, sin(a) * 0.02]); seg(pts[4], e, 0.001, 5, an[3], an, 0.5); for (let q = 0; q < 3; q++) { const a2 = a + (q - 1) * 0.9; leaf(big, e, rr(0.022, 0.034) * S, [cos(a2), rr(0, 0.5), sin(a2)], 0.02 * S, 0.7, 0.9, 11, rnd(), rr(0.3, 0.5), an); } }
    } else for (let i = 0; i < 9; i++) {                    // sage: grey felted leaves in pairs
      const b = base(0.06), pts = arc(b, [cos(b[3]) * 0.5, 1, sin(b[3]) * 0.5], [0, 1, 0], 0.15, 5, rr(0.2, 0.3) * S);
      for (let j = 0; j < 5; j++) { seg(pts[j], pts[j + 1], 0.0026, 5, an[3], an, 0.3); for (const s of [1, -1]) { const a = b[3] + j * 1.57, l = mix(0.08, 0.04, j / 5) * rr(0.85, 1.15) * S; leaf(big, pts[j + 1], l, [cos(a) * s, 0.45, sin(a) * s], l * 0.38, 0.5, mix(0.6, 1, j / 5), 7, rnd(), rr(0.38, 0.5), an); } }
    }
  };

  // ---- plant everything
  for (const t of TOMS) tomato(t);
  { const B = BEDS[1]; for (let i = 0; i < 3; i++) { const x = B[0] + (i % 2 ? 0.12 : -0.1), z = B[1] - 1 + i; zucchini(x, soilH(B, x, z), z, i); } }
  {
    const B = BEDS[3], K = [2, 1, 5, 4, 3, 6];
    for (let i = 0; i < 6; i++) { const x = B[0] + (i % 2 ? 0.3 : -0.3), z = B[1] - 0.85 + (i >> 1) * 0.85; herb(K[i], x, soilH(B, x, z), z, i, 1.9); }
    for (let i = 0; i < 5; i++) { const x = B[0] + (i % 2 ? 0.05 : -0.05), z = B[1] - 1.05 + i * 0.52; herb([1, 5, 3, 6, 4][i], x, soilH(B, x, z), z, 20 + i, 1.6); }
    for (let i = 0; i < 8; i++) { const x = B[0] + (i % 2 ? 0.46 : -0.46), z = B[1] - 1.1 + (i >> 1) * 0.72; herb([3, 4, 5, 3, 1, 3, 4, 5][i], x, soilH(B, x, z), z, 30 + i, 1.3); }
  }
  { const B = BEDS[4]; for (let i = 0; i < 15; i++) { const x = B[0] + ((i % 3) - 1) * 0.36 + rr(-0.04, 0.04), z = B[1] - 0.92 + (i / 3 | 0) * 0.46 + rr(-0.04, 0.04); herb([1, 5, 1, 4, 6, 1, 5, 1, 4, 1, 6, 1, 5, 3, 1][i], x, soilH(B, x, z), z, 70 + i, rr(1.3, 1.9)); } }
  { const B = BEDS[5]; for (let i = 0; i < 2; i++) { const x = B[0] + (i ? 0.1 : -0.08), z = B[1] - 0.6 + i * 1.2; zucchini(x, soilH(B, x, z), z, 5 + i, B); } }
  { const B = BEDS[6]; for (let i = 0; i < 12; i++) { const x = B[0] + ((i % 3) - 1) * 0.36 + rr(-0.04, 0.04), z = B[1] - 0.82 + (i / 3 | 0) * 0.54 + rr(-0.04, 0.04); herb([5, 1, 6, 1, 4, 5, 6, 5, 1, 3, 1, 4][i], x, soilH(B, x, z), z, 140 + i, rr(1.3, 1.8)); } }
  POTS.forEach((p, i) => {
    const dy = onDeck(p[0], p[1]) ? DECK[4] : 0;
    solid(M_POT, [p[0], dy, p[1]], p[2] / 1.05, qAxis(0, 1, 0, rnd() * TAU), 4, p[4], 0, p[3] / (p[2] / 1.05));
    solid(M_SOIL, [p[0], dy + p[3] * 0.9, p[1]], p[2] * 0.9, [0, 0, 0, 1], 0, 0);
    if (p[5]) herb(p[5], p[0], dy + p[3] * 0.9, p[1], 10 + i, 1); else blueberry(p[0], dy + p[3] * 0.9, p[1], i, 1 + p[2] - 0.25);
  });
  // herbs gone woody along the fences
  { let id = 40; const row = (x0, z0, x1, z1, n) => { for (let i = 0; i < n; i++) { const f = (i + rr(0.2, 0.8)) / n, x = mix(x0, x1, f) + rr(-0.12, 0.12), z = mix(z0, z1, f) + rr(-0.12, 0.12); if (!taken(x, z, 0.25)) herb([2, 6, 4, 2, 6, 1][id % 6], x, gh(x, z), z, id, rr(1.7, 2.5)); id++; } };
    row(0.2, -8.45, YX - 1.1, -8.45, 6); }
  // low herbs and self-sown clumps break up the mulch, away from the walkways between the beds
  for (let i = 0, n = 0; i < 400 && n < 6; i++) { const x = rr(-YX + 0.7, YX - 0.7), z = rr(-8.2, 8.2); if (pathAt(x, z) > 0.02 || taken(x, z, 0.85) || hypot(x - BIN[0], z - BIN[1]) < 0.7) continue; herb([3, 6, 4, 6, 3, 4][n % 6], x, gh(x, z), z, 100 + n, rr(1.4, 2.3)); n++; }
  // a few empty pots stacked by the wall
  solid(M_POT, [-YX + 0.65, 0, 7.6], 0.11, [0, 0, 0, 1], 4, 0.33, 0, 0.9); solid(M_POT, [-YX + 0.65, 0.035, 7.6], 0.105, qAxis(0, 1, 0, 1), 4, 0.41, 0, 0.9); solid(M_POT, [-YX + 1, 0.085, 7.75], 0.1, qAxis(1, 0, 0.3, 1.45), 4, 0.5, 0, 0.9);

  // ---- the neighbours' side: a spreading tree behind the back fence, tall dark trees, shrubs along the fences
  rseed(800);
  {
    // ls = leaf size, nl = leaves on each outermost branch
    const branch = (p, d, len, r, depth, ls = 1, nl = 110) => {
      const pts = arc(p, d, [0, 0.6, 0], 0.08, 4, len, 0.07);
      for (let i = 0; i < 4; i++) seg(pts[i], pts[i + 1], r * (1 - 0.3 * i / 4), 4, 0, Z4, depth > 2 ? 0 : 0.3);
      if (depth) for (let b = 0, nb = 2 + (rnd() < 0.7) + (depth < 3 && rnd() < 0.5); b < nb; b++) { const t = vNrm(vAdd(pts[4], pts[3], -1)); branch(pts[b ? 2 + (rnd() * 2 | 0) : 4], [t[0] + rr(-0.8, 0.8), t[1] + rr(-0.3, 0.4), t[2] + rr(-0.8, 0.8)], len * rr(0.62, 0.8), r * 0.62, depth - 1, ls, nl); }
      else for (let i = 0; i < nl; i++) {
        // leaves sit on the twig, crowding toward its end
        const u = sqrt(rnd()) * 4, j = min(floor(u), 3), f = u - j, a = pts[j], b = pts[j + 1], t = vNrm(vAdd(b, a, -1)), sp = len * 0.5 * rnd();
        leaf(big, [mix(a[0], b[0], f) + rr(-1, 1) * sp, mix(a[1], b[1], f) + rr(-0.6, 0.9) * sp, mix(a[2], b[2], f) + rr(-1, 1) * sp], rr(0.08, 0.15) * ls, [t[0] * 0.4 + rr(-1, 1), t[1] * 0.4 + rr(-0.8, 0.5), t[2] * 0.4 + rr(-1, 1)], rr(0.04, 0.06) * ls, 0.7, rr(0.45, 1), 12, rnd(), rr(0.3, 0.5), Z4, 0, 1);
      }
    };
    branch([3.6, -0.1, -12.6], [-0.1, 1, 0.12], 2.3, 0.2, 5, 0.78, 140);
    branch([-3.4, -0.1, -11.4], [0.15, 1, 0.1], 1.2, 0.09, 4, 0.78, 130);
    for (let i = 0; i < 14; i++) { const x = rr(-28, 28), z = rr(-20.5, -10.5); if (abs(x - 3.6) > 3 && abs(x + 3.4) > 2) for (let j = 0; j < 3; j++) branch([x + rr(-0.3, 0.3), -0.1, z + rr(-0.3, 0.3)], [rr(-0.5, 0.5), 1, rr(-0.5, 0.5)], rr(0.35, 0.7), 0.03, 2, 1.3, 60); }
    // taller trees further off, with coarser foliage
    for (const [x, z, len, r] of [[10.5, -17, 4.2, 0.3], [-19, -15, 3.4, 0.26], [-9.5, -13.5, 2.2, 0.16]]) branch([x, -0.2, z], [rr(-0.1, 0.1), 1, rr(-0.1, 0.1)], len * 0.85, r * 0.85, 5, 1.9, 80);
  }

  // ---- grass and weeds: along the fences and the feet of the beds, scattered in the mulch, rougher outside the yard
  rseed(810);
  const tuft = (x, z, n, h, an = Z4) => { const y = gh(x, z) - 0.004; for (let i = 0; i < n; i++) { const l = h * rr(0.45, 1.1); leaf(small, [x + rr(-0.025, 0.025), y, z + rr(-0.025, 0.025)], l, [rr(-0.5, 0.5), 1, rr(-0.5, 0.5)], rr(0.0045, 0.008), 0.7, rr(0.5, 1), 6, rnd(), rr(0.3, 0.62), an, 0, 1); } };
  for (let i = 0; i < 5200; i++) { const s = rnd() * 4 | 0, t = rnd(), d = pow(rnd(), 2) * 0.32 + 0.03; const x = s === 0 ? mix(-YX, YX, t) : s === 1 ? -YX + d : s === 2 ? YX - d : mix(-YX, YX, t), z = s === 0 ? -9 + d : s === 3 ? 9 - d : mix(-9, 9, t); if (!taken(x, z, 0.02) && pathAt(x, z) < 0.3) tuft(x, z, 5 + (rnd() * 6 | 0), rr(0.07, 0.24)); }
  for (const b of BEDS) for (let i = 0; i < 420; i++) { const t = rnd() * 2 * (b[2] + b[3]), d = 0.035 + pow(rnd(), 2) * 0.14; let x, z; if (t < b[2]) { x = b[0] - b[2] / 2 + t; z = b[1] - b[3] / 2 - d; } else if (t < 2 * b[2]) { x = b[0] - b[2] / 2 + t - b[2]; z = b[1] + b[3] / 2 + d; } else if (t < 2 * b[2] + b[3]) { x = b[0] - b[2] / 2 - d; z = b[1] - b[3] / 2 + t - 2 * b[2]; } else { x = b[0] + b[2] / 2 + d; z = b[1] - b[3] / 2 + t - 2 * b[2] - b[3]; } if (pathAt(x, z) < 0.6 || rnd() < 0.3) tuft(x, z, 4 + (rnd() * 5 | 0), rr(0.05, 0.16)); }
  for (let i = 0; i < 2600; i++) { const x = rr(-YX + 0.1, YX - 0.1), z = rr(-8.9, 8.9); if (taken(x, z, 0.03) || rnd() < pathAt(x, z) * 0.93 || fbm(x * 0.6, 4, z * 0.6, 2) < 0.5) continue; tuft(x, z, 3 + (rnd() * 5 | 0), rr(0.04, 0.13)); }
  for (let i = 0; i < 9000; i++) { const x = rr(-11, 11), z = rr(-13, 9); if (inYard(x, z) || z > 5) continue; tuft(x, z, 6, rr(0.12, 0.34)); }

  // ---- mulch chips, path pebbles and clods of soil
  rseed(820);
  const chip = (k, x, y, z, sc, kind, fade) => { if (nth++ % THIN) return; const q = k < 2 ? qMul(qAxis(0, 1, 0, rnd() * TAU), qAxis(1, 0, 0.4, rr(-0.4, 0.4))) : qRand(); chunks[k][cellOf(x, z)].push(x, y, z, sc, q[0], q[1], q[2], q[3], 1, kind + rnd() * 0.99, fade, 1, 0, 0, 0, 0); };
  for (let i = 0; i < 200000; i++) {
    const x = rr(-YX + 0.03, YX - 0.03), z = rr(-8.97, 8.97); if (taken(x, z)) continue;
    if (pathAt(x, z) > 0.15) continue;   // the patio is paved
    { const sc = 0.009 + 0.02 * pow(rnd(), 1.5); chip(rnd() * 2 | 0, x, gh(x, z) + sc * 0.1 + rnd() * 0.006, z, sc, 0, 7.5); }
  }
  for (const b of BEDS) for (let i = 0, n = b[2] * b[3] * 700; i < n; i++) { const x = b[0] + rr(-0.5, 0.5) * (b[2] - 0.1), z = b[1] + rr(-0.5, 0.5) * (b[3] - 0.1), sc = 0.005 + 0.024 * pow(rnd(), 3); chip(3, x, soilH(b, x, z) + sc * 0.2, z, sc, 2, 6); }

  // ---- dew: a spider's web in the corner of the fences, strung with beads; drops forming at the emitters and on leaf tips
  rseed(830);
  {
    const c = [-YX + 0.5, 1.74, -8.5], ux = [0.707, 0, -0.707], uy = [0, 1, 0], R = 0.34, NR = 22, P = (a, r) => { const s = r * (1 + 0.1 * sin(a * 3 + 1)); return [c[0] + ux[0] * cos(a) * s, c[1] + sin(a) * s - 0.015 * r / R, c[2] + ux[2] * cos(a) * s]; };
    const bead = (p, sz) => glints.push(p[0], p[1], p[2], 0.35, rnd(), rnd(), sz, 0);
    for (let i = 0; i < NR; i++) { const a = i * TAU / NR + rr(-0.04, 0.04); for (let r = 0.012; r < R * 1.25; r += rr(0.01, 0.022)) bead(P(a, r), rr(0.0008, 0.0014)); }
    for (let t = 0, r = 0.03; r < R; r += 0.0105 / NR / 6, t++) {
      // the spiral sags between the spokes
      const a = t * TAU / NR / 6, f = (t % 6) / 6, p = P(a, r);
      p[1] -= 0.012 * r / R * 4 * f * (1 - f) + 0.0004 * rnd(); bead(p, rr(0.001, 0.0021));
    }
  }
  for (const e of EMIT) { drops.push(e[0] + 0.012, e[1] + 0.006, e[2], 0.0028, rnd(), rr(1.6, 4), 0.05, 0); glints.push(e[0], e[1] + 0.014, e[2], 0, rnd(), rnd(), 0.002, 0); }
  for (let i = 0; i < glints.length && drops.length < 8 * 260; i += 8 * 37) if (glints[i + 3] > 0.3) drops.push(glints[i], glints[i + 1], glints[i + 2], 0.0022, rnd(), rr(5, 14), glints[i + 1] * 0.6, glints[i + 3]);

  // ---- birds crossing in the fog, mist droplets
  rseed(840);
  const birds = [];
  for (const [x, y, z, R, n, w] of [[4, 16, -14, 26, 5, 0.1], [-12, 11, 2, 19, 3, -0.14], [8, 22, 6, 38, 4, 0.07], [0, 8.5, -22, 12, 2, -0.2]]) { const ph = rnd(); for (let i = 0; i < n; i++) birds.push(x + rr(-1.5, 1.5), y + rr(-1, 1), z + rr(-1.5, 1.5), R, rnd(), w * rr(0.9, 1.1), rr(0.13, 0.17), ph + i * 0.006 + rr(-0.002, 0.002)); }
  const snow = new Float32Array(9000 * 4);
  for (let i = 0; i < snow.length; i++) snow[i] = rnd();

  // ---- fog: a tileable 3-D texture, r = slow billows, g = finer wisps
  rseed(850);
  const volD = new Uint8Array(FOGN * FOGN * FOGN * 2);
  {
    const lat = (per) => { const a = new Float32Array(per * per * per); for (let i = 0; i < a.length; i++) a[i] = rnd(); return a; };
    const L = [4, 8, 16, 8, 16, 32].map(lat), P = [4, 8, 16, 8, 16, 32], smt = (t) => t * t * (3 - 2 * t);
    const nz = (k, x, y, z) => {
      const per = P[k], a = L[k], fx = x * per, fy = y * per, fz = z * per, ix = floor(fx), iy = floor(fy), iz = floor(fz), u = smt(fx - ix), v = smt(fy - iy), w = smt(fz - iz);
      const x0 = ix % per, x1 = (ix + 1) % per, y0 = (iy % per) * per, y1 = ((iy + 1) % per) * per, z0 = (iz % per) * per * per, z1 = ((iz + 1) % per) * per * per;
      return mix(mix(mix(a[x0 + y0 + z0], a[x1 + y0 + z0], u), mix(a[x0 + y1 + z0], a[x1 + y1 + z0], u), v), mix(mix(a[x0 + y0 + z1], a[x1 + y0 + z1], u), mix(a[x0 + y1 + z1], a[x1 + y1 + z1], u), v), w);
    };
    for (let z = 0, o = 0; z < FOGN; z++) for (let y = 0; y < FOGN; y++) for (let x = 0; x < FOGN; x++) {
      const X = x / FOGN, Y = y / FOGN, Z = z / FOGN;
      volD[o++] = clamp((nz(0, X, Y, Z) * 4 + nz(1, X, Y, Z) * 2 + nz(2, X, Y, Z)) / 7 * 1.5 - 0.25, 0, 1) * 255;
      volD[o++] = clamp((nz(3, X, Y, Z) * 4 + nz(4, X, Y, Z) * 2 + nz(5, X, Y, Z)) / 7 * 1.5 - 0.25, 0, 1) * 255;
    }
  }

  // ---- ground map over the middle 24 m: r path, g grass, b damp, a openness (darker beside and under things)
  const gm = new Uint8Array(512 * 512 * 4);
  for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
    const x = (i + 0.5) / 512 * 24 - 12, z = (j + 0.5) / 512 * 24 - 12, o = (i + 512 * j) * 4, yard = inYard(x, z);
    let ao = 1, wet = 0;
    for (const b of BEDS) ao = min(ao, mix(0.22, 1, sstep(0, 0.4, boxD(x, z, b[0], b[1], b[2] / 2, b[3] / 2))));
    for (const p of POTS) ao = min(ao, mix(0.2, 1, sstep(p[2] * 0.6, p[2] * 2.1, hypot(x - p[0], z - p[1]))));
    ao = min(ao, mix(0.4, 1, sstep(0.2, 0.6, hypot(x - BIN[0], z - BIN[1]))), mix(0.55, 1, sstep(0, 0.4, yard ? min(YX - abs(x), z + 9, 9 - z) : boxD(x, z, 0, 0, YX, 9) * 3)));
    for (const s of shade) ao *= 1 - s[3] * sstep(s[2], s[2] * 0.3, hypot(x - s[0], z - s[1]));
    for (const e of EMIT) wet = max(wet, sstep(0.16, 0.03, hypot(x - e[0], z - e[1]) + (fbm(x * 9, 1, z * 9, 2) - 0.5) * 0.08));
    wet = max(wet, 0.5 * sstep(0.35, 0.05, abs(abs(x) - YX + 0.1)) * yard, 0.35 * sstep(0.55, 0.75, fbm(x * 0.5, 8, z * 0.5, 3)));
    gm[o] = (yard ? pathAt(x, z) : 0) * 255; gm[o + 1] = (yard ? sstep(0.5, 0.62, fbm(x * 0.6, 4, z * 0.6, 2)) * 0.5 * (1 - pathAt(x, z)) : 1) * 255;
    gm[o + 2] = wet * sstep(12, 10.5, max(abs(x), abs(z))) * 255; gm[o + 3] = ao * 255;
  }

  // ---- pack: leaves (52 bytes: 12 floats + 4 unorm8) and clutter (16 floats), sorted by culling cell
  const pack = (L, step = 1, wm = 1) => {
    let n = 0; const start = new Uint32Array(nCells + 1);
    for (let c = 0; c < nCells; c++) { start[c] = n; n += Math.ceil(L[c].length / 16 / step); }
    start[nCells] = n;
    const buf = new ArrayBuffer(n * 52), f = new Float32Array(buf), u8 = new Uint8Array(buf), lo = new Float32Array(nCells).fill(1e9), hi = new Float32Array(nCells).fill(-1e9);
    let k = 0;
    for (let c = 0; c < nCells; c++) { const a = L[c]; for (let i = 0; i < a.length; i += 16 * step, k++) {
      for (let j = 0; j < 12; j++) f[k * 13 + j] = a[i + j];
      f[k * 13 + 6] *= wm;
      u8[k * 52 + 48] = a[i + 12]; u8[k * 52 + 49] = a[i + 13] * 255; u8[k * 52 + 50] = a[i + 14] * 255; u8[k * 52 + 51] = a[i + 15] * 255;
      const y = a[i + 1], l = a[i + 3]; if (y - l < lo[c]) lo[c] = y - l; if (y + l > hi[c]) hi[c] = y + l;
    } }
    return { buf, n, start, lo, hi };
  };
  const packC = (L) => {
    let n = 0; const start = new Uint32Array(nCells + 1);
    for (let c = 0; c < nCells; c++) { start[c] = n; n += L[c].length / 16; }
    start[nCells] = n;
    const data = new Float32Array(n * 16), lo = new Float32Array(nCells).fill(1e9), hi = new Float32Array(nCells).fill(-1e9);
    let k = 0;
    for (let c = 0; c < nCells; c++) { const a = L[c]; for (let i = 0; i < a.length; i += 16) { for (let j = 0; j < 16; j++) data[k++] = a[i + j]; lo[c] = min(lo[c], a[i + 1] - 0.1); hi[c] = max(hi[c], a[i + 1] + 0.1); } }
    return { data, n, start, lo, hi };
  };
  // built-in-place meshes get their one instance; then all instances in mesh order
  STATIC.forEach((s, i) => { if (s) solids[i] = [0, 0, 0, 1, 0, 0, 0, 1, s[0], s[1], 0, 1, 0, 0, 0, 0]; });
  const sol = [], ranges = [];
  for (let m = 0, si = 0; m < NSOL; m++) { const a = solids[m] || []; ranges.push([si, a.length / 16]); si += a.length / 16; for (let i = 0; i < a.length; i++) sol.push(a[i]); }
  return { glints: new Float32Array(glints), chunks: chunks.map(packC), big: pack(big), bigF: pack(big, 2, 1.5), small: pack(small), solids: { data: new Float32Array(sol), ranges },
    drops: new Float32Array(drops), volD, gm, birds: new Float32Array(birds), cat: new Float32Array([CAT[0], CAT[1], CAT[2], 1, 0, 0, 0, 1]), snow };
}
