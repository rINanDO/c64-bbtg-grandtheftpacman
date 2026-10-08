// Bot test: a BFS bot that hunts dots. mode "clear": enemies are kept in the house so the bot
// can clear levels. mode "hunt": enemies are active; reports fright / enemy-eaten events.
'use strict';
const fs = require('fs');
const path = require('path');
const { C64 } = require('./emu');

const mode = process.argv[2] || 'clear';
const frames = Number(process.argv[3] || 8000);
const m = new C64();
m.load(fs.readFileSync(path.join(__dirname, '..', 'build', 'pacman.prg')));
m.cpu.pc = 2061;
const Z = { lives: 0x25, level: 0x26, dots: 0x28, score: 0x70, ex: 0x40, ey: 0x45, estate: 0x54, etimer: 0x59, efright: 0x5e, chain: 0x23 };
const r = m.ram;
const tile = (x, y) => r[0x400 + (y + 1) * 40 + x];
const DIRS = [[0, -1, 1], [-1, 0, 4], [0, 1, 2], [1, 0, 8]]; // dx, dy, joy bit

function botDir() {
  const sx = Math.round(r[Z.ex] / 8), sy = Math.round(r[Z.ey] / 8);
  const prev = new Map([[`${sx},${sy}`, null]]); const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    const t = tile(x, y);
    const scared = [1, 2, 3, 4].filter((i) => r[Z.efright + i]);
    const hit = scared.length ? scared.some((i) => Math.round(r[Z.ex + i] / 8) === x && Math.round(r[Z.ey + i] / 8) === y)
      : (mode === 'power' ? t === 0x41 : (t === 0x40 || t === 0x41));
    if (hit && !(x === sx && y === sy)) {
      let k = `${x},${y}`;
      while (prev.get(k) && prev.get(k).from !== `${sx},${sy}`) k = prev.get(k).from;
      return prev.get(k) ? prev.get(k).bit : 0;
    }
    for (const [dx, dy, bit] of DIRS) {
      let nx = x + dx; const ny = y + dy;
      if (nx < 0) nx = 26; if (nx > 26) nx = 0;
      if (tile(nx, ny) >= 0x42) continue;
      const k = `${nx},${ny}`;
      if (!prev.has(k)) { prev.set(k, { from: `${x},${y}`, bit }); q.push([nx, ny]); }
    }
  }
  return 0;
}

m.runFrames(30); m.joy = 0x10; m.runFrames(5); m.joy = 0;
let levelUps = 0, lastLevel = 1, frightSeen = 0, eaten = 0, lastScore = 0, deaths = 0, lastLives = 3;
const bcd = () => [2, 1, 0].map((i) => r[Z.score + i].toString(16).padStart(2, '0')).join('');
m.runFrames(frames, (f) => {
  if (mode === 'clear') for (let i = 1; i < 5; i++) { r[Z.estate + i] = 0; r[Z.etimer + i] = 200; }
  if (r[Z.ex] % 8 === 0 && r[Z.ey] % 8 === 0) m.joy = botDir();
  if (r[Z.level] !== lastLevel) { levelUps++; lastLevel = r[Z.level]; console.log(`frame ${f}: level ${lastLevel}, score ${bcd()}`); }
  for (let i = 1; i < 5; i++) if (r[Z.efright + i]) { frightSeen++; break; }
  if (r[Z.chain] > eaten) { eaten = r[Z.chain]; console.log(`frame ${f}: enemy eaten (chain ${eaten}) score ${bcd()}`); }
  if (r[Z.lives] < lastLives) { deaths++; console.log(`frame ${f}: died, lives ${r[Z.lives]} dots ${r[Z.dots] | (r[Z.dots + 1] << 8)}`); }
  lastLives = r[Z.lives];
  if (r[Z.chain] < eaten) eaten = r[Z.chain];
});
console.log(m.screenText());
console.log(`levelUps ${levelUps} frightFrames ${frightSeen} deaths ${deaths} score ${bcd()} dots ${r[Z.dots] | (r[Z.dots + 1] << 8)}`);
