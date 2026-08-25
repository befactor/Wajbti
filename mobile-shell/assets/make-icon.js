// One-off script: renders the app's existing brand-mark (the conic-gradient
// donut used across the web UI) as a square PNG, for @capacitor/assets to
// derive the full iOS icon/splash set from. Not part of the app build.
// Needs `sharp` and `@capacitor/assets`, which aren't kept as project
// dependencies (only needed for one-off asset generation, not the app
// itself) - run `npm install -D sharp @capacitor/assets` before rerunning
// this, then `npx @capacitor/assets generate --ios --assetPath mobile-shell/assets
// --iconBackgroundColor '#f7f1e4' --splashBackgroundColor '#f7f1e4'` after.
const fs = require("fs");
const path = require("path");

const SIZE = 1024;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_R = 460;
const RING_R = 430; // inset ring radius (mimics the CSS inset box-shadow)
const HOLE_R = 175; // center hole (mimics ::after dot)

const SAFFRON = "#e8a33d";
const SUMAC = "#a63a3a";
const ZAATAR = "#5c7048";
const SEMOLINA = "#f7f1e4";
const CARD = "#fffbf3";

// Angles match the CSS: conic-gradient(saffron 0-260deg, sumac 260-320deg, zaatar 320-360deg)
// CSS conic-gradient 0deg = 12 o'clock, clockwise.
function pointOnCircle(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function pieSlice(cx, cy, r, startDeg, endDeg) {
  const [x1, y1] = pointOnCircle(cx, cy, r, startDeg);
  const [x2, y2] = pointOnCircle(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

const svg = `
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${SIZE}" height="${SIZE}" fill="${SEMOLINA}" />
  <path d="${pieSlice(CX, CY, OUTER_R, 0, 260)}" fill="${SAFFRON}" />
  <path d="${pieSlice(CX, CY, OUTER_R, 260, 320)}" fill="${SUMAC}" />
  <path d="${pieSlice(CX, CY, OUTER_R, 320, 360)}" fill="${ZAATAR}" />
  <circle cx="${CX}" cy="${CY}" r="${OUTER_R}" fill="none" stroke="${SEMOLINA}" stroke-width="${OUTER_R - RING_R}" />
  <circle cx="${CX}" cy="${CY}" r="${HOLE_R}" fill="${CARD}" />
</svg>`;

const svgPath = path.join(__dirname, "icon.svg");
fs.writeFileSync(svgPath, svg.trim());

const sharp = require("sharp");
sharp(Buffer.from(svg))
  .resize(SIZE, SIZE)
  .flatten({ background: SEMOLINA })
  .png()
  .toFile(path.join(__dirname, "icon-only.png"))
  .then(() => console.log("icon-only.png written"));

// Splash: same mark centered on a plain semolina field, per Capacitor's
// splash spec (2732x2732, safe content within the center ~1200px).
const SPLASH_SIZE = 2732;
const splashSvg = `
<svg width="${SPLASH_SIZE}" height="${SPLASH_SIZE}" viewBox="0 0 ${SPLASH_SIZE} ${SPLASH_SIZE}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${SPLASH_SIZE}" height="${SPLASH_SIZE}" fill="${SEMOLINA}" />
  <g transform="translate(${SPLASH_SIZE / 2 - SIZE / 2}, ${SPLASH_SIZE / 2 - SIZE / 2})">
    <path d="${pieSlice(CX, CY, OUTER_R, 0, 260)}" fill="${SAFFRON}" />
    <path d="${pieSlice(CX, CY, OUTER_R, 260, 320)}" fill="${SUMAC}" />
    <path d="${pieSlice(CX, CY, OUTER_R, 320, 360)}" fill="${ZAATAR}" />
    <circle cx="${CX}" cy="${CY}" r="${OUTER_R}" fill="none" stroke="${SEMOLINA}" stroke-width="${OUTER_R - RING_R}" />
    <circle cx="${CX}" cy="${CY}" r="${HOLE_R}" fill="${CARD}" />
  </g>
</svg>`;

sharp(Buffer.from(splashSvg))
  .resize(SPLASH_SIZE, SPLASH_SIZE)
  .flatten({ background: SEMOLINA })
  .png()
  .toFile(path.join(__dirname, "splash.png"))
  .then(() => console.log("splash.png written"));
