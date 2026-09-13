// Leaderboard storage.
//
// Entries are stored as RUNS, not scores. `score` exists only so the database
// can order the query cheaply; it is never believed. Every entry is replayed
// from its seed on read and the recomputed score is the one displayed, so an
// entry claiming a score it cannot reproduce simply vanishes from the board.
//
// BACKEND. Supabase when src/config.js is filled in, otherwise localStorage on
// this device. Both satisfy the same tiny interface, so everything below the
// `remote` check is identical either way.

import { replayRun } from "./game.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isConfigured } from "./config.js";
import { createSupabase } from "./supabase.js";

const BOARD_SIZE = 100;
// Read more than we show: forged entries claim inflated scores to rank high and
// are dropped during validation. The surplus absorbs that.
const FETCH_SIZE = 400;
const KEEP_LOCAL = 300;
const LOCAL_KEY = "mojibake.scores.v1";

// Not a secret — it ships in the bundle and anyone reading it can forge a
// signature. Its only job is to stop a hand-written INSERT from the console.
// Real integrity comes from replay validation below.
const SIG_SALT = "mojibake/v1";

function canonical(run) {
  return [
    run.seed,
    run.gen,
    run.pool,
    run.startedAt,
    run.submittedAt,
    run.log.map((s) => `${s.r}.${s.c}.${s.ms}`).join(","),
  ].join("|");
}

async function sign(run) {
  const bytes = new TextEncoder().encode(SIG_SALT + "|" + canonical(run));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest).slice(0, 12))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function sanitizeHandle(raw) {
  return String(raw || "")
    .replace(/[\p{Cc}<>&"'`\\]/gu, "")
    .trim()
    .slice(0, 14);
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal(rows) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, KEEP_LOCAL)));
  } catch {
    /* Private mode, or storage full: the board is a nicety, not the game. */
  }
}

/** Validate a stored row and return a display entry, or null to drop it. */
async function verify(row, data) {
  if (!row || typeof row !== "object") return null;
  const handle = sanitizeHandle(row.handle);
  if (!handle) return null;

  const run = {
    seed: row.seed,
    log: row.log,
    startedAt: row.startedAt,
    submittedAt: row.submittedAt,
    gen: row.gen,
    pool: row.pool,
  };

  let expected;
  try {
    expected = await sign(run);
  } catch {
    return null;
  }
  if (row.sig !== expected) return null;

  const res = replayRun(run, data);
  if (!res.valid) return null;

  return {
    id: row.id,
    handle,
    country: typeof row.country === "string" ? row.country.slice(0, 2) : "",
    score: res.score,
    rounds: res.rounds,
    at: row.submittedAt,
  };
}

async function verifyAll(rows, data) {
  const out = [];
  for (const row of rows) {
    const entry = await verify(row, data);
    if (entry) out.push(entry);
  }
  out.sort((a, b) => b.score - a.score || a.at - b.at);
  return out.slice(0, BOARD_SIZE);
}

export async function createLeaderboard(data) {
  const remote = isConfigured()
    ? createSupabase(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  return {
    mode: remote ? "global" : "local",

    async top() {
      try {
        const rows = remote ? await remote.top(FETCH_SIZE) : readLocal();
        return await verifyAll(rows, data);
      } catch {
        // A board that cannot be reached must not block the game over screen.
        return [];
      }
    },

    /** Would this score make the board? */
    qualifies(score, entries) {
      if (score <= 0) return false;
      if (entries.length < BOARD_SIZE) return true;
      return score > entries[entries.length - 1].score;
    },

    async submit(run, handle, country) {
      const clean = sanitizeHandle(handle);
      if (!clean) throw new Error("Pick a handle of at least one character.");

      // Refuse to publish a run this client cannot itself validate: better a
      // clear failure here than a row that silently never appears.
      const res = replayRun(run, data);
      if (!res.valid) throw new Error("This run failed validation.");

      const entry = {
        ...run,
        handle: clean,
        country: String(country || "").slice(0, 2),
        score: res.score,
        rounds: res.rounds,
        sig: await sign(run),
      };

      if (remote) {
        await remote.insert(entry);
        return;
      }

      const rows = readLocal();
      rows.push({ ...entry, id: "local-" + Date.now() });
      rows.sort((a, b) => b.score - a.score);
      writeLocal(rows);
    },
  };
}
