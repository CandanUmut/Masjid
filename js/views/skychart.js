// The sun's real path across today's sky, with prayer markers and a live sun.
// Shared by the Today hero and the masjid display board.
import { sunAltitude, sunPath } from "../astro.js";
import { addDays, ymdKey, zonedToInstant } from "../time.js";
import { t } from "../i18n.js";
import { h } from "../ui.js";

let uid = 0;

export function SkyChart(place) {
  const el = h("div", { class: "sky-chart", "aria-hidden": "true" });
  const id = `sky${++uid}`;
  let key = "";
  let xOf = null;
  let yOf = null;
  let markers = [];
  let sun = null;

  function draw(ymd, sched) {
    const k = `${ymdKey(ymd)}|${place.lat}|${place.lng}`;
    if (k === key) return;
    key = k;
    const start = zonedToInstant(ymd, 0, 0, place.tz).getTime();
    const end = zonedToInstant(addDays(ymd, 1), 0, 0, place.tz).getTime();
    const pts = sunPath(place.lat, place.lng, start, end, 144);
    const peak = pts.reduce((a, b) => (b.alt > a.alt ? b : a));
    // A fixed scale keeps the drawing honest: a low winter sun really looks low.
    const top = Math.max(70, peak.alt);
    const bottom = Math.min(-50, ...pts.map((p) => p.alt));
    const hy = 62; // horizon, % from top
    yOf = (alt) => (alt >= 0 ? hy - (alt / top) * (hy - 6) : hy + (alt / bottom) * (97 - hy));
    xOf = (ms) => ((ms - start) / (end - start)) * 100;
    const d = pts.map((p, i) => `${i ? "L" : "M"}${xOf(p.ms).toFixed(2)} ${yOf(p.alt).toFixed(2)}`).join(" ");
    el.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <clipPath id="${id}a"><rect x="0" y="0" width="100" height="${hy}"/></clipPath>
        <clipPath id="${id}b"><rect x="0" y="${hy}" width="100" height="${100 - hy}"/></clipPath>
        <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity=".05"/></linearGradient>
      </defs>
      <rect x="0" y="${hy}" width="100" height="${100 - hy}" fill="url(#${id}g)"/>
      <line x1="0" y1="${hy}" x2="100" y2="${hy}" class="sky-horizon"/>
      <path d="${d}" class="sky-path sky-path-day" clip-path="url(#${id}a)"/>
      <path d="${d}" class="sky-path sky-path-night" clip-path="url(#${id}b)"/>
    </svg>`;
    // The day's highest sun, labelled with its real altitude.
    if (peak.alt > 0) {
      el.append(h("span", { class: "sky-peak", style: { left: `${xOf(peak.ms)}%`, top: `${yOf(peak.alt)}%` } }, `${Math.round(peak.alt)}°`));
    }
    markers = [];
    for (const r of sched.rows) {
      if (!r.adhan) continue;
      const alt = sunAltitude(r.adhan, place.lat, place.lng);
      const m = h(
        "span",
        { class: `sky-mark ${r.isPrayer ? "" : "is-minor"} ${alt < 0 ? "is-low" : ""}`, style: { left: `${xOf(r.adhan.getTime())}%`, top: `${yOf(alt)}%` } },
        h("span", { class: "sky-mark-label" }, t(r.key))
      );
      m.dataset.key = r.key;
      m.dataset.ms = String(r.adhan.getTime());
      el.append(m);
      markers.push(m);
    }
    sun = h("span", { class: "sky-sun" });
    el.append(sun);
  }

  function update(now, status) {
    draw(status.ymd, status.today);
    const alt = sunAltitude(now, place.lat, place.lng);
    // Kept inside the card: late at night the sun's position runs off the chart's edge.
    sun.style.left = `clamp(12px, ${xOf(now.getTime())}%, calc(100% - 12px))`;
    sun.style.top = `clamp(10px, ${yOf(alt)}%, calc(100% - 10px))`;
    sun.classList.toggle("is-below", alt < 0);
    const nowMs = now.getTime();
    for (const m of markers) {
      const isNext = status.next?.day === 0 && m.dataset.key === status.next.key;
      m.classList.toggle("is-next", isNext);
      m.classList.toggle("is-past", Number(m.dataset.ms) <= nowMs);
      // Hide the label while the sun sits right on top of it.
      m.classList.toggle("is-crowded", isNext && Math.abs(xOf(Number(m.dataset.ms)) - xOf(nowMs)) < 4);
    }
    return alt;
  }

  return { el, update };
}
