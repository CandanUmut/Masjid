// Display mode: a full-screen board for masjid TVs and screens. Open with #/tv (active place)
// or #/tv/<seed> (a specific masjid — perfect as the start page of a kiosk browser).
import { statusAt, scheduleFor } from "../engine.js";
import { todayYmd, formatDate, formatHijri, formatCountdown, partsInTz, timeParts } from "../time.js";
import { t } from "../i18n.js";
import { h, icon } from "../ui.js";
import { phaseOf } from "./today.js";

export function TvView(ctx) {
  const { place, calc } = ctx;
  const clock = h("div", { class: "tv-clock" });
  const secs = h("span", { class: "tv-secs" });
  const date = h("div", { class: "tv-date" });
  const nextBox = h("div", { class: "tv-next" });
  const grid = h("div", { class: "tv-grid" });
  const note = place.note ? h("div", { class: "tv-note" }, icon("info"), place.note) : null;
  const root = h(
    "div",
    { class: "view tv" },
    h(
      "header",
      { class: "tv-head" },
      h("div", { class: "tv-title" }, h("h1", {}, place.name), place.sub ? h("p", {}, place.sub) : null),
      h("div", { class: "tv-time" }, h("div", { class: "tv-clock-row" }, clock), date)
    ),
    grid,
    nextBox,
    note,
    h(
      "div",
      { class: "tv-controls" },
      h("button", { class: "icon-btn", type: "button", "aria-label": t("close"), onclick: () => { document.fullscreenElement && document.exitFullscreen?.(); ctx.go("today"); } }, icon("close")),
      document.fullscreenEnabled
        ? h("button", { class: "icon-btn", type: "button", "aria-label": "Fullscreen", onclick: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()) }, icon("tv"))
        : null
    )
  );

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
    const key = `${ymd.d}|${s.current?.key}|${s.next?.key}|${Boolean(s.pendingIqama)}`;
    root.dataset.phase = phaseOf(s.current?.key);
    if (key !== lastKey) {
      lastKey = key;
      date.textContent = `${formatDate(ymd, ctx.locale, { weekday: "long", day: "numeric", month: "long" })} · ${formatHijri(ymd, ctx.locale, ctx.settings.hijriOffset)}`;
      const sched = scheduleFor(place, calc, ymd);
      grid.replaceChildren(
        ...sched.rows.map((r) => {
          const isCur = s.current && s.current.day === 0 && s.current.key === r.key && r.isPrayer;
          const isNext = s.next && s.next.day === 0 && s.next.key === r.key;
          return h(
            "div",
            { class: `tv-cell ${r.isPrayer ? "" : "is-sun"} ${isCur ? "is-current" : ""} ${isNext ? "is-next" : ""}` },
            h("div", { class: "tv-p" }, t(r.key)),
            h("div", { class: "tv-label" }, r.isPrayer ? t("adhan") : "\u00a0"),
            h("div", { class: "tv-a" }, tvTime(r.adhan)),
            r.isPrayer && r.iqama ? [h("div", { class: "tv-label" }, t("iqama")), h("div", { class: "tv-i" }, tvTime(r.iqama.at))] : null,
            r.jumuah?.length > 1 ? h("div", { class: "tv-j" }, r.jumuah.slice(1).map((d) => ctx.fmt(d)).join(" · ")) : null
          );
        })
      );
    }
    if (s.pendingIqama) {
      nextBox.replaceChildren(h("span", { class: "tv-next-label" }, `${t(s.current.key)} · ${t("iqama")}`), h("span", { class: "tv-next-count" }, formatCountdown(s.pendingIqama - now)));
      root.classList.add("is-iqama");
    } else if (s.next) {
      root.classList.remove("is-iqama");
      nextBox.replaceChildren(h("span", { class: "tv-next-label" }, `${t("next")} · ${t(s.next.key)}`), h("span", { class: "tv-next-count" }, formatCountdown(s.next.adhan - now)));
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
      document.removeEventListener("visibilitychange", onVis);
    },
  };
}
