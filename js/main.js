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
    // Follow the device's regional habit when it speaks the app's language (en-GB → 24h, en-US → 12h);
    // otherwise the app language's own convention (Turkish UI → 24h, never "ÖÖ 5:55").
    const loc = String(navigator.language || "").toLowerCase().startsWith(lang()) ? navigator.language : lang();
    return new Intl.DateTimeFormat(loc, { hour: "numeric" }).resolvedOptions().hour12 ?? false;
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
  if (relayout) {
    layout();
    refreshGpsName();
  } else if (doRender) render();
}

function activate(id) {
  update((s) => (s.activeId = id));
}

function addPlace(place, { activate: act = false, silent = false } = {}) {
  // The same city picked twice: just switch to the one we already have.
  if (place.kind === "city") {
    // Only the *same* place twice (same name, same spot) — never swap the user's choice for another.
    const same = (a, b) => String(a || "").toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === String(b || "").toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const dup = state.places.find((p) => p.kind === "city" && p.id !== place.id && distanceKm(p, place) < 2 && same(p.name, place.name));
    if (dup) {
      if (act) activate(dup.id);
      toast(t("alreadySaved", { p: dup.name }));
      return;
    }
  }
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

function removePlace(id, { silent = false } = {}) {
  const idx = state.places.findIndex((p) => p.id === id);
  if (idx < 0) return;
  const removed = state.places[idx];
  const wasActive = state.activeId === id;
  update((s) => {
    s.places.splice(idx, 1);
    if (wasActive) s.activeId = s.places[0]?.id || "gps";
  });
  if (!silent) toast(t("removed", { p: removed.name }), {
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
  if (app.locating) return;
  if (!geoSupported()) {
    app.gpsError = "unsupported";
    if (interactive) toast(t("locationFailed"), { tone: "warn" });
    render();
    return;
  }
  // Only switch to "My location" right away if we have a previous fix to show meanwhile;
  // otherwise keep the current place until a fix actually arrives.
  if (state.gps && state.activeId !== "gps") update((s) => (s.activeId = "gps"));
  app.locating = true;
  app.gpsError = null;
  if (!activePlace()) render();
  else renderTopbar();
  try {
    const pos = await getPosition();
    app.lastGpsAt = Date.now();
    const prev = state.gps;
    const moved = prev ? distanceKm(prev, pos) : Infinity;
    const keepName = Boolean(prev && moved < 3 && prev.name); // no name yet: look it up again
    app.locating = false;
    update((s) => {
      s.gps = { ...pos, name: keepName ? prev.name : "", sub: keepName ? prev.sub : "", cc: keepName ? prev.cc : null, at: Date.now() };
      s.activeId = "gps";
      s.onboarded = true;
    });
    if (!keepName) {
      try {
        const info = await reverseGeocode(pos.lat, pos.lng, lang());
        update((s) => {
          if (s.gps && s.gps.lat === pos.lat && s.gps.lng === pos.lng) Object.assign(s.gps, info, { nameLang: lang() });
        }, { render: state.activeId === "gps" });
        if (prev && moved > 30 && state.activeId === "gps") toast(t("travelling", { p: info.name || t("myLocation") }));
      } catch {
        /* offline: coordinates are enough to compute times */
      }
    }
  } catch (err) {
    app.locating = false;
    app.gpsError = err.code || "error";
    app.flashWarn = interactive; // tapping again must visibly do something
    if (interactive || state.gps) {
      const key = app.gpsError === "denied" ? "locationDenied" : state.gps ? (app.gpsError === "timeout" ? "locationTimeout" : "locationUnavailable") : "locationFailed";
      if (activePlace() || app.gpsError !== "denied") toast(t(key), { tone: "warn", duration: 6000 });
    }
    render();
  } finally {
    app.locating = false;
    renderTopbar();
  }
}

// Place names come back in the UI language; refresh the GPS name when the language changes.
function refreshGpsName() {
  const g = state.gps;
  if (!g || g.nameLang === lang()) return;
  reverseGeocode(g.lat, g.lng, lang())
    .then((info) => update((s) => s.gps && Object.assign(s.gps, info, { nameLang: lang() }), { render: state.activeId === "gps" }))
    .catch(() => {});
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
  document.body.classList.toggle("no-tabbar", nav.hidden);
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

// Under the place name. In another time zone it also says what time it is there, right where the
// eye lands, so a traveller never wonders which clock the prayer times are on.
function topbarSub(place) {
  if (app.locating) return t("locating");
  const isGps = place.id === "gps";
  const base = isGps ? t("located") : place.kind === "masjid" ? place.sub || t("masjid") : place.sub;
  if (place.tz === deviceTimeZone()) return base;
  const now = formatTime(new Date(), place.tz, { hour12: hour12(), locale: lang() });
  return [t("localNow", { t: now }), base].filter(Boolean).join(" · ");
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
  const sub = topbarSub(place);
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

const VERSE = "إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا";

function renderOnboarding() {
  const denied = app.gpsError === "denied";
  const failed = app.gpsError && !denied;
  const unsupported = app.gpsError === "unsupported";
  const arc = "M14 150 Q170 -34 326 150";
  const at = (u) => {
    const x = (1 - u) ** 2 * 14 + 2 * (1 - u) * u * 170 + u * u * 326;
    const y = (1 - u) ** 2 * 150 + 2 * (1 - u) * u * -34 + u * u * 150;
    return `cx="${x.toFixed(1)}" cy="${y.toFixed(1)}"`;
  };
  return h(
    "div",
    { class: "view onboarding" },
    h("div", {
      class: "onb-sky",
      "aria-hidden": "true",
      html: `<svg viewBox="0 0 340 170">
        <line x1="0" y1="150" x2="340" y2="150" class="onb-horizon"/>
        <path d="${arc}" class="onb-arc"/>
        <circle ${at(0)} r="3.5" class="onb-dot"/><circle ${at(0.5)} r="3.5" class="onb-dot"/>
        <circle ${at(0.72)} r="3.5" class="onb-dot"/><circle ${at(1)} r="3.5" class="onb-dot"/>
        <circle r="11" class="onb-sun"><animateMotion dur="12s" repeatCount="indefinite" path="${arc}"/></circle>
      </svg>`,
    }),
    h("div", { class: "onb-brand" }, h("img", { src: "./assets/icons/icon.svg", alt: "", width: 28, height: 28 }), "Ufuq", h("span", { lang: "ar", dir: "rtl" }, "أُفُق")),
    h("h1", { class: "onb-title" }, t("welcomeTitle")),
    h("p", { class: "onb-body" }, t("welcomeBody")),
    denied || failed
      ? h(
          "div",
          { class: `onb-warn ${app.flashWarn ? "is-flash" : ""}`, role: "alert" },
          h("p", {}, t(unsupported || failed ? "locationFailed" : "locationDenied")),
          denied ? h("p", { class: "onb-warn-how" }, t("locationDeniedHow")) : null
        )
      : null,
    h(
      "div",
      { class: "onb-actions" },
      // When location is blocked, searching is the way forward, so it becomes the main button.
      denied ? h("button", { class: "btn btn-primary btn-large", type: "button", onclick: () => openPlacesSheet(makeCtx(), { focusSearch: true }) }, icon("search"), t("searchCity")) : null,
      !unsupported
        ? h(
            "button",
            { class: `btn ${denied ? "btn-tinted" : "btn-primary"} btn-large`, type: "button", disabled: app.locating, onclick: () => useGps({ interactive: true }) },
            app.locating ? h("span", { class: `spinner ${denied ? "" : "spinner--light"}` }) : icon("location"),
            app.locating ? t("locating") : t("allowLocation")
          )
        : null,
      denied ? null : h("button", { class: "btn btn-tinted btn-large", type: "button", onclick: () => openPlacesSheet(makeCtx(), { focusSearch: true }) }, icon("search"), t("searchCity")),
      ...plugins.flatMap((p) => p.onboardingActions?.(makeCtx()) || [])
    ),
    h("p", { class: "onb-privacy" }, icon("lock"), t("privacyNote")),
    h("p", { class: "onb-verse", lang: "ar", dir: "rtl" }, VERSE),
    h("p", { class: "onb-verse-tr" }, lang() === "ar" ? t("verseRef") : `“${t("verse")}” — ${t("verseRef")}`),
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
    $("#tabbar").hidden = true;
    document.body.classList.add("no-tabbar");
    setPhase("dawn");
    return;
  }
  app.view?.destroy?.();
  const v = def.view(ctx);
  app.view = v;
  main.replaceChildren(v.el);
  // New screen, new page: start at the top (re-renders of the same screen keep their place).
  if (app.lastRoute !== app.route) {
    app.lastRoute = app.route;
    window.scrollTo(0, 0);
  }
  const bar = $("#topbar");
  if (bar && !bar.hidden) document.documentElement.style.setProperty("--topbar-h", `${bar.offsetHeight}px`);
  if (!def.needsPlace) setPhase("none");
}

// --- Boot --------------------------------------------------------------------------
function tick() {
  app.view?.tick?.();
  const place = activePlace();
  const subEl = document.querySelector("#topbar .place-chip-sub");
  if (place && subEl && place.tz !== deviceTimeZone()) {
    const text = topbarSub(place);
    if (subEl.textContent !== text) subEl.textContent = text;
  }
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
    // Coming back to the app: bring times up to date (the view handles a new day itself), but never
    // rebuild the screen — that would lose the day being viewed and re-measure mid-scroll.
    if (document.visibilityState === "visible") {
      tick();
      maybeRefreshGps();
    }
  });
  window.addEventListener("storage", (e) => {
    if (e.key && e.key.startsWith("masjid.state")) location.reload();
  });
  window.addEventListener(
    "scroll",
    () => document.body.classList.toggle("is-scrolled", window.scrollY > 8),
    { passive: true }
  );
  window.addEventListener("online", () => document.body.classList.remove("is-offline"));
  window.addEventListener("offline", () => document.body.classList.add("is-offline"));
  if (!navigator.onLine) document.body.classList.add("is-offline");

  // Auto-locate: on first open ask right away (that's what the app is for); later refresh silently.
  const openingSeed = /^#\/?(m|tv)\/./.test(location.hash);
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
