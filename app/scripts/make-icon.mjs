// Generates the MonkeyPlay app icon: renders an SVG monkey face in Chromium at
// several sizes and packs them into build/icon.ico (Windows) plus a 256px PNG
// used as the in-app brand mark / favicon.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="SIZE" height="SIZE">
  <defs>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8bc95a"/>
      <stop offset="0.45" stop-color="#6aa53f"/>
      <stop offset="1" stop-color="#4c7a2b"/>
    </linearGradient>
  </defs>
  <rect x="6" y="6" width="244" height="244" rx="40" fill="url(#grass)" stroke="#3a5e20" stroke-width="6"/>
  <!-- ears -->
  <circle cx="58" cy="110" r="34" fill="#7a4a23"/>
  <circle cx="198" cy="110" r="34" fill="#7a4a23"/>
  <circle cx="58" cy="110" r="17" fill="#cf9450"/>
  <circle cx="198" cy="110" r="17" fill="#cf9450"/>
  <!-- head -->
  <ellipse cx="128" cy="128" rx="76" ry="72" fill="#7a4a23"/>
  <!-- muzzle -->
  <ellipse cx="128" cy="152" rx="58" ry="54" fill="#d79a52"/>
  <!-- forehead cap -->
  <path d="M64 104 q64 -52 128 0 q-64 30 -128 0 z" fill="#8a5628"/>
  <!-- eye whites -->
  <circle cx="103" cy="120" r="21" fill="#f3ead9"/>
  <circle cx="153" cy="120" r="21" fill="#f3ead9"/>
  <!-- pupils -->
  <circle cx="106" cy="123" r="10.5" fill="#221208"/>
  <circle cx="150" cy="123" r="10.5" fill="#221208"/>
  <circle cx="110" cy="118" r="3.4" fill="#ffffff"/>
  <circle cx="154" cy="118" r="3.4" fill="#ffffff"/>
  <!-- nostrils -->
  <ellipse cx="116" cy="162" rx="5.5" ry="7.5" fill="#5e3a1c"/>
  <ellipse cx="140" cy="162" rx="5.5" ry="7.5" fill="#5e3a1c"/>
  <!-- smile -->
  <path d="M102 180 q26 20 52 0" stroke="#5e3a1c" stroke-width="7" fill="none" stroke-linecap="round"/>
</svg>`;

const sizes = [256, 128, 64, 48, 32, 16];

function buildIco(images) {
  // images: [{ size, data: Buffer(png) }]
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 0); // width (0 = 256)
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 1); // height
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.data.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset
    offset += img.data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const images = [];
let png256;
for (const size of sizes) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent}</style></head><body>${svg.replaceAll("SIZE", String(size))}</body></html>`,
    { waitUntil: "networkidle" }
  );
  const data = await page.locator("svg").screenshot({ omitBackground: true });
  images.push({ size, data });
  if (size === 256) png256 = data;
}
await browser.close();

const buildDir = join(process.cwd(), "build");
await mkdir(buildDir, { recursive: true });
await writeFile(join(buildDir, "icon.ico"), buildIco(images));
await writeFile(join(buildDir, "icon.png"), png256);
// Renderer copy for favicon / brand mark.
await mkdir(join(process.cwd(), "src", "renderer", "assets"), { recursive: true });
await writeFile(join(process.cwd(), "src", "renderer", "assets", "monkey.png"), png256);

console.log(`Wrote build/icon.ico (${sizes.join(", ")}px), build/icon.png, src/renderer/assets/monkey.png`);
