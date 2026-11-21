import React from "react";

/* ─────────────────────────────────────────────────────────────
   TE-tasten — byggeklossen for ALLE trykkflater i looken.
   Socket + cap er ren CSS (.key i videomat-look.css); komponenten
   gjør bare én ting: mapper et fargenavn til de fire custom
   propertyene capen leser (--cap, --cap2, --hl, --captext).

   props:
     color   nøkkel i KEY_COLORS (default "white")
     on      latched/aktiv — capen står nede
     small   kompakt cap (24px i stedet for 32px min-høyde)
     capStyle overstyr typografi på capen (font, grad, min-høyde)
   Alt annet sendes videre til <button> (onClick, aria-*, disabled…).

   Låst, men klikkbar: bruk aria-disabled + className="locked" i
   stedet for disabled — da kan tasten fortsatt svare med en
   forklaring. `disabled` er for det som er ekte utilgjengelig.
   ───────────────────────────────────────────────────────────── */

const INK = "#1C1B19";

export const KEY_COLORS = {
  white:  { cap: "#E3E2DA", cap2: "#DED8D5", hl: "rgba(255,255,255,0.95)", text: INK },
  orange: { cap: "#DD5117", cap2: "#C9480F", hl: "rgba(255,191,143,0.9)",  text: "#fff" },
  ink:    { cap: "#343835", cap2: "#313131", hl: "rgba(255,255,255,0.45)", text: "#F5F3EC" },
  // valgfrie ekstra-hetter; hold antallet lavt — for mange farger
  // og kabinettet slutter å lese som ett apparat
  green:  { cap: "#00C64A", cap2: "#00B441", hl: "rgba(195,255,215,0.95)", text: INK },
  blue:   { cap: "#40BCF4", cap2: "#2FB0EC", hl: "rgba(210,240,255,0.95)", text: INK },
};

export default function Key({
  color = "white",
  on = false,
  small = false,
  className = "",
  style,
  capStyle,
  children,
  ...props
}) {
  const c = KEY_COLORS[color] || KEY_COLORS.white;
  return (
    <button
      className={`key${on ? " on" : ""}${small ? " small" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--cap": c.cap, "--cap2": c.cap2, "--hl": c.hl, "--captext": c.text, ...style }}
      {...props}
    >
      <span className="cap" style={capStyle}>{children}</span>
    </button>
  );
}
