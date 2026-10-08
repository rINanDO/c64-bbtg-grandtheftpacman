// Original soundtrack "Vice Beat" (G-funk flavoured, A minor) compiled to the
// stream format played by src/music.asm.
'use strict';

// ---------------------------------------------------------------- notes
const NAMES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const n = (s) => { const m = s.match(/^([A-G]#?)(\d)$/); return NAMES[m[1]] + 12 * Number(m[2]); }; // C0 = 0

// PAL SID frequency table (C0..B7)
const freq = Array.from({ length: 96 }, (_, i) => Math.min(0xffff, Math.round(440 * 2 ** ((i - 57) / 12) * 16777216 / 985248)));

// ---------------------------------------------------------------- instruments
// wavetable rows: [waveform|gate, note] note < $80 = relative (signed 7 bit), >= $80 = absolute
const ABS = (note) => 0x80 | note;
const REL = (st) => st & 0x7f;
const INSTR = {
  silent: { ad: 0x00, sr: 0x00, wt: [[0x00, ABS(0)]], loop: 0 },
  kick:   { ad: 0x00, sr: 0xf0, pw: 0x08, wt: [[0x81, ABS(60)], [0x41, ABS(34)], [0x41, ABS(29)], [0x41, ABS(25)], [0x41, ABS(21)], [0x40, ABS(18)]], loop: 5 },
  snare:  { ad: 0x08, sr: 0x00, pw: 0x08, wt: [[0x81, ABS(74)], [0x41, ABS(44)], [0x81, ABS(70)], [0x81, ABS(66)]], loop: 3 },
  bass:   { ad: 0x08, sr: 0x48, pw: 0x08, wt: [[0x41, REL(12)], [0x21, REL(0)]], loop: 1, filter: true, hr: true },
  arpmin: { ad: 0x02, sr: 0x68, pw: 0x04, pws: 0x30, wt: [[0x41, REL(0)], [0x41, REL(3)], [0x41, REL(7)]], loop: 0 },
  arpmaj: { ad: 0x02, sr: 0x68, pw: 0x04, pws: 0x30, wt: [[0x41, REL(0)], [0x41, REL(4)], [0x41, REL(7)]], loop: 0 },
  hat:    { ad: 0x04, sr: 0x00, wt: [[0x81, ABS(92)]], loop: 0 },
  whistle:{ ad: 0x29, sr: 0xa9, wt: [[0x11, REL(-2)], [0x11, REL(-1)], [0x11, REL(0)]], loop: 2, vdep: 0x50, vspd: 6, vdel: 12, hr: true },
  siren:  { ad: 0x90, sr: 0xf4, wt: [[0x11, REL(0)]], loop: 0, vdep: 0xc0, vspd: 28 },
  lead:   { ad: 0x08, sr: 0xa8, pw: 0x06, pws: 0x40, wt: [[0x41, REL(12)], [0x41, REL(0)], [0x41, REL(0)]], loop: 2, vdep: 0x40, vspd: 5, vdel: 10, hr: true },
  sync:   { ad: 0x06, sr: 0xa8, wt: [[0x23, REL(0)]], loop: 0, vdep: 0x30, vspd: 5, vdel: 8, hr: true },
};
const INAMES = Object.keys(INSTR);
if (INAMES.length > 16) throw new Error('too many instruments');

// ---------------------------------------------------------------- song
// event: [instrument, note-or-null(rest), steps]
const PROG = [['A', 'min'], ['A', 'min'], ['D', 'min'], ['E', 'maj']];
const BASS_ROOT = { A: n('A2'), D: n('D2'), E: n('E2') };
const ARP_ROOT = { A: n('A4'), D: n('D4'), E: n('E4') };

function drumsBass(root) {
  return [
    ['kick', 0, 2], ['bass', root, 1], ['bass', root, 1], ['snare', 0, 2], ['bass', root + 12, 1], ['bass', root, 1],
    ['kick', 0, 2], ['bass', root, 2], ['snare', 0, 2], ['bass', root + 7, 1], ['bass', root + 10, 1],
  ];
}
const bar = (fn) => PROG.flatMap(([c, q]) => fn(c, q));
const ch1Section = () => bar((c) => drumsBass(BASS_ROOT[c]));
const arpSection = () => bar((c, q) => [[q === 'min' ? 'arpmin' : 'arpmaj', ARP_ROOT[c], 16]]);
const hatSection = () => bar(() => [[null, null, 2], ['hat', 0, 2], [null, null, 2], ['hat', 0, 2], [null, null, 2], ['hat', 0, 2], [null, null, 1], ['hat', 0, 1], ['hat', 0, 2]]);

// 8-bar melody over the progression (twice)
const MELODY = [
  ['E5', 4], ['A5', 4], ['C6', 2], ['B5', 2], ['A5', 4],
  ['G5', 2], ['A5', 6], [null, 4], ['E5', 2], ['G5', 2],
  ['F5', 4], ['A5', 4], ['D6', 4], ['C6', 2], ['A5', 2],
  ['G#5', 6], ['B5', 2], ['E6', 6], [null, 2],
  ['E6', 4], ['D6', 2], ['C6', 2], ['B5', 4], ['A5', 4],
  ['C6', 2], ['B5', 2], ['A5', 4], ['E5', 4], [null, 4],
  ['D6', 3], ['C6', 3], ['A5', 2], ['F5', 4], ['A5', 4],
  ['B5', 4], ['G#5', 4], ['E5', 6], [null, 2],
];
const melody = (inst, shift = 0) => MELODY.map(([nn, d]) => (nn ? [inst, n(nn) + shift, d] : [null, null, d]));

const SONG = {
  // section A (intro, 4 bars), then loop: B (4 bars), C (8 bars), D (8 bars)
  intro: [
    ch1Section(),
    [[null, null, 32], [null, null, 32]],
    [['siren', n('A5'), 32], ['hold', null, 32]],
  ],
  loop: [
    [...ch1Section(), ...ch1Section(), ...ch1Section(), ...ch1Section(), ...ch1Section()],
    [...arpSection(), ...arpSection(), ...arpSection(), ...arpSection(), ...arpSection()],
    [...hatSection(), ...melody('whistle'), ...melody('lead', -12).slice(0, 19), ...melody('sync').slice(19)],
  ],
};

function encode(events) {
  const out = []; let inst = -1, dur = -1;
  for (const [i, note, steps] of events) {
    let left = steps; let first = true;
    while (left > 0) {
      const d = Math.min(32, left); left -= d;
      if (d !== dur) { out.push(0x5f + d); dur = d; }
      if (!first || i === 'hold') { out.push(0xfd); continue; }
      first = false;
      if (i === null) { out.push(0xfe); continue; }
      const idx = INAMES.indexOf(i); if (idx < 0) throw new Error(`unknown instrument ${i}`);
      if (idx !== inst) { out.push(0x80 | idx); inst = idx; }
      if (note < 0 || note > 0x5f) throw new Error(`note out of range ${note}`);
      out.push(note);
    }
  }
  return out;
}

function build() {
  const steps = (ev) => ev.reduce((s, e) => s + e[2], 0);
  for (const part of ['intro', 'loop']) {
    const lens = SONG[part].map(steps);
    if (new Set(lens).size !== 1) throw new Error(`voices out of sync in ${part}: ${lens}`);
  }
  // wavetable
  const wtWave = [], wtNote = [], ins = [];
  for (const name of INAMES) {
    const I = INSTR[name]; const start = wtWave.length;
    for (const [w, nn] of I.wt) { wtWave.push(w); wtNote.push(nn); }
    wtWave.push(0xff); wtNote.push(start + I.loop);
    ins.push({ ...I, start });
  }
  if (wtWave.length > 255) throw new Error('wavetable too long');
  const hex = (b) => '$' + (b & 0xff).toString(16).padStart(2, '0');
  const bytes = (label, arr) => {
    let s = `${label}:\n`;
    for (let i = 0; i < arr.length; i += 16) s += '        .byte ' + arr.slice(i, i + 16).map(hex).join(',') + '\n';
    return s;
  };
  let s = '; generated by tools/music.js - do not edit\n';
  s += bytes('freq_lo', freq.map((f) => f & 0xff)) + bytes('freq_hi', freq.map((f) => f >> 8));
  s += bytes('wt_wave', wtWave) + bytes('wt_note', wtNote);
  const col = (k, def = 0) => ins.map((I) => I[k] ?? def);
  s += bytes('ins_ad', col('ad')) + bytes('ins_sr', col('sr')) + bytes('ins_wt', col('start'));
  s += bytes('ins_pw', col('pw', 0x08)) + bytes('ins_pws', col('pws'));
  s += bytes('ins_vdep', col('vdep')) + bytes('ins_vspd', col('vspd')) + bytes('ins_vdel', col('vdel'));
  s += bytes('ins_flags', ins.map((I) => (I.filter ? 1 : 0) | (I.hr ? 2 : 0)));
  for (let v = 0; v < 3; v++) {
    s += bytes(`mus_v${v}`, encode(SONG.intro[v]));
    s += bytes(`mus_v${v}_loop`, [...encode(SONG.loop[v]), 0xff]);
  }
  s += 'mus_start_lo: .byte <mus_v0, <mus_v1, <mus_v2\n';
  s += 'mus_start_hi: .byte >mus_v0, >mus_v1, >mus_v2\n';
  s += 'mus_loop_lo: .byte <mus_v0_loop, <mus_v1_loop, <mus_v2_loop\n';
  s += 'mus_loop_hi: .byte >mus_v0_loop, >mus_v1_loop, >mus_v2_loop\n';
  return s;
}

module.exports = { buildMusic: build };
