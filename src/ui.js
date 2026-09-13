// Screen orchestration: intro -> rounds -> game over -> leaderboard.

import { createGame, MAX_MISTAKES, TIMEOUT_CHOICE } from "./game.js";
import { TIER_LABELS } from "./rounds.js";
import { newSeed } from "./rng.js";
import { loadRoundFonts, prefetchRoundFonts, loadUiFonts } from "./fontload.js";
import { createLeaderboard, sanitizeHandle } from "./leaderboard.js";
import { COUNTRIES, flagFor } from "./countries.js";
import { createAudio } from "./audio.js";
import { sprite, SAD_FACE, HEART, HEART_EMPTY, DESKTOP_ICONS } from "./pixel.js";

const sfx = createAudio();

const $ = (id) => document.getElementById(id);
const el = {
  win: $("win"),
  word: $("word"), loading: $("loading"), sheet: $("sheet"), miss: $("miss"),
  canvas: $("canvas"), options: $("options"),
  round: $("s-round"), score: $("s-score"), pips: $("s-pips"),
  time: $("s-time"), bar: $("s-bar"),
  taskbar: $("taskbar"), clock: $("clock"),
  icons: $("desktop-icons"), sound: $("sound"), soundIco: $("sound-ico"),
};

function renderDesktopIcons() {
  for (const { name, grid } of DESKTOP_ICONS) {
    const item = document.createElement("div");
    item.className = "dicon";
    item.appendChild(sprite(grid));
    const label = document.createElement("span");
    label.textContent = name;
    item.appendChild(label);
    el.icons.appendChild(item);
  }
}

function paintSound() {
  const on = !sfx.muted;
  el.soundIco.textContent = on ? "♪" : "✕";
  el.sound.setAttribute("aria-pressed", on ? "false" : "true");
  el.sound.title = on ? "Mute sound" : "Unmute sound";
  el.sound.classList.toggle("off", !on);
}

// A real clock in the system tray — the one piece of chrome that isn't a prop.
function startClock() {
  const paint = () => {
    el.clock.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit", minute: "2-digit",
    });
  };
  paint();
  setInterval(paint, 15000);
}

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FEEDBACK_MS = reduceMotion ? 450 : 1100;

// Picked with Math.random, deliberately NOT the seeded round generator: these
// are cosmetic, and drawing from that stream would desync replay validation.
const WRONG_MESSAGES = [
  "Ooops, wrong guess.",
  "Try again next time.",
  "Incorrect.",
  "Not quite.",
  "That's not it.",
  "So close.",
  "Nope.",
];

let data = null;
let board = null;
let game = null;
let pendingRun = null;
let phase = "boot";
let shownScore = 0;

/* ---------------- status bar ---------------- */

/** Three hearts; a spent life becomes an empty outline. */
function renderHearts(into, mistakes) {
  into.textContent = "";
  for (let i = 0; i < MAX_MISTAKES; i++) {
    // Lives empty from the right, so the remaining hearts stay left-aligned
    // against the label instead of the row appearing to drain backwards.
    const spent = i >= MAX_MISTAKES - mistakes;
    into.appendChild(sprite(spent ? HEART_EMPTY : HEART, { cls: "heart" }));
  }
  into.setAttribute(
    "aria-label", `${MAX_MISTAKES - mistakes} of ${MAX_MISTAKES} lives left`
  );
}

function renderPips(mistakes) {
  renderHearts(el.pips, mistakes);
}

// Count up rather than snapping, so a big streak bonus reads as an event.
function animateScore(to) {
  const from = shownScore;
  if (reduceMotion || from === to) {
    shownScore = to;
    el.score.textContent = String(to);
    return;
  }
  const start = performance.now();
  const dur = 520;
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.score.textContent = String(Math.round(from + (to - from) * eased));
    if (t < 1) requestAnimationFrame(step);
    else shownScore = to;
  };
  requestAnimationFrame(step);
}

function onTick(leftMs, totalMs) {
  const secs = Math.max(0, leftMs / 1000);
  el.time.textContent = secs.toFixed(1) + "s";
  const frac = Math.max(0, Math.min(1, leftMs / totalMs));
  el.bar.style.transform = `scaleX(${frac})`;
  el.bar.classList.toggle("low", frac < 0.28);
}

/* ---------------- round rendering ---------------- */

function renderOptions(round, { disabled = false } = {}) {
  el.options.textContent = "";
  round.options.forEach((name, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "opt";
    b.disabled = disabled;
    b.dataset.index = String(i);

    const cap = document.createElement("span");
    cap.className = "cap";
    cap.textContent = String(i + 1);

    const nm = document.createElement("span");
    nm.className = "name";
    // Deliberately NOT set in its own typeface: that would give it away.
    nm.textContent = name;

    b.append(cap, nm);
    b.addEventListener("click", () => answer(i));
    el.options.appendChild(b);
  });
}

function popup(text, kind) {
  const d = document.createElement("div");
  d.className = "pop " + kind;
  d.textContent = text;
  el.canvas.appendChild(d);
  setTimeout(() => d.remove(), 1200);
}

// Cover the word entirely. Revealing the typeface you just failed to name
// would give away the answer for free.
function showMiss(message) {
  el.miss.textContent = "";
  el.word.classList.add("is-hidden");
  const face = h("div", "face");
  face.appendChild(sprite(SAD_FACE, { cls: "sadface" }));
  const msg = h("div", "msg", message);
  el.miss.append(face, msg);
  el.miss.classList.remove("hidden");
}

function clearMiss() {
  el.miss.classList.add("hidden");
  el.miss.textContent = "";
}

async function nextRound() {
  phase = "loading";
  const round = game.prepare();

  el.round.textContent = `${round.round} · ${TIER_LABELS[round.tier]}`;
  el.time.textContent = "—";
  el.bar.style.transform = "scaleX(1)";
  el.bar.classList.remove("low");

  clearMiss();
  el.word.classList.add("is-hidden");
  el.loading.classList.remove("hidden");
  renderOptions(round, { disabled: true });

  // The clock does not start until the typeface is genuinely rendering, so
  // network latency is never charged to the player.
  const { ok } = await loadRoundFonts(round);

  el.word.style.fontFamily = `"${round.answer}", ${ok ? "serif" : "sans-serif"}`;
  el.word.textContent = round.decoy;
  el.word.classList.remove("is-hidden");
  el.loading.classList.add("hidden");

  for (const b of el.options.querySelectorAll(".opt")) b.disabled = false;

  phase = "playing";
  game.start();

  prefetchRoundFonts(game.peek());
}

function answer(i) {
  if (phase !== "playing") return;
  game.answer(i);
}

function onResolved(info) {
  phase = "feedback";

  const buttons = [...el.options.querySelectorAll(".opt")];
  buttons.forEach((b) => { b.disabled = true; });
  if (buttons[info.round.answerIndex]) {
    buttons[info.round.answerIndex].classList.add("correct");
  }
  if (!info.correct && !info.timedOut && buttons[info.choice]) {
    buttons[info.choice].classList.add("wrong");
  }

  if (info.correct) {
    sfx.play("correct");
    popup("+" + info.gained, "gain");
    animateScore(info.score);
  } else {
    sfx.play("incorrect");
    showMiss(info.timedOut
      ? "Time's up."
      : WRONG_MESSAGES[Math.floor(Math.random() * WRONG_MESSAGES.length)]);
    popup("−💔", "loss");
    if (!reduceMotion) {
      el.win.classList.add("shake");
      setTimeout(() => el.win.classList.remove("shake"), 400);
    }
  }
  renderPips(info.mistakes);

  setTimeout(() => {
    if (pendingRun) showGameOver();
    else nextRound();
  }, FEEDBACK_MS);
}

/* ---------------- sheets ---------------- */

function sheet(build) {
  el.sheet.textContent = "";
  el.sheet.classList.remove("hidden");
  const inner = document.createElement("div");
  inner.className = "sheetin";
  el.sheet.appendChild(inner);
  build(inner);
}

function hideSheet() {
  el.sheet.classList.add("hidden");
  el.sheet.textContent = "";
}

function h(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function renderBoard(parent, entries, highlightId) {
  const wrap = h("div", "board");
  if (!entries.length) {
    wrap.appendChild(h("div", "empty", "No scores yet. Be the first."));
  }
  entries.forEach((e, i) => {
    const row = h("div", "entry" + (e.id === highlightId ? " you" : ""));
    row.appendChild(h("span", "rank", String(i + 1).padStart(2, "0")));
    row.appendChild(h("span", null, e.country ? flagFor(e.country) : "🏳️"));
    row.appendChild(h("span", "nm", e.handle));
    row.appendChild(h("span", "pts", String(e.score)));
    wrap.appendChild(row);
  });
  parent.appendChild(wrap);
}

async function showGameOver() {
  phase = "over";
  const run = pendingRun;
  const finalScore = shownScore;
  const rounds = run.log.length;
  // The run is over either way; a top-100 finish upgrades this to the score
  // fanfare once the board comes back.
  sfx.play("gameover");

  sheet((s) => {
    s.appendChild(h("h2", null, "GAME OVER"));
    s.appendChild(h("div", "bigscore", String(finalScore)));
    s.appendChild(h("p", null,
      `${rounds} round${rounds === 1 ? "" : "s"} survived.`));
    s.appendChild(h("p", "muted", "Checking the board…"));
  });

  let entries = [];
  try {
    entries = await board.top();
  } catch {
    entries = [];
  }

  if (board.qualifies(finalScore, entries)) {
    showNameForm(run, finalScore, rounds, entries);
  } else {
    showFinal(entries, null, finalScore, rounds);
  }
}

function showNameForm(run, finalScore, rounds, entries) {
  sfx.play("score");
  sheet((s) => {
    s.appendChild(h("h2", null, "TOP 100!"));
    s.appendChild(h("div", "bigscore", String(finalScore)));
    s.appendChild(h("p", null, "Claim your place on the board."));

    const form = document.createElement("form");
    form.className = "form";

    const lh = h("label", null, "Handle");
    lh.htmlFor = "handle";
    const input = document.createElement("input");
    input.id = "handle";
    input.maxLength = 14;
    input.required = true;
    input.autocomplete = "off";
    input.placeholder = "AAA";

    const lc = h("label", null, "Country");
    lc.htmlFor = "country";
    const select = document.createElement("select");
    select.id = "country";
    for (const c of COUNTRIES) {
      const o = document.createElement("option");
      o.value = c.code;
      o.textContent = `${c.flag}  ${c.name}`;
      select.appendChild(o);
    }
    // A sensible default from the browser's own locale, still changeable.
    const guess = (navigator.language || "").split("-")[1];
    if (guess) select.value = guess.toUpperCase();

    const submit = h("button", "btn", "Save score");
    submit.type = "submit";

    // Saving is optional: never trap someone on this screen to play again.
    const again = h("button", "btn ghost", "Play again");
    again.type = "button";
    again.addEventListener("click", playAgain);

    const buttons = h("div", "row");
    buttons.append(submit, again);

    const err = h("p", "muted", "");

    form.append(lh, input, lc, select, buttons, err);
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const handle = sanitizeHandle(input.value);
      if (!handle) {
        err.textContent = "Pick a handle of at least one character.";
        return;
      }
      submit.disabled = true;
      submit.textContent = "Saving…";
      try {
        await board.submit(run, handle, select.value);
        const fresh = await board.top();
        const mine = fresh.find(
          (e) => e.handle === handle && e.score === finalScore
        );
        showFinal(fresh, mine ? mine.id : null, finalScore, rounds);
      } catch (e) {
        submit.disabled = false;
        submit.textContent = "Save score";
        err.textContent = "Could not save that score. " + (e.message || "");
      }
    });

    s.appendChild(form);
    setTimeout(() => input.focus(), 30);
  });
}

function showFinal(entries, highlightId, finalScore, rounds) {
  sheet((s) => {
    s.appendChild(h("h2", null, "GAME OVER"));
    s.appendChild(h("div", "bigscore", String(finalScore)));
    s.appendChild(h("p", "muted",
      `${rounds} round${rounds === 1 ? "" : "s"} survived · ` +
      (board.mode === "shared"
        ? "shared board"
        : "saved on this device only")));
    renderBoard(s, entries, highlightId);

    const again = h("button", "btn", "Play again");
    again.type = "button";
    again.addEventListener("click", playAgain);
    const row = h("div", "row");
    row.appendChild(again);
    s.appendChild(row);
    setTimeout(() => again.focus(), 30);
  });
}

/* ---------------- lifecycle ---------------- */

function startGame() {
  hideSheet();
  pendingRun = null;
  shownScore = 0;
  el.score.textContent = "0";
  renderPips(0);

  game = createGame(data, newSeed(), {
    tick: onTick,
    resolved: onResolved,
    gameOver: (run) => { pendingRun = run; },
  });
  nextRound();
}

/** Start a new run from a "Play again" button: the title music stands in for
    the start screen the player is skipping past. */
function playAgain() {
  sfx.play("start");
  startGame();
}

function showTitle() {
  phase = "title";
  sfx.play("start");
  el.options.textContent = "";
  el.round.textContent = "—";
  el.time.textContent = "—";
  renderPips(0);

  sheet((s) => {
    s.appendChild(h("h2", null, "MOJIBAKE"));
    s.appendChild(h("p", null, "A font guessing game"));

    const lives = h("div", "liveline");
    lives.appendChild(h("span", "livelabel", "Lives left:"));
    const hearts = h("span", "hearts");
    renderHearts(hearts, 0);
    lives.appendChild(hearts);
    s.appendChild(lives);

    const go = h("button", "btn", "Start");
    go.type = "button";
    go.addEventListener("click", startGame);
    const row = h("div", "row");
    row.appendChild(go);
    s.appendChild(row);
    setTimeout(() => go.focus(), 30);
  });
}

document.addEventListener("keydown", (ev) => {
  if (phase !== "playing") return;
  const n = Number(ev.key);
  if (Number.isInteger(n) && n >= 1 && n <= 4) {
    ev.preventDefault();
    answer(n - 1);
  }
});

// A backgrounded tab cannot be played fairly, and requestAnimationFrame stops
// firing there anyway. Forfeit the round rather than let the clock lie.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && phase === "playing") game.answer(TIMEOUT_CHOICE);
});

async function boot() {
  loadUiFonts();

  const res = await fetch("fonts.json");
  data = await res.json();
  board = await createLeaderboard(data);

  el.win.hidden = false;
  showTitle();
}

// Desktop chrome is independent of the game: it should be there from the
// first frame, not wait on fonts.json.
startClock();
renderDesktopIcons();
paintSound();
el.sound.addEventListener("click", () => {
  sfx.toggle();
  paintSound();
});

// The title music is requested before the page has seen a gesture, so browsers
// block it. Start it on the first interaction instead of losing it.
for (const ev of ["pointerdown", "keydown"]) {
  addEventListener(ev, () => sfx.resume(), { once: false, passive: true });
}
boot();
