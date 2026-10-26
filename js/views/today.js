import { statusAt, scheduleFor, METHODS } from "../engine.js";
import { addDays, formatCountdown, formatDate, formatHijri, todayYmd } from "../time.js";
import { t } from "../i18n.js";
import { h, icon } from "../ui.js";

const ROW_ICONS = {
  imsak: "stars", fajr: "dawn", sunrise: "sunrise", duha: "sun", dhuhr: "sunHigh", jumuah: "mosque",
  asr: "sunLow", maghrib: "sunset", isha: "moon", midnight: "moon", lastThird: "stars",
};

export function phaseOf(key) {
  return { fajr: "dawn", sunrise: "morning", dhuhr: "day", jumuah: "day", asr: "afternoon", maghrib: "sunset", isha: "night" }[key] || "night";
}

export function TodayView(ctx) {
  const { place, calc } = ctx;
  let viewOffset = 0; // days from today for the list
  const root = h("div", { class: "view view-today" });

  const heroEyebrow = h("div", { class: "hero-eyebrow" });
  const heroName = h("div", { class: "hero-name" });
  const heroCount = h("div", { class: "hero-count", role: "timer", "aria-live": "off" });
  const heroSub = h("div", { class: "hero-sub" });
  const heroNow = h("div", { class: "hero-now" });
  const bar = h("span", { class: "hero-bar-fill" });
  const hero = h(
    "section",
    { class: "hero", "aria-label": t("next") },
    h("div", { class: "hero-glow", "aria-hidden": "true" }),
    heroEyebrow,
    heroName,
    heroCount,
    heroSub,
    h("div", { class: "hero-bar", "aria-hidden": "true" }, bar),
    heroNow
  );

  const note = place.note ? h("div", { class: "note-card" }, icon("info"), h("p", {}, place.note)) : null;

  const dateTitle = h("div", { class: "date-title" });
  const dateHijri = h("div", { class: "date-hijri" });
  const backBtn = h("button", { class: "pill-btn", type: "button", hidden: true, onclick: () => setOffset(0) }, t("backToToday"));
  const dateBar = h(
    "div",
    { class: "date-bar" },
    h("button", { class: "icon-btn", type: "button", "aria-label": t("yesterday"), onclick: () => setOffset(viewOffset - 1) }, icon("chevronLeft", "flip-rtl")),
    h("div", { class: "date-text" }, dateTitle, dateHijri),
    h("button", { class: "icon-btn", type: "button", "aria-label": t("tomorrow"), onclick: () => setOffset(viewOffset + 1) }, icon("chevronRight", "flip-rtl"))
  );
  const list = h("div", { class: "list prayer-list", role: "table" });
  const meta = h("p", { class: "foot-meta" });

  root.append(...[hero, note, h("div", { class: "card" }, dateBar, list), backBtn, meta].filter(Boolean));

  let lastStatus = null;
  let lastDayKey = "";

  function setOffset(n) {
    viewOffset = Math.max(-366, Math.min(366, n));
    backBtn.hidden = viewOffset === 0;
    renderList();
  }

  // Swipe left/right on the list to change day.
  let sx = null;
  list.addEventListener("pointerdown", (e) => (sx = e.clientX));
  list.addEventListener("pointerup", (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 60) setOffset(viewOffset + ((dx < 0) !== (document.dir === "rtl") ? 1 : -1));
  });

  function renderList() {
    const base = todayYmd(place.tz);
    const ymd = addDays(base, viewOffset);
    const sched = scheduleFor(place, calc, ymd);
    const isToday = viewOffset === 0;
    dateTitle.textContent = isToday
      ? `${t("today")} · ${formatDate(ymd, ctx.locale, { weekday: "long", day: "numeric", month: "long" })}`
      : formatDate(ymd, ctx.locale, { weekday: "long", day: "numeric", month: "long", year: base.y === ymd.y ? undefined : "numeric" });
    dateHijri.textContent = formatHijri(ymd, ctx.locale, ctx.settings.hijriOffset);

    const hasIqama = Boolean(place.iqama || place.jumuah?.length);
    const now = Date.now();
    const status = lastStatus;
    list.replaceChildren();
    if (hasIqama) {
      list.append(
        h("div", { class: "row row-head", role: "row" },
          h("span", { role: "columnheader" }),
          h("span", { class: "col-time", role: "columnheader" }, t("adhan")),
          h("span", { class: "col-time", role: "columnheader" }, t("iqama")))
      );
    }

    const extras = ctx.settings.extras;
    const rows = [];
    if (extras.imsak && sched.times.imsak) rows.push({ key: "imsak", adhan: sched.times.imsak, extra: true });
    for (const r of sched.rows) {
      if (r.key === "sunrise") {
        if (extras.sunrise) rows.push({ ...r, extra: true });
        if (extras.duha && sched.times.duha) rows.push({ key: "duha", adhan: sched.times.duha, extra: true });
        continue;
      }
      rows.push(r);
    }
    if (extras.midnight && sched.times.midnight) rows.push({ key: "midnight", adhan: sched.times.midnight, extra: true });
    if (extras.lastThird && sched.times.lastThird) rows.push({ key: "lastThird", adhan: sched.times.lastThird, extra: true });

    for (const r of rows) {
      const isCurrent = isToday && status?.current && status.current.day === 0 && status.current.key === r.key && !r.extra;
      const passed = isToday && r.adhan && r.adhan.getTime() <= now && !isCurrent;
      const jumuahExtra = r.jumuah?.length > 1 ? r.jumuah.slice(1).map((d) => ctx.fmt(d)).join(" · ") : "";
      list.append(
        h(
          "div",
          {
            class: `row prayer-row ${r.extra ? "is-extra" : ""} ${isCurrent ? "is-current" : ""} ${passed ? "is-passed" : ""}`,
            role: "row",
            "aria-current": isCurrent ? "time" : null,
          },
          h(
            "span",
            { class: "prayer-name", role: "rowheader" },
            icon(ROW_ICONS[r.key] || "sun", `prayer-icon tone-${phaseOf(r.key)}`),
            h("span", {}, t(r.key), jumuahExtra ? h("small", { class: "row-sub" }, `${t("jumuah")} · ${jumuahExtra}`) : null)
          ),
          h("span", { class: "col-time time-adhan", role: "cell" }, ctx.fmt(r.adhan)),
          hasIqama
            ? h(
                "span",
                { class: `col-time time-iqama ${r.iqama?.clamped ? "is-clamped" : ""}`, role: "cell", title: r.iqama?.clamped ? t("clampedNote") : null },
                r.iqama ? ctx.fmt(r.iqama.at) : r.isPrayer ? "—" : ""
              )
            : null
        )
      );
    }

    const r = sched.resolved;
    const mName = METHODS[r.method]?.name || r.method;
    meta.replaceChildren(
      ...[
        h("span", {}, t("methodNote", { m: mName, a: t(`${r.madhab}Short`) })),
        place.tz !== ctx.deviceTz ? h("span", { class: "tz-chip" }, icon("globe"), `${place.tz.replace(/_/g, " ")} · ${ctx.fmt(new Date())}`) : null,
      ].filter(Boolean)
    );
  }

  function renderHero() {
    const now = new Date();
    const s = statusAt(place, calc, todayYmd(place.tz, now), now);
    lastStatus = s;
    const next = s.next;
    const cur = s.current;
    hero.dataset.phase = phaseOf(cur?.key);

    if (s.pendingIqama) {
      heroEyebrow.textContent = `${t("now")} · ${t(cur.key)}`;
      heroName.textContent = t("iqama");
      heroCount.textContent = formatCountdown(s.pendingIqama - now);
      heroSub.textContent = `${t("adhan")} ${ctx.fmt(cur.adhan)} · ${t("iqama")} ${ctx.fmt(s.pendingIqama)}`;
      const span = s.pendingIqama - cur.adhan;
      bar.style.transform = `scaleX(${span > 0 ? (now - cur.adhan) / span : 1})`;
      heroNow.textContent = "";
    } else if (next) {
      heroEyebrow.textContent = next.day === 1 ? `${t("next")} · ${t("tomorrow")}` : t("next");
      heroName.textContent = t(next.key);
      heroCount.textContent = formatCountdown(next.adhan - now);
      const iq = next.iqama ? ` · ${t("iqamaAt", { t: ctx.fmt(next.iqama.at) })}` : "";
      heroSub.textContent = `${t("adhan")} ${ctx.fmt(next.adhan)}${iq}`;
      bar.style.transform = `scaleX(${s.progress})`;
      if (cur?.key === "sunrise") heroNow.textContent = t("sunriseNote");
      else if (cur) heroNow.textContent = `${t("currentlyTime", { p: t(cur.key) })} · ${ctx.fmt(cur.adhan)}`;
      else heroNow.textContent = "";
    }
    heroCount.setAttribute("aria-label", `${heroName.textContent} ${heroCount.textContent}`);
    ctx.setPhase(hero.dataset.phase);
  }

  function key(s) {
    return s ? `${s.current?.key}|${s.current?.day}|${s.next?.adhan?.getTime()}|${Boolean(s.pendingIqama)}` : "";
  }

  renderHero();
  renderList();
  lastDayKey = JSON.stringify(todayYmd(place.tz));

  return {
    el: root,
    tick() {
      const before = key(lastStatus);
      renderHero();
      const dayKey = JSON.stringify(todayYmd(place.tz));
      if (key(lastStatus) !== before || dayKey !== lastDayKey) {
        lastDayKey = dayKey;
        renderList();
      }
    },
  };
}
