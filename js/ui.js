// ===== UI: menus, HUD, post effects, main loop =====
const SAVE_KEY = 'neonVendetta.save.v1';
const Settings = { music: 0.7, sfx: 0.8, lang: 'ar', fx: true, shake: 1, aimAssist: true };
const Save = { unlocked: 1, best: {} };
(function load() { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); if (d.settings) Object.assign(Settings, d.settings); if (d.unlocked) Save.unlocked = d.unlocked; if (d.best) Save.best = d.best; } catch (e) { } })();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ settings: Settings, unlocked: Save.unlocked, best: Save.best })); } catch (e) { } }

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

// ---- button glyphs
const PAD_COL = { A: '#3ddc61', B: '#ff4a4a', X: '#3d8bff', Y: '#ffd23d' };
function glyphW(c, g) { if (g.length === 1 && PAD_COL[g]) return 26; c.font = `bold 13px ${FONT_EN}`; return Math.max(26, c.measureText(g).width + 14); }
function drawGlyph(c, g, x, y) { // x = left
  if (g.length === 1 && PAD_COL[g] && Input.mode === 'pad') {
    c.fillStyle = '#111'; c.beginPath(); c.arc(x + 13, y, 13, 0, 7); c.fill(); c.strokeStyle = PAD_COL[g]; c.lineWidth = 2.5; c.stroke();
    txt(c, g, x + 13, y + 1, 14, PAD_COL[g]); return 26;
  }
  const w = glyphW(c, g);
  c.fillStyle = '#f2f2f2'; c.beginPath(); c.roundRect(x, y - 12, w, 24, 5); c.fill();
  c.fillStyle = '#9a9a9a'; c.fillRect(x + 2, y + 9, w - 4, 3);
  txt(c, g, x + w / 2, y, 13, '#111', 'center', null, FONT_EN); return w;
}
function prompt(c, glyphs, label, cx, cy, size) {
  size = size || 20; const gap = 8;
  const gw = glyphs.reduce((s, g) => s + glyphW(c, g) + 4, 0);
  const lw = tw(c, label, size); const total = gw + gap + lw;
  const rtl = isAr(label);
  let x = cx - total / 2;
  c.fillStyle = 'rgba(0,0,0,0.55)'; c.beginPath(); c.roundRect(x - 12, cy - 18, total + 24, 36, 8); c.fill();
  if (rtl) { txt(c, label, x + lw, cy, size, '#fff', 'right'); x += lw + gap; for (const g of glyphs) x += drawGlyph(c, g, x, cy) + 4; }
  else { for (const g of glyphs) x += drawGlyph(c, g, x, cy) + 4; txt(c, label, x + gap, cy, size, '#fff', 'left'); }
}
const BIND = {
  pickup: () => Input.mode === 'pad' ? ['X'] : ['E'],
  execute: () => Input.mode === 'pad' ? ['A'] : ['SPACE'],
  restart: () => Input.mode === 'pad' ? ['Y'] : ['R'],
  throwW: () => Input.mode === 'pad' ? ['LT'] : ['RMB'],
  confirm: () => Input.mode === 'pad' ? ['A'] : ['ENTER'],
  back: () => Input.mode === 'pad' ? ['B'] : ['ESC'],
};

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
    const prev = Save.best[i]; let newBest = false;
    if (!prev || G.score > prev.score) { Save.best[i] = { score: G.score, grade: (!prev || GRADE_ORDER.indexOf(grade) > GRADE_ORDER.indexOf(prev.grade)) ? grade : prev.grade }; newBest = true; }
    else if (GRADE_ORDER.indexOf(grade) > GRADE_ORDER.indexOf(prev.grade)) prev.grade = grade;
    Save.unlocked = Math.max(Save.unlocked, Math.min(LEVELS.length, i + 2)); persist();
    this.result = { grade, score: G.score, combo: G.maxCombo, time, kills: G.kills, newBest, level: i };
    setTimeout(() => this.go('results'), 700);
  },
  startLevel(i) { G.loadLevel(i); this.go('intro'); this.introT = 0; this.tip = ['tip1', 'tip2', 'tip3'][i % 3]; },
  fmtTime(s) { const m = Math.floor(s / 60), ss = Math.floor(s % 60); return m + ':' + String(ss).padStart(2, '0'); },
  frame(dt, c) {
    this.t += dt; this.screenT = (this.screenT || 0) + dt; const t = this.t;
    const inGame = ['game', 'pause', 'intro'].includes(this.screen) || (this.screen === 'settings' && this.settingsReturn === 'pause');
    // music
    if (['game', 'pause', 'intro'].includes(this.screen) || (this.screen === 'settings' && this.settingsReturn === 'pause')) AudioSys.playMusic(G.levelIdx + 11, LEVELS[G.levelIdx].boss ? 'boss' : 'game');
    else AudioSys.playMusic(777, 'menu');
    const muff = this.screen === 'pause' || (this.screen === 'settings' && this.settingsReturn === 'pause') || (this.screen === 'game' && G.status === 'dead');
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
      case 'game': this.game(c, t, dt); break;
      case 'pause': this.pause(c, t); break;
      case 'results': this.results(c, t); break;
      case 'ending': this.ending(c, t); break;
    }
    if (Input.toast) { const a = clamp(Input.toast.t, 0, 1); c.globalAlpha = a; prompt(c, ['START'], L(Input.toast.k), SW / 2, 40, 18); c.globalAlpha = 1; }
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
    txt(c, Input.mode === 'pad' ? '🎮 ' + L('pad') : '⌨ ' + L('kb'), SW - 20, 700, 14, 'rgba(255,255,255,0.6)', 'right');
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
  controls(c, t) {
    drawBackdrop(c, t); c.fillStyle = 'rgba(8,0,18,0.8)'; c.fillRect(0, 0, SW, SH);
    txt(c, L('controls'), SW / 2, 60, 46, '#fff', 'center', '#ff2a8a');
    const rows = [
      ['c_move', 'W A S D', 'LS'], ['c_aim', 'MOUSE', 'RS'], ['c_attack', 'LMB', 'RT'], ['c_throw', 'RMB / Q', 'LT / B'],
      ['c_pick', 'E / RMB', 'X'], ['c_exec', 'SPACE', 'A'], ['c_restart', 'R', 'Y'], ['c_look', 'SHIFT', 'RB / LB'], ['c_pause', 'ESC / P', 'START'],
    ];
    const ar = Settings.lang === 'ar';
    const colA = ar ? 980 : 300, colK = 640, colP = ar ? 300 : 980;
    txt(c, L('kb'), colK, 120, 22, Input.mode === 'kb' ? '#3ffcff' : '#aaa');
    txt(c, L('pad'), colP, 120, 22, Input.mode === 'pad' ? '#3ffcff' : '#aaa');
    rows.forEach((r, i) => {
      const y = 170 + i * 52;
      c.fillStyle = i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,42,138,0.07)'; c.fillRect(140, y - 24, 1000, 48);
      txt(c, L(r[0]), colA, y, 22, '#fff');
      const kw = glyphW(c, r[1]); drawGlyph(c, r[1], colK - kw / 2, y);
      const parts = r[2].split(' / '); let total = parts.reduce((s, p) => s + glyphW(c, p) + 8, 0); let x = colP - total / 2;
      const saved = Input.mode; Input.mode = 'pad'; for (const p of parts) x += drawGlyph(c, p, x, y) + 8; Input.mode = saved;
    });
    txt(c, Settings.lang === 'ar' ? 'تقدر تطيّح العدو بالباب أو بالقبضة أو برمي السلاح، وبعدها نفّذ عليه. الثقيل ما يموت إلا بالرصاص.' : 'Knock enemies down with doors, fists or thrown weapons, then execute them. Heavies only die to bullets.', SW / 2, 650, 17, '#ffe14a');
    if (Input.back() || Input.confirm()) { AudioSys.sfx('menuBack'); this.go('menu', 2); }
    this.backButton(c);
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
