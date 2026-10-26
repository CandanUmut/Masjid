// Renders the Ufuq app icon (SVG) to every PNG size the app needs.
// Usage (dev only, needs Playwright): node tools/make-icons.cjs assets/icons
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2];

// k = content scale (maskable icons keep everything inside the 80% safe zone); simple = favicon detail level.
function svg({ k = 1, simple = false, rounded = false } = {}) {
  const c = 256;
  const hy = 318; // horizon
  const T = (x, y) => [c + (x - c) * k, hy + (y - hy) * k];
  const [ax, ay] = T(70, hy), [px, py] = T(256, 92), [bx, by] = T(442, hy);
  const sunR = (simple ? 128 : 74) * k;
  const dots = [0.22, 0.5, 0.71].map((u) => {
    const x = (1 - u) ** 2 * ax + 2 * (1 - u) * u * px + u * u * bx;
    const y = (1 - u) ** 2 * ay + 2 * (1 - u) * u * (2 * py - (ay + by) / 2) + u * u * by;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(u === 0.5 ? 13 : 10) * k}" fill="#fff"/>`;
  }).join('');
  const qy = 2 * py - (ay + by) / 2; // control point so the curve peaks at py
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0e1748"/>
      <stop offset="0.30" stop-color="#232a72"/>
      <stop offset="0.46" stop-color="#5b4596"/>
      <stop offset="0.56" stop-color="#c0668a"/>
      <stop offset="${(hy / 512).toFixed(3)}" stop-color="#ffa860"/>
      <stop offset="${(hy / 512 + 0.001).toFixed(3)}" stop-color="#2a1d52"/>
      <stop offset="1" stop-color="#0f0b2a"/>
    </linearGradient>
    <radialGradient id="sun" cx="0.5" cy="0.62" r="0.6">
      <stop offset="0" stop-color="#fff7d6"/>
      <stop offset="0.55" stop-color="#ffd27a"/>
      <stop offset="1" stop-color="#ffab45"/>
    </radialGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffcf7a" stop-opacity="0.75"/>
      <stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="reflect" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffb862" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#ffb862" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="above"><rect x="0" y="0" width="512" height="${hy}"/></clipPath>
    ${rounded ? '<clipPath id="r"><rect width="512" height="512" rx="114"/></clipPath>' : ''}
  </defs>
  <g ${rounded ? 'clip-path="url(#r)"' : ''}>
    <rect width="512" height="512" fill="url(#sky)"/>
    <circle cx="${c}" cy="${hy}" r="${(simple ? 150 : 200) * k}" fill="url(#glow)" clip-path="url(#above)"/>
    ${simple ? '' : `<path d="M${ax} ${ay} Q${px} ${qy.toFixed(1)} ${bx} ${by}" fill="none" stroke="#fff" stroke-opacity="0.82" stroke-width="${9 * k}" stroke-linecap="round" stroke-dasharray="0.1 ${26 * k}"/>${dots}`}
    <circle cx="${c}" cy="${hy}" r="${sunR}" fill="url(#sun)" clip-path="url(#above)"/>
    <rect x="${c - 120 * k}" y="${hy + 14 * k}" width="${240 * k}" height="${10 * k}" rx="${5 * k}" fill="url(#reflect)"/>
    <rect x="${c - 70 * k}" y="${hy + 36 * k}" width="${140 * k}" height="${8 * k}" rx="${4 * k}" fill="url(#reflect)" opacity="0.7"/>
    <rect x="0" y="${hy - 2}" width="512" height="4" fill="#fff" opacity="${simple ? 0.8 : 0.5}"/>
  </g>
</svg>`;
}

(async () => {
  fs.writeFileSync(`${OUT}/icon.svg`, svg({ rounded: true }));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const render = async (file, size, opts) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg(opts).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
    await page.screenshot({ path: `${OUT}/${file}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  };
  await render('icon-512.png', 512, {});
  await render('icon-192.png', 192, {});
  await render('icon-512-maskable.png', 512, { k: 0.78 });
  await render('icon-192-maskable.png', 192, { k: 0.78 });
  await render('apple-touch-icon.png', 180, {});
  await render('favicon-32.png', 32, { simple: true, rounded: true });
  await render('favicon-16.png', 16, { simple: true, rounded: true });
  await browser.close();
})();
