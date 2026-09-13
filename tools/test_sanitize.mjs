// Handle sanitising. Run: node tools/test_sanitize.mjs
import { sanitizeHandle } from "../src/leaderboard.js";

const NUL = String.fromCharCode(0);
const UNIT_SEP = String.fromCharCode(31);
const DEL = String.fromCharCode(127);

const cases = [
  ["  Justine  ", "Justine"],
  ["<script>alert(1)</script>", "scriptalert(1)scr".slice(0, 14)],
  ["a" + NUL + "b" + UNIT_SEP + "c" + DEL + "d", "abcd"],
  ["handle-that-is-far-too-long", "handle-that-is"],
  ['"quoted"', "quoted"],
  ["back\\slash", "backslash"],
  ["", ""],
  [null, ""],
  ["   ", ""],
  ["ふぉんと", "ふぉんと"],
  ["Zoë", "Zoë"],
];

let fail = 0;
for (const [input, expected] of cases) {
  const got = sanitizeHandle(input);
  const ok = got === expected;
  if (!ok) fail++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${JSON.stringify(input)} -> ${JSON.stringify(got)}` +
    (ok ? "" : ` (expected ${JSON.stringify(expected)})`)
  );
}
console.log(`\n${cases.length - fail} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
