// Calculation settings form, shared by Settings (personal defaults) and the masjid editor.
import { METHODS, TIMES, normalizeCalc, resolveCalc } from "../engine.js";
import { t } from "../i18n.js";
import { h, select, stepper } from "../ui.js";

export function calcEditor(calcIn, place, onChange, { adjHint = "adjustmentsHint" } = {}) {
  let calc = normalizeCalc(calcIn);
  const root = h("div", { class: "calc-editor" });

  function emit() {
    calc = normalizeCalc(calc);
    onChange(structuredClone(calc));
  }

  function render() {
    // What "Automatic" would pick here, independent of any manual override.
    const r = place ? resolveCalc(place, { ...calc, method: "auto", madhab: "auto", highLat: "auto" }) : null;
    const autoLabel = r ? t("autoFor", { m: METHODS[r.method]?.name || r.method }) : t("automatic");
    const methodOptions = [{ value: "auto", label: autoLabel }].concat(
      Object.entries(METHODS).map(([id, m]) => ({
        value: id,
        label: id === "Custom" ? m.name : `${m.name} · ${m.fajr}° / ${m.ishaInterval ? `${m.ishaInterval} ${t("min")}` : `${m.isha}°`}`,
      }))
    );
    const madhabAuto = r ? `${t("automatic")} · ${t(r.madhab)}` : t("automatic");
    const hlAuto = r ? `${t("automatic")} · ${t({ middle: "hlMiddle", seventh: "hlSeventh", angle: "hlAngle" }[r.highLat])}` : t("automatic");

    const custom =
      calc.method === "Custom"
        ? [
            row(t("fajrAngle"), stepper(calc.fajrAngle, { min: 6, max: 25, step: 0.5, format: (v) => `${v}°`, label: t("fajrAngle"), onChange: (v) => { calc.fajrAngle = v; emit(); } })),
            row(t("ishaAngle"), stepper(calc.ishaAngle, { min: 6, max: 25, step: 0.5, format: (v) => `${v}°`, label: t("ishaAngle"), onChange: (v) => { calc.ishaAngle = v; emit(); } })),
            row(t("ishaInterval"), stepper(calc.ishaInterval, { min: 0, max: 180, step: 5, format: (v) => (v ? `${v} ${t("min")}` : "—"), label: t("ishaInterval"), onChange: (v) => { calc.ishaInterval = v; emit(); } })),
          ]
        : [];

    root.replaceChildren(
      h(
        "div",
        { class: "list" },
        row(t("calcMethod"), select(calc.method, methodOptions, (v) => { calc.method = v; emit(); render(); }, { "aria-label": t("calcMethod") }), true),
        custom,
        row(
          t("asrMethod"),
          select(
            calc.madhab,
            [
              { value: "auto", label: madhabAuto },
              { value: "shafi", label: t("shafi") },
              { value: "hanafi", label: t("hanafi") },
            ],
            (v) => { calc.madhab = v; emit(); render(); },
            { "aria-label": t("asrMethod") }
          ),
          true
        ),
        row(
          t("highLat"),
          select(
            calc.highLat,
            [
              { value: "auto", label: hlAuto },
              { value: "middle", label: t("hlMiddle") },
              { value: "seventh", label: t("hlSeventh") },
              { value: "angle", label: t("hlAngle") },
            ],
            (v) => { calc.highLat = v; emit(); render(); },
            { "aria-label": t("highLat") }
          ),
          true
        )
      ),
      h("h3", { class: "list-title" }, t("adjustments")),
      h(
        "div",
        { class: "list" },
        TIMES.map((k) =>
          row(
            t(k),
            stepper(calc.adj[k], {
              min: -60,
              max: 60,
              format: (v) => (v > 0 ? `+${v}` : String(v)) + ` ${t("min")}`,
              label: t(k),
              onChange: (v) => { calc.adj[k] = v; emit(); },
            })
          )
        )
      ),
      h("p", { class: "list-foot" }, t(adjHint))
    );
  }
  render();
  return { el: root, refresh: render };
}

export function row(label, control, stacked = false) {
  return h("div", { class: `row form-row ${stacked ? "form-row--select" : ""}` }, h("span", { class: "row-label" }, label), control);
}
