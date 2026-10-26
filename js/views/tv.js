// Display mode: a full-screen board for masjid TVs and screens. Open with #/tv (active place)
// or #/tv/<seed> (a specific masjid — perfect as the start page of a kiosk browser).
// Designed to be read from the back of a prayer hall: everything scales with the screen, nothing scrolls.
import { statusAt, scheduleFor } from "../engine.js";
import { todayYmd, formatDate, formatHijri, formatCountdown, partsInTz, timeParts } from "../time.js";
import { t } from "../i18n.js";
import { h, icon } from "../ui.js";
import { phaseOf, skyAt } from "./today.js";
import { SkyChart } from "./skychart.js";
import { placeToSeed, seedUrl } from "../seed.js";
import qrcode from "../vendor/qrcode.js";

const IN_PRAYER_MIN = 10; // how long the "prayer in progress" screen stays after iqama
const IN_JUMUAH_MIN = 40; // khutbah + prayer

export function TvView(ctx) {
  const { place, calc } = ctx;
  const clock = h("div", { class: "tv-clock" });
  const secs = h("span", { class: "tv-secs" });
  const date = h("div", { class: "tv-date" });
  const nextBox = h("div", { class: "tv-next" });
  const grid = h("div", { class: "tv-grid" });
  const chart = SkyChart(place);
  const qrBox = h("div", { class: "tv-qr", hidden: true });
  const note = place.note ? h("div", { class: "tv-note" }, icon("info"), h("span", {}, place.note)) : null;
  const overlay = h("div", { class: "tv-overlay", hidden: true });
  const controls = h(
    "div",
    { class: "tv-controls" },
    h("button", { class: "icon-btn", type: "button", "aria-label": t("close"), onclick: () => { document.fullscreenElement && document.exitFullscreen?.(); ctx.go("today"); } }, icon("close")),
    document.fullscreenEnabled
      ? h("button", { class: "icon-btn", type: "button", "aria-label": t("fullscreen"), title: t("fullscreen"), onclick: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()) }, icon("tv"))
      : null
  );
  const root = h(
    "div",
    { class: "view tv" },
    h(
      "header",
      { class: "tv-head" },
      h("div", { class: "tv-title" }, h("h1", {}, place.name), place.sub ? h("p", {}, place.sub) : null),
      h("div", { class: "tv-time" }, h("div", { class: "tv-clock-row" }, clock), date)
    ),
    h("div", { class: "tv-sky" }, chart.el),
    grid,
    h("footer", { class: "tv-foot" }, h("div", { class: "tv-foot-main" }, nextBox, note), qrBox),
    overlay,
    controls
  );

  // Controls appear on mouse/touch and fade after 3 s, so they never cover the board.
  let hideTimer = null;
  const wakeControls = () => {
    root.classList.add("show-controls");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => root.classList.remove("show-controls"), 3000);
  };
  root.addEventListener("pointermove", wakeControls);
  root.addEventListener("pointerdown", wakeControls);
  root.addEventListener("focusin", wakeControls);

  // QR so people in the hall can put the masjid on their own phone.
  if (place.kind === "masjid") {
    placeToSeed(place).then((seed) => {
      const qr = qrcode(0, "M");
      qr.addData(seedUrl(seed));
      qr.make();
      qrBox.replaceChildren(h("div", { class: "tv-qr-code", html: qr.createSvgTag({ cellSize: 3, margin: 4, scalable: true }) }), h("span", {}, t("scanToOpen")));
      qrBox.hidden = false;
    });
  }

  const tvTime = (d) => {
    const { main, period } = timeParts(d, place.tz, { hour12: ctx.hour12, locale: ctx.locale });
    return period ? [main, h("small", { class: "tv-period" }, period)] : main;
  };

  let lastKey = "";
  function render() {
    const now = new Date();
    const ymd = todayYmd(place.tz, now);
    const p = partsInTz(now, place.tz);
    const tp = timeParts(now, place.tz, { hour12: ctx.hour12, locale: ctx.locale });
    secs.textContent = `:${String(p.ss).padStart(2, "0")}`;
    clock.replaceChildren(tp.main, secs, tp.period ? h("small", {}, tp.period) : null);
    const s = statusAt(place, calc, ymd, now);
    chart.update(now, { ...s, ymd });
    const key = `${ymd.d}|${s.current?.key}|${s.next?.key}|${Boolean(s.pendingIqama)}`;
    root.dataset.phase = phaseOf(s.current?.key);
    if (p.ss === 0 || !root.style.getPropertyValue("--sky-top")) {
      const sky = skyAt(place, now);
      root.style.setProperty("--sky-top", sky.top);
      root.style.setProperty("--sky-horizon", sky.horizon);
    }
    if (key !== lastKey) {
      lastKey = key;
      date.textContent = `${formatDate(ymd, ctx.locale, { weekday: "long", day: "numeric", month: "long" })} · ${formatHijri(ymd, ctx.locale, ctx.settings.hijriOffset)}`;
      const sched = scheduleFor(place, calc, ymd);
      grid.replaceChildren(
        ...sched.rows.map((r) => {
          const isCur = s.current && s.current.day === 0 && s.current.key === r.key && r.isPrayer;
          const isNext = s.next && s.next.day === 0 && s.next.key === r.key;
          const extraJ = r.jumuah?.length > 1 ? r.jumuah.slice(1) : [];
          return h(
            "div",
            { class: `tv-cell ${r.isPrayer ? "" : "is-sun"} ${isCur ? "is-current" : ""} ${isNext ? "is-next" : ""}` },
            h("div", { class: "tv-p" }, t(r.key)),
            h("div", { class: "tv-label" }, r.isPrayer ? t("adhan") : " "),
            h("div", { class: "tv-a" }, tvTime(r.adhan)),
            r.isPrayer && r.iqama ? [h("div", { class: "tv-label" }, r.key === "jumuah" ? t("khutbah") : t("iqama")), h("div", { class: "tv-i" }, tvTime(r.iqama.at))] : null,
            extraJ.length ? h("div", { class: "tv-j" }, `${t("secondJumuah")} `, extraJ.map((d) => tvTime(d))) : null
          );
        })
      );
    }

    // Countdown: always says what it counts to ("Iqama in", "Asr in"), never looks like a clock time.
    if (s.pendingIqama) {
      nextBox.replaceChildren(h("span", { class: "tv-next-label" }, s.current.key === "jumuah" ? t("khutbahIn") : t("iqamaFor", { p: t(s.current.key) })), h("span", { class: "tv-next-count" }, formatCountdown(s.pendingIqama - now)));
      root.classList.add("is-iqama");
    } else if (s.next) {
      root.classList.remove("is-iqama");
      nextBox.replaceChildren(h("span", { class: "tv-next-label" }, t("prayerIn", { p: t(s.next.key) })), h("span", { class: "tv-next-count" }, formatCountdown(s.next.adhan - now)));
    }

    // "Prayer in progress": from iqama until the congregation is done.
    const cur = s.current;
    const iqAt = cur?.iqama?.at?.getTime();
    const span = (cur?.key === "jumuah" ? IN_JUMUAH_MIN : IN_PRAYER_MIN) * 60000;
    const inPrayer = Boolean(iqAt && now >= iqAt && now - iqAt < span);
    if (inPrayer !== !overlay.hidden) {
      overlay.hidden = !inPrayer;
      if (inPrayer) overlay.replaceChildren(h("div", { class: "tv-overlay-p" }, t(cur.key)), h("div", { class: "tv-overlay-msg" }, t("inPrayer")), h("div", { class: "tv-overlay-sub" }, t("silencePhones")));
    }
  }

  // Keep the screen awake while displayed.
  let lock = null;
  const wake = async () => {
    try {
      lock = await navigator.wakeLock?.request("screen");
    } catch {
      /* not supported */
    }
  };
  wake();
  const onVis = () => document.visibilityState === "visible" && wake();
  document.addEventListener("visibilitychange", onVis);

  render();
  return {
    el: root,
    tick: render,
    destroy() {
      lock?.release?.();
      clearTimeout(hideTimer);
      document.removeEventListener("visibilitychange", onVis);
    },
  };
}
