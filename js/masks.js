// ===== Original masks: pixel portraits + top-down head art + abilities =====
const MASK_BASE = [
  '...mmmmmm...', '..mmmmmmmm..', '.mmmmmmmmmm.', '.mmmmmmmmmm.', '.mmmmmmmmmm.', '.mmmmmmmmmm.',
  '.mmmmmmmmmm.', '.mmmmmmmmmm.', '..mmmmmmmm..', '..mmmmmmmm..', '...mmmmmm...', '....mmmm....'];
const MASKS = [
  { id: 'comet', ar: 'المذنّب', en: 'COMET', dAr: 'تتحرك أسرع بـ 25٪', dEn: 'Move 25% faster', col: { m: '#ff8a1f', a: '#ffe14a', e: '#2a0b00' },
    art: ['............', '.aa.........', '..aa........', '...aa.......', '..eee..eee..', '..eee..eee..', '.....aa.....', '............', '...a....a...', '....aaaa....', '............', '............'] },
  { id: 'vault', ar: 'الخزنة', en: 'VAULT', dAr: 'الأسلحة النارية تجيك بذخيرة أكثر بـ 50٪', dEn: 'Guns you pick up get +50% ammo', col: { m: '#8d99a8', a: '#e2b33a', e: '#141820' },
    art: ['............', '............', '..aaaaaaaa..', '............', '..ee....ee..', '..ee....ee..', '.....aa.....', '....a..a....', '.....aa.....', '..aaaaaaaa..', '............', '............'] },
  { id: 'reach', ar: 'الذراع الطويلة', en: 'LONGARM', dAr: 'مدى الضرب القريب أطول بـ 50٪', dEn: 'Melee reach +50%', col: { m: '#2fbf71', a: '#d6ffe6', e: '#06210f' },
    art: ['............', '............', '............', '............', 'aeeeeeeeeeea', 'aeeeeeeeeeea', '............', '............', '...aaaaaa...', '............', '............', '............'] },
  { id: 'aegis', ar: 'الدرع', en: 'AEGIS', dAr: 'تنجو من رصاصة وحدة في كل طابق', dEn: 'Survive one bullet per floor', col: { m: '#2f6fff', a: '#bfe3ff', e: '#050f2a' },
    art: ['.....aa.....', '....aaaa....', '.....aa.....', '.....aa.....', '..eee..eee..', '..e.e..e.e..', '.....aa.....', '.....aa.....', '....aaaa....', '.....aa.....', '............', '............'] },
  { id: 'hush', ar: 'الصمت', en: 'HUSH', dAr: 'طلقاتك صامتة، الأعداء ما يسمعونها', dEn: 'Silent gunshots: enemies can\'t hear', col: { m: '#22202a', a: '#e8e8f0', e: '#ff2a8a' },
    art: ['............', '............', '............', '............', '..ee....ee..', '...e....e...', '............', '..a.a.a.a...', '...a.a.a.a..', '..a.a.a.a...', '............', '............'] },
  { id: 'breaker', ar: 'الكاسر', en: 'BREAKER', dAr: 'ضربة الباب تقتل بدل ما تطيّح', dEn: 'Door slams are lethal', col: { m: '#d4222e', a: '#2a2a30', e: '#fff2a0' },
    art: ['............', '..a..a..a...', '..a..a..a...', '..a..a..a...', '..ee.a.ee...', '..ee.a.ee...', '..a..a..a...', '..a..a..a...', '..a..a..a...', '............', '............', '............'] },
  { id: 'chrono', ar: 'الساعة', en: 'CHRONO', dAr: 'الكومبو يبطّئ الزمن حولك', dEn: 'Combo kills slow down time', col: { m: '#f2efe6', a: '#2a2a30', e: '#7b2cff' },
    art: ['.....aa.....', '............', '.a........a.', '............', '...ee..ee...', '...ee..ee...', 'a....aa....a', '.....a......', '.....a......', '.a........a.', '............', '.....aa.....'] },
  { id: 'dart', ar: 'السهم', en: 'DART', dAr: 'أي سلاح ترميه يقتل', dEn: 'Thrown weapons kill', col: { m: '#9b30ff', a: '#ffe14a', e: '#16002a' },
    art: ['............', '.....a......', '....aaa.....', '...a.a.a....', '..ee.a.ee...', '..ee.a.ee...', '.....a......', '.....a......', '....a.a.....', '............', '............', '............'] },
  { id: 'blade', ar: 'النصل', en: 'BLADE', dAr: 'تبدأ كل طابق ومعك سكين', dEn: 'Start every floor with a knife', col: { m: '#e9e9ee', a: '#c4102a', e: '#101018' },
    art: ['............', '.a..........', '..a.........', '...a........', '..eea...ee..', '..ee.a..ee..', '......a.....', '.......a....', '........a...', '............', '............', '............'] },
  { id: 'prism', ar: 'المنشور', en: 'PRISM', dAr: 'تشوف الأعداء من ورا الجدران', dEn: 'See enemies through walls', col: { m: '#151530', a: '#3ffcff', e: '#ff2a8a' },
    art: ['............', '............', '.....aa.....', '....a..a....', '..ea....ae..', '.eeea..aeee.', '..a......a..', '.a........a.', 'aaaaaaaaaaaa', '............', '............', '............'] },
];
const MASK_BY_ID = Object.fromEntries(MASKS.map(m => [m.id, m]));
function maskPortrait(id) {
  return sprite('mp|' + id, () => {
    const m = MASK_BY_ID[id], g = Pix.grid(14, 14);
    Pix.stamp(g, MASK_BASE, m.col, 1, 1); Pix.stamp(g, m.art, m.col, 1, 1);
    // shading on the right edge for a 3D feel
    for (let y = 0; y < 14; y++) for (let x = 8; x < 14; x++) if (Pix.get(g, x, y) === m.col.m && !Pix.get(g, x + 1, y)) Pix.set(g, x, y, shade(m.col.m, -40));
    Pix.outline(g, OUT); return Pix.canvas(g);
  });
}
function maskPortraitLocked(id) {
  return sprite('mpl|' + id, () => { const m = MASK_BY_ID[id], g = Pix.grid(14, 14); Pix.stamp(g, MASK_BASE, m.col, 1, 1); Pix.outline(g, '#5a4a70'); return Pix.canvas(g, '#2a2238'); });
}
function shade(hex, d) { const n = parseInt(hex.slice(1), 16); const c = v => Math.max(0, Math.min(255, v + d)).toString(16).padStart(2, '0'); return '#' + c(n >> 16 & 255) + c(n >> 8 & 255) + c(n & 255); }
// draw a mask as seen from above (head facing +x) into a grid
function drawMaskTop(g, id, hx, hy, r) {
  const m = MASK_BY_ID[id]; if (!m) return;
  Pix.ellipse(g, hx, hy, r, r, m.col.m);
  for (let y = Math.floor(hy - r - 1); y <= hy + r; y++) for (let x = Math.floor(hx - r - 1); x < hx - r * 0.3; x++) if (Pix.get(g, x, y) === m.col.m) Pix.set(g, x, y, '#1a1020'); // hair/strap behind
  const fx = Math.round(hx + r - 1.5), cy = Math.round(hy - 0.5);
  Pix.set(g, fx, cy - 2, m.col.e); Pix.set(g, fx, cy + 1, m.col.e); // eye holes
  Pix.set(g, fx - 1, cy - 2, m.col.e); Pix.set(g, fx - 1, cy + 1, m.col.e);
  Pix.rect(g, Math.round(hx - 1), cy, 2, 1, m.col.a); // crest accent
  Pix.set(g, fx + 1, cy, m.col.a); Pix.set(g, fx + 1, cy - 1, m.col.a);
}
function maskUnlockedCount() { return Math.min(MASKS.length, 2 + 2 * Object.keys(Save.best).length); }
