import { qiblaBearing, distanceToKaabaKm } from "../engine.js";
import { t } from "../i18n.js";
import { h, icon } from "../ui.js";
import { skyAt } from "./today.js";

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
  const card = ["N", "E", "S", "W"]
    .map((c, i) => `<text x="100" y="34" transform="rotate(${i * 90} 100 100)" class="${c === "N" ? "q-dir-n" : "q-dir"}" text-anchor="middle">${c}</text>`)
    .join("");
  const dial = h("div", {
    class: "q-dial",
    html: `<svg viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="96" class="q-ring"/>
      ${ticks.join("")}${card}
      <g transform="rotate(${bearing} 100 100)" class="q-needle">
        <path d="M100 40 L108 100 L100 94 L92 100 Z" class="q-needle-head"/>
        <circle cx="100" cy="100" r="5" class="q-hub"/>
        <g transform="translate(100 30)"><rect x="-9" y="-12" width="18" height="18" rx="3" class="q-kaaba"/><rect x="-9" y="-7" width="18" height="3" class="q-kaaba-band"/></g>
      </g>
    </svg>`,
  });
  const facing = h("div", { class: "q-status", "aria-live": "polite" });
  const status = h("p", { class: "list-foot q-hint" });
  const startBtn = h("button", { class: "btn btn-primary", type: "button", onclick: start }, icon("compass"), t("compassStart"));

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
      h("div", { class: "q-actions" }, startBtn)
    ),
    status
  );
  status.textContent = t("compassHint");

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
      startBtn.hidden = true;
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
