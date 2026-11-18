// Ramadan: a printable timetable for the month (Suhoor ends, Iftar, Taraweeh), and the "Ramadan pack",
// one calendar file with Suhoor, Iftar and Taraweeh reminders for every day of it.
import { scheduleFor, computeDay, ramadanSpan, taraweehFor, isRamadan, METHODS, placeHijriOffset, ramadanSoon as soon } from "../engine.js";
import { buildIcs, ramadanEvents, placeHasTaraweeh, placeKey, normalizeRemind } from "../ics.js";
import { addDays, formatDate, formatTime, hijriParts, sameYmd, timeParts, todayYmd, ymdKey } from "../time.js";
import { t, tn } from "../i18n.js";
import { h, icon, openSheet, select, toggle } from "../ui.js";
import { row } from "./calc-editor.js";
import { alertLabel } from "./calendar.js";

const SUHOOR_LEADS = [-1, 20, 30, 45, 60, 90];
const IFTAR_ALERTS = [-2, -1, 0, 5, 10, 15]; // -2: leave Iftar out

// Ramadan within `days` from today (or now), for this place? Its span, or null.
export function ramadanSoon(place, hijriOffset, days = 60) {
  return place ? soon(place, todayYmd(place.tz), hijriOffset, days) : null;
}

// The dates of this (or the next) Ramadan, as a short range: "8 February – 9 March".
function spanLabel(span, locale) {
  const last = addDays(span.from, span.days - 1);
  const f = (d) => formatDate(d, locale, { day: "numeric", month: "long" });
  return `${f(span.from)} – ${f(last)}`;
}

export function openRamadanSheet(ctx, place = ctx.place) {
  if (!place) return null;
  const today = todayYmd(place.tz);
  const span = ramadanSpan(today, placeHijriOffset(place, today, ctx.settings.hijriOffset));
  if (!span) return null;
  const calc = place.calc || ctx.settings.calc;
  // Already in the prayer calendar for (part of) Ramadan? Then Maghrib and Taraweeh are there too:
  // leave them out of the pack by default, so nobody gets two alerts each evening.
  const rec = ctx.settings.cal?.exports?.[placeKey(place)];
  const lastDay = ymdKey(addDays(span.from, span.days - 1));
  const pick = normalizeRemind(ctx.settings.remind).pick;
  const overlap = Boolean(rec && rec.to >= ymdKey(addDays(span.from, -1)) && rec.from <= lastDay);
  const dupIftar = overlap && pick.maghrib.adhan;
  const dupTaraweeh = overlap && pick.taraweeh.adhan && placeHasTaraweeh(place);
  const prefs = { suhoorLead: 45, iftarAlert: dupIftar ? -2 : 0, taraweeh: !dupTaraweeh, taraweehAlert: 15, ...(ctx.settings.ramadan || {}) };
  const body = h("div", { class: "cal-sheet" });
  const foot = h("div", { class: "cal-foot" });
  let done = false;
  const save = () => ctx.update((s) => (s.settings.ramadan = { ...prefs }), { render: false });

  const opts = () => ({ from: span.from, days: span.days, ...prefs, label: (k, v) => t(k, v), hijriOffset: ctx.settings.hijriOffset, now: new Date() });

  function render() {
    const hasT = placeHasTaraweeh(place);
    const sel = (label, value, list, fmtOpt, key) =>
      row(label, select(value, list.map((m) => ({ value: m, label: fmtOpt(m) })), (v) => { prefs[key] = Number(v); done = false; save(); render(); }, { "aria-label": label }), true);
    body.replaceChildren(
      h("p", { class: "ramadan-dates" }, icon("moon"), h("span", {}, h("strong", {}, t("ramadanTitle", { y: span.year })), h("br"), spanLabel(span, ctx.locale))),
      h(
        "div",
        { class: "list" },
        sel(t("ramadanSuhoor"), prefs.suhoorLead, SUHOOR_LEADS, (m) => (m < 0 ? t("off") : tn("suhoorBefore", m, { m })), "suhoorLead"),
        sel(t("ramadanIftar"), prefs.iftarAlert, IFTAR_ALERTS, (m) => (m === -2 ? t("leaveOut") : alertLabel(m)), "iftarAlert"),
        hasT ? row(t("taraweeh"), toggle(prefs.taraweeh, (v) => { prefs.taraweeh = v; done = false; save(); render(); }, t("taraweeh"))) : null,
        hasT && prefs.taraweeh ? sel(t("ramadanTaraweehAlert"), prefs.taraweehAlert, [-1, 0, 10, 15, 30], alertLabel, "taraweehAlert") : null
      ),
      dupIftar || dupTaraweeh ? h("p", { class: "list-foot cal-note" }, icon("info"), t("ramadanOverlap")) : null,
      h("p", { class: "list-foot" }, t("ramadanOnce"), " ", t(place.ramadanStart ? "ramadanMasjidDate" : "ramadanMoon")),
      h("div", { class: "list list-actions" }, h("button", { class: "row row-btn", type: "button", onclick: () => { sheet.close(); setTimeout(() => ctx.go("ramadan"), 240); } }, icon("print", "row-icon tone-accent"), h("span", { class: "row-title" }, t("ramadanTimetable"))))
    );
    const evs = ramadanEvents(place, calc, opts());
    foot.replaceChildren(
      done ? h("p", { class: "cal-summary is-done" }, icon("check"), t("ramadanReady")) : h("p", { class: "cal-summary" }, tn("calEvents", evs.length, { n: evs.length })),
      h("div", { class: "cal-foot-btns" }, h("button", { class: `btn ${done ? "btn-tinted" : "btn-primary"} btn-block`, type: "button", disabled: !evs.length, onclick: download }, icon("download"), t(done ? "calDownloadAgain" : "ramadanDownload")))
    );
  }

  function download() {
    const events = ramadanEvents(place, calc, opts());
    const last = addDays(span.from, span.days - 1);
    const { text } = buildIcs(place, calc, null, {
      events,
      from: span.from,
      days: span.days,
      label: (k, v) => t(k, v),
      renew: false,
      url: `${location.origin}${location.pathname}`,
      fmt: (d) => formatTime(d, place.tz, { hour12: ctx.hour12, locale: ctx.locale }),
      calName: `${t("ramadanTitle", { y: span.year })} · ${place.name}`,
    });
    const safe = (place.name || "ramadan").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
    const file = new File([text], `Ramadan-${span.year}-${safe}-${ymdKey(span.from)}-${ymdKey(last)}.ics`, { type: "text/calendar" });
    const a = h("a", { href: URL.createObjectURL(file), download: file.name });
    document.body.append(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1500);
    done = true;
    render();
  }

  render();
  const sheet = openSheet({ title: t("ramadanPack"), subtitle: t("ramadanPackSub"), className: "sheet--cal", content: body, actions: foot });
  return sheet;
}

// The printable month: one row per fast, Suhoor ends (Fajr) and Iftar (Maghrib) up front.
export function RamadanView(ctx) {
  const { place, calc } = ctx;
  const root = h("div", { class: "view view-month view-ramadan" });
  const today = todayYmd(place.tz);
  const off = placeHijriOffset(place, today, ctx.settings.hijriOffset);
  const span = ramadanSpan(today, off);
  const short = (d) => (d ? timeParts(d, place.tz, { hour12: ctx.hour12, locale: ctx.locale }).main : "—");
  if (!span) {
    root.append(h("p", { class: "list-foot" }, t("ramadanUnknown")));
    return { el: root };
  }
  const hasT = placeHasTaraweeh(place);
  const cols = ["suhoorEnds", "sunrise", "dhuhr", "asr", "iftar", "isha"].concat(hasT ? ["taraweeh"] : []);
  const rows = [];
  for (let i = 0; i < span.days; i++) {
    const ymd = addDays(span.from, i);
    const s = scheduleFor(place, calc, ymd);
    const get = (k) => s.rows.find((r) => r.key === k || (k === "dhuhr" && r.key === "jumuah"));
    const cell = (k) => {
      if (k === "taraweeh") {
        if (isRamadan(addDays(ymd, 1), off)) return short(taraweehFor(place, calc, ymd));
        // The last fast: a 30th night only if the month completes 30 days (depends on the moon).
        return span.days === 29 && i === span.days - 1 ? h("span", { title: t("ramadanMaybe") }, `${short(taraweehFor(place, calc, ymd))}*`) : "—";
      }
      // Adhan times only: a fasting timetable stays narrow enough for a phone (iqama is on the Month page).
      return short(get(k === "suhoorEnds" ? "fajr" : k === "iftar" ? "maghrib" : k)?.adhan);
    };
    const hd = hijriParts(ymd, off)?.d;
    // This evening begins night hd+1: mark the odd nights of the last ten (21st, 23rd … 29th).
    const night = (hd || i + 1) + 1;
    const oddNight = night >= 21 && night % 2 === 1;
    rows.push(
      h(
        "tr",
        { class: `${sameYmd(ymd, today) ? "is-today" : ""} ${s.isFriday ? "is-friday" : ""} ${oddNight ? "is-odd-night" : ""}`, "aria-current": sameYmd(ymd, today) ? "date" : null, title: oddNight ? t("oddNight", { n: night }) : null },
        h("th", { scope: "row", class: "m-day" }, h("span", { class: "m-d" }, String(hd ?? i + 1)), h("span", { class: "m-w" }, formatDate(ymd, ctx.locale, { weekday: "short", day: "numeric", month: "short" }))),
        cols.map((k) => h("td", { class: `${k === "sunrise" ? "m-sun" : ""} ${k === "suhoorEnds" || k === "iftar" ? "r-key" : ""}` }, cell(k)))
      )
    );
  }
  const firstT = hasT && ymdKey(addDays(span.from, -1)) >= ymdKey(today) ? addDays(span.from, -1) : null;
  const resolved = computeDay(place, calc, span.from).resolved;
  root.append(
    h(
      "div",
      { class: "month-head" },
      h("button", { class: "icon-btn", type: "button", "aria-label": t("close"), onclick: () => ctx.go("month") }, icon("chevronLeft", "flip-rtl")),
      h("div", { class: "month-title" }, h("h1", {}, t("ramadanTitle", { y: span.year })), h("p", {}, `${place.name} · ${spanLabel(span, ctx.locale)}`)),
      h("span", { class: "icon-btn-space", "aria-hidden": "true" })
    ),
    h(
      "div",
      { class: "month-actions no-print" },
      h("button", { class: "btn btn-tinted btn-sm", type: "button", onclick: () => window.print() }, icon("print"), t("print")),
      h("button", { class: "btn btn-tinted btn-sm", type: "button", onclick: () => openRamadanSheet(ctx, place) }, icon("calendar"), t("ramadanPack"))
    ),
    h("p", { class: "month-legend" }, h("span", {}, h("i", { class: "lg lg-odd" }), t("oddNightsLegend")), span.days === 29 && hasT ? h("span", {}, t("ramadanMaybe")) : null),
    firstT ? h("p", { class: "month-legend" }, t("firstTaraweeh", { d: formatDate(firstT, ctx.locale, { weekday: "long", day: "numeric", month: "long" }), t: formatTime(taraweehFor(place, calc, firstT), place.tz, { hour12: ctx.hour12, locale: ctx.locale }) })) : null,
    h(
      "div",
      { class: "card month-card" },
      h(
        "table",
        { class: "month-table ramadan-table" },
        h("caption", { class: "sr-only" }, t("ramadanTimetable")),
        h("thead", {}, h("tr", {}, h("th", { scope: "col" }, t("ramadanDay")), cols.map((k) => h("th", { scope: "col", class: `${k === "sunrise" ? "m-sun" : ""} ${k === "suhoorEnds" || k === "iftar" ? "r-key" : ""}` }, k === "suhoorEnds" ? t("colSuhoor") : t(k))))),
        h("tbody", {}, rows)
      )
    ),
    h(
      "div",
      { class: "print-foot" },
      h("div", {}, h("strong", {}, place.name), place.sub ? ` · ${place.sub}` : "", h("br"), t("methodNote", { m: METHODS[resolved.method]?.name || "", a: t(`${resolved.madhab}Short`) }), h("br"), t(place.ramadanStart ? "ramadanMasjidDate" : "ramadanMoon"))
    )
  );
  if (rows.some((r) => r.classList.contains("is-today")) && innerWidth < 900) {
    requestAnimationFrame(() => requestAnimationFrame(() => root.querySelector(".is-today")?.scrollIntoView({ block: "center" })));
  }
  return { el: root };
}

