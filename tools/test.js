// Smoke test: boot the PRG in the mini emulator, start a game, play randomly, report state.
'use strict';
const fs = require('fs');
const path = require('path');
const { C64 } = require('./emu');

const prg = fs.readFileSync(path.join(__dirname, '..', 'build', 'pacman.prg'));
const m = new C64();
m.load(prg);
m.cpu.pc = 2061; // SYS 2061

const Z = { lives: 0x25, level: 0x26, dots: 0x28, score: 0x70, ex: 0x40, ey: 0x45, estate: 0x54, efright: 0x5e, frt: 0x21, mode: 0x1d };
const hex = (v) => v.toString(16).padStart(2, '0');
const state = () => {
  const r = m.ram;
  const ents = [0, 1, 2, 3, 4].map((i) => `${i}:(${r[Z.ex + i]},${r[Z.ey + i]}) st${r[Z.estate + i]}${r[Z.efright + i] ? 'F' : ''}`).join(' ');
  return `score ${hex(r[Z.score + 2])}${hex(r[Z.score + 1])}${hex(r[Z.score])} lives ${r[Z.lives]} level ${r[Z.level]} dots ${r[Z.dots] | (r[Z.dots + 1] << 8)} mode ${r[Z.mode]} frt ${r[Z.frt] | (r[Z.frt + 1] << 8)}\n  ${ents}`;
};

const frames = Number(process.argv[2] || 3000);
let seed = Number(process.argv[3] || 1);
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };

m.runFrames(60); m.joy = 0x10; m.runFrames(5); m.joy = 0; m.runFrames(60); // skip intro
console.log('--- title screen ---');
console.log(m.screenText());
m.joy = 0x10; m.runFrames(5); m.joy = 0; // press fire

let titleSeen = 0, minDots = 999, maxLevel = 1;
m.runFrames(frames, (f) => {
  if (f % 25 === 0) m.joy = 1 << (rand() % 4);
  const r = m.ram;
  minDots = Math.min(minDots, r[Z.dots] | (r[Z.dots + 1] << 8));
  maxLevel = Math.max(maxLevel, r[Z.level]);
  if (f === 400) { console.log('--- in game, frame 400 ---'); console.log(m.screenText()); console.log(state()); }
  if (f > 0 && f % 1000 === 0) console.log(`frame ${f}: ${state()}`);
  if (m.screenText().includes('PRESS FIRE')) titleSeen++;
});
console.log('--- end ---');
console.log(m.screenText());
console.log(state());
console.log(`min dots left ${minDots}, max level ${maxLevel}, frames on title after start: ${titleSeen}`);
