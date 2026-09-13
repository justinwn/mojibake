# Mojibake

**文字化け** — *"character corruption"*, when text renders in the wrong encoding and comes out as garbage.

A typography guessing game. The word on screen is the name of a font — but it is **set in a
different one**. Name the typeface you can actually see, not the one you're reading.

Rounds are unlimited and get harder as you go. Three mistakes ends the run.

**Play it: <https://mojibake.justinewin.com/>**

## Playing

Click an option or press <kbd>1</kbd>–<kbd>4</kbd>. The clock only starts once the typeface has
actually loaded, so slow network time is never charged to the player.

Difficulty escalates in four tiers, drawn from **1,593 Google Fonts**:

| Rounds | Tier | Options are… | Clock |
| --- | --- | --- | --- |
| 1–3 | Easy | from different categories entirely | 12s |
| 4–8 | Normal | same category, different group | 10s |
| 9–15 | Hard | all from one lookalike group | 8s |
| 16+ | Brutal | lookalikes, drawn from obscure families | 6s |

By the late rounds you get sets like *EB Garamond / Cormorant Garamond / Spectral / Gentium Book
Plus*, which is the intended cruelty.

## Running locally

```bash
python3 tools/devserver.py 4179
```

Then open <http://localhost:4179>. A plain static server works too, but `devserver.py` sends
`no-store` and an explicit UTF-8 charset, which avoids stale-module and encoding headaches.

```bash
node tools/check_imports.mjs # every named import resolves (no build step to catch this)
node tools/test_replay.mjs   # scoring and round-generation regression tests
python3 tools/build_pool.py  # regenerate fonts.json from the Google Fonts catalog
```

## How it's built

No framework and no build step — ES modules served as-is.

```
index.html          page shell
styles.css          theme tokens, Win95 bevels, light + dark
fonts.json          generated font pool (committed)
src/rng.js          seeded PRNG — the whole run derives from one seed
src/rounds.js       tier curve, lookalike distractor selection
src/fontload.js     subsetted Google Fonts loading
src/game.js         state machine, scoring, run log, replay validator
src/ui.js           screens, input, animation, notepad window
src/sharecard.js    the shareable PNG, drawn with Canvas 2D
src/best.js         personal best in localStorage
src/legal.js        Privacy and Terms copy
src/pixel.js        pixel-art sprites, drawn from character grids
src/audio.js        sound clips
tools/              build + test scripts
```

### Two details worth knowing

**The answer is never leaked over the network.** All four option typefaces are requested each
round, not just the correct one — otherwise the Network tab would hand over the answer. Each
request is glyph-subset to just the word being shown (`&text=`), so four families cost about
800 bytes.

**A whole run is reproducible from one number.** The round sequence is derived deterministically
from a seed, and every answer is logged as `{round, choice, ms}`, so `replayRun()` can recompute
any score from scratch. Nothing ships that depends on it today, but it is what
`tools/test_replay.mjs` uses to hold the scoring arithmetic and the round generator still across
26 cases.

## The score card

Lose three lives and the game draws a shareable PNG — 1080x1920, portrait, sized for stories.
The card *is* the game window: same chrome, same palette, same sprites, with a status bar reading
your real round, tier, score and time. It is drawn with Canvas 2D and no library.

Two details worth knowing:

- The card is rendered when the score screen mounts, **not** in the button's click handler. iOS
  only honours `navigator.share` when the user gesture reaches it directly, and awaiting
  `canvas.toBlob()` inside the handler breaks that chain.
- `await document.fonts.ready` runs before the first `fillText`. Canvas has no equivalent of
  `font-display` and cannot reflow once a face arrives late, so without it the card silently
  renders in a system fallback.

**Share score** opens the operating system's own share dialog, taking three routes in order of
preference: the image itself where the browser can hand files to other apps, a link where it
supports sharing but not files, and a plain download where there is no Web Share API at all.
Which route applies is decided when the screen mounts, never at click time — `navigator.share`
requires transient activation, so awaiting anything first makes the browser refuse the call.

There is no leaderboard and no backend. Your best score lives in `localStorage`, and the image is
generated on your device and never uploaded.

## From the Creator

The desktop's notepad icon opens Privacy and Terms of Service in a window that can be minimised
to the taskbar or closed. Each document has its own address — `#privacy` and `#terms` — so they
can be linked directly. Content lives in [`src/legal.js`](src/legal.js) and describes what this
build actually does; if the data handling changes, that file has to change with it.

## Credits

Typefaces via [Google Fonts](https://fonts.google.com). Interface set in DotGothic16,
Press Start 2P, and Zen Kaku Gothic New.
