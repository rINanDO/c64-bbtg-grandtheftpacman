// Build: generate data (maze, glyphs, sprites, tables), assemble, write PRG + D64.
'use strict';
const fs = require('fs');
const path = require('path');
const { Assembler } = require('./asm');
const { makeD64 } = require('./d64');
const { buildMusic } = require('./music');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'build');
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- maze
// # wall  . dot  o cash (power pellet)  - house door  H house  T tunnel  P player start
const MAZE = [
  '###########################',
  '#............#............#',
  '#.####.#####.#.#####.####.#',
  '#o####.#####.#.#####.####o#',
  '#.........................#',
  '#.####.#.#########.#.####.#',
  '#......#.....#.....#......#',
  '######.#####.#.#####.######',
  '     #.#           #.#     ',
  '     #.# ####-#### #.#     ',
  '######.# #HHHHHHH# #.######',
  'T     .  #HHHHHHH#  .     T',
  '######.# ######### #.######',
  '     #.#           #.#     ',
  '######.# ######### #.######',
  '#............#............#',
  '#.####.#####.#.#####.####.#',
  '#o...#.......P.......#...o#',
  '####.#.#.#########.#.#.####',
  '#......#.....#.....#......#',
  '#.##########.#.##########.#',
  '#.........................#',
  '###########################',
];
const W = 27, H = MAZE.length;
MAZE.forEach((r, i) => { if (r.length !== W) throw new Error(`maze row ${i} has length ${r.length}`); });

// Sanity: every walkable cell reachable from the player and no dead ends (ghost AI cannot reverse).
{
  const walk = (x, y) => { if (x < 0 || x >= W) return y === 11; const c = MAZE[y][x]; return c !== '#' && c !== '-' && c !== 'H'; };
  const start = [13, 17]; const seen = new Set([start.join()]); const q = [start];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let nx = x + dx; const ny = y + dy;
      if (!walk(nx, ny)) continue;
      nx = (nx + W) % W;
      const k = `${nx},${ny}`; if (!seen.has(k)) { seen.add(k); q.push([nx, ny]); }
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = MAZE[y][x];
    if ((c === '.' || c === 'o') && !seen.has(`${x},${y}`)) throw new Error(`unreachable dot at ${x},${y}`);
    if (seen.has(`${x},${y}`)) {
      let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (walk(x + dx, y + dy)) n++;
      if (n < 2) throw new Error(`dead end at ${x},${y}`);
    }
  }
}

// ---------------------------------------------------------------- glyphs
const CH = { SPACE: 0x20, DOT: 0x40, POWER: 0x41, DOOR: 0x42, LIFE: 0x43, STAR: 0x44, WALL0: 0x48 };
const bits = (rows) => rows.map((r) => parseInt(r.replace(/\./g, '0').replace(/X/g, '1'), 2));
const fixedGlyphs = {
  [CH.DOT]: bits(['........', '........', '........', '...XX...', '...XX...', '........', '........', '........']),
  [CH.POWER]: bits(['...X....', '.XXXXXX.', 'XX.X....', '.XXXXX..', '...X.XX.', 'XXXXXX..', '...X....', '........']),
  [CH.DOOR]: bits(['........', '........', '........', 'XXXXXXXX', 'XXXXXXXX', '........', '........', '........']),
  [CH.LIFE]: bits(['..XXXX..', '.XXXXXX.', 'XXXXX...', 'XXXX....', 'XXXXX...', '.XXXXXX.', '..XXXX..', '........']),
  [CH.STAR]: bits(['...XX...', '...XX...', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '.XXXXXX.', '.XX..XX.', 'XX....XX']),
};

// Wall outlines: light a pixel inside a wall cell when its distance to the nearest open pixel is ~2.
const isWallCell = (x, y) => x >= 0 && x < W && y >= 0 && y < H && MAZE[y][x] === '#';
const isOpenPx = (gx, gy) => !isWallCell(Math.floor(gx / 8), Math.floor(gy / 8));
const glyphCodes = new Map(); const glyphList = [];
const mazeChars = []; const mazeCols = [];
let totalDots = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const c = MAZE[y][x];
  let code = CH.SPACE, col = 0;
  if (c === '#') {
    const rows = [];
    for (let py = 0; py < 8; py++) {
      let row = 0;
      for (let px = 0; px < 8; px++) {
        const gx = x * 8 + px, gy = y * 8 + py;
        let best = 99;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++)
          if (isOpenPx(gx + dx, gy + dy)) best = Math.min(best, Math.hypot(dx, dy));
        if (best >= 1.5 && best < 2.5) row |= 0x80 >> px;
      }
      rows.push(row);
    }
    const key = rows.join(',');
    if (!glyphCodes.has(key)) { glyphCodes.set(key, CH.WALL0 + glyphList.length); glyphList.push(rows); }
    code = glyphCodes.get(key); col = 6;
  } else if (c === '.') { code = CH.DOT; col = 15; totalDots++; }
  else if (c === 'o') { code = CH.POWER; col = 5; totalDots++; }
  else if (c === '-') { code = CH.DOOR; col = 10; }
  mazeChars.push(code); mazeCols.push(col);
}
if (CH.WALL0 + glyphList.length > 0x100) throw new Error(`too many wall glyphs: ${glyphList.length}`);
const glyphBytes = new Array(0xc0 * 8).fill(0); // chars $40-$FF
for (const [code, rows] of Object.entries(fixedGlyphs)) rows.forEach((b, i) => { glyphBytes[(code - 0x40) * 8 + i] = b; });
glyphList.forEach((rows, gi) => rows.forEach((b, i) => { glyphBytes[(CH.WALL0 + gi - 0x40) * 8 + i] = b; }));

// ---------------------------------------------------------------- sprites
function hiresSprite(fn) { // fn(x,y) -> bool, 16x16 image in top-left of 24x21
  const out = new Array(64).fill(0);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (fn(x, y)) out[y * 3 + (x >> 3)] |= 0x80 >> (x & 7);
  return out;
}
function pacSprite(dir, mouthDeg) { // dir 0 up,1 left,2 down,3 right
  const ang = [-90, 180, 90, 0][dir];
  return hiresSprite((x, y) => {
    const dx = x - 7.5, dy = y - 7.5;
    if (dx * dx + dy * dy > 7.4 * 7.4) return false;
    if (mouthDeg <= 0) return true;
    let a = Math.atan2(dy, dx) * 180 / Math.PI - ang;
    a = ((a + 540) % 360) - 180;
    return Math.abs(a) > mouthDeg;
  });
}
function mcSprite(art) { // 8 multicolor pixels wide; . = transparent, w = $d025, a = sprite colour, r = $d026
  const MC = { '.': 0, w: 1, a: 2, r: 3 };
  const rows = art.slice();
  const pad = Math.floor((16 - rows.length) / 2);
  const out = new Array(64).fill(0);
  rows.forEach((r, i) => {
    if (r.length !== 8) throw new Error(`sprite row '${r}' must be 8 wide`);
    const y = i + pad; let v = 0;
    for (const ch of r) { if (!(ch in MC)) throw new Error(`bad sprite char ${ch}`); v = (v << 2) | MC[ch]; }
    out[y * 3] = v >> 8; out[y * 3 + 1] = v & 0xff;
  });
  return out;
}
const swap = (art, from, to) => art.map((r) => r.split('').map((c) => (c === from ? to : c === to ? from : c)).join(''));

const COP_A = [
  '..aaaa..', '.aaaaaa.', '.aawwaa.', 'aaaaaaaa', '.rrrrrr.', '.aarraa.', '.rrrrrr.',
  '.rr..rr.', '..rrrr..', '...rr...', '.aawwaa.', 'aaawwaaa', 'awaaaaaa', 'aaaaaaaa'];
const COP_B = COP_A.map((r, i) => (i === 7 ? '.rrrrrr.' : i === 5 ? '.awrraw.' : r));
const CAR_A = [
  '..rraa..', '..wwww..', '.wwwwww.', '.waaaaw.', 'waaaaaaw', 'waaaaaaw', 'wwwwwwww',
  'wwwwwwww', 'raawwaar', 'wwwwwwww', 'aaaaaaaa', 'aa....aa'];
const CAR_B = CAR_A.map((r, i) => (i === 0 ? '..aarr..' : i === 8 ? 'waawwaaw' : r));
const HELI_A = [
  'aaaaaaaa', '...ww...', '..aaaa..', '.awwwwa.', 'awwwwwwa', 'awwrrwwa', 'awwwwwwa',
  '.aaaaaa.', '..aaaa..', '.a....a.', 'aaaaaaaa'];
const HELI_B = HELI_A.map((r, i) => (i === 0 ? '..aaaa..' : r));
const TANK_A = [
  '..aaaa..', '.aaaaaa.', 'aaa..aaa', 'aaa..aaa', '.aaaaaa.', 'wwaaaaww', 'rwaaaawr',
  'wwaaaaww', 'rwaaaawr', 'wwaaaaww', 'rwwwwwwr'];
const TANK_B = swap(TANK_A, 'w', 'r'); // treads roll
const FRIGHT_A = [
  '..aaaa..', '.aaaaaa.', 'aaaaaaaa', 'aawaawaa', 'aawaawaa', 'aaaaaaaa', 'aaaaaaaa',
  'arrrrrra', 'aaaaaaaa', 'aaaaaaaa', 'a.aa.aa.'];
const FRIGHT_B = FRIGHT_A.map((r, i) => (i === 10 ? '.aa.aa.a' : i === 7 ? 'araraara' : r));

const sprites = [];
sprites.push(pacSprite(0, 0));                                         // $E0 closed
for (let d = 0; d < 4; d++) { sprites.push(pacSprite(d, 28)); sprites.push(pacSprite(d, 50)); } // $E1-$E8
for (const art of [COP_A, COP_B, CAR_A, CAR_B, HELI_A, HELI_B, TANK_A, TANK_B]) sprites.push(mcSprite(art)); // $E9-$F0
sprites.push(mcSprite(FRIGHT_A)); sprites.push(mcSprite(FRIGHT_B));    // $F1-$F2
for (let i = 0; i < 8; i++) sprites.push(i === 7 ? hiresSprite(() => false) : pacSprite(0, 60 + i * 18)); // $F3-$FA death

// ---------------------------------------------------------------- emit include files
const byteLines = (label, arr) => {
  let s = label ? `${label}:\n` : '';
  for (let i = 0; i < arr.length; i += 16) s += '        .byte ' + arr.slice(i, i + 16).map((b) => '$' + (b & 0xff).toString(16).padStart(2, '0')).join(',') + '\n';
  return s;
};
let data = '; generated by tools/build.js - do not edit\n';
data += `TOTAL_DOTS = ${totalDots}\nCH_WALL0 = $${CH.WALL0.toString(16)}\n`;
data += byteLines('glyphs', glyphBytes);
data += byteLines('maze_chars', mazeChars);
data += byteLines('maze_cols', mazeCols);
data += byteLines('scrlo', Array.from({ length: 25 }, (_, r) => (0x400 + r * 40) & 0xff));
data += byteLines('scrhi', Array.from({ length: 25 }, (_, r) => (0x400 + r * 40) >> 8));
data += byteLines('sqlo', Array.from({ length: 64 }, (_, i) => (i * i) & 0xff));
data += byteLines('sqhi', Array.from({ length: 64 }, (_, i) => (i * i) >> 8));
fs.writeFileSync(path.join(SRC, 'gen_data.inc'), data);
fs.writeFileSync(path.join(SRC, 'gen_music.inc'), buildMusic());
fs.writeFileSync(path.join(SRC, 'gen_sprites.inc'), '; generated by tools/build.js\n' + byteLines('', sprites.flat()));

// ---------------------------------------------------------------- assemble & package
const asm = new Assembler();
const { start, bin, syms } = asm.assemble(path.join(SRC, 'pacman.asm'));
const prg = new Uint8Array(bin.length + 2);
prg[0] = start & 0xff; prg[1] = start >> 8; prg.set(bin, 2);
fs.writeFileSync(path.join(OUT, 'pacman.prg'), prg);
fs.writeFileSync(path.join(OUT, 'pacman.d64'), makeD64('PACMAN GTA', 'GT', [{ name: 'PACMAN', data: prg }]));
fs.writeFileSync(path.join(OUT, 'pacman.sym'), [...syms].filter(([k]) => !k.includes('@')).map(([k, v]) => `${k} = $${v.toString(16)}`).join('\n') + '\n');

console.log(`dots: ${totalDots}, wall glyphs: ${glyphList.length}, sprites: ${sprites.length}`);
console.log(`code end: $${syms.get('code_end').toString(16)}  high code end: $${syms.get('high_end').toString(16)}  prg: $${start.toString(16)}-$${(start + bin.length - 1).toString(16)} (${prg.length} bytes)`);
console.log(`wrote build/pacman.prg and build/pacman.d64`);
