// ===== World rendering (all procedural, original character designs) =====
const PAL = {
  player: { body: '#7b2cff', trim: '#c7a6ff', head: '#141018', visor: '#3ffcff' },
  melee: { body: '#2f7d4f', trim: '#e9f5ec', head: '#c98f5e', hair: '#1b1209' },
  gun: { body: '#2b3f7a', trim: '#9fb6ff', head: '#d09a6a', hair: '#2a1a0c' },
  heavy: { body: '#d9661f', trim: '#ffd0a0', head: '#c48558', hair: '#c48558' },
  boss: { body: '#4b1f6e', trim: '#d4a531', head: '#b07850', hair: '#7a3b12' },
};
function drawWeaponShape(c, type, x, y, rot, scale) {
  c.save(); c.translate(x, y); c.rotate(rot); if (scale) c.scale(scale, scale);
  switch (type) {
    case 'bat': c.fillStyle = '#d9a35b'; c.beginPath(); c.moveTo(-4, -1.5); c.lineTo(16, -3); c.lineTo(17, 3); c.lineTo(-4, 1.5); c.fill(); c.fillStyle = '#222'; c.fillRect(-6, -2, 4, 4); break;
    case 'pipe': c.fillStyle = '#9aa6b4'; c.fillRect(-5, -1.6, 22, 3.2); c.fillStyle = '#6c7682'; c.fillRect(14, -2.6, 4, 5.2); break;
    case 'knife': c.fillStyle = '#e8e8f0'; c.beginPath(); c.moveTo(2, -2); c.lineTo(13, 0); c.lineTo(2, 2); c.fill(); c.fillStyle = '#3a2a1a'; c.fillRect(-4, -1.6, 6, 3.2); break;
    case 'pistol': c.fillStyle = '#2b2b33'; c.fillRect(0, -2, 11, 4); c.fillStyle = '#55555f'; c.fillRect(-2, -1.5, 4, 5); break;
    case 'shotgun': c.fillStyle = '#3a2416'; c.fillRect(-6, -2.4, 9, 4.8); c.fillStyle = '#2b2b33'; c.fillRect(3, -2, 16, 4); break;
    case 'smg': c.fillStyle = '#26262e'; c.fillRect(-3, -2.5, 15, 5); c.fillRect(3, 2, 3, 5); c.fillStyle = '#444'; c.fillRect(12, -1.2, 4, 2.4); break;
  }
  c.restore();
}
function drawHuman(c, o, pal, weapon, opts) {
  c.save(); c.translate(o.x, o.y); c.rotate(o.ang);
  const big = opts && opts.big || 1; c.scale(big, big);
  const bob = Math.sin((o.walk || 0) * 0.15) * 2;
  // shadow
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(3, 3, 9, 12, 0, 0, 7); c.fill();
  // feet
  c.fillStyle = '#111'; c.fillRect(-2 + bob, -6, 6, 4); c.fillRect(-2 - bob, 2, 6, 4);
  const W = weapon ? WEAPONS[weapon] : null;
  const sw = o.swing > 0 ? o.swing : 0, dir = o.swingDir || 1;
  // arms + weapon
  c.fillStyle = pal.body;
  if (W && W.gun) {
    c.fillRect(2, -8, 12, 4); c.fillRect(2, 3, 12, 4); c.fillStyle = pal.head; c.fillRect(12, -3, 4, 6);
    drawWeaponShape(c, weapon, 12, 0, 0);
  } else if (W) {
    const a = dir * (-1.3 + (1 - sw) * 2.6) * (sw > 0 ? 1 : 0) + (sw > 0 ? 0 : -0.9);
    c.save(); c.translate(2, 6); c.rotate(a); c.fillStyle = pal.body; c.fillRect(0, -2, 10, 4); drawWeaponShape(c, weapon, 11, 0, -0.2); c.restore();
    c.fillStyle = pal.body; c.fillRect(2, -9, 7, 4);
  } else {
    const p1 = sw > 0 && dir > 0 ? 8 * sw : 0, p2 = sw > 0 && dir < 0 ? 8 * sw : 0;
    c.fillRect(2, -9, 7 + p1, 4); c.fillRect(2, 5, 7 + p2, 4); c.fillStyle = pal.head; c.fillRect(8 + p1, -9, 3, 4); c.fillRect(8 + p2, 5, 3, 4);
  }
  // torso
  c.fillStyle = pal.body; c.beginPath(); c.ellipse(0, 0, 7, 11, 0, 0, 7); c.fill();
  c.strokeStyle = pal.trim; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-5, -8); c.lineTo(-5, 8); c.stroke();
  if (opts && opts.boss) { c.fillStyle = pal.trim; c.fillRect(-4, -12, 6, 4); c.fillRect(-4, 8, 6, 4); }
  // head
  c.fillStyle = pal.head; c.beginPath(); c.arc(1, 0, 6, 0, 7); c.fill();
  if (pal.visor) { c.fillStyle = pal.visor; c.fillRect(4, -4.5, 3, 9); c.fillStyle = 'rgba(63,252,255,0.25)'; c.beginPath(); c.arc(6, 0, 8, -0.6, 0.6); c.fill(); c.fillStyle = '#ff2a8a'; c.fillRect(-4, -1, 5, 2); }
  else if (opts && opts.boss) { c.fillStyle = '#b5521b'; for (let i = 0; i < 5; i++) { const a = -1.6 + i * 0.8; c.beginPath(); c.moveTo(1 + Math.cos(a) * 5, Math.sin(a) * 5); c.lineTo(1 + Math.cos(a) * 9, Math.sin(a) * 9); c.lineTo(1 + Math.cos(a + 0.3) * 5, Math.sin(a + 0.3) * 5); c.fill(); } }
  else { c.fillStyle = pal.hair; c.beginPath(); c.arc(-0.5, 0, 5.2, Math.PI * 0.5, Math.PI * 1.5); c.fill(); }
  if (o.flash > 0 && Math.floor(o.flash * 20) % 2 === 0) { c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(0, 0, 9, 13, 0, 0, 7); c.fill(); }
  c.restore();
}
function drawDog(c, o) {
  c.save(); c.translate(o.x, o.y); c.rotate(o.ang);
  const bob = Math.sin((o.walk || 0) * 0.3) * 2;
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(3, 3, 13, 7, 0, 0, 7); c.fill();
  c.fillStyle = '#2a1a10'; c.fillRect(4 + bob, -7, 3, 3); c.fillRect(4 - bob, 4, 3, 3); c.fillRect(-8 - bob, -7, 3, 3); c.fillRect(-8 + bob, 4, 3, 3);
  c.fillStyle = '#6b4226'; c.beginPath(); c.ellipse(0, 0, 12, 5.5, 0, 0, 7); c.fill();
  c.fillStyle = '#4a2c18'; c.beginPath(); c.arc(11, 0, 5, 0, 7); c.fill(); c.fillRect(13, -2, 6, 4);
  c.fillStyle = '#ff2a2a'; c.fillRect(13, -3, 1.5, 1.5); c.fillRect(13, 1.5, 1.5, 1.5);
  c.strokeStyle = '#6b4226'; c.lineWidth = 2; c.beginPath(); c.moveTo(-11, 0); c.lineTo(-17, Math.sin(G.time * 12) * 3); c.stroke();
  c.restore();
}
function drawHeavy(c, o) {
  c.save(); c.translate(o.x, o.y); c.rotate(o.ang);
  const bob = Math.sin((o.walk || 0) * 0.1) * 2, sw = o.swing > 0 ? o.swing : 0;
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(4, 4, 14, 18, 0, 0, 7); c.fill();
  c.fillStyle = '#111'; c.fillRect(-3 + bob, -9, 8, 5); c.fillRect(-3 - bob, 4, 8, 5);
  c.fillStyle = PAL.heavy.head; c.fillRect(4, -16, 10 + sw * 8, 6); c.fillRect(4, 10, 10 + sw * 8, 6);
  c.fillStyle = PAL.heavy.body; c.beginPath(); c.ellipse(0, 0, 11, 17, 0, 0, 7); c.fill();
  c.fillStyle = '#222'; c.fillRect(-9, -3, 18, 6); c.fillStyle = '#ffd0a0'; c.fillRect(-2, -14, 3, 28);
  c.fillStyle = PAL.heavy.head; c.beginPath(); c.arc(2, 0, 7.5, 0, 7); c.fill();
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.arc(0, 0, 7.5, Math.PI * 0.6, Math.PI * 1.4); c.fill();
  c.restore();
}
function drawBody(c, e, pal, dead) {
  // lying body
  const a = dead ? e.deadAng || 0 : (e.downAng || 0);
  c.save(); c.translate(e.x, e.y); c.rotate(a + (dead ? (e.corpseVariant || 0) * 0.4 - 0.4 : 0));
  if (e.kind === 'dog') { c.fillStyle = '#5a361f'; c.beginPath(); c.ellipse(0, 0, 13, 6, 0.3, 0, 7); c.fill(); c.fillStyle = '#3a2210'; c.beginPath(); c.arc(11, 3, 5, 0, 7); c.fill(); c.restore(); return; }
  const s = e.kind === 'heavy' ? 1.5 : e.kind === 'boss' ? 1.6 : 1;
  c.scale(s, s);
  c.fillStyle = pal.body; c.fillRect(-14, -4, 10, 8); // legs
  c.fillStyle = '#111'; c.fillRect(-18, -4, 4, 3); c.fillRect(-18, 1, 4, 3);
  c.fillStyle = pal.body; c.beginPath(); c.ellipse(0, 0, 8, 10, 0, 0, 7); c.fill();
  c.fillRect(-2, -14, 4, 8); c.fillRect(2, 6, 8, 4);
  c.fillStyle = pal.head; c.beginPath(); c.arc(10, 0, 6, 0, 7); c.fill();
  if (pal.visor) { c.fillStyle = pal.visor; c.fillRect(13, -4, 2, 8); }
  else if (pal.hair) { c.fillStyle = pal.hair; c.beginPath(); c.arc(9, 0, 5, Math.PI * 0.5, Math.PI * 1.5); c.fill(); }
  if (dead) { c.fillStyle = 'rgba(150,0,20,0.6)'; c.beginPath(); c.arc(4, 2, 4, 0, 7); c.fill(); }
  c.restore();
  if (!dead && e.state === 'down' && isFinite(e.downT)) { // dizzy stars
    c.fillStyle = '#ffe14a'; for (let i = 0; i < 3; i++) { const t = G.time * 4 + i * 2.1; c.fillRect(e.x + Math.cos(t) * 12 - 1.5, e.y + Math.sin(t) * 6 - 14, 3, 3); }
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
function palFor(e) { return e.kind === 'gun' ? PAL.gun : e.kind === 'heavy' ? PAL.heavy : e.kind === 'boss' ? PAL.boss : PAL.melee; }

G.draw = function (c, sw, sh) {
  const t = this.time;
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
  c.translate(Math.round(sw / 2), Math.round(sh / 2)); c.scale(ZOOM, ZOOM); c.translate(-this.cam.x + sx, -this.cam.y + sy);
  c.drawImage(this.floorCv, 0, 0); c.drawImage(this.bloodCv, 0, 0);
  // exit
  const ex = this.exit, last = this.isLastFloor();
  const exitOutdoor = this.style[ex.ty * this.W + ex.tx] === '_';
  if (exitOutdoor && last) drawCar(c, ex.x, ex.y, 0);
  else { c.save(); c.translate(ex.x, ex.y); c.fillStyle = '#111'; c.fillRect(-14, -14, 28, 28); c.fillStyle = '#444'; for (let i = 0; i < 5; i++) c.fillRect(-12, -12 + i * 5.5, 24 - i * 3, 3); c.restore(); }
  if (this.outdoorStart && this.floorIdx === 0 && !(exitOutdoor && last)) drawCar(c, this.startCar ? this.startCar.x : this.player.x, this.player.y - 40, 0);
  if (this.cleared) { const pulse = 0.5 + Math.sin(t * 6) * 0.5; c.strokeStyle = `rgba(63,252,255,${0.5 + pulse * 0.5})`; c.lineWidth = 2; c.strokeRect(ex.x - 18 - pulse * 4, ex.y - 18 - pulse * 4, 36 + pulse * 8, 36 + pulse * 8); }
  // pickups
  for (const k of this.pickups) { c.save(); c.shadowColor = '#fff'; c.shadowBlur = 6; drawWeaponShape(c, k.type, k.x, k.y, k.rot, 1.2); c.restore(); }
  // bodies
  for (const e of this.enemies) if (e.state === 'dead') drawBody(c, e, palFor(e), true);
  const p = this.player;
  if (!p.alive) drawBody(c, { x: p.x, y: p.y, deadAng: p.deadAng, kind: 'p' }, PAL.player, true);
  for (const e of this.enemies) if (e.state === 'down') drawBody(c, e, palFor(e), false);
  // enemies
  for (const e of this.enemies) {
    if (e.state === 'dead' || e.state === 'down') continue;
    if (e.kind === 'dog') drawDog(c, e);
    else if (e.kind === 'heavy') drawHeavy(c, e);
    else drawHuman(c, e, palFor(e), e.weapon, e.kind === 'boss' ? { big: 1.6, boss: true } : null);
    if (e.windup > 0 || (e.kind === 'boss' && e.tele > 0)) { c.fillStyle = '#ff2a2a'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.fillText('!', e.x, e.y - e.r - 8); }
    if (e.kind === 'boss' && e.stun > 0) { c.fillStyle = '#ffe14a'; for (let i = 0; i < 4; i++) { const a = t * 5 + i * 1.6; c.fillRect(e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 10 - 26, 3, 3); } }
  }
  if (p.alive) drawHuman(c, p, PAL.player, p.weapon ? p.weapon.type : null);
  // thrown
  for (const k of this.thrown) drawWeaponShape(c, k.type, k.x, k.y, k.rot, 1.2);
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
  // particles
  for (const pt of this.particles) {
    c.globalAlpha = clamp(pt.life / pt.max, 0, 1); c.fillStyle = pt.col;
    if (pt.glow) { c.beginPath(); c.arc(pt.x, pt.y, pt.size * (pt.life / pt.max + 0.3), 0, 7); c.fill(); }
    else c.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  c.globalAlpha = 1;
  // floaters
  c.textAlign = 'center'; c.font = 'bold 9px "Trebuchet MS", sans-serif';
  for (const f of this.floaters) { c.globalAlpha = clamp(f.life * 2, 0, 1); c.fillStyle = '#000'; c.fillText(f.text, f.x + 1, f.y + 1); c.fillStyle = f.col; c.fillText(f.text, f.x, f.y); }
  c.globalAlpha = 1;
  // crosshair (mouse mode)
  if (Input.mode === 'kb' && p.alive) {
    const a = this.aimWorld; c.strokeStyle = '#3ffcff'; c.lineWidth = 1.2; c.beginPath(); c.arc(a.x, a.y, 5, 0, 7); c.moveTo(a.x - 9, a.y); c.lineTo(a.x - 3, a.y); c.moveTo(a.x + 3, a.y); c.lineTo(a.x + 9, a.y); c.moveTo(a.x, a.y - 9); c.lineTo(a.x, a.y - 3); c.moveTo(a.x, a.y + 3); c.lineTo(a.x, a.y + 9); c.stroke();
  } else if (p.alive) {
    c.strokeStyle = 'rgba(63,252,255,0.5)'; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(p.x + Math.cos(p.ang) * 16, p.y + Math.sin(p.ang) * 16); c.lineTo(p.x + Math.cos(p.ang) * 70, p.y + Math.sin(p.ang) * 70); c.stroke(); c.setLineDash([]);
  }
  c.restore();
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
};
