import { scheduleFor, METHODS } from "../engine.js";
import { todayYmd, daysInMonth, formatDate, formatHijriMonth, hijriParts, sameYmd, partsInTz, timeParts, ymdKey } from "../time.js";
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
    const hijriRange = h1 === h2 ? h1 : `${h1} – ${h2}`;
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
        h("button", { class: "btn btn-tinted btn-sm", type: "button", onclick: () => downloadIcs(ctx, ym) }, icon("calendar"), t("exportCal"))
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
    if (first && ym.y === today.y && ym.m === today.m) {
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

// --- Calendar export (.ics) with an alert at each prayer --------------------------------------
function icsDate(d) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function icsText(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcs(place, calc, ym, label = (k) => k, { fromDay = 1 } = {}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ufuq//Prayer Times//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(`${place.name} — ${label("monthTitle")}`)}`,
  ];
  const stamp = icsDate(new Date());
  const n = daysInMonth(ym.y, ym.m);
  for (let d = fromDay; d <= n; d++) {
    const ymd = { y: ym.y, m: ym.m, d };
    const s = scheduleFor(place, calc, ymd);
    for (const r of s.rows) {
      if (!r.isPrayer || !r.adhan) continue;
      const end = r.iqama?.at && r.iqama.at > r.adhan ? new Date(r.iqama.at.getTime() + 10 * 60000) : new Date(r.adhan.getTime() + 15 * 60000);
      const iq = r.iqama ? `${label("iqama")}: ${partsHHMM(r.iqama.at, place.tz)}` : "";
      lines.push(
        "BEGIN:VEVENT",
        `UID:${place.id || "here"}-${ymdKey(ymd)}-${r.key}@ufuq`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsDate(r.adhan)}`,
        `DTEND:${icsDate(end)}`,
        `SUMMARY:${icsText(`${label(r.key)}${iq ? ` · ${iq}` : ""}`)}`,
        `LOCATION:${icsText(place.name)}`,
        "TRANSP:TRANSPARENT",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${icsText(label(r.key))}`,
        "TRIGGER:PT0M",
        "END:VALARM",
        "END:VEVENT"
      );
    }
  }
  lines.push("END:VCALENDAR");
  // RFC 5545 wants CRLF and lines ≤ 75 octets; fold long lines.
  return lines.map(fold).join("\r\n") + "\r\n";
}

function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let cur = "";
  let len = 0;
  for (const ch of line) {
    const l = new TextEncoder().encode(ch).length;
    if (len + l > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      len = 0;
    }
    cur += ch;
    len += l;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function partsHHMM(d, tz) {
  const p = partsInTz(d, tz);
  return `${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`;
}

function downloadIcs(ctx, ym) {
  // This month: from today on (past alarms are just noise in a calendar).
  const today = todayYmd(ctx.place.tz);
  const fromDay = today.y === ym.y && today.m === ym.m ? today.d : 1;
  const ics = buildIcs(ctx.place, ctx.calc, ym, (k) => t(k), { fromDay });
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const a = h("a", {
    href: URL.createObjectURL(blob),
    download: `${(ctx.place.name || "prayer-times").replace(/[^\p{L}\p{N}]+/gu, "-")}-${ym.y}-${String(ym.m).padStart(2, "0")}.ics`,
  });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}
