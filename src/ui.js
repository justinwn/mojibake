// Screen orchestration: intro -> rounds -> score card.

import { createGame, MAX_MISTAKES, TIMEOUT_CHOICE } from "./game.js";
import { TIER_LABELS, tierForRound } from "./rounds.js";
import { newSeed } from "./rng.js";
import { loadRoundFonts, prefetchRoundFonts, loadUiFonts } from "./fontload.js";
import { recordRun } from "./best.js";
import {
  renderCard, formatElapsed, canShareImage, fileFor, download,
} from "./sharecard.js";
import { createAudio } from "./audio.js";
import {
  sprite, SAD_FACE, HEART, HEART_EMPTY, TROPHY, SPARKLE, DESKTOP_ICONS,
} from "./pixel.js";
import { DOCS, DEFAULT_DOC } from "./legal.js";

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
  notepad: $("notepad"), npTabs: $("np-tabs"), npBody: $("np-body"),
  npUrl: $("np-url"), npTitle: $("np-title"), npTask: $("np-task"),
  npMin: $("np-min"), npClose: $("np-close"),
};

function renderDesktopIcons() {
  for (const { name, grid, action } of DESKTOP_ICONS) {
    // Icons that open something are real buttons; the rest stay wallpaper.
    const item = document.createElement(action ? "button" : "div");
    item.className = "dicon" + (action ? " dicon-btn" : "");
    if (action) {
      item.type = "button";
      item.addEventListener("click", () => openNotepad());
    } else {
      item.setAttribute("aria-hidden", "true");
    }
    item.appendChild(sprite(grid));
    const label = document.createElement("span");
    label.textContent = name;
    item.appendChild(label);
    el.icons.appendChild(item);
  }
}

/* ---------------- notepad window ---------------- */

let npDoc = DEFAULT_DOC;
let npOpen = false;

function docUrl(slug) {
  return location.origin + location.pathname + "#" + slug;
}

function renderNotepad() {
  const doc = DOCS[npDoc];

  el.npTabs.textContent = "";
  for (const key of Object.keys(DOCS)) {
    const t = document.createElement("button");
    t.type = "button";
    t.role = "tab";
    t.textContent = DOCS[key].tab;
    t.setAttribute("aria-selected", String(key === npDoc));
    t.addEventListener("click", () => openNotepad(key));
    el.npTabs.appendChild(t);
  }

  el.npBody.textContent = "";
  el.npBody.appendChild(h("h3", null, doc.title));
  el.npBody.appendChild(h("p", "updated", "Last updated: " + doc.updated));
  for (const block of doc.blocks) {
    if (block.h) el.npBody.appendChild(h("h4", null, block.h));
    if (block.p) el.npBody.appendChild(h("p", null, block.p));
  }
  el.npBody.scrollTop = 0;

  el.npUrl.textContent = docUrl(doc.slug);
  el.npTitle.textContent = `From the Creator — ${doc.file}`;
}

function openNotepad(slug) {
  if (slug && DOCS[slug]) npDoc = slug;
  npOpen = true;
  renderNotepad();
  el.notepad.hidden = false;
  el.npTask.hidden = true;
  if (location.hash.slice(1) !== DOCS[npDoc].slug) {
    history.replaceState(null, "", "#" + DOCS[npDoc].slug);
  }
  el.npBody.focus();
}

function minimizeNotepad() {
  el.notepad.hidden = true;
  el.npTask.hidden = false;
  el.npTask.focus();
  // Still "open", just not on screen -- the hash stays so the link survives.
}

function closeNotepad() {
  npOpen = false;
  el.notepad.hidden = true;
  el.npTask.hidden = true;
  if (location.hash) history.replaceState(null, "", location.pathname);
}

function syncNotepadToHash() {
  const slug = location.hash.slice(1).toLowerCase();
  const match = Object.keys(DOCS).find((k) => DOCS[k].slug === slug);
  if (match) openNotepad(match);
  else if (npOpen) closeNotepad();
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

function showGameOver() {
  phase = "over";
  const run = pendingRun;
  const finalScore = shownScore;
  const rounds = run.log.length;
  const elapsedMs = run.submittedAt - run.startedAt;
  const tier = tierForRound(rounds);
  const { best, isNew } = recordRun(finalScore, rounds);

  sfx.play(finalScore > 0 ? "score" : "gameover");

  // The card is rendered NOW, not in the click handler: iOS only honours
  // navigator.share when the user gesture reaches it directly, and awaiting
  // toBlob() inside the handler breaks that chain.
  const cardPromise = renderCard({ score: finalScore, rounds, tier, elapsedMs })
    .catch(() => null);

  sheet((s) => {
    const row = h("div", "result");

    const tile = h("div", "trophy-tile");
    tile.appendChild(sprite(TROPHY, { cls: "trophy" }));
    for (let i = 0; i < 3; i++) {
      const sp = sprite(SPARKLE, { cls: "spark spark-" + (i + 1) });
      tile.appendChild(sp);
    }
    row.appendChild(tile);

    const col = h("div", "result-text");
    col.appendChild(h("h2", null, "Nicely done!"));
    col.appendChild(h("div", "bigscore", finalScore.toLocaleString("en-US")));
    const plural = rounds === 1 ? "" : "s";
    col.appendChild(h("p", "runline",
      `${rounds} round${plural} in ${formatElapsed(elapsedMs)}`));
    col.appendChild(h("p", "muted", isNew && finalScore > 0
      ? "New personal best!"
      : `Best: ${best ? best.score.toLocaleString("en-US") : 0}`));
    row.appendChild(col);
    s.appendChild(row);

    s.appendChild(h("p", null, "Share your best score or play again."));

    const buttons = h("div", "row");
    const share = h("button", "btn", "Share score");
    share.type = "button";
    share.disabled = true;
    const again = h("button", "btn", "Play again");
    again.type = "button";
    again.addEventListener("click", playAgain);
    buttons.append(share, again);
    s.appendChild(buttons);

    const note = h("p", "muted", "");
    s.appendChild(note);

    cardPromise.then((blob) => {
      if (!blob) {
        share.textContent = "Save image";
        note.textContent = "The score image could not be created.";
        return;
      }
      const file = fileFor(blob, finalScore);
      const shareable = canShareImage(file);
      // The label always names what the button actually does.
      share.textContent = shareable ? "Share score" : "Save image";
      share.disabled = false;
      share.addEventListener("click", async () => {
        if (!shareable) {
          download(blob, finalScore);
          note.textContent = "Saved to your downloads.";
          return;
        }
        try {
          await navigator.share({ files: [file], title: "Mojibake" });
        } catch (err) {
          // Dismissing the share sheet is a normal outcome, not a failure.
          if (err && err.name !== "AbortError") download(blob, finalScore);
        }
      });
    });

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
  if (ev.key === "Escape" && npOpen && !el.notepad.hidden) {
    closeNotepad();
    return;
  }
  // The notepad covers the game; number keys belong to it, not to the round.
  if (phase !== "playing" || (npOpen && !el.notepad.hidden)) return;
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

  el.win.hidden = false;
  showTitle();
}

// Desktop chrome is independent of the game: it should be there from the
// first frame, not wait on fonts.json.
startClock();
renderDesktopIcons();
paintSound();

el.npMin.addEventListener("click", minimizeNotepad);
el.npClose.addEventListener("click", closeNotepad);
el.npTask.addEventListener("click", () => openNotepad());
addEventListener("hashchange", syncNotepadToHash);
// Deep link: /#privacy and /#terms open straight to that document.
syncNotepadToHash();
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
