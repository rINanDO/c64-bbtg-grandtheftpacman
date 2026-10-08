// Renders the emulated C64 screen (text/multicolour text + sprites) to a PNG.
// The character ROM is not available, so ROM-charset text is drawn as placeholder blocks.
'use strict';
const fs = require('fs');
const zlib = require('zlib');

const PAL = [[0, 0, 0], [255, 255, 255], [136, 57, 50], [103, 182, 189], [139, 63, 150], [85, 160, 73], [64, 49, 141], [191, 206, 114],
  [139, 84, 41], [87, 66, 0], [184, 105, 98], [80, 80, 80], [120, 120, 120], [148, 224, 137], [120, 105, 196], [159, 159, 159]];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function render(m, file) {
  const W = 384, H = 272, img = Buffer.alloc(W * H * 3);
  const put = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 3; img[o] = PAL[c][0]; img[o + 1] = PAL[c][1]; img[o + 2] = PAL[c][2]; };
  const io = m.io, ram = m.ram;
  const cbase = (io[0x18] & 0x0e) * 0x400;
  const romChar = cbase === 0x1000 || cbase === 0x1800;
  const mc = io[0x16] & 0x10;
  const glyphRow = (ch, r) => {
    if (!romChar) return ram[cbase + ch * 8 + r];
    if (ch === 0x20) return 0;
    if (ch === 0xa0) return 0xff;
    if (ch === 0x66) return r & 1 ? 0x55 : 0xaa;
    return r === 7 ? 0 : 0x7e; // placeholder for ROM letters
  };
  for (let y = 0; y < H; y++) {
    const line = y + 16; const [bc, bg] = m.lineCol[line];
    for (let x = 0; x < W; x++) put(x, y, bc);
    if (line < 51 || line > 250) continue;
    const row = (line - 51) >> 3, rl = (line - 51) & 7;
    for (let col = 0; col < 40; col++) {
      const ch = ram[0x400 + row * 40 + col], color = io[0x800 + row * 40 + col] & 15, bits = glyphRow(ch, rl);
      for (let i = 0; i < 8; i++) {
        let c;
        if (mc && color & 8) { const p = (bits >> (6 - (i & 6))) & 3; c = [bg, io[0x22] & 15, io[0x23] & 15, color & 7][p]; }
        else c = bits & (0x80 >> i) ? color : bg;
        put(32 + col * 8 + i, y, c);
      }
    }
  }
  for (let s = 7; s >= 0; s--) {
    if (!(io[0x15] & (1 << s))) continue;
    const sx = io[s * 2] | ((io[0x10] >> s) & 1) << 8, sy = io[s * 2 + 1];
    const data = ram[0x7f8 + s] * 64, smc = io[0x1c] & (1 << s), ex = io[0x1d] & (1 << s) ? 2 : 1, ey = io[0x17] & (1 << s) ? 2 : 1;
    for (let r = 0; r < 21; r++) for (let px = 0; px < 24; px++) {
      const b = ram[data + r * 3 + (px >> 3)]; let c = -1;
      if (smc) { const p = (b >> (6 - (px & 6))) & 3; if (p) c = [0, io[0x25], io[0x27 + s], io[0x26]][p] & 15; }
      else if (b & (0x80 >> (px & 7))) c = io[0x27 + s] & 15;
      if (c < 0) continue;
      for (let dy = 0; dy < ey; dy++) for (let dx = 0; dx < ex; dx++) put(sx + 8 + px * ex + dx, sy - 16 + r * ey + dy, c);
    }
  }
  fs.writeFileSync(file, png(W, H, img));
}

module.exports = { render };
