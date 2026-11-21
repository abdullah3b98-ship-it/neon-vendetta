// ===== UI: menus, HUD, post effects, main loop =====
const SAVE_KEY = 'neonVendetta.save.v1';
const Settings = { music: 0.7, sfx: 0.8, lang: 'ar', fx: true, shake: 1, aimAssist: true };
const Save = { unlocked: 1, best: {}, mask: 0 };
(function load() { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); if (d.settings) Object.assign(Settings, d.settings); if (d.unlocked) Save.unlocked = d.unlocked; if (d.best) Save.best = d.best; if (d.mask != null) Save.mask = d.mask; } catch (e) { } })();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ settings: Settings, unlocked: Save.unlocked, best: Save.best, mask: Save.mask })); } catch (e) { } }

const SW = 1280, SH = 720;
const FONT_AR = '"Noto Sans Arabic", "Segoe UI", Tahoma, Arial, sans-serif';
const FONT_EN = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';
const FONT_TITLE = 'Impact, "Arial Black", "Trebuchet MS", sans-serif';
const isAr = s => /[\u0600-\u06FF]/.test(s);
const GRADE_ORDER = ['D', 'C', 'B', 'A', 'A+', 'S'];

function txt(c, s, x, y, size, col, align, glow, font) {
  s = String(s);
  c.font = `bold ${size}px ${font || (isAr(s) ? FONT_AR : FONT_EN)}`;
  c.direction = isAr(s) ? 'rtl' : 'ltr'; c.textAlign = align || 'center'; c.textBaseline = 'middle';
  if (glow) { c.shadowColor = glow; c.shadowBlur = 14; }
  c.fillStyle = col; c.fillText(s, x, y); c.shadowBlur = 0;
}
function tw(c, s, size, font) { s = String(s); c.font = `bold ${size}px ${font || (isAr(s) ? FONT_AR : FONT_EN)}`; c.direction = isAr(s) ? 'rtl' : 'ltr'; return c.measureText(s).width; }

// ---- button glyphs (keyboard / Xbox / PlayStation, pixel style)
const PAD_COL = { xA: '#3ddc61', xB: '#ff4a4a', xX: '#3d8bff', xY: '#ffd23d' };
const PS_COL = { pX: '#7fa7ff', pO: '#ff5a5a', pS: '#ff7ad1', pT: '#3ddc97' };
const PS_ART = {
  pX: ['x.....x', '.x...x.', '..x.x..', '...x...', '..x.x..', '.x...x.', 'x.....x'],
  pO: ['..xxx..', '.x...x.', 'x.....x', 'x.....x', 'x.....x', '.x...x.', '..xxx..'],
  pS: ['xxxxxxx', 'x.....x', 'x.....x', 'x.....x', 'x.....x', 'x.....x', 'xxxxxxx'],
  pT: ['...x...', '..x.x..', '..x.x..', '.x...x.', '.x...x.', 'x.....x', 'xxxxxxx'],
};
const PAD_TAGS = new Set(['L1', 'R1', 'L2', 'R2', 'L3', 'R3', 'LT', 'RT', 'LB', 'RB', 'LS', 'RS', 'OPTIONS', 'START', 'VIEW', 'TOUCHPAD', 'PS', 'CREATE']);
function psButtonCanvas(g) {
  return sprite('psb|' + g, () => { const G2 = Pix.grid(15, 15); Pix.ellipse(G2, 7.5, 7.5, 7, 7, '#1b1b26'); Pix.ellipse(G2, 7.5, 6.8, 6, 6, '#262634'); Pix.stamp(G2, PS_ART[g], { x: PS_COL[g] }, 4, 4); Pix.outline(G2, '#000000'); return Pix.canvas(G2); });
}
function glyphW(c, g) { if (PS_COL[g] || PAD_COL[g]) return 30; if (g === 'TOUCHPAD') return 46; c.font = `bold 13px ${FONT_EN}`; return Math.max(26, c.measureText(g).width + 14); }
function drawGlyph(c, g, x, y) { // x = left edge, y = centre
  c.save(); c.imageSmoothingEnabled = false;
  if (PS_COL[g]) { c.drawImage(psButtonCanvas(g), x, y - 15, 30, 30); c.restore(); return 30; }
  if (PAD_COL[g]) {
    c.fillStyle = '#111'; c.beginPath(); c.arc(x + 15, y, 13, 0, 7); c.fill(); c.strokeStyle = PAD_COL[g]; c.lineWidth = 2.5; c.stroke();
    txt(c, g[1], x + 15, y + 1, 14, PAD_COL[g]); c.restore(); return 30;
  }
  const w = glyphW(c, g);
  if (g === 'TOUCHPAD') { c.fillStyle = '#262634'; c.fillRect(x, y - 10, w, 20); c.fillStyle = '#3a3a4c'; c.fillRect(x + 2, y - 8, w - 4, 14); c.fillStyle = '#9aa0ff'; c.fillRect(x + w / 2 - 2, y - 3, 4, 4); c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(x, y - 10, w, 20); c.restore(); return w; }
  if (PAD_TAGS.has(g)) {
    c.fillStyle = '#1b1b26'; c.fillRect(x, y - 12, w, 24); c.fillStyle = '#2c2c3c'; c.fillRect(x + 2, y - 10, w - 4, 16); c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(x, y - 12, w, 24);
    txt(c, g, x + w / 2, y, 12, '#e8e8ff', 'center', null, FONT_EN); c.restore(); return w;
  }
  c.fillStyle = '#f2f2f2'; c.fillRect(x, y - 12, w, 24);
  c.fillStyle = '#9a9a9a'; c.fillRect(x + 2, y + 8, w - 4, 3); c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(x, y - 12, w, 24);
  txt(c, g, x + w / 2, y - 1, 13, '#111', 'center', null, FONT_EN); c.restore(); return w;
}
function prompt(c, glyphs, label, cx, cy, size) {
  size = size || 20; const gap = 8;
  const gw = glyphs.reduce((s, g) => s + glyphW(c, g) + 4, 0);
  const lw = tw(c, label, size); const total = gw + gap + lw;
  const rtl = isAr(label);
  let x = cx - total / 2;
  c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x - 12, cy - 19, total + 24, 38);
  if (rtl) { txt(c, label, x + lw, cy, size, '#fff', 'right'); x += lw + gap; for (const g of glyphs) x += drawGlyph(c, g, x, cy) + 4; }
  else { for (const g of glyphs) x += drawGlyph(c, g, x, cy) + 4; txt(c, label, x + gap, cy, size, '#fff', 'left'); }
}
const BINDS = {
  pickup: { kb: ['E'], xbox: ['xX'], ps: ['pS'] }, execute: { kb: ['SPACE'], xbox: ['xA'], ps: ['pX'] },
  restart: { kb: ['R'], xbox: ['xY'], ps: ['pT'] }, throwW: { kb: ['RMB'], xbox: ['LT'], ps: ['L2'] },
  confirm: { kb: ['ENTER'], xbox: ['xA'], ps: ['pX'] }, back: { kb: ['ESC'], xbox: ['xB'], ps: ['pO'] },
  dodge: { kb: ['CTRL'], xbox: ['xB'], ps: ['pO'] }, map: { kb: ['TAB'], xbox: ['VIEW'], ps: ['TOUCHPAD'] },
  pause: { kb: ['ESC'], xbox: ['START'], ps: ['OPTIONS'] }, attack: { kb: ['LMB'], xbox: ['RT'], ps: ['R2'] },
};
const BIND = new Proxy({}, { get: (_, k) => () => BINDS[k][Input.dev()] });

// ---- post FX
const FX = {
  init() {
    this.r = mkCanvas(SW, SH); this.rc = this.r.getContext('2d');
    this.gb = mkCanvas(SW, SH); this.gbc = this.gb.getContext('2d');
    const sl = mkCanvas(1, 3), s = sl.getContext('2d'); s.fillStyle = 'rgba(0,0,0,0.35)'; s.fillRect(0, 2, 1, 1); this.scan = sl;
    this.vig = mkCanvas(SW, SH); const v = this.vig.getContext('2d'); const g = v.createRadialGradient(SW / 2, SH / 2, SH * 0.35, SW / 2, SH / 2, SH * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.65)'); v.fillStyle = g; v.fillRect(0, 0, SW, SH);
  },
  apply(scene, out, t, intensity) {
    if (!Settings.fx) { out.globalCompositeOperation = 'copy'; out.drawImage(scene, 0, 0); out.globalCompositeOperation = 'source-over'; return; }
    const off = 1.5 + intensity;
    this.rc.globalCompositeOperation = 'copy'; this.rc.drawImage(scene, 0, 0); this.rc.globalCompositeOperation = 'multiply'; this.rc.fillStyle = '#ff0000'; this.rc.fillRect(0, 0, SW, SH);
    this.gbc.globalCompositeOperation = 'copy'; this.gbc.drawImage(scene, 0, 0); this.gbc.globalCompositeOperation = 'multiply'; this.gbc.fillStyle = '#00ffff'; this.gbc.fillRect(0, 0, SW, SH);
    out.globalCompositeOperation = 'copy'; out.drawImage(this.gb, off * 0.5, 0);
    out.globalCompositeOperation = 'lighter'; out.drawImage(this.r, -off, 0);
    out.globalCompositeOperation = 'source-over';
    // VHS tracking band
    const by = ((t * 90) % (SH + 200)) - 100;
    out.drawImage(out.canvas, 0, by, SW, 24, 3 + Math.sin(t * 30) * 2, by, SW, 24);
    out.fillStyle = 'rgba(255,255,255,0.03)'; out.fillRect(0, by, SW, 24);
    out.fillStyle = out.createPattern(this.scan, 'repeat'); out.fillRect(0, 0, SW, SH);
    out.drawImage(this.vig, 0, 0);
    if (Math.random() < 0.02) { out.fillStyle = 'rgba(255,255,255,0.03)'; out.fillRect(0, 0, SW, SH); }
  }
};

// ---- synthwave backdrop (menus)
const City = []; for (let i = 0; i < 60; i++) City.push({ x: i * 24 + Math.random() * 10, w: 16 + Math.random() * 26, h: 30 + Math.random() * 130 });
const Stars = []; for (let i = 0; i < 120; i++) Stars.push({ x: Math.random() * SW, y: Math.random() * SH * 0.5, s: Math.random() * 2 });
function drawBackdrop(c, t) {
  const hue = (t * 12) % 360;
  const sky = c.createLinearGradient(0, 0, 0, SH * 0.62);
  sky.addColorStop(0, `hsl(${(260 + Math.sin(t * 0.2) * 20)},70%,8%)`); sky.addColorStop(1, `hsl(${(320 + Math.sin(t * 0.3) * 20)},80%,30%)`);
  c.fillStyle = sky; c.fillRect(0, 0, SW, SH);
  for (const s of Stars) { c.fillStyle = `rgba(255,255,255,${0.4 + 0.6 * Math.abs(Math.sin(t + s.x))})`; c.fillRect(s.x, s.y, s.s, s.s); }
  // sun
  const sx = SW / 2, sy = SH * 0.5, R = 150;
  c.save(); c.beginPath(); c.arc(sx, sy, R, 0, 7); c.clip();
  const sg = c.createLinearGradient(0, sy - R, 0, sy + R); sg.addColorStop(0, '#ffe14a'); sg.addColorStop(0.5, '#ff6a3d'); sg.addColorStop(1, '#ff1f8e');
  c.fillStyle = sg; c.fillRect(sx - R, sy - R, R * 2, R * 2);
  c.fillStyle = sky; for (let i = 0; i < 8; i++) { const yy = sy + 10 + i * 18 + ((t * 20) % 18); c.fillStyle = '#2a0b3a'; c.fillRect(sx - R, yy, R * 2, 2 + i * 1.2); }
  c.restore();
  c.shadowColor = '#ff2a8a'; c.shadowBlur = 40; c.strokeStyle = 'rgba(255,80,160,0.3)'; c.beginPath(); c.arc(sx, sy, R + 4, 0, 7); c.stroke(); c.shadowBlur = 0;
  // city
  const hor = SH * 0.62;
  c.fillStyle = '#0d0618';
  for (const b of City) { const x = (b.x - t * 8) % (SW + 60); const xx = x < -60 ? x + SW + 60 : x; c.fillRect(xx, hor - b.h, b.w, b.h); }
  c.fillStyle = 'rgba(255,220,120,0.5)';
  for (const b of City) { const x = (b.x - t * 8) % (SW + 60); const xx = x < -60 ? x + SW + 60 : x; for (let wy = hor - b.h + 6; wy < hor - 6; wy += 10) if (hash(Math.floor(b.x), Math.floor(wy)) > 0.7) c.fillRect(xx + 4, wy, 3, 3); }
  // grid
  c.fillStyle = '#0a0214'; c.fillRect(0, hor, SW, SH - hor);
  c.strokeStyle = `hsl(${(hue + 300) % 360},100%,60%)`; c.lineWidth = 1.5; c.shadowColor = c.strokeStyle; c.shadowBlur = 8;
  c.beginPath();
  for (let i = -20; i <= 20; i++) { c.moveTo(SW / 2 + i * 40, hor); c.lineTo(SW / 2 + i * 260, SH); }
  const ph = (t * 0.6) % 1;
  for (let i = 0; i < 14; i++) { const z = (i + ph) / 14; const y = hor + Math.pow(z, 2.4) * (SH - hor); c.moveTo(0, y); c.lineTo(SW, y); }
  c.stroke(); c.shadowBlur = 0;
}
function drawTitle(c, t, y, scale) {
  scale = scale || 1;
  const title = 'NEON VENDETTA';
  c.save(); c.translate(SW / 2, y); c.rotate(Math.sin(t * 1.3) * 0.03); c.scale(scale * (1 + Math.sin(t * 2.2) * 0.02), scale);
  for (let i = 3; i >= 0; i--) txt(c, title, i * 3, i * 3, 92, i ? `rgba(${i === 3 ? '60,0,90' : i === 2 ? '255,40,140' : '0,220,255'},0.9)` : '#fff7fb', 'center', i ? null : '#ff2a8a', FONT_TITLE);
  // glitch slice
  if (Math.sin(t * 7) > 0.93) { c.fillStyle = 'rgba(63,252,255,0.6)'; c.fillRect(-380, -10 + Math.random() * 30, 760, 3); }
  txt(c, 'ثأر النيون', 0, 74, 46, '#3ffcff', 'center', '#3ffcff', FONT_AR);
  c.restore();
}

// ---- generic menu
function menuList(c, items, sel, x, y, gap, size, t) {
  const st = UI.menuState; let s = st.sel;
  if (Input.navUp()) { s = (s - 1 + items.length) % items.length; AudioSys.sfx('menuMove'); }
  if (Input.navDown()) { s = (s + 1) % items.length; AudioSys.sfx('menuMove'); }
  const rects = [];
  items.forEach((it, i) => {
    const label = it.label(); const w = tw(c, label, size) + 60; rects.push({ x: x - w / 2, y: y + i * gap - gap / 2 + 4, w, h: gap - 8 });
  });
  if (Input.mouse.moved) rects.forEach((r, i) => { if (Input.mouse.x > r.x && Input.mouse.x < r.x + r.w && Input.mouse.y > r.y && Input.mouse.y < r.y + r.h && s !== i) { s = i; AudioSys.sfx('menuMove'); } });
  st.sel = s;
  const it = items[s];
  let clicked = false, clickDir = 0;
  if (Input.mouse.pr[0]) rects.forEach((r, i) => { if (Input.mouse.x > r.x && Input.mouse.x < r.x + r.w && Input.mouse.y > r.y && Input.mouse.y < r.y + r.h) { clicked = true; clickDir = Input.mouse.x > r.x + r.w / 2 ? 1 : -1; } });
  if (it.adjust) { if (Input.navLeft()) { it.adjust(-1); AudioSys.sfx('menuMove'); } if (Input.navRight()) { it.adjust(1); AudioSys.sfx('menuMove'); } }
  items.forEach((it2, i) => {
    const on = i === s, yy = y + i * gap, label = it2.label();
    c.save(); c.translate(x, yy);
    if (on) { c.rotate(Math.sin(t * 4) * 0.03); c.scale(1.12, 1.12); const w = tw(c, label, size) + 50; c.fillStyle = 'rgba(255,42,138,0.25)'; c.fillRect(-w / 2, -gap / 2 + 6, w, gap - 12); c.fillStyle = '#ff2a8a'; c.fillRect(-w / 2, -gap / 2 + 6, 4, gap - 12); c.fillRect(w / 2 - 4, -gap / 2 + 6, 4, gap - 12); }
    txt(c, label, 2, 2, size, 'rgba(0,0,0,0.6)');
    txt(c, label, 0, 0, size, on ? '#ffffff' : '#c9b6e8', 'center', on ? '#ff2a8a' : null);
    c.restore();
  });
  if ((Input.confirm() || clicked) && it.act) { AudioSys.sfx('menuOk'); it.act(clickDir); }
  else if (clicked && it.adjust) { it.adjust(clickDir); AudioSys.sfx('menuMove'); }
}

const UI = {
  screen: 'title', t: 0, menuState: { sel: 0 }, settingsReturn: 'menu', result: null, introT: 0,
  go(screen, sel) { this.screen = screen; this.menuState = { sel: sel || 0 }; this.screenT = 0; },
  onFloorStart() { this.floorBanner = 2.2; },
  levelEnemyCount(i) { return LEVELS[i].floors.reduce((n, f) => n + f.join('').split('').filter(ch => 'mMgGsSuUdhHB'.includes(ch)).length, 0); },
  onLevelComplete() {
    const i = G.levelIdx, n = this.levelEnemyCount(i), time = G.levelTime;
    let ratio = G.score / (n * 550); const parT = n * 9; ratio += clamp((parT - time) / parT, 0, 1) * 0.25;
    const grade = ratio >= 1.25 ? 'S' : ratio >= 1.0 ? 'A+' : ratio >= 0.85 ? 'A' : ratio >= 0.7 ? 'B' : ratio >= 0.55 ? 'C' : 'D';
    const masksBefore = maskUnlockedCount(); const prev = Save.best[i]; let newBest = false;
    if (!prev || G.score > prev.score) { Save.best[i] = { score: G.score, grade: (!prev || GRADE_ORDER.indexOf(grade) > GRADE_ORDER.indexOf(prev.grade)) ? grade : prev.grade }; newBest = true; }
    else if (GRADE_ORDER.indexOf(grade) > GRADE_ORDER.indexOf(prev.grade)) prev.grade = grade;
    Save.unlocked = Math.max(Save.unlocked, Math.min(LEVELS.length, i + 2)); persist();
    this.result = { grade, score: G.score, combo: G.maxCombo, time, kills: G.kills, newBest, level: i, newMask: maskUnlockedCount() > masksBefore };
    setTimeout(() => this.go('results'), 700);
  },
  startLevel(i) { this.pendingLevel = i; const n = maskUnlockedCount(); this.go('masks', Math.min(Save.mask || 0, n - 1)); },
  launchLevel(i) { G.loadLevel(i); this.go('intro'); this.introT = 0; this.tip = ['tip1', 'tip2', 'tip3'][i % 3]; },
  fmtTime(s) { const m = Math.floor(s / 60), ss = Math.floor(s % 60); return m + ':' + String(ss).padStart(2, '0'); },
  frame(dt, c) {
    this.t += dt; this.screenT = (this.screenT || 0) + dt; const t = this.t;
    const inGame = ['game', 'pause', 'intro', 'map'].includes(this.screen) || (this.screen === 'settings' && this.settingsReturn === 'pause');
    // music
    if (['game', 'pause', 'intro', 'map'].includes(this.screen) || (this.screen === 'settings' && this.settingsReturn === 'pause')) AudioSys.playMusic(G.levelIdx + 11, LEVELS[G.levelIdx].boss ? 'boss' : 'game');
    else AudioSys.playMusic(777, 'menu');
    const muff = this.screen === 'pause' || this.screen === 'map' || (this.screen === 'settings' && this.settingsReturn === 'pause') || (this.screen === 'game' && G.status === 'dead');
    if (muff !== this.lastMuff) { AudioSys.muffle(muff); this.lastMuff = muff; }
    UI.canvasEl.style.cursor = (this.screen === 'game' && Input.mode === 'kb') ? 'none' : (Input.mode === 'pad' ? 'none' : 'default');
    switch (this.screen) {
      case 'title': this.title(c, t); break;
      case 'menu': this.mainMenu(c, t); break;
      case 'levels': this.levelSelect(c, t); break;
      case 'controls': this.controls(c, t); break;
      case 'settings': this.settings(c, t, dt); break;
      case 'credits': this.credits(c, t); break;
      case 'intro': this.intro(c, t, dt); break;
      case 'masks': this.maskSelect(c, t); break;
      case 'map': this.mapScreen(c, t); break;
      case 'game': this.game(c, t, dt); break;
      case 'pause': this.pause(c, t); break;
      case 'results': this.results(c, t); break;
      case 'ending': this.ending(c, t); break;
    }
    if (Input.toast) { const a = clamp(Input.toast.t, 0, 1); c.globalAlpha = a; prompt(c, BIND.pause(), L(Input.toast.k) + (Input.padType === 'ps' ? ' (PlayStation)' : ''), SW / 2, 40, 18); c.globalAlpha = 1; }
  },
  title(c, t) {
    drawBackdrop(c, t); drawTitle(c, t, 220);
    if (Math.floor(t * 2) % 2 === 0) txt(c, Settings.lang === 'ar' ? 'اضغط أي زر للبدء  •  PRESS ANY BUTTON' : 'PRESS ANY BUTTON  •  اضغط أي زر', SW / 2, 560, 26, '#fff', 'center', '#3ffcff');
    txt(c, '© 2026 — original game • لعبة أصلية', SW / 2, 690, 14, 'rgba(255,255,255,0.5)');
    if (Input.anyPressed && this.screenT > 0.3) { AudioSys.init(); AudioSys.sfx('menuOk'); this.go('menu'); }
  },
  mainMenu(c, t) {
    drawBackdrop(c, t); drawTitle(c, t, 150, 0.8);
    const items = [
      { label: () => Save.unlocked > 1 ? L('cont') : L('start'), act: () => this.startLevel(Math.min(Save.unlocked, LEVELS.length) - 1) },
      { label: () => L('levels'), act: () => this.go('levels') },
      { label: () => L('controls'), act: () => this.go('controls') },
      { label: () => L('settings'), act: () => { this.settingsReturn = 'menu'; this.go('settings'); } },
      { label: () => L('credits'), act: () => this.go('credits') },
    ];
    c.fillStyle = 'rgba(10,0,20,0.55)'; c.fillRect(SW / 2 - 230, 300, 460, 330);
    menuList(c, items, 0, SW / 2, 345, 62, 34, t);
    prompt(c, BIND.confirm(), Settings.lang === 'ar' ? 'اختيار' : 'SELECT', SW / 2, 670, 16);
    txt(c, Input.dev() === 'ps' ? L('ps') : Input.dev() === 'xbox' ? L('xbox') : L('kb'), SW - 20, 700, 14, 'rgba(255,255,255,0.6)', 'right');
  },
  levelSelect(c, t) {
    drawBackdrop(c, t);
    c.fillStyle = 'rgba(8,0,18,0.7)'; c.fillRect(0, 0, SW, SH);
    txt(c, L('levels'), SW / 2, 70, 48, '#fff', 'center', '#ff2a8a');
    const st = this.menuState; const n = LEVELS.length, cols = 3;
    if (Input.navRight()) { st.sel = (st.sel + 1) % n; AudioSys.sfx('menuMove'); }
    if (Input.navLeft()) { st.sel = (st.sel - 1 + n) % n; AudioSys.sfx('menuMove'); }
    if (Input.navDown()) { st.sel = (st.sel + cols) % n; AudioSys.sfx('menuMove'); }
    if (Input.navUp()) { st.sel = (st.sel - cols + n) % n; AudioSys.sfx('menuMove'); }
    const cw = 340, ch = 200, gx = 30, gy = 30, x0 = SW / 2 - (cw * cols + gx * (cols - 1)) / 2, y0 = 140;
    let clicked = -1;
    for (let i = 0; i < n; i++) {
      const vi = Settings.lang === 'ar' ? (Math.floor(i / cols) * cols + (cols - 1 - i % cols)) : i; // RTL order
      const x = x0 + (vi % cols) * (cw + gx), y = y0 + Math.floor(vi / cols) * (ch + gy);
      const inside = Input.mouse.x > x && Input.mouse.x < x + cw && Input.mouse.y > y && Input.mouse.y < y + ch;
      if (inside && Input.mouse.moved && st.sel !== i) { st.sel = i; AudioSys.sfx('menuMove'); }
      if (inside && Input.mouse.pr[0]) clicked = i;
      const on = st.sel === i, locked = i >= Save.unlocked, lv = LEVELS[i];
      c.save(); c.translate(x + cw / 2, y + ch / 2); if (on) { c.scale(1.05, 1.05); c.rotate(Math.sin(t * 3) * 0.01); }
      c.fillStyle = locked ? 'rgba(40,30,50,0.9)' : `hsla(${(i * 50 + t * 20) % 360},70%,22%,0.95)`; c.fillRect(-cw / 2, -ch / 2, cw, ch);
      c.strokeStyle = on ? '#ff2a8a' : 'rgba(255,255,255,0.25)'; c.lineWidth = on ? 4 : 2; if (on) { c.shadowColor = '#ff2a8a'; c.shadowBlur = 20; } c.strokeRect(-cw / 2, -ch / 2, cw, ch); c.shadowBlur = 0;
      txt(c, String(i + 1).padStart(2, '0'), 0, -50, 54, locked ? '#555' : '#fff', 'center', locked ? null : '#3ffcff', FONT_TITLE);
      txt(c, locked ? '🔒 ' + L('locked') : lv[Settings.lang], 0, 15, 26, locked ? '#777' : '#fff');
      if (lv.boss && !locked) txt(c, L('boss'), 0, 48, 16, '#ff6a3d');
      const b = Save.best[i]; if (b) txt(c, L('best') + ': ' + b.grade + '  •  ' + b.score, 0, 72, 16, '#ffe14a');
      c.restore();
    }
    const go = i => { if (i < Save.unlocked) { AudioSys.sfx('menuOk'); this.startLevel(i); } else AudioSys.sfx('menuBack'); };
    if (clicked >= 0) go(clicked); else if (Input.confirm()) go(st.sel);
    if (Input.back()) { AudioSys.sfx('menuBack'); this.go('menu', 1); }
    this.backButton(c);
  },
  backButton(c) {
    const x = 40, y = 660, w = 170;
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x, y - 24, w, 48);
    const hov = Input.mouse.x > x && Input.mouse.x < x + w && Input.mouse.y > y - 24 && Input.mouse.y < y + 24;
    let gx = x + 12; for (const g of BIND.back()) gx += drawGlyph(c, g, gx, y) + 6;
    txt(c, L('back'), gx + (w - (gx - x)) / 2, y, 20, hov ? '#ff2a8a' : '#fff');
    if (hov && Input.mouse.pr[0]) { AudioSys.sfx('menuBack'); this.handleBack(); }
  },
  handleBack() {
    if (this.screen === 'settings') { this.go(this.settingsReturn, this.settingsReturn === 'pause' ? 2 : 3); }
    else if (this.screen === 'levels') this.go('menu', 1);
    else if (this.screen === 'controls') this.go('menu', 2);
    else if (this.screen === 'credits') this.go('menu', 4);
  },
  settings(c, t) {
    if (this.settingsReturn === 'pause') { this.drawGameFrozen(c); c.fillStyle = 'rgba(8,0,18,0.8)'; c.fillRect(0, 0, SW, SH); }
    else { drawBackdrop(c, t); c.fillStyle = 'rgba(8,0,18,0.75)'; c.fillRect(0, 0, SW, SH); }
    txt(c, L('settings'), SW / 2, 80, 46, '#fff', 'center', '#ff2a8a');
    const bar = v => '▮'.repeat(Math.round(v * 10)) + '▯'.repeat(10 - Math.round(v * 10));
    const onoff = v => v ? L('on') : L('off');
    const vol = (k) => d => { Settings[k] = clamp(Math.round((Settings[k] + d * 0.1) * 10) / 10, 0, 1); AudioSys.applyVolumes(); persist(); };
    const tog = (k) => () => { Settings[k] = Settings[k] ? (k === 'shake' ? 0 : false) : (k === 'shake' ? 1 : true); persist(); };
    const items = [
      { label: () => L('music') + ':  ' + bar(Settings.music), adjust: vol('music'), act: d => vol('music')(d || 1) },
      { label: () => L('sfx') + ':  ' + bar(Settings.sfx), adjust: vol('sfx'), act: d => { vol('sfx')(d || 1); AudioSys.sfx('pistol'); } },
      { label: () => L('lang') + ':  ' + L('langName'), adjust: () => { Settings.lang = Settings.lang === 'ar' ? 'en' : 'ar'; persist(); }, act: () => { Settings.lang = Settings.lang === 'ar' ? 'en' : 'ar'; persist(); } },
      { label: () => L('fx') + ':  ' + onoff(Settings.fx), adjust: tog('fx'), act: tog('fx') },
      { label: () => L('shake') + ':  ' + onoff(Settings.shake), adjust: tog('shake'), act: tog('shake') },
      { label: () => L('aimAssist') + ':  ' + onoff(Settings.aimAssist), adjust: tog('aimAssist'), act: tog('aimAssist') },
      { label: () => L('back'), act: () => this.handleBack() },
    ];
    menuList(c, items, 0, SW / 2, 190, 64, 28, t);
    txt(c, Settings.lang === 'ar' ? '← → للتعديل' : '← → to adjust', SW / 2, 650, 16, '#aaa');
    if (Input.back()) { AudioSys.sfx('menuBack'); this.handleBack(); }
  },
  credits(c, t) {
    drawBackdrop(c, t); c.fillStyle = 'rgba(8,0,18,0.75)'; c.fillRect(0, 0, SW, SH);
    drawTitle(c, t, 200, 0.7);
    txt(c, L('creditsText'), SW / 2, 380, 22, '#fff');
    txt(c, Settings.lang === 'ar' ? 'ضربة وحدة • نيون • موسيقى سينث مولّدة' : 'One hit • Neon • Procedural synth music', SW / 2, 430, 20, '#3ffcff');
    if (Input.back() || Input.confirm()) { AudioSys.sfx('menuBack'); this.go('menu', 4); }
    this.backButton(c);
  },
  intro(c, t, dt) {
    this.introT += dt;
    drawBackdrop(c, t); c.fillStyle = 'rgba(8,0,18,0.55)'; c.fillRect(0, 0, SW, SH);
    const lv = LEVELS[G.levelIdx], k = clamp(this.introT * 3, 0, 1);
    c.save(); c.globalAlpha = k;
    txt(c, L('level') + ' ' + (G.levelIdx + 1), SW / 2, 230, 34, '#3ffcff', 'center', '#3ffcff');
    c.save(); c.translate(SW / 2, 320); c.rotate(-0.03); txt(c, lv[Settings.lang], 0, 0, 86, '#fff', 'center', '#ff2a8a', Settings.lang === 'ar' ? FONT_AR : FONT_TITLE); c.restore();
    txt(c, lv[Settings.lang === 'ar' ? 'en' : 'ar'], SW / 2, 410, 28, 'rgba(255,255,255,0.6)');
    txt(c, L(this.tip), SW / 2, 520, 22, '#ffe14a');
    c.restore();
    if (this.introT > 3 || (this.introT > 0.4 && (Input.confirm() || Input.mouse.pr[0] || Input.bp(7)))) { this.go('game'); }
  },
  drawGameFrozen(c) { G.draw(c, SW, SH); },
  game(c, t, dt) {
    if (Input.pausePressed()) { AudioSys.sfx('menuBack'); this.go('pause'); this.drawGameFrozen(c); return; }
    if (Input.mapPressed() && G.status === 'play') { AudioSys.sfx('menuOk'); this.go('map'); this.drawGameFrozen(c); return; }
    if (Input.restartPressed() && G.status !== 'complete') { G.restartFloor(); AudioSys.muffle(false); this.lastMuff = false; }
    if (G.status !== 'complete' || true) G.update(dt);
    G.draw(c, SW, SH);
    this.hud(c, t, dt);
  },
  hud(c, t, dt) {
    const ar = Settings.lang === 'ar';
    // score + combo
    c.save(); c.translate(30, 46); c.rotate(-0.04);
    txt(c, String(G.score), 0, 0, 44, '#fff', 'left', '#ff2a8a', FONT_TITLE);
    if (G.combo > 1) {
      const s = 1 + Math.max(0, G.comboTimer - 2.9) * 2;
      c.save(); c.translate(0, 46); c.scale(s, s); txt(c, 'x' + G.combo + ' ' + L('combo'), 0, 0, 26, '#ffe14a', 'left', '#ff6a3d'); c.restore();
      c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(0, 66, 160, 5); c.fillStyle = '#ffe14a'; c.fillRect(0, 66, 160 * clamp(G.comboTimer / 3.2, 0, 1), 5);
    }
    c.restore();
    // weapon
    const p = G.player, wt = p.weapon ? p.weapon.type : 'fists';
    c.save(); c.translate(SW - 30, 46); c.rotate(0.04);
    txt(c, L(wt), 0, 0, 32, '#3ffcff', 'right', '#3ffcff');
    if (p.weapon && WEAPONS[wt].gun) txt(c, p.weapon.ammo + ' / ' + WEAPONS[wt].ammo, 0, 38, 24, p.weapon.ammo ? '#fff' : '#ff4a4a', 'right');
    c.restore();
    // mask badge
    { const m = MASK_BY_ID[G.mask]; if (m) { c.save(); c.imageSmoothingEnabled = false; const bx = ar ? SW - 84 : 20; c.drawImage(maskPortrait(m.id), bx, SH - 84, 64, 64); c.restore();
      txt(c, m[Settings.lang === 'ar' ? 'ar' : 'en'], ar ? SW - 96 : 96, SH - 62, 20, m.col.m === '#22202a' || m.col.m === '#151530' ? '#ff7ad1' : m.col.m, ar ? 'right' : 'left');
      txt(c, Settings.lang === 'ar' ? m.dAr : m.dEn, ar ? SW - 96 : 96, SH - 36, 14, 'rgba(255,255,255,0.7)', ar ? 'right' : 'left');
      if (G.player.shield > 0) txt(c, '🛡', ar ? SW - 96 : 96, SH - 92, 18, '#bfe3ff', ar ? 'right' : 'left'); } }
    // level / floor
    const lv = LEVELS[G.levelIdx];
    txt(c, lv[Settings.lang] + '  —  ' + L('floor') + ' ' + (G.floorIdx + 1) + '/' + lv.floors.length, SW / 2, 26, 18, 'rgba(255,255,255,0.75)');
    txt(c, this.fmtTime(G.levelTime), SW / 2, 50, 16, 'rgba(255,255,255,0.5)');
    // floor banner
    if (this.floorBanner > 0) { this.floorBanner -= dt; c.globalAlpha = clamp(this.floorBanner, 0, 1); txt(c, L('floor') + ' ' + (G.floorIdx + 1), SW / 2, 200, 48, '#fff', 'center', '#ff2a8a'); c.globalAlpha = 1; }
    // boss bar
    const boss = G.enemies.find(e => e.kind === 'boss');
    if (boss && boss.state !== 'idle') {
      const w = 500, x = SW / 2 - w / 2, y = 90;
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x - 4, y - 4, w + 8, 22); c.fillStyle = '#ff2a6d'; c.fillRect(x, y, w * Math.max(0, boss.hp) / boss.maxHp, 14);
      txt(c, LEVELS[G.levelIdx][Settings.lang], SW / 2, y + 34, 18, '#ff6a9d');
    }
    // prompts
    if (G.status === 'play' && p.alive && !p.exec) {
      const dn = G.nearestDowned(), pk = G.nearestPickup();
      if (dn) prompt(c, BIND.execute(), L('execute'), SW / 2, SH - 60);
      else if (pk) prompt(c, BIND.pickup(), (p.weapon ? L('swap') : L('pickup')) + ' — ' + L(pk.type), SW / 2, SH - 60);
    }
    if (G.cleared && G.status === 'play') {
      const pulse = Math.floor(t * 3) % 2;
      c.save(); c.translate(SW / 2, 140); c.rotate(Math.sin(t * 2) * 0.03);
      txt(c, L('clear'), 0, 0, 40, pulse ? '#fff' : '#3ffcff', 'center', '#3ffcff');
      txt(c, L('goExit') + (G.isLastFloor() && G.style[G.exit.ty * G.W + G.exit.tx] === '_' ? ' (' + L('car') + ')' : ''), 0, 40, 22, '#ffe14a');
      c.restore();
    }
    if (G.status === 'dead') {
      c.fillStyle = 'rgba(40,0,20,0.35)'; c.fillRect(0, 0, SW, SH);
      c.save(); c.translate(SW / 2, SH / 2 - 40); c.rotate(-0.05 + Math.sin(t * 3) * 0.02);
      txt(c, L('dead'), 0, 0, 80, '#ff2a6d', 'center', '#ff2a6d', ar ? FONT_AR : FONT_TITLE); c.restore();
      prompt(c, BIND.restart(), L('toRestart'), SW / 2, SH / 2 + 50, 24);
    }
  },
  maskSelect(c, t) {
    drawBackdrop(c, t); c.fillStyle = 'rgba(8,0,18,0.78)'; c.fillRect(0, 0, SW, SH);
    const ar = Settings.lang === 'ar', st = this.menuState, n = MASKS.length, cols = 5, unl = maskUnlockedCount();
    txt(c, L('masks'), SW / 2, 56, 44, '#fff', 'center', '#ff2a8a');
    txt(c, L('level') + ' ' + (this.pendingLevel + 1) + ' — ' + LEVELS[this.pendingLevel][Settings.lang], SW / 2, 100, 20, '#3ffcff');
    if (Input.navRight()) { st.sel = ar ? (st.sel - 1 + n) % n : (st.sel + 1) % n; AudioSys.sfx('menuMove'); }
    if (Input.navLeft()) { st.sel = ar ? (st.sel + 1) % n : (st.sel - 1 + n) % n; AudioSys.sfx('menuMove'); }
    if (Input.navDown() || Input.navUp()) { st.sel = (st.sel + cols) % n; AudioSys.sfx('menuMove'); }
    const cell = 104, gx0 = ar ? 700 : 70, gy0 = 150; let clicked = -1;
    c.save(); c.imageSmoothingEnabled = false;
    for (let i = 0; i < n; i++) {
      const col = i % cols, row = Math.floor(i / cols), vc = ar ? cols - 1 - col : col;
      const x = gx0 + vc * cell, y = gy0 + row * (cell + 20), m = MASKS[i], locked = i >= unl, on = st.sel === i;
      const inside = Input.mouse.x > x && Input.mouse.x < x + cell - 8 && Input.mouse.y > y && Input.mouse.y < y + cell - 8;
      if (inside && Input.mouse.moved && st.sel !== i) { st.sel = i; AudioSys.sfx('menuMove'); }
      if (inside && Input.mouse.pr[0]) clicked = i;
      c.fillStyle = on ? 'rgba(255,42,138,0.35)' : 'rgba(255,255,255,0.06)'; c.fillRect(x, y, cell - 8, cell - 8);
      if (on) { c.strokeStyle = '#ff2a8a'; c.lineWidth = 3; c.strokeRect(x, y, cell - 8, cell - 8); }
      const bob = on ? Math.round(Math.sin(t * 5) * 3) : 0;
      c.drawImage(locked ? maskPortraitLocked(m.id) : maskPortrait(m.id), x + 6, y + 6 + bob, 84, 84);
      if (locked) txt(c, '🔒', x + (cell - 8) / 2, y + (cell - 8) / 2, 26, '#fff');
      if (Save.mask === i) { c.fillStyle = '#3ffcff'; c.fillRect(x + 4, y + cell - 16, cell - 16, 4); }
    }
    // detail panel
    const m = MASKS[st.sel], locked = st.sel >= unl, px = ar ? 80 : 640, pw = 560;
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(px, 150, pw, 440);
    c.drawImage(locked ? maskPortraitLocked(m.id) : maskPortrait(m.id), px + pw / 2 - 112, 170 + Math.round(Math.sin(t * 2) * 4), 224, 224);
    c.restore();
    txt(c, locked ? '???' : m[Settings.lang === 'ar' ? 'ar' : 'en'], px + pw / 2, 430, 40, '#fff', 'center', locked ? null : '#ff2a8a');
    txt(c, locked ? '' : m[Settings.lang === 'ar' ? 'en' : 'ar'], px + pw / 2, 470, 20, 'rgba(255,255,255,0.55)');
    txt(c, locked ? L('maskLocked') : (Settings.lang === 'ar' ? m.dAr : m.dEn), px + pw / 2, 530, 22, locked ? '#888' : '#ffe14a');
    const go = i => { if (i < unl) { AudioSys.sfx('menuOk'); Save.mask = i; persist(); this.launchLevel(this.pendingLevel); } else AudioSys.sfx('menuBack'); };
    if (clicked >= 0) { if (clicked === st.sel) go(clicked); else st.sel = clicked; } else if (Input.confirm()) go(st.sel);
    if (Input.back()) { AudioSys.sfx('menuBack'); this.go('menu'); }
    const cx = SW / 2; prompt(c, BIND.confirm(), L('choose'), ar ? cx + 140 : cx - 140, 650, 18);
    prompt(c, BIND.back(), L('back'), ar ? cx - 140 : cx + 140, 650, 18);
  },
  mapScreen(c, t) {
    this.drawGameFrozen(c); c.fillStyle = 'rgba(6,0,16,0.86)'; c.fillRect(0, 0, SW, SH);
    const ar = Settings.lang === 'ar';
    txt(c, L('map') + ' — ' + LEVELS[G.levelIdx][Settings.lang] + ' • ' + L('floor') + ' ' + (G.floorIdx + 1), SW / 2, 44, 26, '#fff', 'center', '#ff2a8a');
    const s = Math.floor(Math.min(760 / G.W, 520 / G.H)), mw = G.W * s, mh = G.H * s, mx = ar ? SW - 40 - mw : 40, my = 90;
    for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
      const tt = G.tiles[y * G.W + x]; if (tt === 0) continue;
      c.fillStyle = tt === 2 ? '#ff2a8a' : tt === 3 ? '#3ffcff' : tt === 4 ? '#0b2a4a' : (G.style[y * G.W + x] === '_' ? '#1c1a24' : '#2e2840');
      c.fillRect(mx + x * s, my + y * s, s, s);
    }
    const P = (wx, wy) => [mx + wx / T * s, my + wy / T * s];
    c.fillStyle = '#ffb04a'; for (const d of G.doors) { const [x, y] = P(d.hx, d.hy); c.fillRect(x - 2, y - 2, 4, 4); }
    if (Math.floor(t * 3) % 2) { const [x, y] = P(G.exit.x, G.exit.y); c.fillStyle = '#3ffcff'; c.fillRect(x - s / 2, y - s / 2, s, s); }
    if (G.mask === 'prism') { c.fillStyle = '#ff3030'; for (const e of G.enemies) if (e.state !== 'dead') { const [x, y] = P(e.x, e.y); c.fillRect(x - 3, y - 3, 6, 6); } }
    { const [x, y] = P(G.player.x, G.player.y); c.fillStyle = '#fff'; c.fillRect(x - 4, y - 4, 8, 8); c.fillStyle = '#7b2cff'; c.fillRect(x - 2, y - 2, 4, 4); }
    // mask panel
    const m = MASK_BY_ID[G.mask], px = ar ? 40 : SW - 400;
    c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(px, 90, 360, 520);
    c.save(); c.imageSmoothingEnabled = false; c.drawImage(maskPortrait(m.id), px + 68, 110, 224, 224); c.restore();
    txt(c, m[ar ? 'ar' : 'en'], px + 180, 370, 34, '#fff', 'center', '#ff2a8a');
    txt(c, ar ? m.dAr : m.dEn, px + 180, 420, 17, '#ffe14a');
    const left = G.enemies.filter(e => e.state !== 'dead').length;
    txt(c, (ar ? 'الأعداء الباقين: ' : 'ENEMIES LEFT: ') + left, px + 180, 470, 20, left ? '#ff6a9d' : '#3ffcff');
    txt(c, L('score') + ': ' + G.score, px + 180, 505, 20, '#fff');
    prompt(c, BIND.map(), L('close'), SW / 2, 670, 18);
    if (Input.mapPressed() || Input.back() || Input.pausePressed()) { AudioSys.sfx('menuBack'); this.go('game'); }
  },
  controls(c, t) {
    drawBackdrop(c, t); c.fillStyle = 'rgba(8,0,18,0.82)'; c.fillRect(0, 0, SW, SH);
    if (this.ctrlView == null || this.screenT < 0.05) this.ctrlView = Input.dev();
    const views = ['kb', 'xbox', 'ps'];
    if (Input.navRight()) { this.ctrlView = views[(views.indexOf(this.ctrlView) + 1) % 3]; AudioSys.sfx('menuMove'); }
    if (Input.navLeft()) { this.ctrlView = views[(views.indexOf(this.ctrlView) + 2) % 3]; AudioSys.sfx('menuMove'); }
    const v = this.ctrlView, ar = Settings.lang === 'ar';
    txt(c, L('controls') + ' — ' + (v === 'ps' ? L('ps') : v === 'xbox' ? L('xbox') : L('kb')), SW / 2, 48, 36, '#fff', 'center', '#ff2a8a');
    txt(c, L('viewToggle'), SW / 2, 86, 16, '#aaa');
    if (v === 'ps') this.psDiagram(c, t);
    else {
      const rows = v === 'kb'
        ? [['c_move', 'W A S D'], ['c_aim', 'MOUSE'], ['c_attack', 'LMB'], ['c_throw', 'RMB / Q'], ['c_pick', 'E / RMB'], ['c_exec', 'SPACE'], ['c_restart', 'R'], ['c_dodge', 'CTRL / C'], ['c_look', 'SHIFT'], ['c_map', 'TAB / M'], ['c_pause', 'ESC / P']]
        : [['c_move', 'LS'], ['c_aim', 'RS'], ['c_attack', 'RT'], ['c_throw', 'LT'], ['c_pick', 'xX'], ['c_exec', 'xA'], ['c_restart', 'xY'], ['c_dodge', 'xB'], ['c_look', 'RB / LB'], ['c_map', 'VIEW'], ['c_pause', 'START']];
      const colA = ar ? 820 : 460, colB = ar ? 460 : 820;
      rows.forEach((r, i) => {
        const y = 130 + i * 46;
        c.fillStyle = i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,42,138,0.07)'; c.fillRect(240, y - 21, 800, 42);
        txt(c, L(r[0]), colA, y, 21, '#fff');
        const parts = v === 'kb' ? [r[1]] : r[1].split(' / '); const total = parts.reduce((s, p) => s + glyphW(c, p) + 8, 0); let x = colB - total / 2;
        for (const p of parts) x += drawGlyph(c, p, x, y) + 8;
      });
    }
    txt(c, ar ? 'طيّح العدو بالباب أو القبضة أو الرمي، وبعدها نفّذ عليه. الثقيل ما يموت إلا بالرصاص.' : 'Knock enemies down with doors, fists or throws, then execute. Heavies only die to bullets.', SW / 2, 650, 16, '#ffe14a');
    if (Input.back() || Input.confirm()) { AudioSys.sfx('menuBack'); this.go('menu', 2); }
    this.backButton(c);
  },
  psDiagram(c, t) {
    // original generic pixel controller (no logos), generated from code
    const cv = sprite('psdiagram', () => {
      const g = Pix.grid(82, 44), body = '#2c2c3a', hi = '#3c3c50', dk = '#1d1d28';
      Pix.rect(g, 14, 2, 14, 3, '#4a4a60'); Pix.rect(g, 54, 2, 14, 3, '#4a4a60'); // L2 R2
      Pix.rect(g, 13, 6, 16, 2, '#5a5a74'); Pix.rect(g, 53, 6, 16, 2, '#5a5a74'); // L1 R1
      Pix.rect(g, 10, 8, 62, 16, body); Pix.ellipse(g, 19, 27, 10, 14, body); Pix.ellipse(g, 63, 27, 10, 14, body);
      Pix.rect(g, 12, 9, 58, 2, hi);
      Pix.rect(g, 29, 9, 24, 11, dk); Pix.rect(g, 30, 10, 22, 9, '#34344a'); // touchpad
      Pix.rect(g, 25, 10, 2, 3, '#77779a'); Pix.rect(g, 55, 10, 2, 3, '#77779a'); // create / options
      Pix.ellipse(g, 41, 23, 2, 2, '#55557a'); // home button (plain)
      Pix.rect(g, 16, 13, 3, 9, '#151520'); Pix.rect(g, 13, 16, 9, 3, '#151520'); // d-pad
      Pix.ellipse(g, 31, 28, 4.5, 4.5, '#151520'); Pix.ellipse(g, 31, 28, 3, 3, '#3a3a50'); Pix.ellipse(g, 51, 28, 4.5, 4.5, '#151520'); Pix.ellipse(g, 51, 28, 3, 3, '#3a3a50');
      for (const [x, y] of [[64, 12], [68, 16], [64, 20], [60, 16]]) Pix.ellipse(g, x, y, 2.2, 2.2, '#151520');
      Pix.outline(g, '#000000'); return Pix.canvas(g);
    });
    const S = 7, ox = SW / 2 - 41 * S, oy = 150;
    c.save(); c.imageSmoothingEnabled = false; c.drawImage(cv, ox, oy, 82 * S, 44 * S); c.restore();
    const at = (gx, gy) => [ox + gx * S, oy + gy * S];
    // face symbols on the diagram
    const face = [['pT', 64, 12], ['pO', 68, 16], ['pX', 64, 20], ['pS', 60, 16]];
    for (const [g, x, y] of face) { const [sx, sy] = at(x, y); c.save(); c.imageSmoothingEnabled = false; c.drawImage(psButtonCanvas(g), sx - 15, sy - 15 + 3, 30, 30); c.restore(); }
    const lab = [
      ['L2', 21, 3, 'c_throw', 'L', 120], ['L1', 21, 7, 'c_look', 'L', 165], ['LS', 31, 28, 'c_move', 'L', 520], ['TOUCHPAD', 41, 13, 'c_map', 'T', 0],
      ['R2', 61, 3, 'c_attack', 'R', 120], ['R1', 61, 7, 'c_look', 'R', 165], ['pT', 64, 12, 'c_restart', 'R', 225], ['pO', 68, 16, 'c_dodge', 'R', 285],
      ['pX', 64, 20, 'c_exec', 'R', 345], ['pS', 60, 16, 'c_pick', 'R', 405], ['OPTIONS', 56, 11, 'c_pause', 'R', 465], ['RS', 51, 28, 'c_aim', 'R', 520],
    ];
    c.strokeStyle = 'rgba(63,252,255,0.6)'; c.lineWidth = 2;
    for (const [g, gx, gy, key, side, ly] of lab) {
      const [sx, sy] = at(gx, gy);
      if (side === 'T') { c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx, 120); c.stroke(); const w = glyphW(c, g); drawGlyph(c, g, sx - w - 6, 112); txt(c, L(key), sx + 6, 112, 18, '#fff', 'left'); continue; }
      const lx = side === 'L' ? 300 : SW - 300;
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(lx, ly); c.stroke();
      const w = glyphW(c, g);
      if (side === 'L') { drawGlyph(c, g, lx - w - 4, ly); txt(c, L(key), lx - w - 14, ly, 18, '#fff', 'right'); }
      else { drawGlyph(c, g, lx + 4, ly); txt(c, L(key), lx + w + 14, ly, 18, '#fff', 'left'); }
    }
    txt(c, (Settings.lang === 'ar' ? '✕ تأكيد  •  ○ رجوع في القوائم  •  ' : '✕ confirm  •  ○ back in menus  •  ') + (Input.padType === 'ps' && Input.pad ? L('padConnected') : ''), SW / 2, 610, 16, '#c9b6e8');
  },
  pause(c, t) {
    this.drawGameFrozen(c);
    c.fillStyle = 'rgba(8,0,18,0.72)'; c.fillRect(0, 0, SW, SH);
    c.save(); c.translate(SW / 2, 150); c.rotate(-0.03); txt(c, L('paused'), 0, 0, 64, '#fff', 'center', '#ff2a8a', Settings.lang === 'ar' ? FONT_AR : FONT_TITLE); c.restore();
    const items = [
      { label: () => L('resume'), act: () => this.go('game') },
      { label: () => L('restart'), act: () => { G.restartFloor(); this.go('game'); } },
      { label: () => L('settings'), act: () => { this.settingsReturn = 'pause'; this.go('settings'); } },
      { label: () => L('quitMenu'), act: () => { this.go('menu'); } },
    ];
    menuList(c, items, 0, SW / 2, 290, 70, 32, t);
    if (Input.back() || Input.bp(9) || Input.kpr('KeyP')) { AudioSys.sfx('menuBack'); this.go('game'); }
  },
  results(c, t) {
    const r = this.result, k = this.screenT;
    drawBackdrop(c, t); c.fillStyle = 'rgba(8,0,18,0.7)'; c.fillRect(0, 0, SW, SH);
    txt(c, LEVELS[r.level][Settings.lang], SW / 2, 70, 42, '#fff', 'center', '#ff2a8a');
    const ar = Settings.lang === 'ar';
    const lines = [[L('score'), Math.floor(r.score * clamp(k / 1.2, 0, 1))], [L('kills'), r.kills], [L('combo'), 'x' + r.combo], [L('time'), this.fmtTime(r.time)]];
    lines.forEach((ln, i) => {
      if (k < 0.2 + i * 0.25) return;
      const y = 170 + i * 56;
      txt(c, ln[0], ar ? 760 : 520, y, 28, '#c9b6e8', ar ? 'right' : 'left');
      txt(c, String(ln[1]), ar ? 520 : 760, y, 30, '#fff', ar ? 'left' : 'right');
    });
    if (k > 1.4) {
      if (!r.sfxd) { r.sfxd = true; AudioSys.sfx('grade'); }
      const s = 1 + Math.max(0, 1.7 - k) * 3;
      txt(c, L('grade'), SW / 2, 420, 24, '#aaa');
      c.save(); c.translate(SW / 2, 490); c.scale(s, s); c.rotate(Math.sin(t * 2) * 0.05);
      txt(c, r.grade, 0, 0, 96, '#ffe14a', 'center', '#ff6a3d', FONT_TITLE); c.restore();
      if (r.newBest) txt(c, L('newBest'), SW / 2, 560, 22, '#3ffcff', 'center', '#3ffcff');
      if (r.newMask) txt(c, L('newMask'), SW / 2, 592, 22, '#ff7ad1', 'center', '#ff2a8a');
      const isLast = r.level >= LEVELS.length - 1;
      const items = [];
      if (!isLast) items.push({ label: () => L('next'), act: () => this.startLevel(r.level + 1) });
      else items.push({ label: () => L('next'), act: () => this.go('ending') });
      items.push({ label: () => L('retry'), act: () => this.startLevel(r.level) });
      items.push({ label: () => L('menu'), act: () => this.go('menu') });
      // horizontal list
      const st = this.menuState;
      if (Input.navLeft() || Input.navUp()) { st.sel = (st.sel - 1 + items.length) % items.length; AudioSys.sfx('menuMove'); }
      if (Input.navRight() || Input.navDown()) { st.sel = (st.sel + 1) % items.length; AudioSys.sfx('menuMove'); }
      items.forEach((it, i) => {
        const vi = ar ? items.length - 1 - i : i; const x = SW / 2 + (vi - (items.length - 1) / 2) * 300, y = 640;
        const inside = Math.abs(Input.mouse.x - x) < 130 && Math.abs(Input.mouse.y - y) < 26;
        if (inside && Input.mouse.moved) st.sel = i;
        const on = st.sel === i;
        c.fillStyle = on ? 'rgba(255,42,138,0.4)' : 'rgba(0,0,0,0.4)'; c.fillRect(x - 130, y - 26, 260, 52);
        if (on) { c.strokeStyle = '#ff2a8a'; c.lineWidth = 2; c.strokeRect(x - 130, y - 26, 260, 52); }
        txt(c, it.label(), x, y, 24, '#fff');
        if (inside && Input.mouse.pr[0]) { AudioSys.sfx('menuOk'); it.act(); }
      });
      if (Input.confirm() && k > 1.8) { AudioSys.sfx('menuOk'); items[st.sel].act(); }
    } else if (Input.confirm() || Input.mouse.pr[0]) this.screenT = 1.5;
  },
  ending(c, t) {
    drawBackdrop(c, t);
    txt(c, L('theEnd'), SW / 2, 260, 64, '#fff', 'center', '#ff2a8a', Settings.lang === 'ar' ? FONT_AR : FONT_TITLE);
    txt(c, L('thanks'), SW / 2, 340, 32, '#3ffcff', 'center', '#3ffcff');
    prompt(c, BIND.confirm(), L('menu'), SW / 2, 620, 20);
    if (this.screenT > 1 && (Input.confirm() || Input.mouse.pr[0] || Input.back())) { AudioSys.sfx('menuOk'); this.go('menu'); }
  },
};

// ---- boot
(function boot() {
  const screen = document.getElementById('game');
  const out = screen.getContext('2d');
  const scene = mkCanvas(SW, SH), sc = scene.getContext('2d');
  UI.canvasEl = screen;
  Input.init(screen); FX.init();
  const resize = () => { const s = Math.min(innerWidth / SW, innerHeight / SH); screen.style.width = SW * s + 'px'; screen.style.height = SH * s + 'px'; };
  addEventListener('resize', resize); resize();
  let last = performance.now();
  window.__frames = 0;
  function loop(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
    Input.poll(dt);
    sc.setTransform(1, 0, 0, 1, 0, 0); sc.globalAlpha = 1; sc.globalCompositeOperation = 'source-over';
    UI.frame(dt, sc);
    FX.apply(scene, out, UI.t, UI.screen === 'game' ? Math.min(2.5, (G.shake || 0) * 0.2) : 0);
    Input.endFrame(); window.__frames++;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  window.__game = { G, UI, Input, Settings, Save };
})();
