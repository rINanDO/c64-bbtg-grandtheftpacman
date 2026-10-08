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
m.joy = 0x10; m.runFrames(5); m.joy = 0; m.runFrames(50);
const t = m.screenText();
console.log('after fire -> title:', t.includes('PRESS FIRE OR SPACE TO START'), ' charset d018=$' + m.io[0x18].toString(16));
m.joy = 0x10; m.runFrames(5); m.joy = 0; m.runFrames(150);
console.log('after fire -> game:', m.screenText().includes('READY!') || m.screenText().includes('SCORE'));
