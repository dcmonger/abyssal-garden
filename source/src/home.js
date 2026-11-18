// ============================================================================
// the garden's house, inside and out, from its floor plans (load-time only)
// ============================================================================
// Two floors: the main floor, level with the garden, and the ground floor at the street, dug into the hill under it. The
// plans are in pixels; mx/mz (main floor plan) and gx/gz (ground floor plan) turn them into metres. Across, the house fills
// the lot (the plans' 8 m stretched to 10.5); along, it is true to them, from the back of the primary bedroom (z = HAZ)
// to the front wall (z = HZ1). The plans' top is the garden (-z), their right is +x.
// Inside, everything is material 22, the kind of surface (IN) in the vertex code; outside it is the yellow siding (W),
// the cream stucco of the front (IN.stucco) and the roof (T).
const FL0 = -2.88, FL1 = 0.33, CL0 = 0.0, CL1 = 2.95, RF1 = 3.6, RFA = 3.1, HZ0 = 10.15, HZ1 = 25.3, HAX = -0.75, HAZ = 5.6, HY = 5.25;
// the stair between the floors: two straight flights side by side and a landing at the far end. Up from the ground floor
// along +x in the south half (SB), round on the landing, and back along -x in the north half (SA) to the hall
const HOLE = [1.55, 13.06, 4.45, 14.86], SKY = [2.2, 13.25, 3.3, 14.35];   // the stair's hole in the floor, the skylight over it
const SM = 13.97, ST = 0.27, SL = 1.55 + 7 * ST;   // where the halves meet, the treads' depth, where the landing starts
const RS = (FL1 - FL0) / 16;   // the rise of a step
// the height of the stair under (x, z), in the hole
const stairAt = (x, z) => { const k = x > SL ? 8 : z > SM ? max(0, (x - HOLE[0]) / ST + 0.5) : 8 + (SL - x) / ST + 0.5; return FL0 + min(k, 16) * RS; };
const WELL = [-3.28, 8.55, -1.95, HZ0];   // the window well behind the downstairs bedroom, under a grate in the deck
const mx = (p) => (p - 287) * 10.5 / 450, mz = (p) => HAZ + (p - 160) / 56;
const gx = (p) => (p - 421) * 10.5 / 632, gz = (p) => HZ0 + (p - 62) * (HZ1 - HZ0) / 1198;
const IN = { paint: 0, ceil: 1, oak: 2, carpet: 3, tile: 4, cork: 5, cherry: 6, butcher: 7, stone: 8, brick: 9, china: 10, steel: 11, fabric: 12,
  pillow: 13, linen: 14, pale: 15, black: 16, glass: 17, concrete: 18, stud: 19, art: 20, mirror: 21, rug: 22, light: 23, leaf: 24, mosaic: 25,
  white: 26, bin: 27, trim: 28, stucco: 29, clay: 30, brown: 31, pot: 32, binG: 33, binB: 34, sage: 35, cushion: 36, mustard: 37 };
const HB = [];   // the walls, for the camera: x0, y0, z0, x1, y1, z1 each
let HBA = null;

function buildHome(W, T, I, G) {
  // a box in mesh m (kind t; null for the meshes that do not use it), and perhaps in the camera's list
  const bm = (m, t, x0, y0, z0, x1, y1, z1, col = 0) => {
    const a = min(x0, x1), b = max(x0, x1), c = min(z0, z1), d = max(z0, z1);
    if (b - a < 1e-3 || y1 - y0 < 1e-3 || d - c < 1e-3) return;
    if (t === null) box(m, a, y0, c, b, y1, d); else aux(m, t / 127, () => box(m, a, y0, c, b, y1, d));
    if (col) HB.push(a, y0, c, b, y1, d);
  };
  const bx = (t, x0, y0, z0, x1, y1, z1, col = 0) => bm(I, t, x0, y0, z0, x1, y1, z1, col);
  // a wall from a0 to a1 along x (alongX) or z, c0..c1 thick, y0..y1 high, with openings [from, to, bottom, top]
  // base: a painted wall standing on a floor, which gets a baseboard along both faces and casings round its doors
  const wall = (m, t, alongX, a0, a1, c0, c1, y0, y1, ops = [], base = false) => {
    const B = (p, q, ya, yb, e) => alongX ? bx(P.trim, p, ya, c0 - e, q, yb, c1 + e) : bx(P.trim, c0 - e, ya, p, c1 + e, yb, q);
    const put = (p, q, ya, yb) => { alongX ? bm(m, t, p, ya, c0, q, yb, c1, 1) : bm(m, t, c0, ya, p, c1, yb, q, 1); if (base && ya === y0 && q - p > 0.02) B(p, q, y0, y0 + 0.1, 0.012); };
    let c = a0;
    for (const [a, b, lo, hi] of ops.slice().sort((u, v) => u[0] - v[0])) {
      put(c, a, y0, y1); if (lo > y0) put(a, b, y0, lo); if (hi < y1) put(a, b, hi, y1); c = b;
      if (base && lo <= y0) { B(a - 0.07, a + 0.02, y0, hi + 0.02, 0.016); B(b - 0.02, b + 0.07, y0, hi + 0.02, 0.016); if (hi < y1) B(a - 0.07, b + 0.07, hi - 0.02, hi + 0.08, 0.016); }
    }
    put(c, a1, y0, y1);
  };
  // a frame round an opening, proud of both faces; windows get a sash bar down the middle
  // (inside the opening, so that no face of it lies on a face of the wall: e0, e1 how far it stands proud of either face)
  const frame = (t, alongX, a, b, c0, c1, lo, hi, sash, e0 = 0.025, e1 = 0.025) => {
    const w = 0.06, P = (p, q, ya, yb, f0 = e0, f1 = e1) => alongX ? bx(t, p, ya, c0 - f0, q, yb, c1 + f1) : bx(t, c0 - f0, ya, p, c1 + f1, yb, q);
    P(a, a + w, lo, hi); P(b - w, b, lo, hi); P(a + w, b - w, hi - w, hi);
    if (sash) { P(a - 0.04, b + 0.04, lo, lo + 0.03, e0 && e0 + 0.03, e1 && e1 + 0.03); if (b - a > 0.9) P((a + b) / 2 - 0.03, (a + b) / 2 + 0.03, lo + 0.03, hi - w, 0, 0); }
  };
  // an outside wall: siding or stucco outside (o: which side is out, -1 the low side), paint inside, framed openings
  // (the outside material goes right through, so that where two walls meet at a corner the faces that touch are the same
  // stuff; the lining stops a millimetre short of the wall's ends)
  const ext = (m, t, alongX, a0, a1, c0, c1, y0, y1, o, ops = [], tin = IN.paint) => {
    const cm = (c0 + c1) / 2, li = o < 0 ? c1 : c0;
    wall(m, t, alongX, a0, a1, c0, c1, y0, y1, ops); wall(I, tin, alongX, a0 + 0.001, a1 - 0.001, o < 0 ? li : li - 0.012, o < 0 ? li + 0.012 : li, y0, y1, ops);
    // glass in the windows (drawn faint and reflecting, see fsGlass); it stops the camera
    for (const [a, b, lo, hi] of ops) if (lo > FL1 + 0.3 || lo > FL0 + 0.3 && lo < 0) { alongX ? HB.push(a, lo, c0, b, hi, c1) : HB.push(c0, lo, a, c1, hi, b); pane(alongX, a, b, cm, lo, hi); }
    // a baseboard along the lining where the main floor meets it, broken at the doors
    if (tin === IN.paint && y0 <= FL1 + 1e-6 && y1 > FL1 + 1) {
      const e0 = o < 0 ? li : li - 0.024, e1 = o < 0 ? li + 0.024 : li, B = (p, q) => q - p > 0.02 && (alongX ? bx(P.trim, p, FL1, e0, q, FL1 + 0.1, e1) : bx(P.trim, e0, FL1, p, e1, FL1 + 0.1, q));
      let c = a0 + 0.001; for (const [a, b, lo] of ops.slice().sort((u, v) => u[0] - v[0])) if (lo <= FL1 + 0.01) { B(c, a); c = b; } B(c, a1 - 0.001);
    }
    for (const [a, b, lo, hi] of ops) { const sash = lo > FL1 + 0.3 || lo > FL0 + 0.3 && lo < 0;
      if (o < 0) { frame(IN.brown, alongX, a, b, c0, cm, lo, hi, sash, 0.025, 0); frame(IN.trim, alongX, a, b, cm, c1, lo, hi, false, 0, 0.037); }
      else { frame(IN.trim, alongX, a, b, c0, cm, lo, hi, false, 0.037, 0); frame(IN.brown, alongX, a, b, cm, c1, lo, hi, sash, 0, 0.025); } }
  };
  // a pane of glass across an opening, in the middle of the wall
  const pane = (alongX, a, b, c, lo, hi) => alongX ? box(G, a, lo, c - 0.004, b, hi, c + 0.004) : box(G, c - 0.004, lo, a, c + 0.004, hi, b);
  // slabs: rectangles [x0, z0, x1, z1], less a hole
  const less = (r, h) => [[r[0], r[1], r[2], h[1]], [r[0], h[3], r[2], r[3]], [r[0], h[1], h[0], h[3]], [h[2], h[1], r[2], h[3]]];
  const slab = (m, t, rs, y0, y1) => { for (const r of rs) bm(m, t, r[0], y0, r[1], r[2], y1, r[3]); };
  const P = IN, D = 2.05;   // door height
  // a flush dome light on the ceiling
  const lit = (x, y, z, s = 0.36) => lat(P.light, [[0, 0], [s / 2, 0], [s / 2 - 0.02, -0.035], [s / 4, -0.06], [0, -0.065]], 16, x, y - 0.005, z);
  const art = (alongX, a, b, c, y0, y1, d) => alongX ? bx(P.art, a, y0, c, b, y1, c + d) : bx(P.art, c, y0, a, c + d, y1, b);

  // ---------------------------------------------------------------- the shell
  // the party walls (the neighbours stand against them) and the back of the house, at the garden
  ext(W, null, false, HZ0, 21.4, -HY, -4.71, FL0 - 0.12, RF1 + 0.35, -1);
  ext(W, null, false, HAZ, HZ0, 4.74, HY, -0.3, RFA, 1);
  ext(W, null, false, HZ0, 21.4, 4.74, HY, FL0 - 0.12, RF1 + 0.35, 1);
  // the back wall onto the deck, with the kitchen's window and the back door; the addition's side and back walls, with
  // the bedroom's sliding door; the main house's back wall above the addition's roof
  ext(W, null, true, -HY, HAX + 0.2, HZ0 - 0.05, HZ0 + 0.18, -0.3, RF1 + 0.35, -1, [[mx(100), mx(180), 1.25, 2.35], [mx(203), mx(250), FL1, FL1 + D]]);
  ext(W, null, false, HAZ, HZ0 - 0.05, HAX, HAX + 0.35, -0.3, RFA, -1);
  ext(W, null, true, HAX, HY, HAZ, HAZ + 0.27, -0.3, RFA, -1, [[mx(355), mx(440), FL1, FL1 + 2.1]]);
  { const a = mx(355), b = mx(440), m = (a + b) / 2, c = HAZ + 0.135; pane(true, m, b, c, FL1, FL1 + 2.1); HB.push(m, FL1, HAZ, b, FL1 + 2.1, HAZ + 0.27); bx(P.brown, m - 0.03, FL1, c - 0.05, m + 0.03, FL1 + 2.1, c + 0.05); bx(P.steel, m - 0.06, FL1 + 0.95, c + 0.05, m - 0.04, FL1 + 1.15, c + 0.07); }
  bm(W, null, HAX, RFA - 0.12, HZ0 - 0.05, HY, RF1 + 0.35, HZ0 + 0.18, 1);
  // the front, up the steps: the porch (its window into the dining room, the front door into the foyer), the living
  // room's wall over the steps, its bay over the garage, the bedroom's window over the side; stucco, red tile on top
  ext(I, P.stucco, true, -HY, -3.2, mz(965), mz(975) + 0.05, FL1, RF1 + 0.35, 1, [[mx(90), mx(145), 1.1, 2.3]]);
  ext(I, P.stucco, false, mz(975) + 0.05, 21.4, -3.2, -2.92, FL1, RF1 + 0.35, -1, [[mz(985), mz(1035), FL1, FL1 + 2.1]]);
  bx(P.paint, -3.2, FL1, mz(965), -2.92, CL1, mz(975) + 0.05, 1); bx(P.stucco, -3.2, CL1, mz(965), -2.92, RF1 + 0.35, mz(975) + 0.05);   // (the corner between the porch and the dining room)
  ext(I, P.stucco, false, 21.4, HZ1, -3.2, -2.92, FL1, RF1 + 0.35, -1, [[mz(1100), mz(1180), 1.1, 2.3]]);
  ext(I, P.stucco, true, -3.2, 3.57, 25.08, HZ1, FL1, RF1 + 0.35, 1, [[mx(215), mx(355), FL1, 2.55]]);
  ext(I, P.stucco, false, 21.4, HZ1, 3.34, 3.57, FL1, RF1 + 0.35, 1);
  ext(I, P.stucco, true, 3.34, HY, 21.25, 21.47, FL1, RF1 + 0.35, 1, [[mx(445), mx(490), 1.0, 2.3]]);
  bx(P.clay, -3.28, RF1 + 0.35, 25.02, 3.65, RF1 + 0.47, HZ1 + 0.1); bx(P.clay, 3.26, RF1 + 0.35, 21.2, 3.65, RF1 + 0.47, HZ1 + 0.1); bx(P.clay, -3.28, RF1 + 0.35, 19.9, -3.12, RF1 + 0.47, HZ1 + 0.1);
  // the bay: three windows, a tiled hood
  const B0 = mx(200), B1 = mx(370), BZ = 25.96;
  ext(I, P.stucco, true, B0, B1, BZ - 0.12, BZ, FL1 - 0.3, 2.85, 1, [[mx(220), mx(350), 0.95, 2.45]]);
  ext(I, P.stucco, false, HZ1, BZ - 0.12, B0, B0 + 0.12, FL1 - 0.3, 2.85, -1, [[HZ1 + 0.12, BZ - 0.2, 0.95, 2.45]]);
  ext(I, P.stucco, false, HZ1, BZ - 0.12, B1 - 0.12, B1, FL1 - 0.3, 2.85, 1, [[HZ1 + 0.12, BZ - 0.2, 0.95, 2.45]]);
  bx(P.stucco, B0, FL1 - 0.45, HZ1, B1, FL1 - 0.03, BZ); bx(P.oak, B0 + 0.12, FL1 - 0.03, HZ1 - 0.2, B1 - 0.12, FL1, BZ - 0.12);
  bx(P.ceil, B0 + 0.12, 2.55, HZ1 - 0.2, B1 - 0.12, 2.85, BZ - 0.12); bx(P.clay, B0 - 0.12, 2.85, HZ1, B1 + 0.12, 2.99, BZ + 0.14);
  // the street level: the garage's door between the steps and the side, stucco
  wall(I, P.stucco, true, -3.2, 3.31, 25.05, HZ1, FL0 - 0.12, FL1, [[gx(330), gx(520), FL0, FL0 + 2.2]]);
  frame(P.brown, true, gx(330), gx(520), 25.05, HZ1, FL0, FL0 + 2.2, false);
  // the side: under the bedroom's window a solid block of house up to a small terrace with a rail
  bx(P.stucco, 3.31, FL0 - 0.12, 21.2, HY, FL1 - 0.02, HZ1, 1); bx(P.concrete, 3.57, FL1 - 0.02, 21.47, HY, FL1, HZ1);
  for (let z = 21.6; z < HZ1; z += 0.6) bx(P.trim, HY - 0.06, FL1, z, HY - 0.02, FL1 + 0.95, z + 0.04);
  bx(P.trim, 3.57, FL1 + 0.95, HZ1 - 0.08, HY, FL1 + 1.0, HZ1 - 0.02); bx(P.trim, HY - 0.08, FL1 + 0.95, 21.47, HY - 0.02, FL1 + 1.0, HZ1);
  // the steps up from the street to the porch, between the living room and the neighbour, over the garage's storage
  const NS = 16, TS = (HZ1 - 21.4) / NS;
  for (let i = 0; i < NS; i++) bx(P.stucco, -5.12, FL0 - 0.12, 21.4 + i * TS, -3.2, FL1 - (i + 1) * RS + 0.012, 21.4 + (i + 1) * TS);
  for (let i = 0; i < NS; i++) bx(P.clay, -5.12, FL1 - (i + 1) * RS, 21.4 + i * TS - 0.03, -3.2, FL1 - (i + 1) * RS + 0.03, 21.4 + i * TS + 0.25);
  bx(P.stucco, -5.12, CL0 - 0.02, mz(975), -3.2, FL1 - 0.02, 21.4); bx(P.clay, -5.12, FL1 - 0.03, mz(975), -3.2, FL1, 21.43);
  bx(P.brown, -3.0, FL1 + 2.0, 20.38, -2.92, FL1 + 2.18, 20.48); lit(-3.13, FL1 + 2.35, 20.9, 0.14);   // the porch light
  // the roof, flat behind the parapets, a skylight over the stair; the addition's lower roof
  const RM = [[-HY, HZ0 - 0.05, HY, 21.4], [-3.2, 21.4, 3.57, HZ1]];
  slab(T, null, [...less(RM[0], SKY), RM[1]], RF1 - 0.08, RF1); slab(I, P.ceil, [...less(RM[0], SKY), RM[1]], CL1, RF1 - 0.08);
  for (const [a, b, c, d] of [[SKY[0], SKY[1], SKY[2], SKY[1] + 0.08], [SKY[0], SKY[3] - 0.08, SKY[2], SKY[3]], [SKY[0], SKY[1], SKY[0] + 0.08, SKY[3]], [SKY[2] - 0.08, SKY[1], SKY[2], SKY[3]]]) bx(P.trim, a, CL1, b, c, RF1 + 0.25, d);
  bm(T, null, HAX, RFA - 0.08, HAZ, HY, RFA, HZ0); bx(P.ceil, HAX, CL1, HAZ, HY, RFA - 0.08, HZ0);
  bx(P.brown, HAX - 0.04, RFA - 0.2, HAZ - 0.04, HY, RFA + 0.04, HAZ + 0.02); bx(P.brown, HAX - 0.04, RFA - 0.2, HAZ - 0.04, HAX + 0.02, RFA + 0.04, HZ0);
  bx(P.brown, -HY, RF1 + 0.25, HZ0 - 0.09, HY, RF1 + 0.39, HZ0 - 0.03);
  // the lamp over the back door (the light it gives is PL in shaders.js)
  bx(P.brown, -1.56, 2.48, HZ0 - 0.13, -1.34, 2.78, HZ0 - 0.05); bx(P.light, -1.52, 2.52, HZ0 - 0.2, -1.38, 2.74, HZ0 - 0.13);
  bx(P.steel, -1.15, RF1, 15.0, -0.95, RF1 + 0.7, 15.2);
  aux(I, P.trim / 127, () => { I.tube([[-3.27, FL1 + 0.92, 21.3], [-3.27, FL0 + 0.92, HZ1 + 0.1]], 0.025, 8); for (let k = 0.15; k < 1; k += 0.28) { const z = 21.3 + k * (HZ1 - 21.2), y = FL1 + (FL0 - FL1) * k + 0.92; I.tube([[-3.2, y - 0.05, z], [-3.27, y - 0.02, z]], 0.012, 5, false); } });
  aux(I, P.sage / 127, () => I.tube([[HAX - 0.08, 0.32, HZ0 - 0.14], [HAX - 0.08, RFA - 0.25, HZ0 - 0.14], [HAX - 0.08, RFA - 0.1, HZ0 - 0.4], [HAX - 0.08, RFA + 0.02, HZ0 - 0.4]], 0.045, 8));
  for (const [x, z, y] of [[0.1, HAZ, 2.75], [-2.3, HZ0 - 0.05, 2.8]]) { bx(P.white, x - 0.07, y - 0.08, z - 0.06, x + 0.07, y + 0.08, z); lat(P.china, [[0, 0], [0.04, 0], [0.04, 0.07], [0, 0.07]], 10, x - 0.06, y - 0.14, z - 0.1); lat(P.china, [[0, 0], [0.04, 0], [0.04, 0.07], [0, 0.07]], 10, x + 0.06, y - 0.14, z - 0.1); }
  for (const [x, z, y] of [[3.95, HAZ, FL1 + 0.35], [-0.95, HZ0 - 0.05, FL1 + 0.35]]) bx(P.steel, x - 0.06, y - 0.08, z - 0.035, x + 0.06, y + 0.08, z);
  { const y = 0.3;   // the outdoor sofa along the fence, an armchair across from it, a low table between: white frames, grey cushions
    const frameBox = (x0, z0, x1, z1, h) => { for (const [a, b] of [[x0, x0 + 0.05], [x1 - 0.05, x1]]) for (const [c, d] of [[z0, z0 + 0.05], [z1 - 0.05, z1]]) bx(P.white, a, y, c, b, y + h, d); };
    frameBox(-5.15, 7.2, -4.3, 9.7, 0.62); rbox(P.white, -5.15, y + 0.1, 7.2, -4.3, y + 0.16, 9.7, 0.01); rbox(P.white, -5.15, y + 0.5, 7.2, -4.3, y + 0.56, 7.27, 0.01); rbox(P.white, -5.15, y + 0.5, 9.63, -4.3, y + 0.56, 9.7, 0.01);
    for (const z of [7.27, 8.45]) { rbox(P.cushion, -5.05, y + 0.16, z + 0.01, -4.32, y + 0.32, z + 1.17, 0.04); rbox(P.cushion, -5.1, y + 0.3, z + 0.02, -4.9, y + 0.78, z + 1.16, 0.06); }
    rbox(P.mustard, -4.92, y + 0.32, 7.5, -4.78, y + 0.66, 7.88, 0.06); rbox(P.pillow, -4.92, y + 0.32, 8.3, -4.78, y + 0.68, 8.72, 0.06); rbox(P.mustard, -4.92, y + 0.32, 9.1, -4.78, y + 0.66, 9.48, 0.06);
    frameBox(-3.25, 6.45, -2.45, 7.35, 0.62); rbox(P.white, -3.25, y + 0.1, 6.45, -2.45, y + 0.16, 7.35, 0.01);
    rbox(P.cushion, -3.18, y + 0.16, 6.5, -2.52, y + 0.32, 7.25, 0.04); rbox(P.cushion, -2.7, y + 0.3, 6.5, -2.5, y + 0.78, 7.3, 0.06);
    frameBox(-4.05, 7.75, -3.45, 8.6, 0.36); rbox(P.white, -4.05, y + 0.32, 7.75, -3.45, y + 0.38, 8.6, 0.01); plant(-3.75, y + 0.38, 8.17, 0.07, 0.24); } bx(P.steel, 0.8, RF1, 17.2, 1.0, RF1 + 0.45, 17.4);   // vent pipes

  // ---------------------------------------------------------------- the main floor
  // the floor: structure, then oak everywhere, then the rooms that have something else
  const MF = [...less([-HY + 0.1, HZ0, HY - 0.1, 21.47], HOLE), [-3.2, 21.47, 3.34, HZ1]];
  slab(I, P.ceil, MF, CL0, FL1 - 0.04); slab(I, P.oak, MF, FL1 - 0.04, FL1 - 0.006);
  bx(P.ceil, HAX, -0.3, HAZ, HY, FL1 - 0.04, HZ0); bx(P.carpet, HAX, FL1 - 0.04, HAZ, HY, FL1, HZ0);
  bx(P.cork, mx(85), FL1 - 0.03, HZ0, mx(292), FL1, mz(755));
  bx(P.carpet, mx(270), FL1 - 0.03, HZ0 - 0.2, mx(490), FL1, mz(447)); bx(P.carpet, mx(300), FL1 - 0.03, mz(840), mx(490), FL1, mz(1045));
  bx(P.tile, mx(355), FL1 - 0.03, mz(685), mx(490), FL1, mz(790)); bx(P.tile, mx(355), FL1 - 0.03, mz(447), mx(490), FL1, mz(574));
  // the walls between the rooms
  const IW = (alongX, a0, a1, c0, c1, ops) => wall(I, P.paint, alongX, a0, a1, c0, c1, FL1, CL1, ops, true);
  bx(P.paint, mx(262), FL1, mz(447), mx(300), CL1, mz(530), 1);                                         // a pantry in the kitchen's corner
  IW(false, mz(620), mz(765), mx(292), mx(300));                                                        // kitchen | hall
  IW(false, mz(815), mz(1045), mx(292), mx(300));                                                       // dining, bedroom | hall
  IW(true, mx(85), mx(292), mz(750), mz(760), [[mx(122), mx(205), FL1, FL1 + 2.2]]);                     // kitchen | dining
  IW(true, mx(162), mx(185), mz(965), mz(975)); IW(true, mx(270), mx(292), mz(965), mz(975));           // dining | foyer
  IW(true, mx(162), mx(440), mz(1040), mz(1050), [[mx(175), mx(270), FL1, FL1 + 2.3]]);                 // foyer | living, bedroom
  bx(P.paint, mx(355), FL1, mz(790), mx(490), CL1, mz(845), 1);                                         // a linen closet behind the bath
  IW(true, mx(300), mx(355), mz(830), mz(845), [[mx(302), mx(352), FL1, FL1 + D]]);                     // the bedroom's door, at the end of the hall
  IW(false, mz(680), mz(790), mx(350), mx(362), [[mz(697), mz(742), FL1, FL1 + D]]);                    // the bath's door
  IW(true, mx(350), mx(490), mz(680), mz(690)); IW(true, mx(350), mx(490), mz(570), mz(578));            // round the stair
  IW(false, mz(447), mz(578), mx(350), mx(358));                                                        // ensuite | hall
  IW(true, mx(262), mx(490), mz(443), mz(451), [[mx(302), mx(350), FL1, FL1 + D], [mx(425), mx(480), FL1, FL1 + D]]);   // primary | hall, ensuite
  bx(P.paint, mx(270), FL1, mz(175), mx(305), CL1, mz(300), 1);                                         // the primary's closet
  bx(P.mirror, mx(305), FL1 + 0.05, mz(180), mx(305) + 0.02, FL1 + 2.2, mz(296));

  // kitchen: cherry cabinets round the sink under the window and down the left wall, a range, the fridge, the pantry, an
  // island with a butcher-block top, a round glass table for breakfast
  const KL = mx(85), KB = HZ0 + 0.18, CT = FL1 + 0.88;
  bx(P.cherry, KL, FL1, KB, -2.2, CT, KB + 0.62); bx(P.cherry, KL, FL1, KB + 0.62, KL + 0.62, CT, mz(520)); bx(P.cherry, KL, FL1, mz(560), KL + 0.62, CT, mz(625));
  bx(P.butcher, KL, CT, KB, -2.17, CT + 0.05, KB + 0.65); bx(P.butcher, KL, CT, KB + 0.65, KL + 0.65, CT + 0.05, mz(520)); bx(P.butcher, KL, CT, mz(560), KL + 0.65, CT + 0.05, mz(625));
  bx(P.steel, -3.85, CT + 0.051, KB + 0.1, -3.05, CT + 0.052, KB + 0.52); bx(P.steel, -3.5, CT + 0.05, KB + 0.03, -3.42, CT + 0.35, KB + 0.1);
  bx(P.mosaic, KL, CT + 0.05, KB + 0.65, KL + 0.017, FL1 + 1.45, mz(625));
  bx(P.steel, KL, FL1, mz(520), KL + 0.66, CT + 0.06, mz(560)); bx(P.black, KL + 0.05, CT + 0.06, mz(520) + 0.05, KL + 0.6, CT + 0.08, mz(560) - 0.05);
  bx(P.cherry, KL, FL1 + 1.45, KB, KL + 0.36, FL1 + 2.3, mz(520)); bx(P.cherry, KL, FL1 + 1.45, mz(560), KL + 0.36, FL1 + 2.3, mz(625));
  bx(P.steel, KL, FL1 + 1.5, mz(520), KL + 0.4, FL1 + 1.9, mz(560)); bx(P.cherry, KL, FL1 + 1.9, mz(520), KL + 0.36, FL1 + 2.3, mz(560));
  bx(P.steel, KL, FL1, mz(625), KL + 0.75, FL1 + 1.8, mz(680)); bx(P.cherry, KL, FL1 + 1.8, mz(625), KL + 0.62, FL1 + 2.3, mz(680));
  bx(P.cherry, KL, FL1, mz(683), KL + 0.62, FL1 + 2.3, mz(748));
  bx(P.cherry, -2.7, FL1 + 0.08, 12.07, -1.4, CT, 12.77); bx(P.black, -2.66, FL1, 12.11, -1.44, FL1 + 0.08, 12.73); rbox(P.butcher, -2.8, CT, 11.97, -1.3, CT + 0.06, 12.87, 0.012);
  { const hz = (x, y, z, d) => bx(P.steel, x - 0.07, y, z, x + 0.07, y + 0.018, z + d), vt = (x, y, z, d) => bx(P.steel, x, y, z - 0.07, x + d, y + 0.018, z + 0.07);
    const sz = (x, y0, y1, z, d) => bx(P.black, x - 0.002, y0, z, x + 0.002, y1, z + d), sx = (x, y0, y1, z, d) => bx(P.black, x, y0, z - 0.002, x + d, y1, z + 0.002);
    for (let x = KL + 0.9; x < -2.3; x += 0.48) { hz(x, CT - 0.13, KB + 0.62, 0.025); sz(x + 0.24, FL1 + 0.1, CT - 0.03, KB + 0.62, 0.002); }
    for (const [z0, z1] of [[KB + 0.65, mz(520)], [mz(560), mz(625)]]) for (let z = z0 + 0.22; z < z1 - 0.1; z += 0.44) { vt(KL + 0.62, CT - 0.13, z, 0.025); sx(KL + 0.62, FL1 + 0.1, CT - 0.03, z + 0.22, 0.002); }
    for (let z = KB + 0.25; z < mz(625) - 0.1; z += 0.44) if (z < mz(515) || z > mz(565)) { vt(KL + 0.36, FL1 + 1.52, z, 0.02); sx(KL + 0.36, FL1 + 1.47, FL1 + 2.28, z + 0.22, 0.002); }
    for (const z of [mz(700), mz(730)]) vt(KL + 0.62, FL1 + 0.95, z, 0.025);
    for (const x of [-2.4, -1.75]) hz(x, CT - 0.13, 12.77, 0.025);
    bx(P.black, KL + 0.58, FL1, KB + 0.62, KL + 0.62, FL1 + 0.08, mz(520)); bx(P.black, KL + 0.58, FL1, mz(560), KL + 0.62, FL1 + 0.08, mz(625)); bx(P.black, KL + 0.62, FL1, KB + 0.58, -2.2, FL1 + 0.08, KB + 0.62); }
  rtable(-2.55, 15.0, 0.5, FL1 + 0.74, P.glass); for (let a = 0.4; a < TAU; a += TAU / 4) chair(-2.55 + cos(a) * 0.72, 15.0 + sin(a) * 0.72, P.fabric);
  lit(-3.3, CL1, 11.4); lit(-1.6, CL1, 11.4); lit(-3.3, CL1, 13.3); lit(-1.6, CL1, 13.3); pendant(-2.55, 15.0, 0.2);
  // the back door, open into the kitchen
  bx(P.white, mx(250) - 0.05, FL1, KB, mx(250), FL1 + D, KB + 0.85);
  // dining: a glass table, six chairs, a ring chandelier, a console and a mirror on the wall, a rug
  bx(P.rug, -3.75, FL1, 16.95, -0.75, FL1 + 0.012, 19.45);
  { const cx = -2.25, cz = 18.2; bx(P.glass, cx - 0.9, FL1 + 0.73, cz - 0.48, cx + 0.9, FL1 + 0.75, cz + 0.48);
    for (const [ox, oz] of [[-0.8, -0.43], [0.8, -0.43], [-0.8, 0.43], [0.8, 0.43]]) bx(P.black, cx + ox - 0.02, FL1, cz + oz - 0.02, cx + ox + 0.02, FL1 + 0.73, cz + oz + 0.02);
    for (const ox of [-0.45, 0.45]) { chair(cx + ox, cz - 0.75, P.fabric, 0, -1); chair(cx + ox, cz + 0.75, P.fabric, 0, 1); }
    chair(cx - 1.25, cz, P.fabric, -1, 0); chair(cx + 1.25, cz, P.fabric, 1, 0);
    for (let a = 0; a < TAU; a += TAU / 10) bx(P.light, cx + cos(a) * 0.38 - 0.03, FL1 + 1.85, cz + sin(a) * 0.38 - 0.03, cx + cos(a) * 0.38 + 0.03, FL1 + 1.9, cz + sin(a) * 0.38 + 0.03);
    bx(P.black, cx - 0.01, FL1 + 1.9, cz - 0.01, cx + 0.01, CL1, cz + 0.01); }
  bx(P.black, KL, FL1 + 0.76, 17.3, KL + 0.38, FL1 + 0.8, 18.9); bx(P.black, KL, FL1, 17.32, KL + 0.36, FL1 + 0.76, 17.36); bx(P.black, KL, FL1, 18.84, KL + 0.36, FL1 + 0.76, 18.88);
  bx(P.black, KL, 1.62, 17.6, KL + 0.03, 2.38, 18.6); bx(P.mirror, KL, 1.66, 17.64, KL + 0.035, 2.34, 18.56); art(false, 17.7, 19.3, mx(292) - 0.03, 1.35, 2.25, 0.03);
  plant(KL + 0.2, FL1 + 0.8, 18.08, 0.07, 0.28);
  // the foyer: a light, a mat
  lit(-1.5, CL1, 20.5); bx(P.rug, -2.85, FL1, 20.25, -2.1, FL1 + 0.012, 21.25);
  // living room: the brick fireplace with a white mantel, a round mirror over it and shelves built in either side; a sofa
  // facing it, an armchair by the bay, a low table, a rug
  const FX = mx(430);
  bx(P.brick, FX - 0.5, FL1, 22.6, FX, FL1 + 1.3, 24.06); bx(P.brick, FX - 0.95, FL1, 22.5, FX, FL1 + 0.08, 24.16);
  bx(P.black, FX - 0.52, FL1 + 0.12, 23.0, FX - 0.49, FL1 + 0.82, 23.66); bx(P.trim, FX - 0.62, FL1 + 1.3, 22.5, FX, FL1 + 1.38, 24.16);
  bx(P.paint, FX - 0.42, FL1 + 1.38, 22.6, FX, CL1, 24.06); latX(P.mirror, [[0, 0], [0.3, 0], [0.3, 0.02], [0, 0.02]], 36, FX - 0.44, 2.33, 23.33); latX(P.steel, [[0.29, 0], [0.37, 0], [0.37, 0.03], [0.29, 0.03]], 36, FX - 0.45, 2.33, 23.33);
  for (const [z0, z1] of [[21.5, 22.5], [24.16, 25.05]]) { bx(P.trim, FX - 0.36, FL1, z0, FX, FL1 + 2.2, z0 + 0.04); bx(P.trim, FX - 0.36, FL1, z1 - 0.04, FX, FL1 + 2.2, z1);
    for (let y = FL1 + 0.05; y < FL1 + 2.3; y += 0.44) { bx(P.trim, FX - 0.36, y, z0, FX, y + 0.03, z1); if (y > FL1 + 0.4) art(false, z0 + 0.1, z0 + 0.1 + rr(0.2, 0.5), FX - 0.3, y + 0.03, y + rr(0.15, 0.28), 0.22); } }
  bx(P.rug, -1.9, FL1, 22.15, 2.0, FL1 + 0.012, 24.75);
  sofa(-2.92, 22.3, -1.98, 24.6, 1, FL1); bx(P.pale, -0.9, FL1 + 0.36, 22.85, 0.3, FL1 + 0.4, 23.85); bx(P.pale, -0.85, FL1, 22.9, 0.25, FL1 + 0.36, 23.8);
  lat(P.glass, [[0, 0], [0.06, 0], [0.08, 0.12], [0.05, 0.2], [0.045, 0.22], [0, 0.21]], 16, -0.4, FL1 + 0.4, 23.3); leafy(-0.4, FL1 + 0.6, 23.3, 0.26);
  armchair(1.2, 24.35); lit(0.2, CL1, 23.3); art(true, 0.2, 1.6, mz(1050), 1.3, 2.2, 0.03);
  // the primary bedroom: the bed against the party wall, nightstands and lamps, a dresser, a plant by the sliding door
  bed(HY - 0.51, 8.28, 1.65, 2.1, -1, FL1); dresser(mx(270), 8.5, 10.2, 1); lit(2.2, CL1, 8.2);
  plant(1.1, FL1, 6.25, 0.2, 1.1); art(false, 8.6, 10.0, mx(270) + 0.03, 1.5, 2.25, -0.03);
  // the front bedroom
  bed(HY - 0.51, 19.55, 1.5, 2.05, -1, FL1); lit(2.5, CL1, 19.5); art(false, 18.4, 19.4, mx(300) + 0.0, 1.4, 2.0, 0.03);
  // the bath: a tub along the wall, a pedestal sink and mirror, the toilet
  const BT = mz(790);
  rbox(P.china, mx(450), FL1, mz(695), mx(490), FL1 + 0.55, BT - 0.05, 0.06); rbox(P.mirror, mx(450) + 0.1, FL1 + 0.5, mz(695) + 0.12, mx(490) - 0.1, FL1 + 0.552, BT - 0.17, 0.02); lat(P.steel, [[0.02, 0], [0.02, 0.12], [0, 0.13]], 8, (mx(450) + mx(490)) / 2, FL1 + 0.55, BT - 0.1); bx(P.tile, mx(450) - 0.02, FL1 + 0.55, mz(695), mx(490), FL1 + 2.0, mz(697));
  bx(P.tile, mx(490) - 0.02, FL1 + 0.55, mz(695), mx(490), FL1 + 2.0, BT - 0.05);
  toilet(2.9, BT - 0.05, 0, -1, FL1); sink(2.0, BT - 0.05, -1, FL1); bx(P.mirror, 1.75, 1.35, BT - 0.07, 2.3, 2.15, BT - 0.05); lit(3.0, CL1, 15.9);
  // the ensuite: a tiled shower, a vanity and mirror, the toilet
  bx(P.tile, mx(358), FL1, mz(522), mx(412), FL1 + 2.05, mz(527)); bx(P.tile, mx(412) - 0.05, FL1, mz(451), mx(412), FL1 + 2.05, mz(527));
  bx(P.steel, mx(380), FL1 + 1.9, mz(455), mx(385), FL1 + 2.0, mz(470));
  bx(P.cherry, mx(490) - 0.55, FL1, 10.95, mx(490), FL1 + 0.8, 11.85); bx(P.stone, mx(490) - 0.57, FL1 + 0.8, 10.93, mx(490), FL1 + 0.84, 11.87);
  bx(P.china, mx(490) - 0.45, FL1 + 0.84, 11.2, mx(490) - 0.12, FL1 + 0.86, 11.6); bx(P.mirror, mx(490) - 0.02, 1.35, 11.0, mx(490), 2.1, 11.8);
  toilet(mx(490), 12.45, 1, 0, FL1); lit(3.4, CL1, 11.8);
  // the hall: lights, pictures; round the stair's hole a white rail
  lit(0.72, CL1, 12.2); lit(0.72, CL1, 15.6); art(false, 14.9, 15.9, mx(300) - 0.0, 1.3, 2.1, -0.03);
  // the stair: solid steps, painted, with oak treads; under the upper flight a closet. White rails on the open sides, and
  // round the hole upstairs where it is not walled
  { const step = (x0, x1, z0, z1, top, nose) => { bx(P.paint, x0, FL0, z0, x1, top - 0.03, z1); bx(P.oak, x0 + min(nose, 0), top - 0.03, z0, x1 + max(nose, 0), top, z1); };
    for (let i = 1; i <= 7; i++) step(HOLE[0] + (i - 1) * ST, HOLE[0] + i * ST, SM, HOLE[3], FL0 + i * RS, -0.02);
    step(SL, HOLE[2], HOLE[1], HOLE[3], FL0 + 8 * RS, -0.02);
    for (let i = 9; i <= 15; i++) step(SL - (i - 8) * ST, SL - (i - 9) * ST, HOLE[1], SM, FL0 + i * RS, 0.02);
    // (the camera keeps out from under them)
    HB.push(HOLE[0], FL0, HOLE[1], SL, FL0 + 8 * RS, SM - 0.02, HOLE[0], FL0, HOLE[1], HOLE[0] + 0.8, FL0 + 12.5 * RS - 0.4, SM - 0.02, SL, FL0, HOLE[1], HOLE[2], FL0 + 8 * RS - 0.45, HOLE[3]);
    // rails: up the lower flight's open side, along the upper flight's edge over it, round the hole upstairs
    const rail = (pts, posts) => { aux(I, P.trim / 127, () => { I.tube(pts, 0.025, 6); for (const [x, y, z] of posts) I.tube([[x, y - 0.9, z], [x, y, z]], 0.012, 4, false); }); };
    const lo = [], up = [];
    for (let i = 1; i <= 7; i++) lo.push([HOLE[0] + (i - 0.5) * ST, FL0 + i * RS + 0.9, HOLE[3] - 0.05]);
    for (const x of [SL + 0.3, SL + 0.62, HOLE[2] - 0.05]) lo.push([x, FL0 + 8 * RS + 0.9, HOLE[3] - 0.05]);
    for (let i = 9; i <= 15; i++) up.push([SL - (i - 8.5) * ST, FL0 + i * RS + 0.9, SM]);
    rail(lo, lo); rail(up, up); HB.push(HOLE[0], FL0, HOLE[3] - 0.07, HOLE[2], FL0 + 8 * RS + 0.9, HOLE[3] - 0.03);
    const y = FL1 + 0.95, gp = [];
    for (let z = SM + 0.1; z < HOLE[3]; z += 0.13) gp.push([HOLE[0] + 0.02, y, z]);
    rail([[HOLE[0] + 0.02, y, SM], [HOLE[0] + 0.02, y, HOLE[3]]], gp); HB.push(HOLE[0], FL1, SM, HOLE[0] + 0.04, y, HOLE[3]);
    gp.length = 0; for (let z = HOLE[1] + 0.1; z < HOLE[3]; z += 0.13) gp.push([HOLE[2] - 0.02, y, z]);
    rail([[HOLE[2] - 0.02, y, HOLE[1]], [HOLE[2] - 0.02, y, HOLE[3]]], gp); HB.push(HOLE[2] - 0.04, FL1, HOLE[1], HOLE[2], y, HOLE[3]);
    bx(P.trim, HOLE[0] - 0.02, CL0 - 0.02, HOLE[3] - 0.02, HOLE[2] + 0.02, FL1, HOLE[3]); bx(P.trim, HOLE[2] - 0.02, CL0 - 0.02, HOLE[1], HOLE[2], FL1, HOLE[3]);
    bx(P.trim, HOLE[0] - 0.02, CL0 - 0.02, HOLE[1], HOLE[2] + 0.02, FL1, HOLE[1] + 0.02); bx(P.trim, HOLE[0], CL0 - 0.02, SM, HOLE[0] + 0.02, FL1, HOLE[3]);
    bx(P.white, HOLE[0] - 0.02, FL0, HOLE[1] + 0.12, HOLE[0], FL0 + D, SM - 0.12); bx(P.steel, HOLE[0] - 0.05, FL0 + 1.0, SM - 0.25, HOLE[0] - 0.02, FL0 + 1.04, SM - 0.21); }   // the closet's door

  // ---------------------------------------------------------------- the ground floor
  const GF = [[-HY + 0.1, HZ0, HY - 0.1, HZ1 - 0.05]];
  slab(I, P.concrete, GF, FL0 - 0.3, FL0 - 0.006);
  bx(P.carpet, gx(140), FL0 - 0.03, gz(100), gx(420), FL0, gz(370)); bx(P.tile, gx(505), FL0 - 0.03, gz(100), gx(690), FL0, gz(292));
  bx(P.oak, gx(140), FL0 - 0.03, gz(365), gx(690), FL0, gz(610)); bx(P.oak, gx(420), FL0 - 0.03, gz(285), gx(690), FL0, gz(370)); bx(P.oak, gx(420), FL0 - 0.03, gz(100), gx(505), FL0, gz(290));
  // its outside walls are the hill's retaining walls: painted in the rooms, bare framing in the garage
  const GL = gx(140), GR = gx(690), GZB = gz(105);
  const WW = [-3.1, -2.15, FL0 + 0.8, FL0 + 2.2];
  wall(I, P.paint, true, -HY + 0.1, HY - 0.1, HZ0, GZB, FL0, CL0, [WW], true); HB.push(WW[0], WW[2], HZ0, WW[1], WW[3], GZB); pane(true, WW[0], WW[1], HZ0 + 0.27, WW[2], WW[3]);
  frame(P.brown, true, WW[0], WW[1], HZ0, HZ0 + 0.27, WW[2], WW[3], true, 0.025, 0); frame(P.trim, true, WW[0], WW[1], HZ0 + 0.27, GZB, WW[2], WW[3], false, 0, 0.025);
  // the window well outside it, dug under the deck: concrete walls, gravel at the bottom, a steel grate over it at the deck
  { const [x0, z0, x1, z1] = WELL, yb = FL0 + 0.6, yt = 0.24;
    bx(P.concrete, x0, yb - 0.3, z0, x0 + 0.12, yt, z1); bx(P.concrete, x1 - 0.12, yb - 0.3, z0, x1, yt, z1); bx(P.concrete, x0 + 0.12, yb - 0.3, z0, x1 - 0.12, yt, z0 + 0.12);
    bx(P.stone, x0 + 0.12, yb - 0.3, z0 + 0.12, x1 - 0.12, yb, z1 - 0.05);
    bx(P.steel, x0, yt, z0, x1, 0.3, z0 + 0.04); bx(P.steel, x0, yt, z1 - 0.09, x1, 0.3, z1 - 0.05); bx(P.steel, x0, yt, z0, x0 + 0.04, 0.3, z1 - 0.05); bx(P.steel, x1 - 0.04, yt, z0, x1, 0.3, z1 - 0.05);
    for (let x = x0 + 0.08; x < x1 - 0.05; x += 0.05) bx(P.steel, x, yt + 0.01, z0 + 0.04, x + 0.012, 0.295, z1 - 0.09);
    for (let z = z0 + 0.4; z < z1 - 0.3; z += 0.4) bx(P.steel, x0 + 0.04, yt, z, x1 - 0.04, yt + 0.02, z + 0.02); }
  wall(I, P.paint, false, GZB, gz(615), -HY + 0.1, GL, FL0, CL0, [], true); wall(I, P.paint, false, GZB, gz(678), GR, HY - 0.1, FL0, CL0, [], true);
  wall(I, P.stud, false, gz(615), mz(975), -HY + 0.1, GL, FL0, CL0); wall(I, P.stud, false, gz(678), gz(930), GR, HY - 0.1, FL0, CL0);
  wall(I, P.stud, false, mz(975), 25.15, gx(245), gx(258), FL0, CL0); wall(I, P.stud, false, gz(930), 25.15, gx(590), gx(620), FL0, CL0);   // (ending inside the front wall)
  wall(I, P.stud, true, -HY + 0.1, gx(258), 21.3, 21.42, FL0, CL0); wall(I, P.stud, true, -HY + 0.1, gx(245), mz(975) - 0.1, mz(975), FL0, CL0);
  bx(P.stucco, -3.2, FL0 - 0.12, 21.4, -2.92, FL1, HZ1, 1);   // under the living room's wall, beside the steps
  for (let z = gz(680); z < HZ1 - 0.3; z += 0.41) { if (z < mz(975)) bx(P.stud, GL, FL0, z, GL + 0.09, CL0, z + 0.04); else bx(P.stud, gx(258), FL0, z, gx(258) + 0.09, CL0, z + 0.04);
    if (z > gz(930)) bx(P.stud, gx(590) - 0.09, FL0, z, gx(590), CL0, z + 0.04); }
  for (let x = GL; x < GR; x += 0.41) bx(P.stud, x, CL0 - 0.24, gz(678), x + 0.05, CL0, HZ1 - 0.25);   // joists over the garage
  bx(P.stud, GL, CL0 - 0.012, gz(678), GR, CL0 - 0.002, HZ1 - 0.25);
  // the rooms
  const GW = (alongX, a0, a1, c0, c1, ops) => wall(I, P.paint, alongX, a0, a1, c0, c1, FL0, CL0, ops, true);
  GW(false, GZB, gz(375), gx(410), gx(430), [[gz(175), gz(240), FL0, FL0 + D]]);                         // bedroom | hall
  GW(true, GL, gx(430), gz(355), gz(375));                                                              // bedroom | living
  GW(false, GZB, gz(292), gx(505), gx(518), [[gz(165), gz(232), FL0, FL0 + D]]);                         // bath | hall
  GW(true, gx(505), GR, gz(280), gz(292));                                                              // bath | stair
  GW(true, GL, gx(320), gz(600), gz(615));                                                              // living | utilities
  bx(P.paint, gx(320), FL0, gz(515), gx(430), CL0, gz(678), 1);                                         // the chimney
  GW(true, gx(215), gx(320), gz(670), gz(678));                                                         // utilities | garage
  GW(true, gx(430), GR, gz(655), gz(678), [[gx(436), gx(495), FL0, FL0 + D]]);                           // bar | garage
  // bedroom, living room, bath
  bed(GL, 12.45, 1.5, 2.05, 1, FL0); lit(-2.3, CL0, 12.4); art(false, 11.6, 13.2, GL + 0.0, -1.3, -0.6, 0.03);
  bx(P.rug, -4.2, FL0, 14.5, -1.4, FL0 + 0.012, 16.6); sofa(GL, 14.7, GL + 0.9, 16.5, 1, FL0); lit(-2.6, CL0, 15.5);
  bx(P.fabric, -2.75, FL0, 15.35, -2.15, FL0 + 0.4, 15.95); art(false, 14.9, 16.3, GL + 0.0, -1.4, -0.6, 0.03); art(true, -3.6, -2.4, gz(600) - 0.03, -1.35, -0.75, 0.03);
  toilet(gx(645), gz(280), 0, -1, FL0); sink(gx(552), gz(280), -1, FL0); bx(P.mirror, gx(530), -1.55, gz(280) - 0.02, gx(575), -0.75, gz(280)); lit(3.0, CL0, 12.1);
  bx(P.tile, gx(518), FL0, gz(162), gx(560), FL0 + 2.0, gz(168)); bx(P.steel, gx(600), FL0 + 1.9, gz(108), gx(605), FL0 + 2.0, gz(125));
  // the bar: white cabinets and a stone top with a sink down the side wall, a little fridge, cabinets over
  const BR = GR, BC = FL0 + 0.9;
  bx(P.white, BR - 0.62, FL0, gz(500), BR, BC, gz(605)); bx(P.white, gx(580), FL0, gz(605), BR, BC, gz(655));
  bx(P.stone, BR - 0.65, BC, gz(497), BR, BC + 0.04, gz(608)); bx(P.stone, gx(578), BC, gz(605), BR, BC + 0.04, gz(655));
  bx(P.steel, BR - 0.5, BC + 0.041, gz(545), BR - 0.15, BC + 0.042, gz(580)); bx(P.steel, BR - 0.62, FL0, 15.0, BR, FL0 + 0.88, 15.62);
  bx(P.white, BR - 0.36, FL0 + 1.5, 15.0, BR, CL0 - 0.05, gz(605)); lit(2.2, CL0, 15.2); lit(2.2, CL0, 16.6);
  for (const [z, s] of [[gz(470), 0], [gz(530), 1]]) { bx(P.black, BR - 0.95 - s * 0.6, FL0, z - 0.2, BR - 0.6 - s * 0.6, FL0 + 0.04, z + 0.2); bx(P.fabric, BR - 0.95 - s * 0.6, FL0 + 0.65, z - 0.2, BR - 0.6 - s * 0.6, FL0 + 0.72, z + 0.2); }
  // utilities: a water heater, a furnace; the laundry: washer, dryer, a sink; the garage: bins, shelves, the door rolled up
  lat(P.china, [[0, 0], [0.3, 0], [0.3, 1.45], [0.25, 1.52], [0, 1.53]], 16, -2.2, FL0, 17.45);
  bx(P.china, -3.3, FL0, 17.15, -2.7, FL0 + 1.4, 17.72); lit(-3.4, CL0, 17.45, 0.2);
  for (const x of [gx(580), gx(635)]) { bx(P.china, x, FL0, gz(680), x + 0.7, FL0 + 0.92, gz(733)); bx(P.black, x + 0.15, FL0 + 0.6, gz(733), x + 0.55, FL0 + 0.85, gz(733) + 0.01); }
  bx(P.china, gx(528), FL0 + 0.5, gz(680), gx(565), FL0 + 0.88, gz(715)); bx(P.steel, gx(530), FL0, gz(690), gx(533), FL0 + 0.5, gz(693));
  for (const [i, t] of [[0, P.bin], [1, P.binG], [2, P.binB]]) { const z = 22.2 + i * 0.75; bx(t, 2.05, FL0, z, 2.75, FL0 + 1.0, z + 0.65); bx(t, 2.03, FL0 + 1.0, z - 0.02, 2.77, FL0 + 1.06, z + 0.67); }
  for (let y = FL0 + 0.4; y < CL0 - 0.2; y += 0.55) bx(P.stud, gx(258), y, 21.6, gx(258) + 0.45, y + 0.03, 24.6);
  for (let i = 0; i < 9; i++) { const y = FL0 + 0.43 + (i % 3) * 0.55, z = 21.75 + (i / 3 | 0) * 0.95 + rr(0, 0.2); bx(i % 2 ? P.brown : P.white, gx(258) + 0.03, y, z, gx(258) + 0.4, y + rr(0.2, 0.42), z + rr(0.35, 0.6)); }
  bx(P.white, gx(330), CL0 - 0.32, 22.5, gx(520), CL0 - 0.27, HZ1 - 0.3); lit(0.2, CL0 - 0.27, 20.5, 0.18); lit(0.2, CL0 - 0.27, 23.2, 0.18);

  HBA = Float32Array.from(HB);

  // ---------------------------------------------------------------- furniture
  // a box with rounded edges, radius r: a cube's faces in a grid that is pushed out round an inner box. Vertices on the
  // seams are shared, so it shades smoothly round its edges
  function rbox(t, x0, y0, z0, x1, y1, z1, r) {
    const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], H = [abs(x1 - x0) / 2, (y1 - y0) / 2, abs(z1 - z0) / 2];
    r = min(r, H[0] * 0.95, H[1] * 0.95, H[2] * 0.95);
    const L = H.map((h) => [-h, -h + 0.3 * r, -h + r, h - r, h - 0.3 * r, h]), seen = new Map();
    const vid = (p) => {
      const k = p.map((v) => round(v * 1e4)).join(); let n = seen.get(k);
      if (n === undefined) {
        const q = p.map((v, a) => { const m = H[a] - r; return v < -m ? -m : v > m ? m : v; }), d = p.map((v, a) => v - q[a]), l = hypot(d[0], d[1], d[2]);
        const o = l > 1e-7 ? q.map((v, a) => v + d[a] / l * r) : p;
        n = I.v(c[0] + o[0], c[1] + o[1], c[2] + o[2], t / 127); seen.set(k, n);
      }
      return n;
    };
    for (let a = 0; a < 3; a++) for (const sg of [-1, 1]) {
      const b = (a + 1) % 3, e = (a + 2) % 3, V = (u, v) => { const p = [0, 0, 0]; p[a] = sg * H[a]; p[b] = L[b][u]; p[e] = L[e][v]; return vid(p); };
      for (let u = 0; u < 5; u++) for (let v = 0; v < 5; v++) { const q00 = V(u, v), q10 = V(u + 1, v), q11 = V(u + 1, v + 1), q01 = V(u, v + 1); if (sg > 0) I.quad(q00, q10, q11, q01); else I.quad(q00, q01, q11, q10); }
    }
  }
  // a lathed shape moved into place; latX turns it on its side, its axis along x (a round mirror on a wall)
  function lat(t, prof, seg, x, y, z) { const n = I.p.length; aux(I, t / 127, () => lathe(I, prof, seg)); for (let k = n; k < I.p.length; k += 3) { I.p[k] += x; I.p[k + 1] += y; I.p[k + 2] += z; } }
  function latX(t, prof, seg, x, y, z) { const n = I.p.length; aux(I, t / 127, () => lathe(I, prof, seg)); for (let k = n; k < I.p.length; k += 3) { const px = I.p[k], py = I.p[k + 1]; I.p[k] = x + py; I.p[k + 1] = y + px; I.p[k + 2] += z; } }
  // a round table top on a post and foot
  function rtable(x, z, r, y, t) { lat(t, [[0, 0], [r, 0], [r, 0.02], [0, 0.02]], 32, x, y, z); lat(P.black, [[0.025, 0], [0.025, y - FL1]], 10, x, FL1, z); lat(P.black, [[0, 0], [0.25, 0], [0.24, 0.02], [0, 0.03]], 20, x, FL1, z); }
  // an upholstered dining chair on the main floor, its back on the side (ex, ez)
  function chair(x, z, t, ex = 0, ez = 0) {
    const y = FL1;
    if (!ex && !ez) { const dx = x + 2.55, dz = z - 15.0, l = hypot(dx, dz); ex = dx / l; ez = dz / l; }
    rbox(t, x - 0.22, y + 0.42, z - 0.22, x + 0.22, y + 0.5, z + 0.22, 0.03);
    const bxc = x + ex * 0.2, bzc = z + ez * 0.2, hw = 0.21, ax = abs(ex) > abs(ez);
    rbox(t, ax ? bxc - 0.035 : x - hw, y + 0.48, ax ? z - hw : bzc - 0.035, ax ? bxc + 0.035 : x + hw, y + 0.97, ax ? z + hw : bzc + 0.035, 0.03);
    for (const [ox, oz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) lat(P.black, [[0.014, 0], [0.012, 0.43]], 6, x + ox, y, z + oz);
  }
  // a sofa along a wall: x0..x1 deep, its back at x0 (s = 1) or x1. A base, seat and back cushions, rolled arms, pillows
  function sofa(x0, z0, x1, z1, s, y) {
    const bk = s > 0 ? x0 : x1, fr = s > 0 ? x1 : x0, n = z1 - z0 > 1.9 ? 3 : 2, w = (z1 - z0 - 0.36) / n;
    rbox(P.fabric, x0, y + 0.08, z0, x1, y + 0.38, z1, 0.05); rbox(P.fabric, bk, y + 0.3, z0, bk + s * 0.24, y + 0.88, z1, 0.07);
    for (const za of [z0, z1 - 0.18]) rbox(P.fabric, x0, y + 0.08, za, x1, y + 0.64, za + 0.18, 0.08);
    for (let k = 0; k < n; k++) { const za = z0 + 0.18 + k * w; rbox(P.fabric, bk + s * 0.22, y + 0.36, za + 0.005, fr - s * 0.02, y + 0.5, za + w - 0.005, 0.05); rbox(P.fabric, bk + s * 0.18, y + 0.48, za + 0.01, bk + s * 0.38, y + 0.86, za + w - 0.01, 0.07); }
    for (const z of [z0 + 0.4, z1 - 0.72]) rbox(P.pillow, bk + s * 0.34, y + 0.5, z, bk + s * 0.5, y + 0.84, z + 0.32, 0.07);
    for (const za of [z0 + 0.05, z1 - 0.1]) for (const xa of [x0 + 0.05, x1 - 0.1]) bx(P.black, xa, y, za, xa + 0.05, y + 0.08, za + 0.05);
  }
  function armchair(x, z) {
    const y = FL1;
    rbox(P.fabric, x - 0.42, y + 0.08, z - 0.4, x + 0.42, y + 0.4, z + 0.4, 0.05); rbox(P.fabric, x - 0.42, y + 0.3, z + 0.18, x + 0.42, y + 0.85, z + 0.4, 0.07);
    for (const sx of [-1, 1]) rbox(P.fabric, x + sx * 0.42 - (sx > 0 ? 0.16 : 0), y + 0.08, z - 0.4, x + sx * 0.42 + (sx < 0 ? 0.16 : 0), y + 0.62, z + 0.4, 0.07);
    rbox(P.fabric, x - 0.27, y + 0.38, z - 0.38, x + 0.27, y + 0.5, z + 0.2, 0.05);
    for (const [ox, oz] of [[-0.37, -0.35], [0.33, -0.35], [-0.37, 0.31], [0.33, 0.31]]) bx(P.black, x + ox, y, z + oz, x + ox + 0.04, y + 0.08, z + oz + 0.04);
  }
  // a bed, its head against a wall at x (h = -1: the wall is on its +x side): a frame, a mattress, a turned-down duvet, a
  // headboard, pillows; nightstands with lamps
  function bed(x, z, w, l, h, y) {
    const x0 = h < 0 ? x - l : x, x1 = h < 0 ? x : x + l, hx = h < 0 ? x1 : x0, fx = h < 0 ? x0 : x1;
    rbox(P.pale, x0, y + 0.06, z - w / 2, x1, y + 0.32, z + w / 2, 0.02);
    for (const zz of [z - w / 2 + 0.04, z + w / 2 - 0.09]) bx(P.pale, fx - h * 0.04, y, zz, fx - h * 0.09, y + 0.06, zz + 0.05);
    rbox(P.linen, x0 + 0.04, y + 0.3, z - w / 2 + 0.03, x1 - 0.04, y + 0.56, z + w / 2 - 0.03, 0.06);
    rbox(P.linen, fx + h * 0.02, y + 0.36, z - w / 2 - 0.02, fx - h * 1.45, y + 0.62, z + w / 2 + 0.02, 0.07);
    rbox(P.linen, fx - h * 1.25, y + 0.55, z - w / 2 - 0.015, fx - h * 1.5, y + 0.64, z + w / 2 + 0.015, 0.04);
    rbox(P.pale, hx, y, z - w / 2 - 0.05, hx + h * 0.09, y + 1.15, z + w / 2 + 0.05, 0.03);
    for (const sd of [-1, 1]) {
      rbox(P.linen, hx + h * 0.1, y + 0.54, z + sd * w / 4 - 0.33, hx + h * 0.48, y + 0.78, z + sd * w / 4 + 0.33, 0.1);
      rbox(P.pillow, hx + h * 0.4, y + 0.56, z + sd * w / 4 - 0.22, hx + h * 0.56, y + 0.86, z + sd * w / 4 + 0.22, 0.07);
      const nz = z + sd * (w / 2 + 0.32);
      rbox(P.pale, hx + h * 0.02, y, nz - 0.25, hx + h * 0.48, y + 0.58, nz + 0.25, 0.015); bx(P.brown, hx + h * 0.48, y + 0.36, nz - 0.08, hx + h * 0.485, y + 0.38, nz + 0.08);
      lat(P.china, [[0, 0], [0.07, 0], [0.09, 0.08], [0.06, 0.16], [0.015, 0.17], [0, 0.17]], 14, hx + h * 0.25, y + 0.58, nz);
      lat(P.light, [[0.02, 0], [0.13, 0], [0.1, 0.22], [0.02, 0.22]], 18, hx + h * 0.25, y + 0.75, nz);
    }
  }
  function dresser(x, z0, z1, s) {
    rbox(P.pale, x, FL1 + 0.06, z0, x + s * 0.5, FL1 + 0.86, z1, 0.015);
    for (const z of [z0 + 0.04, z1 - 0.08]) for (const xx of [x + s * 0.04, x + s * 0.42]) bx(P.pale, min(xx, xx + s * 0.04), FL1, z, max(xx, xx + s * 0.04), FL1 + 0.06, z + 0.04);
    for (let y = FL1 + 0.32; y < FL1 + 0.86; y += 0.25) { bx(P.brown, x + s * 0.5, y - 0.003, z0 + 0.02, x + s * 0.503, y + 0.003, z1 - 0.02); for (const z of [z0 + 0.3, z1 - 0.3]) bx(P.steel, x + s * 0.5, y + 0.1, z - 0.06, x + s * 0.52, y + 0.12, z + 0.06); }
  }
  // a toilet: side 1, its tank against a wall on +x at x; else against a wall at z, the bowl on sz's side
  function toilet(x, z, side, sz, y) {
    if (side) { lat(P.china, [[0, 0], [0.12, 0], [0.16, 0.3], [0.2, 0.4], [0, 0.41]], 16, x - 0.42, y, z); rbox(P.china, x - 0.62, y + 0.4, z - 0.19, x - 0.2, y + 0.44, z + 0.19, 0.03); rbox(P.china, x - 0.22, y + 0.38, z - 0.24, x, y + 0.8, z + 0.24, 0.04); }
    else { lat(P.china, [[0, 0], [0.12, 0], [0.16, 0.3], [0.2, 0.4], [0, 0.41]], 16, x, y, z + sz * 0.42); rbox(P.china, x - 0.19, y + 0.4, z + sz * 0.62, x + 0.19, y + 0.44, z + sz * 0.2, 0.03); rbox(P.china, x - 0.24, y + 0.38, z + sz * 0.22, x + 0.24, y + 0.8, z, 0.04); }
  }
  // a pedestal sink and its tap
  function sink(x, z, sz, y) {
    lat(P.china, [[0.07, 0], [0.06, 0.4], [0.08, 0.72], [0, 0.73]], 12, x, y, z + sz * 0.22);
    rbox(P.china, x - 0.3, y + 0.74, z + sz * 0.48, x + 0.3, y + 0.88, z, 0.05); lat(P.steel, [[0.12, 0], [0.13, 0.005], [0, 0.006]], 16, x, y + 0.88, z + sz * 0.26);
    lat(P.steel, [[0.015, 0], [0.015, 0.14], [0, 0.15]], 8, x, y + 0.88, z + sz * 0.06); bx(P.steel, x - 0.01, y + 0.98, z + sz * 0.06, x + 0.01, y + 1.0, z + sz * 0.15);
  }
  function pendant(x, z, r) { bx(P.black, x - 0.005, FL1 + 1.95, z - 0.005, x + 0.005, CL1, z + 0.005); lat(P.light, [[0, 0], [r, 0], [r, 0.12], [0.03, 0.2], [0, 0.2]], 20, x, FL1 + 1.75, z); }
  // foliage: leaves arching out of a point and drooping at their tips
  function leafy(x, y, z, h) {
    aux(I, P.leaf / 127, () => { for (let i = 0; i < 18; i++) {
      const a = i * 2.39996, e = 0.25 + 0.75 * ((i * 0.618) % 1), r = h * (0.25 + 0.35 * e), up = h * (0.95 - 0.45 * e), c = cos(a), sn = sin(a);
      I.tube([[x, y, z], [x + c * r * 0.4, y + up * 0.75, z + sn * r * 0.4], [x + c * r * 0.8, y + up, z + sn * r * 0.8], [x + c * r, y + up * 0.8, z + sn * r]], (k) => [0.006, 0.014, 0.012, 0.003][k] * (0.6 + h), 4, false);
    } });
  }
  // a round terracotta pot with soil and a plant in it
  function plant(x, y, z, r, h) { lat(P.pot, [[0, 0], [r * 0.75, 0], [r, r * 1.6], [r * 1.08, r * 1.65], [r * 1.08, r * 1.8], [r * 0.95, r * 1.8], [0, r * 1.7]], 20, x, y, z); lat(P.concrete, [[0, 0], [r * 0.95, 0], [0, 0.005]], 14, x, y + r * 1.62, z); leafy(x, y + r * 1.6, z, h); }
}

// Is (x, y, z) within m of one of the house's walls?
function homeHit(x, y, z, m) {
  if (!HBA || x < -HY - 1 || x > HY + 1 || z < HAZ - 1 || z > 27 || y > RF1 + 1.2) return false;
  for (let i = 0; i < HBA.length; i += 6) if (x > HBA[i] - m && x < HBA[i + 3] + m && z > HBA[i + 2] - m && z < HBA[i + 5] + m && y > HBA[i + 1] - m && y < HBA[i + 4] + m) return true;
  return false;
}
// Over the house: the floor under (x, y, z) and the ceiling over it, in HFL and HCL. False elsewhere
let HFL = 0, HCL = 0;
function homeLevel(x, y, z) {
  const main = x > -HY && x < HY && z > HZ0 && z < HZ1, add = x > HAX && x < HY && z > HAZ && z <= HZ0, bay = x > mx(200) && x < mx(370) && z >= HZ1 && z < 25.96 && y > FL1 - 0.2;
  if (!main && !add && !bay) return false;
  if (main && z > 21.4 && x < -3.2) { const k = (z - 21.4) / (HZ1 - 21.4); HFL = FL1 + (FL0 - FL1) * (k < 0 ? 0 : k > 1 ? 1 : k); HCL = 99; return true; }   // the front steps
  if (main && z > 21.47 && x > 3.34) { HFL = FL1; HCL = 99; return true; }                                                                                      // the side terrace
  if (main && x > HOLE[0] && x < HOLE[2] && z > HOLE[1] && z < HOLE[3]) { HFL = stairAt(x, z); HCL = x > SKY[0] && x < SKY[2] && z > SKY[1] && z < SKY[3] ? RF1 : CL1; return true; }   // on the stair
  const roof = add ? RFA : bay ? 2.99 : RF1;
  if (y > roof - 0.35) { HFL = roof; HCL = 99; return true; }
  if (main && y < 0.16) { HFL = FL0; HCL = CL0; if (z > mz(975) - 0.1 && z < 21.42 && x < -3.2) HCL = CL0; return true; }
  HFL = FL1; HCL = x > SKY[0] && x < SKY[2] && z > SKY[1] && z < SKY[3] ? RF1 : CL1;
  return true;
}
