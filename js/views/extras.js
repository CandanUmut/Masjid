// Phase-3 features wired in as a plugin: Month, Qibla, Display mode, reminders, install/offline, backup.
import { scheduleFor } from "../engine.js";
import { addDays, todayYmd } from "../time.js";
import { t } from "../i18n.js";
import { h, icon, openSheet, select, toggle, toast, copyText } from "../ui.js";
import { normalizeCalc } from "../engine.js";
import { backupToSeed } from "../seed.js";
import { DEFAULT_SETTINGS } from "../store.js";
import { MonthView } from "./month.js";
import { QiblaView } from "./qibla.js";
import { TvView } from "./tv.js";
import { row } from "./calc-editor.js";
import { importSeed, openSeedInput } from "./masjid.js";

let getCtx = null;
export function setExtrasCtx(fn) {
  getCtx = fn;
}

// --- Reminders ---------------------------------------------------------------------------
// Browsers can't schedule notifications for a closed web app, so we check every second while
// the app is open (or installed and alive) and fire when an event time is reached.
const FIRED_KEY = "masjid.fired.v1";
let fired = new Set();
try {
  fired = new Set(JSON.parse(sessionStorage.getItem(FIRED_KEY)) || []);
} catch {
  /* ignore */
}

function reminderEvents(ctx) {
  const n = ctx.settings.notify;
  const place = ctx.place;
  const base = todayYmd(place.tz);
  const out = [];
  for (const ymd of [base, addDays(base, 1)]) {
    const s = scheduleFor(place, ctx.calc, ymd);
    for (const r of s.rows) {
      if (!r.isPrayer || !r.adhan) continue;
      const id = `${place.id}|${ymd.y}-${ymd.m}-${ymd.d}|${r.key}`;
      out.push({ id: `${id}|at`, at: r.adhan.getTime(), title: t("notifyAtTime", { p: t(r.key) }), body: `${place.name} · ${ctx.fmt(r.adhan)}${r.iqama ? ` · ${t("iqamaAt", { t: ctx.fmt(r.iqama.at) })}` : ""}` });
      if (n.before > 0) out.push({ id: `${id}|pre`, at: r.adhan.getTime() - n.before * 60000, title: t("notifyBeforeText", { p: t(r.key), m: n.before }), body: `${place.name} · ${ctx.fmt(r.adhan)}` });
      if (n.iqama && r.iqama) out.push({ id: `${id}|iq`, at: r.iqama.at.getTime() - 5 * 60000, title: t("iqamaIn", { t: `5 ${t("min")}` }), body: `${t(r.key)} · ${place.name} · ${ctx.fmt(r.iqama.at)}` });
    }
  }
  return out;
}

async function notify(ev) {
  const opts = { body: ev.body, tag: ev.id, icon: "./assets/icons/icon-192.png", badge: "./assets/icons/favicon-32.png", renotify: false };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return reg.showNotification(ev.title, opts);
  } catch {
    /* fall back */
  }
  try {
    new Notification(ev.title, opts);
  } catch {
    /* unsupported */
  }
}

let cache = { key: "", events: [] };
function checkReminders() {
  const ctx = getCtx?.();
  if (!ctx?.place || !ctx.settings.notify.enabled) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const key = `${ctx.place.id}|${JSON.stringify(todayYmd(ctx.place.tz))}|${JSON.stringify(ctx.settings.notify)}|${ctx.locale}`;
  if (cache.key !== key) cache = { key, events: reminderEvents(ctx) };
  const now = Date.now();
  for (const ev of cache.events) {
    if (now >= ev.at && now - ev.at < 3 * 60000 && !fired.has(ev.id)) {
      fired.add(ev.id);
      try {
        sessionStorage.setItem(FIRED_KEY, JSON.stringify([...fired].slice(-50)));
      } catch {
        /* ignore */
      }
      notify(ev);
    }
  }
}

// --- PWA: service worker, updates and install ----------------------------------------------------
let installPrompt = null;
function setupPwa() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPrompt = e;
  });
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker
    .register("./sw.js")
    .then((reg) => {
      const offerUpdate = (worker) =>
        toast(t("updateReady"), {
          action: t("reload"),
          duration: 15000,
          onAction: () => worker.postMessage({ type: "SKIP_WAITING" }),
        });
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w?.addEventListener("statechange", () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) offerUpdate(w);
        });
      });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    })
    .catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

// --- Settings sections -------------------------------------------------------------------------
function settingsSections(ctx) {
  const n = ctx.settings.notify;
  const supported = typeof Notification !== "undefined";
  const blocked = supported && Notification.permission === "denied";
  const notifyList = h(
    "div",
    { class: "list" },
    row(
      t("notifyEnable"),
      toggle(n.enabled && supported && !blocked, async (v) => {
        if (v && supported && Notification.permission !== "granted") {
          const res = await Notification.requestPermission().catch(() => "denied");
          if (res !== "granted") {
            toast(t("notifyDenied"), { tone: "warn" });
            ctx.update((s) => (s.settings.notify.enabled = false));
            return;
          }
        }
        ctx.update((s) => (s.settings.notify.enabled = v), { render: false });
      }, t("notifyEnable"))
    ),
    row(
      t("notifyBefore"),
      select(
        n.before,
        [0, 5, 10, 15, 20, 30].map((m) => ({ value: m, label: m ? `${m} ${t("min")}` : t("off") })),
        (v) => ctx.update((s) => (s.settings.notify.before = Number(v)), { render: false }),
        { "aria-label": t("notifyBefore") }
      )
    ),
    row(t("notifyIqama"), toggle(n.iqama, (v) => ctx.update((s) => (s.settings.notify.iqama = v), { render: false }), t("notifyIqama")))
  );
  const sections = [
    h("h3", { class: "list-title" }, t("notifications")),
    notifyList,
    h("p", { class: "list-foot" }, !supported || blocked ? t("notifyDenied") + " " : "", t("notifyHint"), " ", h("a", { href: "#/month" }, t("exportCal"))),
  ];

  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (!standalone) {
    sections.push(
      h("h3", { class: "list-title" }, t("install")),
      h(
        "div",
        { class: "list" },
        h(
          "button",
          {
            class: "row row-btn",
            type: "button",
            onclick: async () => {
              if (installPrompt) {
                installPrompt.prompt();
                installPrompt = null;
              } else toast(t("installHow"), { duration: 7000 });
            },
          },
          icon("download", "row-icon tone-accent"),
          h("span", { class: "row-main" }, h("span", { class: "row-title" }, t("install")), h("span", { class: "row-sub wrap" }, t("installHint")))
        )
      )
    );
  }

  sections.push(
    h("h3", { class: "list-title" }, t("data")),
    h(
      "div",
      { class: "list" },
      h("button", { class: "row row-btn", type: "button", onclick: () => openBackup(ctx) }, icon("copy", "row-icon"), h("span", { class: "row-title" }, t("exportData"))),
      h("button", { class: "row row-btn", type: "button", onclick: () => openSeedInput(ctx) }, icon("download", "row-icon"), h("span", { class: "row-title" }, t("importData"))),
      h(
        "button",
        {
          class: "row row-btn tone-danger",
          type: "button",
          onclick: () => {
            if (!confirm(t("resetConfirm"))) return;
            try {
              localStorage.clear();
            } catch {
              /* ignore */
            }
            location.hash = "";
            location.reload();
          },
        },
        icon("trash", "row-icon"),
        h("span", { class: "row-title" }, t("resetAll"))
      )
    )
  );
  return sections;
}

async function openBackup(ctx) {
  const seed = await backupToSeed(ctx.state);
  openSheet({
    title: t("exportData"),
    content: [
      h("p", { class: "list-foot", style: { margin: "0 4px 12px" } }, t("backupHint")),
      h("div", { class: "form-card" }, h("code", { class: "seed-code" }, seed)),
    ],
    actions: h(
      "button",
      {
        class: "btn btn-primary btn-block",
        type: "button",
        onclick: async (e) => {
          if (await copyText(seed)) e.currentTarget.textContent = t("copied");
        },
      },
      icon("copy"),
      t("copy")
    ),
  });
}

function restoreBackup(parsed) {
  const ctx = getCtx();
  ctx.update((s) => {
    const st = parsed.settings || {};
    s.settings = {
      ...structuredClone(DEFAULT_SETTINGS),
      ...st,
      extras: { ...DEFAULT_SETTINGS.extras, ...(st.extras || {}) },
      notify: { ...DEFAULT_SETTINGS.notify, ...(st.notify || {}), enabled: false },
      calc: normalizeCalc(st.calc),
    };
    for (const p of parsed.places) {
      if (!p.id) continue;
      if (p.kind === "city" && !p.calc) delete p.calc;
      const i = s.places.findIndex((x) => x.id === p.id);
      if (i >= 0) s.places[i] = p;
      else s.places.push(p);
    }
    if (parsed.activeId && (parsed.activeId === "gps" || s.places.some((p) => p.id === parsed.activeId))) s.activeId = parsed.activeId;
    s.onboarded = true;
  }, { relayout: true });
  toast(t("restoreDone"));
  return true;
}

// --- Plugin -----------------------------------------------------------------------------------
export const extrasPlugin = {
  routes: {
    month: { icon: "calendar", label: "month", view: MonthView, needsPlace: true },
    qibla: { icon: "compass", label: "qibla", view: QiblaView, needsPlace: true },
    tv: { icon: "tv", label: "tvMode", view: TvView, needsPlace: true, chromeless: true, hidden: true },
  },
  ctx: () => ({
    settingsExtras: () => settingsSections(getCtx()),
    restoreBackup,
    openDisplay: (place, seed) => {
      // Open the board in a new tab with the seed so it can be bookmarked on the screen's browser.
      const url = `${location.href.split("#")[0]}#/tv/${seed}`;
      window.open(url, "_blank", "noopener");
    },
  }),
  topbarActions: (ctx) =>
    ctx.place?.kind === "masjid"
      ? [h("a", { class: "icon-btn", href: "#/tv", "aria-label": t("tvMode"), title: t("tvMode") }, icon("tv"))]
      : [],
  handleHash(name, arg, ctx) {
    if (name !== "tv" || !arg) return false;
    // #/tv/<seed>: import (or refresh) the masjid silently, then show the board.
    importSeed({ ...ctx, addPlace: (p, o) => ctx.addPlace(p, { ...o, silent: true }) }, arg).then((ok) => {
      if (!ok) toast(t("invalidSeed"), { tone: "warn" });
      ctx.showRoute("tv");
    });
    return true;
  },
  tick: checkReminders,
  start: setupPwa,
};
