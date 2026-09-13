// Supabase access over PostgREST, with plain fetch.
//
// No SDK: the two calls this game makes are a select and an insert, and a CDN
// dependency for that would cost more than it saves.
//
// Column names are snake_case in Postgres and camelCase in the run objects, so
// this module owns the mapping and nothing above it has to know.

const TABLE = "scores";
const SELECT =
  "id,handle,country,score,rounds,seed,log,started_at,submitted_at,gen,pool,sig";

function rowToRun(r) {
  return {
    id: r.id,
    handle: r.handle,
    country: r.country,
    score: r.score,
    rounds: r.rounds,
    seed: r.seed,
    log: r.log,
    startedAt: Number(r.started_at),
    submittedAt: Number(r.submitted_at),
    gen: r.gen,
    pool: r.pool,
    sig: r.sig,
  };
}

function runToRow(e) {
  return {
    handle: e.handle,
    country: e.country,
    score: e.score,
    rounds: e.rounds,
    seed: e.seed,
    log: e.log,
    started_at: e.startedAt,
    submitted_at: e.submittedAt,
    gen: e.gen,
    pool: e.pool,
    sig: e.sig,
  };
}

/** Pull a readable message out of a PostgREST error body. */
async function errorFrom(res) {
  let detail = "";
  try {
    const body = await res.json();
    detail = body.message || body.hint || body.details || "";
  } catch {
    /* Non-JSON error body; the status is all we have. */
  }
  // Trigger messages ("slow down: ...") are written to be shown to players.
  return new Error(detail || `request failed (${res.status})`);
}

export function createSupabase(url, key) {
  const base = url.replace(/\/+$/, "") + "/rest/v1/" + TABLE;
  const headers = {
    apikey: key,
    Authorization: "Bearer " + key,
  };

  return {
    async top(limit) {
      const q =
        `${base}?select=${SELECT}` +
        `&order=score.desc,created_at.asc&limit=${limit}`;
      const res = await fetch(q, { headers });
      if (!res.ok) throw await errorFrom(res);
      const rows = await res.json();
      return rows.map(rowToRun);
    },

    async insert(entry) {
      const res = await fetch(base, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(runToRow(entry)),
      });
      if (!res.ok) throw await errorFrom(res);
    },
  };
}
