// Seeded PRNG.
//
// STABILITY CONTRACT: a whole run is reproducible from its seed alone, which
// is what lets tools/test_replay.mjs verify scoring end to end. Changing
// anything here, or the order in which rounds.js consumes numbers from it,
// changes every sequence. Bump GEN_VERSION if that ever has to happen.
export const GEN_VERSION = 1;

// cyrb128: string -> four well-mixed 32-bit seeds.
function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ];
}

// sfc32: small, fast, statistically solid counter-based generator.
function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const [a, b, c, d] = cyrb128(String(seed));
  const next = sfc32(a, b, c, d);
  // Discard the first few outputs; sfc32 needs a moment to mix.
  for (let i = 0; i < 12; i++) next();

  return {
    next,
    int(n) {
      return Math.floor(next() * n);
    },
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    // Fisher-Yates on a copy. Never mutates the caller's array, because the
    // shared font pool is reused across every round of every run.
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const t = out[i]; out[i] = out[j]; out[j] = t;
      }
      return out;
    },
    // Draw up to n distinct items without replacement.
    sample(arr, n) {
      return this.shuffle(arr).slice(0, n);
    },
  };
}

export function newSeed() {
  const buf = new Uint32Array(4);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => n.toString(36)).join("-");
}
