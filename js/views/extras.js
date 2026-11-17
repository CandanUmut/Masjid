// Phase-3 features wired in as a plugin: Month, Qibla, Display mode, reminders, install/offline, backup.
import { formatDate, todayYmd } from "../time.js";
import { reminderEvents as calendarEvents, alertsFor, PRAYER_KEYS, normalizeRemind, normalizeCal } from "../ics.js";
import { openCalendarSheet, calendarEnding, remindSummary } from "./calendar.js";
import { t, tn } from "../i18n.js";
import { h, icon, openSheet, toggle, toast, copyText, confirmSheet } from "../ui.js";
import { normalizeCalc } from "../engine.js";
import { backupToSeed, placeToSeed } from "../seed.js";
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
// the app is open (or installed and alive) and fire when an alert time is reached. The calendar
// file is the dependable way; both follow the same choices (Settings → Reminders).
const FIRED_KEY = "masjid.fired.v1";
let fired = new Set();
try {
  fired = new Set(JSON.parse(sessionStorage.getItem(FIRED_KEY)) || []);
} catch {
  /* ignore */
}

function reminderAlerts(ctx) {
  const place = ctx.place;
  const prefs = ctx.settings.remind;
  const evs = calendarEvents(place, ctx.calc, prefs, { from: todayYmd(place.tz), days: 2, label: (k, v) => t(k, v), hijriOffset: ctx.settings.hijriOffset });
  const out = [];
  for (const ev of evs) {
    const body = [place.name, ctx.fmt(ev.start), ev.iqamaAt ? t("iqamaAt", { t: ctx.fmt(ev.iqamaAt) }) : null].filter(Boolean).join(" · ");
    for (const m of alertsFor(prefs, ev.kind)) {
      const title = m ? tn("notifyIn", m, { p: ev.title, m }) : ev.kind === "adhan" && PRAYER_KEYS.includes(ev.key) ? t("notifyAtTime", { p: t(ev.key) }) : ev.title;
      out.push({ id: `${place.id}|${ev.uid}|${m}`, at: ev.start.getTime() - m * 60000, title, body });
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
  if (!ctx?.place) return;
  nudgeCalendar(ctx);
  if (!ctx.settings.notify.enabled) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const key = `${ctx.place.id}|${JSON.stringify(todayYmd(ctx.place.tz))}|${JSON.stringify(ctx.settings.remind)}|${ctx.locale}`;
  if (cache.key !== key) cache = { key, events: reminderAlerts(ctx) };
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

// Prayer times added to the calendar run out soon (or just did): offer to add the next ones, once per session.
let nudged = false;
function nudgeCalendar(ctx) {
  if (nudged || document.visibilityState !== "visible" || document.querySelector("dialog[open]")) return;
  if (location.hash.startsWith("#/tv")) return;
  nudged = true;
  const end = calendarEnding(ctx.settings, ctx.place);
  if (!end) return;
  setTimeout(() => {
    toast(t(end.ended ? "calExpired" : "calExpiring", { d: formatDate(end.until, ctx.locale, { day: "numeric", month: "long" }) }), {
      action: t("calAddMore"),
      duration: 9000,
      onAction: () => openCalendarSheet(getCtx(), {}),
    });
  }, 2500);
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
      // Look for a new version now and then, and whenever the app comes back to the foreground.
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    })
    .catch(() => {});
  // A new version took over: reload into it, but never while someone is in the middle of something
  // (a sheet or editor open). Not on the very first install either.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let pending = false;
  const reloadWhenQuiet = () => {
    if (document.querySelector("dialog[open]")) return setTimeout(reloadWhenQuiet, 1500);
    location.reload();
  };
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (pending || !hadController) return;
    pending = true;
    reloadWhenQuiet();
  });
}

// --- Settings sections -------------------------------------------------------------------------
function settingsSections(ctx) {
  const n = ctx.settings.notify;
  const supported = typeof Notification !== "undefined";
  const blocked = supported && Notification.permission === "denied";
  const place = ctx.place;
  const sections = [
    h("h3", { class: "list-title" }, t("notifications")),
    // The dependable way first: calendar alerts work with the app closed.
    h(
      "div",
      { class: "list" },
      place
        ? h(
            "button",
            { class: "row row-btn", type: "button", onclick: () => openCalendarSheet(ctx, {}) },
            icon("calendar", "row-icon tone-accent"),
            h("span", { class: "row-main" }, h("span", { class: "row-title" }, t("exportCal")), h("span", { class: "row-sub wrap" }, t("calRowSub"))),
            icon("chevronRight", "row-chevron flip-rtl")
          )
        : null,
      place
        ? h(
            "button",
            { class: "row row-btn", type: "button", onclick: () => openCalendarSheet(ctx, { mode: "notify", onClose: () => ctx.update(() => {}) }) },
            icon("bell", "row-icon"),
            h("span", { class: "row-main" }, h("span", { class: "row-title" }, t("remindPick")), h("span", { class: "row-sub wrap" }, remindSummary(ctx.settings.remind, place))),
            icon("chevronRight", "row-chevron flip-rtl")
          )
        : null,
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
      )
    ),
    h("p", { class: "list-foot" }, !supported || blocked ? t("notifyDenied") + " " : "", t("notifyHint")),
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
      h("button", { class: "row row-btn", type: "button", onclick: () => openSeedInput(ctx, { restore: true }) }, icon("download", "row-icon"), h("span", { class: "row-title" }, t("importData"))),
      h(
        "button",
        {
          class: "row row-btn tone-danger",
          type: "button",
          onclick: async () => {
            if (!(await confirmSheet({ title: t("resetAll"), message: t("resetConfirm"), confirmLabel: t("resetAction"), danger: true }))) return;
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
  const d = new Date();
  const fileName = `ufuq-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.txt`;
  const file = () => new File([seed + "\n"], fileName, { type: "text/plain" });
  const canShareFile = typeof navigator.canShare === "function" && navigator.canShare({ files: [file()] });
  const download = () => {
    const a = h("a", { href: URL.createObjectURL(file()), download: fileName });
    document.body.append(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  };
  openSheet({
    title: t("exportData"),
    subtitle: t("backupHint"),
    content: [
      h("div", { class: "form-card" }, h("code", { class: "seed-code" }, seed)),
      h(
        "div",
        { class: "list list-actions" },
        canShareFile
          ? h("button", { class: "row row-btn", type: "button", onclick: () => navigator.share({ files: [file()], title: fileName }).catch(() => {}) }, icon("share", "row-icon tone-accent"), h("span", { class: "row-title" }, t("shareVia")))
          : null,
        h("button", { class: "row row-btn", type: "button", onclick: download }, icon("download", "row-icon tone-accent"), h("span", { class: "row-title" }, t("saveFile"))),
        h(
          "button",
          {
            class: "row row-btn",
            type: "button",
            onclick: async (e) => {
              const title = e.currentTarget.querySelector(".row-title");
              if (await copyText(seed)) {
                title.textContent = t("copied");
                setTimeout(() => (title.textContent = t("copy")), 1500);
              }
            },
          },
          icon("copy", "row-icon tone-accent"),
          h("span", { class: "row-title" }, t("copy"))
        )
      ),
    ],
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
      notify: { enabled: false },
      remind: normalizeRemind(st.remind, st.notify?.enabled ? st.notify : null),
      // What this device added to its calendar isn't known on another device: start fresh there.
      cal: { ...normalizeCal(st.cal), exports: structuredClone(s.settings.cal?.exports || {}) },
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
    openCalendar: (place, opts = {}) => openCalendarSheet(getCtx(), { place, ...opts }),
    openDisplay: async (place) => {
      // Always the seed URL, so the board can be bookmarked as a screen's start page.
      location.hash = `#/tv/${await placeToSeed(place)}`;
    },
  }),
  handleHash(name, arg, ctx) {
    if (name !== "tv" || !arg) return false;
    // #/tv/<seed>: import (or refresh) the masjid silently, then show the board.
    importSeed(ctx, arg, { silent: true }).then((ok) => {
      if (ok === false) toast(t("invalidSeed"), { tone: "warn" });
      ctx.showRoute("tv");
    });
    return true;
  },
  tick: checkReminders,
  start: setupPwa,
};
