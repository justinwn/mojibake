// Personal best, kept on this device.
//
// All the leaderboard that an MVP needs: something for a returning player to
// beat. Every storage access is guarded — private mode throws on access rather
// than returning null, and a half-written value should never break the score
// screen.

const KEY = "mojibake.best.v1";

export function getBest() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v.score !== "number" || !Number.isFinite(v.score)) {
      return null;
    }
    return {
      score: v.score,
      rounds: typeof v.rounds === "number" ? v.rounds : 0,
      at: typeof v.at === "number" ? v.at : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Record a finished run. Returns the best after this run, and whether this run
 * set it — so the score screen can say so.
 */
export function recordRun(score, rounds) {
  const previous = getBest();
  const isNew = !previous || score > previous.score;
  if (!isNew) return { best: previous, isNew: false };

  const best = { score, rounds, at: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(best));
  } catch {
    /* Storage is a convenience here; the run still counts on screen. */
  }
  return { best, isNew: true };
}
