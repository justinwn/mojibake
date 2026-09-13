// Leaderboard storage.
//
// Entries are stored as RUNS, not scores. `score` is present only so the store
// can order the query cheaply; it is never believed. Every entry is replayed
// from its seed on read and the recomputed score is the one displayed, so an
// entry claiming a score it cannot reproduce simply vanishes from the board.
//
// STORAGE BACKEND. `claude.use("db")` provides shared server-side storage, but
// only inside a published Claude Artifact. On a static host (GitHub Pages) and
// in local development it does not exist, so the board falls back to
// localStorage and is per-device -- the UI says so rather than implying a
// global ranking. Giving the public site a genuinely shared board means adding
// a real backend; see README.md.

import { replayRun } from "./game.js";

const COLLECTION = "leaderboard";
const BOARD_SIZE = 100;
// Read more than we show: forged entries claim inflated scores to rank high,
// and get dropped during validation. The surplus absorbs that.
const FETCH_SIZE = 400;
// Prune beyond this so the artifact's 5,000-document budget is never at risk.
const KEEP_MAX = 300;
const LOCAL_KEY = "mojibake.scores.v1";

// Not a secret -- it ships in the bundle and anyone reading it can forge a
// signature. Its job is only to stop `db.collection(...).add({score: 1e9})`
// from the console, which is the attack people actually try. Real integrity
// comes from replay validation below.
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
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, KEEP_MAX)));
  } catch {
    /* private mode, or storage full: the board is a nicety, not the game. */
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
  let db = null;
  try {
    db = typeof claude !== "undefined" && claude.use
      ? await claude.use("db")
      : null;
  } catch {
    db = null;
  }

  const mode = db ? "shared" : "local";

  async function fetchRaw() {
    if (!db) return readLocal();
    const snap = await db
      .collection(COLLECTION)
      .orderBy("score", "desc")
      .limit(FETCH_SIZE)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // Best-effort: keep the collection from growing without bound. Races here
  // are harmless -- a delete that loses is a no-op.
  async function prune() {
    if (!db) return;
    try {
      const snap = await db
        .collection(COLLECTION)
        .orderBy("score", "desc")
        .limit(FETCH_SIZE)
        .get();
      const doomed = snap.docs.slice(KEEP_MAX);
      for (const d of doomed.slice(0, 25)) {
        await db.collection(COLLECTION).doc(d.id).delete();
      }
    } catch {
      /* pruning is housekeeping; never fail a submission over it. */
    }
  }

  return {
    mode,

    async top() {
      try {
        return await verifyAll(await fetchRaw(), data);
      } catch {
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
      if (!clean) throw new Error("empty handle");

      // Refuse to publish a run this client cannot itself validate -- better a
      // clear failure here than a row that silently never appears.
      const res = replayRun(run, data);
      if (!res.valid) throw new Error("run failed validation: " + res.reason);

      const row = {
        ...run,
        handle: clean,
        country: String(country || "").slice(0, 2),
        score: res.score,
        rounds: res.rounds,
        sig: await sign(run),
      };

      if (!db) {
        const rows = readLocal();
        rows.push({ ...row, id: "local-" + Date.now() });
        rows.sort((a, b) => b.score - a.score);
        writeLocal(rows);
        return;
      }

      await db.collection(COLLECTION).add(row);
      prune();
    },
  };
}
