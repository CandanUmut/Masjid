// Tiny DOM toolkit: element builder, icons, sheets (native <dialog>) and toasts.
import { t } from "./i18n.js";

export function h(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "style" && typeof v === "object") {
        for (const [prop, val] of Object.entries(v)) {
          if (prop.startsWith("--")) node.style.setProperty(prop, val);
          else node.style[prop] = val;
        }
      }
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else if (k === "html") node.innerHTML = v;
      else if (k in node && typeof v !== "string") node[k] = v;
      else node.setAttribute(k, v === true ? "" : v);
    }
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(node, c);
    else node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function $(sel, root = document) {
  return root.querySelector(sel);
}

// SF Symbols–inspired line icons (24px grid, currentColor).
const P = {
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/>',
  location: '<path d="M20.5 3.5 3.8 10.4c-.6.3-.5 1.2.1 1.3l7 1.4 1.4 7c.1.7 1 .8 1.3.1L20.5 3.5Z"/>',
  chevronDown: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
  chevronLeft: '<path d="M14.5 6 8.5 12l6 6"/>',
  chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  share: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M7 10.5H5.5v9.5h13v-9.5H17"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4A7.5 7.5 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.5 7.5 0 0 0 2.6 1.5l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 2.6-1.5l2.4.9 2-3.4-2-1.6Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  sunrise: '<path d="M4 18.5h16M7 18.5a5 5 0 0 1 10 0M12 4.5v5M9 7.5l3-3 3 3M3.5 14l1.5.8M20.5 14l-1.5.8"/>',
  sunHigh: '<circle cx="12" cy="10" r="4"/><path d="M12 2v1.5M5.6 4.6 6.7 5.7M18.4 4.6l-1.1 1.1M3 10h1.5M19.5 10H21M4 19.5h16"/>',
  sunLow: '<path d="M4 19.5h16M7.5 15.5a4.5 4.5 0 0 1 9 0M12 7v2M5.6 10.6l1.1 1.1M18.4 10.6l-1.1 1.1"/>',
  sunset: '<path d="M4 18.5h16M7 18.5a5 5 0 0 1 10 0M12 9.5v-5M9 6.5l3 3 3-3M3.5 14l1.5.8M20.5 14l-1.5.8"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  stars: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/><path d="M17 3.5v3M15.5 5h3"/>',
  dawn: '<path d="M4 17.5h16M8 17.5a4 4 0 0 1 8 0M6 21h12"/><path d="M16.5 5.5a3.5 3.5 0 0 1-4.5 4.5 3.5 3.5 0 1 0 4.5-4.5Z"/>',
  mosque: '<path d="M12 3.5c-1 1.6-4.5 2.8-4.5 6h9c0-3.2-3.5-4.4-4.5-6Z"/><path d="M5 20.5v-8.5h14v8.5M3.5 20.5h17M10 20.5v-3.5a2 2 0 0 1 4 0v3.5M3.5 12V8M20.5 12V8"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  more: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2"/>',
  tv: '<rect x="3" y="4.5" width="18" height="12.5" rx="2.5"/><path d="M8.5 20.5h7M12 17v3.5"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9Z"/>',
  edit: '<path d="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13.5h9l1-13.5"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  print: '<path d="M7 9V3.5h10V9M7 17H4.5V9h15v8H17"/><rect x="7" y="14" width="10" height="6.5" rx="1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.5"/>',
  arrowUp: '<path d="M12 20V4M5.5 10.5 12 4l6.5 6.5"/>',
  kaaba: '<path d="M4 8.5 12 5l8 3.5v9L12 21l-8-3.5v-9Z"/><path d="M4 8.5 12 12l8-3.5M12 12v9M4 11.5l8 3.5 8-3.5"/>',
  directions: '<path d="M12 2.8 21.2 12 12 21.2 2.8 12Z"/><path d="M9.5 14v-2.2c0-.9.7-1.6 1.6-1.6h3.6M12.8 8.2l2 2-2 2"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
};

export function icon(name, cls = "") {
  const span = document.createElement("span");
  span.className = `icon ${cls}`.trim();
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[name] || ""}</svg>`;
  return span;
}

// --- Keyboard awareness ----------------------------------------------------
// On phones the on-screen keyboard covers the bottom of the layout viewport, where sheets live.
// Track the visible area so sheets (and their search results) always sit above the keyboard.
// Only while a text field inside a sheet is focused — otherwise Safari's toolbar collapsing during a
// scroll would also look like a "keyboard" and nudge sheets around.
if (typeof window !== "undefined" && window.visualViewport) {
  const vv = window.visualViewport;
  const root = document.documentElement;
  const typing = () => {
    const a = document.activeElement;
    return Boolean(a && a.closest?.("dialog[open]") && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && !["checkbox", "radio", "button"].includes(a.type))));
  };
  const sync = () => {
    const kb = typing() ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    root.style.setProperty("--kb", `${kb > 80 ? kb : 0}px`);
    root.style.setProperty("--vvh", `${kb > 80 ? vv.height : window.innerHeight}px`);
    root.classList.toggle("has-keyboard", kb > 80);
  };
  vv.addEventListener("resize", sync);
  document.addEventListener("focusin", () => setTimeout(sync, 60));
  document.addEventListener("focusout", () => setTimeout(sync, 60));
  sync();
}

// --- Sheets -------------------------------------------------------------
// A sheet is a native <dialog> styled as an iOS bottom sheet. Returns { el, close, body }.
// `confirmClose`: { when: () => boolean } — ask "Discard changes?" (as a sheet, not a browser dialog)
// before closing by swipe, backdrop, Escape or the close button.
export function openSheet({ title, subtitle, content, actions, className = "", onClose, confirmClose, wide = false } = {}) {
  const body = h("div", { class: "sheet-body" }, content);
  const dlg = h(
    "dialog",
    { class: `sheet ${wide ? "sheet--wide" : ""} ${className}`.trim(), "aria-label": title || "" },
    h("div", { class: "sheet-grabber", "aria-hidden": "true" }),
    h(
      "header",
      { class: "sheet-head" },
      h("div", { class: "sheet-titles" }, h("h2", { class: "sheet-title" }, title || ""), subtitle ? h("p", { class: "sheet-subtitle" }, subtitle) : null),
      h("button", { class: "icon-btn sheet-close", type: "button", "aria-label": t("close"), onclick: () => close() }, icon("close"))
    ),
    body,
    actions ? h("footer", { class: "sheet-foot" }, actions) : null
  );
  let closed = false;
  let ask = null;
  function close(force = false) {
    if (closed) return;
    if (!force && confirmClose?.when()) {
      if (ask) return; // already asking
      const me = (ask = openSheet({
        onClose: () => {
          if (ask === me) ask = null;
        },
        title: t("discardChanges"),
        className: "sheet--confirm",
        content: h(
          "div",
          { class: "list" },
          h("button", { class: "row row-btn tone-danger", type: "button", onclick: () => { me.close(); close(true); } }, icon("trash", "row-icon"), h("span", { class: "row-title" }, t("discard"))),
          h("button", { class: "row row-btn", type: "button", onclick: () => me.close() }, icon("edit", "row-icon"), h("span", { class: "row-title" }, t("keepEditing")))
        ),
      }));
      return;
    }
    closed = true;
    dlg.classList.add("is-closing");
    const done = () => {
      dlg.close();
      dlg.remove();
      if (!document.querySelector("dialog.sheet[open]")) document.documentElement.classList.remove("has-sheet");
      onClose?.();
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) done();
    else setTimeout(done, 220);
  }
  dlg.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) close(); // backdrop tap
  });
  // The browser may close a dialog on its own (repeated Escape or Back skips the cancel event).
  // Unsaved work is never lost that way: reopen and ask; otherwise just clean up.
  dlg.addEventListener("close", () => {
    if (closed) return;
    if (confirmClose?.when()) {
      dlg.showModal();
      if (ask) {
        const old = ask;
        ask = null;
        old.forceClose();
      }
      close();
      return;
    }
    closed = true;
    dlg.remove();
    if (!document.querySelector("dialog.sheet[open]")) document.documentElement.classList.remove("has-sheet");
    onClose?.();
  });
  attachSwipeToClose(dlg, close);
  document.body.append(dlg);
  dlg.showModal();
  // The page behind a sheet stays put.
  document.documentElement.classList.add("has-sheet");
  return { el: dlg, body, close: () => close(false), forceClose: () => close(true) };
}

// An in-app replacement for confirm(): resolves true only when the action is chosen.
export function confirmSheet({ title, message, confirmLabel, cancelLabel = t("cancel"), danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const sheet = openSheet({
      title,
      subtitle: message,
      className: "sheet--confirm",
      onClose: () => resolve(result),
      content: h(
        "div",
        { class: "list" },
        h("button", { class: `row row-btn ${danger ? "tone-danger" : "tone-accent-text"}`, type: "button", onclick: () => { result = true; sheet.close(); } }, h("span", { class: "row-title" }, confirmLabel)),
        h("button", { class: "row row-btn", type: "button", onclick: () => sheet.close() }, h("span", { class: "row-title" }, cancelLabel))
      ),
    });
  });
}

function attachSwipeToClose(dlg, close) {
  let startY = null;
  let dy = 0;
  const grab = (e) => e.target.closest(".sheet-grabber, .sheet-head");
  dlg.addEventListener("pointerdown", (e) => {
    if (!grab(e) || e.target.closest("button")) return;
    startY = e.clientY;
    dy = 0;
    dlg.style.transition = "none";
  });
  dlg.addEventListener("pointermove", (e) => {
    if (startY == null) return;
    dy = Math.max(0, e.clientY - startY);
    dlg.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (startY == null) return;
    startY = null;
    dlg.style.transition = "";
    dlg.style.transform = "";
    if (dy > 90) close();
  };
  dlg.addEventListener("pointerup", end);
  dlg.addEventListener("pointercancel", end);
}

// --- Toasts -------------------------------------------------------------
let toastHost = null;
let dismissCurrent = null;
export function toast(message, { action, onAction, duration = 3800, tone = "" } = {}) {
  // One at a time: a new message replaces the old one instead of stacking over the screen.
  dismissCurrent?.();
  if (!toastHost) {
    toastHost = h("div", { class: "toast-host", role: "status", "aria-live": "polite" });
    if (typeof toastHost.showPopover === "function") toastHost.setAttribute("popover", "manual");
    document.body.append(toastHost);
  }
  // A popover lives in the top layer, so toasts (and their Undo buttons) stay above open sheets.
  if (toastHost.hasAttribute("popover")) {
    try {
      if (toastHost.matches(":popover-open")) toastHost.hidePopover();
      toastHost.showPopover();
    } catch {
      /* ignore */
    }
  }
  const node = h(
    "div",
    { class: `toast ${tone ? `toast--${tone}` : ""}` },
    h("span", { class: "toast-msg" }, message),
    action
      ? h("button", { class: "toast-action", type: "button", onclick: () => { onAction?.(); dismiss(); } }, action)
      : null
  );
  toastHost.append(node);
  requestAnimationFrame(() => node.classList.add("is-in"));
  const timer = setTimeout(dismiss, duration);
  function dismiss() {
    clearTimeout(timer);
    if (dismissCurrent === dismiss) dismissCurrent = null;
    node.classList.remove("is-in");
    setTimeout(() => node.remove(), 250);
  }
  dismissCurrent = dismiss;
  return dismiss;
}

// --- Form controls -----------------------------------------------------
export function select(value, options, onChange, attrs = {}) {
  const s = h(
    "select",
    { class: "select", ...attrs, onchange: (e) => onChange(e.target.value) },
    options.map((o) => h("option", { value: o.value, selected: String(o.value) === String(value) }, o.label))
  );
  return s;
}

export function toggle(checked, onChange, label) {
  return h(
    "label",
    { class: "switch" },
    h("input", { type: "checkbox", role: "switch", checked, "aria-label": label, onchange: (e) => onChange(e.target.checked) }),
    h("span", { class: "switch-track", "aria-hidden": "true" })
  );
}

export function segmented(value, options, onChange, label) {
  const wrap = h("div", { class: "segmented", role: "radiogroup", "aria-label": label || "" });
  for (const o of options) {
    wrap.append(
      h(
        "button",
        {
          type: "button",
          role: "radio",
          "aria-checked": String(String(o.value) === String(value)),
          class: String(o.value) === String(value) ? "is-on" : "",
          onclick: () => {
            for (const b of wrap.children) {
              b.classList.remove("is-on");
              b.setAttribute("aria-checked", "false");
            }
            const btn = wrap.children[options.indexOf(o)];
            btn.classList.add("is-on");
            btn.setAttribute("aria-checked", "true");
            onChange(o.value);
          },
        },
        o.label
      )
    );
  }
  return wrap;
}

export function stepper(value, { min = -60, max = 60, step = 1, format = (v) => String(v), onChange, label = "" }) {
  let v = value;
  const out = h("output", { class: "stepper-val", "aria-live": "polite" }, format(v));
  const set = (nv) => {
    v = Math.min(max, Math.max(min, nv));
    out.textContent = format(v);
    onChange(v);
  };
  return h(
    "div",
    { class: "stepper", role: "group", "aria-label": label },
    h("button", { type: "button", class: "stepper-btn", "aria-label": `${label} −`, ...repeatable(() => set(v - step)) }, icon("minus")),
    out,
    h("button", { type: "button", class: "stepper-btn", "aria-label": `${label} +`, ...repeatable(() => set(v + step)) }, icon("plus"))
  );
}

// Minutes you can type *or* nudge: [−] [ 120 ] min [+], with a "2 h" hint for long values.
export function minutesInput(value, { min = 0, max = 300, step = 5, onChange, label = "", unit = "min", hours = (h, m) => `${h} h${m ? ` ${m}` : ""}` }) {
  let v = value;
  const hint = h("span", { class: "minutes-hint" });
  const input = h("input", {
    class: "minutes-field",
    type: "text",
    inputmode: "numeric",
    pattern: "[0-9]*",
    value: String(v),
    "aria-label": label,
    onfocus: (e) => e.target.select(),
    oninput: (e) => {
      const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
      // Out-of-range input is corrected on the spot (no "999" lingering in the field).
      if (Number.isFinite(n)) commit(n, n > max || n < min);
    },
    onblur: () => (input.value = String(v)),
    onkeydown: (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        commit(v + (e.key === "ArrowUp" ? 1 : -1));
      }
    },
  });
  function showHint() {
    hint.textContent = v >= 60 ? `= ${hours(Math.floor(v / 60), v % 60)}` : "";
  }
  function commit(n, syncField = true) {
    v = Math.min(max, Math.max(min, Math.round(n)));
    if (syncField) input.value = String(v);
    showHint();
    onChange(v);
  }
  showHint();
  return h(
    "div",
    { class: "minutes-input", role: "group", "aria-label": label },
    h("button", { type: "button", class: "stepper-btn", "aria-label": `${label} −`, ...repeatable(() => commit(Math.ceil(v / step) * step - step)) }, icon("minus")),
    h("label", { class: "minutes-box" }, input, h("span", { class: "minutes-unit" }, unit)),
    h("button", { type: "button", class: "stepper-btn", "aria-label": `${label} +`, ...repeatable(() => commit(Math.floor(v / step) * step + step)) }, icon("plus")),
    hint
  );
}

// Click once to step; press and hold to keep stepping (speeding up), like iOS steppers.
function repeatable(fn) {
  let timer = null;
  let fired = false;
  const stop = () => {
    clearTimeout(timer);
    timer = null;
  };
  return {
    onpointerdown: (e) => {
      if (e.button) return;
      fired = false;
      let delay = 380;
      const loop = () => {
        fired = true;
        fn();
        delay = Math.max(50, delay * 0.8);
        timer = setTimeout(loop, delay);
      };
      timer = setTimeout(loop, delay);
    },
    onpointerup: stop,
    onpointerleave: stop,
    onpointercancel: stop,
    onclick: () => {
      if (!fired) fn(); // keyboard and single taps
      fired = false;
    },
  };
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h("textarea", { style: { position: "fixed", opacity: "0" } }, text);
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}
