// Generate the site icons from a pixel grid.
//
// Writes real PNG files with a tiny hand-rolled encoder (zlib is all Node
// needs for this), so there is no image library to install and the icons can
// be regenerated from source whenever the mark changes.
//
// Run: node tools/build_icons.mjs

import fs from "fs";
import path from "path";
import zlib from "zlib";

const OUT = new URL("../", import.meta.url).pathname;

// A glitched "M": the game is about a letter rendered wrong, so two rows of
// the mark slip sideways and change colour. Reads at 16px, holds at 512px.
const ICON = [
  "BBBBBBBBBBBBBBBB",
  "BBBBBBBBBBBBBBBB",
  "BBOOBBBBBBBBOOBB",
  "BBOOOBBBBBBOOOBB",
  "BBOOOOBBBBOOOOBB",
  "BBOOBOOBBOOBOOBB",
  "BBOOBBOOOOBBOOBB",
  "BBOOBBBOOBBBOOBB",
  "BBOOBBBBBBBBOOBB",
  "BBBBPPBBBBBBBBPP",
  "BBBBPPBBBBBBBBPP",
  "BBOOBBBBBBBBOOBB",
  "BBOOBBBBBBBBOOBB",
  "BBOOBBBBBBBBOOBB",
  "BBBBBBBBBBBBBBBB",
  "BBBBBBBBBBBBBBBB",
];



const PALETTE = {
  B: [0x6f, 0x2f, 0x96, 255], // window-title purple
  O: [0xef, 0xae, 0x1f, 255], // trophy gold
  P: [0xe6, 0x68, 0xae, 255], // title-bar pink
};

/* ---------- minimal PNG encoder ---------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  // One filter byte (0 = None) in front of every scanline.
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Nearest-neighbour scale of the grid: pixel art must never be smoothed. */
function rasterise(grid, size) {
  const cells = grid.length;
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const gy = Math.floor((y * cells) / size);
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x * cells) / size);
      const [r, g, b, a] = PALETTE[grid[gy][gx]] || [0, 0, 0, 0];
      const i = (y * size + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
    }
  }
  return rgba;
}

function svg(grid) {
  const n = grid.length;
  const hex = (ch) => "#" + PALETTE[ch].slice(0, 3)
    .map((v) => v.toString(16).padStart(2, "0")).join("");

  // One rect for the ground, then only the marks on top. Emitting a rect per
  // background run instead cost 70 rects and 4 KB for a mostly flat square.
  const rects = [`<rect width="${n}" height="${n}" fill="${hex("B")}"/>`];
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      const ch = grid[y][x];
      let len = 1;
      while (x + len < n && grid[y][x + len] === ch) len++;
      if (ch !== "B") {
        rects.push(
          `<rect x="${x}" y="${y}" width="${len}" height="1" fill="${hex(ch)}"/>`
        );
      }
      x += len;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" ` +
    `shape-rendering="crispEdges">${rects.join("")}</svg>\n`;
}

const sizes = { "favicon-32.png": 32, "apple-touch-icon.png": 180, "icon-512.png": 512 };
for (const [name, size] of Object.entries(sizes)) {
  const buf = encodePng(size, size, rasterise(ICON, size));
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(`${name.padEnd(22)} ${size}x${size}  ${buf.length} bytes`);
}
fs.writeFileSync(path.join(OUT, "icon.svg"), svg(ICON));
console.log("icon.svg".padEnd(22) + "vector");
