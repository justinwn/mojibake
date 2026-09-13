// Sound effects.
//
// Correct.mp3 holds three identical chimes separated by silence, so it is
// played as a clip: start at 0, stop at the end of the first chime. Every clip
// stops whatever is already sounding, so chimes never stack or overlap.
// (Measured envelopes: chime 1 ends ~2.1s; Incorrect is a 0.28s hit; Score
// runs to ~2.7s before its tail goes silent.)

const CLIPS = {
  correct: { src: "assets/sounds/Correct.mp3", end: 2.05 },
  incorrect: { src: "assets/sounds/Error.mp3", end: 0.30 },
  score: { src: "assets/sounds/Score.mp3", end: 2.72 },
  start: { src: "assets/sounds/Start-screen.mp3", end: 3.8 },
  gameover: { src: "assets/sounds/Game-over.mp3", end: 1.25 },
};

const MUTE_KEY = "mojibake.muted";

function loadMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function createAudio() {
  const players = new Map();
  let muted = loadMuted();
  let stopTimer = 0;
  let current = null;
  let pending = null;

  for (const [name, clip] of Object.entries(CLIPS)) {
    const a = new Audio(clip.src);
    a.preload = "auto";
    players.set(name, a);
  }

  function stop() {
    clearTimeout(stopTimer);
    stopTimer = 0;
    if (current) {
      // pause() and seeking both throw on iOS in states desktop never hits.
      try {
        current.pause();
        current.currentTime = 0;
      } catch {
        /* Nothing here is worth propagating to a caller mid-interaction. */
      }
      current = null;
    }
  }

  return {
    get muted() {
      return muted;
    },

    toggle() {
      muted = !muted;
      if (muted) stop();
      try {
        localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      } catch {
        /* Storage is a convenience here, not a requirement. */
      }
      return muted;
    },

    play(name) {
      if (muted) return;
      const clip = CLIPS[name];
      const a = players.get(name);
      if (!clip || !a) return;

      stop();
      current = a;
      try {
        a.currentTime = 0;
      } catch {
        /* As above. */
      }
      if (typeof a.play !== "function") return;
      // Browsers refuse audio until the page has seen a user gesture, so the
      // title music on a cold load is blocked. Remember it and start it on the
      // very next interaction instead of dropping it.
      a.play().then(
        () => { pending = null; },
        () => { pending = name; }
      );
      stopTimer = setTimeout(() => {
        try {
          a.pause();
        } catch {
          /* Element may already be torn down. */
        }
        current = null;
      }, clip.end * 1000);
    },

    /** Retry the clip an autoplay policy blocked. Safe to call on any gesture. */
    resume() {
      if (muted || !pending) return;
      const name = pending;
      pending = null;
      this.play(name);
    },

    stop,
  };
}
