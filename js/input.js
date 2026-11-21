// Unified input: keyboard, mouse, gamepad (standard mapping)
const Input = {
  keys: {}, kp: {}, mouse: { x: 640, y: 360, down: [false, false, false], pr: [false, false, false], moved: false, wheel: 0 },
  mode: 'kb', padIndex: -1, pad: null, btn: [], prevBtn: [], axes: [0, 0, 0, 0], padName: '',
  navRepeat: { dir: null, t: 0 }, canvas: null, anyPressed: false, toast: null,
  init(canvas) {
    this.canvas = canvas;
    addEventListener('keydown', e => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.keys[e.code]) this.kp[e.code] = true;
      this.keys[e.code] = true; this.mode = 'kb'; this.anyPressed = true; AudioSys.init();
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; this.mouse.down = [false, false, false]; });
    canvas.addEventListener('mousemove', e => { this.setMouse(e); this.mouse.moved = true; if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) this.mode = 'kb'; });
    canvas.addEventListener('mousedown', e => { this.setMouse(e); this.mouse.down[e.button] = true; this.mouse.pr[e.button] = true; this.mode = 'kb'; this.anyPressed = true; AudioSys.init(); e.preventDefault(); });
    addEventListener('mouseup', e => { this.mouse.down[e.button] = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('gamepadconnected', e => { this.toast = { k: 'padConnected', t: 2.5 }; this.padIndex = e.gamepad.index; this.padName = e.gamepad.id; });
    addEventListener('gamepaddisconnected', e => { if (e.gamepad.index === this.padIndex) { this.padIndex = -1; this.pad = null; this.toast = { k: 'padDisconnected', t: 2.5 }; if (this.mode === 'pad') this.mode = 'kb'; } });
  },
  setMouse(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) / r.width * this.canvas.width;
    this.mouse.y = (e.clientY - r.top) / r.height * this.canvas.height;
  },
  poll(dt) {
    this.prevBtn = this.btn.slice();
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let p = (this.padIndex >= 0 && pads[this.padIndex]) || null;
    if (!p) for (const g of pads) if (g && g.connected) { p = g; this.padIndex = g.index; break; }
    this.pad = p;
    if (p) {
      this.btn = p.buttons.map(b => b.pressed || b.value > 0.4);
      const dz = (v) => Math.abs(v) < 0.2 ? 0 : v;
      this.axes = [dz(p.axes[0] || 0), dz(p.axes[1] || 0), dz(p.axes[2] || 0), dz(p.axes[3] || 0)];
      if (this.btn.some((b, i) => b && !this.prevBtn[i]) || this.axes.some(a => Math.abs(a) > 0.5)) { if (this.mode !== 'pad') this.mode = 'pad'; this.anyPressed = true; AudioSys.init(); }
    } else { this.btn = []; this.axes = [0, 0, 0, 0]; }
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
    // menu nav repeat
    let dir = null;
    const ax = this.axes[0], ay = this.axes[1];
    if (this.b(12) || ay < -0.6) dir = 'up'; else if (this.b(13) || ay > 0.6) dir = 'down'; else if (this.b(14) || ax < -0.6) dir = 'left'; else if (this.b(15) || ax > 0.6) dir = 'right';
    this.padNav = null;
    if (dir) { if (this.navRepeat.dir !== dir) { this.padNav = dir; this.navRepeat = { dir, t: 0.4 }; } else { this.navRepeat.t -= dt; if (this.navRepeat.t <= 0) { this.padNav = dir; this.navRepeat.t = 0.12; } } }
    else this.navRepeat.dir = null;
  },
  endFrame() { this.kp = {}; this.mouse.pr = [false, false, false]; this.anyPressed = false; this.mouse.moved = false; },
  b(i) { return !!this.btn[i]; },
  bp(i) { return !!this.btn[i] && !this.prevBtn[i]; },
  k(code) { return !!this.keys[code]; },
  kpr(...codes) { return codes.some(c => this.kp[c]); },
  // menu actions
  navUp() { return this.kpr('ArrowUp', 'KeyW') || this.padNav === 'up'; },
  navDown() { return this.kpr('ArrowDown', 'KeyS') || this.padNav === 'down'; },
  navLeft() { return this.kpr('ArrowLeft', 'KeyA') || this.padNav === 'left'; },
  navRight() { return this.kpr('ArrowRight', 'KeyD') || this.padNav === 'right'; },
  confirm() { return this.kpr('Enter', 'Space', 'NumpadEnter') || this.bp(0); },
  back() { return this.kpr('Escape', 'Backspace') || this.bp(1); },
  // game actions
  moveVec() {
    let x = 0, y = 0;
    if (this.k('KeyW') || this.k('ArrowUp')) y -= 1; if (this.k('KeyS') || this.k('ArrowDown')) y += 1;
    if (this.k('KeyA') || this.k('ArrowLeft')) x -= 1; if (this.k('KeyD') || this.k('ArrowRight')) x += 1;
    if (this.axes[0] || this.axes[1]) { x += this.axes[0]; y += this.axes[1]; }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return { x, y };
  },
  attackHeld() { return this.mouse.down[0] || this.b(7); },
  attackPressed() { return this.mouse.pr[0] || this.bp(7); },
  rightPressed() { return this.mouse.pr[2]; },
  throwPressed() { return this.bp(6) || this.bp(1) || this.kpr('KeyQ'); },
  pickupPressed() { return this.kpr('KeyE') || this.bp(2); },
  executePressed() { return this.kpr('Space') || this.bp(0); },
  restartPressed() { return this.kpr('KeyR') || this.bp(3); },
  pausePressed() { return this.kpr('Escape', 'KeyP') || this.bp(9); },
  lookHeld() { return this.k('ShiftLeft') || this.k('ShiftRight') || this.b(5) || this.b(4); },
};
