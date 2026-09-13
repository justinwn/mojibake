// Paste into the browser console on the live or local site. See build_og.md.
(async () => {
  await document.fonts.ready;
  const MARK = [
    "BBBBBBBBBBBBBBBB", "BBBBBBBBBBBBBBBB", "BBOOBBBBBBBBOOBB",
    "BBOOOBBBBBBOOOBB", "BBOOOOBBBBOOOOBB", "BBOOBOOBBOOBOOBB",
    "BBOOBBOOOOBBOOBB", "BBOOBBBOOBBBOOBB", "BBOOBBBBBBBBOOBB",
    "BBBBPPBBBBBBBBPP", "BBBBPPBBBBBBBBPP", "BBOOBBBBBBBBOOBB",
    "BBOOBBBBBBBBOOBB", "BBOOBBBBBBBBOOBB", "BBBBBBBBBBBBBBBB",
    "BBBBBBBBBBBBBBBB",
  ];
  const COL = { O: "#efae1f", P: "#e668ae" };
  const W = 1200, H = 630;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = false;

  // Vertical only: each row is one flat colour, which PNG compresses to almost
  // nothing. A diagonal gradient made the same image 5x larger.
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#b79ae0");
  g.addColorStop(1, "#efb0d8");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);

  const S = 22, tileX = 110, tileY = (H - 16 * S) / 2;
  x.fillStyle = "#6f2f96";
  x.fillRect(tileX, tileY, 16 * S, 16 * S);
  for (let r = 0; r < 16; r++) {
    let col = 0;
    while (col < 16) {
      const ch = MARK[r][col];
      let n = 1;
      while (col + n < 16 && MARK[r][col + n] === ch) n++;
      if (COL[ch]) {
        x.fillStyle = COL[ch];
        x.fillRect(tileX + col * S, tileY + r * S, n * S, S);
      }
      col += n;
    }
  }

  const tx = tileX + 16 * S + 90;
  x.textAlign = "left";
  x.font = "72px 'Press Start 2P', monospace";
  x.fillStyle = "#3d1a52";
  x.fillText("MOJIBAKE", tx, 280);
  x.font = "33px Tahoma, sans-serif";
  x.fillStyle = "#4a2168";
  x.fillText("The word is the name of a font.", tx, 345);
  x.fillText("It is set in a different one.", tx, 390);
  x.font = "22px 'Press Start 2P', monospace";
  x.fillStyle = "#ffffff";
  x.fillText("mojibake.justinewin.com", tx, 466);

  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const b = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  window.__og = btoa(s);
  console.log("window.__og ready:", b.length, "bytes");
})();
