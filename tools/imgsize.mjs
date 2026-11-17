// Reads the pixel size of an image file from its header. Zero dependencies (Node 18+).
// Used by tools/build.mjs (writes the width and height attributes of the client logos) and tools/check.mjs
// (compares every <img> width/height attribute with the real file, so a picture can never be stretched by a wrong attribute).
// Supports PNG, JPEG, WebP (lossy, lossless, extended), GIF and SVG (viewBox, or width and height). Returns { w, h } or null.
import fs from "node:fs";
import path from "node:path";

export function imageSize(file) {
  let b;
  try { b = fs.readFileSync(file); } catch (e) { return null; }
  const ext = path.extname(file).toLowerCase();
  if (ext === ".svg") return svgSize(b.toString("utf8"));
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };                 // PNG: IHDR
  if (b.length > 10 && b.toString("latin1", 0, 3) === "GIF") return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };               // GIF
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) return jpeg(b);
  if (b.length > 30 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return webp(b);
  return null;
}

function jpeg(b) {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };   // start-of-frame marker
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

function webp(b) {
  const kind = b.toString("latin1", 12, 16);
  if (kind === "VP8 " && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };     // lossy
  if (kind === "VP8L" && b[20] === 0x2f) { const bits = b.readUInt32LE(21); return { w: (bits & 0x3fff) + 1, h: ((bits >>> 14) & 0x3fff) + 1 }; }               // lossless
  if (kind === "VP8X") return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };                                   // extended
  return null;
}

function svgSize(text) {
  const tag = (text.match(/<svg\b[^>]*>/i) || [""])[0];
  const num = (name) => { const m = tag.match(new RegExp(`\\s${name}="\\s*([\\d.]+)\\s*(?:px)?\\s*"`, "i")); return m ? parseFloat(m[1]) : null; };
  const vb = tag.match(/\sviewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/i);
  const w = num("width"), h = num("height");
  if (w && h) return { w: Math.round(w), h: Math.round(h) };
  if (vb) return { w: Math.round(parseFloat(vb[1])), h: Math.round(parseFloat(vb[2])) };
  return null;
}
