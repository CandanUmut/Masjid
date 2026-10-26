// Masjid pages: create/edit, share as link / QR / seed code, and open shared seeds.
import { PRAYERS, DEFAULT_CALC, resolveCalc, scheduleFor, normalizeCalc } from "../engine.js";
import { placeToSeed, parseSeed, seedUrl } from "../seed.js";
import { getPosition, reverseGeocode, searchPlaces, timezoneFor, completePlace } from "../geo.js";
import { t, lang } from "../i18n.js";
import { h, icon, openSheet, select, toast, copyText, debounce, minutesInput, confirmSheet } from "../ui.js";
import { allTimeZones, deviceTimeZone, todayYmd, formatTime, formatDate, timeParts, tzOffsetMinutes, addDays } from "../time.js";
import { newId } from "../store.js";
import { calcEditor } from "./calc-editor.js";
import { skyAt } from "./today.js";
import { placeOptions } from "./places.js";
import qrcode from "../vendor/qrcode.js";

const DEFAULT_IQAMA = {
  fajr: { mode: "offset", offset: 20, round: 0 },
  dhuhr: { mode: "offset", offset: 10, round: 0 },
  asr: { mode: "offset", offset: 10, round: 0 },
  maghrib: { mode: "offset", offset: 5, round: 0 },
  isha: { mode: "offset", offset: 10, round: 0 },
};

// --- Editor -----------------------------------------------------------------------------
export function openMasjidEditor(ctx, existing = null, prefill = null) {
  const base = ctx.place && ctx.place.kind !== "masjid" ? ctx.place : ctx.state.gps;
  const draft = existing
    ? structuredClone(existing)
    : {
        id: newId(),
        kind: "masjid",
        name: "",
        sub: "",
        lat: base?.lat ?? null,
        lng: base?.lng ?? null,
        tz: base?.tz || deviceTimeZone(),
        cc: base?.cc || null,
        calc: { ...DEFAULT_CALC },
        iqama: structuredClone(DEFAULT_IQAMA),
        jumuah: ["13:30"],
        note: "",
      };
  // From a mosque search result: start with its name and location.
  if (!existing && prefill) for (const k of ["name", "sub", "lat", "lng", "tz", "cc"]) if (prefill[k] != null) draft[k] = prefill[k];
  draft.calc = normalizeCalc(draft.calc);
  draft.iqama = draft.iqama || {};
  draft.jumuah = draft.jumuah || [];
  draft.sub = draft.sub || "";
  draft.note = draft.note || "";
  const initial = JSON.stringify(draft);
  let saved = false;

  const hasLoc = () => Number.isFinite(draft.lat) && Number.isFinite(draft.lng);
  const err = h("p", { class: "form-error", hidden: true });

  // Preview
  const preview = h("div", { class: "preview-card" });
  const renderPreview = debounce(() => {
    if (!hasLoc()) {
      preview.replaceChildren(h("p", { class: "preview-empty" }, t("locationRequired")));
      return;
    }
    renderRuleResults();
    const sky = skyAt(draft, new Date());
    preview.style.setProperty("--sky-top", sky.top);
    preview.style.setProperty("--sky-horizon", sky.horizon);
    const sched = scheduleFor(draft, draft.calc, todayYmd(draft.tz));
    // Keep cells compact: AM/PM goes on a small second line.
    const fmt = (d) => {
      const { main, period } = timeParts(d, draft.tz, { hour12: ctx.hour12, locale: ctx.locale });
      return period ? [main, h("small", { class: "preview-period" }, period)] : main;
    };
    preview.replaceChildren(
      h("div", { class: "preview-title" }, h("span", {}, t("preview")), h("span", { class: "preview-name" }, draft.name || t("newMasjid"))),
      h(
        "div",
        { class: "preview-grid" },
        h("div", { class: "preview-cell preview-labels", "aria-hidden": "true" }, h("span", { class: "preview-p" }, "\u00a0"), h("span", { class: "preview-a" }, t("adhan")), h("span", { class: "preview-i" }, t("iqama"))),
        sched.rows
          .filter((r) => r.isPrayer)
          .map((r) =>
            h(
              "div",
              { class: "preview-cell" },
              h("span", { class: "preview-p" }, t(r.key)),
              h("span", { class: "preview-a" }, fmt(r.adhan)),
              h("span", { class: `preview-i ${r.iqama?.clamped ? "is-clamped" : ""}` }, r.iqama ? fmt(r.iqama.at) : "—")
            )
          )
      )
    );
  }, 60);

  // Basics
  const nameInput = h("input", {
    class: "input",
    type: "text",
    maxlength: 80,
    value: draft.name,
    placeholder: t("masjidNamePh"),
    oninput: (e) => { draft.name = e.target.value; renderPreview(); renderLoc(false); },
  });
  const subInput = h("input", { class: "input", type: "text", maxlength: 120, value: draft.sub, placeholder: t("addressPh"), oninput: (e) => { draft.sub = e.target.value; renderLoc(false); } });

  // Location
  const locLine = h("div", { class: "loc-line" });
  const searchBox = h("input", { class: "search-input", type: "search", placeholder: t("searchPlaceholder"), "aria-label": t("searchCity") });
  const searchResults = h("div", { class: "list search-results", hidden: true });
  const latIn = h("input", { class: "input", inputmode: "decimal", "aria-label": t("latitude") });
  const lngIn = h("input", { class: "input", inputmode: "decimal", "aria-label": t("longitude") });
  const tzSel = select(draft.tz, allTimeZones().map((z) => ({ value: z, label: z.replace(/_/g, " ") })), (v) => { draft.tz = v; renderLoc(); renderPreview(); }, { "aria-label": t("timezone") });
  const coordsBox = h(
    "details",
    { class: "coords-details" },
    h("summary", {}, t("enterCoords")),
    h("div", { class: "form-grid" }, h("label", { class: "field" }, h("span", {}, t("latitude")), latIn), h("label", { class: "field" }, h("span", {}, t("longitude")), lngIn)),
    h("label", { class: "field" }, h("span", {}, t("timezone")), tzSel)
  );
  // Typed coordinates: look up their real time zone and country (never assume the device's).
  const lookupCoords = debounce(async (la, lo) => {
    const res = await timezoneFor(la, lo);
    if (draft.lat !== la || draft.lng !== lo) return;
    draft.tz = res.tz;
    try {
      draft.cc = (await reverseGeocode(la, lo, lang())).cc;
    } catch {
      /* offline */
    }
    renderLoc(false);
    renderPreview();
    calcBox.refresh();
  }, 600);
  const onCoords = () => {
    const la = Number(latIn.value.replace(",", "."));
    const lo = Number(lngIn.value.replace(",", "."));
    if (latIn.value && lngIn.value && Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180) {
      draft.lat = la;
      draft.lng = lo;
      draft.cc = null; // the old country no longer applies; the lookup below refills it
      renderLoc(false);
      renderPreview();
      calcBox.refresh();
      lookupCoords(la, lo);
    }
  };
  latIn.addEventListener("input", onCoords);
  lngIn.addEventListener("input", onCoords);

  const coordsText = () => `${draft.lat.toFixed(4)}, ${draft.lng.toFixed(4)}`;
  function renderLoc(syncInputs = true) {
    // A time zone far from what the longitude implies almost always means a mistake (3h-wrong times).
    const offH = tzOffsetMinutes(Date.now(), draft.tz) / 60;
    const mismatch = hasLoc() && Math.abs(offH - draft.lng / 15) > 2.5;
    locLine.replaceChildren(
      icon(hasLoc() ? "pin" : "info", "row-icon"),
      h(
        "span",
        { class: "row-main" },
        // People recognise an address, not coordinates: show those underneath.
        h("span", { class: "row-title" }, !hasLoc() ? t("setLocation") : (draft.sub || "").trim() || (draft.name || "").trim() || coordsText()),
        h("span", { class: "row-sub" }, [hasLoc() && ((draft.sub || "").trim() || (draft.name || "").trim()) ? coordsText() : null, draft.tz.replace(/_/g, " ")].filter(Boolean).join(" · ")),
        mismatch ? h("span", { class: "form-warn" }, t("tzMismatch")) : null
      )
    );
    if (syncInputs && hasLoc()) {
      latIn.value = String(draft.lat);
      lngIn.value = String(draft.lng);
    }
    tzSel.value = draft.tz;
  }

  const useHereBtn = h(
    "button",
    {
      class: "btn btn-tinted",
      type: "button",
      onclick: async () => {
        useHereBtn.disabled = true;
        try {
          const pos = await getPosition({ maximumAge: 0, timeout: 15000 });
          Object.assign(draft, { lat: pos.lat, lng: pos.lng, tz: pos.tz });
          renderLoc();
          renderPreview();
          reverseGeocode(pos.lat, pos.lng, lang())
            .then((info) => {
              draft.cc = info.cc;
              if (!draft.sub) {
                draft.sub = [info.name, info.sub].filter(Boolean).join(", ");
                subInput.value = draft.sub;
              }
              calcBox.refresh();
              renderPreview();
            })
            .catch(() => {});
        } catch (e) {
          toast(t(e.code === "denied" ? "locationDenied" : "locationUnavailable"), { tone: "warn" });
        } finally {
          useHereBtn.disabled = false;
        }
      },
    },
    icon("location"),
    t("useCurrent")
  );

  let seq = 0;
  searchBox.addEventListener(
    "input",
    debounce(async () => {
      const q = searchBox.value.trim();
      const mine = ++seq;
      if (q.length < 2) {
        searchResults.hidden = true;
        return;
      }
      try {
        const found = await searchPlaces(q, lang(), hasLoc() ? draft : ctx.state.gps);
        if (mine !== seq) return;
        searchResults.hidden = false;
        searchResults.replaceChildren(
          ...(found.length
            ? found.map((f) =>
                h(
                  "button",
                  {
                    class: "row row-btn",
                    type: "button",
                    onclick: async (e) => {
                      const btn = e.currentTarget;
                      btn.disabled = true;
                      let place = f;
                      try {
                        place = await completePlace(f);
                      } catch {
                        place = { ...f, tz: f.tz || draft.tz };
                      }
                      Object.assign(draft, { lat: place.lat, lng: place.lng, tz: place.tz, cc: place.cc });
                      // Picking the masjid itself from the map fills in its name and address too.
                      if (f.type === "mosque" && !draft.name.trim()) {
                        draft.name = f.name;
                        nameInput.value = f.name;
                      }
                      if (!draft.sub) {
                        draft.sub = f.type === "city" ? [f.name, f.sub].filter(Boolean).join(", ") : f.sub || f.name;
                        subInput.value = draft.sub;
                      }
                      searchResults.hidden = true;
                      searchBox.value = "";
                      renderLoc();
                      renderPreview();
                      calcBox.refresh();
                    },
                  },
                  icon(f.type === "mosque" ? "mosque" : f.type === "address" ? "pin" : "globe", "row-icon"),
                  h("span", { class: "row-main" }, h("span", { class: "row-title" }, f.name), h("span", { class: "row-sub" }, f.sub))
                )
              )
            : [h("div", { class: "row row-muted" }, t("noResults"))])
        );
      } catch {
        if (mine !== seq) return;
        searchResults.hidden = false;
        searchResults.replaceChildren(h("div", { class: "row row-muted" }, t("searchOffline")));
      }
    }, 300)
  );

  // Calculation — the editor works on a live proxy of the draft so "Automatic" shows the right method.
  const calcBox = calcEditor(draft.calc, { get lat() { return draft.lat || 0; }, get lng() { return draft.lng || 0; }, get tz() { return draft.tz; }, get cc() { return draft.cc; } }, (c) => {
    draft.calc = c;
    renderPreview();
  });

  // Iqama rules — each row shows what its rule gives today, so admins see the effect immediately.
  const iqamaList = h("div", { class: "list" });
  const ruleResult = {};
  const ruleWarn = {};
  function renderRuleResults() {
    if (!hasLoc()) return;
    const sched = scheduleFor(draft, draft.calc, todayYmd(draft.tz));
    for (const p of PRAYERS) {
      const el = ruleResult[p];
      if (!el) continue;
      const row = sched.rows.find((r) => r.key === p || (p === "dhuhr" && r.key === "jumuah"));
      el.textContent = row?.iqama ? `${document.documentElement.dir === "rtl" ? "←" : "→"} ${formatTime(row.iqama.at, draft.tz, { hour12: ctx.hour12, locale: ctx.locale })}` : "";
      const bad = Boolean(row?.iqama?.clamped || row?.iqama?.late);
      el.classList.toggle("is-clamped", bad);
      // Problems are said in words, right under the rule — not hidden in a hover tooltip.
      const warn = ruleWarn[p];
      if (warn) {
        warn.hidden = !bad;
        warn.textContent = row?.iqama?.late ? t("iqamaLate", { p: t({ fajr: "sunrise", dhuhr: "asr", asr: "maghrib", maghrib: "isha", isha: "midnight" }[p]) }) : row?.iqama?.clamped ? t("clampedNote") : "";
      }
    }
  }
  // ---- Iqama rules read as sentences: "[40] min [before Asr adhan ▾]", "[20:15] [at a fixed time ▾]" ----
  const NEXT_OF = { fajr: "sunrise", dhuhr: "asr", asr: "maghrib", maghrib: "isha", isha: "midnight" };
  const hoursFmt = (hh, mm) => t("hoursFmt", { h: hh, m: mm ? ` ${mm} ${t("min")}` : "" });
  const kindOptions = (p, withOff) =>
    [
      { value: "offset", label: t("ruleAfter", { p: t(p) }) },
      {
        value: "before",
        label: NEXT_OF[p] === "sunrise" ? t("ruleBeforeSunrise") : NEXT_OF[p] === "midnight" ? t("ruleBeforeMidnight") : t("ruleBefore", { p: t(NEXT_OF[p]) }),
      },
      { value: "fixed", label: t("ruleFixed") },
    ].concat(withOff ? [{ value: "off", label: t("ruleOff") }] : []);

  // Today's numbers for a prayer, used to convert between rule kinds without moving the time.
  function today(p) {
    if (!hasLoc()) return null;
    const sched = scheduleFor(draft, draft.calc, todayYmd(draft.tz));
    const row = sched.rows.find((r) => r.key === p || (p === "dhuhr" && r.key === "jumuah"));
    const end = sched.times[NEXT_OF[p]];
    return row?.adhan ? { adhan: row.adhan, iqama: row.iqama?.at || null, end } : null;
  }
  const hhmm = (d) => formatTime(d, draft.tz, { hour12: false, locale: "en-GB" });

  // Switch a rule to another kind, keeping today's iqama time where possible.
  function convert(p, rule, kind) {
    const td = today(p);
    const at = td?.iqama || (td ? new Date(td.adhan.getTime() + (DEFAULT_IQAMA[p].offset || 10) * 60000) : null);
    const keep = { from: rule.from, changes: rule.changes };
    Object.keys(rule).forEach((k) => delete rule[k]);
    if (kind === "offset") Object.assign(rule, { mode: "offset", offset: at ? Math.max(0, Math.round((at - td.adhan) / 300000) * 5) : DEFAULT_IQAMA[p].offset, round: 0 });
    else if (kind === "before") Object.assign(rule, { mode: "before", offset: at && td.end ? Math.max(0, Math.round((td.end - at) / 300000) * 5) : 30, round: 0 });
    else Object.assign(rule, { mode: "fixed", time: at ? hhmm(at) : "13:30", min: 5 });
    if (keep.from) rule.from = keep.from;
    if (keep.changes) rule.changes = keep.changes;
  }

  function ruleSentence(p, rule, { withOff = false, onKind } = {}) {
    const kind = rule ? rule.mode : "off";
    const kindSel = select(kind, kindOptions(p, withOff), (v) => onKind(v), { class: "select select-rule", "aria-label": t(p) });
    const line = h("div", { class: "iqama-sentence" });
    if (kind === "offset" || kind === "before") {
      line.append(
        minutesInput(rule.offset, { min: 0, max: 300, step: 5, label: `${t(p)} ${t("min")}`, unit: t("min"), hours: hoursFmt, onChange: (v) => { rule.offset = v; renderPreview(); } }),
        kindSel
      );
    } else if (kind === "fixed") {
      line.append(
        h("input", { class: "input input-time", type: "time", value: rule.time, "aria-label": `${t(p)} ${t("fixed")}`, oninput: (e) => { rule.time = e.target.value; renderPreview(); } }),
        kindSel
      );
    } else line.append(kindSel);

    const extra = h("div", { class: "iqama-extra" });
    if (kind === "offset" || kind === "before") {
      extra.append(
        select(
          rule.round || 0,
          [
            { value: 0, label: t("noRound") },
            { value: 5, label: t(kind === "before" ? "roundDown" : "roundUp", { n: 5 }) },
            { value: 10, label: t(kind === "before" ? "roundDown" : "roundUp", { n: 10 }) },
            { value: 15, label: t(kind === "before" ? "roundDown" : "roundUp", { n: 15 }) },
          ],
          (v) => { rule.round = Number(v); renderPreview(); },
          { class: "select select-compact", "aria-label": t("roundTo") }
        )
      );
    } else if (kind === "fixed") {
      extra.append(
        h("span", { class: "iqama-min-label" }, t("atLeast")),
        // Input and "after adhan" stay together when the sentence wraps.
        h(
          "span",
          { class: "iqama-min-group" },
          minutesInput(rule.min || 0, { min: 0, max: 120, step: 5, label: t("atLeast"), unit: t("min"), hours: hoursFmt, onChange: (v) => { rule.min = v; renderPreview(); } }),
          h("span", { class: "iqama-min-label" }, t("afterAdhanShort"))
        )
      );
    }
    return { line, extra: extra.childElementCount ? extra : null };
  }

  const monthNames = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(ctx.locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2001, i, 1))));

  // A seasonal change: "From [day] [month], every year → rule".
  function changeRow(p, rule, c, i) {
    const setFrom = (m, d) => {
      const days = new Date(Date.UTC(2001, m, 0)).getUTCDate();
      c.from = `${String(m).padStart(2, "0")}-${String(Math.min(d, days)).padStart(2, "0")}`;
      renderIqama();
      renderPreview();
    };
    const [cm, cd] = c.from.split("-").map(Number);
    return h(
      "div",
      { class: "iqama-change" },
      h(
        "div",
        { class: "iqama-change-head" },
        h("span", { class: "iqama-change-from" }, t("fromLabel")),
        select(cd, Array.from({ length: 31 }, (_, k) => ({ value: k + 1, label: String(k + 1) })), (v) => setFrom(cm, Number(v)), { class: "select select-compact", "aria-label": t("day") }),
        select(cm, monthNames.map((n, k) => ({ value: k + 1, label: n })), (v) => setFrom(Number(v), cd), { class: "select select-compact", "aria-label": t("month") }),
        h("button", { class: "icon-btn icon-btn-sm", type: "button", "aria-label": t("remove"), onclick: () => { rule.changes.splice(i, 1); if (!rule.changes.length) delete rule.changes; renderIqama(); renderPreview(); } }, icon("close"))
      ),
      ...Object.values(ruleSentence(p, c, { onKind: (v) => { convert(p, c, v); renderIqama(); renderPreview(); } })).filter(Boolean)
    );
  }

  function renderIqama() {
    iqamaList.replaceChildren(
      ...PRAYERS.map((p) => {
        const rule = draft.iqama[p];
        ruleResult[p] = h("span", { class: "iqama-result", "aria-live": "polite" });
        ruleWarn[p] = h("p", { class: "iqama-warn", hidden: true, role: "status" });
        const { line, extra } = ruleSentence(p, rule, {
          withOff: true,
          onKind: (v) => {
            if (v === "off") draft.iqama[p] = null;
            else {
              if (!draft.iqama[p]) draft.iqama[p] = { ...DEFAULT_IQAMA[p] };
              convert(p, draft.iqama[p], v);
            }
            renderIqama();
            renderPreview();
          },
        });
        const body = [line, ruleWarn[p]];
        let addBtn = null;
        if (rule) {
          if (rule.changes?.length) {
            rule.changes.sort((a, b) => a.from.localeCompare(b.from));
            body.unshift(h("div", { class: "iqama-change-from iqama-base-from" }, t("fromJan1")));
          }
          if (rule.mode === "fixed" && extra) body.push(extra);
          (rule.changes || []).forEach((c, i) => body.push(changeRow(p, rule, c, i)));
          if ((rule.changes?.length || 0) < 12) {
            addBtn = (
              h(
                "button",
                {
                  class: "btn btn-plain btn-sm iqama-add-change",
                  type: "button",
                  onclick: () => {
                    // Default: a change on the first of next month, same kind of rule.
                    const now = todayYmd(draft.tz);
                    const m = (now.m % 12) + 1;
                    const base = { ...rule };
                    delete base.changes;
                    rule.changes = [...(rule.changes || []), { ...base, from: `${String(m).padStart(2, "0")}-01` }];
                    renderIqama();
                    renderPreview();
                  },
                },
                icon("calendar"),
                t("addSeasonal")
              )
            );
          }
          // Rounding (for minute rules) and "add a change" share one quiet footer line.
          body.push(h("div", { class: "iqama-foot" }, rule.mode !== "fixed" ? extra : null, addBtn));
        }
        return h("div", { class: "row iqama-row" }, h("div", { class: "iqama-top" }, h("span", { class: "iqama-prayer" }, t(p)), ruleResult[p]), ...body.filter(Boolean));
      })
    );
  }

  // Jumu'ah
  const jumuahWrap = h("div", { class: "chips" });
  function renderJumuah() {
    jumuahWrap.replaceChildren(
      ...draft.jumuah.map((time, i) =>
        h(
          "div",
          { class: "chip-time" },
          h("input", { class: "input input-time", type: "time", value: time, "aria-label": `${t("jumuah")} ${i + 1}`, oninput: (e) => { draft.jumuah[i] = e.target.value; renderPreview(); } }),
          h("button", { class: "icon-btn icon-btn-sm", type: "button", "aria-label": t("remove"), onclick: () => { draft.jumuah.splice(i, 1); renderJumuah(); renderPreview(); } }, icon("close"))
        )
      ),
      draft.jumuah.length < 4
        ? h("button", { class: "btn btn-tinted btn-sm", type: "button", onclick: () => { draft.jumuah.push(draft.jumuah.length ? "14:30" : "13:30"); renderJumuah(); } }, icon("plus"), t("addJumuah"))
        : null
    );
  }

  const noteInput = h("textarea", { class: "input", maxlength: 280, rows: 3, placeholder: t("notePh"), oninput: (e) => (draft.note = e.target.value) }, draft.note);

  const sheet = openSheet({
    title: existing ? t("editMasjid") : t("newMasjid"),
    wide: true,
    className: "sheet--tall",
    // Swiping down or tapping outside must never silently throw away an admin's work.
    confirmClose: { when: () => !saved && JSON.stringify(draft) !== initial },
    content: [
      preview,
      h("h3", { class: "list-title" }, t("masjid")),
      h("div", { class: "form-card" }, h("label", { class: "field" }, h("span", {}, t("masjidName")), nameInput), h("label", { class: "field" }, h("span", {}, t("address")), subInput)),
      h("h3", { class: "list-title" }, t("location")),
      h(
        "div",
        { class: "form-card" },
        h("div", { class: "row loc-row" }, locLine),
        h("div", { class: "btn-row" }, useHereBtn),
        h("div", { class: "search-field" }, icon("search"), searchBox),
        searchResults,
        coordsBox
      ),
      h("h3", { class: "list-title" }, t("calcForMasjid")),
      calcBox.el,
      h("p", { class: "list-foot" }, t("calcForMasjidHint")),
      h("h3", { class: "list-title" }, t("iqamaTimes")),
      iqamaList,
      h("p", { class: "list-foot" }, t("seasonalHint")),
      h("h3", { class: "list-title" }, t("jumuahTimes")),
      h("div", { class: "form-card" }, jumuahWrap),
      h("h3", { class: "list-title" }, t("note")),
      h("div", { class: "form-card" }, noteInput),
      err,
    ],
    actions: [
      h("button", { class: "btn btn-plain", type: "button", onclick: () => sheet.close() }, t("cancel")),
      h(
        "button",
        {
          class: "btn btn-primary btn-grow",
          type: "button",
          onclick: () => {
            if (!draft.name.trim()) return fail(t("nameRequired"), nameInput);
            if (!hasLoc()) return fail(t("locationRequired"), searchBox);
            // Pin "Automatic" choices so everyone who opens the link gets identical times.
            const r = resolveCalc(draft, draft.calc);
            const place = {
              ...draft,
              name: draft.name.trim(),
              sub: draft.sub.trim(),
              note: draft.note.trim(),
              jumuah: draft.jumuah.filter(Boolean),
              calc: { ...draft.calc, method: r.method, madhab: r.madhab },
            };
            const unchanged = existing && JSON.stringify(draft) === initial;
            place.u = unchanged && existing.u ? existing.u : Math.floor(Date.now() / 1000);
            saved = true;
            if (!unchanged) ctx.addPlace(place, { activate: true });
            else ctx.activate(place.id);
            sheet.forceClose();
            // A brand-new masjid is meant to be shared; an edit just saves.
            if (!existing) setTimeout(() => openShareSheet(ctx, place), 260);
          },
        },
        t("save")
      ),
    ],
  });

  // Show the problem right under the field it belongs to, and bring that field into view.
  function fail(msg, focusEl) {
    sheet.el.querySelectorAll(".field-error").forEach((n) => n.remove());
    const anchor = focusEl?.closest(".field, .search-field") || focusEl;
    const note = h("p", { class: "form-error field-error", role: "alert" }, msg);
    anchor?.after(note);
    focusEl?.focus({ preventScroll: true });
    (anchor || note).scrollIntoView({ behavior: "smooth", block: "center" });
  }

  renderLoc();
  renderIqama();
  renderJumuah();
  renderPreview();
  // Only when there's a name to type: a prefilled form shouldn't open the keyboard over the preview.
  if (!existing && !draft.name) setTimeout(() => nameInput.focus(), 300);
  return sheet;
}

// The next seven days of iqama times — what everyone who opens the link will see.
function weekPreview(ctx, place) {
  const base = todayYmd(place.tz);
  const short = (d) => (d ? timeParts(d, place.tz, { hour12: ctx.hour12, locale: ctx.locale }).main : "—");
  const days = Array.from({ length: 7 }, (_, i) => addDays(base, i));
  return h(
    "div",
    { class: "card week-preview" },
    h("div", { class: "your-masjids-title" }, t("next7days")),
    h(
      "table",
      { class: "week-table" },
      h("thead", {}, h("tr", {}, h("th"), PRAYERS.map((p) => h("th", { scope: "col" }, t(p))))),
      h(
        "tbody",
        {},
        days.map((ymd, i) => {
          const s = scheduleFor(place, place.calc, ymd);
          return h(
            "tr",
            { class: s.isFriday ? "is-friday" : "" },
            h("th", { scope: "row" }, i === 0 ? t("today") : formatDate(ymd, ctx.locale, { weekday: "short", day: "numeric" })),
            PRAYERS.map((p) => {
              const r = s.rows.find((x) => x.key === p || (p === "dhuhr" && x.key === "jumuah"));
              return h("td", {}, short(r?.iqama?.at || null));
            })
          );
        })
      )
    )
  );
}

// --- Share --------------------------------------------------------------------------------
export async function openShareSheet(ctx, place) {
  const seed = await placeToSeed(place);
  const url = seedUrl(seed);
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const qrBox = h("div", { class: "qr-box", html: qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true, alt: t("qr") }) });
  const copyBtn = (text, label) =>
    h(
      "button",
      {
        class: "btn btn-tinted btn-sm",
        type: "button",
        onclick: async (e) => {
          const b = e.currentTarget; // read before awaiting: currentTarget is null afterwards
          const ok = await copyText(text);
          if (ok) {
            const old = b.lastChild.textContent;
            b.lastChild.textContent = t("copied");
            setTimeout(() => (b.lastChild.textContent = old), 1500);
          }
        },
      },
      icon("copy"),
      h("span", {}, label)
    );

  const canShare = typeof navigator.share === "function";
  const sheet = openSheet({
    title: place.kind === "masjid" ? t("shareMasjid") : t("share"),
    content: [
      h(
        "div",
        { class: "share-hero" },
        qrBox,
        h("div", { class: "share-name" }, place.name),
        place.sub ? h("div", { class: "share-sub" }, place.sub) : null,
        h("div", { class: "share-scan" }, t("scanToOpen")),
        place.iqama ? h("p", { class: "share-allyear" }, icon("calendar"), t("shareAllYear")) : null
      ),
      h(
        "div",
        { class: "share-actions" },
        canShare
          ? h(
              "button",
              {
                class: "btn btn-primary",
                type: "button",
                onclick: () => navigator.share({ title: place.name, text: `${place.name} — ${t("iqamaTimes")}`, url }).catch(() => {}),
              },
              icon("share"),
              t("shareVia")
            )
          : null,
        copyBtn(url, t("copyLink")),
        place.kind === "masjid" ? h("button", { class: "btn btn-tinted btn-sm", type: "button", onclick: () => printPoster(place, qr) }, icon("print"), t("poster")) : null,
        place.kind === "masjid" && ctx.openDisplay ? h("button", { class: "btn btn-tinted btn-sm", type: "button", onclick: () => { sheet.forceClose(); ctx.openDisplay(place); } }, icon("tv"), t("tvMode")) : null
      ),
      place.iqama ? weekPreview(ctx, place) : null,
      h(
        "details",
        { class: "seed-details" },
        h("summary", {}, t("showCode")),
        h("div", { class: "form-card" }, h("code", { class: "seed-code" }, seed), h("div", { class: "btn-row" }, copyBtn(seed, t("copy")))),
        h("p", { class: "list-foot" }, t("seedHint"))
      ),
      place.kind === "masjid" ? h("p", { class: "list-foot" }, t("seedUpdateHint")) : null,
    ],
  });
  return sheet;
}

// A one-page poster for the masjid entrance: name, big QR, one line of instruction.
function printPoster(place, qr) {
  const poster = h(
    "div",
    { class: "poster" },
    h("div", { class: "poster-mark", "aria-hidden": "true" }, icon("mosque")),
    h("h1", {}, place.name),
    place.sub ? h("p", { class: "poster-sub" }, place.sub) : null,
    h("div", { class: "poster-qr", html: qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true }) }),
    h("p", { class: "poster-cta" }, t("posterCta")),
    h("p", { class: "poster-fine" }, t("posterFine"))
  );
  document.body.append(poster);
  document.body.classList.add("is-printing-poster");
  const done = () => {
    document.body.classList.remove("is-printing-poster");
    poster.remove();
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

// --- Open a seed --------------------------------------------------------------------------
export function openSeedInput(ctx, { restore = false } = {}) {
  const input = h("textarea", { class: "input", rows: 3, placeholder: t(restore ? "restorePh" : "openSeedPh"), "aria-label": t(restore ? "importData" : "openSeed"), autocapitalize: "off", autocorrect: "off", spellcheck: false });
  const err = h("p", { class: "form-error", hidden: true });
  // A backup saved as a file can be picked instead of pasted.
  const filePick = restore
    ? h("label", { class: "btn btn-plain file-pick" }, icon("download"), t("chooseFile"), h("input", { type: "file", accept: ".txt,text/plain", hidden: true, onchange: async (e) => { const f = e.target.files?.[0]; if (f) input.value = (await f.text()).trim(); } }))
    : null;
  const sheet = openSheet({
    title: t(restore ? "importData" : "openSeed"),
    content: [input, filePick, err],
    actions: h(
      "button",
      {
        class: "btn btn-primary btn-block",
        type: "button",
        onclick: async () => {
          // Pasting is a deliberate act, so backups are allowed here (after a confirmation).
          const ok = await importSeed(ctx, input.value, { allowBackup: true });
          if (ok) sheet.close();
          else if (ok === false) {
            err.textContent = t("invalidSeed");
            err.hidden = false;
          }
        },
      },
      t("apply")
    ),
  });
  setTimeout(() => input.focus(), 250);
}

// Links can be crafted by anyone, so importing is defensive:
//  - backups (which replace settings) are never accepted from a URL, only when pasted and confirmed
//  - timestamps from the future are capped, so a bad clock or a prank can't freeze a masjid
//  - an older link never silently overwrites a newer copy, and every update can be undone
export async function importSeed(ctx, text, { allowBackup = false, silent = false } = {}) {
  let parsed;
  try {
    parsed = await parseSeed(text);
  } catch {
    return false;
  }
  if (parsed.kind === "backup") {
    if (!allowBackup || !ctx.restoreBackup) {
      toast(t("backupNotFromLink"), { tone: "warn", duration: 6000 });
      return null; // refused (not invalid)
    }
    if (!(await confirmSheet({ title: t("restoreTitle"), message: t("restoreConfirm", { n: parsed.places.length }), confirmLabel: t("restoreAction") }))) return null;
    return ctx.restoreBackup(parsed);
  }
  const nowS = Math.floor(Date.now() / 1000);
  const incoming = { ...parsed.place, u: Math.min(parsed.place.u || 0, nowS + 86400) };
  const existing = incoming.id ? ctx.state.places.find((p) => p.id === incoming.id) : null;
  if (existing && (existing.u || 0) > incoming.u) {
    ctx.activate(existing.id);
    if (!silent)
      toast(t("olderLink", { d: new Date(existing.u * 1000).toLocaleDateString(ctx.locale) }), {
        action: t("useAnyway"),
        duration: 8000,
        onAction: () => ctx.addPlace({ ...incoming, u: nowS }, { activate: true }),
      });
    return true;
  }
  const place = { ...incoming, id: incoming.id || newId() };
  if (existing && !silent) {
    const previous = structuredClone(existing);
    ctx.addPlace(place, { activate: true, silent: true });
    toast(t("updated", { p: place.name }), { action: t("undo"), duration: 8000, onAction: () => ctx.addPlace(previous, { activate: true, silent: true }) });
    return true;
  }
  if (silent) {
    ctx.addPlace(place, { activate: true, silent: true });
    return true;
  }
  // Opening a link saves the masjid; one tap undoes that if it wasn't wanted.
  const before = ctx.state.activeId;
  ctx.addPlace(place, { activate: true, silent: true });
  toast(t("added", { p: place.name }), {
    action: t("undo"),
    duration: 8000,
    onAction: () => {
      ctx.removePlace(place.id, { silent: true });
      if (before && before !== place.id) ctx.activate(before);
    },
  });
  return true;
}

// Under the times on a masjid page: who this is, and the actions people look for.
function masjidCard(ctx, place) {
  return h(
    "div",
    { class: "card masjid-card" },
    h(
      "div",
      { class: "masjid-card-head" },
      h("div", { class: "masjid-cta-icon", "aria-hidden": "true" }, icon("mosque")),
      h("div", { class: "masjid-card-text" }, h("strong", {}, place.name), place.sub ? h("span", {}, place.sub) : null)
    ),
    h(
      "div",
      { class: "masjid-card-actions" },
      h("button", { class: "btn btn-tinted btn-sm", type: "button", onclick: () => openMasjidEditor(ctx, place) }, icon("edit"), t("edit")),
      h("button", { class: "btn btn-tinted btn-sm", type: "button", onclick: () => openShareSheet(ctx, place) }, icon("share"), t("share")),
      ctx.openDisplay ? h("button", { class: "btn btn-tinted btn-sm", type: "button", onclick: () => ctx.openDisplay(place) }, icon("tv"), t("tvShort")) : null
    )
  );
}

// --- Plugin wiring ----------------------------------------------------------------------------
export const masjidPlugin = {
  ctx: () => ({
    shareMasjid: (p) => openShareSheet(currentCtx(), p),
    editMasjid: (p) => openMasjidEditor(currentCtx(), p),
    createMasjid: (prefill) => openMasjidEditor(currentCtx(), null, prefill),
    masjidCard: (p) => masjidCard(currentCtx(), p),
    openSeed: () => openSeedInput(currentCtx()),
    extraPlaceActions: (sheet) => [
      h("button", { class: "row row-btn", type: "button", onclick: () => { sheet.close(); openMasjidEditor(currentCtx()); } }, icon("mosque", "row-icon tone-accent"), h("span", { class: "row-title" }, t("addMasjid"))),
      h("button", { class: "row row-btn", type: "button", onclick: () => { sheet.close(); openSeedInput(currentCtx()); } }, icon("link", "row-icon tone-accent"), h("span", { class: "row-title" }, t("openSeed"))),
    ],
  }),
  topbarActions: (ctx) =>
    ctx.place && ctx.place.id !== "gps"
      ? [
          ctx.place.kind === "masjid" ? h("button", { class: "icon-btn", type: "button", "aria-label": t("share"), onclick: () => openShareSheet(ctx, ctx.place) }, icon("share")) : null,
          h("button", { class: "icon-btn", type: "button", "aria-label": t("placeOptions"), onclick: () => placeOptions(ctx, ctx.place) }, icon("more")),
        ]
      : [],
  onboardingActions: (ctx) => [h("button", { class: "btn btn-plain", type: "button", onclick: () => openSeedInput(ctx) }, icon("link"), t("openSeed"))],
  handleHash(name, arg, ctx) {
    if (name !== "m" || !arg) return false;
    importSeed(ctx, arg).then((ok) => {
      if (ok === false) toast(t("invalidSeed"), { tone: "warn" });
      history.replaceState(null, "", location.pathname + location.search + "#/");
      ctx.go("today");
    });
    return true;
  },
};

let ctxProvider = null;
export function setCtxProvider(fn) {
  ctxProvider = fn;
}
function currentCtx() {
  return ctxProvider();
}
