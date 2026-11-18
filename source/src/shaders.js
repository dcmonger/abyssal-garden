// ============================================================================
// WGSL sources
// ============================================================================

const W_NOISE = /*wgsl*/`
fn ss(a: f32, b: f32, x: f32) -> f32 { let t = clamp((x - a) / (b - a), 0., 1.); return t * t * (3. - 2. * t); }
fn h31(p: vec3f) -> f32 { var q = fract(p * vec3f(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
fn h33(p: vec3f) -> vec3f { var q = fract(p * vec3f(.1031, .1030, .0973)); q += dot(q, q.yxz + 33.33); return fract((q.xxy + q.yxx) * q.zyx); }
fn vn(p: vec3f) -> f32 {
  let i = floor(p); let f = fract(p); let u = f * f * (3. - 2. * f);
  return mix(mix(mix(h31(i), h31(i + vec3f(1., 0., 0.)), u.x), mix(h31(i + vec3f(0., 1., 0.)), h31(i + vec3f(1., 1., 0.)), u.x), u.y),
             mix(mix(h31(i + vec3f(0., 0., 1.)), h31(i + vec3f(1., 0., 1.)), u.x), mix(h31(i + vec3f(0., 1., 1.)), h31(i + vec3f(1., 1., 1.)), u.x), u.y), u.z);
}
fn fbm(p: vec3f, n: i32) -> f32 {
  var a = .5; var s = 0.; var q = p;
  for (var i = 0; i < n; i++) { s += a * vn(q); q = q * 2.03 + vec3f(17.1, 31.7, 5.3); a *= .5; }
  return s / (1. - 2. * a);
}
fn wor(p: vec3f) -> f32 {
  let i = floor(p); let f = fract(p); var d = 9.;
  for (var x = -1; x <= 1; x++) { for (var y = -1; y <= 1; y++) { for (var z = -1; z <= 1; z++) {
    let o = vec3f(f32(x), f32(y), f32(z)); let r = o + h33(i + o) - f; d = min(d, dot(r, r));
  } } }
  return sqrt(d);
}
`;

// ---------------------------------------------------------------- fullscreen helpers
const W_FS = /*wgsl*/`
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f { return vec4f(f32(i32(i & 1u) * 4 - 1), f32(i32(i >> 1u) * 4 - 1), 0., 1.); }
`;

// rock detail texture (tileable): rg = slope, b = height, a = mottling
const W_DETAIL = W_NOISE + W_FS + /*wgsl*/`
fn hp(p: vec2f, per: f32) -> f32 { return h31(vec3f(p - per * floor(p / per), per)); }
fn tn(p: vec2f, per: f32) -> f32 {
  let i = floor(p); let f = fract(p); let u = f * f * (3. - 2. * f);
  return mix(mix(hp(i, per), hp(i + vec2f(1., 0.), per), u.x), mix(hp(i + vec2f(0., 1.), per), hp(i + vec2f(1., 1.), per), u.x), u.y);
}
fn tf(uv: vec2f, per: f32, n: i32) -> f32 { var a = .5; var s = 0.; var pr = per; for (var i = 0; i < n; i++) { s += a * tn(uv * pr + f32(i) * 7.3, pr); pr *= 2.; a *= .5; } return s / (1. - 2. * a); }
fn tw(p: vec2f, per: f32) -> vec3f {
  let i = floor(p); let f = fract(p); var d = vec2f(9.); var id = 0.;
  for (var x = -1; x <= 1; x++) { for (var y = -1; y <= 1; y++) {
    let o = vec2f(f32(x), f32(y)); let c = i + o; let cw = c - per * floor(c / per);
    let hh = h33(vec3f(cw, per)); let r = o + hh.xy - f; let l = dot(r, r);
    if (l < d.x) { d.y = d.x; d.x = l; id = hh.z; } else if (l < d.y) { d.y = l; }
  } }
  return vec3f(sqrt(d), id);
}
fn H(uv: vec2f) -> f32 {
  let wq = uv + .11 * (vec2f(tf(uv, 3., 4), tf(uv + .5, 3., 4)) - .5);
  let f = tf(wq, 3., 8);
  let r1 = 1. - abs(tf(wq + 1.7, 5., 6) * 2. - 1.);
  let cr = min(abs(tf(wq + 4.1, 4., 5) * 2. - 1.) * 7., 1.);
  let cr2 = min(abs(tf(wq.yx + 2.3, 9., 4) * 2. - 1.) * 9., 1.);
  let pt = tw(wq * 29., 29.);
  let pit = (1. - ss(.0, .34, pt.x)) * step(.62, pt.z);
  return f * .50 + r1 * r1 * .24 + cr * cr2 * .26 - pit * .07;
}
@fragment fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let uv = fc.xy / 1024.; let e = 1. / 1024.;
  let h = H(uv);
  let gx = H(uv + vec2f(e, 0.)) - H(uv - vec2f(e, 0.)); let gy = H(uv + vec2f(0., e)) - H(uv - vec2f(0., e));
  let s = clamp(vec2f(gx, gy) * 1024. * .5 * .075, vec2f(-1.), vec2f(1.));
  return vec4f(-s * .5 + .5, h, tf(uv + 3.7, 3., 5));
}
`;

// blit / mip / bloom chain
const W_BLIT = W_FS + /*wgsl*/`
@group(0) @binding(0) var t: texture_2d<f32>;
@group(0) @binding(1) var s: sampler;
fn uvOf(fc: vec4f, k: f32) -> vec2f { return fc.xy * k / vec2f(textureDimensions(t)); }
@fragment fn fsMip(@builtin(position) fc: vec4f) -> @location(0) vec4f { return textureSampleLevel(t, s, uvOf(fc, 2.), 0.); }
fn kar(c: vec3f) -> vec4f { let w = 1. / (1. + max(c.r, max(c.g, c.b))); return vec4f(c * w, w); }
@fragment fn fsDown0(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let uv = uvOf(fc, 2.); let e = 1. / vec2f(textureDimensions(t));
  let a = kar(min(textureSampleLevel(t, s, uv + e * vec2f(-1., -1.), 0.).rgb, vec3f(24.)));
  let b = kar(min(textureSampleLevel(t, s, uv + e * vec2f(1., -1.), 0.).rgb, vec3f(24.)));
  let c = kar(min(textureSampleLevel(t, s, uv + e * vec2f(-1., 1.), 0.).rgb, vec3f(24.)));
  let d = kar(min(textureSampleLevel(t, s, uv + e * vec2f(1., 1.), 0.).rgb, vec3f(24.)));
  let m = a + b + c + d;
  return vec4f(m.rgb / m.a, 1.);
}
@fragment fn fsDown(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let uv = uvOf(fc, 2.); let e = 1. / vec2f(textureDimensions(t));
  return (textureSampleLevel(t, s, uv + e * vec2f(-1., -1.), 0.) + textureSampleLevel(t, s, uv + e * vec2f(1., -1.), 0.)
        + textureSampleLevel(t, s, uv + e * vec2f(-1., 1.), 0.) + textureSampleLevel(t, s, uv + e * vec2f(1., 1.), 0.)) * .25;
}
@fragment fn fsUp(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let uv = uvOf(fc, .5); let e = .75 / vec2f(textureDimensions(t));
  return (textureSampleLevel(t, s, uv + e * vec2f(-1., -1.), 0.) + textureSampleLevel(t, s, uv + e * vec2f(1., -1.), 0.)
        + textureSampleLevel(t, s, uv + e * vec2f(-1., 1.), 0.) + textureSampleLevel(t, s, uv + e * vec2f(1., 1.), 0.)) * .25;
}
`;

// dew texture (tileable, baked once): rg = slope of the droplet surface, b = droplet mask, a = droplet id
const W_DEW = W_NOISE + W_FS + /*wgsl*/`
fn drops(uv: vec2f, n: f32, keep: f32, r0: f32, r1: f32, sd: f32) -> vec4f {
  let p = uv * n; let i = floor(p); let f = fract(p);
  let h = h33(vec3f(i, sd)); let k = h33(vec3f(i, sd + 7.));
  let R = mix(r0, r1, k.y * k.y);
  let q = (f - (R + h.xy * (1. - 2. * R))) / R; let l = dot(q, q);
  if (k.x > keep || l >= 1.) { return vec4f(0.); }
  return vec4f(q * (.5 + l), 1. - ss(.7, 1., l), .1 + .9 * h.z);
}
@fragment fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let uv = fc.xy / ${WATER}.;
  let a = drops(uv, 9., .45, .2, .48, 1.); let b = drops(uv, 31., .7, .18, .45, 2.); let c = drops(uv + .013, 67., .5, .2, .42, 3.);
  if (a.b > .01) { return a; }
  if (b.b > .01) { return b; }
  return c;
}
`;

// ---------------------------------------------------------------- shared scene code
// G: vp view-projection, sm shadow matrix, cam xyz + time, right/up/fwd camera basis (+ tan fov, near)
//    sun  xyz direction, w dew (1 soaked .. 0 dry)        res  render size and its inverse
//    mis  x exposure, y shaft strength, z detail scale, w fog scale height (m)
//    fg   x fog density at the ground (1/m), y dawn 0..1, z growth 0..1, w wind strength
//    sc   rgb sunlight that makes it through the fog, w how direct it is (0 diffuse .. 1 clear)
//    ac   rgb light of the fog and sky, w cat head yaw    wd  xy wind direction, z cat head pitch
//    gl   rgb glow of the fog around the sun, w porch lamp
const S_G = /*wgsl*/`
struct G { vp: mat4x4f, sm: mat4x4f, cam: vec4f, right: vec4f, up: vec4f, fwd: vec4f, sun: vec4f, res: vec4f, mis: vec4f, fg: vec4f, sc: vec4f, ac: vec4f, wd: vec4f, gl: vec4f };
const TAU = 6.2831853;
const LOW = ${LV > 1};
const PL = vec3f(-1.45, 2.65, 9.95);
const PLC = vec3f(1., .52, .2);
fn sat(x: f32) -> f32 { return clamp(x, 0., 1.); }
fn ss(a: f32, b: f32, x: f32) -> f32 { let t = clamp((x - a) / (b - a), 0., 1.); return t * t * (3. - 2. * t); }
fn ign(p: vec2f) -> f32 { return fract(52.9829189 * fract(dot(p, vec2f(.06711056, .00583715)))); }
fn hs(x: f32) -> f32 { return fract(sin(x * 127.1) * 43758.5453); }
fn fin(c: vec3f) -> vec4f { return vec4f(min(max(c, vec3f(0.)), vec3f(40.)), 1.); }
// optical depth of the fog along a ray of length d: densest at the ground, thinning with height
// inside the garden's house (home.js), short of its outer walls
fn homeIn(p: vec3f) -> bool {
  let m = abs(p.x) < 5.1 && p.z > 10.3 && p.z < 25.2 && p.y > -3. && p.y < 3.5 && !(p.z > 21.3 && (p.x < -3.1 || p.x > 3.45));
  let a = p.x > -.6 && p.x < 5.1 && p.z > 5.75 && p.z <= 10.3 && p.y > 0. && p.y < 3.;
  let b = p.x > -1.95 && p.x < 1.85 && p.z >= 25.2 && p.z < 25.86 && p.y > 0. && p.y < 2.85;
  return m || a || b;
}
fn tau(ro: vec3f, rd: vec3f, d: f32) -> f32 {
  let a = max(rd.y * d / g.mis.w, -30.); let fl = abs(a) < 1e-3; let b = select(a, 1., fl);
  // plus a thin haze that only tells over long, nearly level paths: it hides where the world ends
  return g.fg.x * exp(-max(ro.y, 0.) / g.mis.w) * d * select((1. - exp(-b)) / b, 1. - a * .5, fl) + .0007 * d * (1. - ss(0., .2, rd.y));
}
// height of the streets (HT0 in math.js, less the storey the blocks stand above them): vehicles stay on the streets
fn ht(p: vec2f) -> f32 {
  let q = p - vec2f(${TANK[0]}., ${TANK[1]}.);
  return ss(62., 170., length(p + vec2f(0., 14.))) * (6. + 16. * ss(-80., 420., p.x) + 34. * exp(-dot(q, q) / 45000.) + 5. * sin(p.x * .012 + p.y * .007 + 1.) * sin(p.y * .011 - p.x * .004 + 2.)
    + 2.5 * sin(p.x * .031 + .5) * sin(p.y * .027 + 1.3)) - ${STEP.toFixed(2)};   // (without the pond, where nothing drives)
}
fn hg(mu: f32, k: f32) -> f32 { return (1. - k * k) / (12.566 * pow(1. + k * k - 2. * k * mu, 1.5)); }
// the fog's own light in direction rd (scattered many times): brighter overhead and around the sun
fn fogCol(rd: vec3f) -> vec3f {
  let m = max(dot(rd, g.sun.xyz), 0.); let m2 = m * m;
  return g.ac.rgb * (.84 + .26 * rd.y) + g.gl.rgb * (.2 + .5 * m2 + 1.1 * m2 * m2 * m2 * m2);
}
`;

const S_B = S_G + /*wgsl*/`
@group(0) @binding(0) var<uniform> g: G;
@group(0) @binding(1) var sR: sampler;
@group(0) @binding(2) var sC: sampler;
@group(0) @binding(3) var sS: sampler_comparison;
@group(0) @binding(4) var tSh: texture_depth_2d;
@group(0) @binding(5) var tW: texture_2d<f32>;
@group(0) @binding(6) var tD: texture_2d<f32>;
@group(0) @binding(7) var tV: texture_3d<f32>;
@group(0) @binding(8) var tM: texture_2d<f32>;
fn shUV(p: vec3f) -> vec3f { let s = g.sm * vec4f(p, 1.); return vec3f(s.x * .5 + .5, .5 - s.y * .5, s.z - .00025); }
fn shIn(s: vec3f) -> bool { return max(abs(s.x - .5), abs(s.y - .5)) < .5; }   // outside the shadow map everything is lit
fn shEdge(s: vec3f) -> f32 { return ss(.36, .49, max(abs(s.x - .5), abs(s.y - .5))); }   // shadows fade out before the map ends
fn shadow1(p: vec3f) -> f32 { let s = shUV(p); return mix(select(1., textureSampleCompareLevel(tSh, sS, s.xy, s.z), shIn(s)), 1., shEdge(s)); }
fn shadow4(p: vec3f) -> f32 {
  if (LOW) { return shadow1(p); }
  let s = shUV(p); let e = 1.5 / ${SHADOW}.;
  return mix((textureSampleCompareLevel(tSh, sS, s.xy + vec2f(-e, -e), s.z) + textureSampleCompareLevel(tSh, sS, s.xy + vec2f(e, -e), s.z)
        + textureSampleCompareLevel(tSh, sS, s.xy + vec2f(-e, e), s.z) + textureSampleCompareLevel(tSh, sS, s.xy + vec2f(e, e), s.z)) * select(0., .25, shIn(s)) + select(1., 0., shIn(s)), 1., shEdge(s));
}
// nine taps, spread wider while the fog still diffuses the sun
fn shadow9(p: vec3f) -> f32 {
  if (LOW) { return shadow1(p); }
  let s = shUV(p); let e = (1.4 + 11. * (1. - g.sc.w)) / ${SHADOW}.; var a = 0.;
  for (var x = -1; x <= 1; x++) { for (var y = -1; y <= 1; y++) { a += textureSampleCompareLevel(tSh, sS, s.xy + vec2f(f32(x), f32(y)) * e, s.z); } }
  return mix(select(1., a / 9., shIn(s)), 1., shEdge(s));
}
// light from the fog all around: mostly from above, a little more from the sun's side, earth tones from below
fn amb(n: vec3f) -> vec3f {
  let up = n.y * .5 + .5; let sd = .5 + .5 * dot(n, normalize(vec3f(g.sun.x, .3, g.sun.z)));
  return g.ac.rgb * (.32 + .74 * up * up) + g.gl.rgb * (sd * sd * 1.2) + g.ac.rgb * vec3f(.10, .075, .05) * (1. - up);
}
fn lamp(p: vec3f, n: vec3f) -> vec3f { let v = PL - p; let d2 = dot(v, v); return PLC * (g.gl.w * max(dot(n, v) * inverseSqrt(d2) + .15, 0.) / (d2 + .2)); }
// ground map over the yard: r path, g grass, b damp, a openness
fn gmap(p: vec3f) -> vec4f { return textureSampleLevel(tM, sC, p.xz / 24. + .5, 0.); }
// the garden's house's lamps (home.js): position, strength. Light reaches only its own floor, and only so far
const HL = array<vec4f, 28>(vec4f(-3.3, 2.85, 11.4, 0.55), vec4f(-1.6, 2.85, 11.4, 0.55), vec4f(-3.3, 2.85, 13.3, 0.55), vec4f(-1.6, 2.85, 13.3, 0.55), vec4f(-2.55, 2, 15, 0.7), vec4f(-2.25, 2.15, 18.2, 1), vec4f(-1.5, 2.85, 20.5, 0.6), vec4f(0.2, 2.85, 23.3, 1), vec4f(2.2, 2.85, 8.2, 0.9), vec4f(2.5, 2.85, 19.5, 0.8), vec4f(3, 2.85, 15.9, 0.6), vec4f(3.4, 2.85, 11.8, 0.55), vec4f(0.72, 2.85, 12.2, 0.5), vec4f(0.72, 2.85, 15.6, 0.5), vec4f(4.49, 1.25, 7.13, 0.3), vec4f(4.49, 1.25, 9.43, 0.3), vec4f(4.49, 1.25, 18.48, 0.25), vec4f(4.49, 1.25, 20.62, 0.25), vec4f(-2.3, -0.06, 12.4, 0.85), vec4f(-4.42, -1.9, 11.38, 0.25), vec4f(-4.42, -1.9, 13.52, 0.25), vec4f(-2.6, -0.06, 15.5, 0.85), vec4f(2.2, -0.06, 15.2, 0.6), vec4f(2.2, -0.06, 16.6, 0.6), vec4f(-3.4, -0.06, 17.45, 0.35), vec4f(3, -0.06, 12.1, 0.55), vec4f(0.2, -0.33, 20.5, 0.6), vec4f(0.2, -0.33, 23.2, 0.6));
fn homeLight(p: vec3f, n: vec3f) -> vec3f {
  var s = 0.; let up = p.y > .17;
  for (var k = 0; k < 28; k++) {
    let l = HL[k]; if ((l.y > .17) != up) { continue; }
    let v = l.xyz - p; let d2 = dot(v, v); if (d2 > 22.) { continue; }
    let f = 1. - d2 / 22.;
    s += l.w * f * f * (max(dot(n, v) * inverseSqrt(d2 + 1e-4), 0.) * .85 + .15) / (d2 + .35);
  }
  return vec3f(1., .8, .58) * s;
}
fn fog(c: vec3f, wp: vec3f) -> vec3f {
  if (homeIn(g.cam.xyz) && homeIn(wp)) { return c; }   // no fog indoors
  let v = wp - g.cam.xyz; let d = length(v); let rd = v / d;
  let T = exp(-tau(g.cam.xyz, rd, d));
  return c * T + fogCol(rd) * (1. - T);
}
fn qrot(q: vec4f, v: vec3f) -> vec3f { return v + 2. * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
// wind: one smooth displacement field for everything that bends, so leaves stay on their stems. fl = how far a part gives
fn sway(p: vec2f, fl: f32, t: f32) -> vec3f {
  let ph = dot(p, vec2f(.9, .6));
  let a = pow(fl, 1.3) * .028 * g.fg.w * (.55 + .45 * sin(t * .31 + ph * .35) * sin(t * .17 + p.x * .21));
  let o = vec2f(sin(t * 1.1 + ph), cos(t * .83 + ph * 1.3)) + .4 * vec2f(sin(t * 2.7 + ph * 2.9), cos(t * 2.3 + ph * 2.3));
  let d = g.wd.xy * (a * (.7 + o.x * .6)) + vec2f(-g.wd.y, g.wd.x) * (a * o.y * .5);
  return vec3f(d.x, -a * .25 * abs(o.x), d.y);
}
// growth of a part: 0 before it is born, 1 at full size. p = 64 * duration (whole part) + birth (fraction); 0 = always there
fn gro(p: f32) -> f32 { let d = floor(p); if (d < .5) { return 1.; } return ss(0., 1., (g.fg.z - fract(p)) * 64. / d); }
fn age(p: f32) -> f32 { return select(g.fg.z - fract(p), 1., p < 1.); }
`;

// ---------------------------------------------------------------- solid meshes (ground, wood, pots, stems, fruit, houses)
// instance: a = position + scale, b = quaternion, c = material + flex / 2, seed (kind in the whole part), own timing, y stretch,
//           d = anchor the part grows away from + the anchor's timing
// materials: 0 ground  1 mulch chips, pebbles, clods  2 fence  3 bed boards + stakes  4 pots  5 plastic  6 stems  7 tomato
//            8 zucchini  9 blueberry  10 siding  11 windows  12 roofs + trim  14 metal  15 chive flowers  16 stone  17 tree canopies
//            18 painted metal (parked cars, the water tank)  19 the same, driving  20 stop signs  21 water
const W_SOLID = S_B + /*wgsl*/`
struct VI { @location(0) p: vec3f, @location(1) n: vec4f, @location(2) a: vec4f, @location(3) b: vec4f, @location(4) c: vec4f, @location(5) d: vec4f };
struct VO { @builtin(position) cp: vec4f, @location(0) wp: vec3f, @location(1) n: vec3f, @location(2) op: vec3f, @location(3) on: vec3f,
  @location(4) @interpolate(flat) m: vec4f, @location(5) @interpolate(flat) q: vec4f, @location(6) ao: f32, @location(7) @interpolate(flat) ag: f32 };
@vertex fn vs(i: VI) -> VO {
  var o: VO;
  let mat = i32(i.c.x); let fl = fract(i.c.x) * 2.;
  var s = vec3f(i.a.w); var base = i.a.xyz; var ag = 1.;
  if (mat == 1) {
    // ground clutter shrinks away with distance
    if (g.res.x > 0.) { s *= 1. - ss(i.c.z * .7, i.c.z, distance(i.a.xyz, g.cam.xyz) / g.mis.z); }
  } else {
    let go = gro(i.c.z);
    base = i.d.xyz + (i.a.xyz - i.d.xyz) * gro(i.d.w);
    ag = age(i.c.z);
    s *= go;
    // a stem of its own grows in length first and keeps thickening for a long time
    if (mat == 6 && i.d.w < 1.) { let r = i.a.w * min(go * 4., 1.) * (.4 + .6 * ss(0., .6, ag)); s = vec3f(r, i.a.w * go, r); }
  }
  s.y *= i.c.w;
  var w = base + qrot(i.b, i.p * s) + sway(base.xz, fl, g.cam.w);
  if (mat == 18 || mat == 19) {
    // vehicles stand on the street and lean with its slope. The ones that drive (d = distance between stops, speed, length
    // of the route, start) pull up at every corner, and shrink away where the route ends
    var c0 = i.a.xz; let fw = qrot(i.b, vec3f(0., 0., 1.)).xz; var k = 1.;
    if (mat == 19) {
      let f = g.cam.w * i.d.y / i.d.x + i.d.w; let e = fract(f); let fr = fract((floor(f) + e * e * (3. - 2. * e)) * i.d.x / i.d.z);
      c0 += fw * ((fr - .5) * i.d.z); k = ss(0., .012, fr) * ss(1., .988, fr);
    }
    let l = qrot(i.b, i.p * s) * k;
    // (the water tank, kind 7, stands level)
    w = vec3f(c0.x + l.x, ht(c0) + l.y + (ht(c0 + fw * 1.5) - ht(c0 - fw * 1.5)) / 3. * dot(l.xz, fw) * step(i.c.y, 7.), c0.y + l.z);
  }
  o.cp = g.vp * vec4f(w, 1.); o.wp = w; o.n = qrot(i.b, i.n.xyz);
  o.op = i.p * vec3f(i.a.w, i.a.w * i.c.w, i.a.w) + i.c.y * 37.; o.on = i.n.xyz;
  o.m = i.c; o.q = i.b; o.ao = i.n.w; o.ag = ag;
  return o;
}
struct TP { h: f32, c: f32, n: vec3f };
fn tri(p: vec3f, n: vec3f, s: f32) -> TP {
  var w = pow(abs(n), vec3f(4.)); w /= (w.x + w.y + w.z);
  let x = textureSample(tD, sR, p.zy * s); let y = textureSample(tD, sR, p.xz * s); let z = textureSample(tD, sR, p.xy * s);
  var o: TP;
  o.h = x.b * w.x + y.b * w.y + z.b * w.z;
  o.c = x.a * w.x + y.a * w.y + z.a * w.z;
  let a = x.rg * 2. - 1.; let b = y.rg * 2. - 1.; let c = z.rg * 2. - 1.;
  o.n = vec3f(0., a.y, a.x) * w.x + vec3f(b.x, 0., b.y) * w.y + vec3f(c.x, c.y, 0.) * w.z;
  return o;
}
// dew: n = slope of the droplets, h = how much of the surface they cover
fn triW(p: vec3f, n: vec3f, s: f32) -> TP {
  var w = pow(abs(n), vec3f(4.)); w /= (w.x + w.y + w.z);
  let x = textureSample(tW, sR, p.zy * s); let y = textureSample(tW, sR, p.xz * s); let z = textureSample(tW, sR, p.xy * s);
  var o: TP;
  o.h = x.b * w.x + y.b * w.y + z.b * w.z; o.c = x.a * w.x + y.a * w.y + z.a * w.z;
  o.n = vec3f(0., x.g, x.r) * w.x + vec3f(y.r, 0., y.g) * w.y + vec3f(z.r, z.g, 0.) * w.z;
  return o;
}
@fragment fn fs(i: VO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let mat = i32(i.m.x); let kind = i32(i.m.y); let sd = fract(i.m.y); let fl_ = select(-1., 1., ff);
  let on = normalize(i.on) * fl_; let n0 = normalize(i.n) * fl_;
  let dist = length(i.wp - g.cam.xyz);
  let lp = i.op - i.m.y * 37.;   // position on the mesh, in metres
  let A = tri(i.op, on, .7); let B = tri(i.op, on, 3.1); let C = tri(i.op, on, 13.); let F = tri(i.op, on, 47.);
  let fk = ss(3., .4, dist);
  let gm = gmap(i.wp);
  // wood: the vertex code says which way the board runs and which board it is
  let code = i32(i.ao * 127. + .5); let ax = code % 3; let bid = f32(code / 3) / 42.;
  let al = select(select(i.op.x, i.op.y, ax == 1), i.op.z, ax == 2);
  let ac = select(select(i.op.y + i.op.z, i.op.x + i.op.z, ax == 1), i.op.x + i.op.y, ax == 2);
  let g1 = textureSample(tD, sR, vec2f(ac * 5. + bid * 13.7, al * .31 + bid * 3.1));
  let g2 = textureSample(tD, sR, vec2f(ac * 21. + bid * 7.3, al * 1.7 + bid));
  let stk = textureSample(tD, sR, vec2f((i.wp.x + i.wp.z) * .45, i.wp.y * .04)).a;
  // the same texture turned and stretched, so its tiling does not line up with itself
  let R1 = textureSample(tD, sR, vec2f(i.op.x * .83 + i.op.z * .56, i.op.z * .83 - i.op.x * .56) * 4.3);
  let R2 = textureSample(tD, sR, vec2f(i.op.x * .47 - i.op.z * .88, i.op.z * .47 + i.op.x * .88) * 1.37);
  let dw = triW(i.op, on, 9.);
  let lg = textureSampleLevel(tV, sR, vec3f(i.wp.x * .07 + i.wp.z * .05, i.wp.x * .04 - i.wp.z * .06, i.wp.z * .07 - i.wp.x * .03), 0.).r;
  let lq = vec3f(i.wp.x * .23 + i.wp.z * .14, i.wp.x * .11 - i.wp.z * .17, i.wp.z * .21 - i.wp.x * .16);
  let lg3 = textureSampleLevel(tV, sR, lq.yzx * 9.3 + .2, 0.).g;
  let lg2 = textureSampleLevel(tV, sR, lq, 0.).g * .6 + textureSampleLevel(tV, sR, lq.zxy * 2.7 + .4, 0.).g * .4;
  let hgt = A.h * .3 + B.h * .35 + C.h * .35;
  let grd = mix(1., gm.a, ss(.5, 0., i.wp.y));   // darker close to the ground beside beds, pots and fences
  var alb = vec3f(.3); var emi = vec3f(0.); var bump = 1.; var gloss = .1; var vao = 1.; var dewK = 0.; var sss = 0.; var fuzz = 0.; var gn = 0.; var rfl = 1.;
  if (mat == 0) {
    if ((abs(i.wp.x) < 5.2 && i.wp.z > 10.25 && i.wp.z < 25.25) || (i.wp.x > -3.28 && i.wp.x < -1.95 && i.wp.z > 8.55 && i.wp.z < 10.3)) { discard; }   // under the garden's house, which has floors of its own, and its window well
    // ground: wood chip mulch, gravel paths, rough grass, and dark soil in the beds and pots
    let f0 = ss(2., 6., dist);   // past a few metres the small repeating detail gives way to broad noise
    let soil = i.ao; let path = gm.r * (1. - soil); let grs = gm.g * (1. - soil);
    var mu = mix(vec3f(.12, .045, .035), vec3f(.32, .12, .085), ss(.3, .7, mix(mix(R1.a, C.c, .35 * fk + .15), lg2, f0))) * (.5 + .8 * mix(lg2, B.h, .4 - .4 * f0)) * (.75 + .5 * lg);
    mu = mix(mu, vec3f(.36, .2, .16), ss(.62, .72, F.c) * .4 * fk);   // red lava rock
    let fa = ss(4., 13., dist);
    mu = mix(mu, vec3f(.15, .07, .055) * (.45 + 1.1 * lg2) * (.75 + .5 * lg) * (.55 + .9 * lg3), fa);
    let so = mix(vec3f(.095, .068, .05), vec3f(.21, .155, .11), ss(.3, .75, mix(R1.b, C.h, .5))) * (.55 + .7 * mix(lg2, B.h, .5 - .5 * f0))
           + vec3f(.5, .48, .42) * (ss(.80, .84, F.c) * ss(.45, .7, C.c) * .3 * fk);
    // the patio: grey concrete pavers, 20 x 10 cm, laid in running bond, each a little different, dark joints
    let pb = vec2f(i.wp.x / .2 + .5 * step(.5, fract(i.wp.z / .2)), i.wp.z / .1); let pf = fract(pb); let pid = floor(pb);
    let joint = ss(0., .09, min(min(pf.x, 1. - pf.x) * 2., min(pf.y, 1. - pf.y)));
    let pa = vec3f(.3, .29, .275) * (.8 + .35 * hs(pid.x * 3.7 + pid.y * 11.3)) * (.75 + .5 * mix(C.h, .5, ss(3., 8., dist))) * mix(1., .45 + .55 * joint, ss(14., 4., dist)) * (.85 + .3 * lg2);
    let gr = mix(vec3f(.045, .07, .028), vec3f(.09, .085, .045), B.c) * (.6 + .8 * B.h);
    alb = mix(mix(mix(mu, pa, path), gr, grs), so, soil) * mix(1., .5, gm.b);
    gloss = .05 + .32 * gm.b; bump = mix(1.7, .12, ss(2.5, 9., dist)); vao = gm.a * mix(ss(.05, .5, hgt + .25), 1., ss(2., 8., dist));
    // beyond the yard: asphalt and sidewalks on the street grid, the neighbours' lots between them, the park to the east
    let yd = max(abs(i.wp.x) - ${(LOTW / 2 + 0.4).toFixed(2)}, abs(i.wp.z) - 9.4);
    if (yd > 0.) {
      let q = i.wp.xz;
      let ux = fract((q.x - ${(AV0).toFixed(2)}) / ${(BLX).toFixed(2)} + .5) * ${(BLX).toFixed(2)} - ${(BLX / 2).toFixed(2)}; let uz = fract((q.y - ${(ST0).toFixed(2)}) / ${(BLZ).toFixed(2)} + .5) * ${(BLZ).toFixed(2)} - ${(BLZ / 2).toFixed(2)};
      let pk = q.x > ${PARKX + WALKW};
      let ax = select(abs(ux), 1e3, q.x > ${(PARKX + 20).toFixed(2)}); let az = select(abs(uz), 1e3, q.x > ${PARKX - ROADW});
      let dr = min(ax, az);
      var ca: vec3f; var cg = .06; var cbm = .5;
      if (dr < ${ROADW}) {
        ca = mix(vec3f(.04, .042, .046), vec3f(.07, .07, .072), lg2) * (.8 + .4 * C.h);
        ca = mix(ca, vec3f(.026), ss(.6, .7, lg) * .6);                                   // patched tarmac
        // paint: zebra crossings and stop lines where a street meets another, dashes down the middle of the avenues
        let av = ax < az; let ot = select(ax, az, av); let tc = select(uz, ux, av);
        var mk = ss(5., 5.1, ot) * ss(7.3, 7.2, ot) * step(.5, fract(tc / .9)) + ss(8., 8.06, ot) * ss(8.46, 8.4, ot) * step(0., ux * uz * select(-1., 1., av));   // the stop line only crosses the lane that arrives
        mk = max(mk, ss(.1, .06, abs(ux)) * step(.5, fract(q.y / 6.)) * f32(av) * step(9., az));
        ca = mix(ca, vec3f(.5, .5, .46), sat(mk) * (.45 + .4 * B.h));
        cg = .14; cbm = .3;
      } else if (dr < ${WALKW}) {
        ca = vec3f(.2, .197, .19) * (.8 + .3 * lg2) * (.85 + .3 * C.h) * (1. - .15 * ss(.55, .8, lg3)); cbm = .25;
        ca *= 1. - .3 * ss(.035, 0., min(fract(q.x / 1.5), fract(q.y / 1.5)) * 1.5) * ss(40., 12., dist);   // joints
        ca = mix(ca, vec3f(.27, .265, .25), ss(${ROADW + 0.22}, ${ROADW}, dr));                             // the kerb
      } else if (!pk) {
        // back yards: grass, bare earth or concrete, lot by lot, with the fences between them as dark lines
        let bu = fract((q.x - ${(AV0).toFixed(2)}) / ${(BLX).toFixed(2)}) * ${(BLX).toFixed(2)}; let bv = fract((q.y - ${(ST0).toFixed(2)}) / ${(BLZ).toFixed(2)}) * ${(BLZ).toFixed(2)};
        let h = hs(floor((bu - ${WALKW}) / ${LOTW}) * 7.31 + floor((q.x - ${(AV0).toFixed(2)}) / ${(BLX).toFixed(2)}) * 3.17 + floor((q.y - ${(ST0).toFixed(2)}) / ${(BLZ).toFixed(2)}) * 5.71 + step(${(BLZ / 2).toFixed(2)}, bv) * 1.93);
        let gras = mix(vec3f(.04, .06, .026), vec3f(.085, .095, .045), lg2); let dirt = mix(vec3f(.1, .08, .06), vec3f(.17, .14, .105), lg2);
        // a patio by the house, beds and worn patches further back: no two lots alike
        let pat = ss(.5, .62, textureSampleLevel(tV, sR, vec3f(q.x * .11, h * 7., q.y * .11), 0.).r);
        ca = mix(select(select(vec3f(.2, .197, .19) * (.8 + .3 * lg2), dirt, h < .82), gras, h < .55), select(gras, dirt, h < .45), pat) * (.75 + .5 * B.h) * (.8 + .4 * lg3);
        ca = mix(ca, vec3f(.09, .07, .06), ss(.16, .07, min(abs(fract((bu - ${WALKW}) / ${LOTW} + .5) - .5) * ${LOTW}, abs(bv - ${(BLZ / 2).toFixed(2)}))));
        cbm = 1.;
      } else {
        // the park: grass with dry patches, and dirt trails that follow the contours of a slow noise
        let pn = textureSampleLevel(tV, sR, vec3f(q.x * .0037, .3, q.y * .0037), 0.).r;
        ca = mix(mix(vec3f(.045, .085, .028), vec3f(.1, .125, .045), lg2), vec3f(.21, .19, .1), ss(.4, .7, lg * .6 + pn * .4) * .6) * (.75 + .5 * B.h);
        ca = mix(ca, vec3f(.24, .2, .15) * (.8 + .3 * C.h), ss(.014, .005, abs(pn - .52)));
        ca = mix(ca, vec3f(.06, .055, .04) * (.7 + .5 * B.h), ss(40., 31., length(q - vec2f(${POND[0]}., ${POND[1]}.))));   // mud round the pond
        let tr = length(q - vec2f(${TANK[0]}., ${TANK[1]}.)); ca = mix(ca, vec3f(.2, .19, .17) * (.8 + .3 * C.h), ss(16.6, 15.2, tr)); ca *= .55 + .45 * ss(14.8, 19., tr);   // gravel and shade at the tank's foot
        ca *= mix(1., .7 + .6 * F.h, ss(25., 4., dist)) * mix(1., .8 + .4 * C.h, ss(80., 10., dist));
        cbm = 1.2;
      }
      let cb = ss(0., .35, yd);
      alb = mix(alb, ca, cb); gloss = mix(gloss, cg, cb); vao = mix(vao, 1., cb); bump *= mix(1., cbm, cb);
    }
  } else if (mat == 1) {
    let h3 = vec3f(hs(sd * 17.3), hs(sd * 31.7), hs(sd * 71.1));
    if (kind == 0) {
      alb = mix(vec3f(.13, .045, .035), vec3f(.38, .14, .095), h3.x * h3.x) * (.55 + .7 * C.h) * (.75 + .5 * ss(.3, .7, F.h));   // lava rock
      alb = mix(alb, vec3f(.36, .31, .24), step(.93, h3.y) * .6);
    } else if (kind == 1) {
      alb = mix(vec3f(.21, .20, .19), vec3f(.52, .47, .40), h3.x) * (.7 + .5 * F.h);
      alb = mix(alb, vec3f(.46, .28, .19), step(.85, h3.y) * .5); gloss = .25;
    } else { alb = mix(vec3f(.09, .064, .047), vec3f(.2, .148, .105), h3.x) * (.6 + .8 * C.h); }
    vao = gm.a * (.5 + .5 * sat(n0.y + .5)); bump = 1.1;
  } else if (mat == 2 || mat == 3) {
    let wr = ss(.1, .9, .3 + hs(bid * 9.7) * .42 + g1.a * .25);
    var wc = mix(vec3f(.34, .17, .11), vec3f(.4, .29, .24), wr * .6);                                  // redwood fence, stained, weathering
    if (mat == 3) {
      wc = mix(mix(vec3f(.35, .21, .115), vec3f(.32, .26, .2), wr * .7), mix(vec3f(.54, .42, .26), vec3f(.46, .42, .36), wr * .6), step(.5, sd));   // cedar, pine stakes
      if (sd < .25) { wc = mix(vec3f(.74, .68, .52), vec3f(.62, .58, .48), wr * .7); }   // the garden's beds, painted cream
    }
    alb = wc * (.72 + .34 * g1.b) * (.8 + .32 * hs(bid * 3.1)) * (1. - .2 * ss(.5, .8, g2.b));
    if (code == 126) { alb = vec3f(.012, .011, .01); }   // the shadow between fence boards
    // damp, algae-stained feet
    let ft = ss(.6, 0., i.wp.y) * (.4 + .6 * A.c);
    alb = mix(alb, alb * .45 + vec3f(.012, .03, .008), ft * .8);
    alb = mix(alb, vec3f(.10, .15, .06) * (.4 + B.h), ss(.5, .7, A.c * .6 + B.c * .5) * ss(1.1, .2, i.wp.y) * .35 * f32(mat == 2));
    gloss = .14; bump = .07; vao = grd; gn = 1.;
  } else if (mat == 4) {
    alb = mix(vec3f(.48, .225, .125), vec3f(.60, .32, .185), A.c) * (.7 + .4 * C.h);
    alb = mix(alb, vec3f(.64, .58, .52), ss(.5, .72, B.c * .55 + A.c * .5) * ss(0., .25, lp.y) * .55);   // salts
    alb = mix(alb, vec3f(.065, .115, .05), ss(.14, 0., lp.y) * ss(.4, .6, B.c) * .7);                  // moss at the foot
    gloss = .1; bump = .6; dewK = .3;
    if (sd > .75) { alb = mix(vec3f(.025, .06, .19), vec3f(.045, .12, .29), A.c) * (.8 + .3 * B.h); gloss = .85; bump = .12; dewK = 1.; }   // a glazed one
    vao = mix(.7, 1., ss(0., .3, lp.y)) * i.ao * grd;
  } else if (mat == 5) {
    alb = select(vec3f(.016, .016, .018), vec3f(.022, .055, .032), sd > .5);
    alb += vec3f(.09, .08, .065) * (ss(.45, .75, B.c) * sat(n0.y) * .5);
    gloss = .55; bump = .1; vao = grd * i.ao; dewK = 1.;
  } else if (mat == 6) {
    let rib = .93 + .07 * cos(atan2(on.z, on.x) * 9.);
    if (kind == 0) { alb = mix(mix(vec3f(.15, .24, .065), vec3f(.25, .32, .105), C.c), vec3f(.22, .2, .1), ss(.4, .9, i.ag) * .5); fuzz = 1.; sss = .3; }   // tomato vine, hairy
    else if (kind == 1) { alb = vec3f(.27, .37, .14) * rib; sss = .6; fuzz = .5; }                                                                           // zucchini stalk, ribbed and hollow
    else if (kind == 2) { alb = mix(vec3f(.29, .125, .075), vec3f(.31, .27, .235), ss(.3, .7, B.c)) * (.6 + .6 * C.h); }                                     // woody cane
    else if (kind == 3) { alb = vec3f(.48, .385, .24) * (.6 + .5 * F.h); fuzz = .6; }                                                                          // jute twine
    else if (kind == 4) { alb = select(mix(vec3f(.095, .078, .062), vec3f(.23, .2, .17), B.h), mix(vec3f(.3, .28, .23), vec3f(.52, .48, .4), ss(.3, .7, A.c * .5 + C.c * .5)), sd < .5); bump = 1.6; }   // bark; eucalyptus peels pale                                                         // bark
    else { alb = mix(vec3f(.21, .31, .095), vec3f(.24, .115, .19), step(.5, sd)); sss = .3; }                                                                 // herb stems
    gloss = .2; dewK = .5; vao = .65 + .35 * i.ao;
  } else if (mat == 7) {
    // heirloom tomato: green, then a dusky purple-red that leaves the shoulders olive
    let rp = ss(.18, .4, i.ag + (sd - .5) * .08);
    let grn = mix(vec3f(.25, .35, .095), vec3f(.35, .43, .155), A.c);
    let rip = mix(vec3f(.2, .032, .04), vec3f(.11, .022, .05), sd) * (.8 + .4 * B.c);
    var fc = mix(mix(grn, vec3f(.3, .25, .08), ss(0., .5, rp)), rip, ss(.35, 1., rp));
    fc = mix(fc, mix(grn * .7, vec3f(.125, .115, .04), rp), ss(.45, 1.05, on.y + (B.c - .5) * .5) * (.3 + .3 * rp));
    alb = fc * (.9 + .2 * C.h); gloss = .5; bump = .05; dewK = .6; sss = mix(.35, .08, rp); rfl = .35; vao = .7 + .3 * sat(n0.y + .8);
  } else if (mat == 8) {
    alb = mix(vec3f(.03, .085, .024), vec3f(.06, .14, .038), ss(.3, .7, B.c));
    alb = mix(alb, vec3f(.21, .29, .095), ss(.74, .8, F.c) * .6 * fk + ss(.5, 1., cos(atan2(on.z, on.x) * 7.)) * .16);
    alb = mix(alb, vec3f(.2, .26, .09), ss(.75, 1., on.y) * .35);
    gloss = .65; bump = .1; dewK = 1.; vao = (.55 + .45 * sat(n0.y + .7)) * grd;
  } else if (mat == 9) {
    let rp = ss(.16, .42, i.ag + (sd - .5) * .22);
    let bc = mix(mix(vec3f(.29, .41, .155), vec3f(.47, .135, .21), ss(0., .55, rp)), vec3f(.032, .042, .125), ss(.5, 1., rp));
    let blo = ss(.3, .7, C.c * .6 + B.c * .4) * rp;
    alb = mix(bc, vec3f(.29, .35, .5), blo * .55) * (1. - .6 * ss(-.8, -.96, on.y));   // waxy bloom, dark crown
    gloss = .4 * (1. - blo * .7); bump = .1; dewK = .8; vao = .6 + .4 * sat(n0.y + .8);
  } else if (mat == 10) {
    var wc = vec3f(.8, .66, .34);   // (kind 0: the garden's house, yellow)
    if (kind == 1) { wc = vec3f(.43, .50, .47); } else if (kind == 2) { wc = vec3f(.46, .51, .60); } else if (kind == 3) { wc = vec3f(.63, .53, .49); }
    else if (kind == 4) { wc = vec3f(.55, .55, .57); } else if (kind == 5) { wc = vec3f(.67, .63, .47); }
    // the neighbourhood: muted paint mostly, and now and then one of the bold colours the Excelsior is known for
    else if (kind == 6) { wc = vec3f(.46, .34, .6); } else if (kind == 7) { wc = vec3f(.74, .42, .56); } else if (kind == 8) { wc = vec3f(.78, .66, .3); }
    else if (kind == 9) { wc = vec3f(.46, .62, .52); } else if (kind == 10) { wc = vec3f(.42, .54, .7); } else if (kind == 11) { wc = vec3f(.76, .5, .38); }
    else if (kind > 11) { wc = vec3f(.5, .49, .46) + .06 * cos(6.283 * (f32(kind) * .23 + sd * .1 + vec3f(0., .33, .67))); }
    let lk = select(1., .15, kind > 13 || kind == 9 || kind == 11);   // some are stucco
    let lap = fract(i.wp.y / .13);
    alb = wc * (.92 - .3 * ss(.85, 1., lap) * lk + .06 * lap * lk) * (.9 + .15 * A.c) * (1. - .08 * ss(.55, .8, stk));
    gloss = .1; bump = .04; vao = grd;
  } else if (mat == 11) {
    // windows: a few still lit; the lamps go out as the day comes
    let mun = ss(.03, .06, abs(fract(i.wp.y / .62) - .5)) * ss(.03, .06, abs(fract((i.wp.x + i.wp.z) / .55) - .5));
    let cur = ss(.45, .5, fract(i.wp.y / 1.24 + .2)) * .5 + .15 * ss(.4, .6, stk);
    alb = mix(vec3f(.42, .41, .39), mix(vec3f(.02, .025, .03), vec3f(.3, .29, .27), cur), mun); gloss = mix(.2, .95, mun); bump = 0.;
    // (in the neighbourhood's houses, kind 3, each household decides for itself)
    let lit = i.ao * select(1., step(.55, hs(sd * 53. + floor((lp.y - 3.1) / 2.75) * 1.7 + step(0., lp.x) * .37 + step(lp.z, -1.) * .71)), kind == 3);
    emi = PLC * (lit * g.gl.w * (.5 + .5 * B.c) * (.25 + .75 * mun) * 1.1) + fogCol(normalize(vec3f(n0.x, .5, n0.z))) * (.22 * mun);
  } else if (mat == 12) {
    // roofs: tar, or a silver coating on some of the flat ones; trim and doors
    alb = select(vec3f(.065, .065, .07) * (.6 + .8 * C.h), mix(mix(vec3f(.12, .11, .1) + .045 * cos(6.283 * (sd * 3. + vec3f(.5, .83, .17))), vec3f(.42, .42, .41), step(.3, fract(sd * 7.3)) * step(.9, on.y)), vec3f(.66, .65, .62), ss(.6, .9, i.ao)) * (.85 + .2 * B.c), i.ao > .3);
    gloss = .15; bump = .05; vao = grd;
  } else if (mat == 14) {
    alb = vec3f(.40, .42, .44) * (.7 + .5 * B.c); gloss = .7; bump = .15; dewK = 1.; vao = grd;
  } else if (mat == 15) {
    alb = mix(vec3f(.2, .1, .27), vec3f(.3, .2, .36), C.c); bump = 2.5; fuzz = .5; sss = .3;
  } else if (mat == 16) {
    alb = mix(vec3f(.28, .28, .27), vec3f(.46, .45, .42), B.c) * (.7 + .5 * C.h);
    alb = mix(alb, vec3f(.07, .11, .045), ss(.55, .75, A.c * .5 + B.c * .5) * .5);
    gloss = .08 + .2 * gm.b; bump = .7; vao = gm.a; dewK = .3;
  } else if (mat == 18 || mat == 19) {
    // painted metal: cars and buses (the vertex code says paint, glass, tyre or lamp) and the park's water tank
    var pc = vec3f(.56, .57, .59);
    if (kind == 1) { pc = vec3f(.64, .63, .6); } else if (kind == 2) { pc = vec3f(.03, .03, .035); } else if (kind == 3) { pc = vec3f(.05, .09, .2); }
    else if (kind == 4) { pc = vec3f(.34, .03, .03); } else if (kind == 5) { pc = vec3f(.07, .14, .1); } else if (kind == 6) { pc = vec3f(.4, .36, .28); }
    else if (kind == 7) { pc = mix(vec3f(.13, .29, .44), vec3f(.2, .38, .5), ss(2., 20., lp.y)) * (.95 + .08 * A.c); }   // sun-faded at the top
    else if (kind == 8) { pc = mix(vec3f(.6, .6, .58), vec3f(.48, .06, .05), ss(.85, .9, lp.y) * ss(1.32, 1.27, lp.y)); }
    if (i.ao > .9) { alb = pc * (.9 + .2 * B.c); gloss = select(.75, .2, kind == 7); bump = select(.03, .06, kind == 7); }
    else if (i.ao > .6) { alb = vec3f(.02, .025, .03); gloss = .95; bump = 0.; }
    else if (i.ao > .35) { alb = select(vec3f(.018), vec3f(.3, .29, .27) * (.7 + .4 * A.c), kind == 7); gloss = select(.03, .15, kind == 7); bump = .3; }   // tyres, trolley poles; the tank's concrete footing
    else if (kind == 7) { alb = vec3f(.25, .26, .27); gloss = .5; bump = 0.; }   // the tank's ladder and rail
    else { alb = mix(vec3f(.35, .02, .02), vec3f(.62, .6, .5), step(0., on.z)); emi = alb * (max(g.gl.w, .25) * 1.4 * f32(mat == 19)); gloss = .6; bump = 0.; }   // lamps: lit on the cars that drive, dimmer once it is light
    vao = .55 + .45 * sat(n0.y + .9);
  } else if (mat == 20) {
    // a stop sign: red octagon, white rim and letters (a 5 x 7 dot font)
    alb = vec3f(.3, .31, .32); gloss = .4; bump = .05; vao = 1.;
    if (i.ao > .5 && on.z > .5) {
      let q = lp.xy - vec2f(0., 2.3); let oc = max(max(abs(q.x), abs(q.y)), (abs(q.x) + abs(q.y)) * .7071);
      let u = (q.x + .29) / .58 * 4.; let v = (.105 - q.y) / .21 * 7.; let cu = fract(u) * 6. - .5;
      var ink = 0.;
      if (u >= 0. && u < 4. && v >= 0. && v < 7. && cu >= 0. && cu < 5.) {
        var gl = array<u32, 28>(15u, 16u, 16u, 14u, 1u, 1u, 30u, 31u, 4u, 4u, 4u, 4u, 4u, 4u, 14u, 17u, 17u, 17u, 17u, 17u, 14u, 30u, 17u, 17u, 30u, 16u, 16u, 16u);
        ink = f32((gl[i32(u) * 7 + i32(v)] >> u32(4 - i32(cu))) & 1u);
      }
      alb = mix(vec3f(.45, .02, .025), vec3f(.8), max(ink, ss(.335, .345, oc) * ss(.375, .365, oc))); gloss = .5;
    }
  } else if (mat == 22) {
    // inside the garden's house; the vertex code says what the surface is (IN in home.js)
    let t = code; let q = i.op;
    alb = vec3f(.80, .78, .74) * (.97 + .05 * B.c); gloss = .06; bump = .03; vao = 1.;   // painted walls
    if (t == 1) { alb = vec3f(.85, .84, .81); }
    else if (t == 2 || t == 5 || t == 19) {
      // boards: oak along z, the kitchen's paler floor, bare framing
      let bw = select(.13, .17, t == 5); let row = floor(q.x / bw); let off = hs(row * 3.7) * 1.9; let v = (q.z + off) / 1.9;
      let tone = hs(row * 7.1 + floor(v) * 2.3); let u = fract(q.x / bw);
      let seam = ss(0., .04, u) * ss(1., .96, u) * ss(0., .012, fract(v)) * ss(1., .988, fract(v));
      var wc = mix(vec3f(.42, .27, .14), vec3f(.58, .4, .22), tone);
      if (t == 5) { wc = mix(vec3f(.56, .45, .3), vec3f(.66, .54, .37), tone); }
      if (t == 19) { wc = vec3f(.56, .41, .25) * (.85 + .3 * hs(floor((q.x + q.z) * 2.4) + floor(q.y))); }
      alb = mix(wc * .45, wc * (.86 + .26 * g1.b), select(seam, 1., t == 19)); gloss = select(.35, .08, t == 19); bump = .05;
    }
    else if (t == 3) { alb = vec3f(.6, .57, .52) * (.88 + .16 * F.c + .08 * C.c); bump = 1.2; fuzz = .4; gloss = 0.; }
    else if (t == 4) {
      let cq = floor(q.xz / .055); let gq = abs(fract(q.xz / .055) - .5);
      alb = mix(vec3f(.84, .84, .82), vec3f(.55, .55, .53), ss(.44, .49, max(gq.x, gq.y)));
      alb = mix(alb, vec3f(.05), step(fract(cq.x * .5), .1) * step(fract(cq.y * .5), .1) * ss(.3, .2, length(gq))); gloss = .55; bump = .02;
    }
    else if (t == 6) { alb = vec3f(.4, .16, .075) * (.82 + .3 * g1.b) * (1. - .35 * ss(.46, .49, abs(fract((q.x + q.z) * 2.1) - .5))); gloss = .45; }
    else if (t == 7) { alb = vec3f(.6, .4, .22) * (.85 + .3 * hs(floor((q.x + q.z) / .045))); gloss = .3; }
    else if (t == 8) { alb = vec3f(.2, .19, .18) * (.8 + .4 * F.h) + vec3f(.25) * step(.82, F.c); gloss = .7; }
    else if (t == 9) {
      let uv = vec2f(q.x + q.z, q.y); let row = floor(uv.y / .075); let uu = fract((uv.x + row * .1) / .2); let vv = fract(uv.y / .075);
      let mort = max(ss(.94, .98, uu) + ss(.06, .02, uu), ss(.88, .95, vv) + ss(.1, .04, vv));
      alb = mix(vec3f(.4, .16, .1) * (.7 + .55 * hs(row * 3.1 + floor((uv.x + row * .1) / .2) * 1.7)), vec3f(.5, .47, .42), sat(mort)); bump = .6;
    }
    else if (t == 10) { alb = vec3f(.88, .88, .86); gloss = .8; }
    else if (t == 11) { alb = vec3f(.52, .53, .55) * (.9 + .1 * A.c); gloss = .85; }
    else if (t == 12) { alb = vec3f(.72, .7, .66) * (.92 + .1 * F.c); fuzz = .5; bump = .4; gloss = 0.; }
    else if (t == 13) { alb = vec3f(.09, .2, .22); fuzz = .5; gloss = 0.; }
    else if (t == 14) { alb = vec3f(.9, .89, .87) * (.95 + .05 * C.c); fuzz = .3; gloss = 0.; }
    else if (t == 15) { alb = vec3f(.6, .52, .41) * (.88 + .22 * g1.b); gloss = .25; }
    else if (t == 16) { alb = vec3f(.03); gloss = .4; }
    else if (t == 17) { alb = vec3f(.16, .2, .2); gloss = .95; }
    else if (t == 18) { alb = vec3f(.42, .41, .39) * (.86 + .14 * C.c + .08 * R2.a); gloss = .1; bump = .2; }
    else if (t == 20) {
      // paintings: soft abstract fields in a few muted colours, a different mix on each
      let pk = hs(floor(q.y * .7) * 5.3 + floor((q.x + q.z) * .9) * 2.1);
      let c1 = .5 + .32 * cos(6.283 * (pk + vec3f(0., .33, .67))); let c2 = .5 + .32 * cos(6.283 * (pk + .4 + vec3f(0., .33, .67)));
      let u = q.x + q.z; let v = q.y;
      alb = mix(vec3f(.84, .81, .74), c1, ss(.25, .75, sin(u * 2.3 + v * .8 + pk * 9.) * .5 + .5) * .85);
      alb = mix(alb, c2 * .65, ss(.72, .9, sin(u * 4.1 - v * 3.3 + pk * 4.) * .5 + .5) * ss(.3, .7, sin(v * 2.7 + pk * 7.) * .5 + .5)); gloss = .15;
    }
    else if (t == 21) { alb = vec3f(.5, .52, .53); gloss = 1.; rfl = 1.4; }
    else if (t == 22) { alb = mix(vec3f(.6, .59, .57), vec3f(.3, .34, .4), ss(.45, .62, B.c * .6 + C.c * .4)) * (.9 + .12 * F.c); fuzz = .5; bump = .8; gloss = 0.; }
    else if (t == 23) { alb = vec3f(.9); emi = vec3f(1., .86, .66) * 1.3; }
    else if (t == 24) { alb = vec3f(.1, .22, .07) * (.8 + .4 * B.c); sss = .4; }
    else if (t == 25) { let c2 = floor(vec2f(q.x + q.z, q.y) / .03); alb = mix(vec3f(.62, .55, .44), vec3f(.4, .44, .38), hs(c2.x * 1.7 + c2.y * 9.1)) * (1. - .4 * ss(.4, .48, max(abs(fract((q.x + q.z) / .03) - .5), abs(fract(q.y / .03) - .5)))); gloss = .6; }
    else if (t == 26 || t == 28) { alb = vec3f(.86, .85, .82); gloss = .3; }
    else if (t == 27) { alb = vec3f(.05); } else if (t == 33) { alb = vec3f(.08, .26, .1); } else if (t == 34) { alb = vec3f(.07, .17, .4); }
    else if (t == 29) { alb = vec3f(.84, .75, .53) * (.88 + .12 * B.c + .06 * C.c); bump = .5; gloss = .04; }
    else if (t == 30) { alb = vec3f(.55, .22, .12) * (.75 + .3 * ss(0., .5, abs(fract((q.x + q.z) / .2) - .5))); gloss = .2; }
    else if (t == 31) { alb = vec3f(.42, .24, .15); gloss = .25; }
    else if (t == 32) { alb = vec3f(.52, .27, .16); }
    else if (t == 35) { alb = vec3f(.4, .46, .36); gloss = .3; }
    else if (t == 36) { alb = vec3f(.5, .52, .55) * (.92 + .1 * F.c); fuzz = .5; bump = .4; gloss = 0.; }
    else if (t == 37) { alb = vec3f(.78, .6, .16) * (.92 + .1 * F.c); fuzz = .5; gloss = 0.; }
  } else if (mat == 21) {
    alb = vec3f(.012, .02, .022); gloss = .95; bump = .2; vao = 1.;   // the pond
  } else {
    // tree canopies: 0 eucalyptus, 1 cypress, 2 pine, 3 street trees
    alb = mix(vec3f(.028, .055, .024), vec3f(.065, .10, .038), C.c) * (.5 + B.h) * (.7 + .6 * A.h); bump = 2.6; vao = .4 + .6 * sat(n0.y + .35); fuzz = .6;
    if (kind == 0) { alb = alb * vec3f(1., 1.1, 1.15) + vec3f(.008, .012, .014); } else if (kind == 1) { alb *= vec3f(.65, .8, .75); } else if (kind == 2) { alb *= vec3f(.7, .85, .65); } else { alb *= vec3f(1.15, 1.2, .8); }
    alb *= .8 + .4 * hs(sd * 91.);
  }
  // grain runs along the board: tilt the normal across it
  let gv = cross(on, vec3f(f32(ax == 0), f32(ax == 1), f32(ax == 2)));
  let np = on + (A.n * .35 * f32(mat != 0) + B.n * .6 * select(1., ss(8., 3., dist), mat == 0) + C.n * .5 * ss(14., 3., dist) + F.n * .45 * fk) * bump + gv * ((g2.r - .5) * 1.4 * gn);
  let N = normalize(qrot(i.q, normalize(np)));
  let L = g.sun.xyz; let V = normalize(g.cam.xyz - i.wp); let H = normalize(V + L);
  let E = g.sc.rgb * shadow9(i.wp + n0 * .012 + L * .012);
  let ndl = sat(dot(N, L)); let ndv = sat(dot(N, V));
  var am = (amb(N) + lamp(i.wp, N)) * vao;
  if (homeIn(i.wp)) {
    // indoors: less sky, the lamps' warm light, a little light everywhere from the walls; corners where walls meet the
    // floor and the ceiling a little darker
    let up = i.wp.y > .17; let fy = i.wp.y - select(-2.88, .33, up); let cy = select(0., 2.95, up) - i.wp.y;
    let co = select(1., (.7 + .3 * ss(0., .4, fy)) * (.82 + .18 * ss(0., .3, cy)), abs(n0.y) < .5);
    am = (am * .3 + vec3f(1., .84, .66) * (.09 * (.8 + .2 * N.y)) + homeLight(i.wp, N) * 1.1) * vao * co;
  }
  var c = alb * (E * ndl + am) + emi;
  c += alb * E * (sss * (1. - ndl) * (.25 + .75 * pow(sat(dot(-V, L)), 2.)));                                  // light through fruit and soft stems
  c += E * (pow(sat(dot(N, H)), mix(12., 220., gloss)) * gloss * (.3 + 2.2 * gloss) * ndl);
  c += fogCol(reflect(-V, N)) * (vao * gloss * rfl * (.04 + .96 * pow(1. - ndv, 5.)));
  c += (E * (.3 + 1.5 * pow(sat(dot(-V, L)), 2.)) + am * .5) * alb * (fuzz * pow(1. - ndv, 2.));               // fine hairs catch the light
  // dew: beads on anything smooth that faces the sky
  let dm = dw.h * dewK * g.sun.w * ss(-.35, .25, n0.y) * ss(7., 2., dist) * (.15 + .85 * g.sc.w);
  let nd = normalize(N + qrot(i.q, dw.n) * 1.4);
  c = mix(c, c * .8 + fogCol(reflect(-V, nd)) * .12, dm);
  c += (E * (pow(sat(dot(nd, H)), 500.) * 45. + pow(sat(dot(nd, H)), 30.) * .4) + g.ac.rgb * pow(sat(nd.y), 30.) * .2) * dm;
  return fin(fog(c, i.wp));
}
// window glass (the garden's house): drawn over the scene, faint straight on and reflecting at a slant
@fragment fn fsGlass(i: VO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let n = normalize(i.n) * select(-1., 1., ff); let V = normalize(g.cam.xyz - i.wp);
  let fr = .04 + .96 * pow(1. - abs(dot(n, V)), 5.);
  let inside = homeIn(g.cam.xyz);
  let R = reflect(-V, n); let H = normalize(V + g.sun.xyz);
  var c = select(fogCol(R) * 1.1, vec3f(.07, .055, .04), inside) + g.sc.rgb * (pow(sat(dot(n, H)), 600.) * 12. * f32(!inside));
  let a = clamp(.05 + fr * .8, 0., .9);
  return vec4f(fog(c, i.wp) * a, a);
}
`;

// ---------------------------------------------------------------- leaves (every blade, leaflet, needle, petal)
// instance: a = base + length, b = yaw, tilt, width, 64 * flex (whole part) + ao (fraction),
//           c = type, seed, own timing (flowers), bend, d = anchor the leaf grows away from + the anchor's timing
// types: 0 tomato leaflet  1 seed leaf  2 zucchini lobe  3 blueberry  4 basil  5 rosemary  6 grass  7 sage  8 petal  9 calyx
//        10 chive  11 parsley, thyme  12 tree
const W_LEAF = S_B + /*wgsl*/`
override ROWS: f32 = 7.;
override FAR: f32 = 90.;
struct LI { @location(0) a: vec4f, @location(1) b: vec4f, @location(2) c: vec4f, @location(3) d: vec4f };
struct LO { @builtin(position) cp: vec4f, @location(0) wp: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f,
  @location(3) @interpolate(flat) col: vec3f, @location(4) @interpolate(flat) pr: vec4f,
  @location(5) @interpolate(flat) sd: vec4f, @location(6) @interpolate(flat) k: vec4f, @location(7) tg: vec3f, @location(8) @interpolate(flat) tt: vec2f };
fn pal(h: f32) -> vec3f {
  if (h < .3) { return vec3f(1., .72, .35); }
  if (h < .6) { return vec3f(.55, 1., .6); }
  if (h < .8) { return vec3f(.5, .8, 1.); }
  return vec3f(1., .6, .85);
}
@vertex fn vs(@builtin(vertex_index) vi: u32, i: LI) -> LO {
  var o: LO;
  let u = f32(vi & 1u) * 2. - 1.; let v = .5 - .5 * cos(f32(vi >> 1u) / (ROWS - 1.) * 3.14159);
  let ty = i32(i.c.x * 255. + .5); let s1 = i.c.y; let s2 = hs(s1 * 7.31 + i.b.x); let t = g.cam.w;
  let ga = gro(i.d.w); let ag = age(i.d.w); var own = 1.;
  // per type: colour; pr = translucency, gloss, dew, vein style; shape = widest point, roundness; teeth = depth, count
  var col = vec3f(0.); var pr = vec4f(.6, .2, 1., 0.); var shp = vec2f(.75, .7); var tth = vec2f(0.); var ruf = 0.; var fls = 1.; var fold = .5; var und = .3;
  switch ty {
    case 0 {
      col = mix(vec3f(.042, .10, .02), vec3f(.08, .155, .033), s1); col = mix(col, vec3f(.2, .2, .045), ss(.7, 1., ag + s2 * .2) * .55);   // the oldest leaves yellow
      pr = vec4f(.8, .12, 1., 1.); shp = vec2f(.6, .8); tth = vec2f(.2, 5.5); ruf = .35; fold = .9;
    }
    case 1 { col = mix(vec3f(.065, .145, .03), vec3f(.105, .195, .048), s1); pr = vec4f(.8, .25, 1., 0.); shp = vec2f(.8, .6); }
    case 2 {
      col = mix(vec3f(.045, .115, .03), vec3f(.07, .15, .04), s1); col = mix(col, vec3f(.29, .25, .058), ss(.75, 1., ag + s2 * .15) * .6);
      pr = vec4f(.6, .06, 1., 2.); shp = vec2f(.62, .75); tth = vec2f(.16, 9.); ruf = .3; fold = .22; und = .5;
    }
    case 3 { col = mix(mix(vec3f(.048, .115, .058), vec3f(.085, .165, .068), s1), vec3f(.29, .068, .048), step(.93, s2) * .5); pr = vec4f(.42, .4, .8, 0.); shp = vec2f(.8, .62); fold = .4; }
    case 4 { col = mix(vec3f(.045, .12, .028), vec3f(.075, .17, .04), s1); pr = vec4f(.55, .28, 1., 3.); shp = vec2f(.7, .6); tth = vec2f(.07, 9.); ruf = .45; fold = .9; }
    case 5 { col = mix(vec3f(.033, .072, .038), vec3f(.058, .105, .058), s1); pr = vec4f(.1, .3, .7, 0.); shp = vec2f(.5, .25); und = 1.6; fold = .2; fls = .3; }
    case 6 { col = mix(mix(vec3f(.055, .115, .028), vec3f(.105, .15, .045), s1), vec3f(.35, .3, .145), step(.86, s2)); pr = vec4f(.8, .3, 1., 4.); shp = vec2f(.42, .28); fold = .6; fls = 1.5; }
    case 7 { col = mix(vec3f(.15, .21, .145), vec3f(.21, .27, .19), s1); pr = vec4f(.4, .05, 1., 3.); shp = vec2f(.75, .5); ruf = .2; und = .6; }
    case 8 {
      // petals: small yellow tomato flowers, big orange zucchini blossoms; they open, then wither
      let bigp = ss(.02, .05, i.a.w); col = mix(vec3f(.5, .33, .02), vec3f(.52, .26, .015), bigp); pr = vec4f(.7, .2, .6, 5.); shp = vec2f(.6, .7); ruf = .08; fold = .3;
      own = ss(i.c.z, i.c.z + .03, g.fg.z) * (1. - ss(i.c.z + .09 + .25 * bigp, i.c.z + .13 + .25 * bigp, g.fg.z));
    }
    case 9 { col = vec3f(.058, .135, .028); pr = vec4f(.5, .2, .8, 0.); shp = vec2f(.4, .5); own = ss(i.c.z, i.c.z + .04, g.fg.z); }
    case 10 { col = mix(vec3f(.058, .145, .068), vec3f(.085, .185, .078), s1); pr = vec4f(.5, .45, 1., 4.); shp = vec2f(.3, .16); fold = 1.2; fls = 1.3; }
    case 11 { col = mix(vec3f(.04, .105, .028), vec3f(.065, .145, .038), s1); pr = vec4f(.45, .2, 1., 0.); shp = vec2f(.7, .6); tth = vec2f(.4, 3.5); ruf = .6; }
    default { col = mix(vec3f(.028, .068, .024), vec3f(.058, .105, .033), s1); pr = vec4f(.7, .35, .5, 0.); shp = vec2f(.7, .6); }
  }
  let gs = ga * own; let len = i.a.w * gs; let wd = i.b.z * gs;
  let fl = floor(i.b.w) / 64.; let ao = fract(i.b.w);
  let base = i.d.xyz + (i.a.xyz - i.d.xyz) * ga + sway(i.a.xz, fl, t);
  let cy = cos(i.b.x); let sy = sin(i.b.x); let ct = cos(i.b.y); let st = sin(i.b.y);
  let d = vec3f(st * cy, ct, st * sy); let pe = vec3f(ct * cy, -st, ct * sy); let sdv = vec3f(-sy, 0., cy);
  let wn = g.fg.w * fls;
  // the blade curves along its length (and flutters), twists a little, and narrows to both ends
  let k = (i.c.w - .3) * 2. + sin(t * (1.1 + s1 * 1.3) * fls + s2 * 40. + dot(i.a.xz, vec2f(1.3, .7))) * .07 * wn;
  let kq = k * 1.7; let ka = select(kq, .06, abs(kq) < .06);
  let sK = sin(ka * v); let cK = cos(ka * v);
  let c = base + len * (d * (sK / ka) + pe * ((1. - cK) / ka));
  let N = normalize(pe * cK - d * sK); let T0 = normalize(d * cK + pe * sK);
  let tw = (s1 - .5) * .9 * v + sin(t * 1.7 * fls + s2 * 20.) * .12 * v * wn;
  let S = sdv * cos(tw) + N * sin(tw); let N2 = N * cos(tw) - sdv * sin(tw);
  let shape = pow(max(sin(3.14159 * pow(v, shp.x)), 0.), shp.y);
  let shp_ = g.res.x == 0.;   // the shadow pass
  let cd = distance(i.a.xyz, g.cam.xyz); let far = FAR * g.mis.z;
  let nearK = select(1. - ss(5., 9., cd), 0., shp_);
  let farK = select(1. - ss(far * .8, far, cd), 1., shp_);
  let rf = sin(v * 9. + s2 * 30.) * wd * .3 * ruf * u * sin(3.14159 * v) * nearK;
  // edges ruffle and lift away from the midrib
  let p = c + S * (u * farK * wd * .5 * shape) + N2 * (rf - abs(u) * wd * .1 * fold * shape);
  o.cp = g.vp * vec4f(p, 1.); o.wp = p;
  o.n = normalize(N2 + S * u * (.25 + fold * .5) - T0 * cos(v * 9. + s2 * 30.) * u * ruf * .5 * nearK);
  o.uv = vec2f(u, v); o.col = col; o.pr = pr; o.sd = vec4f(s1, s2, ao, ag); o.k = vec4f(f32(ty), i.a.w, i.b.z, und); o.tg = T0; o.tt = tth;
  return o;
}
// dew sparkles: a = position + flex, b = seed, hue, size, timing of the leaf it sits on
struct GO { @builtin(position) cp: vec4f, @location(0) uv: vec2f, @location(1) @interpolate(flat) col: vec3f };
@vertex fn vsGl(@builtin(vertex_index) vi: u32, @location(0) a: vec4f, @location(1) b: vec4f) -> GO {
  var o: GO; let q = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2. - 1.; let t = g.cam.w;
  let p = a.xyz + sway(a.xz, a.w, t);
  let v = p - g.cam.xyz; let d = length(v);
  if (d > 45. || dot(v, g.fwd.xyz) < 0. || gro(b.w) < .97) { o.cp = vec4f(0., 0., 2., 1.); return o; }
  // each bead flashes as the eye or the leaf moves
  let tw = pow(.5 + .5 * sin(t * (.5 + 1.3 * hs(b.x)) + b.x * 100. + dot(v / d, vec3f(13., 7., 11.)) * 30.), 6.);
  let sz = min(max(b.z * 1.3, d * .0025 * (.6 + .9 * hs(b.x * 31.))), d * .0045);
  o.cp = g.vp * vec4f(p + (g.right.xyz * q.x + g.up.xyz * q.y) * sz, 1.); o.uv = q;
  let e = min(b.z * 1.3 / sz, 1.);
  let lit = g.sc.rgb * shadow1(p + g.sun.xyz * .03) * (1.3 + 22. * tw * step(.3, hs(b.x * 77.))) + g.ac.rgb * (.2 + .5 * tw);
  o.col = mix(vec3f(1., .9, .72), pal(b.y), .35) * lit * (g.sun.w * e * e * exp(-tau(g.cam.xyz, v / d, d)) * ss(.2, .7, d) * 1.7);
  return o;
}
@fragment fn fsGl(i: GO) -> @location(0) vec4f {
  let r = dot(i.uv, i.uv); let a = abs(i.uv);
  let star = exp(-r * 8.) + .35 * exp(-min(a.x, a.y) * 22.) * exp(-max(a.x, a.y) * 3.2);
  return vec4f(min(i.col * star * (1. - ss(.7, 1., r)), vec3f(12.)), 0.);
}
@fragment fn fs(i: LO) -> @location(0) vec4f {
  let dist = length(i.wp - g.cam.xyz);
  let V = normalize(g.cam.xyz - i.wp); let L = g.sun.xyz; let H = normalize(V + L);
  // the vertex normal points out of the underside
  var n = normalize(i.n); let under = dot(n, V) > 0.; if (!under) { n = -n; }
  let u = i.uv.x; let v = i.uv.y; let au = abs(u); let st = i32(i.pr.w + .5);
  let lt = textureSample(tD, sR, vec2f(u * .11 + i.sd.x * 3.7, v * .5 + i.sd.y * 5.3));
  let lt2 = textureSample(tD, sR, vec2f(u * i.k.z * 9., v * i.k.y * 18.) + i.sd.xy * 7.);
  let dw = textureSample(tW, sR, vec2f(u * i.k.z * .5, v * i.k.y) * 9. + i.sd.xy * 5.);
  let fade = ss(9., 2.5, dist);
  // midrib and side veins
  let mid = ss(.09, 0., au) * ss(1., .7, v);
  let vk = select(select(7., 5., st == 2), 11., st == 3);
  var lat = ss(.82, 1., sin((v * vk - au * 1.3) * 3.14159 + i.sd.x * 3.)) * ss(.02, .2, au);
  if (st == 4) { lat = ss(.5, 1., sin(u * 9.)) * .5; }
  if (st == 0 || st == 5) { lat = 0.; }
  var alb = i.col * (.7 + .6 * lt.b) * (.8 + .4 * lt2.a) * mix(.75, 1.08, v);
  alb = mix(alb, alb * 1.45 + vec3f(.018, .028, 0.), (mid * .8 + lat * select(.45, .15, st == 2)) * fade * f32(st != 5));
  if (st == 2) { alb = mix(alb, vec3f(.31, .38, .30) * (.6 + .5 * lt2.b), ss(.42, .6, lt.a) * .5 * fade + mid * .3 * fade); }   // silver mottling
  if (st == 3) { alb *= 1. - .25 * lat * fade; }
  if (st == 5) { alb *= (.75 + .35 * v) * (1. - .2 * ss(.6, 1., sin(u * 14.))); }
  if (under) { alb = mix(alb, alb * 1.25 + vec3f(.015, .02, .012), sat(i.k.w)) + vec3f(.10, .13, .10) * max(i.k.w - 1., 0.); }
  let ao = i.sd.z * mix(.7, 1., v);
  let E = g.sc.rgb * shadow4(i.wp + L * .03);
  let ndl = dot(n, L); let ndv = sat(dot(n, V)); let tr = i.pr.x;
  let trc = alb * vec3f(1.5, 1.35, .65);   // light through a leaf turns yellow-green
  let am = (amb(n) * 1.2 + amb(-n) * tr * .6 * vec3f(1.05, 1.1, .6) + lamp(i.wp, n)) * ao;
  var c = alb * E * max(ndl, 0.) + trc * E * (max(-ndl, 0.) * tr * (.8 + 1.2 * pow(sat(dot(-V, L)), 4.))) + alb * am;
  let gl = i.pr.y * select(1., .4, under);
  c += E * (pow(sat(dot(n, H)), 48.) * gl * 1.2 * max(ndl, 0.)) + fogCol(reflect(-V, n)) * (ao * gl * (.03 + .5 * pow(1. - ndv, 4.)));
  // dew: beads up close, a twinkle from further away
  let da = g.sun.w * i.pr.z * select(1., .35, under);
  let dn = ss(5., 1.5, dist);
  let nd = normalize(n + (i.tg * dw.g + cross(n, i.tg) * dw.r) * 1.5);
  let dm = dw.b * da * dn * (.15 + .85 * g.sc.w);
  c = mix(c, c * .85 + fogCol(reflect(-V, nd)) * .2, dm);
  c += (E * (pow(sat(dot(nd, H)), 600.) * 16. + pow(sat(dot(nd, H)), 40.) * .7) + g.ac.rgb * pow(sat(nd.y), 30.) * .1) * dm;
  let tw = pow(.5 + .5 * sin(g.cam.w * (.4 + i.sd.y * 1.1) + i.sd.x * 90. + dot(V, vec3f(7., 3., 5.)) * 9.), 6.);
  let gp = vec2f(u - (i.sd.x - .5) * 1.2, (v - (.3 + .5 * i.sd.y)) * 3.);
  c += min(E, vec3f(1.5)) * (tw * ss(.3, 0., length(gp)) * da * step(.45, hs(i.sd.x * 53.1)) * 4. * ss(.8, 3., dist) * ss(22., 10., dist));
  // toothed edge: the strip is the leaf's outline, the teeth are cut out of it (they point toward the tip)
  let edge = 1. - i.tt.x * (1. - fract(v * i.tt.y + i.sd.y * 3.)) * ss(0., .15, v) * ss(1., .9, v);
  let aa = fwidth(au) * .75 + 1e-4;
  let al = select(ss(edge + aa, edge - aa, au), 1., i.tt.x == 0.);
  if (LOW && al < .5) { discard; }
  return vec4f(fin(fog(c, i.wp)).rgb, al);
}
`;

// ---------------------------------------------------------------- the cat on the fence + birds in the fog
const W_ANIM = S_B + /*wgsl*/`
struct VI { @location(0) p: vec3f, @location(1) n: vec4f, @location(2) a: vec4f, @location(3) b: vec4f };
struct VO { @builtin(position) cp: vec4f, @location(0) wp: vec3f, @location(1) n: vec3f, @location(2) op: vec3f, @location(3) @interpolate(flat) sd: f32 };
// birds: a = centre of the loop + its radius, b = seed, turn rate, size, phase
@vertex fn vsBird(i: VI) -> VO {
  var o: VO;
  let s = i.b.x; let t = g.cam.w; let R = i.a.w;
  let ta = t * i.b.y + i.b.w * 6.3;
  let P = i.a.xyz + vec3f(R * cos(ta), 1.2 * sin(2.3 * ta + s * 20.), R * .7 * sin(ta));
  let T = normalize(vec3f(-R * sin(ta), 2.76 * cos(2.3 * ta + s * 20.), R * .7 * cos(ta))) * sign(i.b.y);
  let S = normalize(cross(vec3f(0., 1., 0.), T)); let Up = cross(T, S);
  var l = i.p * i.b.z;
  // flap, then glide a moment
  l.y += abs(i.n.w) * i.b.z * (sin(t * (11. + 5. * hs(s)) + s * 50.) * .5 * ss(-.3, .4, sin(t * .9 + s * 30.)) + .1);
  let w = P + T * l.x + Up * l.y + S * l.z;
  o.cp = g.vp * vec4f(w, 1.); o.wp = w; o.n = T * i.n.x + Up * i.n.y + S * i.n.z; o.op = i.p; o.sd = s;
  return o;
}
@fragment fn fsBird(i: VO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let n = normalize(i.n) * select(-1., 1., ff);
  return fin(fog(vec3f(.07, .065, .06) * (g.sc.rgb * sat(dot(n, g.sun.xyz)) + amb(n)), i.wp));
}
// cat: a = position + scale, b = quaternion. Vertex aux > 0 runs along the tail, < 0 is how much a vertex follows the head
@vertex fn vsCat(i: VI) -> VO {
  var o: VO; let t = g.cam.w; let k = i.n.w;
  var l = i.p; var n = i.n.xyz;
  if (k < 0.) {
    // the head turns to whoever is in the yard
    let cp = cos(g.wd.z * -k); let sp = sin(g.wd.z * -k); let cy = cos(g.ac.w * -k); let sy = sin(g.ac.w * -k); let pv = vec3f(.08, .29, 0.);
    var r = l - pv;
    r = vec3f(r.x * cp - r.y * sp, r.x * sp + r.y * cp, r.z); n = vec3f(n.x * cp - n.y * sp, n.x * sp + n.y * cp, n.z);
    r = vec3f(r.x * cy + r.z * sy, r.y, r.z * cy - r.x * sy); n = vec3f(n.x * cy + n.z * sy, n.y, n.z * cy - n.x * sy);
    l = r + pv;
  } else if (k > 0.) {
    // the tail lies along the fence cap; its end flicks
    l.z += (sin(t * 1.3 - k * 2.2) * .6 + sin(t * .37) * .4) * .03 * k * k; l.y += max(sin(t * .9 - k * 1.7), 0.) * .022 * k * k * k;
  }
  let w = i.a.xyz + qrot(i.b, l * i.a.w);
  o.cp = g.vp * vec4f(w, 1.); o.wp = w; o.n = qrot(i.b, n); o.op = i.p; o.sd = k;
  return o;
}
@fragment fn fsCat(i: VO) -> @location(0) vec4f {
  let p = i.op; let n = normalize(i.n); let L = g.sun.xyz; let V = normalize(g.cam.xyz - i.wp);
  let tx = textureSample(tD, sR, p.xy * 3. + p.z * 2.);
  let fur = textureSample(tD, sR, p.xy * 23. + p.z * 17.);
  // grey tabby: dark bands, white bib, muzzle and paws
  let band = ss(.55, .8, sin(p.x * 185. + p.y * 70. + sin(p.y * 45.) * .7 + tx.a * 3.) * .5 + .5) * (.6 + .4 * tx.b);
  var alb = mix(vec3f(.30, .26, .215), vec3f(.085, .072, .062), band * .7) * (.65 + .6 * fur.b);
  let wh = max(max(ss(.055, .095, p.x) * ss(.295, .24, p.y) * ss(.04, .1, p.y) * ss(.05, .02, abs(p.z)), ss(.04, .02, p.y) * step(0., p.y) * ss(.065, .085, p.x)), ss(.04, .026, distance(p, vec3f(.142, .318, 0.))));
  alb = mix(alb, vec3f(.6, .58, .54) * (.75 + .4 * fur.b), wh);
  alb = mix(alb, vec3f(.3, .13, .11), ss(.011, .006, distance(p, vec3f(.168, .327, 0.))));   // nose
  // eyes: amber-green, slit pupils
  let e = vec3f(p.x - .139, p.y - .347, abs(p.z) - .0255); let ed = length(e * vec3f(.5, 1., 1.));
  let eye = ss(.0125, .0105, ed);
  let iris = mix(vec3f(.55, .58, .12), vec3f(.25, .33, .06), ss(.004, .011, ed)) * (1. - ss(.0035, .002, abs(e.z) + abs(e.y) * .25));
  let E = g.sc.rgb * shadow4(i.wp + n * .01 + L * .02);
  let ndv = sat(dot(n, V));
  let am = amb(n) + lamp(i.wp, n);
  // fur: soft wrap lighting, and a bright fringe where the sun is behind it
  var c = alb * (E * sat((dot(n, L) + .35) / 1.35) + am);
  c += (E * (.25 + 2.5 * pow(sat(dot(-V, L)), 2.)) + am * .4) * (alb + .08) * pow(1. - ndv, 2.5) * (.5 + fur.a);
  let ec = iris * (am * 1.6 + E + .02) + (E + g.ac.rgb) * pow(sat(dot(reflect(-V, n), normalize(L + vec3f(0., .6, 0.)))), 60.) * 1.5;
  c = mix(c, ec, eye);
  return fin(fog(c, i.wp));
}
`;

// ---------------------------------------------------------------- behind everything: the sky seen through the fog
const W_SKY = S_B + /*wgsl*/`
struct VO { @builtin(position) cp: vec4f, @location(0) wp: vec3f };
@vertex fn vsB(@builtin(vertex_index) i: u32) -> VO {
  var o: VO;
  let p = vec2f(f32(i & 1u), f32(i >> 1u)) * 2. - 1.;
  o.wp = g.cam.xyz + g.fwd.xyz + g.right.xyz * (p.x * g.right.w) + g.up.xyz * (p.y * g.up.w);
  o.cp = vec4f(p, 1e-7, 1.);
  return o;
}
fn sg2(p: vec2f, a: vec2f, b: vec2f) -> f32 { let pa = p - a; let ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)); }
// the three-pronged tower on the hill, in (azimuth, height) seen from the yard
fn tower(p: vec2f) -> f32 {
  let q = vec2f(abs(p.x), p.y);
  var d = sg2(q, vec2f(.019, 0.), vec2f(.008, .07));
  d = min(d, sg2(q, vec2f(.008, .07), vec2f(.0105, .105)));
  d = min(d, sg2(q, vec2f(.0105, .105), vec2f(.0105, .14)) * 1.7);
  d = min(d, sg2(q, vec2f(0., 0.), vec2f(0., .13)) * 1.4);
  d = min(d, sg2(q, vec2f(0., .035), vec2f(.0135, .035)));
  d = min(d, sg2(q, vec2f(0., .07), vec2f(.008, .07)));
  return min(d, sg2(q, vec2f(0., .105), vec2f(.0105, .105)));
}
@fragment fn fsB(i: VO) -> @location(0) vec4f {
  let rd = normalize(i.wp - g.cam.xyz); let mu = dot(rd, g.sun.xyz); let m = max(mu, 0.);
  let D = g.fg.y; let h = max(rd.y, 0.);
  // clear sky above the fog: blue overhead, warm toward the horizon and the sun
  var sky = mix(mix(vec3f(.40, .38, .40), vec3f(.78, .70, .60), D), mix(vec3f(.09, .14, .27), vec3f(.18, .40, .85), D), pow(h, .45));
  sky += mix(vec3f(.9, .35, .12), vec3f(1., .75, .45), D) * (pow(m, 6.) * .5 + pow(m, 60.) * 1.5);
  // the hill and its tower, off to the right of the sunrise
  let az = atan2(rd.x, -rd.z); let el = rd.y / max(length(rd.xz), 1e-3); let hz = az - 1.32;
  let rg = .075 + .05 * exp(-hz * hz * 3.) + .012 * sin(az * 5. + 2.) + .009 * sin(az * 9.) + .006 * sin(az * 17. + .5) + .004 * sin(az * 31. + 1.) + .002 * sin(az * 67. + 3.);
  let aa = fwidth(el) * 1.2;
  let sil = max(ss(aa, -aa, el - rg), ss(.0012 + aa, .0012 - aa, tower(vec2f(hz, el - rg + .01))));
  sky = mix(sky, mix(vec3f(.08, .10, .13), sky, .3), sil * ss(.0, .07, el));   // the foot of the hill is lost in the fog
  // the fog layer from below: patches thin out and the sky shows through
  let cu = rd.xz / max(rd.y, .08) * .02 + g.wd.xy * (g.cam.w * .0015);
  let cn = textureSample(tD, sR, cu).a * .65 + textureSample(tD, sR, cu * 2.7 + .31).a * .35;
  // at the horizon the sky is fogged exactly like the far ground, so no line shows where they meet
  let T = exp(-tau(g.cam.xyz, rd, 4000.) * mix(1., .35 + 1.3 * ss(.3, .7, cn), ss(.02, .16, rd.y)));
  let sun = g.sc.rgb / max(g.sc.w, .02) * (ss(.999972, .999989, mu) * 14.);
  return fin((sky + sun) * T + fogCol(rd) * (1. - T) + g.gl.rgb * (pow(m, 900.) * 2.2 + pow(m, 90.) * .55) * (1. - T));
}
`;

// ---------------------------------------------------------------- sprites: falling drops (alpha) and drifting mist (additive)
const W_SPR = S_B + /*wgsl*/`
struct VO { @builtin(position) cp: vec4f, @location(0) uv: vec2f, @location(1) @interpolate(flat) pr: vec4f, @location(2) wp: vec3f };
fn quad(i: u32) -> vec2f { return vec2f(f32(i & 1u), f32(i >> 1u)) * 2. - 1.; }
// a drop swells at an emitter or a leaf tip, then falls: a = where it forms + radius, b = seed, period, fall height, flex
@vertex fn vsBub(@builtin(vertex_index) vi: u32, @location(0) a: vec4f, @location(1) b: vec4f) -> VO {
  var o: VO; let q = quad(vi); let t = g.cam.w;
  let ph = fract(t / b.y + b.x); let grow = ss(0., .7, ph); let fall = max(ph - .72, 0.) / .28;
  var p = a.xyz + sway(a.xz, b.w, t);
  p.y -= a.w * grow + fall * fall * b.z;
  let sz = a.w * (.3 + .7 * grow) * (1. - ss(.9, 1., fall));
  let w = p + (g.right.xyz * q.x + g.up.xyz * q.y * (1. + fall * 1.5)) * sz;
  o.cp = g.vp * vec4f(w, 1.); o.uv = q; o.wp = p;
  o.pr = vec4f(b.x, sz, shadow1(p), 0.);
  return o;
}
@fragment fn fsBub(i: VO) -> @location(0) vec4f {
  let r = length(i.uv);
  let disc = 1. - ss(1. - fwidth(r) * 1.5, 1., r);
  let rim = ss(.5, .98, r);
  let hl = ss(.3, 0., length(i.uv - vec2f(-.35, .4))) + .5 * ss(.2, 0., length(i.uv - vec2f(.38, -.42)));
  // a drop is a lens: the bright sky sits at its bottom, the ground at its top
  var c = mix(fogCol(vec3f(0., 1., 0.)) * 1.2, g.ac.rgb * vec3f(.14, .1, .07), ss(-.6, .5, i.uv.y)) * (.6 + rim) + g.sc.rgb * (.25 + .75 * i.pr.z) * hl * 3.;
  let al = disc * sat(.3 + rim * rim * .6 + hl);
  let v = i.wp - g.cam.xyz; let d = length(v);
  c = fog(c, i.wp);
  return vec4f(min(max(c * al, vec3f(0.)), vec3f(20.)), al);
}
@vertex fn vsSnow(@builtin(vertex_index) vi: u32, @location(0) a: vec4f) -> VO {
  var o: VO; let q = quad(vi); let t = g.cam.w;
  let B = 7.;
  var p = a.xyz * B + vec3f(g.wd.x, -.04, g.wd.y) * (t * .22) + .15 * vec3f(sin(t * .3 + a.x * 60.), sin(t * .23 + a.y * 50.), cos(t * .27 + a.z * 70.));
  p = g.cam.xyz + (fract((p - g.cam.xyz) / B + .5) - .5) * B;
  let d = length(p - g.cam.xyz);
  let sz = .0004 + .0011 * a.w * a.w * a.w;
  let w = p + (g.right.xyz * q.x + g.up.xyz * q.y) * max(sz, d * .0011);
  o.cp = g.vp * vec4f(w, 1.); o.uv = q; o.wp = p;
  let k = min(1., sz / (d * .0011));
  let fade = ss(B * .5, B * .3, d) * ss(.15, .6, d) * k * k * ss(.02, .15, p.y);
  o.pr = vec4f(fade * (.6 + .4 * sin(t * (1. + a.w * 2.) + a.x * 100.)), shadow1(p), a.w, d);
  return o;
}
@fragment fn fsSnow(i: VO) -> @location(0) vec4f {
  let m = ss(1., .2, length(i.uv));
  let mu = max(dot(normalize(i.wp - g.cam.xyz), g.sun.xyz), 0.);
  // droplets of mist: they light up looking toward the sun
  let c = g.sc.rgb * (i.pr.y * (1.2 + 14. * pow(mu, 6.))) + g.ac.rgb * .5;
  return vec4f(min(max(c * (m * m * i.pr.x * exp(-g.fg.x * i.pr.w) * .12 * pow(mu, 3.)), vec3f(0.)), vec3f(1.)), 0.);
}
`;

// ---------------------------------------------------------------- the fog itself (half res): rolling banks, wisps over the
// ground, sunlight through them (shadowed by the fence, the vines and the cat) and the glow of the porch lamp.
// The scene shaders fog every pixel evenly; this adds what the uneven, sunlit fog does differently, so it can be negative.
const W_RAYS = S_G + W_FS + /*wgsl*/`
@group(0) @binding(0) var<uniform> g: G;
@group(0) @binding(1) var sR: sampler;
@group(0) @binding(2) var sS: sampler_comparison;
@group(0) @binding(3) var tSh: texture_depth_2d;
@group(0) @binding(5) var tDp: texture_depth${AA > 1 ? '_multisampled' : ''}_2d;
@group(0) @binding(6) var tV: texture_3d<f32>;
@fragment fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let dp = textureLoad(tDp, vec2i(fc.xy) * 2, 0);
  let uv = fc.xy * 2. * g.res.zw;
  let nd = vec2f(uv.x * 2. - 1., 1. - uv.y * 2.);
  let rv = g.fwd.xyz + g.right.xyz * (nd.x * g.right.w) + g.up.xyz * (nd.y * g.up.w);
  let rl = length(rv); let rd = rv / rl;
  let zl = g.fwd.w / max(dp, 1e-6);
  let tm = min(zl * rl, 70.);
  let ro = g.cam.xyz; let t = g.cam.w;
  let dr = vec3f(g.wd.x, 0., g.wd.y) * t * 2.5;   // the fog drifts with the wind
  let j = ign(fc.xy); let so = vec2f(3.5, 2.) / vec2f(textureDimensions(tSh));
  var sun = 0.; var lmp = 0.; var th = 0.; var tp = 0.;
  for (var n = 0; n < ${RAYN}; n++) {
    // steps grow with distance
    let x = (f32(n) + j) / ${RAYN}.; let tt = tm * x * (.3 + .7 * x); let dt = tt - tp; tp = tt;
    let p = ro + rd * (tt - dt * .5);
    let a = textureSampleLevel(tV, sR, p * vec3f(.075, .11, .075) - dr * .04, 0.).r;
    let b = textureSampleLevel(tV, sR, p * .14 - dr * .06 + vec3f(0., t * .008, 0.), 0.).g;
    // the banks and wisps even out with distance, where the steps are too long to resolve them
    let fd = ss(12., 34., tt);
    var nz = mix(.12 + 3.3 * ss(.4, .68, a * .75 + b * .25), 1., fd);
    // wisps creeping over the ground
    let wsp = exp(-max(p.y, 0.) / (.7 + 1.8 * a)) * ss(.42, .7, textureSampleLevel(tV, sR, p * .1 - dr * .05 + .5, 0.).r * .6 + b * .4);
    let rho = select((g.fg.x * exp(-max(p.y, 0.) / g.mis.w) * nz + max(g.fg.x, .05) * 2.4 * wsp * (1. - fd)) * dt, 0., homeIn(p));   // (none indoors)
    let s = g.sm * vec4f(p, 1.);
    let su = vec2f(s.x * .5 + .5, .5 - s.y * .5);
    // shadows fade out toward the edge of the shadow map, so no shaft ends in a hard line
    let vis = mix(.5 * (textureSampleCompareLevel(tSh, sS, su + so, s.z - .0003) + textureSampleCompareLevel(tSh, sS, su - so, s.z - .0003)), mix(1., .8, ss(9., 24., tt)), max(ss(.3, .95, max(abs(s.x), abs(s.y))), ss(9., 24., tt)));   // and into the distance
    let T = exp(-th - rho * .5);
    sun += rho * T * vis;
    let lv = PL - p; lmp += rho * T / (dot(lv, lv) + .3);
    th += rho;
  }
  let mu = dot(rd, g.sun.xyz); let ft = select(exp(-tau(ro, rd, tm)) - exp(-th), 0., homeIn(ro));   // dark holes in the fog are kept shallow
  let c = g.sc.rgb * (sun * (.62 * hg(mu, .74) + .3 * hg(mu, .25) + .012) * g.mis.y) + PLC * (lmp * g.gl.w * .5)
        + fogCol(rd) * (ft / (1. + 5. * max(-ft, 0.)));
  return vec4f(clamp(c, vec3f(-20.), vec3f(20.)), zl);
}
`;
// depth-aware 3x3 blur of the half-res shafts (hides the sampling dither)
const W_RBLUR = W_FS + /*wgsl*/`
@group(0) @binding(0) var tR: texture_2d<f32>;
@fragment fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let p = vec2i(fc.xy); let mx = vec2i(textureDimensions(tR)) - 1;
  let c = textureLoad(tR, p, 0);
  var acc = vec3f(0.); var ws = 0.;
  for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) {
    let r = textureLoad(tR, clamp(p + vec2i(x, y) , vec2i(0), mx), 0);
    let w = 1. / (.03 + abs(r.a - c.a) / c.a);
    acc += r.rgb * w; ws += w;
  } }
  return vec4f(acc / ws, c.a);
}
`;


// ---------------------------------------------------------------- final composite
const W_POST = S_G + W_FS + /*wgsl*/`
@group(0) @binding(0) var<uniform> g: G;
@group(0) @binding(1) var sC: sampler;
@group(0) @binding(2) var tS: texture_2d<f32>;
@group(0) @binding(3) var tR: texture_2d<f32>;
@group(0) @binding(4) var tB: texture_2d<f32>;
@group(0) @binding(5) var tDp: texture_depth${AA > 1 ? '_multisampled' : ''}_2d;
fn sat3(x: vec3f) -> vec3f { return clamp(x, vec3f(0.), vec3f(1.)); }
fn tmap(x: vec3f) -> vec3f { return sat3((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14)); }
@fragment fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let px = vec2i(fc.xy);
  let uv = fc.xy * g.res.zw;
  let zf = g.fwd.w / max(textureLoad(tDp, px, 0), 1e-6);
  // depth-aware upsample of the half-res fog
  let h = fc.xy * .5 - .5; let b = floor(h); let f = h - b; let bi = vec2i(b);
  let mx = vec2i(textureDimensions(tR)) - 1;
  var acc = vec3f(0.); var ws = 0.;
  for (var k = 0; k < 4; k++) {
    let o = vec2i(k & 1, k >> 1);
    let r = textureLoad(tR, clamp(bi + o, vec2i(0), mx), 0);
    let bw = mix(1. - f.x, f.x, f32(o.x)) * mix(1. - f.y, f.y, f32(o.y));
    let w = (bw + .02) / (.02 + abs(r.a - zf) / zf);
    acc += r.rgb * w; ws += w;
  }
  var c = max(textureLoad(tS, px, 0).rgb + acc / ws, vec3f(0.));
  // bloom: bright things glow in the damp air
  let bl = textureSampleLevel(tB, sC, uv, 0.).rgb;
  c = mix(c, bl, .09) + bl * .04;
  c *= g.mis.x;
  let q = uv - .5;
  c *= 1. - dot(q, q) * .28;
  c = tmap(c);
  // grade: a gentle curve, cool shadows and warm lights
  let l0 = dot(c, vec3f(.2126, .7152, .0722));
  let l = mix(l0, l0 * l0 * (3. - 2. * l0), .32);
  c *= l / max(l0, 1e-4);
  c *= mix(vec3f(.95, 1., 1.07), vec3f(1.04, 1., .95), ss(.1, .75, l));
  c = mix(vec3f(l), c, 1.05) + vec3f(.004, .005, .008);
  c = pow(max(c, vec3f(0.)), vec3f(1. / 2.2));
  let n = ign(fc.xy) + ign(fc.xy + 37.) - 1.;
  return vec4f(c + n / 255., 1.);
}
`;
