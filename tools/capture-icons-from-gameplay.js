// Generates the extension icons from real gameplay pixels.
//
// The icon is a crop of the game's own canvas, so the snake in the toolbar is
// literally the snake the renderer draws — head, scales, rim light and all.
// Redrawing it by hand would drift away from the game every time a skin changes.
//
// Usage: serve the folder with tools/devserver.py, open index.html, then paste
// this file into the DevTools console. It writes icons/icon{16,48,128}.png.
(async () => {
  const H = window.__hiss;
  if (!H) throw new Error('window.__hiss missing — is this the game page?');

  const game = document.getElementById('c');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const press = async k => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    await wait(40);
    // keyup matters: getSteerOutput() re-reads held keys every frame and would
    // otherwise pin the snake to the first direction forever.
    window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
  };

  // A clean arena and a fresh 90-node snake. Feeding it here would pile the
  // spine up at the head and it would bite itself before we can photograph it.
  document.querySelector('[data-obs="none"]').click();
  document.getElementById('playBtn').click();
  await wait(400); await press('ArrowUp');
  await wait(600); await press('ArrowLeft');
  await wait(600); await press('ArrowDown');
  await wait(550);

  const crop = (size, cropCss, behind) => {
    const { head, dpr } = H.state();
    const cx = (head.x - Math.cos(head.ang) * behind) * dpr;
    const cy = (head.y - Math.sin(head.ang) * behind) * dpr;
    const src = cropCss * dpr;

    // Render at 4x and downscale: a 16px rounded corner clipped directly is a
    // staircase, the same corner downscaled from 64px is smooth.
    const SS = 4, big = size * SS;
    const hi = document.createElement('canvas');
    hi.width = hi.height = big;
    const c = hi.getContext('2d');

    const r = big * 0.22;                        // rounded tile, Chrome-ish
    c.beginPath();
    c.moveTo(r, 0); c.arcTo(big, 0, big, big, r); c.arcTo(big, big, 0, big, r);
    c.arcTo(0, big, 0, 0, r); c.arcTo(0, 0, big, 0, r); c.closePath();
    c.fillStyle = '#06130d'; c.fill();
    c.save(); c.clip();
    // the arena is deliberately dim; an icon on a toolbar needs more punch
    c.filter = size <= 48 ? 'saturate(1.6) brightness(1.4) contrast(1.15)'
                          : 'saturate(1.45) brightness(1.22) contrast(1.08)';
    c.drawImage(game, cx - src / 2, cy - src / 2, src, src, 0, 0, big, big);
    c.filter = 'none';
    const vig = c.createRadialGradient(big/2, big/2, big*0.28, big/2, big/2, big*0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, size <= 48 ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.32)');
    c.fillStyle = vig; c.fillRect(0, 0, big, big);
    c.restore();

    const out = document.createElement('canvas');
    out.width = out.height = size;
    const o = out.getContext('2d');
    o.imageSmoothingEnabled = true;
    o.imageSmoothingQuality = 'high';
    o.drawImage(hi, 0, 0, size, size);

    const d = o.getImageData(0, 0, size, size).data;
    let green = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i+1] > 90 && d[i+1] > d[i] + 25) green++;
    return { canvas: out, coverage: green / (size * size) };
  };

  // Smaller icons need the head to fill more of the frame: at 16px the body
  // curve is noise, only the head silhouette and the two eyes survive.
  const specs = [[128, 108, 20], [48, 86, 15], [16, 62, 8]];
  const report = [];

  for (const [size, cropCss, behind] of specs) {
    // widen the crop a little if the snake happens to be off-frame
    let best = null;
    for (const scale of [1, 1.25, 1.6, 2]) {
      const c = crop(size, cropCss * scale, behind * scale);
      if (!best || c.coverage > best.coverage) best = c;
      if (c.coverage > 0.18) break;
    }
    const b64 = best.canvas.toDataURL('image/png').split(',')[1];
    const res = await fetch(`/_save/icons/icon${size}.png`, { method: 'POST', body: b64 });
    report.push(`icon${size}.png  coverage ${(best.coverage * 100).toFixed(1)}%  ${await res.text()}`);
  }

  console.log(report.join('\n'));
  return report.join(' | ');
})();
