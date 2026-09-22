// Renders the mascot icon (store/templates/icon.html) to icons/icon{16,48,128}.png
// plus a 512px master in store/assets/.
//
// The art is vector, so each size is rendered at its own dimensions rather than
// resampled from one big PNG — that is what keeps the 16px eyes from turning to
// porridge. Sizes at or below 48 use the head-only `compact` layout; the coil
// and the apple are noise down there.
//
// Usage:
//   python3 tools/devserver.py "$PWD"
//   open http://localhost:8777/store/templates/icon.html and paste this file
//   into the DevTools console (any page on the origin works).
(async () => {
  const targets = [
    { size: 512, compact: false, path: 'store/assets/icon512.png' },
    { size: 128, compact: false, path: 'icons/icon128.png' },
    { size: 48,  compact: true,  path: 'icons/icon48.png'  },
    { size: 16,  compact: true,  path: 'icons/icon16.png'  },
  ];

  const render = (size, compact) => new Promise((resolve, reject) => {
    // Render in an iframe rather than inlining the SVG: the template's own
    // script does the compact surgery and the sizing, so there is one source
    // of truth for what the art looks like.
    const f = document.createElement('iframe');
    f.width = size; f.height = size;
    f.style.cssText = 'position:fixed;left:-9999px;top:0;border:0';
    f.src = `/store/templates/icon.html?size=${size}${compact ? '&compact' : ''}`;
    f.onload = async () => {
      try {
        const svg = f.contentDocument.getElementById('icon');
        const blob = new Blob([new XMLSerializer().serializeToString(svg)],
                              { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = c.height = size;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, size, size);
          URL.revokeObjectURL(url);
          f.remove();
          resolve(c.toDataURL('image/png').split(',')[1]);
        };
        img.onerror = e => { f.remove(); reject(e); };
        img.src = url;
      } catch (e) { f.remove(); reject(e); }
    };
    document.body.appendChild(f);
  });

  const report = [];
  for (const t of targets) {
    const b64 = await render(t.size, t.compact);
    const res = await fetch(`/_save/${t.path}`, { method: 'POST', body: b64 });
    report.push(`${t.path.padEnd(26)} ${t.size}px${t.compact ? ' compact' : '       '}  ${await res.text()}`);
  }
  console.log(report.join('\n'));
  return report.join(' | ');
})();
