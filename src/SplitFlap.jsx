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
const Flap = React.memo(function Flap({ char }) {
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
});

export default function SplitFlapDisplay({ text, spinning, spinKey, landed, onSettle, compact = false, delay = 0 }) {
  const lines = useMemo(() => toLines(text), [text]);
  const [grid, setGrid] = useState(() => lines.map((l) => [...l]));
  const [scale, setScale] = useState(1);

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

  // flutter ved hver spinn (spinKey bumpes utenfra): ÉN rAF-driver som
  // samler alle celleendringer i ett setGrid per takt — memoiserte Flap-kort
  // gjør at kun celler som faktisk byttet tegn re-rendres
  useEffect(() => {
    if (!spinning) return;
    settled.current = false;

    const flat = [];
    lines.forEach((line, li) =>
      [...line].forEach((ch, ci) => flat.push({ li, ci, target: ch }))
    );

    const CAD = 60, LEAD = 240 + delay, STAGGER = 62; // ms: takt, første landing, forsinkelse/kort
    const landing = (k) => LEAD + k * STAGGER;
    const total = landing(flat.length - 1) + 160;

    const start = performance.now();
    let lastTick = -CAD;
    let raf;

    const step = (now) => {
      const t = now - start;
      if (t >= total) {
        setGrid(lines.map((l) => [...l]));
        if (!settled.current) {
          settled.current = true;
          onSettle && onSettle();
        }
        return;
      }
      if (t - lastTick >= CAD) {
        lastTick = t;
        let fluttering = false;
        setGrid(() =>
          lines.map((line, li) =>
            [...line].map((ch, ci) => {
              const k = flat.findIndex((c) => c.li === li && c.ci === ci);
              if (ch === " " || t >= landing(k)) return ch;
              fluttering = true;
              return randChar();
            })
          )
        );
        if (fluttering) flapClack();
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  return (
    <div className={`flap-wrap${compact ? " flap-compact" : ""}${landed ? " landed" : ""}`} ref={wrapRef} aria-hidden="true">
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
