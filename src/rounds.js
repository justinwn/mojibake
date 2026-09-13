// Round generation.
//
// Rounds are produced in sequence from a single seed, so an entire run is
// reproducible from that seed alone. Replay validation depends on that: see
// the stability contract in rng.js. Never generate a round out of order.

import { makeRng } from "./rng.js";

// Round number -> difficulty tier.
export function tierForRound(n) {
  if (n <= 3) return 0;
  if (n <= 8) return 1;
  if (n <= 15) return 2;
  return 3;
}

export const TIER_LABELS = ["Easy", "Normal", "Hard", "Brutal"];

// Seconds on the clock, by tier.
const TIER_SECONDS = [12, 10, 8, 6];

export function secondsForTier(tier) {
  return TIER_SECONDS[tier];
}

// Pure and integer-only, so replayRun() recomputes exactly the same total from
// a run log on any machine.
export function scoreFor({ tier, msElapsed, seconds, streak }) {
  const limit = seconds * 1000;
  const remaining = Math.max(0, limit - msElapsed);
  const base = 100 + tier * 25;
  const speed = Math.round((remaining / limit) * 100);
  // Every 3 correct in a row adds half a multiplier, capped at 3x.
  const mult = Math.min(3, 1 + Math.floor(streak / 3) * 0.5);
  return Math.round((base + speed) * mult);
}

function indexPool(pool) {
  const byGroup = new Map();
  const byCategory = new Map();
  for (const e of pool) {
    if (!byGroup.has(e.g)) byGroup.set(e.g, []);
    byGroup.get(e.g).push(e);
    if (!byCategory.has(e.c)) byCategory.set(e.c, []);
    byCategory.get(e.c).push(e);
  }
  // Only groups with enough members can supply a full set of lookalikes.
  const usableGroups = [...byGroup.values()].filter((g) => g.length >= 4);
  const trapGroups = usableGroups.filter((g) => g[0].trap === 1);
  return { byGroup, byCategory, usableGroups, trapGroups };
}

// How visually close two families are, using the typographic metrics present
// on ~700 families. Lower is more similar. Used to sharpen hard rounds.
function metricDistance(a, b) {
  if (a.th == null || b.th == null || a.w == null || b.w == null) return 2;
  return Math.abs(a.th - b.th) + Math.abs(a.w - b.w);
}

export function createRoundGen(seed, data) {
  const rng = makeRng(seed);
  const pool = data.fonts;
  const idx = indexPool(pool);
  const usedFamilies = new Set();
  const usedDecoys = new Set();
  let n = 0;

  // Only answers are consumed. Distractors are deliberately reusable: the
  // curated trap groups hold 7-9 families each, so retiring a distractor
  // would exhaust the very groups that make hard rounds hard.
  const fresh = (arr) => arr.filter((e) => !usedFamilies.has(e.f));

  function pickAnswer(tier) {
    // Prefer the band this tier is meant to test, then widen outward rather
    // than ever failing to produce a round.
    for (const band of [tier, tier - 1, tier + 1, tier - 2, tier + 2]) {
      if (band < 0 || band > 3) continue;
      const cands = fresh(pool.filter((e) => e.t === band));
      if (cands.length) return rng.pick(cands);
    }
    const any = fresh(pool);
    return any.length ? rng.pick(any) : rng.pick(pool);
  }

  // Easy rounds: three distractors from categories the answer is not in, so
  // the four options are obviously unalike.
  function easyDistractors(answer) {
    const out = [];
    const cats = rng.shuffle(
      [...idx.byCategory.keys()].filter((c) => c !== answer.c)
    );
    for (const c of cats) {
      if (out.length === 3) break;
      const cands = idx.byCategory.get(c).filter(
        (e) => e.t <= 1 && !out.includes(e)
      );
      if (cands.length) out.push(rng.pick(cands));
    }
    return out;
  }

  // Normal rounds: same category as the answer, but a different group.
  function mediumDistractors(answer) {
    const cands = (idx.byCategory.get(answer.c) || []).filter(
      (e) => e.g !== answer.g && e.f !== answer.f && e.t <= 2
    );
    return rng.sample(cands, 3);
  }

  // Hard rounds: all four from one group, closest metric matches first, so
  // the options genuinely resemble each other.
  function hardDistractors(answer) {
    const siblings = (idx.byGroup.get(answer.g) || []).filter(
      (e) => e.f !== answer.f
    );
    if (siblings.length < 3) return null;
    // Take a generous slice of the nearest matches, then choose randomly
    // inside it, so hard rounds stay close without becoming predictable.
    const ranked = siblings
      .map((e) => ({ e, d: metricDistance(answer, e) }))
      .sort((x, y) => x.d - y.d)
      .slice(0, Math.max(8, Math.ceil(siblings.length * 0.4)))
      .map((x) => x.e);
    return rng.sample(ranked, 3);
  }

  // Hard rounds want an answer that lives in a group big enough to supply
  // lookalikes, so pick the group first and the answer from inside it.
  function pickFromGroup(tier) {
    const prefer = tier >= 2 && idx.trapGroups.length ? idx.trapGroups : idx.usableGroups;
    const groups = rng.shuffle(prefer);
    for (const g of groups) {
      const inBand = fresh(g).filter((e) => Math.abs(e.t - tier) <= 1);
      if (inBand.length) return rng.pick(inBand);
    }
    for (const g of rng.shuffle(idx.usableGroups)) {
      const any = fresh(g);
      if (any.length) return rng.pick(any);
    }
    return null;
  }

  function pickDecoy(options) {
    const taken = new Set(options.map((o) => o.f));
    const avail = data.decoys.filter((d) => !usedDecoys.has(d) && !taken.has(d));
    // Once every decoy has been used, start the list over rather than stall.
    const from = avail.length ? avail : data.decoys.filter((d) => !taken.has(d));
    if (!avail.length) usedDecoys.clear();
    const decoy = rng.pick(from);
    usedDecoys.add(decoy);
    return decoy;
  }

  return {
    next() {
      n += 1;
      const tier = tierForRound(n);

      let answer = tier >= 2 ? pickFromGroup(tier) : null;
      if (!answer) answer = pickAnswer(tier);

      let distractors = null;
      if (tier === 0) distractors = easyDistractors(answer);
      else if (tier === 1) distractors = mediumDistractors(answer);
      else distractors = hardDistractors(answer);

      // Widen progressively rather than ever shipping a round with <4 options.
      if (!distractors || distractors.length < 3) {
        distractors = mediumDistractors(answer);
      }
      if (distractors.length < 3) {
        const rest = pool.filter((e) => e.f !== answer.f);
        distractors = rng.sample(rest, 3);
      }

      const options = rng.shuffle([answer, ...distractors]);
      const answerIndex = options.findIndex((o) => o.f === answer.f);
      const decoy = pickDecoy(options);

      usedFamilies.add(answer.f);

      return {
        round: n,
        tier,
        seconds: secondsForTier(tier),
        decoy,
        answer: answer.f,
        answerIndex,
        options: options.map((o) => o.f),
      };
    },
  };
}
