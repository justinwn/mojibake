// Content for the "From the Creator" notepad.
//
// Written to describe what this build actually does. If the app's data
// handling changes -- a backend, an analytics script, a stored field -- this
// file has to change with it, or it becomes untrue.

const REPO = "github.com/justinwn/mojibake";

export const DOCS = {
  privacy: {
    slug: "privacy",
    tab: "Privacy",
    file: "privacy.txt",
    title: "PRIVACY",
    updated: "13 September 2026",
    blocks: [
      { p: "Mojibake is a browser game with no server of its own. There are no accounts, no advertising, no analytics, and no tracking cookies. Nothing you do here is sent to us, because there is no us to send it to." },

      { h: "What stays on your device" },
      { p: "Your browser's local storage holds two small things: whether you muted the sound, and your best score. Both are readable only by this site, never leave your device, and disappear if you clear site data." },

      { h: "Your score image" },
      { p: "The image you share is drawn in your own browser and is never uploaded anywhere. When you tap Share, your device hands the file straight to whichever app you pick. When you save it, it goes to your downloads. Either way it does not pass through us." },

      { h: "What Google sees" },
      { p: "Typefaces are loaded from Google Fonts as you play. Those requests go to fonts.googleapis.com and fonts.gstatic.com, so Google receives your IP address and the usual request information. Google's own privacy policy covers what it does with that: policies.google.com/privacy" },

      { h: "Where the game is hosted" },
      { p: "The site is served by GitHub Pages, so GitHub receives the same sort of standard request information any web server would. See GitHub's privacy statement for what it keeps." },

      { h: "What is never collected" },
      { p: "No name, no email, no location, no device fingerprinting, and no record of how you played. Nothing is sold, and nothing is shared." },

      { h: "Questions" },
      { p: REPO + "/issues" },
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

      { h: "Your score" },
      { p: "Scores are kept in your own browser and are yours to share or ignore. There is no global ranking, so nothing you do here affects anyone else's game." },

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
