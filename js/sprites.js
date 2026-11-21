// ===== Pixel-art sprite system: code-defined pixel grids, cached canvases, nearest-neighbour rendering =====
const Pix = {
  grid(w, h) { return { w, h, d: new Array(w * h).fill(null) }; },
  set(g, x, y, c) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.d[y * g.w + x] = c; },
  get(g, x, y) { if (x < 0 || y < 0 || x >= g.w || y >= g.h) return null; return g.d[y * g.w + x]; },
  rect(g, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(g, x + i, y + j, c); },
  ellipse(g, cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) this.set(g, x, y, c);
    }
  },
  // stamp string-array art; pal maps chars -> colours; '.' = transparent
  stamp(g, art, pal, ox, oy, flipY) {
    for (let y = 0; y < art.length; y++) for (let x = 0; x < art[y].length; x++) {
      const ch = art[flipY ? art.length - 1 - y : y][x]; if (ch !== '.' && ch !== ' ' && pal[ch]) this.set(g, ox + x, oy + y, pal[ch]);
    }
  },
  // rotate art around pivot (px,py in art coords), put pivot at (x,y) of grid
  stampRot(g, art, pal, x, y, px, py, ang) {
    const h = art.length, w = art[0].length, c = Math.cos(ang), s = Math.sin(ang), R = Math.ceil(Math.hypot(w, h)) + 1;
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      const ax = Math.round(c * i + s * j + px), ay = Math.round(-s * i + c * j + py);
      if (ay < 0 || ay >= h || ax < 0 || ax >= w) continue; const ch = art[ay][ax];
      if (ch !== '.' && pal[ch]) this.set(g, x + i, y + j, pal[ch]);
    }
  },
  outline(g, col) {
    const add = [];
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (g.d[y * g.w + x]) continue;
      if (this.get(g, x + 1, y) || this.get(g, x - 1, y) || this.get(g, x, y + 1) || this.get(g, x, y - 1)) add.push(y * g.w + x);
    }
    for (const i of add) g.d[i] = col;
  },
  canvas(g, silhouette) {
    const cv = mkCanvas(g.w, g.h), c = cv.getContext('2d'); const img = c.createImageData(g.w, g.h);
    for (let i = 0; i < g.d.length; i++) { const col = g.d[i]; if (!col) continue; const v = silhouette ? silhouette : col; const n = parseInt(v.slice(1), 16);
      const r = v.length === 4 ? ((n >> 8) & 15) * 17 : (n >> 16) & 255, gg = v.length === 4 ? ((n >> 4) & 15) * 17 : (n >> 8) & 255, b = v.length === 4 ? (n & 15) * 17 : n & 255;
      img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255; }
    c.putImageData(img, 0, 0); return cv;
  },
};
const SpriteCache = new Map();
function sprite(key, build) { let s = SpriteCache.get(key); if (!s) { s = build(); SpriteCache.set(key, s); } return s; }
const OUT = '#0b0610';

// ---- weapons (facing right, pivot = grip at left middle)
const WART = {
  bat: { art: ['.......WWWW.', 'kkwwwwwWWWWW', '.......WWWW.'], pal: { k: '#2a1a10', w: '#b77a3a', W: '#e8b468' }, py: 1 },
  pipe: { art: ['ggGGGGGGGGGGGg', 'ggGGGGGGGGGGGg'], pal: { g: '#5c6672', G: '#b4c0cf' }, py: 0.5 },
  knife: { art: ['kkkSSSSs.', 'kkkSSSSSs'], pal: { k: '#5a3418', S: '#eef3fa', s: '#8f9aa8' }, py: 0.5 },
  pistol: { art: ['KKKKKKKK', 'kKKKKKKK', '.kk.....'], pal: { K: '#4a4a58', k: '#1c1c24' }, py: 1 },
  shotgun: { art: ['wwwwkKKKKKKKKKK', 'wwwwkKKKKKKKKKK'], pal: { w: '#7a4a24', k: '#1c1c24', K: '#50505e' }, py: 0.5 },
  smg: { art: ['kKKKKKKKKKgg', 'kKKKKKKKKK..', '...kk.......', '...kk.......'], pal: { K: '#3a3a46', k: '#16161c', g: '#777' }, py: 1 },
};
function weaponSprite(type, outlineCol) {
  return sprite('w|' + type + '|' + outlineCol, () => {
    const a = WART[type], w = a.art[0].length + 2, h = a.art.length + 2, g = Pix.grid(w, h);
    Pix.stamp(g, a.art, a.pal, 1, 1); if (outlineCol) Pix.outline(g, outlineCol); return Pix.canvas(g);
  });
}

// ---- character palettes
const CPAL = {
  player: { body: '#6a2cff', shade: '#4317a8', trim: '#3ffcff', skin: '#e0a878', hair: '#1a1020', pants: '#24183a' },
  melee: { body: '#2f8a52', shade: '#1d5c35', trim: '#eaf7ee', skin: '#c98f5e', hair: '#1b1209', pants: '#1f2a24' },
  gun: { body: '#2b4594', shade: '#1a2b63', trim: '#a9c0ff', skin: '#d09a6a', hair: '#2a1a0c', pants: '#1a1f33' },
  heavy: { body: '#e06a1f', shade: '#a1460f', trim: '#ffd0a0', skin: '#c48558', hair: null, pants: '#2b2018' },
  boss: { body: '#5b2386', shade: '#3a1258', trim: '#e2b33a', skin: '#b07850', hair: '#7a3b12', pants: '#1e0f2a' },
};

// top-down human, facing +x. pose: 'walk' | 'gun' | 'melee' | 'punch'; frame index
function humanSprite(kind, weapon, pose, frame, maskId, scaleK) {
  const key = ['h', kind, weapon, pose, frame, maskId, scaleK].join('|');
  return sprite(key, () => {
    const k = scaleK || 1, S = Math.round(34 * k), g = Pix.grid(S, S), cx = S / 2, cy = S / 2, P = CPAL[kind];
    const sk = n => Math.round(n * k);
    // feet (walk cycle)
    const off = [0, 2, 0, -2][frame % 4] * k;
    Pix.rect(g, cx - 1 + off, cy - sk(5), sk(3), sk(2), '#141018');
    Pix.rect(g, cx - 1 - off, cy + sk(3), sk(3), sk(2), '#141018');
    const W = weapon ? WART[weapon] : null, isGun = weapon && WEAPONS[weapon].gun;
    // arms + weapon (drawn under torso for the back arm)
    const arm = (x0, y0, ang, len) => { for (let i = 0; i <= len; i++) Pix.rect(g, x0 + Math.cos(ang) * i, y0 + Math.sin(ang) * i, sk(2), sk(2), P.body); Pix.rect(g, x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len, sk(2), sk(2), P.skin); return { x: x0 + Math.cos(ang) * (len + 1), y: y0 + Math.sin(ang) * (len + 1) }; };
    if (isGun) {
      arm(cx + sk(1), cy - sk(5), 0.45, sk(6)); arm(cx + sk(1), cy + sk(4), -0.45, sk(6));
      Pix.stampRot(g, W.art, W.pal, Math.round(cx + sk(7)), Math.round(cy), 0, W.py, 0);
    } else if (weapon) {
      const angs = pose === 'melee' ? [-1.5, -0.2, 1.2] : [1.0];
      const a = angs[Math.min(frame, angs.length - 1)];
      arm(cx + sk(1), cy - sk(5), 0.3, sk(4));
      const h = arm(cx + sk(1), cy + sk(4), a - 0.6, sk(5));
      Pix.stampRot(g, W.art, W.pal, Math.round(h.x), Math.round(h.y), 0, W.py, a);
    } else {
      const ext = pose === 'punch' ? [sk(9), sk(4)][frame % 2] : sk(4), ext2 = pose === 'punch' ? [sk(4), sk(9)][frame % 2] : sk(4);
      arm(cx + sk(1), cy - sk(5), 0.2, ext); arm(cx + sk(1), cy + sk(4), -0.2, ext2);
    }
    // torso
    Pix.ellipse(g, cx - 0.5, cy + 0.5, 4.6 * k, 6.8 * k, P.body);
    for (let y = 0; y < S; y++) for (let x = 0; x < cx - sk(2.5); x++) if (Pix.get(g, x, y) === P.body) Pix.set(g, x, y, P.shade);
    Pix.rect(g, cx - sk(3), cy - sk(4), 1, sk(9), P.trim);
    if (kind === 'boss') { Pix.rect(g, cx - sk(2), cy - sk(7), sk(4), sk(2), P.trim); Pix.rect(g, cx - sk(2), cy + sk(6), sk(4), sk(2), P.trim); }
    if (kind === 'heavy') { Pix.rect(g, cx - sk(4), cy - 1, sk(8), sk(2), '#222'); }
    // head
    const hx = cx + sk(1), hr = 3.7 * k;
    if (maskId) { drawMaskTop(g, maskId, hx, cy + 0.5, hr); }
    else {
      Pix.ellipse(g, hx, cy + 0.5, hr, hr, P.skin);
      if (P.hair) for (let y = 0; y < S; y++) for (let x = 0; x < hx - 0.5; x++) if (Pix.get(g, x, y) === P.skin) Pix.set(g, x, y, P.hair);
      if (kind === 'boss') { for (let i = -2; i <= 2; i++) Pix.rect(g, hx - sk(1) + Math.abs(i) * -1, cy + i * sk(2), sk(2), 1, '#c8641e'); Pix.rect(g, hx - sk(4), cy - sk(4), sk(1), sk(9), '#e2b33a'); }
      if (kind === 'heavy') Pix.rect(g, hx + sk(2), cy - 1, 1, sk(2), '#7a4a2a');
    }
    Pix.outline(g, OUT);
    return g;
  });
}
function charCanvas(g, sil) { const key = g; if (!g.cv) g.cv = Pix.canvas(g); if (sil) { g.sil = g.sil || {}; return g.sil[sil] || (g.sil[sil] = Pix.canvas(g, sil)); } return g.cv; }

function dogSprite(frame) {
  return sprite('dog|' + frame, () => {
    const g = Pix.grid(30, 30), cx = 15, cy = 15, off = [0, 2, 0, -2][frame % 4];
    const leg = '#2a160a'; Pix.rect(g, cx + 3 + off, cy - 6, 2, 2, leg); Pix.rect(g, cx + 3 - off, cy + 4, 2, 2, leg); Pix.rect(g, cx - 6 - off, cy - 6, 2, 2, leg); Pix.rect(g, cx - 6 + off, cy + 4, 2, 2, leg); Pix.rect(g, cx + 3 + off, cy - 5, 2, 2, leg); Pix.rect(g, cx + 3 - off, cy + 3, 2, 2, leg); Pix.rect(g, cx - 6 - off, cy - 5, 2, 2, leg); Pix.rect(g, cx - 6 + off, cy + 3, 2, 2, leg);
    Pix.ellipse(g, cx - 1, cy, 9, 4.6, '#7a4a28'); Pix.rect(g, cx - 7, cy - 1, 11, 1, '#5a3418');
    Pix.ellipse(g, cx + 8, cy, 3.8, 3.8, '#5a3418'); Pix.rect(g, cx + 10, cy - 1, 4, 2, '#3a200c');
    Pix.set(g, cx + 6, cy - 3, '#3a200c'); Pix.set(g, cx + 6, cy + 3, '#3a200c'); Pix.set(g, cx + 8, cy - 1, '#ff3030'); Pix.set(g, cx + 8, cy + 1, '#ff3030');
    Pix.rect(g, cx - 12, cy + (frame % 2 ? -1 : 0), 4, 1, '#7a4a28');
    Pix.outline(g, OUT); return g;
  });
}
// lying body; stage 0 = falling (squashed), 1 = flat. down = knocked out (no blood)
function corpseSprite(kind, maskId, variant, down) {
  return sprite(['c', kind, maskId, variant, down].join('|'), () => {
    if (kind === 'dog') {
      const g = Pix.grid(30, 30), cx = 15, cy = 15; Pix.ellipse(g, cx - 1, cy + 1, 7.5, 4, '#6a3e20'); Pix.ellipse(g, cx + 7, cy + 3, 3, 3, '#4a2a12');
      Pix.rect(g, cx - 3, cy + 4, 2, 3, '#2a160a'); Pix.rect(g, cx + 2, cy + 4, 2, 3, '#2a160a'); if (!down) { Pix.rect(g, cx - 2, cy - 1, 3, 2, '#9a0016'); } Pix.outline(g, OUT); return g;
    }
    const k = kind === 'heavy' ? 1.9 : kind === 'boss' ? 2 : 1.35, S = Math.round(36 * k), g = Pix.grid(S, S), cx = S / 2, cy = S / 2, P = CPAL[kind], sk = n => Math.round(n * k);
    const v = variant % 3, spread = [0, 2, -2][v];
    Pix.rect(g, cx - sk(12), cy - sk(3) - spread, sk(8), sk(2), P.pants); Pix.rect(g, cx - sk(12), cy + sk(1) + spread, sk(8), sk(2), P.pants);
    Pix.rect(g, cx - sk(14), cy - sk(3) - spread, sk(2), sk(2), '#141018'); Pix.rect(g, cx - sk(14), cy + sk(1) + spread, sk(2), sk(2), '#141018');
    Pix.ellipse(g, cx, cy, 5.5 * k, 4.8 * k, P.body); Pix.rect(g, cx - sk(4), cy - 1, sk(8), 1, P.trim);
    Pix.rect(g, cx + sk(1), cy - sk(9) + v, sk(2), sk(5), P.body); Pix.rect(g, cx + sk(1), cy - sk(10) + v, sk(2), sk(2), P.skin);
    Pix.rect(g, cx + sk(2), cy + sk(4), sk(6), sk(2), P.body); Pix.rect(g, cx + sk(7), cy + sk(4), sk(2), sk(2), P.skin);
    const hx = cx + sk(8);
    if (maskId) drawMaskTop(g, maskId, hx, cy + 0.5, 3.6 * k);
    else { Pix.ellipse(g, hx, cy + 0.5, 3.6 * k, 3.6 * k, P.skin); if (P.hair) for (let y = 0; y < S; y++) for (let x = 0; x < hx; x++) if (Pix.get(g, x, y) === P.skin && x > cx + sk(4)) Pix.set(g, x, y, P.hair); }
    if (!down) { Pix.rect(g, cx - 1, cy - 1, sk(3), sk(2), '#9a0016'); Pix.set(g, cx + sk(3), cy + 1, '#9a0016'); Pix.set(g, hx - sk(4), cy + sk(2), '#9a0016'); }
    Pix.outline(g, OUT); return g;
  });
}
