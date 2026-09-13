// Game state machine and run replay.
//
// The key property here: a run is fully described by its seed plus a log of
// {round, choice, ms}, so `replayRun` can recompute any score from scratch.
// Nothing ships that depends on it today, but it is the regression cover for
// the scoring arithmetic and round-generation determinism (tools/test_replay.mjs).

import { createRoundGen, scoreFor, secondsForTier } from "./rounds.js";
import { GEN_VERSION } from "./rng.js";

export const MAX_MISTAKES = 3;
export const TIMEOUT_CHOICE = -1;

// Nobody reads a word, parses four options and clicks in under this.
const MIN_REACTION_MS = 150;
// Clock resolution and event-loop lag around the deadline.
const DEADLINE_GRACE_MS = 250;
// Per round, the slack outside the clock: font loading and feedback animation.
const PER_ROUND_OVERHEAD_MS = 9000;
const MAX_LOG_LENGTH = 2000;

/**
 * Cheap fingerprint of the font pool. Rounds are derived from the pool, so a
 * regenerated fonts.json changes what a given seed produces. Recording this
 * lets old entries be rejected instead of silently mis-scored.
 */
export function poolFingerprint(data) {
  let h = 2166136261;
  const s = data.fonts.length + ":" + data.fonts[0].f + ":" +
    data.fonts[data.fonts.length - 1].f + ":" + data.decoys.length;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * Recompute a run from its seed and log. Pure, deterministic, and safe to run
 * on hostile input -- this is what makes a forged entry require an actual
 * playthrough rather than a number.
 */
export function replayRun(entry, data) {
  const fail = (reason) => ({ valid: false, reason, score: 0 });

  if (!entry || typeof entry !== "object") return fail("malformed");
  if (entry.gen !== GEN_VERSION) return fail("stale-generator");
  if (entry.pool !== poolFingerprint(data)) return fail("stale-pool");
  if (!Array.isArray(entry.log) || !entry.log.length) return fail("empty-log");
  if (entry.log.length > MAX_LOG_LENGTH) return fail("log-too-long");
  if (typeof entry.seed !== "string" || entry.seed.length > 200) {
    return fail("bad-seed");
  }

  const gen = createRoundGen(entry.seed, data);
  let score = 0;
  let streak = 0;
  let mistakes = 0;
  let loggedMs = 0;

  for (let i = 0; i < entry.log.length; i++) {
    const step = entry.log[i];
    if (!step || typeof step !== "object") return fail("malformed-step");

    const round = gen.next();
    // The log must line up with the generated sequence, in order.
    if (step.r !== round.round) return fail("round-mismatch");

    const choice = step.c;
    const ms = step.ms;
    if (!Number.isInteger(choice) || choice < -1 || choice > 3) {
      return fail("bad-choice");
    }
    if (!Number.isFinite(ms) || ms < 0) return fail("bad-timing");

    const limit = round.seconds * 1000;
    if (ms > limit + DEADLINE_GRACE_MS) return fail("over-deadline");

    if (choice === TIMEOUT_CHOICE) {
      mistakes += 1;
      streak = 0;
    } else {
      // A real answer cannot be faster than human reaction time.
      if (ms < MIN_REACTION_MS) return fail("inhuman-timing");
      if (choice === round.answerIndex) {
        streak += 1;
        score += scoreFor({
          tier: round.tier,
          msElapsed: ms,
          seconds: round.seconds,
          streak,
        });
      } else {
        mistakes += 1;
        streak = 0;
      }
    }
    loggedMs += ms;

    // The run must stop exactly when it ran out of lives.
    if (mistakes >= MAX_MISTAKES && i !== entry.log.length - 1) {
      return fail("played-past-game-over");
    }
  }

  if (mistakes < MAX_MISTAKES) return fail("unfinished");

  // Wall-clock has to be consistent with the logged time: you cannot have
  // spent less real time than you logged, nor an implausible amount more.
  const wall = entry.submittedAt - entry.startedAt;
  if (!Number.isFinite(wall) || wall < 0) return fail("bad-clock");
  if (wall + DEADLINE_GRACE_MS * entry.log.length < loggedMs) {
    return fail("clock-too-short");
  }
  if (wall > loggedMs + PER_ROUND_OVERHEAD_MS * entry.log.length) {
    return fail("clock-too-long");
  }

  return {
    valid: true,
    reason: null,
    score,
    rounds: entry.log.length,
    mistakes,
  };
}

/** Live game. `on` receives state transitions; the UI layer renders them. */
export function createGame(data, seed, on) {
  const gen = createRoundGen(seed, data);
  const log = [];
  const startedAt = Date.now();

  let round = null;
  let next = null;
  let score = 0;
  let streak = 0;
  let mistakes = 0;
  let revealedAt = 0;
  let deadline = 0;
  let timerHandle = 0;
  let answered = true;

  function stopTimer() {
    if (timerHandle) {
      cancelAnimationFrame(timerHandle);
      timerHandle = 0;
    }
  }

  function tick() {
    if (answered) return;
    const left = deadline - performance.now();
    if (left <= 0) {
      resolve(TIMEOUT_CHOICE);
      return;
    }
    on.tick(left, round.seconds * 1000);
    timerHandle = requestAnimationFrame(tick);
  }

  function resolve(choice) {
    if (answered) return;
    answered = true;
    stopTimer();

    const limit = round.seconds * 1000;
    // Clamp so a background tab or a stalled frame cannot log a time outside
    // the window the validator will accept.
    const ms = choice === TIMEOUT_CHOICE
      ? limit
      : Math.min(limit, Math.max(0, Math.round(performance.now() - revealedAt)));

    log.push({ r: round.round, c: choice, ms });

    const correct = choice === round.answerIndex;
    let gained = 0;
    if (correct) {
      streak += 1;
      gained = scoreFor({
        tier: round.tier, msElapsed: ms, seconds: round.seconds, streak,
      });
      score += gained;
    } else {
      streak = 0;
      mistakes += 1;
    }

    on.resolved({
      round, choice, correct, gained, score, streak, mistakes,
      timedOut: choice === TIMEOUT_CHOICE,
    });

    if (mistakes >= MAX_MISTAKES) {
      on.gameOver(buildRun());
    }
  }

  function buildRun() {
    return {
      seed,
      log: log.slice(),
      startedAt,
      submittedAt: Date.now(),
      gen: GEN_VERSION,
      pool: poolFingerprint(data),
    };
  }

  return {
    get state() {
      return { score, streak, mistakes, round };
    },

    /** Produce the next round without starting its clock. */
    prepare() {
      round = next || gen.next();
      next = null;
      answered = true;
      return round;
    },

    /** Look ahead so the next round's fonts can be warmed. */
    peek() {
      if (!next) next = gen.next();
      return next;
    },

    /**
     * Start the clock. Called only once the word is actually rendering, so
     * network time is never charged to the player.
     */
    start() {
      answered = false;
      revealedAt = performance.now();
      deadline = revealedAt + round.seconds * 1000;
      on.tick(round.seconds * 1000, round.seconds * 1000);
      timerHandle = requestAnimationFrame(tick);
    },

    answer(choice) {
      resolve(choice);
    },

    abandon() {
      answered = true;
      stopTimer();
    },

    buildRun,
  };
}
