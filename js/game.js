// ===== Core gameplay =====
const T = 32, ZOOM = 2;
const WEAPONS = {
  fists: { melee: true, range: 36, arc: 0.9, cd: 0.3, kill: false },
  bat: { melee: true, range: 48, arc: 1.15, cd: 0.38, kill: true, col: '#d9a35b' },
  pipe: { melee: true, range: 50, arc: 1.05, cd: 0.42, kill: true, col: '#aab4c0' },
  knife: { melee: true, range: 40, arc: 0.9, cd: 0.22, kill: true, throwKill: true, col: '#e8e8f0' },
  pistol: { gun: true, ammo: 12, cd: 0.2, auto: false, pellets: 1, spread: 0.03, snd: 'pistol', noise: 560, shake: 4 },
  shotgun: { gun: true, ammo: 6, cd: 0.65, auto: false, pellets: 7, spread: 0.3, snd: 'shotgun', noise: 640, shake: 9 },
  smg: { gun: true, ammo: 30, cd: 0.075, auto: true, pellets: 1, spread: 0.1, snd: 'smg', noise: 560, shake: 3 },
};
const WCODE = { b: 'bat', k: 'knife', p: 'pipe', '1': 'pistol', '2': 'shotgun', '3': 'smg' };
const FLOORS = '_.,;:*';
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const turnTo = (a, target, max) => { const d = angDiff(target, a); return a + clamp(d, -max, max); };

const G = {
  status: 'play', levelIdx: 0, floorIdx: 0, time: 0,
  loadLevel(i) {
    this.levelIdx = i; this.floorIdx = 0; this.score = 0; this.levelTime = 0; this.kills = 0; this.maxCombo = 0;
    this.floorStart = { score: 0, kills: 0 };
    this.loadFloor();
  },
  get level() { return LEVELS[this.levelIdx]; },
  isLastFloor() { return this.floorIdx === this.level.floors.length - 1; },
  restartFloor() {
    this.score = this.floorStart.score; this.kills = this.floorStart.kills; this.loadFloor();
  },
  loadFloor() {
    const rows = this.level.floors[this.floorIdx];
    const H = this.H = rows.length, W = this.W = rows[0].length;
    this.tiles = new Uint8Array(W * H); this.style = new Array(W * H).fill('.');
    this.doors = []; this.enemies = []; this.pickups = []; this.bullets = []; this.thrown = []; this.particles = []; this.floaters = [];
    this.combo = 0; this.comboTimer = 0; this.cleared = false; this.status = 'play'; this.shake = 0; this.flash = 0;
    this.floorStart = { score: this.score, kills: this.kills };
    this.outdoorStart = false;
    const nstyle = (x, y) => { for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]]) { const r = rows[y + dy]; const c = r && r[x + dx]; if (c && FLOORS.includes(c)) return c; } return '.'; };
    let meleeCycle = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = rows[y][x], i = y * W + x, cx = x * T + T / 2, cy = y * T + T / 2;
      if (c === '#') { this.tiles[i] = 2; continue; }
      if (c === 'w') { this.tiles[i] = 3; this.style[i] = nstyle(x, y); continue; }
      if (c === ' ') { this.tiles[i] = 0; continue; }
      if (c === '~') { this.tiles[i] = 4; continue; }
      this.tiles[i] = 1; this.style[i] = FLOORS.includes(c) ? c : nstyle(x, y);
      if (c === 'D') {
        const wl = (xx, yy) => { const r = rows[yy]; const ch = r && r[xx]; return ch === '#' || ch === 'w'; };
        if (wl(x - 1, y) && wl(x + 1, y)) this.doors.push({ hx: x * T, hy: cy, ang: 0, min: -Math.PI / 2, max: Math.PI / 2, av: 0, pusher: null, pushT: 0 });
        else this.doors.push({ hx: cx, hy: y * T, ang: Math.PI / 2, min: 0, max: Math.PI, av: 0, pusher: null, pushT: 0 });
      } else if (c === 'P') { this.player = this.makePlayer(cx, cy); this.outdoorStart = this.style[i] === '_'; }
      else if (c === 'X') { this.exit = { x: cx, y: cy, tx: x, ty: y }; }
      else if (WCODE[c]) { const t = WCODE[c]; this.pickups.push({ type: t, ammo: WEAPONS[t].ammo || 0, x: cx, y: cy, rot: Math.random() * 6 }); }
      else if ('mMgGsSuUdhHB'.includes(c)) {
        const lower = c.toLowerCase(); const patrol = c === lower && c !== 'd' ? true : c === 'd';
        let kind = 'melee', weapon = null;
        if (lower === 'm') { weapon = ['bat', 'pipe', 'knife'][meleeCycle++ % 3]; }
        else if (lower === 'g') { kind = 'gun'; weapon = 'pistol'; }
        else if (lower === 's') { kind = 'gun'; weapon = 'shotgun'; }
        else if (lower === 'u') { kind = 'gun'; weapon = 'smg'; }
        else if (c === 'd') { kind = 'dog'; }
        else if (lower === 'h') { kind = 'heavy'; }
        else if (c === 'B') { kind = 'boss'; weapon = 'shotgun'; }
        this.enemies.push(this.makeEnemy(kind, weapon, cx, cy, c === 'B' ? false : patrol));
      }
    }
    this.buildCanvases();
    const p = this.player;
    // mask
    const mi = (typeof Save !== 'undefined' && Save.mask != null && Save.mask < maskUnlockedCount()) ? Save.mask : 0;
    this.mask = MASKS[mi].id; this.slow = 0; this.startCar = { x: p.x, y: p.y - 40 };
    if (this.mask === 'blade') p.weapon = { type: 'knife', ammo: 0 };
    if (this.mask === 'aegis') p.shield = 1; this.cam = { x: p.x, y: p.y };
    this.aimWorld = { x: p.x + 50, y: p.y };
    if (typeof UI !== "undefined") UI.onFloorStart();
  },
  makePlayer(x, y) { return { x, y, r: 10, ang: -Math.PI / 2, alive: true, weapon: null, cd: 0, swing: 0, swingDir: 1, exec: null, vx: 0, vy: 0, walk: 0, muzzle: 0, roll: 0, rollCd: 0, rollAng: 0, shield: 0 }; },
  makeEnemy(kind, weapon, x, y, patrol) {
    const e = { kind, weapon, x, y, r: 10, ang: Math.random() * Math.PI * 2, state: patrol ? 'patrol' : 'idle', patrol, home: { x, y }, path: [], pathT: 0,
      react: 0, cd: rand(0.3, 0.8), windup: 0, downT: 0, lostT: 0, searchT: 0, lastSeen: null, target: null, hp: 1, flash: 0, vx: 0, vy: 0, seed: Math.random() * 100,
      walk: 0, swing: 0, idleT: rand(1, 3), speed: 150, patrolSpeed: 60, stuckT: 0 };
    e.homeAng = e.ang;
    if (kind === 'dog') { e.r = 9; e.speed = 255; e.patrolSpeed = 70; }
    if (kind === 'heavy') { e.r = 14; e.speed = 95; e.patrolSpeed = 45; }
    if (kind === 'gun') { e.speed = 140; }
    if (kind === 'boss') { e.r = 16; e.speed = 120; e.hp = 6; e.maxHp = 6; e.chargeCd = 3; e.charge = 0; e.tele = 0; e.stun = 0; e.state = 'idle'; e.ang = Math.PI / 2; }
    return e;
  },
  // ---------- map queries
  tileAt(tx, ty) { if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return 2; return this.tiles[ty * this.W + tx]; },
  tileAtPx(x, y) { return this.tileAt(Math.floor(x / T), Math.floor(y / T)); },
  solid(tx, ty) { const t = this.tileAt(tx, ty); return t !== 1; },
  passable(tx, ty) { return this.tileAt(tx, ty) === 1; },
  doorEnd(d) { return { x: d.hx + Math.cos(d.ang) * T, y: d.hy + Math.sin(d.ang) * T }; },
  // line of sight: walls + doors block (glass, void, water don't)
  clearLine(x1, y1, x2, y2, bullet) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), steps = Math.ceil(len / 5);
    for (let i = 1; i < steps; i++) {
      const t = this.tileAtPx(x1 + dx * i / steps, y1 + dy * i / steps);
      if (t === 2 || (bullet && t === 3)) return false;
    }
    for (const d of this.doors) { const e = this.doorEnd(d); if (segInt(x1, y1, x2, y2, d.hx, d.hy, e.x, e.y)) return false; }
    return true;
  },
  // ---------- movement & collision
  moveCircle(o, dx, dy, isPlayer) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6));
    let hit = false;
    for (let s = 0; s < steps; s++) {
      o.x += dx / steps; o.y += dy / steps;
      const r = o.r, tx0 = Math.floor((o.x - r) / T), tx1 = Math.floor((o.x + r) / T), ty0 = Math.floor((o.y - r) / T), ty1 = Math.floor((o.y + r) / T);
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        if (!this.solid(tx, ty)) continue;
        const cx = clamp(o.x, tx * T, tx * T + T), cy = clamp(o.y, ty * T, ty * T + T);
        let ddx = o.x - cx, ddy = o.y - cy; const d = Math.hypot(ddx, ddy);
        if (d < r) {
          hit = true;
          if (d === 0) { ddx = o.x - (tx * T + T / 2); ddy = o.y - (ty * T + T / 2); const l = Math.hypot(ddx, ddy) || 1; o.x += ddx / l * r * 0.5; o.y += ddy / l * r * 0.5; }
          else { o.x += ddx / d * (r - d); o.y += ddy / d * (r - d); }
        }
      }
      this.collideDoors(o, isPlayer);
    }
    return hit;
  },
  collideDoors(o, isPlayer) {
    for (const d of this.doors) {
      const e = this.doorEnd(d);
      const c = closestOnSeg(o.x, o.y, d.hx, d.hy, e.x, e.y);
      const dist = Math.hypot(o.x - c.x, o.y - c.y), min = o.r + 3;
      if (dist < min && dist > 0.001) {
        const nx = (o.x - c.x) / dist, ny = (o.y - c.y) / dist;
        o.x += nx * (min - dist); o.y += ny * (min - dist);
        if (c.t > 0.08) {
          const cross = Math.cos(d.ang) * (o.y - d.hy) - Math.sin(d.ang) * (o.x - d.hx);
          const side = cross > 0 ? 1 : -1, mag = isPlayer ? 10 : 4;
          if (Math.abs(d.av) < 1.5 && isPlayer) AudioSys.sfx('door');
          if (Math.sign(d.av) !== -side || Math.abs(d.av) < mag) d.av = -side * mag;
          d.pusher = isPlayer ? 'player' : 'enemy'; d.pushT = 0.35;
        }
      }
    }
  },
  updateDoors(dt) {
    for (const d of this.doors) {
      d.ang += d.av * dt;
      if (d.ang < d.min) { d.ang = d.min; d.av = -d.av * 0.25; } if (d.ang > d.max) { d.ang = d.max; d.av = -d.av * 0.25; }
      d.av *= Math.exp(-3.2 * dt); d.pushT -= dt;
      if (Math.abs(d.av) > 2.5 && d.pusher === 'player' && d.pushT > -0.2) {
        const e = this.doorEnd(d);
        for (const en of this.enemies) {
          if (en.state === 'dead' || en.state === 'down') continue;
          const c = closestOnSeg(en.x, en.y, d.hx, d.hy, e.x, e.y);
          if (c.t > 0.15 && Math.hypot(en.x - c.x, en.y - c.y) < en.r + 4) {
            const a = Math.atan2(en.y - d.hy, en.x - d.hx);
            if (en.kind === 'heavy' || en.kind === 'boss') { d.av = -d.av * 0.5; AudioSys.sfx('door'); }
            else if (this.mask === 'breaker') { AudioSys.sfx('doorHit'); this.kill(en, 'melee', a); d.av *= 0.6; }
            else { this.knockDown(en, a, 'door'); AudioSys.sfx('doorHit'); this.addScore(100, en.x, en.y, false); this.shakeIt(6); d.av *= 0.6; }
          }
        }
      }
    }
  },
  // ---------- pathfinding (BFS, 8-dir)
  bfs(sx, sy, gx, gy, maxNodes) {
    const W = this.W, H = this.H; if (!this.passable(gx, gy)) return null;
    const prev = new Int32Array(W * H).fill(-1); const start = sy * W + sx, goal = gy * W + gx;
    const q = [start]; prev[start] = start; let qi = 0;
    while (qi < q.length) {
      const cur = q[qi++]; if (cur === goal) break; if (maxNodes && qi > maxNodes) return null;
      const cx = cur % W, cy = (cur / W) | 0;
      for (let k = 0; k < 8; k++) {
        const dx = [1, -1, 0, 0, 1, 1, -1, -1][k], dy = [0, 0, 1, -1, 1, -1, 1, -1][k];
        const nx = cx + dx, ny = cy + dy; if (!this.passable(nx, ny)) continue;
        if (dx && dy && (!this.passable(cx + dx, cy) || !this.passable(cx, cy + dy))) continue;
        const ni = ny * W + nx; if (prev[ni] !== -1) continue; prev[ni] = cur; q.push(ni);
      }
    }
    if (prev[goal] === -1) return null;
    const path = []; let c = goal; while (c !== start) { path.push({ x: (c % W) * T + T / 2, y: ((c / W) | 0) * T + T / 2 }); c = prev[c]; }
    return path.reverse();
  },
  pathTo(e, x, y) {
    const p = this.bfs(Math.floor(e.x / T), Math.floor(e.y / T), Math.floor(x / T), Math.floor(y / T), 3000);
    e.path = p || []; if (p && p.length) { p[p.length - 1] = { x, y }; }
  },
  followPath(e, speed, dt, face) {
    if (!e.path.length) return true;
    const n = e.path[0]; const dx = n.x - e.x, dy = n.y - e.y, d = Math.hypot(dx, dy);
    if (d < 6) { e.path.shift(); return !e.path.length; }
    // skip ahead if next node visible
    if (e.path.length > 1 && this.clearLine(e.x, e.y, e.path[1].x, e.path[1].y) && d < 20) e.path.shift();
    const a = Math.atan2(dy, dx);
    if (face !== false) e.ang = turnTo(e.ang, a, 10 * dt);
    const ox = e.x, oy = e.y;
    this.moveCircle(e, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt, false);
    e.walk += speed * dt;
    if (Math.hypot(e.x - ox, e.y - oy) < speed * dt * 0.2) { e.stuckT += dt; if (e.stuckT > 0.8) { e.path = []; e.stuckT = 0; } } else e.stuckT = 0;
    return false;
  },
  randomPatrolTarget(e) {
    const W = this.W; const sx = Math.floor(e.home.x / T), sy = Math.floor(e.home.y / T);
    const seen = new Set([sy * W + sx]); let frontier = [[sx, sy]]; const cands = [];
    for (let depth = 0; depth < 7; depth++) {
      const nf = [];
      for (const [x, y] of frontier) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = ny * W + nx; if (seen.has(k) || !this.passable(nx, ny)) continue;
        seen.add(k); nf.push([nx, ny]); if (depth > 1) cands.push([nx, ny]);
      }
      frontier = nf;
    }
    if (!cands.length) return null;
    const c = cands[Math.floor(Math.random() * cands.length)]; return { x: c[0] * T + T / 2, y: c[1] * T + T / 2 };
  },
  // ---------- events
  addScore(pts, x, y, isKill) {
    let mult = 1;
    if (isKill) {
      this.combo = this.comboTimer > 0 ? this.combo + 1 : 1; this.comboTimer = 3.2; this.maxCombo = Math.max(this.maxCombo, this.combo);
      mult = Math.min(this.combo, 8); if (this.combo > 1) AudioSys.sfx('combo');
    }
    const total = pts * mult; this.score += total;
    this.floaters.push({ x, y: y - 10, text: '+' + total + (mult > 1 ? '  x' + mult : ''), life: 1.2, col: mult > 1 ? '#ffe14a' : '#ffffff' });
  },
  shakeIt(v) { this.shake = Math.max(this.shake, v * Settings.shake); },
  makeNoise(x, y, radius) {
    for (const e of this.enemies) {
      if (e.state === 'dead' || e.state === 'down' || e.state === 'chase') continue;
      if (Math.hypot(e.x - x, e.y - y) < radius) { e.state = 'investigate'; e.target = { x, y }; e.searchT = 3; this.pathTo(e, x, y); e.pathT = 0; }
    }
  },
  dropWeapon(e, ang) {
    if (!e.weapon || e.kind === 'boss') return;
    const w = WEAPONS[e.weapon];
    this.thrown.push({ type: e.weapon, ammo: w.gun ? Math.floor(w.ammo * rand(0.4, 1)) : 0, x: e.x, y: e.y, vx: Math.cos(ang) * 160, vy: Math.sin(ang) * 160, rot: 0, spin: 10, owner: 'drop', hitOnce: true });
    e.weapon = null;
  },
  knockDown(e, ang, how) {
    if (e.state === 'dead' || e.kind === 'heavy') return;
    if (e.kind === 'boss') { this.damageBoss(e, ang, 1); return; }
    e.state = 'down'; e.downT = how === 'door' ? 3.2 : 2.6; e.vx = Math.cos(ang) * 170; e.vy = Math.sin(ang) * 170; e.downAng = ang; e.windup = 0;
    this.dropWeapon(e, ang + rand(-1, 1));
    this.bleed(e.x, e.y, ang, 3, 0.4); AudioSys.sfx('punch'); Input.rumble(0.25, 0.6, 90);
  },
  kill(e, how, ang) {
    if (e.state === 'dead') return;
    if (e.kind === 'boss' && how !== 'exec') { this.damageBoss(e, ang, how === 'bullet' ? 1 : 1); return; }
    if (e.kind === 'heavy' && !(how === 'bullet' || how === 'exec')) return;
    e.state = 'dead'; e.vx = Math.cos(ang) * (how === 'bullet' ? 300 : 180); e.vy = Math.sin(ang) * (how === 'bullet' ? 300 : 180); e.deadAng = ang; e.corpseVariant = Math.floor(Math.random() * 3);
    this.dropWeapon(e, ang + rand(-0.8, 0.8));
    this.bleed(e.x, e.y, ang, how === 'exec' ? 16 : 10, 1);
    this.kills++; e.deadT = 0; Input.rumble(0.55, 0.35, 140);
    AudioSys.sfx('splat'); this.shakeIt(how === 'bullet' ? 4 : 7);
    const base = { melee: 400, bullet: 300, exec: 600, throw: 500 }[how] || 300;
    if (this.mask === 'chrono' && this.comboTimer > 0) { this.slow = 1.8; }
    this.addScore(e.kind === 'boss' ? 5000 : e.kind === 'heavy' ? base + 300 : base, e.x, e.y, true);
    for (let i = 0; i < 14; i++) this.particles.push({ x: e.x, y: e.y, vx: Math.cos(ang + rand(-0.7, 0.7)) * rand(60, 320), vy: Math.sin(ang + rand(-0.7, 0.7)) * rand(60, 320), life: rand(0.3, 0.7), max: 0.7, col: '#b3001b', size: rand(1.5, 3.5), blood: true });
    if (!this.cleared && this.enemies.every(x => x.state === 'dead')) { this.cleared = true; AudioSys.sfx('clear'); }
  },
  damageBoss(e, ang, dmg) {
    if (e.state === 'dead' || e.state === 'down' || e.flash > 0) return;
    e.hp -= (e.stun > 0 ? dmg * 2 : dmg); e.flash = 0.45; e.vx = Math.cos(ang) * 200; e.vy = Math.sin(ang) * 200;
    AudioSys.sfx('bossHit'); this.shakeIt(8); this.bleed(e.x, e.y, ang, 5, 0.6);
    if (e.state !== 'chase') { e.state = 'chase'; e.react = 0.3; }
    if (e.hp <= 0) { e.state = 'down'; e.downT = Infinity; e.downAng = ang; e.charge = 0; e.tele = 0; this.floaters.push({ x: e.x, y: e.y - 30, text: '!!!', life: 2, col: '#ff2a6d' }); }
  },
  killPlayer(ang) {
    const p = this.player; if (!p.alive || this.status !== 'play') return;
    p.alive = false; p.deadAng = ang; p.exec = null; this.status = 'dead'; p.deadT = 0; Input.rumble(1, 1, 500);
    this.bleed(p.x, p.y, ang, 12, 1); AudioSys.sfx('death'); this.shakeIt(12); this.flash = 0.3; AudioSys.muffle(true);
  },
  bleed(x, y, ang, n, size) {
    const b = this.bloodCtx;
    for (let i = 0; i < n; i++) {
      const a = ang + rand(-0.6, 0.6), d = rand(0, 34) * size;
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      if (this.tileAtPx(px, py) !== 1) continue;
      b.fillStyle = Math.random() < 0.5 ? 'rgba(140,0,20,0.85)' : 'rgba(100,0,15,0.8)';
      b.beginPath(); b.ellipse(px, py, rand(2, 7) * size + 1, rand(2, 5) * size + 1, a, 0, Math.PI * 2); b.fill();
    }
    if (size >= 1 && this.tileAtPx(x, y) === 1) { b.fillStyle = 'rgba(120,0,18,0.9)'; b.beginPath(); b.ellipse(x + Math.cos(ang) * 6, y + Math.sin(ang) * 6, 14, 10, ang, 0, Math.PI * 2); b.fill(); }
  },
  breakGlass(tx, ty) {
    if (this.tileAt(tx, ty) !== 3) return;
    this.tiles[ty * this.W + tx] = 1;
    const x = tx * T, y = ty * T;
    this.wallCtx.clearRect(x, y, T, T);
    drawFloorTile(this.floorCtx, this.style[ty * this.W + tx], tx, ty);
    const f = this.floorCtx; f.strokeStyle = 'rgba(190,240,255,0.7)'; f.lineWidth = 1;
    for (let i = 0; i < 9; i++) { const sx = x + rand(0, T), sy = y + rand(0, T), a = rand(0, 6); f.beginPath(); f.moveTo(sx, sy); f.lineTo(sx + Math.cos(a) * 4, sy + Math.sin(a) * 4); f.stroke(); }
    for (let i = 0; i < 14; i++) this.particles.push({ x: x + T / 2, y: y + T / 2, vx: rand(-200, 200), vy: rand(-200, 200), life: rand(0.3, 0.6), max: 0.6, col: '#bff4ff', size: rand(1, 2.5) });
    AudioSys.sfx('glass'); this.makeNoise(x + T / 2, y + T / 2, 220);
  },
  // ---------- player actions
  shoot(owner, x, y, ang, wtype) {
    const w = WEAPONS[wtype];
    for (let i = 0; i < w.pellets; i++) {
      const a = ang + rand(-w.spread, w.spread) * (w.pellets > 1 ? 1 : (owner === 'player' ? 1 : 1.6));
      const sp = owner === 'player' ? rand(1300, 1500) : rand(780, 880) * (w.pellets > 1 ? 1.1 : 1);
      this.bullets.push({ x: x + Math.cos(ang) * 14, y: y + Math.sin(ang) * 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, owner, life: w.pellets > 1 ? 0.35 : 1.2, px: x, py: y });
    }
    this.particles.push({ x: x + Math.cos(ang) * 16, y: y + Math.sin(ang) * 16, vx: 0, vy: 0, life: 0.06, max: 0.06, col: '#fff3a0', size: 9, glow: true });
    this.particles.push({ x, y, vx: Math.cos(ang + Math.PI / 2) * rand(60, 120), vy: Math.sin(ang + Math.PI / 2) * rand(60, 120), life: 0.5, max: 0.5, col: '#e8c050', size: 1.6, casing: true });
  },
  playerAttack() {
    const p = this.player, wt = p.weapon ? p.weapon.type : 'fists', w = WEAPONS[wt];
    if (p.cd > 0) return;
    if (w.gun) {
      if (p.weapon.ammo <= 0) { if (Input.attackPressed()) { AudioSys.sfx('click'); this.floaters.push({ x: p.x, y: p.y - 18, text: L('empty'), life: 0.6, col: '#ff6' }); p.cd = 0.2; } return; }
      if (!w.auto && !Input.attackPressed()) return;
      p.weapon.ammo--; p.cd = w.cd; p.muzzle = 0.06;
      this.shoot('player', p.x, p.y, p.ang, wt); AudioSys.sfx(w.snd); this.shakeIt(w.shake); if (this.mask !== 'hush') this.makeNoise(p.x, p.y, w.noise);
      Input.rumble(wt === 'shotgun' ? 0.7 : 0.15, wt === 'shotgun' ? 0.5 : 0.35, wt === 'shotgun' ? 160 : 50);
      return;
    }
    if (!Input.attackPressed()) return;
    // execution via attack when standing over a downed enemy
    const downed = this.nearestDowned(); if (downed) { this.startExec(downed); return; }
    p.cd = w.cd; p.swing = 1; p.swingDir *= -1; AudioSys.sfx('swing');
    let hits = 0;
    for (const e of this.enemies) {
      if (e.state === 'dead' || e.state === 'down') continue;
      const range = w.range * (this.mask === 'reach' ? 1.5 : 1);
      const d = Math.hypot(e.x - p.x, e.y - p.y); if (d > range + e.r) continue;
      const a = Math.atan2(e.y - p.y, e.x - p.x); if (Math.abs(angDiff(a, p.ang)) > w.arc && d > e.r + p.r + 2) continue;
      if (!this.clearLine(p.x, p.y, e.x, e.y)) continue;
      hits++;
      if (e.kind === 'heavy') { AudioSys.sfx('clang'); e.vx = Math.cos(a) * 60; e.vy = Math.sin(a) * 60; if (e.state !== 'chase') { e.state = 'chase'; e.react = 0.2; } continue; }
      if (!w.kill) { this.knockDown(e, a, 'punch'); this.addScore(50, e.x, e.y, false); }
      else { AudioSys.sfx('hit'); this.kill(e, 'melee', a); }
      Input.rumble(0.4, 0.3, 80);
      if (hits >= 2) break;
    }
    // break glass with melee
    const gx = Math.floor((p.x + Math.cos(p.ang) * 26) / T), gy = Math.floor((p.y + Math.sin(p.ang) * 26) / T); if (this.tileAt(gx, gy) === 3) this.breakGlass(gx, gy);
    this.makeNoise(p.x, p.y, 90);
  },
  nearestDowned() {
    const p = this.player; let best = null, bd = 42;
    for (const e of this.enemies) if (e.state === 'down') { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
    return best;
  },
  startExec(e) {
    const p = this.player; const wt = p.weapon ? p.weapon.type : 'fists';
    const gun = WEAPONS[wt].gun && p.weapon.ammo > 0;
    p.exec = { e, t: 0, dur: e.kind === 'boss' ? 1.4 : gun ? 0.35 : wt === 'fists' ? 1.0 : 0.6, hits: 0, gun };
    p.x = e.x - Math.cos(e.downAng || 0) * 6; p.y = e.y - Math.sin(e.downAng || 0) * 6;
  },
  updateExec(dt) {
    const p = this.player, x = p.exec; x.t += dt;
    p.ang = Math.atan2(x.e.y - p.y, x.e.x - p.x);
    const interval = x.gun ? 0.3 : 0.2;
    if (x.t > (x.hits + 1) * interval && x.t < x.dur) {
      x.hits++; p.swing = 1; p.swingDir *= -1;
      if (x.gun) { p.weapon.ammo--; AudioSys.sfx(WEAPONS[p.weapon.type].snd); if (this.mask !== 'hush') this.makeNoise(p.x, p.y, 400); } else AudioSys.sfx(p.weapon ? 'hit' : 'punch');
      this.bleed(x.e.x, x.e.y, rand(0, 6), 4, 0.6); this.shakeIt(4);
      for (let i = 0; i < 6; i++) this.particles.push({ x: x.e.x, y: x.e.y, vx: rand(-150, 150), vy: rand(-150, 150), life: 0.4, max: 0.4, col: '#b3001b', size: 2.5, blood: true });
    }
    if (x.t >= x.dur) { this.kill(x.e, 'exec', p.ang); p.exec = null; }
  },
  throwWeapon() {
    const p = this.player; if (!p.weapon) return;
    this.thrown.push({ vaulted: p.weapon.vaulted, type: p.weapon.type, ammo: p.weapon.ammo, x: p.x + Math.cos(p.ang) * 10, y: p.y + Math.sin(p.ang) * 10, vx: Math.cos(p.ang) * 820, vy: Math.sin(p.ang) * 820, rot: 0, spin: 22, owner: 'player' });
    p.weapon = null; p.cd = 0.15; AudioSys.sfx('throw');
  },
  nearestPickup() {
    const p = this.player; let best = null, bd = 34;
    for (const k of this.pickups) { const d = Math.hypot(k.x - p.x, k.y - p.y); if (d < bd) { bd = d; best = k; } }
    return best;
  },
  pickUp() {
    const p = this.player, k = this.nearestPickup(); if (!k) return false;
    this.pickups.splice(this.pickups.indexOf(k), 1);
    if (p.weapon) this.pickups.push({ type: p.weapon.type, ammo: p.weapon.ammo, x: p.x, y: p.y, rot: Math.random() * 6, vaulted: p.weapon.vaulted });
    let ammo = k.ammo; if (this.mask === 'vault' && WEAPONS[k.type].gun && !k.vaulted) { ammo += Math.round(WEAPONS[k.type].ammo * 0.5); }
    p.weapon = { type: k.type, ammo, vaulted: true }; AudioSys.sfx('pickup'); return true;
  },
  // ---------- update
  update(dt) {
    this.time += dt;
    const p = this.player;
    if (this.status === 'play' || this.status === 'dead') this.levelTime += this.status === 'play' ? dt : 0;
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }
    this.shake *= Math.exp(-10 * dt); if (this.flash > 0) this.flash -= dt;
    // camera / aim
    this.updateAim(dt);
    if (this.status === 'play' && p.alive) {
      if (p.exec) this.updateExec(dt);
      else {
        const mv = Input.moveVec(); const sp = 215 * (this.mask === 'comet' ? 1.25 : 1);
        const ox = p.x, oy = p.y;
        p.rollCd -= dt;
        if (Input.dodgePressed() && p.rollCd <= 0 && p.roll <= 0) { p.roll = 0.34; p.rollCd = 0.75; p.rollAng = Math.hypot(mv.x, mv.y) > 0.2 ? Math.atan2(mv.y, mv.x) : p.ang; AudioSys.sfx('throw'); Input.rumble(0.1, 0.3, 80); }
        if (p.roll > 0) { p.roll -= dt; this.moveCircle(p, Math.cos(p.rollAng) * 410 * dt, Math.sin(p.rollAng) * 410 * dt, true); }
        else this.moveCircle(p, mv.x * sp * dt, mv.y * sp * dt, true);
        p.walk += Math.hypot(p.x - ox, p.y - oy);
        p.cd -= dt;
        // pickup / throw
        const right = Input.rightPressed();
        if (Input.pickupPressed()) this.pickUp();
        if (right) { if (p.weapon) this.throwWeapon(); else this.pickUp(); }
        if (Input.throwPressed()) { if (p.weapon) this.throwWeapon(); }
        if (Input.executePressed()) { const d = this.nearestDowned(); if (d) this.startExec(d); }
        if (!p.exec && (Input.attackHeld() || Input.attackPressed())) this.playerAttack();
      }
      if (p.swing > 0) p.swing -= dt * 5;
      if (p.muzzle > 0) p.muzzle -= dt;
      // exit
      if (this.cleared && Math.hypot(p.x - this.exit.x, p.y - this.exit.y) < 22) this.reachExit();
    }
    if (this.slow > 0) this.slow -= dt;
    const edt = this.slow > 0 ? dt * 0.4 : dt;
    for (const e of this.enemies) { this.updateEnemy(e, edt); if (e.state === 'dead') e.deadT = (e.deadT || 0) + dt; }
    if (!p.alive) p.deadT = (p.deadT || 0) + dt;
    // separation
    const en = this.enemies;
    for (let i = 0; i < en.length; i++) for (let j = i + 1; j < en.length; j++) {
      const a = en[i], b = en[j]; if (a.state === 'dead' || b.state === 'dead' || a.state === 'down' || b.state === 'down') continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
      if (d < m && d > 0.01) { const push = (m - d) / 2; a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push; }
    }
    this.updateDoors(dt);
    this.updateBullets(edt);
    this.updateThrown(dt);
    for (const pt of this.particles) {
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= Math.exp(-5 * dt); pt.vy *= Math.exp(-5 * dt); pt.life -= dt;
      if (pt.life <= 0 && pt.blood && this.tileAtPx(pt.x, pt.y) === 1) { this.bloodCtx.fillStyle = 'rgba(130,0,18,0.8)'; this.bloodCtx.beginPath(); this.bloodCtx.arc(pt.x, pt.y, pt.size, 0, 7); this.bloodCtx.fill(); }
      if (pt.life <= 0 && pt.casing && this.tileAtPx(pt.x, pt.y) === 1) { this.bloodCtx.fillStyle = '#c9a040'; this.bloodCtx.fillRect(pt.x, pt.y, 2, 3); }
    }
    this.particles = this.particles.filter(pt => pt.life > 0);
    for (const f of this.floaters) { f.life -= dt; f.y -= 24 * dt; }
    this.floaters = this.floaters.filter(f => f.life > 0);
  },
  updateAim(dt) {
    const p = this.player, look = Input.lookHeld();
    let offX = 0, offY = 0;
    if (Input.mode === 'pad') {
      const ax = Input.axes[2], ay = Input.axes[3], mag = Math.hypot(ax, ay);
      let target = null;
      if (mag > 0.3) target = Math.atan2(ay, ax);
      else { const mv = Input.moveVec(); if (Math.hypot(mv.x, mv.y) > 0.3) target = Math.atan2(mv.y, mv.x); }
      if (target !== null && p.alive && !p.exec) {
        // light aim assist: snap toward nearest visible enemy near stick direction
        if (Settings.aimAssist) {
          let best = null, bd = 0.32;
          for (const e of this.enemies) {
            if (e.state === 'dead' || e.state === 'down') continue;
            const d = Math.hypot(e.x - p.x, e.y - p.y); if (d > 430) continue;
            const a = Math.atan2(e.y - p.y, e.x - p.x), df = Math.abs(angDiff(a, target));
            if (df < bd && this.clearLine(p.x, p.y, e.x, e.y)) { bd = df; best = a; }
          }
          if (best !== null) target = target + angDiff(best, target) * 0.7;
        }
        p.ang = turnTo(p.ang, target, 25 * dt);
      }
      const lookDist = look ? 260 : (mag > 0.3 ? 70 : 30);
      offX = Math.cos(p.ang) * lookDist; offY = Math.sin(p.ang) * lookDist;
      this.aimWorld = { x: p.x + Math.cos(p.ang) * 120, y: p.y + Math.sin(p.ang) * 120 };
    } else {
      const sw = 1280, sh = 720;
      const mx = (Input.mouse.x - sw / 2) / ZOOM + this.cam.x, my = (Input.mouse.y - sh / 2) / ZOOM + this.cam.y;
      this.aimWorld = { x: mx, y: my };
      if (p.alive && !p.exec) p.ang = Math.atan2(my - p.y, mx - p.x);
      const sx = (Input.mouse.x - sw / 2) / ZOOM, sy = (Input.mouse.y - sh / 2) / ZOOM;
      const k = look ? 0.9 : 0.3; offX = sx * k; offY = sy * k;
    }
    const tx = p.x + offX, ty = p.y + offY;
    const lerp = 1 - Math.exp(-(look ? 5 : 8) * dt);
    this.cam.x += (tx - this.cam.x) * lerp; this.cam.y += (ty - this.cam.y) * lerp;
  },
  reachExit() {
    if (this.isLastFloor()) { this.status = 'complete'; AudioSys.sfx('grade'); if (typeof UI !== "undefined") UI.onLevelComplete(); }
    else { this.floorIdx++; this.loadFloor(); }
  },
  updateBullets(dt) {
    const p = this.player;
    for (const b of this.bullets) {
      b.life -= dt; if (b.life <= 0) { b.dead = true; continue; }
      const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      const steps = Math.ceil(Math.hypot(nx - b.x, ny - b.y) / 5);
      const sx = b.x, sy = b.y;
      b.px = b.x; b.py = b.y;
      for (let s = 1; s <= steps && !b.dead; s++) {
        const x = sx + (nx - sx) * s / steps, y = sy + (ny - sy) * s / steps;
        const tx = Math.floor(x / T), ty = Math.floor(y / T), t = this.tileAt(tx, ty);
        if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) { b.dead = true; break; }
        if (t === 2) { b.dead = true; for (let i = 0; i < 4; i++) this.particles.push({ x, y, vx: rand(-120, 120), vy: rand(-120, 120), life: 0.2, max: 0.2, col: '#ffd27a', size: 1.5 }); break; }
        if (t === 3) this.breakGlass(tx, ty);
        for (const d of this.doors) { const e = this.doorEnd(d); if (segInt(b.x, b.y, x, y, d.hx, d.hy, e.x, e.y)) { b.dead = true; d.av += (Math.random() - 0.5) * 2; AudioSys.sfx('door'); break; } }
        if (b.dead) break;
        const a = Math.atan2(b.vy, b.vx);
        if (b.owner === 'player') {
          for (const e of this.enemies) {
            if (e.state === 'dead') continue;
            if (Math.hypot(e.x - x, e.y - y) < e.r + 2) { b.dead = true; this.kill(e, 'bullet', a); break; }
          }
        } else if (p.alive && p.roll <= 0 && Math.hypot(p.x - x, p.y - y) < p.r + 1) {
          b.dead = true;
          if (p.shield > 0) { p.shield--; this.flash = 0.25; AudioSys.sfx('clang'); Input.rumble(0.6, 0.6, 200); this.floaters.push({ x: p.x, y: p.y - 20, text: 'AEGIS', life: 1, col: '#bfe3ff' }); for (let i = 0; i < 10; i++) this.particles.push({ x: p.x, y: p.y, vx: rand(-160, 160), vy: rand(-160, 160), life: 0.4, max: 0.4, col: '#bfe3ff', size: 2 }); }
          else this.killPlayer(a);
        }
        b.x = x; b.y = y;
      }
    }
    this.bullets = this.bullets.filter(b => !b.dead);
  },
  updateThrown(dt) {
    for (const k of this.thrown) {
      const sp = Math.hypot(k.vx, k.vy);
      const steps = Math.max(1, Math.ceil(sp * dt / 5));
      for (let s = 0; s < steps; s++) {
        const ox = k.x, oy = k.y;
        k.x += k.vx * dt / steps; k.y += k.vy * dt / steps;
        const tx = Math.floor(k.x / T), ty = Math.floor(k.y / T), t = this.tileAt(tx, ty);
        if (t === 3 && Math.hypot(k.vx, k.vy) > 300) { this.breakGlass(tx, ty); k.vx *= 0.6; k.vy *= 0.6; }
        else if (t === 2 || t === 3 || t === 0 || t === 4) {
          if (t === 0 || t === 4) { if (!this.solidForItems(tx, ty)) continue; }
          // bounce
          const otx = Math.floor(ox / T), oty = Math.floor(oy / T);
          if (otx !== tx) k.vx = -k.vx * 0.35; if (oty !== ty) k.vy = -k.vy * 0.35;
          k.x = ox; k.y = oy; if (Math.hypot(k.vx, k.vy) > 120) AudioSys.sfx('clang');
          k.hitOnce = true; break;
        }
        for (const d of this.doors) { const e = this.doorEnd(d); if (segInt(ox, oy, k.x, k.y, d.hx, d.hy, e.x, e.y)) { k.x = ox; k.y = oy; k.vx *= -0.3; k.vy *= -0.3; k.hitOnce = true; break; } }
        if (!k.hitOnce && k.owner === 'player' && Math.hypot(k.vx, k.vy) > 250) {
          for (const e of this.enemies) {
            if (e.state === 'dead' || e.state === 'down') continue;
            if (Math.hypot(e.x - k.x, e.y - k.y) < e.r + 5) {
              const a = Math.atan2(k.vy, k.vx); k.hitOnce = true;
              if (e.kind === 'heavy') { AudioSys.sfx('clang'); }
              else if (e.kind === 'boss') this.damageBoss(e, a, 1);
              else if (WEAPONS[k.type].throwKill || this.mask === 'dart') { AudioSys.sfx('hit'); this.kill(e, 'throw', a); }
              else { this.knockDown(e, a, 'throw'); this.addScore(100, e.x, e.y, false); }
              k.vx *= -0.25; k.vy *= -0.25; break;
            }
          }
        }
      }
      const f = Math.exp(-(k.hitOnce ? 6 : 1.4) * dt); k.vx *= f; k.vy *= f; k.rot += k.spin * dt * Math.min(1, Math.hypot(k.vx, k.vy) / 300);
      if (Math.hypot(k.vx, k.vy) < 30) { k.done = true; this.pickups.push({ type: k.type, ammo: k.ammo, x: k.x, y: k.y, rot: k.rot, vaulted: k.vaulted }); }
    }
    this.thrown = this.thrown.filter(k => !k.done);
  },
  solidForItems(tx, ty) { return true; },
  // ---------- enemy AI
  canSee(e) {
    const p = this.player; if (!p.alive) return false;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    if (d > (e.kind === 'boss' ? 600 : 400)) return false;
    const fov = e.state === 'chase' ? Math.PI : 1.15;
    if (d > 46 && Math.abs(angDiff(Math.atan2(dy, dx), e.ang)) > fov) return false;
    return this.clearLine(e.x, e.y, p.x, p.y);
  },
  updateEnemy(e, dt) {
    if (e.flash > 0) e.flash -= dt;
    if (e.state === 'dead' || e.state === 'down') {
      if (e.vx || e.vy) { this.moveCircle(e, e.vx * dt, e.vy * dt, false); const f = Math.exp(-7 * dt); e.vx *= f; e.vy *= f; if (Math.abs(e.vx) + Math.abs(e.vy) < 3) e.vx = e.vy = 0; }
      if (e.state === 'down') {
        const beingExec = this.player.exec && this.player.exec.e === e;
        if (!beingExec) e.downT -= dt;
        if (e.downT <= 0) {
          e.state = 'chase'; e.react = 0.6; e.lastSeen = { x: this.player.x, y: this.player.y }; e.path = [];
          // grab a nearby weapon
          let best = null, bd = 70; for (const k of this.pickups) { const d = Math.hypot(k.x - e.x, k.y - e.y); if (d < bd) { bd = d; best = k; } }
          if (best && e.kind !== 'dog') { this.pickups.splice(this.pickups.indexOf(best), 1); e.weapon = best.type; e.kind = WEAPONS[best.type].gun ? 'gun' : 'melee'; }
        }
      }
      return;
    }
    if (e.vx || e.vy) { this.moveCircle(e, e.vx * dt, e.vy * dt, false); const f = Math.exp(-8 * dt); e.vx *= f; e.vy *= f; if (Math.abs(e.vx) + Math.abs(e.vy) < 3) e.vx = e.vy = 0; }
    if (e.swing > 0) e.swing -= dt * 5;
    if (e.kind === 'boss') return this.updateBoss(e, dt);
    const p = this.player;
    const sees = this.canSee(e);
    if (sees) {
      if (e.state !== 'chase') { e.state = 'chase'; e.react = e.kind === 'dog' ? 0.12 : rand(0.32, 0.55); if (e.kind === 'dog') AudioSys.sfx('bark'); else if (Math.random() < 0.5) AudioSys.sfx('grunt'); }
      e.lastSeen = { x: p.x, y: p.y }; e.lostT = 0;
    }
    switch (e.state) {
      case 'idle':
        e.idleT -= dt; if (e.idleT <= 0) { e.idleT = rand(1.5, 4); e.lookAng = e.homeAng + rand(-1.2, 1.2); }
        if (e.lookAng !== undefined) e.ang = turnTo(e.ang, e.lookAng, 1.5 * dt);
        if (Math.hypot(e.x - e.home.x, e.y - e.home.y) > 8) { e.state = 'return'; this.pathTo(e, e.home.x, e.home.y); }
        break;
      case 'patrol':
        if (!e.path.length) { e.idleT -= dt; if (e.idleT <= 0) { const t = this.randomPatrolTarget(e); if (t) this.pathTo(e, t.x, t.y); e.idleT = rand(0.5, 2); } }
        else this.followPath(e, e.patrolSpeed, dt);
        break;
      case 'investigate':
        if (e.path.length) { this.followPath(e, e.speed * 0.7, dt); }
        else { e.searchT -= dt; e.ang += Math.sin(this.time * 2 + e.seed) * 2.5 * dt; if (e.searchT <= 0) { e.state = 'return'; this.pathTo(e, e.home.x, e.home.y); } }
        break;
      case 'return':
        if (this.followPath(e, e.patrolSpeed * 1.3, dt) || !e.path.length) { e.state = e.patrol ? 'patrol' : 'idle'; e.lookAng = e.homeAng; e.path = []; }
        break;
      case 'chase': this.chase(e, sees, dt); break;
    }
  },
  chase(e, sees, dt) {
    const p = this.player; const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (!p.alive) { e.ang = turnTo(e.ang, a, 3 * dt); return; }
    if (sees) {
      if (e.react > 0) { e.react -= dt; e.ang = turnTo(e.ang, a, 6 * dt); if (e.kind !== 'gun') this.moveCircle(e, Math.cos(a) * e.speed * 0.4 * dt, Math.sin(a) * e.speed * 0.4 * dt, false); return; }
      const turn = e.kind === 'dog' ? 14 : e.kind === 'heavy' ? 4 : 7;
      e.ang = turnTo(e.ang, a, turn * dt);
      if (e.kind === 'gun') {
        e.cd -= dt;
        if (d > 230) this.moveCircle(e, Math.cos(a) * e.speed * dt, Math.sin(a) * e.speed * dt, false);
        else if (d < 110) this.moveCircle(e, -Math.cos(a) * 60 * dt, -Math.sin(a) * 60 * dt, false);
        if (e.cd <= 0 && d < 360 && Math.abs(angDiff(a, e.ang)) < 0.2) {
          const w = WEAPONS[e.weapon];
          this.shoot('enemy', e.x, e.y, e.ang, e.weapon); AudioSys.sfx(w.pellets > 1 ? 'shotgun' : 'enemyShot');
          e.cd = e.weapon === 'smg' ? (e.burst = (e.burst || 0) + 1, e.burst % 5 === 0 ? 0.9 : 0.11) : e.weapon === 'shotgun' ? 1.2 : rand(0.55, 0.8);
        }
      } else {
        const reach = e.r + p.r + (e.kind === 'dog' ? 10 : 16);
        if (e.windup > 0) {
          e.windup -= dt;
          if (e.windup <= 0) {
            e.swing = 1; AudioSys.sfx(e.kind === 'dog' ? 'bark' : 'swing'); e.cd = e.kind === 'heavy' ? 1 : 0.6;
            if (d < reach + 8 && p.roll <= 0 && Math.abs(angDiff(a, e.ang)) < 1.2 && this.clearLine(e.x, e.y, p.x, p.y)) { AudioSys.sfx('hit'); this.killPlayer(a); }
          }
        } else {
          e.cd -= dt;
          if (d > reach - 4) { const sp = e.speed; this.moveCircle(e, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt, false); e.walk += sp * dt; }
          if (d < reach && e.cd <= 0) e.windup = e.kind === 'dog' ? 0.1 : e.kind === 'heavy' ? 0.32 : 0.2;
        }
      }
    } else {
      e.lostT += dt; e.pathT -= dt;
      if (e.lastSeen) {
        if (e.pathT <= 0) { this.pathTo(e, e.lastSeen.x, e.lastSeen.y); e.pathT = 0.4; }
        const sp = e.kind === 'gun' ? e.speed : e.speed * 0.9;
        const arrived = this.followPath(e, sp, dt);
        if ((arrived && Math.hypot(e.x - e.lastSeen.x, e.y - e.lastSeen.y) < 20) || e.lostT > 7) {
          // keep hunting: if player is within hearing distance, re-acquire their position
          if (Math.hypot(dx, dy) < 260 && e.lostT < 7) { e.lastSeen = { x: p.x, y: p.y }; }
          else { e.state = 'investigate'; e.searchT = 2.5; e.path = []; }
        }
      } else { e.state = 'investigate'; e.searchT = 2; }
      e.react = Math.max(e.react, 0.18);
    }
  },
  updateBoss(e, dt) {
    const p = this.player; const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const sees = this.canSee(e);
    if (e.state === 'idle') { if (sees || d < 260) { e.state = 'chase'; e.react = 0.8; AudioSys.sfx('grunt'); } return; }
    if (!p.alive) return;
    if (e.stun > 0) { e.stun -= dt; return; }
    if (e.charge > 0) {
      e.charge -= dt;
      const hit = this.moveCircle(e, Math.cos(e.chargeAng) * 540 * dt, Math.sin(e.chargeAng) * 540 * dt, false);
      if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r + 4) this.killPlayer(e.chargeAng);
      for (const o of this.enemies) if (o !== e && o.state !== 'dead' && o.state !== 'down' && Math.hypot(o.x - e.x, o.y - e.y) < e.r + o.r) this.kill(o, 'melee', e.chargeAng);
      if (hit) { e.charge = 0; e.stun = 1.4; this.shakeIt(12); AudioSys.sfx('doorHit'); this.floaters.push({ x: e.x, y: e.y - 26, text: '★', life: 1.2, col: '#ffe14a' }); }
      return;
    }
    if (e.tele > 0) { e.tele -= dt; e.ang = turnTo(e.ang, a, 3 * dt); if (e.tele <= 0) { e.charge = 0.7; e.chargeAng = e.ang; } return; }
    if (e.react > 0) { e.react -= dt; return; }
    e.cd -= dt; e.chargeCd -= dt;
    e.ang = turnTo(e.ang, a, (sees ? 3.2 : 2) * dt);
    if (sees && e.chargeCd <= 0 && d < 320) { e.tele = 0.7; e.chargeCd = rand(3.5, 5); AudioSys.sfx('charge'); return; }
    if (sees && e.cd <= 0 && d < 420 && Math.abs(angDiff(a, e.ang)) < 0.3) {
      this.shoot('enemy', e.x, e.y, e.ang, 'shotgun'); AudioSys.sfx('shotgun'); this.shakeIt(5); e.cd = e.hp <= 3 ? 1.1 : 1.6;
    }
    if (sees) { if (d > 140) this.moveCircle(e, Math.cos(a) * e.speed * dt, Math.sin(a) * e.speed * dt, false); e.walk += e.speed * dt; }
    else { e.pathT -= dt; if (e.pathT <= 0) { this.pathTo(e, p.x, p.y); e.pathT = 0.5; } this.followPath(e, e.speed, dt, false); }
  },
  // ---------- canvases
  buildCanvases() {
    const w = this.W * T, h = this.H * T;
    this.floorCv = mkCanvas(w, h); this.floorCtx = this.floorCv.getContext('2d');
    this.wallCv = mkCanvas(w, h); this.wallCtx = this.wallCv.getContext('2d');
    this.bloodCv = mkCanvas(w, h); this.bloodCtx = this.bloodCv.getContext('2d');
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const t = this.tiles[y * this.W + x];
      if (t === 1 || t === 3) drawFloorTile(this.floorCtx, this.style[y * this.W + x], x, y);
      if (t === 4) drawWater(this.floorCtx, x, y);
    }
    const wc = this.wallCtx;
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const t = this.tiles[y * this.W + x];
      if (t === 2) {
        // drop shadow
        this.floorCtx.fillStyle = 'rgba(0,0,0,0.35)'; this.floorCtx.fillRect(x * T + 5, y * T + 5, T, T);
      }
    }
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const t = this.tiles[y * this.W + x];
      if (t === 2) {
        wc.fillStyle = '#17121f'; wc.fillRect(x * T, y * T, T, T);
        wc.fillStyle = '#2a2138'; wc.fillRect(x * T + 3, y * T + 3, T - 6, T - 6);
        wc.strokeStyle = '#ff2a8a'; wc.lineWidth = 2; wc.beginPath();
        const open = (xx, yy) => this.tileAt(xx, yy) !== 2;
        if (open(x, y - 1)) { wc.moveTo(x * T, y * T + 1); wc.lineTo(x * T + T, y * T + 1); }
        if (open(x, y + 1)) { wc.moveTo(x * T, y * T + T - 1); wc.lineTo(x * T + T, y * T + T - 1); }
        if (open(x - 1, y)) { wc.moveTo(x * T + 1, y * T); wc.lineTo(x * T + 1, y * T + T); }
        if (open(x + 1, y)) { wc.moveTo(x * T + T - 1, y * T); wc.lineTo(x * T + T - 1, y * T + T); }
        wc.stroke();
      } else if (t === 3) {
        const hz = this.tileAt(x - 1, y) >= 2 && this.tileAt(x - 1, y) <= 3 || this.tileAt(x + 1, y) === 2 || this.tileAt(x + 1, y) === 3;
        wc.fillStyle = 'rgba(120,230,255,0.35)';
        if (hz) wc.fillRect(x * T, y * T + 11, T, 10); else wc.fillRect(x * T + 11, y * T, 10, T);
        wc.strokeStyle = 'rgba(220,255,255,0.9)'; wc.lineWidth = 1; wc.beginPath();
        if (hz) { wc.moveTo(x * T, y * T + 12); wc.lineTo(x * T + T, y * T + 12); wc.moveTo(x * T + 6, y * T + 18); wc.lineTo(x * T + 14, y * T + 14); }
        else { wc.moveTo(x * T + 12, y * T); wc.lineTo(x * T + 12, y * T + T); wc.moveTo(x * T + 18, y * T + 6); wc.lineTo(x * T + 14, y * T + 14); }
        wc.stroke();
      }
    }
  },
};

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function hash(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
function drawFloorTile(c, s, x, y) {
  const px = x * T, py = y * T, h = hash(x, y);
  switch (s) {
    case '_': c.fillStyle = '#26232e'; c.fillRect(px, py, T, T); c.fillStyle = 'rgba(255,255,255,0.04)'; for (let i = 0; i < 5; i++) c.fillRect(px + hash(x + i, y) * T, py + hash(x, y + i) * T, 2, 2);
      if ((x + y) % 7 === 0 && h > 0.5) { c.fillStyle = 'rgba(255,210,60,0.25)'; c.fillRect(px + 4, py + 14, 24, 4); } break;
    case '.': c.fillStyle = (x + y) % 2 ? '#d9cfb8' : '#b9ad96'; c.fillRect(px, py, T, T); c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(px, py, T, 1); c.fillRect(px, py, 1, T); break;
    case ',': c.fillStyle = '#6e2347'; c.fillRect(px, py, T, T); c.fillStyle = '#84305a'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) c.fillRect(px + i * 8 + 3, py + j * 8 + 3, 2, 2); break;
    case ':': c.fillStyle = '#7a5130'; c.fillRect(px, py, T, T); c.fillStyle = '#62401f'; for (let i = 0; i < 4; i++) { c.fillRect(px, py + i * 8, T, 1); c.fillRect(px + ((i * 13 + x * 7) % T), py + i * 8, 1, 8); } break;
    case ';': c.fillStyle = '#545a63'; c.fillRect(px, py, T, T); c.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 6; i++) c.fillRect(px + hash(x * 3 + i, y) * T, py + hash(x, y * 3 + i) * T, 2, 2); c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(px, py, T, 1); break;
    case '*': { const cols = ['#3a0f5c', '#0f3a5c', '#5c0f3a', '#14304a', '#4a1440']; c.fillStyle = cols[Math.floor(h * cols.length)]; c.fillRect(px, py, T, T); c.strokeStyle = 'rgba(255,60,200,0.35)'; c.lineWidth = 1; c.strokeRect(px + 1.5, py + 1.5, T - 3, T - 3); break; }
    default: c.fillStyle = '#888'; c.fillRect(px, py, T, T);
  }
}
function drawWater(c, x, y) { c.fillStyle = '#0b2a4a'; c.fillRect(x * T, y * T, T, T); c.strokeStyle = 'rgba(80,200,255,0.25)'; c.beginPath(); const o = hash(x, y) * 20; c.moveTo(x * T + o * 0.5, y * T + 10 + o * 0.3); c.lineTo(x * T + o * 0.5 + 10, y * T + 10 + o * 0.3); c.stroke(); }
function closestOnSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
  return { x: ax + dx * t, y: ay + dy * t, t };
}
function segInt(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3); if (d === 0) return false;
  const u = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d, v = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}
