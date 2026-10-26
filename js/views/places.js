import { searchPlaces, timezoneFor, reverseGeocode } from "../geo.js";
import { t, lang } from "../i18n.js";
import { h, icon, openSheet, debounce, select } from "../ui.js";
import { allTimeZones } from "../time.js";
import { newId } from "../store.js";

export function openPlacesSheet(ctx, { focusSearch = false } = {}) {
  const input = h("input", {
    class: "search-input",
    type: "search",
    placeholder: t("searchPlaceholder"),
    "aria-label": t("searchCity"),
    autocomplete: "off",
    enterkeyhint: "search",
    autofocus: true,
  });
  const results = h("div", { class: "list search-results", hidden: true });
  const savedWrap = h("div");
  const sheet = openSheet({
    title: t("places"),
    content: [
      h("div", { class: "search-field" }, icon("search"), input),
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
      savedWrap.hidden = false;
      return;
    }
    results.hidden = false;
    savedWrap.hidden = true;
    results.replaceChildren(h("div", { class: "row row-muted" }, h("span", { class: "spinner" }), t("searchCity") + "…"));
    try {
      const found = await searchPlaces(q, lang());
      if (mine !== seq) return;
      results.replaceChildren();
      if (!found.length) results.append(h("div", { class: "row row-muted" }, t("noResults")));
      for (const f of found) {
        results.append(
          h(
            "button",
            {
              class: "row row-btn",
              type: "button",
              onclick: () => {
                const place = { id: newId(), kind: "city", ...f };
                ctx.addPlace(place, { activate: true });
                sheet.close();
              },
            },
            icon("pin", "row-icon"),
            h("span", { class: "row-main" }, h("span", { class: "row-title" }, f.name), h("span", { class: "row-sub" }, f.sub))
          )
        );
      }
    } catch {
      if (mine !== seq) return;
      results.replaceChildren(h("div", { class: "row row-muted" }, t("searchOffline")));
    }
  }, 280);
  input.addEventListener("input", run);

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
          h("span", { class: "row-sub" }, gps?.name ? [gps.name, gps.sub].filter(Boolean).join(", ") : t("useMyLocation"))
        ),
        st.activeId === "gps" ? icon("check", "row-check") : null
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
              h("span", { class: "row-sub" }, p.kind === "masjid" ? [t("masjid"), p.sub].filter(Boolean).join(" · ") : p.sub || p.tz)
            ),
            active ? icon("check", "row-check") : null
          ),
          h(
            "button",
            {
              class: "icon-btn row-more",
              type: "button",
              "aria-label": `${t("edit")} ${p.name}`,
              onclick: (e) => placeMenu(ctx, p, e.currentTarget, () => renderSaved(), sheet),
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
        { class: "sheet-actions" },
        ctx.extraPlaceActions ? ctx.extraPlaceActions(sheet) : null,
        h("button", { class: "btn btn-plain", type: "button", onclick: () => coordsForm(ctx, sheet) }, icon("globe"), t("enterCoords"))
      )
    );
  }
  renderSaved();
  if (focusSearch) setTimeout(() => input.focus(), 250);
  return sheet;
}

function placeMenu(ctx, p, anchor, rerender, parentSheet) {
  const items = [];
  if (p.kind === "masjid" && ctx.shareMasjid) {
    items.push(h("button", { class: "row row-btn", type: "button", onclick: () => { menu.close(); parentSheet.close(); ctx.shareMasjid(p); } }, icon("share", "row-icon"), t("share")));
  }
  if (p.kind === "masjid" && ctx.editMasjid) {
    items.push(h("button", { class: "row row-btn", type: "button", onclick: () => { menu.close(); parentSheet.close(); ctx.editMasjid(p); } }, icon("edit", "row-icon"), t("edit")));
  }
  items.push(
    h(
      "button",
      { class: "row row-btn tone-danger", type: "button", onclick: () => { menu.close(); ctx.removePlace(p.id); rerender(); } },
      icon("trash", "row-icon"),
      t("remove")
    )
  );
  const menu = openSheet({ title: p.name, content: h("div", { class: "list" }, items) });
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
