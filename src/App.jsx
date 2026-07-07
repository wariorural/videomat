import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
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
const ORANGE = "#FF8000";     // Letterboxd oransje = liste A
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

const MODES = [
  { id: "all", label: "Roulette", sub: "the whole pool", dot: INK },
  { id: "date", label: "Movie night", sub: "overlap only", dot: GREEN },
  { id: "duell", label: "Duel", sub: "one from each", dot: RED },
];

const DEFAULT_PERSON = { a: "You", b: "Partner" };
const EMPTY_SLOT = { films: [], filename: "", username: "", total: 0 };

const saved = loadState();

function buzz(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* iOS støtter ikke vibrate — stille nei er riktig svar */
  }
}

const ghostBtn = {
  fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
  color: INK, background: "transparent", border: `1px solid rgba(28,27,25,0.32)`,
  borderRadius: 3, padding: "8px 12px", cursor: "pointer", minHeight: 34,
};

function Dot({ c }) {
  return <span style={{ width: 9, height: 9, borderRadius: "50%", background: c, display: "inline-block", boxShadow: "inset 0 1px 1px rgba(0,0,0,0.25)" }} />;
}

/* ── liste-slot: brukernavn primært, CSV som fallback ─────────── */

function UploadSlot({ side, slot, accent, optional, fetching, error, onFile, onFetch, onPersonChange, onClear }) {
  const fileRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [uname, setUname] = useState(slot.username || "");
  const loaded = slot.films.length > 0;

  const handleFiles = (fileList) => {
    const f = fileList && fileList[0];
    if (f) onFile(f);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
      style={{
        flex: 1,
        border: `1.5px solid ${loaded ? accent : "rgba(28,27,25,0.22)"}`,
        background: drag ? PANEL_HI : "transparent",
        borderRadius: 4,
        padding: "12px 12px 11px",
        transition: "background 120ms, border-color 120ms",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: accent, display: "inline-block", flexShrink: 0 }} />
        <span style={{ fontFamily: DOT, fontWeight: 900, fontSize: 13, letterSpacing: "0.16em", color: DIM, textTransform: "uppercase" }}>
          {side}
        </span>
      </div>

      {loaded ? (
        <div>
          <input
            className="rename"
            value={slot.person}
            onChange={(e) => onPersonChange(e.target.value)}
            aria-label="Display name (tap to rename)"
            title="Tap to rename"
            name={`name-${side}`}
            autoComplete="off"
            style={{
              fontFamily: GROTESK, fontSize: 16, fontWeight: 600, color: INK,
              background: "transparent", border: "1px solid transparent",
              borderBottom: "1px dashed rgba(28,27,25,0.35)",
              borderRadius: 3, padding: "2px 4px", width: "100%", minWidth: 0,
            }}
          />
          <div style={{ fontFamily: MONO, fontSize: 12, color: DIM, marginTop: 4 }}>
            {slot.films.length} films · {slot.username ? `@${slot.username}` : slot.filename}
          </div>
          {slot.total > slot.films.length && (
            <div style={{ fontFamily: MONO, fontSize: 11, color: ERROR, marginTop: 2 }}>
              fetched {slot.films.length} of {slot.total}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {slot.username && (
              <button className="press" onClick={() => onFetch(slot.username)} disabled={fetching} style={{ ...ghostBtn, opacity: fetching ? 0.5 : 1 }}>
                {fetching ? "fetching…" : "refresh"}
              </button>
            )}
            <button className="press" onClick={onClear} style={ghostBtn}>change</button>
          </div>
        </div>
      ) : (
        <div>
          <form
            onSubmit={(e) => { e.preventDefault(); if (uname.trim()) onFetch(uname.trim()); }}
            style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
          >
            <input
              className="uname"
              value={uname}
              onChange={(e) => setUname(e.target.value)}
              placeholder="letterboxd username"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              name={`user-${side}`}
              aria-label="Letterboxd username"
              style={{
                flex: "1 1 110px", minWidth: 0, fontFamily: MONO, fontSize: 16, color: INK,
                background: "#CFCCC3", border: "1px solid rgba(28,27,25,0.18)",
                borderRadius: 3, padding: "9px 10px",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.18)",
              }}
            />
            <button
              type="submit"
              className="press"
              disabled={fetching || !uname.trim()}
              style={{
                ...ghostBtn, background: INK, color: "#F5F3EC", border: `1px solid ${INK}`,
                opacity: fetching || !uname.trim() ? 0.45 : 1,
              }}
            >
              {fetching ? "…" : "fetch"}
            </button>
          </form>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: DIM, marginTop: 6, lineHeight: 1.4 }}>
            {optional
              ? "optional — a friend's username unlocks Movie night & Duel"
              : "any public Letterboxd watchlist"}
          </div>
          <button
            className="press"
            onClick={() => fileRef.current && fileRef.current.click()}
            style={{ ...ghostBtn, fontSize: 10, padding: "6px 10px", minHeight: 30, marginTop: 8 }}
          >
            or upload watchlist.csv
          </button>
        </div>
      )}

      {error && (
        <div role="alert" style={{ fontFamily: MONO, fontSize: 11, color: ERROR, marginTop: 8, lineHeight: 1.4 }}>
          {error}
        </div>
      )}

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

/* ── filmkort: plakat + fakta når hjulet har landet ───────────── */

function FilmCard({ film, info, big }) {
  return (
    <div style={{ display: "flex", gap: big ? 16 : 12, alignItems: "flex-start", textAlign: "left", width: "100%", minWidth: 0 }}>
      {info.poster && (
        <img
          src={info.poster}
          alt=""
          referrerPolicy="no-referrer"
          className="poster-fade"
          style={{
            width: big ? 104 : 64, aspectRatio: "2 / 3", objectFit: "cover",
            borderRadius: 4, flexShrink: 0, background: "#2a2926",
            boxShadow: "0 4px 14px -6px rgba(0,0,0,0.8)",
          }}
        />
      )}
      <div style={{ minWidth: 0 }}>
        <div className="balance" style={{
          fontFamily: GROTESK, fontWeight: 700, color: "#F5F3EC",
          fontSize: big ? "clamp(22px, 6.2vw, 32px)" : "clamp(16px, 4.2vw, 20px)",
          lineHeight: 1.08, letterSpacing: "-0.02em", overflowWrap: "break-word",
        }}>
          {film.name}
        </div>
        <div style={{ fontFamily: MONO, fontSize: big ? 12 : 11, color: D_HI, marginTop: 6 }}>
          {[film.year, info.runtime ? `${info.runtime} min` : null, info.rating ? `★ ${info.rating}` : null]
            .filter(Boolean).join(" · ")}
        </div>
        {(info.director || info.genres?.length > 0) && (
          <div style={{ fontFamily: MONO, fontSize: big ? 11 : 10, color: D_MID, marginTop: 2 }}>
            {[info.director ? `dir. ${info.director}` : null, info.genres?.length ? info.genres.join(" · ") : null]
              .filter(Boolean).join(" — ")}
          </div>
        )}
        {info.synopsis && (
          <div style={{ fontFamily: GROTESK, fontSize: big ? 13 : 11.5, lineHeight: 1.5, color: "#c3c1b8", marginTop: big ? 9 : 6 }}>
            {info.synopsis}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── duell-vindu ──────────────────────────────────────────────── */

function DuelWindow({ label, accent, film, info, rolling, isWinner, isLoser, flashing }) {
  return (
    <div
      className={`duel-win${flashing ? " flash" : ""}${isLoser ? " loser" : ""}${isWinner ? " winner" : ""}`}
      style={{
        flex: 1, background: INK, borderRadius: 6,
        padding: film ? "34px 16px 16px" : "16px 16px 14px",
        minHeight: film ? 128 : 58, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
        position: "relative", overflow: "hidden", minWidth: 0,
      }}
    >
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(120% 100% at 50% 0%, rgba(255,255,255,0.06), transparent 60%)",
        pointerEvents: "none",
      }} />
      {/* topp-etikett vises kun når kortet har en film — bytter til
          WINNER-stempel når kortet vinner. Sitter i topp-paddingen,
          klarer alltid det sentrerte innholdet. */}
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
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: accent }} />
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: D_LABEL, textTransform: "uppercase" }}>
                {label}
              </span>
            </>
          )}
        </div>
      )}
      {film ? (
        !rolling && info ? (
          <FilmCard film={film} info={info} />
        ) : (
          <div className={`title-display${rolling ? " rolling" : ""}`}>
            <div className="balance" style={{
              fontFamily: GROTESK, fontWeight: 700, color: "#F5F3EC",
              fontSize: "clamp(17px, 4.6vw, 23px)", lineHeight: 1.15, letterSpacing: "-0.01em",
              overflowWrap: "break-word",
            }}>
              {film.name}
            </div>
            {film.year && (
              <div style={{ fontFamily: MONO, fontSize: 12, color: D_HI, marginTop: 5 }}>{film.year}</div>
            )}
          </div>
        )
      ) : (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 11, color: D_LABEL, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: accent }} />
          {label}
        </span>
      )}
    </div>
  );
}

/* ── kobber/PCB-lag: svakt synlige kretskort-spor bak alt ─────── */

function PcbLayer() {
  return (
    <svg className="pcb" viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {/* spor rutet som ekte PCB: 45°-knekk, aldri rette hjørner */}
      <g fill="none" stroke="#b0742f" strokeWidth="1.2">
        <path d="M12 24 H58 L70 36 V52 L78 60 H120" />
        <path d="M188 40 H158 L150 48 V88 L142 96 H96" />
        <path d="M20 120 H70 L80 130 V150" />
        <path d="M180 150 H120 L110 140 V120" />
        <path d="M12 210 H50 L60 220 V240 L70 250 H130 L140 240 V220 L150 210 H188" />
        <path d="M30 288 V240 L40 230 H90" />
        <path d="M100 12 V36 L108 44" />
        <path d="M150 300 V270 L160 260 H188" />
      </g>
      {/* vias */}
      <g fill="#c08a4a">
        <circle cx="120" cy="60" r="2.6" /><circle cx="96" cy="96" r="2.6" />
        <circle cx="80" cy="150" r="2.6" /><circle cx="110" cy="120" r="2.6" />
        <circle cx="90" cy="230" r="2.6" /><circle cx="108" cy="44" r="2.6" />
      </g>
      {/* SMD-pad-par (små komponentfotavtrykk) */}
      <g fill="#c08a4a">
        <rect x="98" y="134" width="5" height="7" rx="0.8" /><rect x="107" y="134" width="5" height="7" rx="0.8" />
        <rect x="160" y="146" width="7" height="5" rx="0.8" /><rect x="160" y="155" width="7" height="5" rx="0.8" />
        <rect x="24" y="252" width="5" height="7" rx="0.8" /><rect x="33" y="252" width="5" height="7" rx="0.8" />
      </g>
    </svg>
  );
}

/* ── detaljstripe under displayet (enkeltmodus) ───────────────── */

function SingleDetails({ film, info, whose }) {
  const hasBody = info && (info.director || info.genres?.length > 0 || info.synopsis);
  return (
    <div className="settled" style={{
      display: "flex", gap: 14, alignItems: "flex-start",
      marginTop: 10, padding: "12px 14px",
      background: PANEL_HI, border: `1px solid ${PANEL_LO}`, borderRadius: 6,
    }}>
      {info?.poster && (
        <img
          src={info.poster} alt="" referrerPolicy="no-referrer" className="poster-fade"
          style={{
            width: 58, aspectRatio: "2 / 3", objectFit: "cover", borderRadius: 4,
            flexShrink: 0, background: "#cfccc3", boxShadow: "0 3px 10px -5px rgba(0,0,0,0.5)",
          }}
        />
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        {hasBody && (info.director || info.genres?.length > 0) && (
          <div style={{ fontFamily: MONO, fontSize: 11, color: DIM, lineHeight: 1.4 }}>
            {[info.director ? `dir. ${info.director}` : null, info.genres?.length ? info.genres.join(" · ") : null]
              .filter(Boolean).join(" — ")}
          </div>
        )}
        {info?.synopsis && (
          <p style={{ margin: hasBody ? "6px 0 0" : 0, fontFamily: GROTESK, fontSize: 12.5, lineHeight: 1.5, color: INK }}>
            {info.synopsis}
          </p>
        )}
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 9, flexWrap: "wrap" }}>
          {whose && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 11, color: DIM }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: whose.color }} />
              {whose.label}
            </span>
          )}
          {film.uri && (
            <a href={film.uri} target="_blank" rel="noreferrer"
              style={{ fontFamily: MONO, fontSize: 11, color: BLUE, textDecoration: "none", borderBottom: `1px solid ${BLUE}` }}>
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
  const [soundOn, setSoundOn] = useState(saved?.soundOn ?? true);
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
  const [deciding, setDeciding] = useState(false);
  const [winner, setWinner] = useState(null); // 0 | 1 | null
  const [flash, setFlash] = useState(null);   // vindu som lyser under tie-break

  const [details, setDetails] = useState({});
  const requestedDetails = useRef(new Set());

  const timers = useRef([]);
  const landedRef = useRef(0);

  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
    []
  );

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { setSoundEnabled(soundOn); }, [soundOn]);

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
          /* uten detaljer viser vinduet bare tittel + år — helt ok */
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

  const land = (slotIdx, target, slotCount) => {
    setDisplays((d) => { const n = [...d]; n[slotIdx] = target; return n; });
    setPicks((p) => { const n = [...p]; n[slotIdx] = target; return n; });
    clunk();
    buzz([26, 30, 22]);
    landedRef.current += 1;
    if (landedRef.current >= slotCount) setSpinning(false);
  };

  // rulett: rask start, gradvis oppbremsing (ease-out), lander på target
  const scheduleRoll = (slotIdx, steps, sourcePool, target, slotCount, withTicks) => {
    let acc = 0;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      acc += 45 + Math.pow(t, 2.4) * 330;
      const isLast = i === steps - 1;
      timers.current.push(
        setTimeout(() => {
          if (isLast) {
            land(slotIdx, target, slotCount);
          } else {
            const r = rand(sourcePool) || target;
            setDisplays((d) => { const n = [...d]; n[slotIdx] = r; return n; });
            if (withTicks) { tick(); buzz(8); }
          }
        }, acc)
      );
    }
  };

  const spin = () => {
    if (spinning || deciding || !canSpin) return;
    clearTimers();
    setWinner(null);
    setFlash(null);
    setPicks([null, null]);

    if (isDuel) {
      const tA = rand(poolA);
      const tB = rand(poolB);
      if (reducedMotion) {
        setDisplays([tA, tB]);
        setPicks([tA, tB]);
        clunk();
        return;
      }
      setSpinning(true);
      landedRef.current = 0;
      scheduleRoll(0, 22, a.films, tA, 2, true);
      scheduleRoll(1, 27, b.films, tB, 2, false); // lander litt etter — drama
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

  const emptyText = !oneLoaded
    ? "FETCH A LIST TO START"
    : !bothLoaded && mode !== "all"
      ? "ADD A SECOND LIST FOR THIS MODE"
      : mode === "date" && overlap.length === 0
        ? "NO SHARED FILMS — TRY ROULETTE"
        : "EVERYTHING’S BEEN SEEN — RESET?";

  const shown = displays[0] || picks[0];
  const landed = picks[0] && !spinning;

  return (
    <div className="page" style={{
      minHeight: "100%", backgroundColor: "#B9B6AC",
      fontFamily: GROTESK, color: INK,
      display: "flex", justifyContent: "center",
    }}>
      <main style={{
        width: "100%", maxWidth: 560, alignSelf: "flex-start",
        background: PANEL,
        border: `1px solid ${PANEL_LO}`,
        borderRadius: 8,
        boxShadow: "0 1px 0 rgba(255,255,255,0.5) inset, 0 18px 40px -22px rgba(0,0,0,0.55)",
        overflow: "hidden",
        position: "relative",
      }}>
        {/* clear-tech-lag: PCB bakerst → frostet skall → gloss */}
        <PcbLayer />
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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Nothing-signaturen: én liten firkant i aksentfargen, ellers ingenting */}
            <span aria-hidden="true" style={{ width: 6, height: 6, background: RED, flexShrink: 0 }} />
            <div style={{ display: "flex", gap: 5 }} aria-hidden="true">
              <Dot c={ORANGE} /><Dot c={GREEN} /><Dot c={BLUE} />
            </div>
            <span className={`led${spinning || deciding ? " on" : ""}`} aria-hidden="true" />
            <button
              className="press"
              onClick={() => setSoundOn(!soundOn)}
              aria-pressed={soundOn}
              style={{ ...ghostBtn, fontFamily: DOT, fontWeight: 900, fontSize: 12, letterSpacing: "0.1em", padding: "7px 9px", minHeight: 30 }}
            >
              sound {soundOn ? "on" : "off"}
            </button>
          </div>
        </header>

        {/* Intro for førstegangsbrukere — forsvinner når noe er lastet */}
        {!oneLoaded && (
          <p style={{
            margin: 0, padding: "12px 18px 0", fontFamily: GROTESK, fontSize: 13.5,
            lineHeight: 1.5, color: INK,
          }}>
            Can’t pick a film? Feed it your Letterboxd watchlist and let the machine spin.
            Add a friend’s list to find what you both want to see.
          </p>
        )}

        {/* Innmating */}
        <div className="slots" style={{ padding: "14px 18px" }}>
          <UploadSlot
            side="List A" slot={a} accent={ORANGE}
            fetching={fetching.a} error={errors.a}
            onFile={loadInto("a")} onFetch={fetchInto("a")}
            onPersonChange={setPerson("a")} onClear={clearSlot("a")}
          />
          <UploadSlot
            side="List B" slot={b} accent={BLUE} optional
            fetching={fetching.b} error={errors.b}
            onFile={loadInto("b")} onFetch={fetchInto("b")}
            onPersonChange={setPerson("b")} onClear={clearSlot("b")}
          />
        </div>

        {/* Status-stripe */}
        {oneLoaded && (
          <div style={{
            display: "flex", gap: 18, padding: "0 18px 12px",
            fontFamily: MONO, fontSize: 11.5, color: DIM, flexWrap: "wrap",
          }}>
            {bothLoaded && <span><b style={{ color: INK }}>{overlap.length}</b> overlap</span>}
            <span><b style={{ color: INK }}>{union.length}</b> {bothLoaded ? "combined" : "films"}</span>
            {noRepeat && excluded.size > 0 && (
              <span>
                <b style={{ color: INK }}>{excluded.size}</b> seen ·{" "}
                <button className="linkbtn" onClick={resetExcluded}>reset</button>
              </span>
            )}
          </div>
        )}

        {/* Display */}
        <div style={{ padding: "6px 18px 4px" }}>
          {isDuel && bothLoaded && (canSpin || duelLanded) ? (
            <div>
              <div className="duel">
                <DuelWindow
                  label={a.person} accent={ORANGE} film={displays[0]}
                  info={detailsFor(picks[0])} rolling={spinning}
                  isWinner={winner === 0} isLoser={winner === 1}
                  flashing={flash === 0}
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
                  info={detailsFor(picks[1])} rolling={spinning}
                  isWinner={winner === 1} isLoser={winner === 0}
                  flashing={flash === 1}
                />
              </div>
              {fate && (
                <div className="settled" style={{
                  textAlign: "center", fontFamily: MONO, fontSize: 11.5, color: RED,
                  letterSpacing: "0.14em", marginTop: 10, fontWeight: 700,
                }}>
                  FATE · SAME FILM ON BOTH LISTS
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="display-module" style={{
                minHeight: 168, padding: "30px 20px", display: "flex",
                flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center",
              }}>
                {!canSpin && !shown ? (
                  <span style={{ position: "relative", zIndex: 1, color: D_EMPTY, fontFamily: DOT, fontWeight: 900, fontSize: 14, letterSpacing: "0.12em" }}>
                    {emptyText}
                  </span>
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
                  </>
                ) : (
                  <span style={{ position: "relative", zIndex: 1, color: D_EMPTY, fontFamily: DOT, fontWeight: 900, fontSize: 14, letterSpacing: "0.12em" }}>
                    READY · PRESS SPIN
                  </span>
                )}
              </div>

              {landed && (detailsFor(picks[0]) || picks[0].uri) && (
                <SingleDetails
                  film={picks[0]}
                  info={detailsFor(picks[0])}
                  whose={bothLoaded ? whose(picks[0]) : null}
                />
              )}
            </div>
          )}
        </div>

        {/* skjermleser: annonser resultatet */}
        <div aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>
          {chosenFilm ? `Chosen film: ${chosenFilm.name} ${chosenFilm.year}` : ""}
        </div>

        {/* Modus */}
        <div className="modes" role="group" aria-label="Mode" style={{ display: "flex", gap: 8, padding: "14px 18px 6px" }}>
          {MODES.map((m) => {
            const on = mode === m.id;
            return (
              <button key={m.id}
                className="press mode-btn"
                aria-pressed={on}
                onClick={() => switchMode(m.id)}
                style={{
                  flex: 1, cursor: "pointer", borderRadius: 5, padding: "9px 6px 8px",
                  background: on ? INK : PANEL_HI,
                  border: `1px solid ${on ? INK : PANEL_LO}`,
                  textAlign: "left", transition: "background 120ms", minWidth: 0,
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: on && m.dot === INK ? "#F5F3EC" : m.dot, flexShrink: 0 }} />
                  <span style={{ fontFamily: GROTESK, fontSize: 13, fontWeight: 600, color: on ? "#F5F3EC" : INK }}>{m.label}</span>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: on ? D_HI : DIM, marginTop: 3, paddingLeft: 13 }}>{m.sub}</div>
              </button>
            );
          })}
        </div>

        {/* Kontroller */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "10px 18px 20px" }}>
          {undo && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              fontFamily: MONO, fontSize: 11, color: DIM,
              background: PANEL_HI, border: `1px solid ${PANEL_LO}`, borderRadius: 5, padding: "8px 12px",
            }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Marked “{undo.name}” as seen
              </span>
              <button className="linkbtn" onClick={undoWatched} style={{ flexShrink: 0 }}>undo</button>
            </div>
          )}

          {duelLanded && !fate && winner === null && (
            <button
              className="press"
              onClick={decide}
              disabled={deciding}
              style={{
                background: INK, color: "#F5F3EC", border: "none", borderRadius: 6,
                padding: "13px 16px", cursor: deciding ? "default" : "pointer",
                fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: "0.16em",
                boxShadow: "0 2px 0 rgba(0,0,0,0.22)",
              }}>
              {deciding ? "DECIDING…" : "LET THE MACHINE DECIDE"}
            </button>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="press"
              onClick={spin}
              disabled={spinning || deciding || !canSpin}
              style={{
                flex: 1, cursor: spinning || deciding || !canSpin ? "default" : "pointer",
                background: !canSpin ? PANEL_LO : RED,
                color: !canSpin ? DIM : "#fff",
                border: "none", borderRadius: 7, padding: "16px 20px",
                fontFamily: GROTESK, fontSize: 19, fontWeight: 700, letterSpacing: "0.01em",
                boxShadow: !canSpin ? "none" : "0 2px 0 rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.22) inset",
              }}>
              {spinning ? "spinning…" : picks[0] ? "Spin again" : "Spin"}
            </button>

            {chosenFilm && !spinning && !deciding && (
              <button className="press" onClick={markWatched} style={{ ...ghostBtn, padding: "13px 14px", fontSize: 11 }}>
                seen it ✓
              </button>
            )}

            <button
              className="press toggle"
              role="switch"
              aria-checked={noRepeat}
              aria-label="No repeats"
              onClick={() => setNoRepeat(!noRepeat)}
            >
              <span className={`toggle-track${noRepeat ? " on" : ""}`}><span className="toggle-knob" /></span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: DIM }}>no repeats</span>
            </button>
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}
