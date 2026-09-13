# Regenerating og.png

`og.png` is the link-preview image (1200x630). It needs real type, so unlike
`tools/build_icons.mjs` it cannot be produced in Node — the fonts have to be
rendered by a browser.

To rebuild it: serve the site (`python3 tools/devserver.py 4179`), open it, and
paste `tools/og-source.js` into the console. It copies a base64 PNG to
`window.__og`; save it with:

```js
const a = document.createElement('a');
a.href = URL.createObjectURL(new Blob(
  [Uint8Array.from(atob(window.__og), c => c.charCodeAt(0))],
  { type: 'image/png' }
));
a.download = 'og.png';
a.click();
```

Two details that matter:

- `await document.fonts.ready` before the first `fillText`, or the card renders
  in a system fallback. Canvas cannot reflow once a face arrives late.
- The background gradient runs **vertically only**, so every row is one flat
  colour and PNG's row filtering compresses it to ~120 KB. The same gradient on
  a diagonal produced 592 KB.
