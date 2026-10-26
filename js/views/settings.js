import { t, LANGS } from "../i18n.js";
import { h, icon, select, segmented, toggle, stepper } from "../ui.js";
import { calcEditor, row } from "./calc-editor.js";

export const APP_VERSION = "2.2.0";

export function SettingsView(ctx) {
  const s = ctx.state.settings;
  const root = h("div", { class: "view view-settings" }, h("h1", { class: "large-title" }, t("settings")));

  root.append(
    h("h3", { class: "list-title" }, t("appearance")),
    h(
      "div",
      { class: "list" },
      row(
        t("language"),
        select(
          s.lang,
          [{ value: "auto", label: t("themeAuto") }].concat(LANGS.map((l) => ({ value: l.id, label: l.name }))),
          (v) => ctx.update((st) => (st.settings.lang = v), { relayout: true }),
          { "aria-label": t("language") }
        ),
        true
      ),
      row(
        t("theme"),
        segmented(
          s.theme,
          [
            { value: "auto", label: t("themeAuto") },
            { value: "light", label: t("themeLight") },
            { value: "dark", label: t("themeDark") },
          ],
          (v) => ctx.update((st) => (st.settings.theme = v), { render: false }),
          t("theme")
        )
      ),
      row(
        t("clock"),
        segmented(
          s.clock,
          [
            { value: "auto", label: t("clockAuto") },
            { value: "12", label: t("clock12") },
            { value: "24", label: t("clock24") },
          ],
          (v) => ctx.update((st) => (st.settings.clock = v), { render: false }),
          t("clock")
        )
      )
    ),
    h("h3", { class: "list-title" }, t("showTimes")),
    h(
      "div",
      { class: "list" },
      ["imsak", "sunrise", "duha", "midnight", "lastThird"].map((k) =>
        row(t(k), toggle(s.extras[k], (v) => ctx.update((st) => (st.settings.extras[k] = v), { render: false }), t(k)))
      ),
      row(
        t("hijriOffset"),
        stepper(s.hijriOffset, {
          min: -2,
          max: 2,
          format: (v) => (v > 0 ? `+${v}` : String(v)),
          label: t("hijriOffset"),
          onChange: (v) => ctx.update((st) => (st.settings.hijriOffset = v), { render: false }),
        })
      )
    ),
    h("h3", { class: "list-title" }, t("calcDefaults")),
    calcEditor(s.calc, ctx.gpsOrCityPlace(), (calc) => ctx.update((st) => (st.settings.calc = calc), { render: false })).el,
    h("p", { class: "list-foot" }, t("calcHint"))
  );

  if (ctx.settingsExtras) root.append(...ctx.settingsExtras());

  root.append(
    h("h3", { class: "list-title" }, t("about")),
    h(
      "div",
      { class: "list" },
      h(
        "div",
        { class: "row about-row" },
        h("img", { class: "about-icon", src: "./assets/icons/icon.svg", alt: "", width: 44, height: 44 }),
        h("div", { class: "row-main" }, h("span", { class: "row-title about-name" }, "Ufuq ", h("span", { lang: "ar", dir: "rtl" }, "أُفُق")), h("span", { class: "row-sub wrap" }, t("nameMeaning")))
      ),
      h("div", { class: "row about-row" }, icon("lock", "row-icon tone-green"), h("div", { class: "row-main" }, h("span", { class: "row-title" }, t("privacy")), h("span", { class: "row-sub wrap" }, t("privacyBody")))),
      h("div", { class: "row" }, h("span", { class: "row-label" }, t("version")), h("span", { class: "row-value" }, APP_VERSION))
    ),
    h("p", { class: "list-foot" }, t("credits"))
  );
  return { el: root };
}
