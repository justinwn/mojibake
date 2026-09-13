// Google Fonts loading.
//
// Two rules drive the design here:
//
// 1. Load ALL FOUR option families every round, never just the answer.
//    Requesting only the answer would publish the correct answer in the
//    Network tab.
// 2. Subset every request to the glyphs actually being rendered (`&text=`).
//    That keeps four families per round down to a few KB, which is what makes
//    rule 1 affordable.

const ENDPOINT = "https://fonts.googleapis.com/css2";
const injected = new Map();

function subsetOf(text) {
  // Deduplicate and sort so the same word always produces the same URL, which
  // keeps the HTTP cache useful across rounds and reloads.
  return [...new Set(text.split(""))].sort().join("");
}

function buildUrl(families, text) {
  const params = families
    .map((f) => "family=" + encodeURIComponent(f).replace(/%20/g, "+"))
    .join("&");
  return (
    ENDPOINT + "?" + params +
    "&text=" + encodeURIComponent(subsetOf(text)) +
    "&display=block"
  );
}

function injectOnce(url) {
  if (injected.has(url)) return injected.get(url);
  const p = new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    // Resolving on error too: a failed stylesheet must not wedge the game.
    link.onload = () => resolve(true);
    link.onerror = () => resolve(false);
    document.head.appendChild(link);
  });
  injected.set(url, p);
  return p;
}

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * Fetch every option family for a round and wait until the answer is actually
 * rendering. Resolves { ok } — ok:false means the answer font never arrived and
 * the word would render in a fallback face.
 */
export async function loadRoundFonts(round, { timeout = 5000 } = {}) {
  const url = buildUrl(round.options, round.decoy);
  await withTimeout(injectOnce(url), timeout, false);

  // The stylesheet landing is not the same as the face being usable. Wait for
  // the answer specifically, since that is the one the player has to read.
  const spec = `1em "${round.answer}"`;
  try {
    await withTimeout(document.fonts.load(spec, round.decoy), timeout, null);
  } catch {
    /* load() rejects on a malformed spec; treated as a miss below. */
  }

  let ok = false;
  try {
    ok = document.fonts.check(spec, round.decoy);
  } catch {
    ok = false;
  }
  return { ok };
}

/** Warm the next round's families while the player is busy with this one. */
export function prefetchRoundFonts(round) {
  if (!round) return;
  injectOnce(buildUrl(round.options, round.decoy));
}

/** Families used by the interface itself. Loaded once, full character set. */
export function loadUiFonts() {
  const url =
    ENDPOINT +
    "?family=DotGothic16&family=Press+Start+2P" +
    "&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap";
  return injectOnce(url);
}
