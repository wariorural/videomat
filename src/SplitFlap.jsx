import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { flapClack } from "./lib/sound.js";

/* ─────────────────────────────────────────────────────────────
   Split-flap-display (Solari-avgangstavle). Hvert tegn er et eget
   kort delt på midten; ved spinn flakser hvert kort gjennom
   mellomtegn og lander, forskjøvet venstre→høyre så raden «ruller».
   ───────────────────────────────────────────────────────────── */

const FLUTTER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const MIN_SCALE = 0.34; // under dette blir det uleselig → wrap til to linjer i stedet
const MAX_PER_LINE = 11;

const randChar = () => FLUTTER[(Math.random() * FLUTTER.length) | 0];

// del tittelen i 1–2 balanserte linjer så raden ikke tvinges uleselig smal
function toLines(text) {
  const t = (text || "").toUpperCase();
  if (t.length <= MAX_PER_LINE) return [t];
  const words = t.split(" ");
  if (words.length === 1) return [t]; // ett langt ord — la skaleringen ta det
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const score = Math.max(a.length, b.length);
    if (!best || score < best.score) best = { a, b, score };
  }
  return [best.a, best.b];
}

/* ── ett kort ──────────────────────────────────────────────────
   To statiske halvdeler viser gjeldende tegn (samme glyph klippet
   øverst/nederst → sømmen går rett gjennom bokstaven). Ved bytte
   folder øvre halvdel av det GAMLE tegnet ned, så folder nedre
   halvdel av det NYE tegnet opp — den ekte Solari-mekanikken. */
function Flap({ char }) {
  const [s, setS] = useState({ cur: char, prev: char, id: 0 });
  useEffect(() => {
    setS((p) => (p.cur === char ? p : { cur: char, prev: p.cur, id: p.id + 1 }));
  }, [char]);
  const flipping = s.cur !== s.prev;
  const commit = () => setS((p) => ({ ...p, prev: p.cur }));
  return (
    <span className="flap">
      <span className="flap-half flap-top">
        <span className="glyph">{s.cur}</span>
      </span>
      <span className="flap-half flap-bottom">
        <span className="glyph">{flipping ? s.prev : s.cur}</span>
      </span>
      {flipping && (
        <span className="flap-leaf" key={s.id}>
          <span className="flap-half flap-top leaf-top">
            <span className="glyph">{s.prev}</span>
          </span>
          <span className="flap-half flap-bottom leaf-bottom" onAnimationEnd={commit}>
            <span className="glyph">{s.cur}</span>
          </span>
        </span>
      )}
      <span className="flap-seam" aria-hidden="true" />
    </span>
  );
}

export default function SplitFlapDisplay({ text, spinning, spinKey, landed, onSettle }) {
  const lines = useMemo(() => toLines(text), [text]);
  const [grid, setGrid] = useState(() => lines.map((l) => [...l]));
  const [scale, setScale] = useState(1);

  const timers = useRef([]);
  const settled = useRef(false);
  const wrapRef = useRef(null);
  const rowRef = useRef(null);

  // når ikke i spinn: vis målteksten skarpt (også ny landet tittel)
  useEffect(() => {
    if (!spinning) setGrid(lines.map((l) => [...l]));
  }, [lines, spinning]);

  // auto-scale: mål naturlig bredde, krymp hele raden mot containeren.
  // transform: scale() endrer ikke layout-bredden (scrollWidth), så målingen
  // er stabil uansett gjeldende skala.
  useLayoutEffect(() => {
    const measure = () => {
      const w = wrapRef.current, r = rowRef.current;
      if (!w || !r) return;
      const nw = r.scrollWidth;
      if (nw > 0) setScale(Math.min(1, Math.max(MIN_SCALE, w.clientWidth / nw)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [lines]);

  // flutter ved hver spinn (spinKey bumpes utenfra)
  useEffect(() => {
    if (!spinning) return;
    settled.current = false;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const flat = [];
    lines.forEach((line, li) =>
      [...line].forEach((ch, ci) => flat.push({ li, ci, target: ch }))
    );

    const CAD = 60, LEAD = 240, STAGGER = 62; // ms: takt, første landing, forsinkelse/kort
    flat.forEach((cell, k) => {
      const landing = LEAD + k * STAGGER;
      const isSpace = cell.target === " ";
      const count = isSpace ? 1 : Math.max(3, Math.round(landing / CAD));
      for (let step = 1; step <= count; step++) {
        const isLast = step === count;
        const at = isLast ? landing : Math.min(step * CAD, landing - CAD * 0.5);
        timers.current.push(
          setTimeout(() => {
            setGrid((g) => {
              const n = g.map((r) => r.slice());
              if (n[cell.li]) n[cell.li][cell.ci] = isLast ? cell.target : randChar();
              return n;
            });
            flapClack();
          }, at)
        );
      }
    });

    const total = LEAD + (flat.length - 1) * STAGGER + 160;
    timers.current.push(
      setTimeout(() => {
        if (settled.current) return;
        settled.current = true;
        onSettle && onSettle();
      }, total)
    );

    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <div className={`flap-wrap${landed ? " landed" : ""}`} ref={wrapRef}>
      <div className="flap-scaler" ref={rowRef} style={{ transform: `scale(${scale})` }}>
        {grid.map((row, li) => (
          <div className="flap-row" key={li}>
            {row.map((ch, ci) => (
              <Flap key={ci} char={ch} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
