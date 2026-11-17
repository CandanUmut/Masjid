import { scheduleFor, METHODS } from "../engine.js";
import { todayYmd, daysInMonth, formatDate, formatHijriMonth, hijriParts, sameYmd, timeParts } from "../time.js";
import { t } from "../i18n.js";
import { h, icon } from "../ui.js";
import { skyAt } from "./today.js";
import { mixRgb } from "../astro.js";

const COLS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

export function MonthView(ctx) {
  const { place, calc } = ctx;
  const today = todayYmd(place.tz);
  let ym = { y: today.y, m: today.m };
  let first = true;
  const root = h("div", { class: "view view-month" });

  // Times without AM/PM keep the table compact; context makes them unambiguous.
  const short = (d) => (d ? timeParts(d, place.tz, { hour12: ctx.hour12, locale: ctx.locale }).main : "—");

  function render() {
    const n = daysInMonth(ym.y, ym.m);
    const title = formatDate({ y: ym.y, m: ym.m, d: 1 }, ctx.locale, { month: "long", year: "numeric" });
    const off = ctx.settings.hijriOffset;
    const h1 = formatHijriMonth({ ...ym, d: 1 }, ctx.locale, off);
    const h2 = formatHijriMonth({ ...ym, d: n }, ctx.locale, off);
    // "Rabi II – Jumada I 1448 AH": the year once when both months share it.
    const sameYear = hijriParts({ ...ym, d: 1 }, off)?.y === hijriParts({ ...ym, d: n }, off)?.y;
    // Put both month names where the second one sits in its full form, so each language keeps its own word order.
    const m1 = formatHijriMonth({ ...ym, d: 1 }, ctx.locale, off, { year: false });
    const m2 = formatHijriMonth({ ...ym, d: n }, ctx.locale, off, { year: false });
    const hijriRange = h1 === h2 ? h1 : sameYear && h2.includes(m2) ? h2.replace(m2, `${m1} – ${m2}`) : `${h1} – ${h2}`;
    const hasIqama = Boolean(place.iqama || place.jumuah?.length);
    const rows = [];
    for (let d = 1; d <= n; d++) {
      const ymd = { y: ym.y, m: ym.m, d };
      const s = scheduleFor(place, calc, ymd);
      const isToday = sameYmd(ymd, today);
      const hj = hijriParts(ymd, off);
      // A new Hijri month gets its own divider row instead of widening the day column.
      if (hj?.d === 1 && d > 1) {
        rows.push(h("tr", { class: "m-divider" }, h("td", { colspan: String(COLS.length + 1) }, formatHijriMonth(ymd, ctx.locale, off))));
      }
      rows.push(
        h(
          "tr",
          { class: `${isToday ? "is-today" : ""} ${s.isFriday ? "is-friday" : ""}`, "aria-current": isToday ? "date" : null },
          h(
            "th",
            { scope: "row", class: "m-day" },
            h("span", { class: "m-d" }, String(d)),
            h("span", { class: "m-w" }, formatDate(ymd, ctx.locale, { weekday: "short" }), hj ? h("span", { class: "m-h" }, ` · ${hj.d}`) : null)
          ),
          COLS.map((k) => {
            const r = s.rows.find((x) => x.key === k || (k === "dhuhr" && x.key === "jumuah"));
            const iq = r?.jumuah?.length
              ? r.jumuah.map((j) => short(j)).join(" · ")
              : r?.iqama
                ? short(r.iqama.at)
                : "";
            return h(
              "td",
              { class: k === "sunrise" ? "m-sun" : "" },
              short(r?.adhan),
              hasIqama && iq ? h("span", { class: `m-iq ${r.iqama?.clamped ? "is-clamped" : ""}`, title: r.iqama?.clamped ? t("clampedNote") : null }, iq) : null
            );
          })
        )
      );
    }

    const printFoot = h("div", { class: "print-foot" }, h("div", {}, h("strong", {}, place.name), place.sub ? ` · ${place.sub}` : "", h("br"), t("methodNote", { m: METHODS[s0().resolved.method]?.name || s0().resolved.method, a: t(`${s0().resolved.madhab}Short`) }), place.note ? h("p", {}, place.note) : null));
    if (place.kind === "masjid") {
      import("../seed.js").then(async ({ placeToSeed, seedUrl }) => {
        const { default: qrcode } = await import("../vendor/qrcode.js");
        const qr = qrcode(0, "M");
        qr.addData(seedUrl(await placeToSeed(place)));
        qr.make();
        printFoot.append(h("div", { class: "print-qr", html: qr.createSvgTag({ cellSize: 2, margin: 4, scalable: true }) }));
      });
    }

    root.replaceChildren(
      h(
        "div",
        { class: "month-head" },
        h("button", { class: "icon-btn", type: "button", "aria-label": t("prevMonth"), onclick: () => shift(-1) }, icon("chevronLeft", "flip-rtl")),
        h("div", { class: "month-title" }, h("h1", {}, title), h("p", {}, `${place.name} · ${hijriRange}`)),
        h("button", { class: "icon-btn", type: "button", "aria-label": t("nextMonth"), onclick: () => shift(1) }, icon("chevronRight", "flip-rtl"))
      ),
      h(
        "div",
        { class: "month-actions no-print" },
        h("button", { class: "btn btn-tinted btn-sm", type: "button", onclick: () => window.print() }, icon("print"), t("print")),
        h("button", { class: "btn btn-tinted btn-sm", type: "button", onclick: () => ctx.openCalendar?.(place, { ym }) }, icon("calendar"), t("exportCal"))
      ),
      h(
        "p",
        { class: "month-legend" },
        h("span", {}, h("i", { class: "lg lg-adhan" }), t("adhan")),
        hasIqama ? h("span", {}, h("i", { class: "lg lg-iqama" }), t("iqama")) : null,
        h("span", {}, h("i", { class: "lg lg-hijri" }), t("hijriDay")),
        h("span", {}, h("i", { class: "lg lg-friday" }), t("jumuah"))
      ),
      h(
        "div",
        { class: "card month-card" },
        h(
          "table",
          { class: "month-table" },
          h("caption", { class: "sr-only" }, `${t("monthTitle")} — ${title}`),
          h(
            "thead",
            {},
            h(
              "tr",
              {},
              h("th", { scope: "col" }, t("day")),
              COLS.map((k) => {
                // Same sky-coloured dot as the Today timeline, sampled mid-month.
                const at = scheduleFor(place, calc, { ...ym, d: 15 }).times[k];
                const c = at ? skyAt(place, at) : null;
                return h(
                  "th",
                  { scope: "col", class: k === "sunrise" ? "m-sun" : "" },
                  c ? h("i", { class: "m-dot", style: { background: mixRgb(c.top, c.horizon, 0.55) } }) : null,
                  t(k)
                );
              })
            )
          ),
          h("tbody", {}, rows)
        )
      ),
      printFoot,
      h("p", { class: "list-foot no-print" }, t("exportCalHint"))
    );
    // Scroll to today once the view is on screen.
    // (On phones only: on a desktop the whole month fits and the title should stay in view.)
    if (first && ym.y === today.y && ym.m === today.m && innerWidth < 900) {
      first = false;
      requestAnimationFrame(() => requestAnimationFrame(() => root.querySelector(".is-today")?.scrollIntoView({ block: "center" })));
    }
  }

  const s0 = () => scheduleFor(place, calc, { ...ym, d: 1 });

  function shift(n) {
    const m0 = ym.m - 1 + n;
    ym = { y: ym.y + Math.floor(m0 / 12), m: ((m0 % 12) + 12) % 12 + 1 };
    render();
  }

  render();
  return { el: root };
}
