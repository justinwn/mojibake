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

export const DESKTOP_ICONS = [
  { name: "My Computer", grid: MY_COMPUTER },
  { name: "Internet", grid: INTERNET },
  { name: "Paint.exe", grid: PAINT },
  { name: "Trash", grid: TRASH },
];
