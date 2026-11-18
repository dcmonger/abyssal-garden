// ============================================================================
// audio: a foggy dawn in the city, synthesized (no sample files)
// ============================================================================
// A fixed Web Audio graph, built on the first click / key / touch and driven by a 10 Hz timer, not the frame loop.
// Layers: wind (a low bed of moving air, gusts, leaves hissing in them, air rushing past when the camera moves fast), two
// a soft pad of slowly changing major chords under it all, birds that sing more as it gets light (a robin, sparrows, a
// finch, a mourning dove, a hummingbird and a distant crow), now and then a foghorn far off across the water, and the
// neighbourhood's traffic: a faint hum, cars going by and a bus pulling in.
let AC, OUT, muted = false;
const VOL = 0.8; // master level
function mkSound(ac) {
  const sr = ac.sampleRate;
  // node of class C with options o, connected to every node / param in `to`; sources start at once
  const N = (C, o, ...to) => { const n = new C(ac, o); for (const d of to) n.connect(d); if (n.start) n.start(); return n; };
  const G = (gain, ...to) => N(GainNode, { gain }, ...to);
  const BQ = (type, frequency, Q, ...to) => N(BiquadFilterNode, { type, frequency, Q }, ...to);
  const lfo = (frequency, depth, to) => N(OscillatorNode, { frequency }, G(depth, to));
  const noise = (secs, f) => { const n = sr * secs | 0, b = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: sr }); f(b.getChannelData(0), n); f(b.getChannelData(1), n); return b; };
  // seamless noise loops (the end cross-fades into the start): brown for moving air, white for leaves
  const loop = (secs, k) => noise(secs, (d, n) => { for (let i = 0, b = 0; i < n + 4096; i++) { b = k ? (b + 0.02 * (rnd() * 2 - 1)) / 1.02 : rnd() * 2 - 1; const v = k ? b * 3.5 : b * 0.5; if (i < n) d[i] = v; else { const q = (i - n) / 4096; d[i - n] = d[i - n] * q + v * (1 - q); } } });
  const nb = loop(11, 1), nw = loop(5, 0);
  // reverb impulse: open air between houses, 2.5 s of noise that fades out and gets darker
  const ir = noise(2.5, (d, n) => { for (let i = 0, b = 0; i < n; i++) { const t = i / sr; b += (rnd() * 2 - 1 - b) * (0.06 + 0.6 * exp(-t * 4)); d[i] = b * (1 - exp(-t * 60)) * exp(-t * 2.6) * (1 - i / n); } });

  const lim = N(DynamicsCompressorNode, { threshold: -6, knee: 6, ratio: 20, attack: 0.003, release: 0.3 }, ac.destination);
  const out = OUT = G(0, lim), wet = N(ConvolverNode, { buffer: ir }, out);
  const src = (buffer, playbackRate, ...to) => N(AudioBufferSourceNode, { buffer, loop: true, playbackRate }, ...to);
  // wind: the same noise played at different speeds, so the loops never line up
  const air = G(0.11, out); src(nb, 1, BQ('lowpass', 260, 0.6, BQ('highpass', 70, 0.7, air))); lfo(0.06, 0.04, air.gain); lfo(0.097, 0.03, air.gain);
  const gust = G(0.055, out), gf = BQ('bandpass', 430, 0.55, gust), rush = G(0, out), rushF = BQ('bandpass', 300, 0.9, rush);
  src(nb, 0.63, gf, rushF); lfo(0.071, 0.05, gust.gain); lfo(0.127, 0.035, gust.gain); lfo(0.043, 150, gf.frequency);
  const hiss = G(0.016, out); src(nw, 1, BQ('highpass', 3600, 0.5, BQ('lowpass', 9000, 0.5, hiss))); lfo(0.071, 0.011, hiss.gain); lfo(0.19, 0.006, hiss.gain);
  // traffic: a hum from every direction, louder close to a street; single cars swish past; a bus growls by and stops
  const hum = G(0, out); src(nb, 0.41, BQ('lowpass', 150, 0.7, hum)); src(nb, 0.87, BQ('bandpass', 520, 0.6, G(0.25, hum)));
  const carP = N(StereoPannerNode, {}, G(1, out), G(0.6, wet)), carG = G(0, carP), carF = BQ('bandpass', 400, 1.2, carG); src(nb, 1.3, carF);
  const busP = N(StereoPannerNode, {}, G(1, out), G(0.9, wet)), busG = G(0, BQ('lowpass', 260, 0.9, busP));
  const busO = [1, 2, 3.02].map((h, i) => N(OscillatorNode, { type: 'sawtooth', frequency: 41 * h }, G(1 / (1 + i), busG)).frequency);
  const pssh = G(0, busP); src(nw, 1, BQ('highpass', 1800, 0.7, pssh));
  let tCar = ac.currentTime + 6, tBus = ac.currentTime + 40;
  // foghorns: stacked saws through a low-pass, mostly reverb. hold() sounds one for dur seconds; it sags as it stops
  const horn = (f, pan) => {
    const g = G(0, BQ('lowpass', 240, 0.6, N(StereoPannerNode, { pan }, G(0.3, out), G(1.6, wet))));
    const os = [1, 2.004, 3.01, 4.02].map((h, i) => N(OscillatorNode, { type: 'sawtooth', frequency: f * h }, G(1 / (1 + i * i), g)).frequency);
    return (t, dur, vol) => {
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.3); g.gain.setValueAtTime(vol, t + dur); g.gain.setTargetAtTime(0, t + dur, 0.22);
      os.forEach((o, i) => { const h = f * [1, 2.004, 3.01, 4.02][i]; o.setValueAtTime(h, t + dur - 0.1); o.linearRampToValueAtTime(h * 0.86, t + dur + 0.5); o.setValueAtTime(h, t + dur + 2.5); });
    };
  };
  const hornA = horn(131, -0.55), hornB = horn(98, 0.6);
  // the pad: two detuned triangle oscillators per note, four notes, through a gentle low-pass and mostly into the reverb.
  // Every 14 s the notes glide to the next chord of a slow major progression (I - vi - IV - V, with sevenths and ninths)
  const padG = G(0, BQ('lowpass', 1400, 0.4, G(0.5, out), G(1.1, wet))), padF = [];
  for (let k = 0; k < 4; k++) for (const d of [-4, 5]) { const o = N(OscillatorNode, { type: 'triangle', frequency: 220, detune: d }, N(StereoPannerNode, { pan: (k - 1.5) * 0.35 }, G(0.25, padG))); padF.push(o.frequency); }
  const CH = [[261.6, 329.6, 392, 493.9], [220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6], [196, 246.9, 293.7, 440]];
  let tPad = ac.currentTime, nPad = 0;
  padG.gain.setTargetAtTime(0.05, ac.currentTime + 2, 4);
  // a bird: oscillator -> envelope -> pan -> dry + reverb, with a second oscillator that warbles its pitch (trills, buzzes)
  const bird = (pan, type = 'sine', send = 0.8, vol = 1) => {
    const p = N(StereoPannerNode, { pan }, G(vol, out), G(send * vol, wet)), g = G(0, type === 'sine' ? p : BQ('bandpass', 1500, 1.1, p)), o = N(OscillatorNode, { type }, g), md = G(0, o.frequency), m = N(OscillatorNode, { frequency: 30 }, md);
    // one note: pitch glides f0 -> f1 (-> f2) over dur, the level rises in att and falls away at the end
    return (t, f0, f1, dur, v, att = 0.012, wr = 0, wd = 0, f2 = 0) => {
      const f = o.frequency, a = g.gain;
      f.setValueAtTime(f0, t); if (f2) { f.exponentialRampToValueAtTime(f1, t + dur * 0.5); f.exponentialRampToValueAtTime(f2, t + dur); } else f.exponentialRampToValueAtTime(f1, t + dur);
      m.frequency.setValueAtTime(wr || 30, t); md.gain.setValueAtTime(wd, t);
      a.setValueAtTime(0, t); a.linearRampToValueAtTime(v, t + att); a.setValueAtTime(v, t + dur - att); a.linearRampToValueAtTime(0, t + dur);
      return t + dur;
    };
  };
  // each singer: its voice, when it sings next, how often (s between songs at full light), and how early it wakes (dawn 0..1)
  const B = [
    // robin: slow warbled phrases, the first one up
    { n: bird(-0.6), gap: 5, wake: 0, song: (n, t) => { for (let i = 2 + rnd() * 4 | 0; i--;) { const f = rr(2100, 3100); t = n(t, f, f * rr(1.15, 1.4), rr(0.2, 0.3), 0.035, 0.03, 13, 90, f * rr(0.85, 1.1)) + rr(0.08, 0.2); } } },
    // white-crowned sparrow: two clear whistles, then a buzz and a few falling notes
    { n: bird(0.5), gap: 9, wake: 0.25, song: (n, t) => { t = n(t, 3900, 3750, 0.45, 0.03, 0.05) + 0.06; t = n(t, 4700, 4600, 0.24, 0.03, 0.03) + 0.05; t = n(t, 4300, 3900, 0.3, 0.028, 0.02, 48, 520) + 0.04; for (let i = 0; i < 3; i++) t = n(t, 3900 - i * 250, 3100 - i * 200, 0.11, 0.028) + 0.035; } },
    // house finch: a long hurried jumble
    { n: bird(0.15, 'sine', 1), gap: 11, wake: 0.4, song: (n, t) => { for (let i = 9 + rnd() * 9 | 0; i--;) { const f = rr(2600, 5200); t = n(t, f, f * rr(0.7, 1.45), rr(0.05, 0.11), 0.022, 0.008, 60, rnd() < 0.3 ? 300 : 0) + rr(0.012, 0.05); } } },
    // song sparrow, further off: three sharp notes and a trill
    { n: bird(-0.25, 'sine', 1.6, 0.6), gap: 13, wake: 0.3, song: (n, t) => { for (let i = 0; i < 3; i++) t = n(t, 4100, 4000, 0.09, 0.03) + 0.1; t = n(t, 5200, 3600, 0.16, 0.03, 0.01, 35, 400) + 0.03; n(t, 4400, 4400, 0.5, 0.026, 0.02, 26, 700); } },
    // mourning dove: coo-OO-oo, oo, oo
    { n: bird(0.75, 'sine', 1.2), gap: 17, wake: 0.1, song: (n, t) => { t = n(t, 430, 500, 0.3, 0.05, 0.08) + 0.02; t = n(t, 505, 440, 0.6, 0.075, 0.1) + 0.3; for (let i = 0; i < 3; i++) t = n(t, 440, 425, 0.42, 0.05, 0.1) + 0.32; } },
    // Anna's hummingbird: a scratchy run of ticks
    { n: bird(-0.8, 'sine', 0.5, 0.7), gap: 21, wake: 0.55, song: (n, t) => { for (let i = 6 + rnd() * 10 | 0; i--;) t = n(t, rr(6500, 9000), rr(5500, 8000), 0.028, 0.016, 0.004, 110, 900) + rr(0.03, 0.09); } },
    // crow, a few gardens away
    { n: bird(0.35, 'sawtooth', 2.2, 0.8), gap: 34, wake: 0.2, song: (n, t) => { for (let i = 2 + rnd() * 3 | 0; i--;) t = n(t, 470, 400, rr(0.24, 0.32), 0.09, 0.03, 75, 60, 330) + rr(0.14, 0.22); } },
  ];
  let lt = ac.currentTime, tA = lt + 4, tB = lt + 15, lx = F[CX], ly = F[CY], lz = F[CZ];
  B.forEach((b, i) => { b.t = lt + 2 + i * 2.5 + rnd() * 4; });
  out.gain.setTargetAtTime(VOL, lt, 1);
  return () => {
    const now = ac.currentTime, t = now + 0.05, dt = now - lt;
    if (dt <= 0) return;
    let v = hypot(F[CX] - lx, F[CY] - ly, F[CZ] - lz) / dt; if (v > 20) v = 0; // ignore jumps to a viewpoint
    lt = now; lx = F[CX]; ly = F[CY]; lz = F[CZ];
    rush.gain.setTargetAtTime(0.3 * pow(min(v / 5, 1), 1.5), t, 0.3); rushF.frequency.setTargetAtTime(240 + v * 60, t, 0.3);
    if (t > tA) { hornA(t, 2.4, 0.022); tA = t + rr(70, 110); }
    if (t > tPad) { const c = CH[nPad++ % 4]; padF.forEach((f, i) => f.setTargetAtTime(c[i >> 1], t, 1.6)); tPad = t + 14; }
    // how close the nearest street is (the park has none), and how high the camera is above the ground
    const x = F[CX], z = F[CZ], ux = abs((x - AV0) / BLX - round((x - AV0) / BLX)) * BLX, uz = abs((z - ST0) / BLZ - round((z - ST0) / BLZ)) * BLZ;
    const ds = x > PARKX + 20 ? x - PARKX : x > PARKX - 5 ? ux : min(ux, uz), alt = max(F[CY] - HT(x, z), 0), near = exp(-ds / 25) / (1 + alt / 40);
    hum.gain.setTargetAtTime(0.02 + 0.06 * near + 0.02 * min(alt / 60, 1), t, 1.5);
    if (t > tCar) {
      // a car goes by: the noise rises and falls and sweeps up and down in pitch as it passes
      const v = 0.05 + 0.3 * near, d = rr(2.2, 3.6), pn = rr(-0.8, 0.8);
      carP.pan.setValueAtTime(-pn, t); carP.pan.linearRampToValueAtTime(pn, t + d);
      carG.gain.setValueAtTime(0, t); carG.gain.linearRampToValueAtTime(v, t + d * 0.5); carG.gain.linearRampToValueAtTime(0, t + d);
      carF.frequency.setValueAtTime(260, t); carF.frequency.exponentialRampToValueAtTime(rr(700, 1000), t + d * 0.45); carF.frequency.exponentialRampToValueAtTime(200, t + d);
      tCar = t + d + rr(1, 9) / (0.25 + near);
    }
    if (t > tBus) {
      // a bus: the diesel rises and drops as it pulls up, then the air brakes sigh
      const v = 0.06 + 0.22 * near, pn = rr(-0.6, 0.6);
      busP.pan.setValueAtTime(pn, t);
      busG.gain.setValueAtTime(0, t); busG.gain.linearRampToValueAtTime(v, t + 2.5); busG.gain.setTargetAtTime(0, t + 4.5, 0.6);
      busO.forEach((o, i) => { const f = 41 * [1, 2, 3.02][i]; o.setValueAtTime(f * 1.25, t); o.linearRampToValueAtTime(f * 0.9, t + 5); });
      pssh.gain.setValueAtTime(0, t + 5.6); pssh.gain.linearRampToValueAtTime(v * 0.5, t + 5.65); pssh.gain.setTargetAtTime(0, t + 5.8, 0.35);
      tBus = t + rr(45, 80);
    }
    if (t > tB) { hornB(t, 1.3, 0.015); tB = t + rr(120, 180); }
    // the dawn chorus: nobody sings before their hour, and the lighter it gets the less they wait
    const d = min(F[DAWN], 1);
    for (const b of B) if (t > b.t) { if (d >= b.wake) b.song(b.n, t); b.t = t + b.gap * rr(0.6, 1.5) / (0.3 + 0.7 * d) + 3; }
  };
}
// called on every click / key / touch: builds the graph once and resumes it when the browser allows
function sound() {
  if (!AC) { AC = new AudioContext({ latencyHint: 'playback' }); setInterval(mkSound(AC), 100); }
  if (AC.state === 'suspended' && !document.hidden) AC.resume();
}
const mute = () => { muted = !muted; OUT.gain.setTargetAtTime(muted ? 0 : VOL, AC.currentTime, 0.08); };
document.addEventListener('visibilitychange', () => { if (AC) document.hidden ? AC.suspend() : AC.resume(); });
