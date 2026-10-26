// A short feature tour: five swipeable cards, each with a small illustration drawn in the app's own
// style. Shown once (after the first place is set, or on the next visit for people who never saw it),
// and any time from Settings → Take the tour.
import { t } from "../i18n.js";
import { h, icon } from "../ui.js";

// --- Illustrations (pure markup, no images) -------------------------------------------------------
function artSky() {
  return h(
    "div",
    {
      class: "tour-art tour-art--sky",
      html: `<svg viewBox="0 0 300 150" aria-hidden="true">
        <line x1="0" y1="112" x2="300" y2="112" class="ta-horizon"/>
        <path d="M18 128 Q150 -6 282 128" class="ta-arc"/>
        <circle cx="70" cy="74" r="4" class="ta-mark"/><circle cx="150" cy="61" r="4" class="ta-mark"/><circle cx="214" cy="80" r="4" class="ta-mark"/>
        <circle cx="112" cy="64" r="15" class="ta-sun-glow"/><circle cx="112" cy="64" r="9" class="ta-sun"/>
      </svg>`,
    },
    h("div", { class: "ta-sky-text" }, h("span", { class: "ta-eyebrow" }, t("nextPrayer")), h("strong", {}, t("asr")), h("span", { class: "ta-count" }, "1", h("small", {}, t("uH")), " 24", h("small", {}, t("uM"))))
  );
}

function artTimeline() {
  const row = (key, time, cls = "") => h("div", { class: `ta-row ${cls}` }, h("span", { class: "ta-node" }), h("span", { class: "ta-name" }, t(key)), h("span", { class: "ta-time" }, time));
  return h(
    "div",
    { class: "tour-art tour-art--card" },
    h("div", { class: "ta-datebar" }, h("span", { class: "ta-chev" }, "‹"), h("span", {}, t("today")), h("span", { class: "ta-chev" }, "›")),
    row("dhuhr", "12:53", "is-passed"),
    row("asr", "3:46", "is-current"),
    row("maghrib", "6:15"),
    row("isha", "7:35")
  );
}

function artPlaces() {
  return h(
    "div",
    { class: "tour-art tour-art--card" },
    h("div", { class: "ta-chip" }, icon("location", "ta-chip-icon"), h("span", {}, h("strong", {}, t("myLocation")), h("small", {}, t("located"))), icon("chevronDown")),
    h("div", { class: "ta-search" }, icon("search"), h("span", {}, t("searchPlaceholder"))),
    h("div", { class: "ta-result" }, icon("mosque", "ta-result-icon"), h("span", {}, "Masjid Al-Noor")),
    h("div", { class: "ta-result" }, icon("pin", "ta-result-icon is-muted"), h("span", {}, "Istanbul"))
  );
}

function artMasjid() {
  // A stylised QR code: three finder squares and a deterministic dot pattern.
  const cells = [];
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (((x * 7 + y * 5 + x * y) % 3 === 0) && !((x < 3 && y < 3) || (x > 5 && y < 3) || (x < 3 && y > 5))) cells.push(`<rect x="${x * 10}" y="${y * 10}" width="8" height="8" rx="2"/>`);
  const finder = (x, y) => `<rect x="${x}" y="${y}" width="28" height="28" rx="6" class="qf"/><rect x="${x + 7}" y="${y + 7}" width="14" height="14" rx="3"/>`;
  return h(
    "div",
    { class: "tour-art tour-art--masjid" },
    h("div", { class: "ta-qr", html: `<svg viewBox="-4 -4 96 96" aria-hidden="true">${finder(0, 0)}${finder(60, 0)}${finder(0, 60)}${cells.join("")}</svg>` }),
    h(
      "div",
      { class: "ta-masjid" },
      h("div", { class: "ta-masjid-name" }, icon("mosque"), "Masjid Al-Noor"),
      h("div", { class: "ta-pill" }, `${t("iqama")} 1:15`),
      h("div", { class: "ta-pill is-soft" }, `${t("jumuah")} 1:30`),
      h("div", { class: "ta-share" }, icon("share"), t("share"))
    )
  );
}

function artQibla() {
  return h(
    "div",
    {
      class: "tour-art tour-art--sky tour-art--qibla",
      html: `<svg viewBox="0 0 300 150" aria-hidden="true">
        <circle cx="150" cy="75" r="58" class="ta-dial"/>
        <text x="150" y="31" class="ta-n" text-anchor="middle" dominant-baseline="central">N</text>
        <g transform="rotate(151 150 75)"><line x1="150" y1="75" x2="150" y2="33" class="ta-needle"/><rect x="143" y="20" width="14" height="14" rx="3" class="ta-kaaba"/></g>
        <circle cx="105" cy="118" r="7" class="ta-sun"/>
      </svg>`,
    },
    h("div", { class: "ta-bell" }, icon("bell"))
  );
}

const SLIDES = [
  { art: artSky, title: "tour1Title", body: "tour1Body" },
  { art: artTimeline, title: "tour2Title", body: "tour2Body" },
  { art: artPlaces, title: "tour3Title", body: "tour3Body" },
  { art: artMasjid, title: "tour4Title", body: "tour4Body" },
  { art: artQibla, title: "tour5Title", body: "tour5Body" },
];

let open = false;
export function tourIsOpen() {
  return open;
}

export function openTour({ onDone } = {}) {
  if (open) return;
  open = true;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const slides = SLIDES.map((s, i) =>
    h(
      "section",
      { class: "tour-slide", "aria-roledescription": "slide", "aria-label": `${i + 1} / ${SLIDES.length}` },
      s.art(),
      h("h2", { class: "tour-title" }, t(s.title)),
      h("p", { class: "tour-body" }, t(s.body))
    )
  );
  const track = h("div", { class: "tour-track" }, slides);
  const dots = h("div", { class: "tour-dots", "aria-hidden": "true" }, slides.map(() => h("span", { class: "tour-dot" })));
  const nextBtn = h("button", { class: "btn btn-primary tour-next", type: "button", onclick: () => (index === slides.length - 1 ? finish() : go(index + 1)) });
  const skipBtn = h("button", { class: "btn btn-plain tour-skip", type: "button", onclick: () => finish() }, t("tourSkip"));
  const dlg = h(
    "dialog",
    { class: "tour", "aria-label": t("tourTitle") },
    h("div", { class: "tour-top" }, h("span", { class: "tour-kicker" }, t("tourTitle")), skipBtn),
    track,
    h("div", { class: "tour-bottom" }, dots, nextBtn)
  );

  let index = 0;
  const rtl = () => document.documentElement.dir === "rtl";
  function paint() {
    [...dots.children].forEach((d, i) => d.classList.toggle("is-on", i === index));
    nextBtn.textContent = index === slides.length - 1 ? t("tourStart") : t("tourNext");
    skipBtn.style.visibility = index === slides.length - 1 ? "hidden" : "";
  }
  function go(i) {
    index = Math.max(0, Math.min(slides.length - 1, i));
    // RTL scroll positions run negative in today's browsers.
    track.scrollTo({ left: (rtl() ? -1 : 1) * index * track.clientWidth, behavior: reduce ? "auto" : "smooth" });
    paint();
  }
  // Swiping moves the track; follow it so the dots and the button stay in step.
  let raf = 0;
  track.addEventListener("scroll", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const i = Math.round(Math.abs(track.scrollLeft) / Math.max(1, track.clientWidth));
      if (i !== index) {
        index = i;
        paint();
      }
    });
  });
  dlg.addEventListener("keydown", (e) => {
    const fwd = rtl() ? "ArrowLeft" : "ArrowRight";
    const back = rtl() ? "ArrowRight" : "ArrowLeft";
    if (e.key === fwd) go(index + 1);
    else if (e.key === back) go(index - 1);
  });
  dlg.addEventListener("cancel", (e) => {
    e.preventDefault();
    finish();
  });
  dlg.addEventListener("close", () => {
    if (open) finish();
  });

  function finish() {
    if (!open) return;
    open = false;
    dlg.classList.add("is-closing");
    const done = () => {
      if (dlg.open) dlg.close();
      dlg.remove();
      if (!document.querySelector("dialog[open]")) document.documentElement.classList.remove("has-sheet");
    };
    if (reduce) done();
    else setTimeout(done, 220);
    onDone?.();
  }

  document.body.append(dlg);
  dlg.showModal();
  document.documentElement.classList.add("has-sheet");
  paint();
  // Focus the tour itself (keys work at once) without lighting up a button's focus ring.
  dlg.tabIndex = -1;
  dlg.focus({ preventScroll: true });
}
