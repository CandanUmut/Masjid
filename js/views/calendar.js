// "Add to calendar": choose which prayers (adhan and/or iqama), how you're alerted and how far ahead,
// then download a calendar file. Calendar alerts keep working when this app is closed, which is
// the only reliable way for a web app to remind anyone. The same choices drive in-app notifications.
import { ALERT_CHOICES, LENGTH_CHOICES, REMIND_ROWS, PRAYER_KEYS, buildIcs, placeHasIqama, placeHasJumuah, rangeDays, reminderEvents, normalizeRemind, normalizeCal } from "../ics.js";
import { addDays, formatDate, formatTime, timeParts, todayYmd, ymdKey } from "../time.js";
import { t } from "../i18n.js";
import { h, icon, openSheet, select, toggle, segmented, toast } from "../ui.js";
import { row } from "./calc-editor.js";

const parseYmd = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
};

export function alertLabel(m) {
  return m < 0 ? t("alertNone") : m === 0 ? t("alertAt") : t("alertBefore", { m });
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

// A one-line summary of the choices, e.g. "5 prayers · iqama · alert 10 min before iqama".
export function remindSummary(prefs, place) {
  const n = PRAYER_KEYS.filter((k) => prefs.pick[k].adhan || (placeHasIqama(place) && prefs.pick[k].iqama)).length;
  const parts = [t("nPrayers", { n })];
  const anyAdhan = PRAYER_KEYS.some((k) => prefs.pick[k].adhan);
  const anyIqama = placeHasIqama(place) && PRAYER_KEYS.some((k) => prefs.pick[k].iqama);
  if (anyAdhan) parts.push(`${t("adhan")}: ${alertLabel(prefs.adhanAlert).toLocaleLowerCase()}`);
  if (anyIqama) parts.push(`${t("iqama")}: ${alertLabel(prefs.iqamaAlert).toLocaleLowerCase()}`);
  return parts.join(" · ");
}

// mode: "calendar" (choose + download) or "notify" (choose what in-app notifications cover).
export function openCalendarSheet(ctx, { place: placeIn, ym = null, mode = "calendar", onClose } = {}) {
  let place = placeIn || ctx.place;
  if (!place) return null;
  const prefs = normalizeRemind(ctx.settings.remind);
  const cal = normalizeCal(ctx.settings.cal);
  const isCal = mode === "calendar";
  let platform = platformOf();
  let startAfter = true; // continue after what's already in the calendar (no duplicates)
  let justSaved = false;

  const save = () => ctx.update((s) => {
    s.settings.remind = structuredClone(prefs);
    s.settings.cal = structuredClone(cal);
  }, { render: false });

  const calcOf = (p) => p.calc || ctx.settings.calc;
  const fmt = (d) => formatTime(d, place.tz, { hour12: ctx.hour12, locale: ctx.locale });
  const short = (d) => timeParts(d, place.tz, { hour12: ctx.hour12, locale: ctx.locale }).main;
  const dateLabel = (ymd) => formatDate(ymd, ctx.locale, { day: "numeric", month: "long" });

  // The span this download covers, picking up after the last download for this place if asked.
  function span() {
    const today = todayYmd(place.tz);
    let { from, days } = rangeDays(cal.range, today, ym);
    const last = addDays(from, days - 1);
    // Only matters when this range overlaps what was already added.
    const prev = isCal && cal.exports[place.id] >= ymdKey(from) ? cal.exports[place.id] : null;
    if (prev && startAfter) {
      const next = addDays(parseYmd(prev), 1);
      // Same end date as asked for; only the start moves (0 days: it's all in the calendar already).
      days = Math.max(0, Math.round((Date.UTC(last.y, last.m - 1, last.d) - Date.UTC(next.y, next.m - 1, next.d)) / 864e5) + 1);
      from = next;
    }
    return { from, days, today, prev };
  }

  const body = h("div", { class: "cal-sheet" });
  const foot = isCal ? h("div", { class: "cal-foot" }) : null;

  function grid() {
    const hasIqama = placeHasIqama(place);
    const hasJumuah = placeHasJumuah(place);
    const jumuahTimes = hasJumuah ? place.jumuah.join(" · ") : "";
    const rows = REMIND_ROWS.filter((r) => !r.jumuah || hasJumuah);
    const check = (key, field, label) =>
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
      );
    // Tapping a column title turns that column on for every prayer (or off, if it's all on).
    const colBtn = (field, label) => {
      const all = PRAYER_KEYS.every((k) => prefs.pick[k][field]);
      return h(
        "button",
        {
          class: `rg-col ${all ? "is-all" : ""}`,
          type: "button",
          "aria-label": t("calToggleCol", { c: label }),
          onclick: () => {
            for (const k of PRAYER_KEYS) prefs.pick[k][field] = !all;
            changed();
          },
        },
        label
      );
    };
    const sub = { sunrise: t("calSunriseSub"), lastThird: t("calLastThirdSub"), jumuah: t("calKhutbahSub", { t: jumuahTimes }) };
    const name = (k) => (k === "lastThird" ? t("evLastThird") : t(k));
    return h(
      "div",
      { class: `list remind-grid ${hasIqama ? "has-iqama" : ""}`, role: "group", "aria-label": t("calWhat") },
      h("div", { class: "rg-row rg-headrow" }, h("span", { class: "rg-name rg-hint" }, t("calTapCol")), colBtn("adhan", t("adhan")), hasIqama ? colBtn("iqama", t("iqama")) : null),
      rows.map((r) => {
        const label = name(r.key);
        // Jumu'ah is a congregation time: it sits in the iqama column when there is one.
        const jumuahInIqama = r.jumuah && hasIqama;
        return h(
          "div",
          { class: `rg-row ${r.extra ? "is-extra" : ""}` },
          h("span", { class: "rg-name" }, h("span", { class: "rg-title" }, label), sub[r.key] ? h("span", { class: "rg-sub" }, sub[r.key]) : null),
          jumuahInIqama ? h("span", { class: "rg-empty" }) : check(r.key, "adhan", `${label} · ${r.jumuah ? t("khutbah") : t("adhan")}`),
          hasIqama ? (jumuahInIqama ? check(r.key, "adhan", `${label} · ${t("khutbah")}`) : r.iqama ? check(r.key, "iqama", `${label} · ${t("iqama")}`) : h("span", { class: "rg-empty" })) : null
        );
      })
    );
  }

  function alertRows() {
    const hasIqama = placeHasIqama(place);
    const wantsIqamaKind = (hasIqama && PRAYER_KEYS.some((k) => prefs.pick[k].iqama)) || (placeHasJumuah(place) && prefs.pick.jumuah.adhan);
    const opts = ALERT_CHOICES.map((m) => ({ value: m, label: alertLabel(m) }));
    const sel = (field, label) => row(label, select(prefs[field], opts, (v) => { prefs[field] = Number(v); changed(); }, { "aria-label": label }));
    return { main: [sel("adhanAlert", t("alertAdhan")), wantsIqamaKind ? sel("iqamaAlert", hasIqama ? t("alertIqama") : t("alertKhutbah")) : null], second: [sel("adhanAlert2", t("alertAdhan2")), wantsIqamaKind ? sel("iqamaAlert2", hasIqama ? t("alertIqama2") : t("alertKhutbah2")) : null] };
  }

  function rangeRow(sp) {
    const monthName = formatDate({ ...(ym || sp.today), d: 1 }, ctx.locale, { month: "long" });
    const viewingThis = !ym || (ym.y === sp.today.y && ym.m === sp.today.m);
    const opts = [
      { value: "month", label: viewingThis ? t("rangeMonth", { m: monthName }) : formatDate({ ...ym, d: 1 }, ctx.locale, { month: "long", year: "numeric" }) },
      { value: "30", label: t("range30") },
      { value: "90", label: t("range90") },
      { value: "365", label: t("range365") },
    ];
    return row(t("calRange"), select(cal.range, opts, (v) => { cal.range = v; changed(); }, { "aria-label": t("calRange") }));
  }

  function help() {
    const steps = {
      ios: ["howIos1", "howIos2", "howIos3", "howIos4"],
      android: ["howAndroid1", "howAndroid2", "howAndroid3", "howAndroid4"],
      google: ["howGoogle1", "howGoogle2", "howGoogle3", "howGoogle4"],
      computer: ["howComputer1", "howComputer2", "howComputer3"],
    };
    const list = h("ol", { class: "cal-steps" }, steps[platform].map((k) => h("li", {}, t(k))));
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
          list.replaceChildren(...steps[v].map((k) => h("li", {}, t(k))));
        },
        t("calHowTitle")
      ),
      list
    );
  }

  function render() {
    const sp = span();
    const a = alertRows();
    const places = placeChoices(ctx, place);
    const parts = [];
    if (places.length > 1) {
      parts.push(
        h(
          "div",
          { class: "list" },
          row(
            t("calFor"),
            select(place.id, places.map((p) => ({ value: p.id, label: p.name })), (v) => {
              place = places.find((p) => p.id === v) || place;
              loadSeedLink(place);
              changed();
            }, { "aria-label": t("calFor") }),
            true
          )
        )
      );
    }
    parts.push(h("h3", { class: "list-title" }, t(isCal ? "calWhat" : "calWhatNotify")), grid());
    parts.push(h("h3", { class: "list-title" }, t("calAlerts")), h("div", { class: "list" }, a.main));
    if (isCal) {
      const rangeList = [rangeRow(sp)];
      if (sp.prev) {
        rangeList.push(
          row(
            t("calStart"),
            select(startAfter ? "after" : "today", [
              { value: "after", label: t("startAfter", { d: dateLabel(parseYmd(sp.prev)) }) },
              { value: "today", label: t("startToday") },
            ], (v) => { startAfter = v === "after"; changed(); }, { "aria-label": t("calStart") }),
            true
          )
        );
      }
      parts.push(h("div", { class: "list cal-range" }, rangeList));
      if (sp.prev && !startAfter) parts.push(h("p", { class: "list-foot" }, t("calDupHint")));
    }
    parts.push(
      h(
        "details",
        { class: "cal-more" },
        h("summary", {}, t("calMore")),
        h("div", { class: "list" }, a.second),
        h("p", { class: "list-foot" }, t("alert2Hint")),
        isCal
          ? [
              h(
                "div",
                { class: "list" },
                row(t("calBusy"), toggle(cal.busy, (v) => { cal.busy = v; changed(); }, t("calBusy"))),
                cal.busy ? row(t("calLength"), select(cal.length, LENGTH_CHOICES.map((m) => ({ value: m, label: `${m} ${t("min")}` })), (v) => { cal.length = Number(v); changed(); }, { "aria-label": t("calLength") })) : null,
                row(t("calRenew"), toggle(cal.renew, (v) => { cal.renew = v; changed(); }, t("calRenew")))
              ),
              h("p", { class: "list-foot" }, t("calBusyHint"), " ", t("calRenewHint")),
            ]
          : null
      )
    );
    if (isCal) {
      if (place.kind !== "masjid") parts.push(h("p", { class: "list-foot cal-travel" }, icon("pin"), t("calTravel", { p: place.name })));
      parts.push(help());
    } else {
      parts.push(h("p", { class: "list-foot" }, t("notifyHint")));
    }
    // Keep the open/closed state of the collapsible sections across re-renders.
    const wasOpen = [...body.querySelectorAll("details")].map((d) => d.open);
    body.replaceChildren(...parts);
    if (wasOpen.length) body.querySelectorAll("details").forEach((d, i) => (d.open = wasOpen[i] || d.open));
    if (isCal) renderFoot(sp);
  }

  function events(sp) {
    return reminderEvents(place, calcOf(place), prefs, { from: sp.from, days: sp.days, label: (k, v) => t(k, v), hijriOffset: ctx.settings.hijriOffset, now: new Date(), busy: cal.busy, length: cal.length });
  }

  function renderFoot(sp) {
    const evs = sp.days > 0 ? events(sp) : [];
    const n = evs.length;
    const last = addDays(sp.from, sp.days - 1);
    // Everything in this range is already in the calendar (often: just downloaded). Not an error:
    // say so calmly, and still offer the file again in case it never got opened.
    const covered = !sp.days && sp.prev;
    const summary = n
      ? h("p", { class: "cal-summary" }, t("calSummary", { n: n.toLocaleString(ctx.locale), d: dateLabel(last) }), h("span", { class: "cal-first" }, ` · ${t("calFirst", { e: evs[0].title, t: fmt(evs[0].start) })}`))
      : covered
        ? h("p", { class: `cal-summary ${justSaved ? "is-done" : ""}` }, justSaved ? icon("check") : null, t(justSaved ? "calSavedUntil" : "calAlready", { d: dateLabel(parseYmd(sp.prev)) }))
        : h("p", { class: "cal-summary is-empty" }, t("calNone"));
    const again = () => {
      startAfter = false;
      download(span(), false);
    };
    const canShare = typeof navigator.canShare === "function" && typeof File === "function" && navigator.canShare({ files: [new File([""], "x.ics", { type: "text/calendar" })] });
    foot.replaceChildren(
      summary,
      h(
        "div",
        { class: "cal-foot-btns" },
        covered
          ? h("button", { class: "btn btn-tinted btn-block", type: "button", onclick: again }, icon("download"), t("calDownloadAgain"))
          : h("button", { class: "btn btn-primary btn-block", type: "button", disabled: !n, onclick: () => download(sp, false) }, icon("download"), t("calDownload")),
        canShare && !covered ? h("button", { class: "btn btn-tinted cal-share", type: "button", disabled: !n, "aria-label": t("calShare"), title: t("calShare"), onclick: () => download(sp, true) }, icon("share")) : null
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

  async function download(sp, share) {
    const ics = buildIcs(place, calcOf(place), prefs, {
      from: sp.from,
      days: sp.days,
      label: (k, v) => t(k, v),
      hijriOffset: ctx.settings.hijriOffset,
      now: new Date(),
      busy: cal.busy,
      length: cal.length,
      renew: cal.renew,
      url: appLink(),
      fmt,
      fmtDate: dateLabel,
    });
    const last = addDays(sp.from, sp.days - 1);
    const safe = (place.name || "prayer-times").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
    const fileName = `${safe}-${ymdKey(sp.from)}-${ymdKey(last)}.ics`;
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
    // Remember how far this place's calendar now reaches: the next download carries on from there.
    const prev = cal.exports[place.id];
    if (!prev || prev < ymdKey(last) || !startAfter) cal.exports[place.id] = ymdKey(last);
    startAfter = true;
    justSaved = true;
    save();
    toast(t("calReady", { n: ics.count.toLocaleString(ctx.locale) }), { duration: 6000 });
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

// Prayer times in the calendar about to run out for this place? Returns the last day, or null.
export function calendarEndingSoon(settings, place, now = new Date()) {
  const until = settings.cal?.exports?.[place?.id];
  if (!until) return null;
  const today = todayYmd(place.tz, now);
  const soon = ymdKey(addDays(today, 3));
  return until >= ymdKey(today) && until <= soon ? parseYmd(until) : null;
}
