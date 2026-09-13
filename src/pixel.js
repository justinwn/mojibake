// Pixel art, drawn as SVG rects from character grids.
//
// Grids keep the art readable and editable in source. Colours are CSS custom
// properties rather than literals, so every sprite follows the theme.

const PALETTE = {
  K: "var(--px-line)",   // outline
  Y: "var(--px-yellow)", // face
  P: "var(--px-pink)",
  M: "var(--px-magenta)",
  W: "var(--px-white)",
  S: "var(--px-screen)",
  B: "var(--px-body)",
  G: "var(--px-grey)",
  O: "var(--px-gold)",
  N: "var(--px-gold-lt)",
  D: "var(--px-gold-dk)",
  A: "var(--px-spark)",
};

/** Build an <svg> from a grid of characters. "." is transparent. */
export function sprite(grid, { cls = "", title = "" } = {}) {
  const h = grid.length;
  const w = grid[0].length;
  for (const row of grid) {
    if (row.length !== w) {
      throw new Error(`ragged sprite row: "${row}" (expected ${w})`);
    }
  }

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("shape-rendering", "crispEdges");
  if (cls) svg.setAttribute("class", cls);
  if (title) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", title);
  } else {
    svg.setAttribute("aria-hidden", "true");
  }

  // Merge horizontal runs of the same colour into one rect: far fewer nodes.
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const ch = grid[y][x];
      if (ch === ".") { x++; continue; }
      let len = 1;
      while (x + len < w && grid[y][x + len] === ch) len++;
      const r = document.createElementNS(ns, "rect");
      r.setAttribute("x", x);
      r.setAttribute("y", y);
      r.setAttribute("width", len);
      r.setAttribute("height", 1);
      r.setAttribute("fill", PALETTE[ch] || ch);
      svg.appendChild(r);
      x += len;
    }
  }
  return svg;
}

export const SAD_FACE = [
  "....KKKKKK....",
  "..KKYYYYYYKK..",
  ".KYYYYYYYYYYK.",
  ".KYYYYYYYYYYK.",
  "KYYYYYYYYYYYYK",
  "KYYYKYYYYKYYYK",
  "KYYYKYYYYKYYYK",
  "KYYYKYYYYKYYYK",
  "KYYYYYYYYYYYYK",
  "KYYYYYYYYYYYYK",
  ".KYYYKKKKYYYK.",
  ".KYYKYYYYKYYK.",
  "..KKYYYYYYKK..",
  "....KKKKKK....",
];

export const HEART = [
  ".MM..MM.",
  "MPPMMPPM",
  "MPPPPPPM",
  "MPPPPPPM",
  ".MPPPPM.",
  "..MPPM..",
  "...MM...",
];

export const HEART_EMPTY = [
  ".GG..GG.",
  "G......G",
  "G......G",
  "G......G",
  ".G....G.",
  "..G..G..",
  "...GG...",
];

const MY_COMPUTER = [
  "................",
  ".KKKKKKKKKKKKKK.",
  ".KSSSSSSSSSSSSK.",
  ".KSWWWWWWWWWWSK.",
  ".KSWWWWWWWWWWSK.",
  ".KSWWWWWWWWWWSK.",
  ".KSWWWWWWWWWWSK.",
  ".KSWWWWWWWWWWSK.",
  ".KSSSSSSSSSSSSK.",
  ".KKKKKKKKKKKKKK.",
  "......KKKK......",
  "....KKBBBBKK....",
  "...KBBBBBBBBK...",
  "...KKKKKKKKKK...",
  "................",
  "................",
];

const INTERNET = [
  ".....KKKKKK.....",
  "...KKWWWWWWKK...",
  "..KWWKWWWWKWWK..",
  ".KWWWKWWWWKWWWK.",
  ".KWWWKWWWWKWWWK.",
  "KKKKKKKKKKKKKKKK",
  "KWWWWKWWWWKWWWWK",
  "KWWWWKWWWWKWWWWK",
  "KKKKKKKKKKKKKKKK",
  ".KWWWKWWWWKWWWK.",
  ".KWWWKWWWWKWWWK.",
  "..KWWKWWWWKWWK..",
  "...KKWWWWWWKK...",
  ".....KKKKKK.....",
  "................",
  "................",
];

const PAINT = [
  "................",
  "....KKKKKKKK....",
  "..KKWWWWWWWWKK..",
  ".KWWMMWWWWPPWWK.",
  ".KWMMMMWWPPPPWK.",
  "KWWMMWWWWWPPWWWK",
  "KWWWWWWWWWWWWWWK",
  "KWWYYWWWWWSSWWWK",
  "KWWYYYYWWSSSSWWK",
  "KWWWYYWWWWSSWWWK",
  ".KWWWWWWWWWWWWK.",
  ".KWWWWKKWWWWWWK.",
  "..KKWWKKWWWWKK..",
  "....KKKKKKKK....",
  "................",
  "................",
];

const TRASH = [
  "................",
  "....KKKKKKKK....",
  "..KKKKKKKKKKKK..",
  "..KKKKKKKKKKKK..",
  "................",
  "..KKKKKKKKKKKK..",
  "..KGWGGWGGWGGK..",
  "..KGWGGWGGWGGK..",
  "..KGWGGWGGWGGK..",
  "..KGWGGWGGWGGK..",
  "..KGWGGWGGWGGK..",
  "..KGWGGWGGWGGK..",
  "...KGGGGGGGGK...",
  "...KKKKKKKKKK...",
  "................",
  "................",
];

const NOTEPAD = [
  "................",
  "..KKKKKKKKKKK...",
  "..KWWWWWWWWWK...",
  "..KWGGGGGGGWK...",
  "..KWWWWWWWWWK...",
  "..KWGGGGGGGWK...",
  "..KWWWWWWWWWK...",
  "..KWGGGGGGGWK...",
  "..KWWWWWWWWWK...",
  "..KWGGGGGWWWK...",
  "..KWWWWWWWWWK...",
  "..KWGGGGGGGWK...",
  "..KWWWWWWWWWK...",
  "..KKKKKKKKKKK...",
  "................",
  "................",
];

// `action` marks an icon as a real control rather than wallpaper.
export const DESKTOP_ICONS = [
  { name: "My Computer", grid: MY_COMPUTER },
  { name: "Internet", grid: INTERNET },
  { name: "From the Creator", grid: NOTEPAD, action: "notepad" },
  { name: "Paint.exe", grid: PAINT },
  { name: "Trash", grid: TRASH },
];

export const TROPHY = [
  ".KKKKKKKKKKKKKK.",
  ".KNNNNNNNNNNNNK.",
  "KKOOOOOOOOOOOOKK",
  "KOKOOOOOOOOOOKOK",
  "KOKNOOOOOOOODKOK",
  "KOKNOOOOOOOODKOK",
  "KOKNOOOOOOOODKOK",
  "KKKNOOOOOOOODKKK",
  "..KNOOOOOOOODK..",
  "..KKNOOOOOODKK..",
  "...KKNOOOODKK...",
  ".....KOOOOK.....",
  ".....KOOOOK.....",
  "...KKKOOOOKKK...",
  "...KNNNNNNNNK...",
  "...KKKKKKKKKK...",
];

export const SPARKLE = [
  "...A...",
  "...A...",
  "..AAA..",
  "AAAWAAA",
  "..AAA..",
  "...A...",
  "...A...",
];

/**
 * Draw a grid onto a canvas. `colors` maps grid letters to real colour values:
 * the CSS custom properties above cannot be resolved in a canvas, and the
 * share card wants a fixed palette anyway so the image looks the same for
 * everyone regardless of the viewer's theme.
 */
export function drawSprite(ctx, grid, x, y, scale, colors) {
  for (let row = 0; row < grid.length; row++) {
    let col = 0;
    while (col < grid[row].length) {
      const ch = grid[row][col];
      if (ch === ".") { col++; continue; }
      // Merge horizontal runs, as sprite() does: fewer fills, and no hairline
      // seams between adjacent rectangles.
      let len = 1;
      while (col + len < grid[row].length && grid[row][col + len] === ch) len++;
      const fill = colors[ch];
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(x + col * scale, y + row * scale, len * scale, scale);
      }
      col += len;
    }
  }
}
