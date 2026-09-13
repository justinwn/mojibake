# Mojibake

**文字化け** — *"character corruption"*, when text renders in the wrong encoding and comes out as garbage.

A typography guessing game. The word on screen is the name of a font — but it is **set in a
different one**. Name the typeface you can actually see, not the one you're reading.

Rounds are unlimited and get harder as you go. Three mistakes ends the run.

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
node tools/test_replay.mjs     # score-replay and anti-tamper tests
node tools/test_sanitize.mjs   # handle sanitising
python3 tools/build_pool.py    # regenerate fonts.json from the Google Fonts catalog
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
src/ui.js           screens, input, animation
src/leaderboard.js  storage + run verification
src/pixel.js        pixel-art sprites, drawn from character grids
src/audio.js        sound clips
src/countries.js    ISO country list (flags derived from the code)
tools/              build + test scripts
```

### Two details worth knowing

**The answer is never leaked over the network.** All four option typefaces are requested each
round, not just the correct one — otherwise the Network tab would hand over the answer. Each
request is glyph-subset to just the word being shown (`&text=`), so four families cost about
800 bytes.

**Scores are replayed, not trusted.** A leaderboard entry stores the run's random seed plus a
log of `{round, choice, ms}` — never a bare score. The entire round sequence is deterministic
from that seed, so any client can re-simulate the run, replay the log, and recompute the score,
rejecting anything that doesn't reconcile or that shows inhuman reaction times.

This raises forgery from "type a number into the console" to "write a bot that genuinely plays
the game well." It is **not** cryptographically cheat-proof, and cannot be: the page runs on the
player's machine. Real resistance needs a server that issues and grades rounds.

### Leaderboard scope

On a static host the shared-storage backend isn't available, so the board is kept in
`localStorage` and is **per-device** — the game says "saved on this device only" rather than
implying a global ranking. `src/leaderboard.js` is written against a small interface
(`top`, `qualifies`, `submit`), so pointing it at a real backend is a contained change.

## Credits

Typefaces via [Google Fonts](https://fonts.google.com). Interface set in DotGothic16,
Press Start 2P, and Zen Kaku Gothic New.
