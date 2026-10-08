// Tiny 6502 + C64-ish harness for smoke testing the game without VICE.
// Emulates the CPU (incl. decimal mode), RAM, $01 banking, raster counter,
// joystick port 2 and the keyboard matrix. No video: the screen RAM is dumped as text.
'use strict';

class CPU {
  constructor(bus) { this.bus = bus; this.a = this.x = this.y = 0; this.sp = 0xff; this.p = 0x24; this.pc = 0; this.cycles = 0; }
  rd(a) { return this.bus.read(a & 0xffff); }
  wr(a, v) { this.bus.write(a & 0xffff, v & 0xff); }
  rd16(a) { return this.rd(a) | (this.rd(a + 1) << 8); }
  push(v) { this.wr(0x100 | this.sp, v); this.sp = (this.sp - 1) & 0xff; }
  pop() { this.sp = (this.sp + 1) & 0xff; return this.rd(0x100 | this.sp); }
  nz(v) { this.p = (this.p & ~0x82) | (v & 0x80) | ((v & 0xff) === 0 ? 2 : 0); return v & 0xff; }
  flag(m, on) { this.p = on ? this.p | m : this.p & ~m; }
  get c() { return this.p & 1; }

  adc(v) {
    const c = this.c;
    if (this.p & 8) {
      let lo = (this.a & 0xf) + (v & 0xf) + c; let hi = (this.a >> 4) + (v >> 4);
      if (lo > 9) { lo += 6; hi++; }
      const bin = (this.a + v + c) & 0xff;
      this.flag(2, bin === 0);
      this.flag(0x80, hi & 8);
      this.flag(0x40, (~(this.a ^ v) & (this.a ^ (hi << 4)) & 0x80));
      if (hi > 9) hi += 6;
      this.flag(1, hi > 15);
      this.a = ((hi << 4) | (lo & 0xf)) & 0xff;
    } else {
      const r = this.a + v + c;
      this.flag(1, r > 0xff); this.flag(0x40, (~(this.a ^ v) & (this.a ^ r) & 0x80));
      this.a = this.nz(r);
    }
  }
  sbc(v) {
    const c = this.c;
    const r = this.a - v - (1 - c);
    if (this.p & 8) {
      let lo = (this.a & 0xf) - (v & 0xf) - (1 - c); let hi = (this.a >> 4) - (v >> 4);
      if (lo < 0) { lo -= 6; hi--; }
      if (hi < 0) hi -= 6;
      this.flag(1, r >= 0); this.flag(0x40, ((this.a ^ v) & (this.a ^ r) & 0x80)); this.nz(r & 0xff);
      this.a = ((hi << 4) | (lo & 0xf)) & 0xff;
    } else {
      this.flag(1, r >= 0); this.flag(0x40, ((this.a ^ v) & (this.a ^ r) & 0x80));
      this.a = this.nz(r);
    }
  }
  cmp(r, v) { const t = r - v; this.flag(1, t >= 0); this.nz(t & 0xff); }

  step() {
    const op = this.rd(this.pc); const at = this.pc; this.pc = (this.pc + 1) & 0xffff;
    const imm = () => { const v = this.rd(this.pc); this.pc = (this.pc + 1) & 0xffff; return v; };
    const abs = () => { const v = this.rd16(this.pc); this.pc = (this.pc + 2) & 0xffff; return v; };
    const M = {
      imm: () => { const a = this.pc; this.pc++; return a; },
      zp: () => imm(), zpx: () => (imm() + this.x) & 0xff, zpy: () => (imm() + this.y) & 0xff,
      abs: () => abs(), abx: () => (abs() + this.x) & 0xffff, aby: () => (abs() + this.y) & 0xffff,
      izx: () => { const z = (imm() + this.x) & 0xff; return this.rd(z) | (this.rd((z + 1) & 0xff) << 8); },
      izy: () => { const z = imm(); return ((this.rd(z) | (this.rd((z + 1) & 0xff) << 8)) + this.y) & 0xffff; },
    };
    const d = DECODE[op];
    if (!d) throw new Error(`illegal opcode $${op.toString(16)} at $${at.toString(16)}`);
    const [mn, mode] = d;
    this.cycles += cyclesFor(mn, mode);
    const addr = () => M[mode]();
    const rmw = (fn) => { if (mode === 'acc') { this.a = fn(this.a); return; } const a = addr(); this.wr(a, fn(this.rd(a))); };
    const br = (cond) => { const o = imm(); if (cond) this.pc = (this.pc + ((o ^ 0x80) - 0x80)) & 0xffff; };
    switch (mn) {
      case 'lda': this.a = this.nz(this.rd(addr())); break;
      case 'ldx': this.x = this.nz(this.rd(addr())); break;
      case 'ldy': this.y = this.nz(this.rd(addr())); break;
      case 'sta': this.wr(addr(), this.a); break;
      case 'stx': this.wr(addr(), this.x); break;
      case 'sty': this.wr(addr(), this.y); break;
      case 'adc': this.adc(this.rd(addr())); break;
      case 'sbc': this.sbc(this.rd(addr())); break;
      case 'and': this.a = this.nz(this.a & this.rd(addr())); break;
      case 'ora': this.a = this.nz(this.a | this.rd(addr())); break;
      case 'eor': this.a = this.nz(this.a ^ this.rd(addr())); break;
      case 'cmp': this.cmp(this.a, this.rd(addr())); break;
      case 'cpx': this.cmp(this.x, this.rd(addr())); break;
      case 'cpy': this.cmp(this.y, this.rd(addr())); break;
      case 'bit': { const v = this.rd(addr()); this.flag(2, (this.a & v) === 0); this.p = (this.p & 0x3f) | (v & 0xc0); break; }
      case 'inc': rmw((v) => this.nz(v + 1)); break;
      case 'dec': rmw((v) => this.nz(v - 1)); break;
      case 'asl': rmw((v) => { this.flag(1, v & 0x80); return this.nz(v << 1); }); break;
      case 'lsr': rmw((v) => { this.flag(1, v & 1); return this.nz(v >> 1); }); break;
      case 'rol': rmw((v) => { const c = this.c; this.flag(1, v & 0x80); return this.nz((v << 1) | c); }); break;
      case 'ror': rmw((v) => { const c = this.c; this.flag(1, v & 1); return this.nz((v >> 1) | (c << 7)); }); break;
      case 'inx': this.x = this.nz(this.x + 1); break;
      case 'iny': this.y = this.nz(this.y + 1); break;
      case 'dex': this.x = this.nz(this.x - 1); break;
      case 'dey': this.y = this.nz(this.y - 1); break;
      case 'tax': this.x = this.nz(this.a); break;
      case 'tay': this.y = this.nz(this.a); break;
      case 'txa': this.a = this.nz(this.x); break;
      case 'tya': this.a = this.nz(this.y); break;
      case 'tsx': this.x = this.nz(this.sp); break;
      case 'txs': this.sp = this.x; break;
      case 'pha': this.push(this.a); break;
      case 'pla': this.a = this.nz(this.pop()); break;
      case 'php': this.push(this.p | 0x30); break;
      case 'plp': this.p = this.pop() | 0x20; break;
      case 'clc': this.flag(1, 0); break; case 'sec': this.flag(1, 1); break;
      case 'cld': this.flag(8, 0); break; case 'sed': this.flag(8, 1); break;
      case 'cli': this.flag(4, 0); break; case 'sei': this.flag(4, 1); break;
      case 'clv': this.flag(0x40, 0); break; case 'nop': break;
      case 'bcc': br(!(this.p & 1)); break; case 'bcs': br(this.p & 1); break;
      case 'beq': br(this.p & 2); break; case 'bne': br(!(this.p & 2)); break;
      case 'bmi': br(this.p & 0x80); break; case 'bpl': br(!(this.p & 0x80)); break;
      case 'bvc': br(!(this.p & 0x40)); break; case 'bvs': br(this.p & 0x40); break;
      case 'jmp': this.pc = mode === 'abs' ? abs() : (() => { const p = abs(); return this.rd(p) | (this.rd((p & 0xff00) | ((p + 1) & 0xff)) << 8); })(); break;
      case 'jsr': { const t = abs(); const r = (this.pc - 1) & 0xffff; this.push(r >> 8); this.push(r & 0xff); this.pc = t; break; }
      case 'rts': { const l = this.pop(); const h = this.pop(); this.pc = (((h << 8) | l) + 1) & 0xffff; break; }
      case 'rti': { this.p = this.pop() | 0x20; const l = this.pop(); const h = this.pop(); this.pc = (h << 8) | l; break; }
      case 'brk': throw new Error(`BRK at $${at.toString(16)}`);
      default: throw new Error(`unimplemented ${mn}`);
    }
  }
}

// approximate 6502 cycle counts (ignores page-crossing penalties)
const BASE = { imp: 2, acc: 2, imm: 2, zp: 3, zpx: 4, zpy: 4, abs: 4, abx: 4, aby: 4, izx: 6, izy: 5, rel: 3, ind: 5 };
const RMW = new Set(['inc', 'dec', 'asl', 'lsr', 'rol', 'ror']);
function cyclesFor(mn, mode) {
  if (mn === 'jsr' || mn === 'rts' || mn === 'rti') return 6;
  if (mn === 'jmp') return mode === 'abs' ? 3 : 5;
  if (mn === 'pha' || mn === 'php') return 3;
  if (mn === 'pla' || mn === 'plp') return 4;
  if (RMW.has(mn) && mode !== 'acc') return BASE[mode] + 2 + (mode === 'abx' ? 1 : 0);
  if (mn === 'sta' && (mode === 'abx' || mode === 'aby' || mode === 'izy')) return BASE[mode] + 1;
  return BASE[mode];
}

const DECODE = {};
{
  const { OPS } = require('./asm');
  for (const [mn, modes] of Object.entries(OPS)) for (const [mode, code] of Object.entries(modes)) DECODE[code] = [mn, mode];
}

class C64 {
  constructor() {
    this.ram = new Uint8Array(65536); this.io = new Uint8Array(0x1000);
    this.ram[1] = 0x37; this.cpu = new CPU(this);
    this.joy = 0;            // bits: 0 up 1 down 2 left 3 right 4 fire (1 = pressed)
    this.keys = new Set();   // "PA,PB" pairs pressed
    this.io[0xc00] = 0x7f;
  }
  raster() { return Math.floor(this.cpu.cycles / 63) % 312; }
  read(a) {
    if (a >= 0xd000 && a < 0xe000) {
      const b = this.ram[1] & 7;
      if ((b & 3) === 0) return this.ram[a];
      if (!(b & 4)) return 0x55; // character ROM (content irrelevant here)
      const r = a - 0xd000;
      if (r === 0x12) return this.raster() & 0xff;
      if (r === 0x11) return (this.io[r] & 0x7f) | ((this.raster() >> 8) << 7);
      if (r === 0xc00) return this.io[r] & ~this.joy & 0xff;
      if (r === 0xc01) {
        let v = 0xff; const sel = this.io[0xc00];
        for (const k of this.keys) { const [pa, pb] = k.split(',').map(Number); if (!(sel & (1 << pa))) v &= ~(1 << pb); }
        return v;
      }
      return this.io[r];
    }
    return this.ram[a];
  }
  write(a, v) {
    if (a >= 0xd000 && a < 0xe000 && (this.ram[1] & 7) & 4 && (this.ram[1] & 3)) { this.io[a - 0xd000] = v; return; }
    this.ram[a] = v;
  }
  load(prg) { const at = prg[0] | (prg[1] << 8); this.ram.set(prg.subarray(2), at); return at; }
  runFrames(n, onFrame) {
    for (let f = 0; f < n; f++) {
      const end = this.cpu.cycles + 19656;
      while (this.cpu.cycles < end) {
        const pc = this.cpu.pc;
        if (pc < 0x0801 || (pc >= 0x3000 && pc < 0x4000) || pc >= 0xa000) throw new Error(`PC escaped to $${pc.toString(16)}`);
        this.cpu.step();
      }
      if (onFrame) onFrame(f);
    }
  }
  screenText() {
    const map = (c) => {
      if (c >= 1 && c <= 26) return String.fromCharCode(64 + c);
      if (c >= 0x20 && c < 0x40) return String.fromCharCode(c);
      return { 0: '@', 0x40: '.', 0x41: '$', 0x42: '=', 0x43: 'c', 0x44: '*' }[c] || (c >= 0x48 ? '#' : '?');
    };
    let s = '';
    for (let r = 0; r < 25; r++) { for (let c = 0; c < 40; c++) s += map(this.ram[0x400 + r * 40 + c]); s += '\n'; }
    return s;
  }
}

module.exports = { C64 };
