// WebAudio: procedural SFX + original procedural synthwave music
const AudioSys = {
  ctx: null, master: null, musicGain: null, sfxGain: null, musicFilter: null, noise: null,
  music: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.8;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    this.musicFilter = c.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 18000;
    this.musicGain = c.createGain(); this.musicGain.connect(this.musicFilter); this.musicFilter.connect(this.master);
    this.sfxGain = c.createGain(); this.sfxGain.connect(this.master);
    // delay for music
    this.delay = c.createDelay(1); this.delay.delayTime.value = 0.36; const fb = c.createGain(); fb.gain.value = 0.3;
    this.delaySend = c.createGain(); this.delaySend.gain.value = 0.25;
    this.delaySend.connect(this.delay); this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(this.musicGain);
    const len = c.sampleRate * 1.0; const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.applyVolumes();
    setInterval(() => this.schedule(), 25);
  },
  applyVolumes() {
    if (!this.ctx) return;
    this.musicGain.gain.setTargetAtTime(Settings.music * 0.55, this.ctx.currentTime, 0.05);
    this.sfxGain.gain.setTargetAtTime(Settings.sfx * 0.9, this.ctx.currentTime, 0.05);
  },
  muffle(on) { if (this.ctx) this.musicFilter.frequency.setTargetAtTime(on ? 500 : 18000, this.ctx.currentTime, 0.15); },
  // ---------- SFX helpers
  tone(type, f0, f1, dur, vol, dest, t0) {
    const c = this.ctx; if (!c) return; const t = t0 || c.currentTime;
    const o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  },
  nz(dur, vol, ftype, freq, q, dest, t0, f1) {
    const c = this.ctx; if (!c) return; const t = t0 || c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = c.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(freq, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 1;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxGain); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  sfx(name) {
    if (!this.ctx) return; const r = Math.random;
    switch (name) {
      case 'swing': this.nz(0.12, 0.25, 'bandpass', 1800, 2, null, 0, 600); break;
      case 'hit': this.tone('square', 180, 60, 0.12, 0.35); this.nz(0.1, 0.5, 'lowpass', 1200); break;
      case 'punch': this.tone('sine', 140, 50, 0.1, 0.5); this.nz(0.06, 0.4, 'lowpass', 900); break;
      case 'splat': this.nz(0.25, 0.45, 'lowpass', 700, 1, null, 0, 200); this.tone('sine', 90, 40, 0.2, 0.3); break;
      case 'pistol': this.nz(0.18, 0.9, 'lowpass', 4000, 1, null, 0, 300); this.tone('square', 220, 50, 0.1, 0.35); break;
      case 'shotgun': this.nz(0.4, 1.0, 'lowpass', 3000, 1, null, 0, 150); this.tone('sawtooth', 120, 30, 0.25, 0.5); break;
      case 'smg': this.nz(0.09, 0.6, 'lowpass', 5000, 1, null, 0, 500); this.tone('square', 300, 80, 0.05, 0.2); break;
      case 'enemyShot': this.nz(0.16, 0.6, 'lowpass', 2500, 1, null, 0, 250); this.tone('square', 160, 50, 0.08, 0.25); break;
      case 'click': this.tone('square', 1200, 900, 0.03, 0.2); break;
      case 'glass': for (let i = 0; i < 6; i++) this.tone('triangle', 2000 + r() * 3000, 1500 + r() * 2000, 0.15 + r() * 0.2, 0.08, null, this.ctx.currentTime + i * 0.02); this.nz(0.3, 0.3, 'highpass', 3000); break;
      case 'door': this.tone('sine', 110, 55, 0.18, 0.5); this.nz(0.12, 0.4, 'lowpass', 600); break;
      case 'doorHit': this.tone('square', 90, 40, 0.2, 0.5); this.nz(0.2, 0.6, 'lowpass', 900); break;
      case 'pickup': this.tone('square', 440, 880, 0.08, 0.2); break;
      case 'throw': this.nz(0.2, 0.3, 'bandpass', 900, 3, null, 0, 2500); break;
      case 'clang': this.tone('triangle', 900, 700, 0.2, 0.2); this.tone('triangle', 1350, 1100, 0.15, 0.1); break;
      case 'bark': this.tone('sawtooth', 520, 300, 0.09, 0.3); this.tone('sawtooth', 480, 260, 0.1, 0.25, null, this.ctx.currentTime + 0.12); break;
      case 'grunt': this.tone('sawtooth', 160, 90, 0.18, 0.25); break;
      case 'death': this.tone('sawtooth', 300, 40, 0.8, 0.4); this.nz(0.6, 0.5, 'lowpass', 800, 1, null, 0, 100); break;
      case 'menuMove': this.tone('square', 660, 660, 0.05, 0.12); break;
      case 'menuOk': this.tone('square', 660, 1320, 0.12, 0.18); break;
      case 'menuBack': this.tone('square', 500, 250, 0.1, 0.15); break;
      case 'combo': this.tone('square', 880, 1760, 0.1, 0.12); break;
      case 'clear': [523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.18, 0.15, null, this.ctx.currentTime + i * 0.1)); break;
      case 'grade': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone('sawtooth', f, f, 0.25, 0.12, null, this.ctx.currentTime + i * 0.08)); break;
      case 'bossHit': this.tone('sawtooth', 100, 40, 0.3, 0.6); this.nz(0.2, 0.6, 'lowpass', 1500); break;
      case 'charge': this.tone('sawtooth', 80, 300, 0.5, 0.3); break;
    }
  },
  // ---------- Music: original procedural synthwave
  playMusic(seed, style) {
    if (!this.ctx) { this.pending = [seed, style]; return; }
    if (this.music && this.music.seed === seed && this.music.style === style) return;
    let s = seed * 9301 + 49297; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const scales = [[0, 2, 3, 5, 7, 8, 10], [0, 2, 3, 5, 7, 9, 10], [0, 1, 3, 5, 7, 8, 10]];
    const progs = [[0, 5, 3, 6], [0, 3, 5, 4], [0, 6, 5, 3], [0, 5, 6, 4], [0, 4, 5, 3]];
    const scale = scales[Math.floor(rnd() * scales.length)];
    const prog = progs[Math.floor(rnd() * progs.length)];
    const root = 38 + Math.floor(rnd() * 8); // midi
    const bpm = style === 'menu' ? 92 : style === 'boss' ? 128 : 108 + Math.floor(rnd() * 12);
    const arpPat = []; for (let i = 0; i < 16; i++) arpPat.push(Math.floor(rnd() * 4));
    const bassPat = []; for (let i = 0; i < 16; i++) bassPat.push(rnd() < (i % 2 === 0 ? 0.9 : 0.35) ? (rnd() < 0.2 ? 12 : 0) : null);
    const lead = []; for (let i = 0; i < 64; i++) lead.push(rnd() < 0.28 ? Math.floor(rnd() * 7) : null);
    this.music = { seed, style, scale, prog, root, bpm, arpPat, bassPat, lead, step: 0, next: this.ctx.currentTime + 0.1 };
  },
  stopMusic() { this.music = null; },
  midi(n) { return 440 * Math.pow(2, (n - 69) / 12); },
  degree(m, deg, oct) { const sc = m.scale; const o = Math.floor(deg / 7); return m.root + sc[((deg % 7) + 7) % 7] + 12 * (o + (oct || 0)); },
  schedule() {
    const m = this.music; if (!m || !this.ctx) return;
    const c = this.ctx; const stepDur = 60 / m.bpm / 4;
    if (m.next < c.currentTime - 0.5) m.next = c.currentTime + 0.05;
    while (m.next < c.currentTime + 0.12) {
      this.playStep(m, m.step, m.next, stepDur); m.step++; m.next += stepDur;
    }
  },
  playStep(m, st, t, sd) {
    const mg = this.musicGain, bar = Math.floor(st / 16) % 4, i = st % 16, chordDeg = m.prog[bar];
    const menu = m.style === 'menu', boss = m.style === 'boss';
    // drums
    if (menu ? (i === 0 || i === 10) : (i % 4 === 0)) { this.tone('sine', 150, 40, 0.25, 0.9, mg, t); }
    if (i === 4 || i === 12) { this.nz(0.18, 0.35, 'bandpass', 1800, 0.8, mg, t); this.tone('triangle', 220, 120, 0.08, 0.2, mg, t); }
    if (!menu && i % 2 === 1) this.nz(0.04, 0.12, 'highpass', 8000, 1, mg, t);
    if (menu && i % 4 === 2) this.nz(0.05, 0.08, 'highpass', 8000, 1, mg, t);
    if (boss && i % 4 === 3) this.nz(0.03, 0.1, 'highpass', 9000, 1, mg, t);
    // bass
    const b = m.bassPat[i];
    if (b !== null) this.synth('sawtooth', this.midi(this.degree(m, chordDeg, -1) + b), sd * 1.6, 0.22, mg, t, 600, 2200);
    // arp
    if (!menu || i % 2 === 0) {
      const chord = [0, 2, 4, 7][m.arpPat[i]];
      this.synth('square', this.midi(this.degree(m, chordDeg + chord, 1)), sd * 0.9, 0.06, mg, t, 1500, 4000, true);
    }
    // pad at bar start
    if (i === 0) [0, 2, 4].forEach(k => this.synth('sawtooth', this.midi(this.degree(m, chordDeg + k, 0)), sd * 16, 0.035, mg, t, 900, 1200, true, 0.4));
    // lead every other phrase
    const phrase = Math.floor(st / 64) % 2;
    if (phrase === 1 || menu) { const ln = m.lead[st % 64]; if (ln !== null && (i % 2 === 0)) this.synth('triangle', this.midi(this.degree(m, ln, 2)), sd * 2.5, 0.07, mg, t, 3000, 3000, true); }
  },
  synth(type, f, dur, vol, dest, t, fc0, fc1, send, attack) {
    const c = this.ctx; const o = c.createOscillator(); o.type = type; o.frequency.value = f;
    const o2 = c.createOscillator(); o2.type = type; o2.frequency.value = f * 1.006;
    const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(fc1, t); fl.frequency.exponentialRampToValueAtTime(fc0, t + dur);
    const g = c.createGain(); const a = attack ? dur * attack : 0.005;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(dest); if (send) g.connect(this.delaySend);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
};
