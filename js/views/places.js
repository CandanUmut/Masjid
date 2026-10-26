import { searchPlaces, timezoneFor, reverseGeocode, distanceKm, completePlace } from "../geo.js";
import { t, lang } from "../i18n.js";
import { h, icon, openSheet, debounce, select } from "../ui.js";
import { allTimeZones, todayYmd, formatTime, deviceTimeZone } from "../time.js";
import { statusAt } from "../engine.js";
import { newId } from "../store.js";

export function openPlacesSheet(ctx, { focusSearch = false } = {}) {
  const input = h("input", {
    class: "search-input",
    type: "search",
    placeholder: t("searchPlaceholder"),
    "aria-label": t("searchCity"),
    autocomplete: "off",
    enterkeyhint: "search",
  });
  // Clear (×) button, like a native search field.
  const clearBtn = h("button", { class: "search-clear", type: "button", hidden: true, "aria-label": t("clear"), onclick: () => { input.value = ""; clearBtn.hidden = true; run(); input.focus(); } }, icon("close"));
  const results = h("div", { class: "list search-results", hidden: true });
  const savedWrap = h("div");
  const searchIcon = icon("search");
  const searchSpin = h("span", { class: "spinner search-spinner", hidden: true });
  const sheet = openSheet({
    title: t("places"),
    content: [
      h("div", { class: "search-field" }, searchIcon, searchSpin, input, clearBtn),
      results,
      savedWrap,
    ],
  });

  let seq = 0;
  const run = debounce(async () => {
    const q = input.value.trim();
    const mine = ++seq;
    if (q.length < 2) {
      results.hidden = true;
      results.replaceChildren();
      savedWrap.hidden = false;
      searchIcon.style.display = "";
      searchSpin.hidden = true;
      return;
    }
    results.hidden = false;
    savedWrap.hidden = true;
    // Keep the previous results (dimmed) while the next ones load, so nothing jumps around.
    const loading = (on) => {
      results.classList.toggle("is-loading", on);
      searchIcon.style.display = on ? "none" : "";
      searchSpin.hidden = !on;
    };
    if (!results.querySelector(".row-btn")) results.replaceChildren(h("div", { class: "row row-muted" }, t("searching")));
    loading(true);
    try {
      const found = await searchPlaces(q, lang(), ctx.state.gps || ctx.place);
      if (mine !== seq) return;
      loading(false);
      results.replaceChildren();
      if (!found.length) results.append(h("div", { class: "row row-muted" }, t("noResults")));
      for (const f of found) {
        const row = h(
          "button",
          {
            class: "row row-btn",
            type: "button",
            onclick: async () => {
              // Addresses come without a time zone: look it up before saving (with a visible spinner).
              row.disabled = true;
              const icn = row.querySelector(".row-icon");
              icn?.replaceWith(h("span", { class: "row-icon row-icon-spin" }, h("span", { class: "spinner" })));
              let place;
              try {
                place = await completePlace(f);
              } catch {
                place = { ...f, tz: f.tz || deviceTimeZone() };
              }
              const gps = ctx.state.gps;
              const useHere = () => ctx.addPlace({ id: newId(), kind: "city", name: place.name, sub: place.sub, lat: place.lat, lng: place.lng, tz: place.tz, cc: place.cc }, { activate: true });
              sheet.close();
              if (gps && f.type === "city" && distanceKm(gps, place) < 10) ctx.activate("gps");
              else if (f.type === "mosque" && ctx.createMasjid) setTimeout(() => mosqueChoice(ctx, place, useHere), 240);
              else useHere();
            },
          },
          icon(f.type === "mosque" ? "mosque" : f.type === "address" ? "pin" : "globe", "row-icon"),
          h("span", { class: "row-main" }, h("span", { class: "row-title" }, f.name), h("span", { class: "row-sub" }, f.sub))
        );
        results.append(row);
      }
    } catch {
      if (mine !== seq) return;
      loading(false);
      results.replaceChildren(h("div", { class: "row row-muted" }, t("searchOffline")));
    }
  }, 280);
  // Like iOS: the sheet grows to full height once you start searching, and stays there.
  input.addEventListener("focus", () => sheet.el.classList.add("sheet--search"));
  input.addEventListener("input", () => {
    clearBtn.hidden = !input.value;
    run();
  });
  // Enter picks the first match, like a native search field.
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const first = results.querySelector(".row-btn");
    if (first) first.click();
    else run();
  });

  function renderSaved() {
    const st = ctx.state;
    const gps = st.gps;
    const rows = [];
    rows.push(
      h(
        "button",
        {
          class: `row row-btn ${st.activeId === "gps" ? "is-active" : ""}`,
          type: "button",
          onclick: () => {
            ctx.useGps({ interactive: true });
            sheet.close();
          },
        },
        icon("location", "row-icon tone-accent"),
        h(
          "span",
          { class: "row-main" },
          h("span", { class: "row-title" }, t("myLocation")),
          h("span", { class: "row-sub" }, gps?.name ? [gps.name, gps.sub].filter(Boolean).join(", ") : t("useMyLocation")),
          gps ? glance(ctx, { ...gps, id: "gps" }) : null
        ),
        st.activeId === "gps" ? icon("check", "row-check") : null,
        // Same column as the other rows' "…" button, so the check marks line up.
        st.places.length ? h("span", { class: "row-more-space", "aria-hidden": "true" }) : null
      )
    );
    for (const p of st.places) {
      const active = st.activeId === p.id;
      rows.push(
        h(
          "div",
          { class: `row row-split ${active ? "is-active" : ""}` },
          h(
            "button",
            { class: "row-btn row-btn-inner", type: "button", onclick: () => { ctx.activate(p.id); sheet.close(); } },
            icon(p.kind === "masjid" ? "mosque" : "pin", "row-icon"),
            h(
              "span",
              { class: "row-main" },
              h("span", { class: "row-title" }, p.name),
              h("span", { class: "row-sub" }, p.kind === "masjid" ? [t("masjid"), p.sub].filter(Boolean).join(" · ") : p.sub || p.tz),
              glance(ctx, p)
            ),
            active ? icon("check", "row-check") : null
          ),
          h(
            "button",
            {
              class: "icon-btn row-more",
              type: "button",
              "aria-label": `${t("placeOptions")}: ${p.name}`,
              onclick: () => placeOptions(ctx, p, { closeParent: () => sheet.close(), onRemoved: () => renderSaved() }),
            },
            icon("more")
          )
        )
      );
    }
    savedWrap.replaceChildren(
      h("div", { class: "list" }, rows),
      h(
        "div",
        { class: "list list-actions" },
        ctx.extraPlaceActions ? ctx.extraPlaceActions(sheet) : null,
        h("button", { class: "row row-btn", type: "button", onclick: () => coordsForm(ctx, sheet) }, icon("globe", "row-icon tone-accent"), h("span", { class: "row-title" }, t("enterCoords")))
      )
    );
  }
  renderSaved();
  // With a keyboard and mouse, typing is the next thing; on phones, wait for a tap (no surprise keyboard).
  if (focusSearch || matchMedia("(hover: hover) and (pointer: fine)").matches) setTimeout(() => input.focus(), 250);
  return sheet;
}

// A mosque from search: most people want its iqama times, which only a masjid page has.
function mosqueChoice(ctx, place, useHere) {
  const pick = (fn) => () => {
    sheet.close();
    setTimeout(fn, 240);
  };
  const sheet = openSheet({
    title: place.name,
    subtitle: place.sub,
    content: [
      h(
        "div",
        { class: "list" },
        h(
          "button",
          { class: "row row-btn", type: "button", onclick: pick(() => ctx.createMasjid(place)) },
          icon("mosque", "row-icon tone-accent"),
          h("span", { class: "row-main" }, h("span", { class: "row-title" }, t("addMasjid")), h("span", { class: "row-sub" }, t("mosqueSetupSub"))),
          icon("chevronRight", "row-chevron flip-rtl")
        ),
        h(
          "button",
          { class: "row row-btn", type: "button", onclick: pick(useHere) },
          icon("pin", "row-icon"),
          h("span", { class: "row-main" }, h("span", { class: "row-title" }, t("justTimesHere")), h("span", { class: "row-sub" }, t("justTimesHereSub")))
        )
      ),
    ],
  });
}

// At a glance: the next prayer at that place, and its local time when it's in another time zone.
function glance(ctx, p) {
  try {
    const now = new Date();
    const s = statusAt(p, p.calc || ctx.settings.calc, todayYmd(p.tz, now), now);
    if (!s.next) return null;
    const fmt = (d) => formatTime(d, p.tz, { hour12: ctx.hour12, locale: ctx.locale });
    return h(
      "span",
      { class: "row-glance" },
      `${t(s.next.key)} ${fmt(s.next.adhan)}`,
      h("span", { class: "row-glance-in" }, ` · ${t("inDur", { t: humanDuration(s.next.adhan - now) })}`),
      p.tz !== ctx.deviceTz ? h("span", { class: "row-glance-in" }, ` · ${t("localNow", { t: fmt(now) })}`) : null
    );
  } catch {
    return null;
  }
}

export function humanDuration(ms) {
  const mins = Math.max(1, Math.round(ms / 60000));
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return hh ? `${hh} ${t("hShort")} ${mm} ${t("min")}` : `${mm} ${t("min")}`;
}

// One menu for a saved place, wherever it's opened from (Places list or the "…" in the top bar).
export function placeOptions(ctx, place, { closeParent, onRemoved } = {}) {
  const isMasjid = place.kind === "masjid";
  const item = (ic, label, fn, { cls = "", keepParent = false } = {}) =>
    h(
      "button",
      { class: `row row-btn ${cls}`, type: "button", onclick: () => { sheet.close(); if (!keepParent) closeParent?.(); setTimeout(fn, 240); } },
      icon(ic, "row-icon"),
      h("span", { class: "row-title" }, label)
    );
  const sheet = openSheet({
    title: place.name,
    content: h(
      "div",
      { class: "list" },
      isMasjid && ctx.editMasjid ? item("edit", place.fromLink ? t("editCopy") : t("editMasjid"), () => ctx.editMasjid(place)) : null,
      !isMasjid ? item("edit", t("rename"), () => renamePlace(ctx, place)) : null,
      ctx.shareMasjid ? item("share", t("share"), () => ctx.shareMasjid(place)) : null,
      isMasjid && ctx.openDisplay ? item("tv", t("tvMode"), () => ctx.openDisplay(place)) : null,
      item("trash", isMasjid ? t("removeMasjid") : t("remove"), () => { ctx.removePlace(place.id); onRemoved?.(); }, { cls: "tone-danger", keepParent: true })
    ),
  });
  return sheet;
}

function renamePlace(ctx, place) {
  const input = h("input", { class: "input", type: "text", value: place.name, "aria-label": t("masjidName"), autocomplete: "off", enterkeyhint: "done" });
  const save = () => {
    const name = input.value.trim();
    if (name && name !== place.name) ctx.addPlace({ ...place, name }, { silent: true });
    sheet.forceClose();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
  });
  const sheet = openSheet({
    title: t("rename"),
    content: [h("label", { class: "field" }, h("span", {}, t("masjidName")), input), place.sub ? h("p", { class: "list-foot" }, place.sub) : null],
    actions: h("button", { class: "btn btn-primary btn-block", type: "button", onclick: save }, t("save")),
  });
  setTimeout(() => {
    input.focus();
    input.select();
  }, 250);
}

function coordsForm(ctx, parentSheet) {
  const lat = h("input", { class: "input", type: "text", inputmode: "decimal", placeholder: "21.4225", "aria-label": t("latitude") });
  const lng = h("input", { class: "input", type: "text", inputmode: "decimal", placeholder: "39.8262", "aria-label": t("longitude") });
  const name = h("input", { class: "input", type: "text", placeholder: t("addressPh"), "aria-label": t("masjidName") });
  const err = h("p", { class: "form-error", hidden: true });
  // Time zone comes from the coordinates (never the device). Offline we can only guess, so we ask.
  let tz = null;
  const tzWrap = h("label", { class: "field", hidden: true });
  const goBtn = h("button", { class: "btn btn-primary btn-block", type: "button", onclick: submit }, t("go"));

  async function submit() {
    const la = Number(String(lat.value).replace(",", "."));
    const lo = Number(String(lng.value).replace(",", "."));
    if (lat.value === "" || lng.value === "" || !Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
      err.textContent = t("invalidCoords");
      err.hidden = false;
      return;
    }
    err.hidden = true;
    if (!tz) {
      goBtn.disabled = true;
      goBtn.replaceChildren(h("span", { class: "spinner spinner--light" }), t("timezone") + "…");
      const res = await timezoneFor(la, lo);
      goBtn.disabled = false;
      goBtn.replaceChildren(t("go"));
      tz = res.tz;
      if (res.approximate) {
        // Let the user confirm the guess before we compute anything with it.
        tzWrap.replaceChildren(
          h("span", {}, t("timezone")),
          select(tz, [{ value: tz, label: `${tz} (${t("approximate")})` }].concat(allTimeZones().map((z) => ({ value: z, label: z.replace(/_/g, " ") }))), (v) => (tz = v)),
          h("small", { class: "field-hint" }, t("tzConfirm"))
        );
        tzWrap.hidden = false;
        return;
      }
    }
    let info = { name: "", sub: "", cc: null };
    try {
      info = await reverseGeocode(la, lo, lang());
    } catch {
      /* offline: fine */
    }
    ctx.addPlace(
      { id: newId(), kind: "city", name: name.value.trim() || info.name || `${la.toFixed(3)}, ${lo.toFixed(3)}`, sub: info.sub || tz.replace(/_/g, " "), lat: la, lng: lo, tz, cc: info.cc },
      { activate: true }
    );
    sheet.close();
    parentSheet.close();
  }
  const reset = () => {
    tz = null;
    tzWrap.hidden = true;
  };
  lat.addEventListener("input", reset);
  lng.addEventListener("input", reset);

  const sheet = openSheet({
    title: t("enterCoords"),
    content: [
      h("div", { class: "form-grid" },
        h("label", { class: "field" }, h("span", {}, t("latitude")), lat),
        h("label", { class: "field" }, h("span", {}, t("longitude")), lng)),
      h("label", { class: "field" }, h("span", {}, t("masjidName")), name),
      tzWrap,
      err,
    ],
    actions: goBtn,
  });
}
