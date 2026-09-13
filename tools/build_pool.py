#!/usr/bin/env python3
"""Generate fonts.json from the public Google Fonts catalog.

Build-time only. The published page ships fonts.json, never this script.

    python3 tools/build_pool.py

The Google Fonts Developer API (webfonts/v1) is deliberately not used: it needs
an API key, it is blocked by the artifact sandbox CSP, and it carries no signal
about which typefaces resemble each other. The public catalog does.
"""

import json
import os
import sys
import urllib.request

CATALOG = "https://fonts.google.com/metadata/fonts"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "fonts.json")

# Fonts used by the window chrome. A font must never be both chrome and answer.
UI_FONTS = {
    "DotGothic16", "Press Start 2P", "Silkscreen", "Pixelify Sans",
    "Zen Kaku Gothic New",
}

# Popularity bands -> difficulty tier. Lower popularity number == more famous.
TIERS = [(0, 80), (80, 300), (300, 900), (900, 10**9)]

# Metadata knows a font is a "Sans Serif" but not that it is a geometric sans.
# These are hand-curated so the hardest rounds are genuinely cruel. Every name
# is validated against the catalog below; typos fail the build loudly.
TRAP_GROUPS = {
    "neo-grotesque": [
        "Inter", "Roboto", "Work Sans", "Archivo", "Figtree",
        "Manrope", "Public Sans", "Be Vietnam Pro", "Rubik",
    ],
    "geometric-sans": [
        "Poppins", "Montserrat", "Jost", "Outfit", "Questrial",
        "Didact Gothic", "Hanken Grotesk", "Red Hat Display",
    ],
    "humanist-sans": [
        "Open Sans", "Lato", "Source Sans 3", "PT Sans", "Noto Sans",
        "Fira Sans", "Cabin", "Karla", "Mulish",
    ],
    "condensed-display": [
        "Bebas Neue", "Anton", "Oswald", "Archivo Black", "Fjalla One",
        "Teko", "Barlow Condensed", "Saira Condensed",
    ],
    "didone": [
        "Playfair Display", "Abril Fatface", "Prata", "DM Serif Display",
        "Bodoni Moda", "Italiana", "Gilda Display",
    ],
    "transitional-serif": [
        "Lora", "Merriweather", "Crimson Text", "EB Garamond", "Libre Baskerville",
        "Cormorant Garamond", "Spectral", "Source Serif 4", "Gentium Book Plus",
    ],
    "slab-serif": [
        "Roboto Slab", "Zilla Slab", "Arvo", "Bitter", "Josefin Slab",
        "Alfa Slab One", "Crete Round",
    ],
    "typewriter-mono": [
        "Courier Prime", "Space Mono", "JetBrains Mono", "IBM Plex Mono",
        "Roboto Mono", "Source Code Pro", "Inconsolata", "Fira Code",
    ],
    "brush-script": [
        "Dancing Script", "Great Vibes", "Sacramento", "Parisienne",
        "Allura", "Pinyon Script", "Tangerine", "Alex Brush",
    ],
    "casual-hand": [
        "Caveat", "Kalam", "Patrick Hand", "Indie Flower", "Shadows Into Light",
        "Architects Daughter", "Gloria Hallelujah", "Comic Neue",
    ],
    "rounded-sans": [
        "Nunito", "Quicksand", "Comfortaa", "Baloo 2", "Varela Round",
        "M PLUS Rounded 1c", "Fredoka",
    ],
}

# Famous font names used as the decoy word. They are names the player will
# recognise; the joke only lands if the word is a typeface they've heard of.
# Kept separate from the answer pool so a decoy is never also an option.
DECOY_WORDS = [
    "Comic Sans", "Helvetica", "Times New Roman", "Papyrus", "Arial",
    "Wingdings", "Courier", "Impact", "Garamond", "Futura", "Baskerville",
    "Gill Sans", "Franklin Gothic", "Optima", "Univers", "Caslon",
    "Didot", "Bodoni", "Rockwell", "Trajan", "Frutiger", "Avenir",
    "Trebuchet", "Verdana", "Tahoma", "Calibri", "Cambria", "Georgia",
    "Palatino", "Century Gothic", "Copperplate", "Brush Script",
    "Myriad", "Minion", "Akzidenz Grotesk", "Clarendon", "Perpetua",
    "Bookman", "Souvenir", "Eurostile", "Lucida", "Monaco", "Chicago",
    "Zapfino", "Snell Roundhand", "Marker Felt", "Herculanum",
]


def tier_for(popularity):
    for i, (lo, hi) in enumerate(TIERS):
        if lo <= popularity < hi:
            return i
    return len(TIERS) - 1


def main():
    print("fetching %s ..." % CATALOG)
    req = urllib.request.Request(CATALOG, headers={"User-Agent": "mojibake-build/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        catalog = json.load(r)
    families = catalog["familyMetadataList"]
    print("  %d families in catalog" % len(families))

    by_name = {f["family"]: f for f in families}

    # Validate the hand-curated groups before anything else: a typo here
    # silently degrades the hardest rounds, so fail loudly instead.
    missing = sorted(
        {n for names in TRAP_GROUPS.values() for n in names if n not in by_name}
    )
    if missing:
        print("ERROR: trap-group families not in catalog: %s" % ", ".join(missing))
        return 1

    trap_of = {}
    for group, names in TRAP_GROUPS.items():
        for n in names:
            trap_of[n] = group

    pool = []
    for f in families:
        name = f["family"]
        if name in UI_FONTS:
            continue
        if f.get("isNoto"):
            continue
        subsets = f.get("subsets") or []
        if "latin" not in subsets:
            continue
        classifications = f.get("classifications") or []
        if "Symbols" in classifications:
            continue
        # Needs a regular upright weight to render the word cleanly.
        weights = f.get("fonts") or {}
        if "400" not in weights:
            continue

        category = f["category"]
        stroke = f.get("stroke") or ""
        auto_group = "|".join([category, stroke, ",".join(sorted(classifications))])

        entry = {
            "f": name,
            "c": category,
            "s": stroke,
            "p": f["popularity"],
            "t": tier_for(f["popularity"]),
            # Curated group wins over the auto-derived one: it is the whole
            # reason the tier-3 rounds are hard.
            "g": trap_of.get(name, auto_group),
            "trap": 1 if name in trap_of else 0,
        }

        # Present on ~700 families. Where available these let round generation
        # pick distractors of matching weight and width within a group, which
        # is a much closer visual match than category alone.
        metrics = weights["400"]
        if metrics.get("thickness") is not None:
            entry["th"] = metrics["thickness"]
        if metrics.get("width") is not None:
            entry["w"] = metrics["width"]

        pool.append(entry)

    pool.sort(key=lambda e: e["p"])

    # A decoy word must never collide with a family in the pool, or a round
    # could show a word that is also one of its own options.
    names_in_pool = {e["f"] for e in pool}
    decoys = [w for w in DECOY_WORDS if w not in names_in_pool]
    dropped = [w for w in DECOY_WORDS if w in names_in_pool]
    if dropped:
        print("  decoys dropped (collide with pool): %s" % ", ".join(dropped))

    groups = {}
    for e in pool:
        groups.setdefault(e["g"], []).append(e["f"])

    data = {
        "version": 1,
        "source": CATALOG,
        "fonts": pool,
        "decoys": decoys,
        "trapGroups": sorted(TRAP_GROUPS.keys()),
    }
    with open(OUT, "w") as fh:
        json.dump(data, fh, separators=(",", ":"))

    size = os.path.getsize(OUT)
    print("wrote %s (%.1f KB)" % (OUT, size / 1024.0))
    print("  pool: %d families, %d decoy words" % (len(pool), len(decoys)))
    for i in range(len(TIERS)):
        n = sum(1 for e in pool if e["t"] == i)
        print("  tier %d: %d families" % (i, n))
    usable = sum(1 for g in groups.values() if len(g) >= 4)
    print("  groups: %d total, %d with >=4 members (usable for hard rounds)"
          % (len(groups), usable))
    return 0


if __name__ == "__main__":
    sys.exit(main())
