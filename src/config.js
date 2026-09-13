// Backend configuration.
//
// Leave both blank and the leaderboard keeps scores in localStorage, per
// device. Fill them in and the board becomes global.
//
// The anon key is DESIGNED to be public — it ships in every Supabase browser
// app and identifies the project, not you. What protects the data is Row Level
// Security, which supabase/schema.sql sets up: anyone may read scores and
// insert one, nobody may update or delete. Never put the service_role key
// here; that one bypasses RLS entirely.

export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

export const isConfigured = () =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
