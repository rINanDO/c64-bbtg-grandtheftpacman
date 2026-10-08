// Writes a standard 35-track 1541 D64 image containing PRG files.
'use strict';

const sectorsPerTrack = (t) => (t <= 17 ? 21 : t <= 24 ? 19 : t <= 30 ? 18 : 17);

function trackOffset(t) {
  let off = 0;
  for (let i = 1; i < t; i++) off += sectorsPerTrack(i) * 256;
  return off;
}

function petscii(str, len) {
  const out = new Array(len).fill(0xa0);
  for (let i = 0; i < Math.min(len, str.length); i++) out[i] = str.toUpperCase().charCodeAt(i);
  return out;
}

// files: [{ name, data: Uint8Array (incl. 2-byte load address) }]
function makeD64(diskName, diskId, files) {
  const img = new Uint8Array(174848);
  const used = {}; // track -> Set(sector)
  const markUsed = (t, s) => { (used[t] ||= new Set()).add(s); };
  const sec = (t, s) => img.subarray(trackOffset(t) + s * 256, trackOffset(t) + s * 256 + 256);

  markUsed(18, 0); markUsed(18, 1);

  // Allocate data sectors starting at track 17 going down, then 19 up (like the 1541 does), interleave 10.
  const trackOrder = [];
  for (let t = 17; t >= 1; t--) trackOrder.push(t);
  for (let t = 19; t <= 35; t++) trackOrder.push(t);
  let ti = 0, lastSector = 0;
  function alloc() {
    while (ti < trackOrder.length) {
      const t = trackOrder[ti]; const n = sectorsPerTrack(t);
      const u = used[t] || new Set();
      if (u.size >= n) { ti++; lastSector = 0; continue; }
      let s = (lastSector) % n;
      while (u.has(s)) s = (s + 1) % n;
      markUsed(t, s); lastSector = s + 10;
      return [t, s];
    }
    throw new Error('disk full');
  }

  const dirEntries = [];
  for (const f of files) {
    const chunks = [];
    for (let i = 0; i < f.data.length; i += 254) chunks.push(f.data.subarray(i, i + 254));
    const locs = chunks.map(() => alloc());
    chunks.forEach((c, i) => {
      const b = sec(...locs[i]);
      if (i + 1 < chunks.length) { b[0] = locs[i + 1][0]; b[1] = locs[i + 1][1]; }
      else { b[0] = 0; b[1] = c.length + 1; }
      b.set(c, 2);
    });
    dirEntries.push({ name: f.name, first: locs[0], blocks: chunks.length });
  }

  // Directory (single sector, up to 8 files)
  if (dirEntries.length > 8) throw new Error('too many files');
  const dir = sec(18, 1);
  dir[0] = 0; dir[1] = 0xff;
  dirEntries.forEach((e, i) => {
    const o = i * 32;
    dir[o + 2] = 0x82; // PRG, closed
    dir[o + 3] = e.first[0]; dir[o + 4] = e.first[1];
    dir.set(petscii(e.name, 16), o + 5);
    dir[o + 30] = e.blocks & 0xff; dir[o + 31] = e.blocks >> 8;
  });

  // BAM
  const bam = sec(18, 0);
  bam[0] = 18; bam[1] = 1; bam[2] = 0x41; bam[3] = 0;
  for (let t = 1; t <= 35; t++) {
    const n = sectorsPerTrack(t); const u = used[t] || new Set();
    let bits = 0;
    for (let s = 0; s < n; s++) if (!u.has(s)) bits |= 1 << s;
    const o = 4 * t;
    bam[o] = n - u.size; bam[o + 1] = bits & 0xff; bam[o + 2] = (bits >> 8) & 0xff; bam[o + 3] = (bits >> 16) & 0xff;
  }
  bam.set(petscii(diskName, 16), 0x90);
  bam[0xa0] = 0xa0; bam[0xa1] = 0xa0;
  bam[0xa2] = diskId.charCodeAt(0); bam[0xa3] = diskId.charCodeAt(1);
  bam[0xa4] = 0xa0; bam[0xa5] = 0x32; bam[0xa6] = 0x41;
  bam[0xa7] = bam[0xa8] = bam[0xa9] = bam[0xaa] = 0xa0;
  return img;
}

module.exports = { makeD64 };
