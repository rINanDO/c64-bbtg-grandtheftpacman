// Minimal two-pass 6502 assembler (legal opcodes only).
// Syntax: labels "name:", local labels "@name:" (scoped to last global label),
// equates "NAME = expr", directives .org .byte .word .text .scr .fill .align .assert .include
'use strict';
const fs = require('fs');
const path = require('path');

const OPS = {
  adc:{imm:0x69,zp:0x65,zpx:0x75,abs:0x6d,abx:0x7d,aby:0x79,izx:0x61,izy:0x71},
  and:{imm:0x29,zp:0x25,zpx:0x35,abs:0x2d,abx:0x3d,aby:0x39,izx:0x21,izy:0x31},
  asl:{acc:0x0a,zp:0x06,zpx:0x16,abs:0x0e,abx:0x1e},
  bcc:{rel:0x90},bcs:{rel:0xb0},beq:{rel:0xf0},bmi:{rel:0x30},bne:{rel:0xd0},bpl:{rel:0x10},bvc:{rel:0x50},bvs:{rel:0x70},
  bit:{zp:0x24,abs:0x2c},
  brk:{imp:0x00},clc:{imp:0x18},cld:{imp:0xd8},cli:{imp:0x58},clv:{imp:0xb8},
  cmp:{imm:0xc9,zp:0xc5,zpx:0xd5,abs:0xcd,abx:0xdd,aby:0xd9,izx:0xc1,izy:0xd1},
  cpx:{imm:0xe0,zp:0xe4,abs:0xec},cpy:{imm:0xc0,zp:0xc4,abs:0xcc},
  dec:{zp:0xc6,zpx:0xd6,abs:0xce,abx:0xde},dex:{imp:0xca},dey:{imp:0x88},
  eor:{imm:0x49,zp:0x45,zpx:0x55,abs:0x4d,abx:0x5d,aby:0x59,izx:0x41,izy:0x51},
  inc:{zp:0xe6,zpx:0xf6,abs:0xee,abx:0xfe},inx:{imp:0xe8},iny:{imp:0xc8},
  jmp:{abs:0x4c,ind:0x6c},jsr:{abs:0x20},
  lda:{imm:0xa9,zp:0xa5,zpx:0xb5,abs:0xad,abx:0xbd,aby:0xb9,izx:0xa1,izy:0xb1},
  ldx:{imm:0xa2,zp:0xa6,zpy:0xb6,abs:0xae,aby:0xbe},
  ldy:{imm:0xa0,zp:0xa4,zpx:0xb4,abs:0xac,abx:0xbc},
  lsr:{acc:0x4a,zp:0x46,zpx:0x56,abs:0x4e,abx:0x5e},
  nop:{imp:0xea},
  ora:{imm:0x09,zp:0x05,zpx:0x15,abs:0x0d,abx:0x1d,aby:0x19,izx:0x01,izy:0x11},
  pha:{imp:0x48},php:{imp:0x08},pla:{imp:0x68},plp:{imp:0x28},
  rol:{acc:0x2a,zp:0x26,zpx:0x36,abs:0x2e,abx:0x3e},
  ror:{acc:0x6a,zp:0x66,zpx:0x76,abs:0x6e,abx:0x7e},
  rti:{imp:0x40},rts:{imp:0x60},
  sbc:{imm:0xe9,zp:0xe5,zpx:0xf5,abs:0xed,abx:0xfd,aby:0xf9,izx:0xe1,izy:0xf1},
  sec:{imp:0x38},sed:{imp:0xf8},sei:{imp:0x78},
  sta:{zp:0x85,zpx:0x95,abs:0x8d,abx:0x9d,aby:0x99,izx:0x81,izy:0x91},
  stx:{zp:0x86,zpy:0x96,abs:0x8e},sty:{zp:0x84,zpx:0x94,abs:0x8c},
  tax:{imp:0xaa},tay:{imp:0xa8},tsx:{imp:0xba},txa:{imp:0x8a},txs:{imp:0x9a},tya:{imp:0x98},
};
const SIZE = {imp:1,acc:1,imm:2,zp:2,zpx:2,zpy:2,abs:3,abx:3,aby:3,ind:3,izx:2,izy:2,rel:2};

class AsmError extends Error {}

function toScreenCode(ch) {
  const c = ch.charCodeAt(0);
  if (c >= 0x61 && c <= 0x7a) return c - 0x60;   // a-z -> 1-26
  if (c >= 0x40 && c <= 0x5f) return c - 0x40;   // @A-Z[\]^_ -> 0-31
  if (c >= 0x20 && c <= 0x3f) return c;          // space, digits, punctuation
  throw new AsmError(`no screen code for '${ch}'`);
}

function loadSource(file, out = []) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((text, i) => {
    const m = text.match(/^\s*\.include\s+"([^"]+)"/i);
    if (m) loadSource(path.resolve(path.dirname(file), m[1]), out);
    else out.push({ text, file: path.basename(file), line: i + 1 });
  });
  return out;
}

function stripComment(s) {
  let q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"') { q = c; continue; }
    if (c === "'" && s[i + 2] === "'") { i += 2; continue; }
    if (c === ';') return s.slice(0, i);
  }
  return s;
}

function splitArgs(s) {
  const out = []; let cur = ''; let q = false; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === '"') q = false; continue; }
    if (c === '"') { q = true; cur += c; continue; }
    if (c === "'" && s[i + 2] === "'") { cur += s.slice(i, i + 3); i += 2; continue; }
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim() !== '') out.push(cur.trim());
  return out;
}

class Assembler {
  constructor() { this.syms = new Map(); }

  resolveName(name) {
    if (name.startsWith('@')) return this.scope + name;
    return name;
  }

  // Returns number, or undefined if a symbol is not (yet) defined.
  evaluate(expr) {
    const toks = expr.match(/\$[0-9a-fA-F]+|%[01]+|\d+|'.'|[A-Za-z_@.][\w.@]*|<<|>>|[-+*\/&|^~<>()\[\]]/g);
    if (!toks || toks.join('').replace(/\s/g, '') !== expr.replace(/\s/g, ''))
      throw new AsmError(`bad expression '${expr}'`);
    let p = 0; let undef = false;
    const peek = () => toks[p];
    const next = () => toks[p++];
    const primary = () => {
      const t = next();
      if (t === undefined) throw new AsmError(`unexpected end of expression '${expr}'`);
      if (t === '(' || t === '[') { const v = binary(0); const c = next(); if (c !== ')' && c !== ']') throw new AsmError(`missing ) in '${expr}'`); return v; }
      if (t === '-') return -primary();
      if (t === '~') return ~primary();
      if (t === '<') return primary() & 0xff;
      if (t === '>') return (primary() >> 8) & 0xff;
      if (t === '*') return this.pc;
      if (t[0] === '$') return parseInt(t.slice(1), 16);
      if (t[0] === '%') return parseInt(t.slice(1), 2);
      if (t[0] === "'") return t.charCodeAt(1);
      if (/^\d/.test(t)) return parseInt(t, 10);
      const name = this.resolveName(t);
      if (this.syms.has(name)) return this.syms.get(name);
      undef = true; return 0;
    };
    const PREC = { '|': 1, '^': 2, '&': 3, '<<': 4, '>>': 4, '+': 5, '-': 5, '*': 6, '/': 6 };
    const binary = (minPrec) => {
      let lhs = primary();
      for (;;) {
        const op = peek();
        const pr = PREC[op];
        if (pr === undefined || pr <= minPrec) break;
        next();
        const rhs = binary(pr);
        switch (op) {
          case '|': lhs |= rhs; break; case '^': lhs ^= rhs; break; case '&': lhs &= rhs; break;
          case '<<': lhs <<= rhs; break; case '>>': lhs >>= rhs; break;
          case '+': lhs += rhs; break; case '-': lhs -= rhs; break;
          case '*': lhs *= rhs; break; case '/': lhs = Math.trunc(lhs / rhs); break;
        }
      }
      return lhs;
    };
    const v = binary(0);
    if (p !== toks.length) throw new AsmError(`trailing tokens in '${expr}'`);
    return undef ? undefined : v;
  }

  parseOperand(mn, opnd) {
    const modes = OPS[mn];
    if (opnd === '') return modes.imp !== undefined ? { mode: 'imp' } : { mode: 'acc' };
    if (/^a$/i.test(opnd) && modes.acc !== undefined) return { mode: 'acc' };
    if (modes.rel !== undefined) return { mode: 'rel', expr: opnd };
    if (opnd[0] === '#') return { mode: 'imm', expr: opnd.slice(1) };
    let m;
    if ((m = opnd.match(/^\((.*)\)\s*,\s*y$/i))) return { mode: 'izy', expr: m[1] };
    if ((m = opnd.match(/^\((.*),\s*x\)$/i))) return { mode: 'izx', expr: m[1] };
    if (mn === 'jmp' && (m = opnd.match(/^\((.*)\)$/))) return { mode: 'ind', expr: m[1] };
    if ((m = opnd.match(/^(.*),\s*x$/i))) return { mode: 'x', expr: m[1] };
    if ((m = opnd.match(/^(.*),\s*y$/i))) return { mode: 'y', expr: m[1] };
    return { mode: 'a', expr: opnd };
  }

  // Pick concrete addressing mode given value (or undefined = assume 16 bit).
  pickMode(mn, kind, val, forced) {
    const modes = OPS[mn];
    if (forced) return forced;
    const zp = val !== undefined && val >= 0 && val < 256;
    const pick = (z, a) => (zp && modes[z] !== undefined) ? z : (modes[a] !== undefined ? a : z);
    if (kind === 'a') return pick('zp', 'abs');
    if (kind === 'x') return pick('zpx', 'abx');
    if (kind === 'y') return pick('zpy', 'aby');
    return kind;
  }

  assemble(file) {
    const src = loadSource(file);
    let sizes = new Map();
    for (let pass = 1; pass <= 2; pass++) {
      this.pc = 0; this.scope = ''; this.out = new Map(); this.origin = undefined; this.pass = pass;
      src.forEach((ln, idx) => {
        try { this.line(ln, idx, pass, sizes); }
        catch (e) {
          if (e instanceof AsmError) throw new Error(`${ln.file}:${ln.line}: ${e.message}\n    ${ln.text.trim()}`);
          throw e;
        }
      });
    }
    const addrs = [...this.out.keys()];
    const lo = Math.min(...addrs), hi = Math.max(...addrs);
    const bin = new Uint8Array(hi - lo + 1);
    for (const [a, v] of this.out) bin[a - lo] = v;
    return { start: lo, bin, syms: this.syms };
  }

  emit(b) {
    if (this.out.has(this.pc)) throw new AsmError(`overlapping output at $${this.pc.toString(16)}`);
    this.out.set(this.pc, b & 0xff); this.pc++;
  }

  need(expr) {
    const v = this.evaluate(expr);
    if (v === undefined) {
      if (this.pass === 2) throw new AsmError(`undefined symbol in '${expr}'`);
      return 0;
    }
    return v;
  }

  line(ln, idx, pass, sizes) {
    let s = stripComment(ln.text).trim();
    if (!s) return;
    let m;
    // equate
    if ((m = s.match(/^([A-Za-z_][\w.]*)\s*=\s*(.+)$/))) {
      const v = this.evaluate(m[2]);
      if (v === undefined) { if (pass === 2) throw new AsmError(`undefined symbol in '${m[2]}'`); return; }
      this.syms.set(m[1], v); return;
    }
    // label
    if ((m = s.match(/^(@?[A-Za-z_][\w.]*):\s*(.*)$/))) {
      const name = m[1];
      if (!name.startsWith('@')) this.scope = name;
      const full = this.resolveName(name);
      if (pass === 1 && this.syms.has(full)) throw new AsmError(`duplicate label ${full}`);
      this.syms.set(full, this.pc);
      s = m[2].trim();
      if (!s) return;
    }
    if (s[0] === '.') return this.directive(s);
    m = s.match(/^([A-Za-z]{3})\b\s*(.*)$/);
    if (!m) throw new AsmError(`cannot parse '${s}'`);
    const mn = m[1].toLowerCase();
    if (!OPS[mn]) throw new AsmError(`unknown mnemonic '${mn}'`);
    const op = this.parseOperand(mn, m[2].trim());
    let val = op.expr !== undefined ? this.evaluate(op.expr) : undefined;
    let mode;
    if (pass === 1) { mode = this.pickMode(mn, op.mode, val); sizes.set(idx, mode); }
    else mode = sizes.get(idx);
    const opc = OPS[mn][mode];
    if (opc === undefined) throw new AsmError(`addressing mode ${mode} not valid for ${mn}`);
    if (pass === 2 && op.expr !== undefined && val === undefined) throw new AsmError(`undefined symbol in '${op.expr}'`);
    val = val || 0;
    const at = this.pc;
    this.emit(opc);
    const size = SIZE[mode];
    if (mode === 'rel') {
      const off = val - (at + 2);
      if (pass === 2 && (off < -128 || off > 127)) throw new AsmError(`branch out of range (${off})`);
      this.emit(off);
    } else if (size === 2) {
      if (pass === 2 && (val < -128 || val > 255)) throw new AsmError(`value out of byte range: ${val}`);
      this.emit(val);
    } else if (size === 3) { this.emit(val); this.emit(val >> 8); }
  }

  directive(s) {
    const m = s.match(/^\.(\w+)\s*(.*)$/);
    const d = m[1].toLowerCase(); const rest = m[2];
    const args = splitArgs(rest);
    switch (d) {
      case 'org': {
        const v = this.need(args[0]);
        if (this.origin !== undefined && v < this.pc) throw new AsmError(`.org $${v.toString(16)} moves backwards (pc=$${this.pc.toString(16)})`);
        if (this.origin === undefined) this.origin = v;
        this.pc = v; return;
      }
      case 'byte':
        for (const a of args) {
          const v = this.need(a);
          if (this.pass === 2 && (v < -128 || v > 255)) throw new AsmError(`byte out of range: ${a}=${v}`);
          this.emit(v);
        }
        return;
      case 'word': for (const a of args) { const v = this.need(a); this.emit(v); this.emit(v >> 8); } return;
      case 'text': case 'scr':
        for (const a of args) {
          if (a[0] === '"') {
            for (const ch of a.slice(1, -1)) this.emit(d === 'scr' ? toScreenCode(ch) : ch.charCodeAt(0));
          } else this.emit(this.need(a));
        }
        return;
      case 'fill': { const n = this.need(args[0]); const v = args[1] ? this.need(args[1]) : 0; for (let i = 0; i < n; i++) this.emit(v); return; }
      case 'align': { const n = this.need(args[0]); while (this.pc % n) this.emit(0); return; }
      case 'assert': {
        if (this.pass === 2 && !this.need(args[0])) throw new AsmError(`assertion failed: ${args[1] || args[0]}`);
        return;
      }
      default: throw new AsmError(`unknown directive .${d}`);
    }
  }
}

// Comparison operators for .assert: support "a <= b" style by rewriting.
const origEval = Assembler.prototype.evaluate;
Assembler.prototype.evaluate = function (expr) {
  const m = expr.match(/^(.*?)(<=|>=|==|!=)(.*)$/);
  if (m) {
    const a = origEval.call(this, m[1].trim()), b = origEval.call(this, m[3].trim());
    if (a === undefined || b === undefined) return undefined;
    return { '<=': a <= b, '>=': a >= b, '==': a === b, '!=': a !== b }[m[2]] ? 1 : 0;
  }
  return origEval.call(this, expr);
};

module.exports = { Assembler, toScreenCode, OPS };
