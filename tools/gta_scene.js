// Generates the GTA-style intro scene: a stacked "GRAND / THEFT / PAC-MAN" logo in a heavy
// outlined font, plus a Vice-City skyline with palm trees, as multicolour characters.
'use strict';

const GLYPH_BASE = 0x40;          // intro glyphs temporarily replace chars $40-$ff
const MAX_GLYPHS = 0xc0;

// heavy 7-row font (variable width), drawn at 2 x 3 multicolour pixels per dot
const FONT = {
  G: ['.XXXX.', 'XX..XX', 'XX....', 'XX.XXX', 'XX..XX', 'XX..XX', '.XXXXX'],
  R: ['XXXXX.', 'XX..XX', 'XX..XX', 'XXXXX.', 'XX.XX.', 'XX..XX', 'XX..XX'],
  A: ['.XXXX.', 'XX..XX', 'XX..XX', 'XXXXXX', 'XX..XX', 'XX..XX', 'XX..XX'],
  N: ['XX..XX', 'XXX.XX', 'XXXXXX', 'XX.XXX', 'XX..XX', 'XX..XX', 'XX..XX'],
  D: ['XXXXX.', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XXXXX.'],
  T: ['XXXXXX', 'XXXXXX', '..XX..', '..XX..', '..XX..', '..XX..', '..XX..'],
  H: ['XX..XX', 'XX..XX', 'XX..XX', 'XXXXXX', 'XX..XX', 'XX..XX', 'XX..XX'],
  E: ['XXXXXX', 'XX....', 'XX....', 'XXXXX.', 'XX....', 'XX....', 'XXXXXX'],
  F: ['XXXXXX', 'XX....', 'XX....', 'XXXXX.', 'XX....', 'XX....', 'XX....'],
  P: ['XXXXX.', 'XX..XX', 'XX..XX', 'XXXXX.', 'XX....', 'XX....', 'XX....'],
  C: ['.XXXX.', 'XX..XX', 'XX....', 'XX....', 'XX....', 'XX..XX', '.XXXX.'],
  M: ['XX...XX', 'XXX.XXX', 'XXXXXXX', 'XX.X.XX', 'XX...XX', 'XX...XX', 'XX...XX'],
  '-': ['....', '....', '....', 'XXXX', 'XXXX', '....', '....'],
};
const SX = 2, SY = 3;

function buildScene() {
  const W = 160, H = 200;
  const px = Array.from({ length: H }, () => new Array(W).fill(0));
  const set = (x, y, v) => { if (x >= 0 && x < W && y >= 0 && y < H) px[y][x] = v; };
  const get = (x, y) => (x >= 0 && x < W && y >= 0 && y < H ? px[y][x] : 0);

  // ---- logo: fill (10 = white $d023), outline (01 = black $d022), shadow (11 = red colour RAM)
  const fill = Array.from({ length: H }, () => new Array(W).fill(false));
  const word = (text, top) => {
    const glyphs = [...text].map((c) => FONT[c]);
    const width = glyphs.reduce((s, g) => s + g[0].length * SX + 2, 0) - 2;
    let x0 = Math.floor((W - width) / 2);
    for (const g of glyphs) {
      g.forEach((row, gy) => [...row].forEach((c, gx) => {
        if (c !== 'X') return;
        for (let dy = 0; dy < SY; dy++) for (let dx = 0; dx < SX; dx++) fill[top + gy * SY + dy][x0 + gx * SX + dx] = true;
      }));
      x0 += g[0].length * SX + 2;
    }
  };
  word('GRAND', 9); word('THEFT', 35); word('PAC-MAN', 61);
  for (let y = 0; y < 96; y++) for (let x = 0; x < W; x++) if (fill[y][x]) set(x, y, 2);
  for (let y = 0; y < 96; y++) for (let x = 0; x < W; x++) {
    if (px[y][x]) continue;
    let near = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (fill[y + dy] && fill[y + dy][x + dx]) near = true;
    if (near) set(x, y, 1);
  }
  for (let y = 95; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    if (px[y][x] === 0 && (get(x - 1, y - 2) === 1 || get(x - 1, y - 2) === 2) && y - 2 >= 0) set(x, y, 3);
  }

  // ---- skyline (rows 15-22 = y 120..183): black buildings (01), lit windows (11 = yellow)
  let seed = 2026;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const GROUND = 183;
  let x = 0;
  while (x < W) {
    const w = 8 + rnd(4) * 4, h = 16 + rnd(6) * 8;
    const top = GROUND - h;
    for (let yy = top; yy <= GROUND; yy++) for (let xx = x; xx < x + w && xx < W; xx++) set(xx, yy, 1);
    if (rnd(3) === 0) for (let yy = top - 6; yy < top; yy++) set(x + (w >> 1), yy, 1); // antenna
    for (let wx = x + 1; wx < x + w - 1; wx += 2) {
      if (rnd(5) >= 2) continue;                     // whole window columns lit: repeats well as chars
      for (let wy = top + 3; wy < GROUND - 4; wy += 4) { set(wx, wy, 3); set(wx, wy + 1, 3); }
    }
    x += w + (rnd(3) === 0 ? 4 : 0);
  }
  // palm trees in front
  const palm = (bx, height, lean) => {
    let tx = bx;
    for (let i = 0; i < height; i++) {
      const yy = GROUND - i; tx = bx + Math.round(lean * (i / height) ** 2);
      set(tx, yy, 1); set(tx + 1, yy, 1);
    }
    const cy = GROUND - height;
    for (const [dx, dy] of [[-1, 0], [1, 0], [-1, 0.5], [1, 0.5], [-0.6, -0.6], [0.6, -0.6], [0, -1]]) {
      for (let i = 0; i < 12; i++) {
        const fx = tx + Math.round(dx * i * 1.2), fy = cy + Math.round(dy * i + (i * i) / 18);
        set(fx, fy, 1); set(fx + 1, fy, 1); set(fx, fy + 1, 1);
      }
    }
  };
  palm(12, 52, 6); palm(140, 46, -5); palm(118, 34, 4);

  // ---- cut into characters
  const glyphs = new Map(); const list = [];
  const STAR = [0x18, 0x18, 0xff, 0x7e, 0x3c, 0x7e, 0x66, 0xc3]; // hires
  list.push(STAR); glyphs.set('star', GLYPH_BASE);
  const chars = new Array(1000).fill(0x20), cols = new Array(1000).fill(1);
  for (let row = 0; row < 25; row++) for (let col = 0; col < 40; col++) {
    const bytes = [];
    let empty = true;
    for (let yy = 0; yy < 8; yy++) {
      let b = 0;
      for (let xx = 0; xx < 4; xx++) { const v = px[row * 8 + yy][col * 4 + xx]; if (v) empty = false; b = (b << 2) | v; }
      bytes.push(b);
    }
    if (empty) continue;
    const key = bytes.join(',');
    if (!glyphs.has(key)) { glyphs.set(key, GLYPH_BASE + list.length); list.push(bytes); }
    chars[row * 40 + col] = glyphs.get(key);
    cols[row * 40 + col] = 8 | (row < 12 ? 2 : 7);   // multicolour; 11-pixels red (logo) / yellow (windows)
  }
  if (list.length > MAX_GLYPHS) throw new Error(`GTA scene needs ${list.length} glyphs (max ${MAX_GLYPHS})`);

  // ---- sunset gradient per raster line (dithered bands), street and ground
  const bands = [[51, 0], [70, 6], [96, 4], [124, 2], [146, 10], [170, 8], [200, 7], [235, 11], [243, 0]];
  const grad = new Array(256).fill(0);
  for (let line = 0; line < 256; line++) {
    let c = 0;
    for (let i = 0; i < bands.length; i++) {
      const [start, color] = bands[i];
      if (line >= start) {
        c = color;
        const prev = i > 0 ? bands[i - 1][1] : 0;
        const into = line - start;
        if (into < 6 && start < 235 && (into & 1) === 0) c = prev; // dither the band edge
      }
    }
    grad[line] = c;
  }
  return { glyphBytes: list.flat(), count: list.length, chars, cols, grad, star: GLYPH_BASE };
}

module.exports = { buildScene };
