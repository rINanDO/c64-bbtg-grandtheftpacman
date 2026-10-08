// Runs the BBTG cracktro in the emulator: checks the screen, the vertical-blank time budget
// and that fire leads to the title screen and into the game.
'use strict';
const fs = require('fs');
const path = require('path');
const { C64 } = require('./emu');

const m = new C64();
m.load(fs.readFileSync(path.join(__dirname, '..', 'build', 'pacman.prg')));
m.cpu.pc = 2061;
const syms = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', 'build', 'pacman.sym'), 'utf8')
  .trim().split('\n').map((l) => { const [k, v] = l.split(' = $'); return [k, parseInt(v, 16)]; }));

// boot splash: BBTG logo fades in, holds, fades out, then the cracktro starts by itself
let splashFull = false, crackAt = -1;
m.runFrames(560, (f) => {
  if (m.ram[0xb2] === 4) splashFull = true;
  if (crackAt < 0 && m.screenText().includes('PROUDLY PRESENTS')) crackAt = f;
});
console.log(`splash: reached full colour ${splashFull}, cracktro after ${(crackAt / 50).toFixed(1)} s`);
m.runFrames(200, () => {});
const scrolled = m.screenText();
// every video frame must run the per-frame work once (no dropped frames)
let calls = 0;
for (let i = 0; i < 100; i++) {
  const end = m.cpu.cycles + 19656;
  while (m.cpu.cycles < end) {
    if (m.cpu.pc === syms['update_bars']) calls++;
    m.cpu.step();
  }
}
console.log(scrolled);
console.log(`d018=$${m.io[0x18].toString(16)} d016=$${m.io[0x16].toString(16)}  frames processed: ${calls}/100`);
m.pressFire(); m.runFrames(60);
console.log('after fire -> GTA intro:', m.screenText().includes('BBTG VIBATHON GROUP') && (m.io[0x16] & 0x10) !== 0);
// let the GTA intro play out: logo, five stars, police lights
let policeFrames = 0;
m.runFrames(800, () => { if (m.io[0x20] === 2) policeFrames++; });
const g = m.screenText().split('\n');
console.log('GTA intro: stars lit', [0, 2, 4, 6, 8].filter((i) => m.io[0x800 + 12 * 40 + 15 + i] === 7).length, '/5, police lights', policeFrames > 0,
  ', prompt', g[13].includes('PRESS FIRE TO HIT THE STREETS'));
m.pressFire(); m.runFrames(60);
const t = m.screenText();
console.log('after fire -> title:', t.includes('PRESS FIRE OR SPACE TO START'), ' charset d018=$' + m.io[0x18].toString(16));
m.pressFire(); m.runFrames(150);
console.log('after fire -> game:', m.screenText().includes('READY!') || m.screenText().includes('SCORE'));
