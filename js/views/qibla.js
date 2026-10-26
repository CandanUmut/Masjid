import { qiblaBearing, distanceToKaabaKm } from "../engine.js";
import { t } from "../i18n.js";
import { h, icon } from "../ui.js";
import { skyAt } from "./today.js";
import { sunAltitude, sunAzimuth } from "../astro.js";

// "Qibla is 37° to the left of the sun" — relative to someone facing the sun.
function sunHint(qibla, sunAz, nf) {
  const diff = ((qibla - sunAz + 540) % 360) - 180;
  const d = Math.round(Math.abs(diff));
  if (d < 5) return t("qiblaAtSun");
  if (d > 175) return t("qiblaBehindSun");
  return t(diff > 0 ? "qiblaRightOfSun" : "qiblaLeftOfSun", { d: nf.format(d) });
}

export function QiblaView(ctx) {
  const { place } = ctx;
  const bearing = qiblaBearing(place.lat, place.lng);
  const km = Math.round(distanceToKaabaKm(place.lat, place.lng));
  const nf = new Intl.NumberFormat(ctx.locale);

  const ticks = [];
  for (let i = 0; i < 72; i++) {
    const major = i % 18 === 0;
    ticks.push(`<line x1="100" y1="${major ? 8 : 11}" x2="100" y2="${major ? 18 : 15}" transform="rotate(${i * 5} 100 100)" class="${major ? "tick-major" : "tick"}"/>`);
  }
  // Cardinal letters stay upright (no rotated "E"/"W").
  const card = [["N", 100, 34], ["E", 166, 100], ["S", 100, 166], ["W", 34, 100]]
    .map(([c, x, y]) => `<text x="${x}" y="${y}" class="${c === "N" ? "q-dir-n" : "q-dir"}" text-anchor="middle" dominant-baseline="central">${t(`dir${c}`)}</text>`)
    .join("");
  // Where the sun is right now: with it on the dial you can find the Qibla without any compass.
  const now = new Date();
  const sunAlt = sunAltitude(now, place.lat, place.lng);
  const sunAz = sunAzimuth(now, place.lat, place.lng);
  const sunUp = sunAlt > 1;
  const sunMark = sunUp
    ? `<g transform="rotate(${sunAz.toFixed(1)} 100 100)"><circle cx="100" cy="24" r="7.5" class="q-sun"/><circle cx="100" cy="24" r="12" class="q-sun-glow"/></g>`
    : "";
  const dial = h("div", {
    class: "q-dial",
    html: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="96" class="q-ring"/>
      ${ticks.join("")}${card}${sunMark}
      <g transform="rotate(${bearing} 100 100)" class="q-needle">
        <line x1="100" y1="100" x2="100" y2="46" class="q-needle-line"/>
        <path d="M100 40 L105.5 50 L94.5 50 Z" class="q-needle-head"/>
        <circle cx="100" cy="100" r="5" class="q-hub"/>
        <g transform="translate(100 30)"><rect x="-9" y="-12" width="18" height="18" rx="3" class="q-kaaba"/><rect x="-9" y="-7" width="18" height="3" class="q-kaaba-band"/></g>
      </g>
    </svg>`,
  });
  const facing = h("div", { class: "q-status", "aria-live": "polite" });
  const status = h("p", { class: "list-foot q-hint" });
  const hasSensor = matchMedia("(pointer: coarse)").matches && ("ondeviceorientationabsolute" in window || "ondeviceorientation" in window);
  const startBtn = hasSensor ? h("button", { class: "btn btn-primary", type: "button", onclick: start }, icon("compass"), t("compassStart")) : null;

  const root = h(
    "div",
    { class: "view view-qibla" },
    h("h1", { class: "large-title" }, t("qiblaTitle")),
    h(
      "div",
      { class: "q-card", style: (() => { const s = skyAt(place, new Date()); return { "--sky-top": s.top, "--sky-horizon": s.horizon }; })() },
      h("div", { class: "q-top-mark", "aria-hidden": "true" }),
      dial,
      facing,
      h("div", { class: "q-deg" }, t("qiblaFromNorth", { d: nf.format(Math.round(bearing)) })),
      h("div", { class: "q-sub" }, `${place.name} · ${t("qiblaDistance", { k: nf.format(km) })}`),
      sunUp ? h("div", { class: "q-sunhint" }, icon("sun"), sunHint(bearing, sunAz, nf)) : null,
      startBtn ? h("div", { class: "q-actions" }, startBtn) : null
    ),
    status
  );
  status.textContent = hasSensor ? t("compassHint") : t(sunUp ? "noCompassSun" : "noCompass");

  let heading = null;
  let listening = false;
  let lastBuzz = false;

  function onOrient(e) {
    let hd = null;
    if (typeof e.webkitCompassHeading === "number") hd = e.webkitCompassHeading; // iOS
    else if (e.absolute && typeof e.alpha === "number") hd = 360 - e.alpha; // Android (absolute)
    if (hd == null) return;
    const so = (screen.orientation?.angle ?? window.orientation ?? 0) || 0;
    heading = (hd + so + 360) % 360;
    dial.style.transform = `rotate(${-heading}deg)`;
    const diff = Math.abs((((bearing - heading) % 360) + 540) % 360 - 180);
    const ok = diff < 5;
    root.classList.toggle("is-facing", ok);
    facing.textContent = ok ? t("facingQibla") : "";
    if (ok && !lastBuzz) navigator.vibrate?.(30);
    lastBuzz = ok;
  }

  async function start() {
    try {
      if (typeof DeviceOrientationEvent?.requestPermission === "function") {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== "granted") throw new Error("denied");
      }
      if (!("ondeviceorientationabsolute" in window) && !("ondeviceorientation" in window)) throw new Error("unsupported");
      const ev = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
      window.addEventListener(ev, onOrient);
      listening = ev;
      if (startBtn) startBtn.hidden = true;
      setTimeout(() => {
        if (heading == null) status.textContent = t("compassUnsupported");
      }, 2500);
    } catch {
      status.textContent = t("compassUnsupported");
    }
  }

  return {
    el: root,
    destroy() {
      if (listening) window.removeEventListener(listening, onOrient);
    },
  };
}
