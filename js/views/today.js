// Today: a live sky drawn from the real sun, and the day's prayers as a timeline coloured by that sky.
import { statusAt, scheduleFor, METHODS } from "../engine.js";
import { addDays, formatDate, formatHijri, hijriParts, todayYmd, ymdKey } from "../time.js";
import { sunAltitude, skyColors, moonPhase, moonPath, luminance, mixRgb } from "../astro.js";
import { isPrayed, setPrayed } from "../tracker.js";
import { t, lang } from "../i18n.js";
import { h, icon } from "../ui.js";
import { SkyChart } from "./skychart.js";

export const ARABIC = {
  fajr: "الفجر", sunrise: "الشروق", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء",
  jumuah: "الجمعة", imsak: "الإمساك", duha: "الضحى", midnight: "منتصف الليل", lastThird: "الثلث الأخير",
};
const slot = (key) => (key === "jumuah" ? "dhuhr" : key);

export function phaseOf(key) {
  return { fajr: "dawn", sunrise: "morning", dhuhr: "day", jumuah: "day", asr: "afternoon", maghrib: "sunset", isha: "night" }[key] || "night";
}

// Colour of the sky at a given instant (used for timeline nodes, the hero, Qibla and the TV board).
export function skyAt(place, date) {
  const alt = sunAltitude(date, place.lat, place.lng);
  const later = sunAltitude(new Date(date.getTime() + 30 * 60000), place.lat, place.lng);
  return { alt, ...skyColors(alt, later < alt) };
}

// A countdown that reads as a duration ("1h 23m 45s"), never as a time of day.
export function durationNode(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const unit = (v, u, cls = "") => h("span", { class: `dur-part ${cls}` }, String(v), h("span", { class: "dur-unit" }, t(u)));
  if (hh) return [unit(hh, "uH"), unit(mm, "uM"), unit(ss, "uS", "dur-sec")];
  if (mm) return [unit(mm, "uM"), unit(ss, "uS", "dur-sec")];
  return [unit(ss, "uS")];
}

// Stable pseudo-random stars for a given day.
function stars(seed, n = 46) {
  let s = seed % 2147483647 || 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: n }, () => ({ x: rnd() * 100, y: rnd() * 58, r: 0.4 + rnd() * 1.1, o: 0.35 + rnd() * 0.65 }));
}

export function TodayView(ctx) {
  const { place, calc } = ctx;
  const tracking = ctx.settings.tracker !== false;
  let viewOffset = 0;

  // ---------- Sky hero ----------
  const starLayer = h("div", { class: "sky-stars", "aria-hidden": "true" });
  const moon = h("div", { class: "sky-moon", "aria-hidden": "true" });
  const eyebrow = h("div", { class: "sky-eyebrow" });
  const title = h("div", { class: "sky-title" });
  const count = h("div", { class: "sky-count", role: "timer" });
  const sub = h("div", { class: "sky-sub" });
  const chart = SkyChart(place);
  const hero = h("section", { class: "sky" }, starLayer, moon, h("div", { class: "sky-text" }, eyebrow, title, count, sub), chart.el);

  const note = place.note ? h("div", { class: "note-card" }, icon("info"), h("p", {}, place.note)) : null;

  // ---------- Timeline ----------
  const dateTitle = h("span", { class: "date-title" });
  const dateHijri = h("span", { class: "date-hijri" });
  const dateBtn = h("button", { class: "date-text", type: "button", onclick: () => setOffset(0) }, dateTitle, dateHijri);
  const dateBar = h(
    "div",
    { class: "date-bar" },
    h("button", { class: "icon-btn", type: "button", "aria-label": t("yesterday"), onclick: () => setOffset(viewOffset - 1) }, icon("chevronLeft", "flip-rtl")),
    dateBtn,
    h("button", { class: "icon-btn", type: "button", "aria-label": t("tomorrow"), onclick: () => setOffset(viewOffset + 1) }, icon("chevronRight", "flip-rtl"))
  );
  const list = h("div", { class: "timeline", role: "list" });
  const meta = h("p", { class: "foot-meta" });
  const timelineCard = h("div", { class: "card timeline-card" }, dateBar, list);

  const root = h(
    "div",
    { class: "view view-today" },
    h("div", { class: "today-hero-col" }, ...[hero, note].filter(Boolean)),
    h("div", { class: "today-list-col" }, timelineCard, meta)
  );

  let lastStatus = null;
  let lastDayKey = "";

  function setOffset(n) {
    viewOffset = Math.max(-366, Math.min(366, n));
    renderList();
  }

  let sx = null;
  list.addEventListener("pointerdown", (e) => (sx = e.clientX));
  list.addEventListener("pointerup", (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 60) setOffset(viewOffset + ((dx < 0) !== (document.dir === "rtl") ? 1 : -1));
  });

  function renderSky(now, ymd, s) {
    chart.update(now, { ...s, ymd });
    const sky = skyAt(place, now);
    hero.style.setProperty("--sky-top", sky.top);
    hero.style.setProperty("--sky-horizon", sky.horizon);
    hero.classList.toggle("is-night", sky.night);
    hero.classList.toggle("is-bright", sky.alt > 4);
    const darkness = Math.min(1, Math.max(0, (-sky.alt - 4) / 10));
    starLayer.style.opacity = String(darkness);
    if (!starLayer.childElementCount) {
      for (const st of stars(ymd.y * 400 + ymd.m * 31 + ymd.d)) {
        starLayer.append(h("i", { style: { left: `${st.x}%`, top: `${st.y}%`, width: `${st.r * 2}px`, height: `${st.r * 2}px`, opacity: st.o } }));
      }
    }
    // Moon with its real phase (mirrored in the southern hemisphere).
    if (sky.alt < -2) {
      const ph = moonPhase(now);
      const k = String(Math.round(ph * 100));
      if (moon.dataset.k !== k) {
        moon.dataset.k = k;
        moon.innerHTML = `<svg viewBox="0 0 40 40" style="${place.lat < 0 ? "transform:scaleX(-1)" : ""}"><circle cx="20" cy="20" r="14" class="moon-dark"/><path d="${moonPath(ph, 20, 20, 14)}" class="moon-lit"/></svg>`;
      }
      moon.style.opacity = String(Math.min(1, darkness + 0.35));
    } else if (moon.dataset.k) {
      moon.innerHTML = "";
      moon.dataset.k = "";
    }
    ctx.setPhase(sky.night ? "night" : "day");
  }

  // ---------- Hero text: answers "what do I need to know right now?" ----------
  function renderHero() {
    const now = new Date();
    const ymd = todayYmd(place.tz, now);
    const s = statusAt(place, calc, ymd, now);
    lastStatus = s;
    renderSky(now, ymd, s);
    const cur = s.current;
    const next = s.next;
    const curDay = cur ? addDays(ymd, cur.day) : ymd;
    const ramadan = hijriParts(ymd, ctx.settings.hijriOffset)?.m === 9;
    const curIsPrayer = cur && cur.key !== "sunrise";
    const curPrayed = curIsPrayer && isPrayed(ymdKey(curDay), slot(cur.key));
    const iqAt = (r) => (r?.iqama ? ` · ${t("iqamaAt", { t: ctx.fmt(r.iqama.at) })}` : "");

    let mode = "next";
    if (s.pendingIqama) mode = "iqama";
    else if (tracking && curIsPrayer && !curPrayed && next) mode = "left";
    else if (ramadan && next && (next.key === "maghrib" || next.key === "fajr")) mode = "ramadan";

    let target = mode === "iqama" ? s.pendingIqama : next?.adhan;
    if (mode === "iqama") {
      eyebrow.textContent = t("iqamaStartsIn");
      title.textContent = t(cur.key);
      sub.textContent = `${t("adhan")} ${ctx.fmt(cur.adhan)} · ${t("iqama")} ${ctx.fmt(s.pendingIqama)}`;
    } else if (mode === "left") {
      eyebrow.textContent = t("timeLeftToPray");
      title.textContent = t(cur.key);
      sub.textContent = t("endsAt", { t: ctx.fmt(next.adhan), p: t(next.key) });
      if (ramadan && next.key === "maghrib") sub.textContent += ` · ${t("iftar")} ${ctx.fmt(next.adhan)}`;
      // Isha is valid until Fajr, but best before (Islamic) midnight: count down to that first.
      if (cur.key === "isha") {
        const mid = scheduleFor(place, calc, curDay).times.midnight;
        if (mid && mid > now) {
          target = mid;
          eyebrow.textContent = t("bestBeforeMidnight");
          sub.textContent = t("validUntil", { t: ctx.fmt(next.adhan), p: t(next.key) });
        }
      }
    } else if (mode === "ramadan") {
      eyebrow.textContent = t(next.key === "maghrib" ? "iftarIn" : "suhoorEndsIn");
      title.textContent = t(next.key);
      sub.textContent = `${t("adhan")} ${ctx.fmt(next.adhan)}${iqAt(next)}`;
    } else if (next) {
      const duhaStart = s.today.times.duha;
      eyebrow.textContent =
        next.day === 1
          ? `${t("next")} · ${t("tomorrow")}`
          : cur?.key === "sunrise"
            ? duhaStart && now < duhaStart
              ? t("sunRising", { t: ctx.fmt(duhaStart) })
              : t("duhaNow")
            : t("next");
      title.textContent = t(next.key);
      sub.textContent = `${t("adhan")} ${ctx.fmt(next.adhan)}${iqAt(next)}`;
    }
    const msLeft = target ? target - now : 0;
    hero.classList.toggle("is-urgent", mode === "left" && msLeft < 20 * 60000);
    hero.dataset.mode = mode;
    count.replaceChildren(...durationNode(msLeft));
    count.setAttribute("aria-label", `${eyebrow.textContent} ${title.textContent}: ${count.textContent}`);
  }

  // ---------- Timeline ----------
  function renderList() {
    const base = todayYmd(place.tz);
    const ymd = addDays(base, viewOffset);
    const dayKey = ymdKey(ymd);
    const sched = scheduleFor(place, calc, ymd);
    const isToday = viewOffset === 0;
    dateTitle.textContent = isToday
      ? `${t("today")} · ${formatDate(ymd, ctx.locale, { weekday: "long", day: "numeric", month: "long" })}`
      : formatDate(ymd, ctx.locale, { weekday: "long", day: "numeric", month: "long", year: base.y === ymd.y ? undefined : "numeric" });
    dateHijri.textContent = isToday ? formatHijri(ymd, ctx.locale, ctx.settings.hijriOffset) : `${formatHijri(ymd, ctx.locale, ctx.settings.hijriOffset)} · ${t("backToToday")}`;
    dateBtn.disabled = isToday;
    timelineCard.classList.toggle("is-other-day", !isToday);

    const hasIqama = Boolean(place.iqama || place.jumuah?.length);
    timelineCard.classList.toggle("has-iqama", hasIqama);
    const now = Date.now();
    const status = lastStatus;
    const extras = ctx.settings.extras;
    const rows = [];
    // In Diyanet usage "İmsak" already *is* Fajr, so a second İmsak row would only confuse.
    const diyanetTr = lang() === "tr" && sched.resolved.method === "Turkey";
    if (extras.imsak && sched.times.imsak && !diyanetTr) rows.push({ key: "imsak", adhan: sched.times.imsak, extra: true });
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

    // Each node takes the sky's colour at that moment, plus ink that stays legible on it.
    const paint = (r) => {
      if (!r.adhan) return null;
      const c = skyAt(place, r.adhan);
      const fill = mixRgb(c.top, c.horizon, 0.55);
      return { fill, ink: luminance(fill) > 0.42 ? "#10131f" : "#fff" };
    };
    const colors = rows.map(paint);
    list.replaceChildren();
    if (hasIqama) {
      list.append(h("div", { class: "tl-head", "aria-hidden": "true" }, h("span"), h("span", { class: "tl-time" }, t("adhan")), h("span", { class: "tl-time" }, t("iqama"))));
    }
    rows.forEach((r, i) => {
      const isCurrent = isToday && status?.current?.day === 0 && status.current.key === r.key && !r.extra;
      const passed = (viewOffset < 0 || (isToday && r.adhan && r.adhan.getTime() <= now)) && !isCurrent;
      const future = viewOffset > 0 || (isToday && (!r.adhan || r.adhan.getTime() > now));
      const c = colors[i];
      const nextC = colors.slice(i + 1).find(Boolean) || c;
      const canTrack = tracking && r.isPrayer && !r.extra && !future;
      const done = canTrack && isPrayed(dayKey, slot(r.key));
      const missed = canTrack && passed && !done;
      const label = t(r.key);
      const style = c ? { "--node": c.fill, "--node-next": nextC.fill, "--node-ink": c.ink } : {};

      const node = canTrack
        ? h(
            "button",
            {
              class: `tl-node ${done ? "is-done" : ""}`,
              type: "button",
              "aria-pressed": String(done),
              "aria-label": t("markPrayed", { p: label }),
              onclick: (e) => {
                const btn = e.currentTarget;
                const on = !btn.classList.contains("is-done");
                setPrayed(dayKey, slot(r.key), on);
                btn.classList.toggle("is-done", on);
                btn.setAttribute("aria-pressed", String(on));
                const row = btn.closest(".tl-row");
                row.classList.toggle("is-done", on);
                row.classList.toggle("is-missed", !on && passed);
                if (on) navigator.vibrate?.(8);
                renderHero();
              },
            },
            h("span", { class: "tl-node-dot" }, icon("check"))
          )
        : h("span", { class: `tl-node ${r.extra ? "is-minor" : ""}` }, h("span", { class: "tl-node-dot" }));

      let subText = null;
      if (r.jumuah?.length > 1) subText = `${t("jumuah")} · ${r.jumuah.slice(1).map((d) => ctx.fmt(d)).join(" · ")}`;
      else if (isCurrent && status?.next) subText = t("untilNext", { t: ctx.fmt(status.next.adhan) });
      else if (r.key === "dhuhr" && sched.isFriday) subText = t("jumuah");

      list.append(
        h(
          "div",
          {
            class: `tl-row ${r.extra ? "is-extra" : ""} ${isCurrent ? "is-current" : ""} ${passed ? "is-passed" : ""} ${done ? "is-done" : ""} ${missed ? "is-missed" : ""}`,
            role: "listitem",
            style,
            "aria-current": isCurrent ? "time" : null,
          },
          node,
          h(
            "span",
            { class: "tl-name" },
            h("span", { class: "tl-title" }, h("span", { class: "tl-title-text" }, label), lang() !== "ar" && ARABIC[r.key] && !r.extra ? h("span", { class: "tl-ar", lang: "ar", dir: "rtl" }, ARABIC[r.key]) : null),
            subText ? h("small", { class: "tl-sub" }, subText) : null
          ),
          h("span", { class: "tl-time tl-adhan" }, ctx.fmt(r.adhan)),
          hasIqama
            ? h(
                "span",
                { class: `tl-time tl-iqama ${r.iqama?.clamped ? "is-clamped" : ""}`, title: r.iqama?.clamped ? t("clampedNote") : null },
                r.iqama ? ctx.fmt(r.iqama.at) : ""
              )
            : null
        )
      );
    });

    const r = sched.resolved;
    const mName = METHODS[r.method]?.name || r.method;
    const adjusted = Object.values(r.adj).some(Boolean);
    meta.replaceChildren(
      ...[
        h("a", { href: "#/settings", class: "meta-link" }, t("methodNote", { m: mName, a: t(`${r.madhab}Short`) }) + (adjusted ? ` · ${t("adjusted")}` : "")),
        place.kind === "masjid" && place.u ? h("span", {}, t("updatedOn", { d: new Date(place.u * 1000).toLocaleDateString(ctx.locale, { day: "numeric", month: "short", year: "numeric" }) })) : null,
        place.tz !== ctx.deviceTz ? h("span", { class: "tz-chip" }, icon("globe"), t("localTimeAt", { p: place.tz.split("/").pop().replace(/_/g, " "), t: ctx.fmt(new Date()) })) : null,
      ].filter(Boolean)
    );
  }

  function key(s) {
    return s ? `${s.current?.key}|${s.current?.day}|${s.next?.adhan?.getTime()}|${Boolean(s.pendingIqama)}` : "";
  }

  renderHero();
  renderList();
  lastDayKey = ymdKey(todayYmd(place.tz));

  return {
    el: root,
    tick() {
      const before = key(lastStatus);
      renderHero();
      const dayKey = ymdKey(todayYmd(place.tz));
      if (key(lastStatus) !== before || dayKey !== lastDayKey) {
        lastDayKey = dayKey;
        renderList();
      }
    },
  };
}
