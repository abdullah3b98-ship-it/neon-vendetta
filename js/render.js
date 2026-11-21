// ===== World rendering: pixel-art sprites on a low-res buffer, upscaled with nearest-neighbour =====
const LOW_W = 640, LOW_H = 360;
const LowCv = mkCanvas(LOW_W, LOW_H), LowCtx = LowCv.getContext('2d');
LowCtx.imageSmoothingEnabled = false;
function drawSpr(c, cv, x, y, ang, flipY, sx) {
  c.save(); c.translate(Math.round(x), Math.round(y)); c.rotate(ang); if (flipY || sx) c.scale(sx || 1, flipY ? -1 : 1);
  c.drawImage(cv, -cv.width / 2, -cv.height / 2); c.restore();
}
function walkFrame(o) { return Math.floor((o.walk || 0) / 7) % 4; }
function humanGrid(kind, weapon, o, maskId, k) {
  let pose = 'walk', frame = walkFrame(o), flip = false;
  const isGun = weapon && WEAPONS[weapon].gun;
  if (isGun) pose = 'gun';
  else if (weapon && (o.swing > 0 || o.windup > 0)) { pose = 'melee'; frame = o.windup > 0 ? 0 : o.swing > 0.66 ? 0 : o.swing > 0.33 ? 1 : 2; flip = (o.swingDir || 1) < 0; }
  else if (!weapon && (o.swing > 0 || o.windup > 0)) { pose = 'punch'; frame = (o.swingDir || 1) > 0 ? 0 : 1; }
  return { g: humanSprite(kind, weapon, pose, frame, maskId, k), flip };
}
function enemyGrid(e) {
  if (e.kind === 'dog') return { g: dogSprite(walkFrame(e)), flip: false };
  if (e.kind === 'heavy') return humanGrid('heavy', null, e, null, 1.9);
  if (e.kind === 'boss') return humanGrid('boss', 'shotgun', e, null, 2.1);
  return humanGrid(e.kind === 'gun' ? 'gun' : 'melee', e.weapon, e, null, 1.35);
}
function drawBody(c, e, kind, maskId, dead, t) {
  const variant = e.corpseVariant || 0;
  const g = corpseSprite(kind, maskId, variant, !dead);
  const a = dead ? (e.deadAng || 0) + variant * 0.35 - 0.35 : (e.downAng || 0);
  if (dead && (e.deadT || 0) < 0.18) {
    const k = (e.deadT || 0) / 0.18; drawSpr(c, charCanvas(g), e.x, e.y, a, false, 0.5 + k * 0.5);
  } else drawSpr(c, charCanvas(g), e.x, e.y, a);
  if (!dead && e.state === 'down' && isFinite(e.downT)) {
    c.fillStyle = '#ffe14a'; for (let i = 0; i < 3; i++) { const tt = t * 4 + i * 2.1; c.fillRect(Math.round(e.x + Math.cos(tt) * 10), Math.round(e.y + Math.sin(tt) * 5 - 12), 2, 2); }
  }
}
function drawCar(c, x, y, ang) {
  c.save(); c.translate(x, y); c.rotate(ang || 0);
  c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(-30, -13, 64, 30);
  c.fillStyle = '#c4187a'; c.beginPath(); c.roundRect(-32, -15, 64, 30, 8); c.fill();
  c.fillStyle = '#1a0f22'; c.beginPath(); c.roundRect(-10, -12, 26, 24, 5); c.fill();
  c.fillStyle = 'rgba(120,230,255,0.6)'; c.fillRect(14, -11, 4, 22); c.fillRect(-12, -10, 3, 20);
  c.fillStyle = '#ffffcc'; c.fillRect(29, -12, 3, 6); c.fillRect(29, 6, 3, 6);
  c.fillStyle = '#ff2a2a'; c.fillRect(-32, -12, 2, 6); c.fillRect(-32, 6, 2, 6);
  c.strokeStyle = '#ff7ac8'; c.lineWidth = 1; c.beginPath(); c.moveTo(-28, -15); c.lineTo(26, -15); c.stroke();
  c.restore();
}
G.draw = function (screenC, sw, sh) {
  const t = this.time; const c = LowCtx; const SWf = sw; sw = LOW_W; sh = LOW_H;
  // colour-cycling background (visible through void areas)
  const hue = (t * 20) % 360;
  const gr = c.createLinearGradient(0, 0, sw, sh);
  gr.addColorStop(0, `hsl(${hue},70%,18%)`); gr.addColorStop(1, `hsl(${(hue + 60) % 360},70%,10%)`);
  c.fillStyle = gr; c.fillRect(0, 0, sw, sh);
  c.save(); c.globalAlpha = 0.12; c.strokeStyle = `hsl(${(hue + 180) % 360},90%,60%)`; c.lineWidth = 18;
  const off = (t * 40) % 80; for (let i = -sh; i < sw + sh; i += 80) { c.beginPath(); c.moveTo(i + off, 0); c.lineTo(i + off - sh, sh); c.stroke(); }
  c.restore();
  const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
  c.save();
  c.translate(Math.round(sw / 2 - this.cam.x + sx), Math.round(sh / 2 - this.cam.y + sy));
  c.drawImage(this.floorCv, 0, 0); c.drawImage(this.bloodCv, 0, 0);
  // exit
  const ex = this.exit, last = this.isLastFloor();
  const exitOutdoor = this.style[ex.ty * this.W + ex.tx] === '_';
  if (exitOutdoor && last) drawCar(c, ex.x, ex.y, 0);
  else { c.save(); c.translate(ex.x, ex.y); c.fillStyle = '#111'; c.fillRect(-14, -14, 28, 28); c.fillStyle = '#444'; for (let i = 0; i < 5; i++) c.fillRect(-12, -12 + i * 5.5, 24 - i * 3, 3); c.restore(); }
  if (this.outdoorStart && this.floorIdx === 0 && !(exitOutdoor && last)) drawCar(c, this.startCar.x, this.startCar.y, 0);
  if (this.cleared) { const pulse = 0.5 + Math.sin(t * 6) * 0.5; c.strokeStyle = `rgba(63,252,255,${0.5 + pulse * 0.5})`; c.lineWidth = 2; c.strokeRect(ex.x - 18 - pulse * 4, ex.y - 18 - pulse * 4, 36 + pulse * 8, 36 + pulse * 8); }
  // pickups
  for (const k of this.pickups) drawSpr(c, weaponSprite(k.type, (Math.floor(t * 3) % 2) ? '#ffffff' : '#bff4ff'), k.x, k.y, k.rot);
  // bodies
  const p = this.player, pm = this.mask;
  for (const e of this.enemies) if (e.state === 'dead') drawBody(c, e, e.kind === 'gun' ? 'gun' : e.kind, null, true, t);
  if (!p.alive) drawBody(c, { x: p.x, y: p.y, deadAng: p.deadAng, deadT: p.deadT, corpseVariant: 1 }, 'player', pm, true, t);
  for (const e of this.enemies) if (e.state === 'down') drawBody(c, e, e.kind === 'gun' ? 'gun' : e.kind, null, false, t);
  // enemies
  for (const e of this.enemies) {
    if (e.state === 'dead' || e.state === 'down') continue;
    const s = enemyGrid(e); drawSpr(c, charCanvas(s.g, e.flash > 0 && Math.floor(e.flash * 20) % 2 === 0 ? '#ffffff' : null), e.x, e.y, e.ang, s.flip);
    if (e.windup > 0 || (e.kind === 'boss' && e.tele > 0)) { c.fillStyle = '#ff2a2a'; c.fillRect(Math.round(e.x) - 1, Math.round(e.y - e.r - 14), 2, 6); c.fillRect(Math.round(e.x) - 1, Math.round(e.y - e.r - 6), 2, 2); }
    if (e.kind === 'boss' && e.stun > 0) { c.fillStyle = '#ffe14a'; for (let i = 0; i < 4; i++) { const a = t * 5 + i * 1.6; c.fillRect(Math.round(e.x + Math.cos(a) * 18), Math.round(e.y + Math.sin(a) * 8 - 24), 2, 2); } }
  }
  if (this.lock && this.lock.state !== 'dead') { const L2 = this.lock, r = (L2.r || 10) + 6 + Math.round(Math.sin(t * 8)), x = Math.round(L2.x), y = Math.round(L2.y); c.fillStyle = '#ff2a8a';
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.fillRect(x + sx * r - (sx > 0 ? 3 : 0), y + sy * r, 4, 1); c.fillRect(x + sx * r, y + sy * r - (sy > 0 ? 3 : 0), 1, 4); } }
  if (p.alive) {
    const s = humanGrid('player', p.weapon ? p.weapon.type : null, p, pm, 1.35);
    if (p.roll > 0) drawSpr(c, charCanvas(s.g), p.x, p.y, p.rollAng + (1 - p.roll / 0.34) * Math.PI * 2, false, 0.8);
    else drawSpr(c, charCanvas(s.g), p.x, p.y, p.ang, s.flip);
    if (p.shield > 0) { c.strokeStyle = 'rgba(150,210,255,0.6)'; c.lineWidth = 1; c.beginPath(); c.arc(Math.round(p.x), Math.round(p.y), 15, 0, 7); c.stroke(); }
  }
  // thrown
  for (const k of this.thrown) drawSpr(c, weaponSprite(k.type, OUT), k.x, k.y, k.rot);
  // bullets
  c.lineCap = 'round';
  for (const b of this.bullets) {
    c.strokeStyle = b.owner === 'player' ? '#fff6b0' : '#ffb070'; c.lineWidth = 2;
    const l = Math.hypot(b.vx, b.vy); c.beginPath(); c.moveTo(b.x - b.vx / l * 14, b.y - b.vy / l * 14); c.lineTo(b.x, b.y); c.stroke();
  }
  // doors
  for (const d of this.doors) {
    const e = this.doorEnd(d);
    c.strokeStyle = '#3b2414'; c.lineWidth = 6; c.beginPath(); c.moveTo(d.hx, d.hy); c.lineTo(e.x, e.y); c.stroke();
    c.strokeStyle = '#a8703c'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(d.hx, d.hy); c.lineTo(e.x, e.y); c.stroke();
    c.fillStyle = '#222'; c.beginPath(); c.arc(d.hx, d.hy, 2.5, 0, 7); c.fill();
  }
  c.drawImage(this.wallCv, 0, 0);
  if (pm === 'prism') { c.globalAlpha = 0.45 + Math.sin(t * 5) * 0.15; for (const e of this.enemies) { if (e.state === 'dead') continue; const s = e.state === 'down' ? { g: corpseSprite(e.kind === 'gun' ? 'gun' : e.kind, null, e.corpseVariant || 0, true), flip: false } : enemyGrid(e); drawSpr(c, charCanvas(s.g, '#ff2a8a'), e.x, e.y, e.state === 'down' ? e.downAng || 0 : e.ang, s.flip); } c.globalAlpha = 1; }
  // particles
  for (const pt of this.particles) {
    c.globalAlpha = clamp(pt.life / pt.max, 0, 1); c.fillStyle = pt.col;
    if (pt.glow) { c.beginPath(); c.arc(pt.x, pt.y, pt.size * (pt.life / pt.max + 0.3), 0, 7); c.fill(); }
    else c.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  c.globalAlpha = 1;
  // floaters
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.direction = 'ltr'; c.font = 'bold 8px monospace';
  for (const f of this.floaters) { c.globalAlpha = clamp(f.life * 2, 0, 1); c.fillStyle = '#000'; c.fillText(f.text, Math.round(f.x) + 1, Math.round(f.y) + 1); c.fillStyle = f.col; c.fillText(f.text, Math.round(f.x), Math.round(f.y)); }
  c.globalAlpha = 1;
  // crosshair (mouse mode)
  if (Input.mode === 'kb' && p.alive) {
    const a = this.aimWorld, ax = Math.round(a.x), ay = Math.round(a.y); c.fillStyle = '#3ffcff'; c.fillRect(ax - 7, ay, 4, 1); c.fillRect(ax + 4, ay, 4, 1); c.fillRect(ax, ay - 7, 1, 4); c.fillRect(ax, ay + 4, 1, 4); c.fillStyle = '#ff2a8a'; c.fillRect(ax, ay, 1, 1);
  } else if (p.alive) {
    c.strokeStyle = 'rgba(63,252,255,0.5)'; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(p.x + Math.cos(p.ang) * 16, p.y + Math.sin(p.ang) * 16); c.lineTo(p.x + Math.cos(p.ang) * 70, p.y + Math.sin(p.ang) * 70); c.stroke(); c.setLineDash([]);
  }
  c.restore();
  if (this.slow > 0) { c.fillStyle = 'rgba(80,40,255,0.18)'; c.fillRect(0, 0, sw, sh); }
  screenC.imageSmoothingEnabled = false; screenC.drawImage(LowCv, 0, 0, SWf, SWf * LOW_H / LOW_W);
  { const c = screenC; const sw = SWf, sh = SWf * LOW_H / LOW_W;
  // off-screen exit arrow
  if (this.cleared && this.status === 'play') {
    const dx = (ex.x - this.cam.x) * ZOOM, dy = (ex.y - this.cam.y) * ZOOM;
    if (Math.abs(dx) > sw / 2 - 40 || Math.abs(dy) > sh / 2 - 40) {
      const a = Math.atan2(dy, dx), k = Math.min((sw / 2 - 50) / Math.abs(Math.cos(a) || 1e-6), (sh / 2 - 50) / Math.abs(Math.sin(a) || 1e-6));
      c.save(); c.translate(sw / 2 + Math.cos(a) * k, sh / 2 + Math.sin(a) * k); c.rotate(a); c.fillStyle = '#3ffcff'; c.shadowColor = '#3ffcff'; c.shadowBlur = 12;
      c.beginPath(); c.moveTo(18, 0); c.lineTo(-10, -12); c.lineTo(-4, 0); c.lineTo(-10, 12); c.fill(); c.restore();
    }
  }
  if (this.flash > 0) { c.fillStyle = `rgba(255,0,60,${this.flash})`; c.fillRect(0, 0, sw, sh); }
  }
};
