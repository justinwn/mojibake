// Content for the "From the Creator" notepad.
//
// Written to describe what this build actually does. If the app's data
// handling changes -- a new backend, an analytics script, a stored field --
// this file has to change with it, or it becomes untrue.

const REPO = "github.com/justinwn/mojibake";

export const DOCS = {
  privacy: {
    slug: "privacy",
    tab: "Privacy",
    file: "privacy.txt",
    title: "PRIVACY",
    updated: "13 September 2026",
    blocks: [
      { p: "Mojibake is a browser game. There are no accounts, no advertising, no analytics, and no tracking cookies." },

      { h: "What stays on your device" },
      { p: "Your browser's local storage holds two things: whether you muted the sound, and your local high scores. Both are readable only by this site, never leave your device, and disappear if you clear site data." },

      { h: "What Google sees" },
      { p: "Typefaces are loaded from Google Fonts as you play. Those requests go to fonts.googleapis.com and fonts.gstatic.com, so Google receives your IP address and the usual request information. Google's own privacy policy covers what it does with that: policies.google.com/privacy" },

      { h: "If you submit a score" },
      { p: "Submitting is optional, and only offered when you reach the top 100. If you do, three things are stored: the handle you type, the country you pick from the list, and a record of the run itself — its random seed, plus which option you chose each round and how long you took." },
      { p: "That run record is how scores are kept honest. It lets any visitor replay your game and confirm the score is real. It describes the game, not you." },
      { p: "Your handle is public. Use a nickname, not your full name, and do not put an email address or anything private in it." },

      { h: "Rate limiting" },
      { p: "So the leaderboard cannot be flooded, a one-way hash of your IP address is kept for a short period to limit how often scores can be submitted. It is not stored alongside your score, and it cannot be turned back into your address." },

      { h: "What is never collected" },
      { p: "No location beyond the country you choose yourself. No device fingerprinting. No email address. Nothing is sold, and nothing is shared with anyone." },

      { h: "Removing your entry" },
      { p: "Open an issue at " + REPO + "/issues and it will be deleted." },
    ],
  },

  terms: {
    slug: "terms",
    tab: "Terms of Service",
    file: "terms.txt",
    title: "TERMS OF SERVICE",
    updated: "13 September 2026",
    blocks: [
      { h: "The game" },
      { p: "Mojibake is free to play and provided as is, with no warranty of any kind. It may change, break, or disappear without notice." },

      { h: "The leaderboard" },
      { p: "Submitting a score is optional. Keep handles civil: anything hateful, harassing, impersonating another person, or containing someone's personal information will be removed." },
      { p: "Scores are verified by replaying the recorded run. Entries that cannot be reproduced are hidden automatically, and deliberately forged entries will be deleted." },

      { h: "Typeface names" },
      { p: "The typeface names in this game are used only to identify the fonts being shown. They remain the trademarks of their respective owners, who are not affiliated with this game and do not endorse it. The fonts themselves are served by Google Fonts under their own open source licences." },

      { h: "The code" },
      { p: "The source code is published at " + REPO + "." },

      { h: "Liability" },
      { p: "To the fullest extent the law allows, the creator is not liable for any loss or damage arising from use of this game." },

      { h: "Contact" },
      { p: REPO + "/issues" },
    ],
  },
};

export const DEFAULT_DOC = "privacy";
