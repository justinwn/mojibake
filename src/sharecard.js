// The shareable score card.
//
// The card IS the game window: same chrome, same palette, same sprites. That
// keeps one visual language instead of inventing a second one for sharing.
//
// Drawn with Canvas 2D and no library. The palette is fixed rather than read
// from CSS custom properties: a shared image should look the same for
// everyone, not flip to dark mode because of the sender's system setting.

import { TROPHY, HEART, HEART_EMPTY, drawSprite } from "./pixel.js";
import { TIER_LABELS } from "./rounds.js";
import { MAX_MISTAKES } from "./game.js";

// Shown on the card so a shared image can be traced back to the game.
const SITE = "justinwn.github.io/mojibake";

const W = 1080;
const H = 1920;

// Mirrors the light theme in styles.css. Kept together so a colour change in
// one place is obvious in the other.
const C = {
  desktop: "#a98ada",
  desktop2: "#f0aad6",
  face: "#f6ebf9",
  faceHi: "#fffafd",
  bevelHi: "#ffffff",
  bevelLo: "#5d2874",
  bevelMid: "#cfaede",
  titleA: "#6f2f96",
  titleB: "#e668ae",
  titleInk: "#ffffff",
  paper: "#ffffff",
  ink: "#331647",
  inkSoft: "#7d5490",
  accent: "#9c2f8e",
};

const SPRITE_COLORS = {
  K: "#3d1a52",
  O: "#efae1f",
  N: "#ffdf87",
  D: "#b9741a",
  M: "#c9227e",
  P: "#ff8fc5",
  G: "#a98cc4",
};

/** The two-tone bevel every control in the game is built from. */
function bevel(ctx, x, y, w, h, { raised = true, fill = C.face, t = 4 } = {}) {
  const hi = raised ? C.bevelHi : C.bevelLo;
  const lo = raised ? C.bevelLo : C.bevelHi;
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = hi;
  ctx.fillRect(x, y, w, t);
  ctx.fillRect(x, y, t, h);
  ctx.fillStyle = lo;
  ctx.fillRect(x, y + h - t, w, t);
  ctx.fillRect(x + w - t, y, t, h);
}

function text(ctx, str, x, y, { font, fill, align = "left", baseline = "alphabetic" }) {
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
}

export function formatElapsed(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

/**
 * Render the card. Resolves to a PNG Blob.
 *
 * Fonts MUST be settled before the first fillText or the card silently renders
 * in a fallback face -- canvas has no equivalent of font-display, and no way to
 * reflow once the real face arrives.
 */
export async function renderCard({ score, rounds, tier, elapsedMs }) {
  try {
    await document.fonts.ready;
  } catch {
    /* Draw anyway rather than produce nothing. */
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // --- desktop ground ---
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, C.desktop);
  bg.addColorStop(1, C.desktop2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // --- window ---
  // Heights are derived, not hard-coded: the window should hug its content
  // rather than leave a slab of empty paper under the score.
  const pad = 10;
  const tbH = 62;
  const menuH = 46;
  const cellH = 74;
  const scale = 16;
  const trophyPx = TROPHY[0].length * scale;
  const tileH = trophyPx + 80;

  // Distances between baselines inside the paper.
  const gapToTitle = 118;
  const gapToScore = 130;
  const gapToRun = 78;
  const contentH = tileH + gapToTitle + gapToScore + gapToRun + 30;
  const paperH = contentH + 120; // even breathing room top and bottom

  const winX = 90;
  const winW = W - winX * 2;
  const winH =
    pad + tbH + 6 + menuH + paperH + 8 + cellH + 8 + cellH + pad;
  const winY = Math.round((H - winH) / 2) - 40;

  ctx.fillStyle = "rgba(40, 20, 70, 0.32)";
  ctx.fillRect(winX + 10, winY + 10, winW, winH);
  bevel(ctx, winX, winY, winW, winH, { raised: true, t: 5 });

  let cy = winY + pad;

  // Title bar.
  const tb = ctx.createLinearGradient(winX + pad, 0, winX + winW - pad, 0);
  tb.addColorStop(0, C.titleA);
  tb.addColorStop(1, C.titleB);
  ctx.fillStyle = tb;
  ctx.fillRect(winX + pad, cy, winW - pad * 2, tbH);

  bevel(ctx, winX + pad + 12, cy + 14, 34, 34, { raised: true, t: 3 });
  text(ctx, "\u6587\u5b57\u5316\u3051 \u2014 mojibake.exe", winX + pad + 62, cy + tbH / 2, {
    font: "34px DotGothic16, monospace", fill: C.titleInk, baseline: "middle",
  });

  let bx = winX + winW - pad - 16;
  for (const glyph of ["\u2715", "\u25A1", "\u2013"]) {
    bx -= 44;
    bevel(ctx, bx, cy + 13, 40, 36, { raised: true, t: 3 });
    text(ctx, glyph, bx + 20, cy + 32, {
      font: "22px DotGothic16, monospace", fill: C.ink,
      align: "center", baseline: "middle",
    });
    bx -= 5;
  }
  cy += tbH + 6;

  // Menu bar.
  text(ctx, "File   Edit   View   Font   Help", winX + pad + 6, cy + menuH / 2, {
    font: "30px DotGothic16, monospace", fill: C.ink, baseline: "middle",
  });
  cy += menuH;

  // --- paper area ---
  const paperX = winX + pad;
  const paperW = winW - pad * 2;
  bevel(ctx, paperX, cy, paperW, paperH, { raised: false, fill: C.paper, t: 4 });

  const midX = W / 2;

  // Trophy on its own pale tile, as in the mock.
  const tileX = midX - trophyPx / 2 - 40;
  const tileY = cy + (paperH - contentH) / 2;
  ctx.fillStyle = "#f4f2f6";
  ctx.fillRect(tileX, tileY, trophyPx + 80, tileH);
  drawSprite(ctx, TROPHY, tileX + 40, tileY + 40, scale, SPRITE_COLORS);

  let ty = tileY + tileH + gapToTitle;
  text(ctx, "Nicely done!", midX, ty, {
    font: "40px 'Press Start 2P', monospace", fill: C.accent, align: "center",
  });

  ty += gapToScore;
  text(ctx, score.toLocaleString("en-US"), midX, ty, {
    font: "96px 'Press Start 2P', monospace", fill: C.ink, align: "center",
  });

  ty += gapToRun;
  const plural = rounds === 1 ? "" : "s";
  text(ctx, `${rounds} round${plural} in ${formatElapsed(elapsedMs)}`, midX, ty, {
    font: "34px DotGothic16, monospace", fill: C.inkSoft, align: "center",
  });

  cy += paperH + 8;

  // --- status bar: the real one, reading this run ---
  const cellW = (paperW - 8) / 2;
  const cells = [
    ["Round", `${rounds} \u00B7 ${TIER_LABELS[tier]}`],
    ["Score", String(score)],
  ];
  cells.forEach(([k, v], i) => {
    const x = paperX + i * (cellW + 8);
    bevel(ctx, x, cy, cellW, cellH, { raised: false, t: 4 });
    text(ctx, k, x + 18, cy + cellH / 2, {
      font: "28px DotGothic16, monospace", fill: C.inkSoft, baseline: "middle",
    });
    text(ctx, v, x + 130, cy + cellH / 2, {
      font: "24px 'Press Start 2P', monospace", fill: C.ink, baseline: "middle",
    });
  });

  cy += cellH + 8;
  bevel(ctx, paperX, cy, cellW, cellH, { raised: false, t: 4 });
  text(ctx, "Lives", paperX + 18, cy + cellH / 2, {
    font: "28px DotGothic16, monospace", fill: C.inkSoft, baseline: "middle",
  });
  // A finished run always ends on empty hearts; that is what game over means.
  for (let i = 0; i < MAX_MISTAKES; i++) {
    drawSprite(ctx, HEART_EMPTY, paperX + 130 + i * 46, cy + 22, 4, SPRITE_COLORS);
  }

  bevel(ctx, paperX + cellW + 8, cy, cellW, cellH, { raised: false, t: 4 });
  text(ctx, "Time", paperX + cellW + 26, cy + cellH / 2, {
    font: "28px DotGothic16, monospace", fill: C.inkSoft, baseline: "middle",
  });
  text(ctx, formatElapsed(elapsedMs), paperX + cellW + 138, cy + cellH / 2, {
    font: "24px 'Press Start 2P', monospace", fill: C.ink, baseline: "middle",
  });

  // --- footer ---
  text(ctx, "Guess the font at", midX, H - 130, {
    font: "30px DotGothic16, monospace", fill: "rgba(255,255,255,0.85)",
    align: "center",
  });
  text(ctx, SITE, midX, H - 80, {
    font: "30px 'Press Start 2P', monospace", fill: "#ffffff", align: "center",
  });

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}


/** Can this device hand the image to another app? */
export function canShareImage(file) {
  return Boolean(
    navigator.canShare && navigator.share && navigator.canShare({ files: [file] })
  );
}

export function fileFor(blob, score) {
  return new File([blob], `mojibake-${score}.png`, { type: "image/png" });
}

export function download(blob, score) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mojibake-${score}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
