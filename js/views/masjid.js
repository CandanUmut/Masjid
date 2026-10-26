// Masjid pages: create/edit, share as link / QR / seed code, and open shared seeds.
import { PRAYERS, DEFAULT_CALC, resolveCalc, scheduleFor, normalizeCalc } from "../engine.js";
import { placeToSeed, parseSeed, seedUrl } from "../seed.js";
import { getPosition, reverseGeocode, searchPlaces } from "../geo.js";
import { t, lang } from "../i18n.js";
import { h, icon, openSheet, segmented, stepper, select, toast, copyText, debounce } from "../ui.js";
import { allTimeZones, deviceTimeZone, todayYmd, formatTime, timeParts } from "../time.js";
import { newId } from "../store.js";
import { calcEditor } from "./calc-editor.js";
import qrcode from "../vendor/qrcode.js";

const DEFAULT_IQAMA = {
  fajr: { mode: "offset", offset: 20, round: 0 },
  dhuhr: { mode: "offset", offset: 10, round: 0 },
  asr: { mode: "offset", offset: 10, round: 0 },
  maghrib: { mode: "offset", offset: 5, round: 0 },
  isha: { mode: "offset", offset: 10, round: 0 },
};

// --- Editor -----------------------------------------------------------------------------
export function openMasjidEditor(ctx, existing = null) {
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
  draft.calc = normalizeCalc(draft.calc);
  draft.iqama = draft.iqama || {};
  draft.jumuah = draft.jumuah || [];

  const hasLoc = () => Number.isFinite(draft.lat) && Number.isFinite(draft.lng);
  const err = h("p", { class: "form-error", hidden: true });

  // Preview
  const preview = h("div", { class: "preview-card" });
  const renderPreview = debounce(() => {
    if (!hasLoc()) {
      preview.replaceChildren(h("p", { class: "preview-empty" }, t("locationRequired")));
      return;
    }
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
    oninput: (e) => { draft.name = e.target.value; renderPreview(); },
  });
  const subInput = h("input", { class: "input", type: "text", maxlength: 120, value: draft.sub, placeholder: t("addressPh"), oninput: (e) => (draft.sub = e.target.value) });

  // Location
  const locLine = h("div", { class: "loc-line" });
  const searchBox = h("input", { class: "input", type: "search", placeholder: t("searchPlaceholder"), "aria-label": t("searchCity") });
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
  const onCoords = () => {
    const la = Number(latIn.value.replace(",", "."));
    const lo = Number(lngIn.value.replace(",", "."));
    if (latIn.value && lngIn.value && Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180) {
      draft.lat = la;
      draft.lng = lo;
      renderLoc(false);
      renderPreview();
      calcBox.refresh();
    }
  };
  latIn.addEventListener("input", onCoords);
  lngIn.addEventListener("input", onCoords);

  function renderLoc(syncInputs = true) {
    locLine.replaceChildren(
      icon(hasLoc() ? "pin" : "info", "row-icon"),
      h(
        "span",
        { class: "row-main" },
        h("span", { class: "row-title" }, hasLoc() ? `${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}` : t("setLocation")),
        h("span", { class: "row-sub" }, draft.tz.replace(/_/g, " "))
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
        const found = await searchPlaces(q, lang());
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
                    onclick: () => {
                      Object.assign(draft, { lat: f.lat, lng: f.lng, tz: f.tz, cc: f.cc });
                      if (!draft.sub) {
                        draft.sub = [f.name, f.sub].filter(Boolean).join(", ");
                        subInput.value = draft.sub;
                      }
                      searchResults.hidden = true;
                      searchBox.value = "";
                      renderLoc();
                      renderPreview();
                      calcBox.refresh();
                    },
                  },
                  icon("pin", "row-icon"),
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

  // Iqama rules
  const iqamaList = h("div", { class: "list" });
  function renderIqama() {
    iqamaList.replaceChildren(
      ...PRAYERS.map((p) => {
        const rule = draft.iqama[p];
        const mode = rule ? rule.mode : "off";
        const detail = h("div", { class: "iqama-detail" });
        if (mode === "offset") {
          detail.append(
            stepper(rule.offset, {
              min: 0,
              max: 90,
              format: (v) => `+${v} ${t("min")}`,
              label: `${t(p)} ${t("offset")}`,
              onChange: (v) => { rule.offset = v; renderPreview(); },
            }),
            select(
              rule.round || 0,
              [
                { value: 0, label: t("noRound") },
                { value: 5, label: `${t("roundTo")} 5` },
                { value: 10, label: `${t("roundTo")} 10` },
                { value: 15, label: `${t("roundTo")} 15` },
              ],
              (v) => { rule.round = Number(v); renderPreview(); },
              { class: "select select-compact", "aria-label": t("roundTo") }
            )
          );
        } else if (mode === "fixed") {
          detail.append(
            h("input", {
              class: "input input-time",
              type: "time",
              value: rule.time,
              "aria-label": `${t(p)} ${t("fixed")}`,
              oninput: (e) => { rule.time = e.target.value; renderPreview(); },
            })
          );
        }
        return h(
          "div",
          { class: "row iqama-row" },
          h(
            "div",
            { class: "iqama-top" },
            h("span", { class: "row-label" }, t(p)),
            segmented(
              mode,
              [
                { value: "off", label: t("off") },
                { value: "offset", label: t("offset") },
                { value: "fixed", label: t("fixed") },
              ],
              (v) => {
                if (v === "off") draft.iqama[p] = null;
                else if (v === "offset") draft.iqama[p] = { ...(DEFAULT_IQAMA[p]) };
                else {
                  // Seed the fixed time from today's computed iqama so it's a sensible starting point.
                  let time = "13:30";
                  if (hasLoc()) {
                    const row = scheduleFor(draft, draft.calc, todayYmd(draft.tz)).rows.find((r) => r.key === p || (p === "dhuhr" && r.key === "jumuah"));
                    const at = row?.iqama?.at || row?.adhan;
                    if (at) time = formatTime(at, draft.tz, { hour12: false, locale: "en-GB" });
                  }
                  draft.iqama[p] = { mode: "fixed", time };
                }
                renderIqama();
                renderPreview();
              },
              t(p)
            )
          ),
          mode !== "off" ? detail : null
        );
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
              u: Math.floor(Date.now() / 1000),
            };
            ctx.addPlace(place, { activate: true });
            sheet.close();
            setTimeout(() => openShareSheet(ctx, place), 260);
          },
        },
        t("save")
      ),
    ],
  });

  function fail(msg, focusEl) {
    err.textContent = msg;
    err.hidden = false;
    err.scrollIntoView({ behavior: "smooth", block: "center" });
    focusEl?.focus();
  }

  renderLoc();
  renderIqama();
  renderJumuah();
  renderPreview();
  if (!existing) setTimeout(() => nameInput.focus(), 300);
  return sheet;
}

// --- Share --------------------------------------------------------------------------------
export async function openShareSheet(ctx, place) {
  const seed = await placeToSeed(place);
  const url = seedUrl(seed);
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const qrBox = h("div", { class: "qr-box", html: qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: t("qr") }) });
  const copyBtn = (text, label) =>
    h(
      "button",
      {
        class: "btn btn-tinted btn-sm",
        type: "button",
        onclick: async (e) => {
          const ok = await copyText(text);
          const b = e.currentTarget;
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
    title: t("shareMasjid"),
    content: [
      h(
        "div",
        { class: "share-hero" },
        qrBox,
        h("div", { class: "share-name" }, place.name),
        place.sub ? h("div", { class: "share-sub" }, place.sub) : null,
        h("div", { class: "share-scan" }, t("scanToOpen"))
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
        ctx.openDisplay ? h("button", { class: "btn btn-tinted btn-sm", type: "button", onclick: () => { sheet.close(); ctx.openDisplay(place, seed); } }, icon("tv"), t("tvMode")) : null
      ),
      h("h3", { class: "list-title" }, t("seed")),
      h("div", { class: "form-card" }, h("code", { class: "seed-code" }, seed), h("div", { class: "btn-row" }, copyBtn(seed, t("copy")))),
      h("p", { class: "list-foot" }, t("seedHint")),
      h("p", { class: "list-foot" }, t("seedUpdateHint")),
    ],
  });
  return sheet;
}

// --- Open a seed --------------------------------------------------------------------------
export function openSeedInput(ctx) {
  const input = h("textarea", { class: "input", rows: 3, placeholder: t("openSeedPh"), "aria-label": t("openSeed"), autocapitalize: "off", autocorrect: "off", spellcheck: false });
  const err = h("p", { class: "form-error", hidden: true });
  const sheet = openSheet({
    title: t("openSeed"),
    content: [input, err],
    actions: h(
      "button",
      {
        class: "btn btn-primary btn-block",
        type: "button",
        onclick: async () => {
          const ok = await importSeed(ctx, input.value);
          if (ok) sheet.close();
          else {
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

export async function importSeed(ctx, text) {
  let parsed;
  try {
    parsed = await parseSeed(text);
  } catch {
    return false;
  }
  if (parsed.kind === "backup") return ctx.restoreBackup ? ctx.restoreBackup(parsed) : false;
  const incoming = parsed.place;
  const existing = incoming.id ? ctx.state.places.find((p) => p.id === incoming.id) : null;
  if (existing && (existing.u || 0) > (incoming.u || 0)) {
    // This link is older than what we already have — keep ours, just open it.
    ctx.activate(existing.id);
    return true;
  }
  const place = { ...incoming, id: incoming.id || newId() };
  ctx.addPlace(place, { activate: true });
  return true;
}

// --- Plugin wiring ----------------------------------------------------------------------------
export const masjidPlugin = {
  ctx: () => ({
    shareMasjid: (p) => openShareSheet(currentCtx(), p),
    editMasjid: (p) => openMasjidEditor(currentCtx(), p),
    extraPlaceActions: (sheet) => [
      h("button", { class: "btn btn-plain", type: "button", onclick: () => { sheet.close(); openMasjidEditor(currentCtx()); } }, icon("mosque"), t("addMasjid")),
      h("button", { class: "btn btn-plain", type: "button", onclick: () => { sheet.close(); openSeedInput(currentCtx()); } }, icon("link"), t("openSeed")),
    ],
  }),
  topbarActions: (ctx) =>
    ctx.place && ctx.place.id !== "gps"
      ? [
          h(
            "button",
            {
              class: "icon-btn",
              type: "button",
              "aria-label": t("share"),
              onclick: () => openShareSheet(ctx, ctx.place),
            },
            icon("share")
          ),
        ]
      : [],
  onboardingActions: (ctx) => [h("button", { class: "btn btn-plain", type: "button", onclick: () => openSeedInput(ctx) }, icon("link"), t("openSeed"))],
  handleHash(name, arg, ctx) {
    if (name !== "m" || !arg) return false;
    importSeed(ctx, arg).then((ok) => {
      if (!ok) toast(t("invalidSeed"), { tone: "warn" });
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
