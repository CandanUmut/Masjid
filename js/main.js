import { load, save } from "./store.js";
import { setLang, detectLang, t, lang } from "./i18n.js";
import { h, icon, toast, $ } from "./ui.js";
import { deviceTimeZone, formatTime } from "./time.js";
import { geoPermission, getPosition, reverseGeocode, distanceKm, geoSupported } from "./geo.js";
import { TodayView } from "./views/today.js";
import { SettingsView } from "./views/settings.js";
import { openPlacesSheet } from "./views/places.js";

const state = load();
const app = {
  route: "today",
  view: null,
  locating: false,
  gpsError: null,
  lastGpsAt: 0,
  phase: "night",
};
const plugins = []; // feature modules register routes, place actions and settings sections here

export function registerPlugin(p) {
  plugins.push(p);
}

// --- Context handed to views ------------------------------------------------
function activePlace() {
  if (state.activeId !== "gps") {
    const p = state.places.find((x) => x.id === state.activeId);
    if (p) return p;
  }
  if (!state.gps) return null;
  return {
    id: "gps",
    kind: "gps",
    name: state.gps.name || t("myLocation"),
    sub: state.gps.sub || "",
    lat: state.gps.lat,
    lng: state.gps.lng,
    tz: state.gps.tz || deviceTimeZone(),
    cc: state.gps.cc || null,
  };
}

function hour12() {
  const c = state.settings.clock;
  if (c === "12") return true;
  if (c === "24") return false;
  try {
    return new Intl.DateTimeFormat(navigator.language, { hour: "numeric" }).resolvedOptions().hour12 ?? false;
  } catch {
    return false;
  }
}

export function makeCtx() {
  const place = activePlace();
  const calc = place?.calc || state.settings.calc;
  const locale = lang();
  const h12 = hour12();
  const tz = place?.tz || deviceTimeZone();
  return {
    state,
    settings: state.settings,
    place,
    calc,
    locale,
    deviceTz: deviceTimeZone(),
    fmt: (d) => formatTime(d, tz, { hour12: h12, locale }),
    fmtIn: (d, zone) => formatTime(d, zone, { hour12: h12, locale }),
    hour12: h12,
    update,
    activate,
    addPlace,
    removePlace,
    useGps,
    go,
    showRoute,
    setPhase,
    gpsOrCityPlace: () => place || { lat: 0, lng: 0, tz: deviceTimeZone() },
    openPlaces: (opts) => openPlacesSheet(makeCtx(), opts),
    ...Object.assign({}, ...plugins.map((p) => p.ctx?.() || {})),
  };
}

// --- State mutations ----------------------------------------------------------
function update(fn, { render: doRender = true, relayout = false } = {}) {
  fn(state);
  save(state);
  applyAppearance();
  if (relayout) layout();
  else if (doRender) render();
}

function activate(id) {
  update((s) => (s.activeId = id));
}

function addPlace(place, { activate: act = false, silent = false } = {}) {
  const idx = state.places.findIndex((p) => p.id === place.id);
  const existed = idx >= 0;
  update((s) => {
    if (existed) s.places[idx] = place;
    else s.places.unshift(place);
    if (act) s.activeId = place.id;
    s.onboarded = true;
  });
  if (!silent) toast(t(existed ? "updated" : "added", { p: place.name }));
}

function removePlace(id) {
  const idx = state.places.findIndex((p) => p.id === id);
  if (idx < 0) return;
  const removed = state.places[idx];
  const wasActive = state.activeId === id;
  update((s) => {
    s.places.splice(idx, 1);
    if (wasActive) s.activeId = s.places[0]?.id || "gps";
  });
  toast(t("removed", { p: removed.name }), {
    action: t("undo"),
    onAction: () =>
      update((s) => {
        s.places.splice(idx, 0, removed);
        if (wasActive) s.activeId = id;
      }),
  });
}

// --- Location -------------------------------------------------------------------
async function useGps({ interactive = false } = {}) {
  if (state.activeId !== "gps") update((s) => (s.activeId = "gps"));
  if (app.locating) return;
  if (!geoSupported()) {
    app.gpsError = "unsupported";
    render();
    return;
  }
  app.locating = true;
  app.gpsError = null;
  renderTopbar();
  if (!state.gps) render();
  try {
    const pos = await getPosition();
    app.lastGpsAt = Date.now();
    const prev = state.gps;
    const moved = prev ? distanceKm(prev, pos) : Infinity;
    const keepName = prev && moved < 3;
    update((s) => {
      s.gps = { ...pos, name: keepName ? prev.name : "", sub: keepName ? prev.sub : "", cc: keepName ? prev.cc : null, at: Date.now() };
      s.onboarded = true;
    });
    if (!keepName) {
      try {
        const info = await reverseGeocode(pos.lat, pos.lng, lang());
        update((s) => {
          if (s.gps && s.gps.lat === pos.lat && s.gps.lng === pos.lng) Object.assign(s.gps, info);
        }, { render: state.activeId === "gps" });
        if (prev && moved > 30 && state.activeId === "gps") toast(t("travelling", { p: info.name || t("myLocation") }));
      } catch {
        /* offline: coordinates are enough to compute times */
      }
    }
  } catch (err) {
    app.gpsError = err.code || "error";
    if (interactive || !state.gps) {
      const msg = { denied: "locationDenied", timeout: "locationTimeout" }[app.gpsError] || "locationUnavailable";
      if (state.gps || app.gpsError !== "denied") toast(t(msg), { tone: "warn", duration: 5000 });
    }
    render();
  } finally {
    app.locating = false;
    renderTopbar();
  }
}

async function maybeRefreshGps() {
  if (state.activeId !== "gps" || !state.onboarded) return;
  if (Date.now() - app.lastGpsAt < 10 * 60 * 1000) return;
  const perm = await geoPermission();
  if (perm === "denied") return;
  if (perm === "prompt" && state.gps) return; // don't nag; user can tap "My location"
  useGps();
}

// --- Appearance -------------------------------------------------------------------
function applyAppearance() {
  const s = state.settings;
  setLang(s.lang === "auto" ? detectLang() : s.lang);
  const root = document.documentElement;
  if (s.theme === "auto") root.removeAttribute("data-theme");
  else root.dataset.theme = s.theme;
}

function setPhase(phase) {
  if (app.phase === phase) return;
  app.phase = phase;
  document.documentElement.dataset.phase = phase;
}

// --- Routing & rendering ------------------------------------------------------------
const baseRoutes = {
  today: { icon: "sunHigh", label: "today", view: TodayView, needsPlace: true },
  settings: { icon: "gear", label: "settings", view: SettingsView },
};

function routes() {
  const r = { today: baseRoutes.today };
  for (const p of plugins) Object.assign(r, p.routes || {});
  r.settings = baseRoutes.settings;
  return r;
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [name, ...rest] = raw.split("/");
  return { name: name || "today", arg: rest.join("/") };
}

// Show a route without touching the URL (used when the URL carries data, e.g. #/tv/<seed>).
function showRoute(name) {
  app.route = routes()[name] ? name : "today";
  render();
}

function go(name) {
  if (location.hash !== `#/${name}`) location.hash = `#/${name}`;
  else render();
}

function onHash() {
  const { name, arg } = parseHash();
  for (const p of plugins) {
    if (p.handleHash && p.handleHash(name, arg, makeCtx())) return;
  }
  app.route = routes()[name] ? name : "today";
  render();
}

function layout() {
  const shell = $("#app");
  shell.replaceChildren(
    h("header", { class: "topbar", id: "topbar" }),
    h("main", { class: "main", id: "view", tabindex: "-1" }),
    h("nav", { class: "tabbar", id: "tabbar", "aria-label": "Main" })
  );
  document.title = t("appName");
  render();
}

function renderTabbar() {
  const nav = $("#tabbar");
  if (!nav) return;
  const r = routes();
  nav.hidden = r[app.route]?.chromeless;
  nav.replaceChildren(
    ...Object.entries(r)
      .filter(([, def]) => !def.hidden)
      .map(([name, def]) =>
        h(
          "a",
          { class: `tab ${app.route === name ? "is-active" : ""}`, href: `#/${name}`, "aria-current": app.route === name ? "page" : null },
          icon(def.icon),
          h("span", { class: "tab-label" }, t(def.label))
        )
      )
  );
}

function renderTopbar() {
  const bar = $("#topbar");
  if (!bar) return;
  const def = routes()[app.route];
  const place = activePlace();
  bar.hidden = !def?.needsPlace || !place || def?.chromeless;
  if (bar.hidden) return;
  const isGps = place.id === "gps";
  const label = place.name || t("myLocation");
  const sub = app.locating ? t("locating") : isGps ? t("located") : place.kind === "masjid" ? place.sub || t("masjid") : place.sub;
  const actions = plugins.flatMap((p) => p.topbarActions?.(makeCtx()) || []);
  bar.replaceChildren(
    h(
      "button",
      { class: "place-chip", type: "button", onclick: () => openPlacesSheet(makeCtx()), "aria-label": `${t("places")}: ${label}` },
      icon(isGps ? "location" : place.kind === "masjid" ? "mosque" : "pin", `place-chip-icon ${app.locating ? "is-pulsing" : ""}`),
      h("span", { class: "place-chip-text" }, h("span", { class: "place-chip-name" }, label), h("span", { class: "place-chip-sub" }, sub)),
      icon("chevronDown", "place-chip-caret")
    ),
    h("div", { class: "topbar-actions" }, actions)
  );
}

function renderOnboarding() {
  const denied = app.gpsError === "denied";
  const unsupported = app.gpsError === "unsupported";
  return h(
    "div",
    { class: "view onboarding" },
    h("div", { class: "onb-art", "aria-hidden": "true" }, icon("mosque")),
    h("h1", { class: "onb-title" }, t("welcomeTitle")),
    h("p", { class: "onb-body" }, t("welcomeBody")),
    denied || unsupported ? h("p", { class: "onb-warn" }, t(unsupported ? "locationUnavailable" : "locationDenied")) : null,
    h(
      "div",
      { class: "onb-actions" },
      !unsupported
        ? h(
            "button",
            { class: "btn btn-primary btn-large", type: "button", disabled: app.locating, onclick: () => useGps({ interactive: true }) },
            app.locating ? h("span", { class: "spinner spinner--light" }) : icon("location"),
            app.locating ? t("locating") : t("allowLocation")
          )
        : null,
      h("button", { class: "btn btn-tinted btn-large", type: "button", onclick: () => openPlacesSheet(makeCtx(), { focusSearch: true }) }, icon("search"), t("searchCity")),
      ...plugins.flatMap((p) => p.onboardingActions?.(makeCtx()) || [])
    ),
    h("p", { class: "onb-privacy" }, icon("lock"), t("privacyNote"))
  );
}

function render() {
  const main = $("#view");
  if (!main) return;
  const r = routes();
  const def = r[app.route] || r.today;
  document.body.dataset.route = app.route;
  document.body.classList.toggle("is-chromeless", Boolean(def.chromeless));
  const ctx = makeCtx();
  renderTopbar();
  renderTabbar();
  if (def.needsPlace && !ctx.place) {
    app.view?.destroy?.();
    app.view = null;
    main.replaceChildren(renderOnboarding());
    setPhase("dawn");
    return;
  }
  app.view?.destroy?.();
  const v = def.view(ctx);
  app.view = v;
  main.replaceChildren(v.el);
  if (!def.needsPlace) setPhase("none");
}

// --- Boot --------------------------------------------------------------------------
function tick() {
  app.view?.tick?.();
  for (const p of plugins) p.tick?.();
}

export function start() {
  applyAppearance();
  layout();
  window.addEventListener("hashchange", onHash);
  onHash();
  // Align ticks to the second so the countdown never skips.
  setTimeout(() => {
    tick();
    setInterval(tick, 1000);
  }, 1000 - (Date.now() % 1000));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      render();
      maybeRefreshGps();
    }
  });
  window.addEventListener("storage", (e) => {
    if (e.key && e.key.startsWith("masjid.state")) location.reload();
  });
  window.addEventListener("online", () => document.body.classList.remove("is-offline"));
  window.addEventListener("offline", () => document.body.classList.add("is-offline"));
  if (!navigator.onLine) document.body.classList.add("is-offline");

  // Auto-locate: on first open ask right away (that's what the app is for); later refresh silently.
  const openingSeed = /^#\/?m\//.test(location.hash);
  if (state.activeId === "gps" && !openingSeed) {
    geoPermission().then((perm) => {
      if (perm === "granted" || (!state.gps && perm !== "denied" && !state.onboarded)) useGps();
      else if (perm === "denied" && !state.gps) {
        app.gpsError = "denied";
        render();
      } else maybeRefreshGps();
    });
  }
  for (const p of plugins) p.start?.(makeCtx());
}

export { state, render, update, activePlace };
