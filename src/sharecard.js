// The shareable score card.
//
// The card IS the game window: same chrome, same palette, same sprites. That
// keeps one visual language instead of inventing a second one for sharing.
//
// Drawn with Canvas 2D and no library. The palette is fixed rather than read
// from CSS custom properties: a shared image should look the same for
// everyone, not flip to dark mode because of the sender's system setting.

import { TROPHY, HEART_EMPTY, SPARKLE, drawSprite } from "./pixel.js";
import { TIER_LABELS } from "./rounds.js";
import { MAX_MISTAKES } from "./game.js";

// Shown on the card so a shared image can be traced back to the game.
const SITE = "mojibake.justinewin.com";

const W = 1080;
const H = 1920;

// Mirrors the two theme blocks in styles.css. Kept side by side so a colour
// change in one place is obvious in the other.
const PALETTES = {
  light: {
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
    footer: "rgba(255,255,255,0.85)",
    footerStrong: "#ffffff",
  },
  dark: {
    desktop: "#2b1244",
    desktop2: "#55184c",
    face: "#452654",
    faceHi: "#5c3670",
    bevelHi: "#8a5a9e",
    bevelLo: "#1b0a26",
    bevelMid: "#5e3a72",
    titleA: "#4a1663",
    titleB: "#b8408c",
    titleInk: "#fff0fa",
    paper: "#1c0e26",
    ink: "#fce9fb",
    inkSoft: "#cba2d8",
    accent: "#ff9ad8",
    footer: "rgba(255,236,250,0.75)",
    footerStrong: "#ffecfa",
  },
};

const SPRITES = {
  light: {
    K: "#3d1a52", O: "#efae1f", N: "#ffdf87", D: "#b9741a",
    M: "#c9227e", P: "#ff8fc5", G: "#a98cc4", A: "#ffd76e", W: "#ffffff",
  },
  dark: {
    K: "#12061c", O: "#f5b833", N: "#ffe9a3", D: "#a85f14",
    M: "#8e1657", P: "#ff8fc5", G: "#8a6aa8", A: "#ffe08a", W: "#f3e2fa",
  },
};

/** The two-tone bevel every control in the game is built from. */
function bevel(ctx, C, x, y, w, h, { raised = true, fill = null, t = 4 } = {}) {
  const hi = raised ? C.bevelHi : C.bevelLo;
  const lo = raised ? C.bevelLo : C.bevelHi;
  fill = fill || C.face;
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
export async function renderCard({ score, rounds, tier, elapsedMs, theme }) {
  // The card remembers the theme the run was played in.
  const C = PALETTES[theme === "dark" ? "dark" : "light"];
  const SPRITE_COLORS = SPRITES[theme === "dark" ? "dark" : "light"];
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

  ctx.fillStyle = theme === "dark"
    ? "rgba(0, 0, 0, 0.42)"
    : "rgba(40, 20, 70, 0.32)";
  ctx.fillRect(winX + 10, winY + 10, winW, winH);
  bevel(ctx, C, winX, winY, winW, winH, { raised: true, t: 5 });

  let cy = winY + pad;

  // Title bar.
  const tb = ctx.createLinearGradient(winX + pad, 0, winX + winW - pad, 0);
  tb.addColorStop(0, C.titleA);
  tb.addColorStop(1, C.titleB);
  ctx.fillStyle = tb;
  ctx.fillRect(winX + pad, cy, winW - pad * 2, tbH);

  bevel(ctx, C, winX + pad + 12, cy + 14, 34, 34, { raised: true, t: 3 });
  text(ctx, "\u6587\u5b57\u5316\u3051 \u2014 mojibake.exe", winX + pad + 62, cy + tbH / 2, {
    font: "34px Tahoma, DotGothic16, sans-serif", fill: C.titleInk, baseline: "middle",
  });

  let bx = winX + winW - pad - 16;
  for (const glyph of ["\u2715", "\u25A1", "\u2013"]) {
    bx -= 44;
    bevel(ctx, C, bx, cy + 13, 40, 36, { raised: true, t: 3 });
    text(ctx, glyph, bx + 20, cy + 32, {
      font: "22px Tahoma, DotGothic16, sans-serif", fill: C.ink,
      align: "center", baseline: "middle",
    });
    bx -= 5;
  }
  cy += tbH + 6;

  // Menu bar.
  text(ctx, "File   Edit   View   Font   Help", winX + pad + 6, cy + menuH / 2, {
    font: "30px Tahoma, DotGothic16, sans-serif", fill: C.ink, baseline: "middle",
  });
  cy += menuH;

  // --- paper area ---
  const paperX = winX + pad;
  const paperW = winW - pad * 2;
  bevel(ctx, C, paperX, cy, paperW, paperH, { raised: false, fill: C.paper, t: 4 });

  const midX = W / 2;

  // Trophy on its own pale tile, as in the mock.
  const tileX = midX - trophyPx / 2 - 40;
  const tileY = cy + (paperH - contentH) / 2;
  drawSprite(ctx, TROPHY, tileX + 40, tileY + 40, scale, SPRITE_COLORS);

  // Sparkles at the three positions the score screen animates through, frozen
  // at different sizes so the still frame still reads as "twinkling".
  const sparks = [
    [tileX + trophyPx + 26, tileY + 30, 7],
    [tileX + 10, tileY + tileH - 78, 5],
    [tileX + 4, tileY + 58, 4],
  ];
  for (const [sx, sy, ss] of sparks) {
    drawSprite(ctx, SPARKLE, sx, sy, ss, SPRITE_COLORS);
  }

  let ty = tileY + tileH + gapToTitle;
  text(ctx, "I SCORED", midX, ty, {
    font: "44px 'Press Start 2P', monospace", fill: C.accent, align: "center",
  });

  ty += gapToScore;
  text(ctx, score.toLocaleString("en-US"), midX, ty, {
    font: "96px 'Press Start 2P', monospace", fill: C.ink, align: "center",
  });

  ty += gapToRun;
  const plural = rounds === 1 ? "" : "s";
  text(ctx, `${rounds} round${plural} in ${formatElapsed(elapsedMs)}`, midX, ty, {
    font: "34px Tahoma, DotGothic16, sans-serif", fill: C.inkSoft, align: "center",
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
    bevel(ctx, C, x, cy, cellW, cellH, { raised: false, t: 4 });
    text(ctx, k, x + 18, cy + cellH / 2, {
      font: "28px Tahoma, DotGothic16, sans-serif", fill: C.inkSoft, baseline: "middle",
    });
    text(ctx, v, x + 130, cy + cellH / 2, {
      font: "24px 'Press Start 2P', monospace", fill: C.ink, baseline: "middle",
    });
  });

  cy += cellH + 8;
  bevel(ctx, C, paperX, cy, cellW, cellH, { raised: false, t: 4 });
  text(ctx, "Lives", paperX + 18, cy + cellH / 2, {
    font: "28px Tahoma, DotGothic16, sans-serif", fill: C.inkSoft, baseline: "middle",
  });
  // A finished run always ends on empty hearts; that is what game over means.
  for (let i = 0; i < MAX_MISTAKES; i++) {
    drawSprite(ctx, HEART_EMPTY, paperX + 130 + i * 46, cy + 22, 4, SPRITE_COLORS);
  }

  bevel(ctx, C, paperX + cellW + 8, cy, cellW, cellH, { raised: false, t: 4 });
  text(ctx, "Time", paperX + cellW + 26, cy + cellH / 2, {
    font: "28px Tahoma, DotGothic16, sans-serif", fill: C.inkSoft, baseline: "middle",
  });
  text(ctx, formatElapsed(elapsedMs), paperX + cellW + 138, cy + cellH / 2, {
    font: "24px 'Press Start 2P', monospace", fill: C.ink, baseline: "middle",
  });

  // --- footer ---
  text(ctx, "Guess the font at", midX, H - 130, {
    font: "30px Tahoma, DotGothic16, sans-serif", fill: C.footer,
    align: "center",
  });
  text(ctx, SITE, midX, H - 80, {
    font: "30px 'Press Start 2P', monospace", fill: C.footerStrong, align: "center",
  });

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}


export const SHARE_URL = "https://" + SITE;

/**
 * Which route this browser can take, decided BEFORE the click.
 *
 * navigator.share needs transient activation: it must be reached from the
 * click handler with no await in front of it, or the browser rejects the call.
 * So the decision cannot involve any async work at share time.
 *
 *   "files"    - native OS dialog, image attached
 *   "url"      - native OS dialog, link only (no file support here)
 *   "download" - no Web Share API at all; save the PNG instead
 */
export function shareMode(file) {
  if (typeof navigator.share !== "function") return "download";
  if (navigator.canShare && navigator.canShare({ files: [file] })) return "files";
  return "url";
}

/** Kept for callers that only want to know whether the image itself travels. */
export function canShareImage(file) {
  return shareMode(file) === "files";
}

/**
 * Open the native share dialog. MUST be called directly from a click handler,
 * with nothing awaited first. Resolves to what actually happened.
 */
export function shareNow(mode, { file, blob, score }) {
  const text = `I scored ${score.toLocaleString("en-US")} on Mojibake.`;

  if (mode === "files") {
    // Deliberately no `url`: some platforms reject a payload that mixes files
    // with a link, and the card already carries the address.
    return navigator.share({ files: [file], title: "Mojibake", text })
      .then(() => "shared");
  }

  if (mode === "url") {
    return navigator.share({ title: "Mojibake", text, url: SHARE_URL })
      .then(() => "shared");
  }

  download(blob, score);
  return Promise.resolve("downloaded");
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
