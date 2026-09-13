// Replay-validator tests. Run: node tools/test_replay.mjs
//
// These are the tests that matter most in the project: the leaderboard's
// integrity is exactly the strength of replayRun().

import fs from "fs";
import { createRoundGen, scoreFor } from "../src/rounds.js";
import { replayRun, poolFingerprint, MAX_MISTAKES, TIMEOUT_CHOICE } from "../src/game.js";
import { GEN_VERSION } from "../src/rng.js";

const data = JSON.parse(fs.readFileSync(new URL("../fonts.json", import.meta.url)));

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  -> " + extra : "")); }
}

/** Play an honest run: answer correctly until `missAt` rounds are missed. */
function honestRun(seed, { wrongAt = [], reaction = 1200 } = {}) {
  const gen = createRoundGen(seed, data);
  const log = [];
  let mistakes = 0, streak = 0, score = 0, total = 0;
  for (let n = 1; mistakes < MAX_MISTAKES; n++) {
    const r = gen.next();
    const limit = r.seconds * 1000;
    const ms = Math.min(limit, reaction);
    let choice;
    if (wrongAt.includes(n)) {
      choice = (r.answerIndex + 1) % 4;
      mistakes++; streak = 0;
    } else {
      choice = r.answerIndex;
      streak++;
      score += scoreFor({ tier: r.tier, msElapsed: ms, seconds: r.seconds, streak });
    }
    log.push({ r: n, c: choice, ms });
    total += ms;
    if (n > 500) break;
  }
  const startedAt = 1700000000000;
  return {
    entry: {
      seed, log, startedAt,
      submittedAt: startedAt + total + 1500 * log.length,
      gen: GEN_VERSION, pool: poolFingerprint(data),
    },
    expectedScore: score,
  };
}

console.log("\nhonest runs");
for (const seed of ["alpha", "bravo", "charlie"]) {
  const { entry, expectedScore } = honestRun(seed, { wrongAt: [4, 9, 14] });
  const res = replayRun(entry, data);
  check(`${seed} validates`, res.valid, res.reason);
  check(`${seed} score reproduces (${expectedScore})`, res.score === expectedScore,
    `got ${res.score}`);
}

// A long clean run, missing only at the very end.
{
  const { entry, expectedScore } = honestRun("marathon", { wrongAt: [30, 31, 32], reaction: 900 });
  const res = replayRun(entry, data);
  check(`32-round run validates (score ${expectedScore})`, res.valid, res.reason);
  check("rounds counted", res.rounds === 32, `got ${res.rounds}`);
}

console.log("\ntampering is rejected");
const base = () => honestRun("victim", { wrongAt: [5, 10, 15] }).entry;

function rejects(name, mutate, expectReason) {
  const e = base();
  mutate(e);
  const res = replayRun(e, data);
  check(name, !res.valid && (!expectReason || res.reason === expectReason),
    res.valid ? `ACCEPTED score=${res.score}` : `reason=${res.reason}`);
}

// The naive attack: write a big number straight into the store.
{
  const e = base();
  e.score = 999999;
  const res = replayRun(e, data);
  check("injected score field is ignored, not trusted",
    res.valid && res.score !== 999999, `score=${res.score}`);
}

rejects("superhuman timings", (e) => { for (const s of e.log) s.ms = 5; }, "inhuman-timing");
rejects("negative timing", (e) => { e.log[0].ms = -100; }, "bad-timing");
rejects("answering after the deadline", (e) => { e.log[0].ms = 99000; }, "over-deadline");
rejects("out-of-range choice", (e) => { e.log[0].c = 7; }, "bad-choice");
rejects("reordered log", (e) => { e.log.reverse(); }, "round-mismatch");
rejects("deleted a losing round", (e) => { e.log.splice(5, 1); }, "round-mismatch");
rejects("run that never ended", (e) => { e.log = e.log.slice(0, 3); }, "unfinished");
rejects("playing on past game over", (e) => {
  e.log.push({ r: e.log.length + 1, c: 0, ms: 1000 });
}, "played-past-game-over");
rejects("swapped seed keeps old log", (e) => { e.seed = "different-seed"; });
rejects("stale generator version", (e) => { e.gen = 0; }, "stale-generator");
rejects("stale font pool", (e) => { e.pool = "zzzz"; }, "stale-pool");
rejects("empty log", (e) => { e.log = []; }, "empty-log");
rejects("clock says less time than logged", (e) => {
  e.submittedAt = e.startedAt + 10;
}, "clock-too-short");
rejects("absurd wall clock", (e) => {
  e.submittedAt = e.startedAt + 40 * 24 * 3600 * 1000;
}, "clock-too-long");
rejects("garbage entry", (e) => { e.log = [{ nope: 1 }]; });

// The realistic attack: fabricate a perfect run from scratch.
{
  const gen = createRoundGen("forged", data);
  const log = [];
  for (let n = 1; n <= 60; n++) {
    const r = gen.next();
    log.push({ r: n, c: r.answerIndex, ms: 400 });
  }
  // Attacker forgets the run has to actually end.
  const startedAt = 1700000000000;
  const res = replayRun({
    seed: "forged", log, startedAt, submittedAt: startedAt + 60 * 2000,
    gen: GEN_VERSION, pool: poolFingerprint(data),
  }, data);
  check("perfect never-ending run rejected", !res.valid, res.reason);
}

// The one that SHOULD pass: a bot that plays properly and loses on purpose.
{
  const { entry } = honestRun("bot", { wrongAt: [50, 51, 52], reaction: 400 });
  const res = replayRun(entry, data);
  check("a bot that genuinely plays well is accepted (known limit)",
    res.valid, res.reason);
  console.log(`       ^ bot scored ${res.score} over ${res.rounds} rounds`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
