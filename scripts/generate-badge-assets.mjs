import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, "../src/assets/badges");
const SIZE = 512;
const CENTER = SIZE / 2;

const badges = [
  {
    key: "eye",
    palette: {
      ringLight: "#fef3c7",
      ringDark: "#f59e0b",
      bgTop: "#155e75",
      bgBottom: "#0e7490",
      glow: "#67e8f9",
      symbol: "#e0f2fe",
      symbolDetail: "#0f172a",
    },
    symbol: (p) => `
      <path d="M128 292 C174 238, 338 238, 384 292 C338 344, 174 344, 128 292 Z" fill="none" stroke="${p.symbol}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${CENTER}" cy="292" r="40" fill="${p.symbol}"/>
      <circle cx="${CENTER}" cy="292" r="16" fill="${p.symbolDetail}"/>
      <path d="M170 228 C214 205, 298 205, 342 228" fill="none" stroke="${p.glow}" stroke-width="10" stroke-linecap="round"/>
      <path d="M164 366 C214 342, 298 342, 348 366" fill="none" stroke="${p.glow}" stroke-width="10" stroke-linecap="round"/>
    `,
  },
  {
    key: "shield",
    palette: {
      ringLight: "#d1fae5",
      ringDark: "#10b981",
      bgTop: "#0f766e",
      bgBottom: "#0f766e",
      glow: "#5eead4",
      symbol: "#ecfeff",
      symbolDetail: "#0f172a",
    },
    symbol: (p) => `
      <path d="M256 138 L154 186 V250 C154 328 209 396 256 410 C303 396 358 328 358 250 V186 Z" fill="none" stroke="${p.symbol}" stroke-width="18" stroke-linejoin="round"/>
      <path d="M214 274 L244 304 L304 234" fill="none" stroke="${p.glow}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M256 170 V340" stroke="${p.symbolDetail}" stroke-opacity="0.35" stroke-width="7" stroke-linecap="round"/>
    `,
  },
  {
    key: "wave",
    palette: {
      ringLight: "#bae6fd",
      ringDark: "#0284c7",
      bgTop: "#1d4ed8",
      bgBottom: "#0369a1",
      glow: "#7dd3fc",
      symbol: "#e0f2fe",
      symbolDetail: "#1e3a8a",
    },
    symbol: (p) => `
      <path d="M110 270 C156 222, 198 238, 228 282 C264 334, 304 344, 372 308" fill="none" stroke="${p.symbol}" stroke-width="22" stroke-linecap="round"/>
      <path d="M126 338 C174 302, 220 306, 260 340 C300 374, 336 370, 392 340" fill="none" stroke="${p.glow}" stroke-width="16" stroke-linecap="round"/>
      <path d="M152 224 C190 190, 246 188, 292 216" fill="none" stroke="${p.glow}" stroke-width="10" stroke-linecap="round"/>
      <circle cx="330" cy="230" r="14" fill="${p.symbol}"/>
      <circle cx="330" cy="230" r="5" fill="${p.symbolDetail}"/>
    `,
  },
  {
    key: "beach",
    palette: {
      ringLight: "#fde68a",
      ringDark: "#f97316",
      bgTop: "#fdba74",
      bgBottom: "#ea580c",
      glow: "#fde68a",
      symbol: "#fff7ed",
      symbolDetail: "#7c2d12",
    },
    symbol: (p) => `
      <path d="M130 356 C190 312, 322 312, 382 356" fill="none" stroke="${p.symbol}" stroke-width="16" stroke-linecap="round"/>
      <path d="M188 260 C226 210, 302 210, 340 260" fill="${p.symbol}" fill-opacity="0.22" stroke="${p.symbol}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M256 356 V228" stroke="${p.symbol}" stroke-width="12" stroke-linecap="round"/>
      <circle cx="256" cy="205" r="24" fill="${p.glow}"/>
      <path d="M150 386 H362" stroke="${p.symbolDetail}" stroke-opacity="0.28" stroke-width="7" stroke-linecap="round"/>
    `,
  },
  {
    key: "lighthouse",
    palette: {
      ringLight: "#ddd6fe",
      ringDark: "#8b5cf6",
      bgTop: "#4338ca",
      bgBottom: "#312e81",
      glow: "#c4b5fd",
      symbol: "#eef2ff",
      symbolDetail: "#1e1b4b",
    },
    symbol: (p) => `
      <rect x="228" y="160" width="56" height="220" rx="16" fill="none" stroke="${p.symbol}" stroke-width="14"/>
      <path d="M216 380 H296" stroke="${p.symbol}" stroke-width="14" stroke-linecap="round"/>
      <path d="M238 160 V132 H274 V160" stroke="${p.symbol}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M284 208 L364 170" stroke="${p.glow}" stroke-width="12" stroke-linecap="round"/>
      <path d="M228 208 L148 170" stroke="${p.glow}" stroke-width="12" stroke-linecap="round"/>
      <path d="M228 252 H284" stroke="${p.symbolDetail}" stroke-opacity="0.34" stroke-width="8" stroke-linecap="round"/>
    `,
  },
  {
    key: "sun",
    palette: {
      ringLight: "#fef9c3",
      ringDark: "#f59e0b",
      bgTop: "#f59e0b",
      bgBottom: "#b45309",
      glow: "#fde68a",
      symbol: "#fffbeb",
      symbolDetail: "#78350f",
    },
    symbol: (p) => `
      <circle cx="${CENTER}" cy="266" r="58" fill="none" stroke="${p.symbol}" stroke-width="16"/>
      <circle cx="${CENTER}" cy="266" r="26" fill="${p.symbol}"/>
      <path d="M256 148 V184 M256 348 V384 M138 266 H174 M338 266 H374 M176 186 L201 211 M311 321 L336 346 M176 346 L201 321 M311 211 L336 186" stroke="${p.glow}" stroke-width="11" stroke-linecap="round"/>
      <path d="M130 382 C188 346, 324 346, 382 382" fill="none" stroke="${p.symbolDetail}" stroke-opacity="0.25" stroke-width="8" stroke-linecap="round"/>
    `,
  },
];

const toSvg = ({ palette, symbol }) => `
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${CENTER} 170) rotate(90) scale(280)">
      <stop offset="0" stop-color="${palette.bgTop}" />
      <stop offset="1" stop-color="${palette.bgBottom}" />
    </radialGradient>
    <linearGradient id="ring" x1="120" y1="96" x2="392" y2="416" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${palette.ringLight}" />
      <stop offset="1" stop-color="${palette.ringDark}" />
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${CENTER} 158) rotate(90) scale(144)">
      <stop offset="0" stop-color="${palette.glow}" stop-opacity="0.6" />
      <stop offset="1" stop-color="${palette.glow}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <circle cx="${CENTER}" cy="${CENTER}" r="212" fill="url(#ring)"/>
  <circle cx="${CENTER}" cy="${CENTER}" r="186" fill="url(#bg)"/>
  <circle cx="${CENTER}" cy="188" r="132" fill="url(#glow)"/>
  <ellipse cx="${CENTER}" cy="152" rx="112" ry="42" fill="#FFFFFF" fill-opacity="0.12"/>
  <circle cx="${CENTER}" cy="${CENTER}" r="186" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="3"/>
  ${symbol(palette)}
</svg>
`;

const main = async () => {
  await mkdir(OUT_DIR, { recursive: true });
  for (const badge of badges) {
    const svg = toSvg(badge);
    const svgPath = path.join(OUT_DIR, `${badge.key}.svg`);
    const pngPath = path.join(OUT_DIR, `${badge.key}.png`);
    await writeFile(svgPath, svg, "utf8");
    await sharp(Buffer.from(svg))
      .png({ compressionLevel: 9, palette: true, quality: 100 })
      .toFile(pngPath);
    console.log(`generated ${path.relative(process.cwd(), pngPath)}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
