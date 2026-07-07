import React, { useState, useRef, useMemo, useEffect, useLayoutEffect, useCallback } from "react";
import { keyOf, parseCsv, fetchWatchlist, fetchFilmDetails, safeUri, FETCH_ERRORS } from "./lib/letterboxd.js";
import { loadState, saveState } from "./lib/storage.js";
import { tick, clunk, win, setSoundEnabled } from "./lib/sound.js";
import SplitFlapDisplay from "./SplitFlap.jsx";

/* ─────────────────────────────────────────────────────────────
   VIDEOKISEN · en Braun-aktig maskin for to filmlister
   Letterboxd-brukernavn eller watchlist.csv (Settings → Data → Export)
   ───────────────────────────────────────────────────────────── */

const INK = "#1C1B19";
const PANEL = "#DDDAD2";
const PANEL_HI = "#E9E7E0";
const PANEL_LO = "#C9C6BD";
const RED = "#DD5117";        // Braun-oransje, primær handling + eneste aksent
const ERROR = "#A8321A";      // mørkere rød for feiltekst (AA-kontrast på panel)
const ORANGE = "#DD5117";     // én oransje i hele maskinen (= RED)
const GREEN = "#00C64A";      // Letterboxd grønn = overlapp
const BLUE = "#40BCF4";       // Letterboxd blå = liste B
const DIM = "#5D5A52";        // sekundærtekst på panel — ≥4.5:1
// gråtoner på det mørke displayet (alle ≥4.5:1 mot INK)
const D_HI = "#9a988f";       // år/rating
const D_MID = "#8f8d84";      // regi/sjanger
const D_LABEL = "#8a8880";    // vindu-etiketter
const D_EMPTY = "#8a8880";    // tomtilstand

const MONO = "'SF Mono','JetBrains Mono',ui-monospace,Menlo,Consolas,monospace";
const GROTESK = "'Helvetica Neue','Inter',Helvetica,Arial,sans-serif";
// dot-matrix (à la Nothing) — KUN mikroetiketter; trenger større grad + tracking for lesbarhet
const DOT = "'Doto','JetBrains Mono',ui-monospace,monospace";

// modusene bærer Letterboxd-fargene: A-oransje, overlapp-grønn, B-blå
const MODES = [
  { id: "all", label: "Roulette", color: "orange" },
  { id: "date", label: "Movie night", color: "lbGreen" },
  { id: "duell", label: "Duel", color: "lbBlue" },
];

const DEFAULT_PERSON = { a: "You", b: "Partner" };
const EMPTY_SLOT = { films: [], filename: "", username: "", total: 0 };

const saved = loadState();

const films = (n) => (n === 1 ? "film" : "films");

function buzz(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* iOS støtter ikke vibrate — stille nei er riktig svar */
  }
}

/* ── TE-tast: felles byggekloss for alle knapper (se .key i CSS) ── */

const KEY_COLORS = {
  orange: { cap: "#DD5117", cap2: "#C9480F", hl: "rgba(255,191,143,0.9)", text: "#fff" },
  white: { cap: "#E3E2DA", cap2: "#DED8D5", hl: "rgba(255,255,255,0.95)", text: INK },
  ink: { cap: "#343835", cap2: "#313131", hl: "rgba(255,255,255,0.45)", text: "#F5F3EC" },
  lbGreen: { cap: "#00C64A", cap2: "#00B441", hl: "rgba(195,255,215,0.95)", text: INK },
  lbBlue: { cap: "#40BCF4", cap2: "#2FB0EC", hl: "rgba(210,240,255,0.95)", text: INK },
};

function Key({ color = "white", on = false, small = false, className = "", style, capStyle, children, ...props }) {
  const c = KEY_COLORS[color];
  return (
    <button
      className={`key${on ? " on" : ""}${small ? " small" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--cap": c.cap, "--cap2": c.cap2, "--hl": c.hl, "--captext": c.text, ...style }}
      {...props}
    >
      <span className="cap" style={{
        fontFamily: MONO, fontSize: 11, fontWeight: 700,
        letterSpacing: "0.08em", textTransform: "uppercase",
        ...capStyle,
      }}>
        {children}
      </span>
    </button>
  );
}

function SpeakerIcon({ muted }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 6h3l4-3.5v11L5 10H2z" fill="currentColor" />
      {muted ? (
        <path d="M10.5 5.5 14 10.5 M14 5.5 10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      ) : (
        <path d="M11 5.2c1.3 1 1.3 4.6 0 5.6 M12.7 3.6c2.2 1.8 2.2 7 0 8.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      )}
    </svg>
  );
}

/* ── småikoner til liste-tastene (14px, currentColor) ─────────── */

function IconRefresh() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.2 8A5.2 5.2 0 1 1 11.6 4.2" />
      <path d="M13.4 1.8v2.8h-2.8" />
    </svg>
  );
}

function IconSwap() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5.5h9M9.8 2.8 12.5 5.5 9.8 8.2" />
      <path d="M13 10.5H4M6.2 7.8 3.5 10.5 6.2 13.2" />
    </svg>
  );
}

function IconFetch() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2.5v7M5 6.8 8 9.8l3-3" />
      <path d="M3 12.8h10" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 2h5l3 3v9h-8z" />
      <path d="M9.5 2v3h3" />
    </svg>
  );
}

/* ── flip-liste: kompakt knapp som roterer til redigering ───────
   Fast høyde begge sider — maskinen vokser aldri. Fronten er én
   knapp (flipper); baksiden har input/FETCH/CSV eller rename/
   REFRESH/CHANGE. Flipper selv tilbake etter vellykket lasting. */

function FlipSlot({ side, node, slot, accent, optional, attn, fetching, error, onFile, onFetch, onPersonChange, onClear }) {
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [uname, setUname] = useState(slot.username || "");
  const loaded = slot.films.length > 0;

  const handleFiles = (fileList) => {
    const f = fileList && fileList[0];
    if (f) onFile(f);
  };

  // vellykket lasting → flipp tilbake til fronten
  useEffect(() => {
    if (loaded && !fetching && !error) setFlipped(false);
  }, [loaded, fetching, error]);

  // flipp til redigering → fokus i feltet
  useEffect(() => {
    if (flipped) {
      const t = setTimeout(() => inputRef.current?.focus(), 330);
      return () => clearTimeout(t);
    }
  }, [flipped]);

  // delvis lasting er informasjon, ikke feil — kun `error` skal være rød
  const status = error
    ? error
    : slot.total > slot.films.length
      ? `fetched ${slot.films.length} of ${slot.total}`
      : null;

  return (
    <div
      className={`flip${flipped ? " flipped" : ""}${attn ? " attn" : ""}`}
      data-node={node}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
    >
      <div className="flip-inner">
        {/* front: hele kortet er knappen som flipper */}
        <button
          className="flip-face press"
          onClick={() => setFlipped(true)}
          aria-expanded={flipped}
          aria-label={loaded
            ? `${side}: ${slot.person}, ${slot.films.length} ${films(slot.films.length)} — edit`
            : `${side}: ${optional ? "add a friend's list" : "add your watchlist"}`}
          tabIndex={flipped ? -1 : 0}
          style={{
            display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center",
            gap: 6, padding: "12px 14px", cursor: "pointer", textAlign: "left",
            border: `1.5px solid ${loaded ? accent : "rgba(28,27,25,0.22)"}`,
            background: drag ? PANEL_HI : "rgba(28,27,25,0.035)",
            boxShadow: loaded
              ? `inset 0 1.5px 4px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.5), 0 0 12px -2px ${accent}`
              : "inset 0 1.5px 4px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.5)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 1, background: accent, flexShrink: 0 }} />
            <span style={{ fontFamily: DOT, fontWeight: 900, fontSize: 13, letterSpacing: "0.16em", color: DIM, textTransform: "uppercase" }}>
              {side}
            </span>
          </span>
          <span style={{ minWidth: 0, width: "100%" }}>
            {loaded ? (
              <>
                <span style={{ display: "block", fontFamily: GROTESK, fontSize: 16, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {slot.person}
                </span>
                <span style={{ display: "block", fontFamily: MONO, fontSize: 11.5, color: error ? ERROR : DIM, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {status || `${slot.films.length} ${films(slot.films.length)}`}
                </span>
              </>
            ) : (
              <span style={{ display: "block", fontFamily: MONO, fontSize: 12, color: error ? ERROR : DIM, lineHeight: 1.4 }}>
                {status || (optional ? "+ add a friend's list" : "+ add your watchlist")}
              </span>
            )}
          </span>
        </button>

        {/* bakside: redigering — samme fotavtrykk */}
        <div
          className="flip-face flip-back"
          aria-hidden={!flipped}
          style={{
            display: "flex", flexDirection: "column", justifyContent: "center", gap: 7,
            padding: "10px 12px", background: PANEL_HI,
            border: `1.5px solid ${loaded ? accent : "rgba(28,27,25,0.3)"}`,
            boxShadow: "inset 0 1.5px 4px rgba(0,0,0,0.12)",
          }}
        >
          {loaded ? (
            <>
              <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                <input
                  ref={inputRef}
                  className="rename"
                  value={slot.person}
                  onChange={(e) => onPersonChange(e.target.value)}
                  aria-label="Display name (tap to rename)"
                  name={`name-${side}`}
                  autoComplete="off"
                  tabIndex={flipped ? 0 : -1}
                  style={{
                    flex: 1, minWidth: 0, fontFamily: GROTESK, fontSize: 16, fontWeight: 600, color: INK,
                    background: "transparent", border: "1px solid transparent",
                    borderBottom: "1px dashed rgba(28,27,25,0.35)",
                    borderRadius: 3, padding: "1px 4px",
                  }}
                />
                <Key small color="white" onClick={() => setFlipped(false)} aria-label="Close" tabIndex={flipped ? 0 : -1}>✕</Key>
              </div>
              <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                {slot.username && (
                  <Key small color="white" onClick={() => onFetch(slot.username)} disabled={fetching} tabIndex={flipped ? 0 : -1} style={{ flex: 1 }} aria-label="Refresh list" title="Refresh list">
                    {fetching ? "…" : <IconRefresh />}
                  </Key>
                )}
                <Key small color="white" onClick={onClear} tabIndex={flipped ? 0 : -1} style={{ flex: 1 }} aria-label="Change list" title="Change list"><IconSwap /></Key>
              </div>
              <span role={error ? "alert" : undefined} style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: 1, color: error ? ERROR : DIM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {status || (slot.username ? `@${slot.username}` : slot.filename)}
              </span>
            </>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); if (uname.trim()) onFetch(uname.trim()); }}
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              {/* input får hele bredden — tastene bor på egen rad under */}
              <input
                ref={inputRef}
                className="uname"
                value={uname}
                onChange={(e) => setUname(e.target.value)}
                placeholder="username…"
                enterKeyHint="go"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                name={`user-${side}`}
                aria-label="Letterboxd username"
                tabIndex={flipped ? 0 : -1}
                style={{
                  width: "100%", minWidth: 0, fontFamily: MONO, fontSize: 16, color: INK,
                  background: "#CFCCC3", border: "1px solid rgba(28,27,25,0.18)",
                  borderRadius: 3, padding: "4px 9px",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.18)",
                }}
              />
              <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                <Key small color="ink" type="submit" disabled={fetching || !uname.trim()} tabIndex={flipped ? 0 : -1} style={{ flex: 1 }}>
                  {fetching ? "…" : "fetch"}
                </Key>
                <Key small color="white" type="button" onClick={() => fileRef.current && fileRef.current.click()} tabIndex={flipped ? 0 : -1} aria-label="Upload watchlist.csv" title="Upload watchlist.csv"><IconFile /></Key>
                <Key small color="white" type="button" onClick={() => setFlipped(false)} aria-label="Close" tabIndex={flipped ? 0 : -1}>✕</Key>
              </div>
              <span role={error ? "alert" : undefined} style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: 1, color: error ? ERROR : DIM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {error || "or drop watchlist.csv here"}
              </span>
            </form>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        style={{ display: "none" }}
      />
    </div>
  );
}

/* ── duell-vindu: flipbox — fronten flakser, baksiden er detaljer ── */

function DuelWindow({ label, accent, film, info, spinning, spinKey, landed, delay, onSettle, isWinner, isLoser, flashing, canOpen, onOpen, flipped, onClose }) {
  return (
    <div
      className={`flipbox duel-win${flipped ? " flipped" : ""}${flashing ? " flash" : ""}${isLoser ? " loser" : ""}${isWinner ? " winner" : ""}`}
      style={{ borderRadius: 6 }}
    >
      <div className="flip-inner">
        <div
          className="flip-face"
          {...(canOpen ? {
            role: "button",
            tabIndex: flipped ? -1 : 0,
            "aria-label": `Details for ${film.name}`,
            onClick: onOpen,
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(e); }
            },
          } : {})}
          style={{ cursor: canOpen ? "pointer" : "default" }}
        >
          {/* indre wrapper klipper (facen selv kan ikke ha overflow:hidden) */}
          <div style={{
            position: "absolute", inset: 0, overflow: "hidden", borderRadius: 6,
            background: INK, padding: "30px 12px 16px",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", textAlign: "center",
          }}>
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(120% 100% at 50% 0%, rgba(255,255,255,0.06), transparent 60%)",
              pointerEvents: "none",
            }} />
            {/* topp-etikett — bytter til WINNER-stempel når kortet vinner */}
            {film && (
              <div style={{
                position: "absolute", top: isWinner ? 6 : 9, left: 0, right: 0,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                {isWinner ? (
                  <span className="stamp" style={{
                    border: `2px solid ${RED}`, color: RED, borderRadius: 3,
                    fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: "0.2em",
                    padding: "2px 12px 1px",
                  }}>
                    WINNER
                  </span>
                ) : (
                  <>
                    <span style={{ width: 7, height: 7, borderRadius: 1, background: accent }} />
                    <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: D_LABEL, textTransform: "uppercase" }}>
                      {label}
                    </span>
                  </>
                )}
              </div>
            )}
            {film ? (
              <>
                <SplitFlapDisplay
                  text={film.name}
                  spinning={spinning}
                  spinKey={spinKey}
                  landed={landed}
                  onSettle={onSettle}
                  compact
                  delay={delay}
                />
                {film.year && (
                  <div style={{ position: "relative", zIndex: 1, fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", color: D_HI, marginTop: 9 }}>
                    {film.year}
                  </div>
                )}
              </>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 11, color: D_LABEL, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                <span style={{ width: 7, height: 7, borderRadius: 1, background: accent }} />
                {label}
              </span>
            )}
          </div>
        </div>
        {film && (
          <DetailsBack flipped={flipped} film={film} info={info} whose={null} tight onClose={onClose} />
        )}
      </div>
    </div>
  );
}

/* ── kobber/PCB-lag: svakt synlige kretskort-spor bak alt ─────── */

/* ── kretskortet viser SIGNALVEIEN: List A/B → display → modus → Spin.
   Sporene måles mot de faktiske panelene og rutes med 45°-avfasede
   knekk (ekte PCB-ruting). Tegnes om når maskinen endrer størrelse
   (detaljstripe, undo-bar, brytepunkt). ────────────────────────── */

function routeDown(x0, y0, x1, y1, c = 6) {
  // ortogonal rute med 45°-avfasing der den svinger sidelengs
  if (Math.abs(x1 - x0) < 2 * c) return `M ${x0} ${y0} L ${x1} ${y1}`;
  const ym = (y0 + y1) / 2;
  const dir = x1 > x0 ? 1 : -1;
  return [
    `M ${x0} ${y0}`,
    `L ${x0} ${ym - c}`,
    `L ${x0 + c * dir} ${ym}`,
    `L ${x1 - c * dir} ${ym}`,
    `L ${x1} ${ym + c}`,
    `L ${x1} ${y1}`,
  ].join(" ");
}

function CircuitLayer({ dep }) {
  const ref = useRef(null);
  const [net, setNet] = useState(null);

  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const root = svg.parentElement;

    const draw = () => {
      const r0 = root.getBoundingClientRect();
      const box = (sel) => {
        const el = root.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left - r0.left, y: r.top - r0.top, w: r.width, h: r.height };
      };
      const la = box('[data-node="lista"]');
      const lb = box('[data-node="listb"]');
      const disp = box(".display-module") || box(".duel");
      const modes = box(".modes");
      const spin = box(".ctrl-spin");
      if (!la || !lb || !disp || !modes || !spin) { setNet(null); return; }

      // signalvei etter ny stabling: lister → modus → display → Spin
      const lines = [
        routeDown(la.x + la.w * 0.5, la.y + la.h, modes.x + modes.w * 0.2, modes.y),
        routeDown(lb.x + lb.w * 0.5, lb.y + lb.h, modes.x + modes.w * 0.8, modes.y),
        routeDown(modes.x + modes.w * 0.5, modes.y + modes.h, disp.x + disp.w * 0.5, disp.y),
        routeDown(disp.x + disp.w * 0.35, disp.y + disp.h, spin.x + spin.w * 0.5, spin.y),
      ];
      const vias = [
        { x: la.x + la.w * 0.5, y: la.y + la.h },
        { x: lb.x + lb.w * 0.5, y: lb.y + lb.h },
        { x: modes.x + modes.w * 0.5, y: modes.y + modes.h },
        { x: spin.x + spin.w * 0.5, y: spin.y },
      ];
      // SMD-pad-par ved display-inngangen
      const pads = [
        { x: disp.x + disp.w * 0.5 - 9, y: disp.y - 14 },
        { x: disp.x + disp.w * 0.5 + 4, y: disp.y - 14 },
      ];
      setNet({ w: r0.width, h: r0.height, lines, vias, pads });
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(root);
    return () => ro.disconnect();
  }, [dep]);

  return (
    <svg
      ref={ref}
      className="pcb"
      aria-hidden="true"
      {...(net ? { viewBox: `0 0 ${net.w} ${net.h}` } : {})}
    >
      {net && (
        <>
          <g fill="none" stroke="#b0742f" strokeWidth="1.4">
            {net.lines.map((d, i) => <path key={i} d={d} />)}
          </g>
          <g fill="#c08a4a">
            {net.vias.map((v, i) => <circle key={i} cx={v.x} cy={v.y} r="2.6" />)}
            {net.pads.map((p, i) => <rect key={i} x={p.x} y={p.y} width="5" height="7" rx="0.8" />)}
          </g>
        </>
      )}
    </svg>
  );
}

/* ── baksiden av «arket»: filmdetaljer der displayet var ───────── */

function DetailsBack({ flipped, film, info, whose, tight = false, onClose }) {
  const facts = [film.year, info?.runtime ? `${info.runtime} min` : null, info?.rating ? `★ ${info.rating}` : null]
    .filter(Boolean).join(" · ");
  return (
    <div
      className="flip-face flip-back"
      aria-hidden={!flipped}
      style={{
        background: PANEL_HI,
        border: `1px solid ${PANEL_LO}`,
        borderRadius: 7,
        boxShadow: "inset 0 1.5px 4px rgba(0,0,0,0.12)",
      }}
    >
      {/* indre wrapper klipper — selve facen kan ikke ha overflow:hidden (3D) */}
      <div style={{
        position: "absolute", inset: 0, overflow: "hidden", borderRadius: 7,
        padding: tight ? "9px 11px" : "13px 16px",
        display: "flex", flexDirection: "column", gap: tight ? 4 : 7, textAlign: "left",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: GROTESK, fontSize: tight ? 14 : 17, fontWeight: 700, letterSpacing: "-0.01em", color: INK }}>
            {film.name}
          </span>
          <Key small color="white" type="button" onClick={onClose} aria-label="Close" tabIndex={flipped ? 0 : -1}>✕</Key>
        </div>
        <div style={{ display: "flex", gap: tight ? 9 : 12, flex: 1, minHeight: 0 }}>
          {info?.poster && (
            <img
              src={info.poster} alt="" referrerPolicy="no-referrer" className="poster-fade"
              style={{
                width: tight ? 56 : 88, aspectRatio: "2 / 3", objectFit: "cover", borderRadius: 3,
                flexShrink: 0, background: "#cfccc3", boxShadow: "0 3px 10px -5px rgba(0,0,0,0.5)", alignSelf: "flex-start",
              }}
            />
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            {facts && (
              <div style={{ fontFamily: MONO, fontSize: tight ? 10 : 11, color: DIM, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {facts}
              </div>
            )}
            {info?.director && (
              <div style={{ fontFamily: MONO, fontSize: tight ? 10.5 : 11.5, fontWeight: 700, color: INK, lineHeight: 1.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                dir. {info.director}
              </div>
            )}
            {info?.cast?.length > 0 && (
              <div style={{
                fontFamily: MONO, fontSize: tight ? 10 : 11, color: DIM, lineHeight: 1.5, marginTop: 2,
                /* alle tre skal med — bryt heller enn å klippe */
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {info.cast.join(" · ")}
              </div>
            )}
            {!tight && info?.genres?.length > 0 && (
              <div style={{ fontFamily: MONO, fontSize: 11, color: DIM, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {info.genres.join(" · ")}
              </div>
            )}
            {info?.synopsis && (
              <p style={{
                margin: tight ? "4px 0 0" : "6px 0 0", fontFamily: GROTESK, fontSize: tight ? 11.5 : 12.5, lineHeight: 1.45, color: INK,
                display: "-webkit-box", WebkitLineClamp: tight ? 4 : 6, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {info.synopsis}
              </p>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
          {whose && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 10.5, color: DIM }}>
              <span style={{ width: 7, height: 7, borderRadius: 1, background: whose.color }} />
              {whose.label}
            </span>
          )}
          {film.uri && (
            <a href={film.uri} target="_blank" rel="noreferrer" tabIndex={flipped ? 0 : -1}
              style={{
                fontFamily: MONO, fontSize: 11, fontWeight: 700, color: INK,
                textDecoration: "underline", textDecorationColor: BLUE,
                textDecorationThickness: 2, textUnderlineOffset: 3,
                /* 44px treffflate uten å flytte layout */
                padding: "12px 2px", margin: "-12px -2px",
              }}>
              Letterboxd ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── selve maskinen ───────────────────────────────────────────── */

export default function Videokisen() {
  const [a, setA] = useState(() => ({ ...EMPTY_SLOT, person: DEFAULT_PERSON.a, ...(saved?.a || {}) }));
  const [b, setB] = useState(() => ({ ...EMPTY_SLOT, person: DEFAULT_PERSON.b, ...(saved?.b || {}) }));
  const [mode, setMode] = useState(saved?.mode || "all");
  const [noRepeat, setNoRepeat] = useState(saved?.noRepeat ?? true);
  const [soundOn, setSoundOn] = useState(saved?.soundOn ?? false);
  const [excluded, setExcluded] = useState(() => new Set(saved?.excluded || []));
  const [fetching, setFetching] = useState({ a: false, b: false });
  const [errors, setErrors] = useState({ a: null, b: null });
  const [undo, setUndo] = useState(null); // { key, name } etter "seen it"
  const undoTimer = useRef(null);

  const [picks, setPicks] = useState([null, null]);
  const [displays, setDisplays] = useState([null, null]);
  const [spinning, setSpinning] = useState(false);
  const [spinKey, setSpinKey] = useState(0);   // bumpes per spinn → trigger flap-flutter
  const pendingTarget = useRef(null);           // filmen flappene lander på (enkeltmodus)
  const pendingDuel = useRef(null);             // [filmA, filmB] i duell
  const [detailsIdx, setDetailsIdx] = useState(null); // 0/1 = film snudd til detaljer, null = lukket
  const [lockHint, setLockHint] = useState(false);    // klikk på låst modus → forklaring i displayet
  const [respin, setRespin] = useState(false);        // auto-spinn etter «Seen it»
  const lockHintTimer = useRef(null);
  const detailsAnchorRef = useRef(null);
  const [deciding, setDeciding] = useState(false);
  const [winner, setWinner] = useState(null); // 0 | 1 | null
  const [flash, setFlash] = useState(null);   // vindu som lyser under tie-break

  const [details, setDetails] = useState({});
  const requestedDetails = useRef(new Set());

  const timers = useRef([]);
  const landedRef = useRef(0);

  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => () => clearTimeout(lockHintTimer.current), []);
  useEffect(() => { setSoundEnabled(soundOn); }, [soundOn]);

  // detalj-flip: Escape snur tilbake; fokus inn på ✕ og tilbake til feltet
  useEffect(() => {
    if (detailsIdx === null) return;
    const t = setTimeout(() => {
      document.querySelector(".flipbox.flipped .flip-back button")?.focus();
    }, 340);
    const onKey = (e) => { if (e.key === "Escape") setDetailsIdx(null); };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      detailsAnchorRef.current?.focus?.();
    };
  }, [detailsIdx]);

  // hent plakat + fakta for filmene hjulet har landet på (én gang per film)
  useEffect(() => {
    if (spinning) return;
    picks.filter(Boolean).forEach((f) => {
      const k = keyOf(f);
      if (!f.uri || requestedDetails.current.has(k)) return;
      requestedDetails.current.add(k);
      fetchFilmDetails(f.uri)
        .then((info) => setDetails((d) => ({ ...d, [k]: info })))
        .catch(() => {
          /* transient feil skal ikke sperre filmen resten av økta —
             neste landing på samme film prøver igjen */
          requestedDetails.current.delete(k);
        });
    });
  }, [picks, spinning]);

  const detailsFor = (f) => (f ? details[keyOf(f)] || null : null);

  useEffect(() => {
    saveState({
      a: { films: a.films, filename: a.filename, username: a.username, person: a.person, total: a.total },
      b: { films: b.films, filename: b.filename, username: b.username, person: b.person, total: b.total },
      mode, noRepeat, soundOn, excluded: [...excluded],
    });
  }, [a, b, mode, noRepeat, soundOn, excluded]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const resetRound = useCallback(() => {
    setPicks([null, null]);
    setDisplays([null, null]);
    setWinner(null);
    setFlash(null);
  }, []);

  /* ── innmating ── */

  const setterFor = (which) => (which === "a" ? setA : setB);

  const fetchInto = (which) => async (username) => {
    setErrors((e) => ({ ...e, [which]: null }));
    setFetching((f) => ({ ...f, [which]: true }));
    try {
      const data = await fetchWatchlist(username);
      setterFor(which)((s) => ({
        ...s,
        films: data.films,
        username: data.user,
        filename: "",
        total: data.total,
        person: s.person === DEFAULT_PERSON[which] ? data.user : s.person,
      }));
      resetRound();
    } catch (err) {
      setErrors((e) => ({ ...e, [which]: FETCH_ERRORS[err.message] || FETCH_ERRORS.unknown }));
    } finally {
      setFetching((f) => ({ ...f, [which]: false }));
    }
  };

  const loadInto = (which) => async (file) => {
    setErrors((e) => ({ ...e, [which]: null }));
    try {
      const films = await parseCsv(file);
      setterFor(which)((s) => ({ ...s, films, filename: file.name, username: "", total: films.length }));
      resetRound();
    } catch (err) {
      setErrors((e) => ({ ...e, [which]: FETCH_ERRORS[err.message] || FETCH_ERRORS.csv_empty }));
    }
  };

  const clearSlot = (which) => () => {
    setterFor(which)((s) => ({ ...s, ...EMPTY_SLOT }));
    setErrors((e) => ({ ...e, [which]: null }));
    resetRound();
  };

  const setPerson = (which) => (person) => setterFor(which)((s) => ({ ...s, person }));

  /* ── potter ── */

  const aKeys = useMemo(() => new Set(a.films.map(keyOf)), [a.films]);
  const bKeys = useMemo(() => new Set(b.films.map(keyOf)), [b.films]);
  const overlap = useMemo(() => a.films.filter((f) => bKeys.has(keyOf(f))), [a.films, bKeys]);
  const union = useMemo(() => {
    const seen = new Set(); const out = [];
    for (const f of [...a.films, ...b.films]) {
      const k = keyOf(f);
      if (seen.has(k)) continue;
      seen.add(k); out.push(f);
    }
    return out;
  }, [a.films, b.films]);

  const minusSeen = useCallback(
    (list) => (noRepeat ? list.filter((f) => !excluded.has(keyOf(f))) : list),
    [noRepeat, excluded]
  );

  const poolSingle = useMemo(
    () => minusSeen(mode === "date" ? overlap : union),
    [mode, overlap, union, minusSeen]
  );
  const poolA = useMemo(() => minusSeen(a.films), [a.films, minusSeen]);
  const poolB = useMemo(() => minusSeen(b.films), [b.films, minusSeen]);

  const bothLoaded = a.films.length > 0 && b.films.length > 0;
  const oneLoaded = a.films.length > 0 || b.films.length > 0;
  const isDuel = mode === "duell";

  const canSpin = isDuel
    ? bothLoaded && poolA.length > 0 && poolB.length > 0
    : (mode === "date" ? bothLoaded : oneLoaded) && poolSingle.length > 0;

  const whose = useCallback((f) => {
    const inA = aKeys.has(keyOf(f));
    const inB = bKeys.has(keyOf(f));
    if (inA && inB) return { label: "both lists", color: GREEN };
    if (inA) return { label: a.person, color: ORANGE };
    return { label: b.person, color: BLUE };
  }, [aKeys, bKeys, a.person, b.person]);

  /* ── spinn ── */

  const rand = (list) => list[Math.floor(Math.random() * list.length)];

  const spin = () => {
    if (spinning || deciding || !canSpin) return;
    clearTimers();
    setWinner(null);
    setFlash(null);
    setPicks([null, null]);

    if (isDuel) {
      const tA = rand(poolA);
      const tB = rand(poolB);
      pendingDuel.current = [tA, tB];
      if (reducedMotion) {
        setDisplays([tA, tB]);
        setPicks([tA, tB]);
        clunk();
        return;
      }
      // begge vinduene flakser samtidig; B har ekstra delay og lander sist — drama
      setDisplays([tA, tB]);
      setSpinning(true);
      landedRef.current = 0;
      setSpinKey((k) => k + 1);
    } else {
      const target = rand(poolSingle);
      pendingTarget.current = target;
      if (reducedMotion) {
        setDisplays([target, null]);
        setPicks([target, null]);
        clunk();
        return;
      }
      // Målet settes med én gang som tekst; SplitFlapDisplay flakser fram til
      // det og kaller onFlapSettle når raden har roet seg (den eier timingen).
      setDisplays([target, null]);
      setSpinning(true);
      setSpinKey((k) => k + 1);
    }
  };

  // duell: hvert vindu melder fra når flap-raden har roet seg
  const onDuelSettle = useCallback((idx) => {
    const t = pendingDuel.current?.[idx];
    if (!t) return;
    setPicks((p) => { const n = [...p]; n[idx] = t; return n; });
    clunk();
    buzz([26, 30, 22]);
    landedRef.current += 1;
    if (landedRef.current >= 2) setSpinning(false);
  }, []);

  // enkeltmodus: flap-raden har landet → sett resultatet, hent detaljer
  const onFlapSettle = useCallback(() => {
    const target = pendingTarget.current;
    if (!target) return;
    setPicks([target, null]);
    setSpinning(false);
    clunk();
    buzz([26, 30, 22]);
  }, []);

  /* ── tie-break: highlighten hopper mellom vinduene og bremser ── */

  const decide = () => {
    if (deciding || spinning || winner !== null) return;
    const target = Math.random() < 0.5 ? 0 : 1;
    if (reducedMotion) {
      setWinner(target);
      win();
      return;
    }
    setDeciding(true);
    clearTimers();
    const steps = 15;
    let acc = 0;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      acc += 70 + Math.pow(t, 2.2) * 380;
      const idx = (target + (steps - 1 - i)) % 2; // alternerer og ender på target
      const isLast = i === steps - 1;
      timers.current.push(
        setTimeout(() => {
          setFlash(idx);
          tick();
          buzz(8);
          if (isLast) {
            setWinner(target);
            setFlash(null);
            setDeciding(false);
            win();
            buzz([40, 50, 90]);
          }
        }, acc)
      );
    }
  };

  /* ── sett den ── */

  const duelLanded = isDuel && picks[0] && picks[1];
  const fate = duelLanded && keyOf(picks[0]) === keyOf(picks[1]);
  const chosenFilm = isDuel
    ? (fate ? picks[0] : winner !== null ? picks[winner] : null)
    : picks[0];

  const markWatched = () => {
    if (!chosenFilm) return;
    const k = keyOf(chosenFilm);
    setExcluded((s) => new Set(s).add(k));
    setUndo({ key: k, name: chosenFilm.name });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
    resetRound();
    setRespin(true); // «seen it» betyr «gi meg en annen» — spinn videre selv
  };

  const undoWatched = () => {
    if (!undo) return;
    setExcluded((s) => { const n = new Set(s); n.delete(undo.key); return n; });
    setUndo(null);
    clearTimeout(undoTimer.current);
  };

  const resetExcluded = () => setExcluded(new Set());

  const switchMode = (id) => {
    clearTimers();
    setSpinning(false);
    setDeciding(false);
    setMode(id);
    resetRound();
  };

  /* ── tekster for tomme tilstander ── */

  // (!oneLoaded dekkes av boot-skjermen i displayet)
  const emptyText = !bothLoaded && mode !== "all"
      ? "ADD A SECOND LIST FOR THIS MODE"
      : mode === "date" && overlap.length === 0
        ? "NO SHARED FILMS — TRY ROULETTE"
        : "EVERYTHING’S BEEN SEEN";

  // alt i poolen er markert sett → Spin blir en reset-tast (displayteksten
  // «EVERYTHING'S BEEN SEEN» pekte før på en liten lenke et helt annet sted)
  const exhausted =
    noRepeat && excluded.size > 0 && !canSpin &&
    (isDuel
      ? bothLoaded && (poolA.length === 0 || poolB.length === 0)
      : (mode === "date" ? overlap : union).length > 0 && poolSingle.length === 0 && (mode !== "date" || bothLoaded));

  const shown = displays[0] || picks[0];
  const landed = picks[0] && !spinning;
  const canOpen = (idx) => !spinning && !!picks[idx] && !!(detailsFor(picks[idx]) || picks[idx]?.uri);
  const canOpenDetails = !isDuel && canOpen(0);

  // «snu arket»: feltet flipper til detaljene sine
  const openDetails = (idx) => (e) => {
    detailsAnchorRef.current = e.currentTarget;
    setDetailsIdx(idx);
  };

  // resultatet forsvant (nytt spinn/modusbytte) → lukk popupen
  useEffect(() => {
    if (detailsIdx !== null && !(picks[detailsIdx] && !spinning)) setDetailsIdx(null);
  }, [detailsIdx, picks, spinning]);

  // auto-respinn etter «Seen it» — venter på at excluded har slått inn i poolene
  useEffect(() => {
    if (!respin) return;
    setRespin(false);
    if (canSpin && !spinning && !deciding) spin();
  });

  return (
    <div className="page" style={{
      minHeight: "100%", backgroundColor: "#B9B6AC",
      fontFamily: GROTESK, color: INK,
      display: "flex", justifyContent: "center",
    }}>
      {/* ── GRID-REGLER ─────────────────────────────────────────────
          Indre bredde W = 560 − 2×18. Gutter = 10px overalt.
          Stabling: lister (2 kol) → modus (3 kol) → display → bunn.
          Bunn (.ctrl-grid) = 4 kol på én rad: Spin span 2 (= 2-kol-
          linja), Seen it kol 3, No repeats kol 4 — faste posisjoner,
          null hopping. Mobil <520px: Spin hel rad, de to andre halve.
          Maskinen har FAST høyde: flip-lister, statuslinje og display
          er faste; detaljer og undo bor i popup/toast.
          ───────────────────────────────────────────────────────── */}
      <main className="machine" style={{
        width: "100%", maxWidth: 560, alignSelf: "flex-start",
        border: `1px solid ${PANEL_LO}`,
        borderRadius: 8,
        boxShadow: "0 1px 0 rgba(255,255,255,0.5) inset, 0 18px 40px -22px rgba(0,0,0,0.55)",
        overflow: "hidden",
        position: "relative",
      }}>
        {/* clear-tech-lag: koblinger bakerst → lysdiffusjon → frost → gloss */}
        <CircuitLayer dep={mode} />
        <div className="light-blob warm" aria-hidden="true" />
        <div className="light-blob cool" aria-hidden="true" />
        <div className="frost" />
        <div className="machine-gloss" />
        <div style={{ position: "relative", zIndex: 1 }}>
        {/* Topplinje */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 18px 14px", borderBottom: `1px solid ${PANEL_LO}`,
        }}>
          <div>
            <h1 style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-0.025em", margin: 0, lineHeight: 1 }}>Videokisen</h1>
            <div style={{ fontFamily: DOT, fontWeight: 900, fontSize: 13, color: DIM, letterSpacing: "0.13em", marginTop: 5 }}>
              ONE SPIN · ONE FILM
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Key
              small
              color="white"
              onClick={() => setSoundOn(!soundOn)}
              aria-pressed={soundOn}
              aria-label={soundOn ? "Sound on" : "Sound off"}
              capStyle={{ minWidth: 20 }}
            >
              <SpeakerIcon muted={!soundOn} />
            </Key>
          </div>
        </header>

        {/* Innmating */}
        <div className="slots" style={{ padding: "14px 18px 0" }}>
          <FlipSlot
            side="List A" node="lista" slot={a} accent={ORANGE}
            fetching={fetching.a} error={errors.a}
            onFile={loadInto("a")} onFetch={fetchInto("a")}
            onPersonChange={setPerson("a")} onClear={clearSlot("a")}
          />
          <FlipSlot
            side="List B" node="listb" slot={b} accent={BLUE} optional attn={lockHint && b.films.length === 0}
            fetching={fetching.b} error={errors.b}
            onFile={loadInto("b")} onFetch={fetchInto("b")}
            onPersonChange={setPerson("b")} onClear={clearSlot("b")}
          />
        </div>

        {/* Modus — tre taster i Letterboxd-fargene. Låste taster er
            fortsatt klikkbare (aria-disabled, ikke disabled) og forklarer
            seg i displayet i stedet for å være stumme. */}
        <div className="modes" role="group" aria-label="Mode" style={{ display: "flex", gap: 10, padding: "12px 18px 0" }}>
          {MODES.map((m) => {
            const on = mode === m.id;
            const lockedMode = m.id !== "all" && !bothLoaded;
            return (
              <Key
                key={m.id}
                color={m.color}
                on={on}
                aria-pressed={on}
                aria-disabled={lockedMode || undefined}
                className={lockedMode ? "locked" : ""}
                title={lockedMode ? "Add List B to unlock" : undefined}
                onClick={() => {
                  if (!lockedMode) { switchMode(m.id); return; }
                  setLockHint(true);
                  clearTimeout(lockHintTimer.current);
                  lockHintTimer.current = setTimeout(() => setLockHint(false), 2600);
                }}
                style={{ flex: 1 }}
                capStyle={{ fontFamily: GROTESK, fontSize: 13, fontWeight: 700, letterSpacing: "0.01em", textTransform: "none" }}
              >
                {m.label}
              </Key>
            );
          })}
        </div>

        {/* Status-stripe — fast høyde, innholdet kommer og går */}
        <div style={{
          display: "flex", gap: 18, padding: "9px 18px", minHeight: 34,
          fontFamily: MONO, fontSize: 11.5, color: DIM, flexWrap: "wrap", alignItems: "baseline",
        }}>
          {oneLoaded && (
            <>
              {bothLoaded && <span><b style={{ color: INK }}>{overlap.length}</b> overlap</span>}
              <span><b style={{ color: INK }}>{union.length}</b> {bothLoaded ? "combined" : films(union.length)}</span>
              {noRepeat && excluded.size > 0 && (
                <span>
                  <b style={{ color: INK }}>{excluded.size}</b> seen ·{" "}
                  <button className="linkbtn" onClick={resetExcluded}>reset</button>
                </span>
              )}
            </>
          )}
        </div>

        {/* Display */}
        <div style={{ padding: "6px 18px 4px" }}>
          {isDuel && bothLoaded && (canSpin || duelLanded) ? (
            <div className="duel">
              <DuelWindow
                label={a.person} accent={ORANGE} film={displays[0]}
                info={detailsFor(picks[0])}
                spinning={spinning} spinKey={spinKey} landed={!!picks[0] && !spinning}
                delay={0} onSettle={() => onDuelSettle(0)}
                isWinner={winner === 0} isLoser={winner === 1}
                flashing={flash === 0}
                canOpen={canOpen(0)} onOpen={openDetails(0)}
                flipped={detailsIdx === 0} onClose={() => setDetailsIdx(null)}
              />
              <div className="duel-vs" aria-hidden="true" style={{
                alignSelf: "center", flexShrink: 0,
                width: 34, height: 34, borderRadius: "50%",
                background: fate ? RED : INK, color: "#F5F3EC",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
                boxShadow: "0 2px 0 rgba(0,0,0,0.2)",
              }}>
                {fate ? "=" : "VS"}
              </div>
              <DuelWindow
                label={b.person} accent={BLUE} film={displays[1]}
                info={detailsFor(picks[1])}
                spinning={spinning} spinKey={spinKey} landed={!!picks[1] && !spinning}
                delay={520} onSettle={() => onDuelSettle(1)}
                isWinner={winner === 1} isLoser={winner === 0}
                flashing={flash === 1}
                canOpen={canOpen(1)} onOpen={openDetails(1)}
                flipped={detailsIdx === 1} onClose={() => setDetailsIdx(null)}
              />
            </div>
          ) : (
            /* FAST høyde — rommer to flap-linjer; «snur arket» til detaljer */
            <div className={`flipbox${!isDuel && detailsIdx === 0 ? " flipped" : ""}`} style={{ height: 264 }}>
              <div className="flip-inner">
              <div className="flip-face">
              <div
                className="display-module"
                /* landet display = knapp som snur arket til filmdetaljene */
                {...(canOpenDetails ? {
                  role: "button",
                  tabIndex: detailsIdx === 0 ? -1 : 0,
                  "aria-label": `Details for ${picks[0].name}`,
                  onClick: openDetails(0),
                  onKeyDown: (e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetails(0)(e); }
                  },
                } : {})}
                style={{
                  height: "100%", padding: "26px 20px 30px", display: "flex",
                  flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center",
                  cursor: canOpenDetails ? "pointer" : "default",
                }}
              >
              {lockHint ? (
                <span role="status" style={{ position: "relative", zIndex: 1, color: D_HI, fontFamily: DOT, fontWeight: 900, fontSize: 14, letterSpacing: "0.12em" }}>
                  ADD LIST B TO UNLOCK
                </span>
              ) : !canSpin && !shown ? (
                !oneLoaded ? (
                  /* boot-skjerm: onboardingen bor i maskinens eget display */
                  <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 16, textAlign: "left", maxWidth: 420 }}>
                    {[
                      ["1", "FETCH A LETTERBOXD WATCHLIST"],
                      ["2", "ADD A FRIEND FOR MOVIE NIGHT & DUEL"],
                      ["3", "SPIN — THE MACHINE DECIDES"],
                    ].map(([n, t]) => (
                      <div key={n} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                        <span style={{ fontFamily: DOT, fontWeight: 900, fontSize: 13, color: D_HI, flexShrink: 0 }}>{n}</span>
                        <span style={{ fontFamily: DOT, fontWeight: 900, fontSize: 13, letterSpacing: "0.1em", color: D_EMPTY, lineHeight: 1.6 }}>{t}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ position: "relative", zIndex: 1, color: D_EMPTY, fontFamily: DOT, fontWeight: 900, fontSize: 14, letterSpacing: "0.12em" }}>
                    {emptyText}
                  </span>
                )
              ) : shown ? (
                <>
                  <SplitFlapDisplay
                    text={(displays[0] || picks[0])?.name || ""}
                    spinning={spinning}
                    spinKey={spinKey}
                    landed={landed}
                    onSettle={onFlapSettle}
                  />
                  {shown.year && (
                    <div style={{
                      position: "relative", zIndex: 1, marginTop: 15,
                      fontFamily: MONO, fontSize: 12, letterSpacing: "0.14em", color: D_HI,
                    }}>
                      {landed
                        ? [shown.year,
                           detailsFor(picks[0])?.runtime ? `${detailsFor(picks[0]).runtime} MIN` : null,
                           detailsFor(picks[0])?.rating ? `★ ${detailsFor(picks[0]).rating}` : null,
                          ].filter(Boolean).join("  ·  ")
                        : shown.year}
                    </div>
                  )}
                  {canOpenDetails && (
                    <span className="settled" style={{
                      position: "absolute", bottom: 9, left: 0, right: 0, zIndex: 1,
                      fontFamily: DOT, fontWeight: 900, fontSize: 11, letterSpacing: "0.16em", color: D_EMPTY,
                    }}>
                      TAP FOR DETAILS
                    </span>
                  )}
                </>
              ) : (
                <span style={{ position: "relative", zIndex: 1, color: D_EMPTY, fontFamily: DOT, fontWeight: 900, fontSize: 14, letterSpacing: "0.12em" }}>
                  READY · PRESS SPIN
                </span>
              )}
              </div>
              </div>
              {picks[0] && (
                <DetailsBack
                  flipped={!isDuel && detailsIdx === 0}
                  film={picks[0]}
                  info={detailsFor(picks[0])}
                  whose={bothLoaded ? whose(picks[0]) : null}
                  onClose={() => setDetailsIdx(null)}
                />
              )}
              </div>
            </div>
          )}
        </div>

        {/* skjermleser: annonser resultatet */}
        <div aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>
          {chosenFilm ? `Chosen film: ${chosenFilm.name} ${chosenFilm.year}` : ""}
        </div>

        {/* Kontroller */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "10px 18px 20px" }}>
          {isDuel && bothLoaded && (
            fate ? (
              <div className="settled" style={{
                display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44,
                fontFamily: MONO, fontSize: 11.5, color: RED, letterSpacing: "0.14em", fontWeight: 700,
              }}>
                FATE · SAME FILM ON BOTH LISTS
              </div>
            ) : (
              <Key
                color="ink"
                onClick={decide}
                disabled={deciding || !(duelLanded && winner === null)}
                capStyle={{ fontSize: 12, letterSpacing: "0.16em", minHeight: 38 }}
              >
                {deciding ? "DECIDING…" : "LET THE MACHINE DECIDE"}
              </Key>
            )
          )}

          <div className="ctrl-grid">
            <Key
              color="orange"
              className="ctrl-spin"
              onClick={exhausted ? resetExcluded : spin}
              disabled={spinning || deciding || (!canSpin && !exhausted)}
              capStyle={{ fontFamily: GROTESK, fontSize: 17, fontWeight: 700, letterSpacing: "0.01em", textTransform: "none", minHeight: 40 }}
            >
              {spinning ? "spinning…" : exhausted ? "Reset seen" : picks[0] ? "Spin again" : "Spin"}
            </Key>

            {chosenFilm && !spinning && !deciding && (
              <Key color="ink" className="ctrl-seen" onClick={markWatched} capStyle={{ minHeight: 40 }}>
                Seen it ✓
              </Key>
            )}

            <Key
              color="white"
              className="ctrl-norepeat"
              on={noRepeat}
              role="switch"
              aria-checked={noRepeat}
              onClick={() => setNoRepeat(!noRepeat)}
              capStyle={{ minHeight: 40, fontSize: 10.5 }}
            >
              No repeats
            </Key>
          </div>
        </div>
        </div>

        {/* Undo-toast — flyter over bunnen, dytter ingenting */}
        {undo && (
          <div className="toast settled" role="status" style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
            fontFamily: MONO, fontSize: 11, color: DIM,
            background: PANEL_HI, border: `1px solid ${PANEL_LO}`, borderRadius: 5, padding: "8px 12px",
            boxShadow: "0 8px 20px -10px rgba(0,0,0,0.4)",
          }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Marked “{undo.name}” as seen
            </span>
            <button className="linkbtn" onClick={undoWatched} style={{ flexShrink: 0 }}>undo</button>
          </div>
        )}
      </main>
    </div>
  );
}
