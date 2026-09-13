// Country list for the leaderboard.
//
// Only ISO 3166-1 alpha-2 codes are stored. Names come from the browser's own
// Intl data and flags are derived from the code, so there is no name table to
// ship or keep current.

const CODES = (
  "AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT " +
  "BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC " +
  "EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HN HR HT HU " +
  "ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI " +
  "LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MR MT MU MV MW MX MY MZ " +
  "NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PT PW PY QA RO RS RU RW SA " +
  "SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO " +
  "TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW"
).split(" ");

export function flagFor(code) {
  if (!code || code.length !== 2) return "🏳️";
  // Regional indicator symbols sit 0x1F1A5 above ASCII uppercase.
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))
  );
}

let names = null;
try {
  names = new Intl.DisplayNames(["en"], { type: "region" });
} catch {
  names = null;
}

export function nameFor(code) {
  if (code === "XK") return "Kosovo"; // Not in every browser's CLDR data.
  try {
    return names ? names.of(code) || code : code;
  } catch {
    return code;
  }
}

export const COUNTRIES = CODES.map((code) => ({
  code,
  name: nameFor(code),
  flag: flagFor(code),
})).sort((a, b) => a.name.localeCompare(b.name));
