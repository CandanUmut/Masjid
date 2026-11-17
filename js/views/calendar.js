// "Add to calendar": choose which prayers (adhan and/or iqama), how you're alerted and how far ahead,
// then download a calendar file. Calendar alerts keep working when this app is closed, which is
// the only reliable way for a web app to remind anyone. The same choices drive in-app notifications.
import {
  ALERT_CHOICES, LENGTH_CHOICES, REMIND_ROWS, PRAYER_KEYS, buildIcs, placeHasIqama, placeHasJumuah, rangeDays,
  reminderEvents, normalizeRemind, normalizeCal, placeKey, exportSig, planExport, recordExport,
} from "../ics.js";
import { addDays, formatDate, formatTime, parseHHMM, todayYmd, ymdKey } from "../time.js";
import { t, tn } from "../i18n.js";
import { h, icon, openSheet, select, toggle, segmented } from "../ui.js";
import { row } from "./calc-editor.js";

const parseYmd = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
};

export function alertLabel(m) {
  return m < 0 ? t("alertNone") : m === 0 ? t("alertAt") : tn("alertBefore", m, { m });
}

export function platformOf() {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "computer";
}

// Every place this person could want a calendar for: the one on screen first.
function placeChoices(ctx, current) {
  const seen = new Set();
  return [current, ...ctx.state.places].filter((p) => p && !seen.has(p.id) && seen.add(p.id));
}

// The cells of one column of the grid: the five prayers, plus Jumu'ah where it sits in that column.
function columnCells(place, field) {
  const cells = PRAYER_KEYS.map((key) => ({ key, field }));
  if (placeHasJumuah(place) && (field === "iqama") === placeHasIqama(place)) cells.push({ key: "jumuah", field: "adhan" });
  return cells;
}

// A one-line summary of the choices, e.g. "5 prayers · Iqama: 10 min before".
export function remindSummary(prefs, place) {
  const iq = placeHasIqama(place);
  let n = PRAYER_KEYS.filter((k) => prefs.pick[k].adhan || (iq && prefs.pick[k].iqama)).length;
  if (placeHasJumuah(place) && prefs.pick.jumuah.adhan && !prefs.pick.dhuhr.adhan && !(iq && prefs.pick.dhuhr.iqama)) n++;
  const parts = [tn("nPrayers", n, { n })];
  if (PRAYER_KEYS.some((k) => prefs.pick[k].adhan)) parts.push(`${t("adhan")}: ${alertLabel(prefs.adhanAlert)}`);
  if (iq && PRAYER_KEYS.some((k) => prefs.pick[k].iqama)) parts.push(`${t("iqama")}: ${alertLabel(prefs.iqamaAlert)}`);
  return parts.join(" · ");
}

// mode: "calendar" (choose + download) or "notify" (choose what in-app notifications cover).
export function openCalendarSheet(ctx, { place: placeIn, ym: ymIn = null, mode = "calendar", onClose } = {}) {
  let place = placeIn || ctx.place;
  if (!place) return null;
  const prefs = normalizeRemind(ctx.settings.remind);
  const cal = normalizeCal(ctx.settings.cal);
  const isCal = mode === "calendar";
  let platform = platformOf();
  let skip = true; // leave out days already in the calendar (no duplicates)
  // Opened from the Month tab: start with the month on screen (without changing the saved default).
  let range = ymIn ? "month" : cal.range;
  let justSaved = false;

  const save = () =>
    ctx.update((s) => {
      s.settings.remind = structuredClone(prefs);
      s.settings.cal = structuredClone(cal);
    }, { render: false });

  const calcOf = (p) => p.calc || ctx.settings.calc;
  const fmt = (d) => formatTime(d, place.tz, { hour12: ctx.hour12, locale: ctx.locale });
  const dateLabel = (ymd) => formatDate(ymd, ctx.locale, { day: "numeric", month: "long" });
  // A month in the past (Month tab) has nothing left to add: use this month instead.
  const ymFor = (today) => (ymIn && ymIn.y * 12 + ymIn.m >= today.y * 12 + today.m ? ymIn : null);
  const key = () => placeKey(place);
  const sig = () => exportSig(place, calcOf(place), prefs, cal);

  // What the next file holds, given what this device already added to the calendar.
  function plan() {
    const today = todayYmd(place.tz);
    const ym = ymFor(today);
    const asked = rangeDays(range, today, ym);
    return { ...planExport(asked, cal.exports[key()], sig(), skip), asked, today, ym };
  }

  const body = h("div", { class: "cal-sheet" });
  const foot = isCal ? h("div", { class: "cal-foot" }) : null;
  // Controls carry a stable key, so keyboard and screen-reader focus survives each re-render.
  const k = (el, id) => {
    (el.matches("input, select, button") ? el : el.querySelector("input, select, button")).dataset.k = id;
    return el;
  };

  function grid() {
    const hasIqama = placeHasIqama(place);
    const hasJumuah = placeHasJumuah(place);
    const clock = (s) => {
      const hm = parseHHMM(s);
      return hm ? formatTime(new Date(Date.UTC(2000, 0, 1, hm.hh, hm.mm)), "UTC", { hour12: ctx.hour12, locale: ctx.locale }) : s;
    };
    const rows = REMIND_ROWS.filter((r) => !r.jumuah || hasJumuah);
    const check = (key, field, label) =>
      k(
        h(
          "label",
          { class: "rg-check" },
          h("input", {
            type: "checkbox",
            checked: Boolean(prefs.pick[key][field]),
            "aria-label": label,
            onchange: (e) => {
              prefs.pick[key][field] = e.target.checked;
              changed();
            },
          }),
          h("span", { class: "rg-box", "aria-hidden": "true" }, icon("check"))
        ),
        `${key}:${field}`
      );
    // Tapping a column title turns that column on for every prayer (or off, if it's all on).
    const colBtn = (field, label) => {
      const cells = columnCells(place, field);
      const all = cells.every((c) => prefs.pick[c.key][c.field]);
      return k(
        h(
          "button",
          {
            class: `rg-col ${all ? "is-all" : ""}`,
            type: "button",
            "aria-pressed": String(all),
            "aria-label": t("calToggleCol", { c: label }),
            onclick: () => {
              for (const c of cells) prefs.pick[c.key][c.field] = !all;
              changed();
            },
          },
          label
        ),
        `col:${field}`
      );
    };
    const sub = { sunrise: t("calSunriseSub"), lastThird: t("calLastThirdSub"), jumuah: hasJumuah ? t("calKhutbahSub", { t: place.jumuah.map(clock).join(" · ") }) : "" };
    const name = (key) => (key === "lastThird" ? t("evLastThird") : t(key));
    return h(
      "div",
      { class: `list remind-grid ${hasIqama ? "has-iqama" : ""}`, role: "group", "aria-label": t(isCal ? "calWhat" : "calWhatNotify") },
      h("div", { class: "rg-row rg-headrow" }, h("span", { class: "rg-name rg-hint" }, t("calTapCol")), colBtn("adhan", t("adhan")), hasIqama ? colBtn("iqama", t("iqama")) : null),
      rows.map((r) => {
        const label = name(r.key);
        // Jumu'ah is a congregation time: it sits in the iqama column when there is one.
        const jumuahInIqama = r.jumuah && hasIqama;
        const empty = () => h("span", { class: "rg-empty", "aria-hidden": "true" });
        return h(
          "div",
          { class: `rg-row ${r.extra ? "is-extra" : ""}` },
          h("span", { class: "rg-name" }, h("span", { class: "rg-title" }, label), sub[r.key] ? h("span", { class: "rg-sub" }, sub[r.key]) : null),
          jumuahInIqama ? empty() : check(r.key, "adhan", `${label} · ${r.jumuah ? t("khutbah") : t("adhan")}`),
          hasIqama ? (jumuahInIqama ? check(r.key, "adhan", `${label} · ${t("khutbah")}`) : r.iqama ? check(r.key, "iqama", `${label} · ${t("iqama")}`) : empty()) : null
        );
      })
    );
  }

  // A select on two lines (label above, value below): fits long labels and values on small phones.
  const selectRow = (label, value, options, onPick, id) =>
    row(label, k(select(value, options, onPick, { "aria-label": label }), id), true);

  function alertRows() {
    const hasIqama = placeHasIqama(place);
    const iqamaKind = (hasIqama && PRAYER_KEYS.some((k) => prefs.pick[k].iqama)) || (placeHasJumuah(place) && prefs.pick.jumuah.adhan);
    const opts = ALERT_CHOICES.map((m) => ({ value: m, label: alertLabel(m) }));
    const sel = (field, label) => selectRow(label, prefs[field], opts, (v) => { prefs[field] = Number(v); changed(); }, field);
    const anyAdhan = PRAYER_KEYS.some((k) => prefs.pick[k].adhan) || prefs.pick.sunrise.adhan || prefs.pick.lastThird.adhan || (!hasIqama && prefs.pick.jumuah.adhan && placeHasJumuah(place));
    return {
      main: [anyAdhan ? sel("adhanAlert", t("alertAdhan")) : null, iqamaKind ? sel("iqamaAlert", hasIqama ? t("alertIqama") : t("alertKhutbah")) : null],
      second: [anyAdhan ? sel("adhanAlert2", t("alertAdhan2")) : null, iqamaKind ? sel("iqamaAlert2", hasIqama ? t("alertIqama2") : t("alertKhutbah2")) : null],
    };
  }

  function rangeList(pl) {
    const monthName = formatDate({ ...(pl.ym || pl.today), d: 1 }, ctx.locale, { month: "long" });
    const opts = [
      { value: "month", label: pl.ym && (pl.ym.y !== pl.today.y || pl.ym.m !== pl.today.m) ? formatDate({ ...pl.ym, d: 1 }, ctx.locale, { month: "long", year: "numeric" }) : t("rangeMonth", { m: monthName }) },
      { value: "30", label: t("range30") },
      { value: "90", label: t("range90") },
      { value: "365", label: t("range365") },
    ];
    const rows = [selectRow(t("calRange"), range, opts, (v) => { range = cal.range = v; changed(); }, "range")];
    // Some of these days are already in the calendar (with the same choices): leave them out?
    if (pl.rec && !pl.changed) {
      rows.push(
        selectRow(
          t("calHave", { a: dateLabel(parseYmd(pl.rec.from)), b: dateLabel(parseYmd(pl.rec.to)) }),
          skip ? "skip" : "again",
          [
            { value: "skip", label: t("calSkip") },
            { value: "again", label: t("calAgain") },
          ],
          (v) => { skip = v === "skip"; changed(); },
          "skip"
        )
      );
    }
    return rows;
  }

  function help() {
    const steps = {
      ios: ["howIos1", "howIos2", "howIos3", "howIos4"],
      android: ["howAndroid1", "howAndroid2", "howAndroid3", "howAndroid4"],
      google: ["howGoogle1", "howGoogle2", "howGoogle3", "howGoogle4"],
      computer: ["howComputer1", "howComputer2", "howComputer3"],
    };
    const list = h("ol", { class: "cal-steps" }, steps[platform].map((s) => h("li", {}, t(s))));
    return h(
      "details",
      { class: "cal-help", open: justSaved },
      h("summary", {}, icon("info"), t("calHowTitle")),
      segmented(
        platform,
        [
          { value: "ios", label: t("platIos") },
          { value: "android", label: t("platAndroid") },
          { value: "google", label: t("platGoogle") },
          { value: "computer", label: t("platComputer") },
        ],
        (v) => {
          platform = v;
          list.replaceChildren(...steps[v].map((s) => h("li", {}, t(s))));
        },
        t("calHowTitle")
      ),
      list
    );
  }

  function render() {
    const pl = isCal ? plan() : null;
    const a = alertRows();
    const places = placeChoices(ctx, place);
    const parts = [];
    if (places.length > 1) {
      parts.push(
        h(
          "div",
          { class: "list" },
          selectRow(t("calFor"), place.id, places.map((p) => ({ value: p.id, label: p.name })), (v) => {
            place = places.find((p) => p.id === v) || place;
            loadSeedLink(place);
            skip = true;
            changed();
          }, "place")
        )
      );
    }
    parts.push(h("h3", { class: "list-title" }, t(isCal ? "calWhat" : "calWhatNotify")), grid());
    if (a.main.some(Boolean)) parts.push(h("h3", { class: "list-title" }, t("calAlerts")), h("div", { class: "list" }, a.main));
    if (isCal) {
      parts.push(h("div", { class: "list cal-range" }, rangeList(pl)));
      if (pl.changed) parts.push(h("p", { class: "list-foot cal-warn" }, icon("info"), t("calChanged", { d: dateLabel(parseYmd(pl.rec.to)) })));
      else if (pl.rec && !skip) parts.push(h("p", { class: "list-foot cal-warn" }, icon("info"), t("calDupHint")));
    }
    parts.push(
      h(
        "details",
        { class: "cal-more" },
        h("summary", {}, t("calMore")),
        a.second.some(Boolean) ? [h("div", { class: "list" }, a.second), h("p", { class: "list-foot" }, t("alert2Hint"))] : null,
        isCal
          ? [
              h(
                "div",
                { class: "list" },
                row(t("calBusy"), k(toggle(cal.busy, (v) => { cal.busy = v; changed(); }, t("calBusy")), "busy")),
                cal.busy ? selectRow(t("calLength"), cal.length, LENGTH_CHOICES.map((m) => ({ value: m, label: `${m} ${t("min")}` })), (v) => { cal.length = Number(v); changed(); }, "length") : null,
                row(t("calRenew"), k(toggle(cal.renew, (v) => { cal.renew = v; changed(); }, t("calRenew")), "renew"))
              ),
              h("p", { class: "list-foot" }, t("calBusyHint"), " ", t("calRenewHint")),
            ]
          : null
      )
    );
    if (isCal) {
      if (place.kind !== "masjid") parts.push(h("p", { class: "list-foot cal-note" }, icon("pin"), t("calTravel", { p: place.name })));
      parts.push(h("p", { class: "list-foot cal-note" }, icon("calendar"), t("calTip")));
      parts.push(help());
    } else {
      parts.push(h("p", { class: "list-foot" }, t("notifyHint")));
    }
    // Keep collapsible sections open/closed and the focused control focused across re-renders.
    const wasOpen = [...body.querySelectorAll("details")].map((d) => d.open);
    const focusKey = document.activeElement?.closest?.(".cal-sheet") ? document.activeElement.dataset.k : null;
    body.replaceChildren(...parts);
    if (wasOpen.length) body.querySelectorAll("details").forEach((d, i) => (d.open = wasOpen[i] || d.open));
    if (focusKey) body.querySelector(`[data-k="${focusKey}"]`)?.focus({ preventScroll: true });
    if (isCal) renderFoot(pl);
  }

  const events = (from, days) =>
    reminderEvents(place, calcOf(place), prefs, { from, days, label: (key, v) => t(key, v), hijriOffset: ctx.settings.hijriOffset, now: new Date(), busy: cal.busy, length: cal.length });

  function renderFoot(pl) {
    const evs = pl.days > 0 ? events(pl.from, pl.days) : [];
    const n = evs.length;
    const last = addDays(pl.from, pl.days - 1);
    const picked = Object.values(prefs.pick).some((p) => p.adhan || p.iqama);
    let summary;
    if (n) {
      const perDay = Math.max(1, Math.round(n / pl.days));
      summary = h(
        "p",
        { class: "cal-summary" },
        t("calSummary", { d: dateLabel(last), per: tn("calPerDay", perDay, { k: perDay }) }),
        h("span", { class: "cal-first" }, ` · ${t("calFirst", { e: evs[0].title, t: fmt(evs[0].start) })}`),
        n > 1500 ? h("span", { class: "cal-big" }, ` ${t("calBig")}`) : null
      );
    } else if (pl.covered) {
      // Not an error: often the file was just made. Say so calmly, and still offer it again.
      summary = h("p", { class: `cal-summary ${justSaved ? "is-done" : ""}` }, justSaved ? icon("check") : null, t(justSaved ? "calSavedUntil" : "calAlready", { d: dateLabel(parseYmd(pl.rec.to)) }));
    } else {
      summary = h("p", { class: "cal-summary is-empty" }, t(picked ? "calEmptyRange" : "calNone"));
    }
    const canShare = typeof navigator.canShare === "function" && typeof File === "function" && navigator.canShare({ files: [new File([""], "x.ics", { type: "text/calendar" })] });
    const again = () => {
      // Exactly the latest file again (from today on): never more than was in it.
      const today = ymdKey(todayYmd(place.tz));
      const from = parseYmd(pl.rec.last.from > today ? pl.rec.last.from : today);
      const to = parseYmd(pl.rec.last.to);
      download(from, Math.round((Date.UTC(to.y, to.m - 1, to.d) - Date.UTC(from.y, from.m - 1, from.d)) / 864e5) + 1, false);
    };
    foot.replaceChildren(
      summary,
      h(
        "div",
        { class: "cal-foot-btns" },
        pl.covered
          ? h("button", { class: "btn btn-tinted btn-block", type: "button", onclick: again }, icon("download"), t("calDownloadAgain"))
          : h("button", { class: "btn btn-primary btn-block", type: "button", disabled: !n, onclick: () => download(pl.from, pl.days, false) }, icon("download"), t("calDownload")),
        canShare && !pl.covered ? h("button", { class: "btn btn-tinted cal-share", type: "button", disabled: !n, "aria-label": t("calShare"), title: t("calShare"), onclick: () => download(pl.from, pl.days, true) }, icon("share")) : null
      )
    );
  }

  // Events link back to the masjid's own page (its seed link), so one tap in the calendar opens it.
  const seedLinks = new Map();
  function loadSeedLink(p) {
    if (p.kind !== "masjid" || seedLinks.has(p.id)) return;
    seedLinks.set(p.id, "");
    import("../seed.js").then(async ({ placeToSeed, seedUrl }) => seedLinks.set(p.id, seedUrl(await placeToSeed(p)))).catch(() => {});
  }
  loadSeedLink(place);
  const appLink = () => seedLinks.get(place.id) || `${location.origin}${location.pathname}`;

  async function download(from, days, share) {
    if (days <= 0) return;
    const ics = buildIcs(place, calcOf(place), prefs, {
      from,
      days,
      label: (key, v) => t(key, v),
      hijriOffset: ctx.settings.hijriOffset,
      now: new Date(),
      busy: cal.busy,
      length: cal.length,
      renew: cal.renew,
      url: appLink(),
      fmt,
      fmtDate: dateLabel,
    });
    const last = addDays(from, days - 1);
    const safe = (place.name || "prayer-times").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
    const fileName = `${safe}-${ymdKey(from)}-${ymdKey(last)}.ics`;
    const file = new File([ics.text], fileName, { type: "text/calendar" });
    if (share) {
      try {
        await navigator.share({ files: [file], title: fileName });
      } catch {
        return; // cancelled: nothing was added anywhere
      }
    } else {
      const a = h("a", { href: URL.createObjectURL(file), download: fileName });
      document.body.append(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1500);
    }
    // Remember what this place's calendar now holds, so the next file adds only what's missing.
    cal.exports[key()] = recordExport(cal.exports[key()], ymdKey(from), ymdKey(last), sig());
    skip = true;
    justSaved = true;
    save();
    render();
    requestAnimationFrame(() => body.querySelector(".cal-help")?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

  function changed() {
    justSaved = false;
    save();
    render();
  }

  render();
  const sheet = openSheet({
    title: isCal ? t("exportCal") : t("remindPick"),
    subtitle: isCal ? t("calSub") : null,
    className: "sheet--cal",
    content: body,
    actions: isCal ? foot : h("button", { class: "btn btn-primary btn-block", type: "button", onclick: () => sheet.close() }, t("done")),
    onClose,
  });
  return sheet;
}

// The prayer times this device added to the calendar run out soon (within 3 days) or ran out
// recently (up to 60 days ago). Returns { until, ended } or null.
export function calendarEnding(settings, place, now = new Date()) {
  if (!place) return null;
  const rec = settings.cal?.exports?.[placeKey(place)];
  if (!rec) return null;
  const today = todayYmd(place.tz, now);
  const t0 = ymdKey(today);
  if (rec.to < ymdKey(addDays(today, -60)) || rec.to > ymdKey(addDays(today, 3))) return null;
  return { until: parseYmd(rec.to), ended: rec.to < t0 };
}
