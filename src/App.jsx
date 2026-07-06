import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { keyOf, parseCsv, fetchWatchlist, FETCH_ERRORS } from "./lib/letterboxd.js";
import { loadState, saveState } from "./lib/storage.js";
import { tick, clunk, win, setSoundEnabled } from "./lib/sound.js";

/* ─────────────────────────────────────────────────────────────
   VIDEOKISEN · en Braun-aktig maskin for to filmlister
   Letterboxd-brukernavn eller watchlist.csv (Settings → Data → Export)
   ───────────────────────────────────────────────────────────── */

const INK = "#1C1B19";
const PANEL = "#DDDAD2";
const PANEL_HI = "#E9E7E0";
const PANEL_LO = "#C9C6BD";
const RED = "#D8442A";        // Braun-rød, primær handling
const ORANGE = "#FF8000";     // Letterboxd oransje = liste A
const GREEN = "#00C64A";      // Letterboxd grønn = overlapp
const BLUE = "#40BCF4";       // Letterboxd blå = liste B
const DIM = "#7A776E";

const MONO = "'SF Mono','JetBrains Mono',ui-monospace,Menlo,Consolas,monospace";
const GROTESK = "'Helvetica Neue','Inter',Helvetica,Arial,sans-serif";

const MODES = [
  { id: "all", label: "Roulette", sub: "the whole pool", dot: INK },
  { id: "date", label: "Date night", sub: "overlap only", dot: GREEN },
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
  color: INK, background: "transparent", border: `1px solid rgba(28,27,25,0.3)`,
  borderRadius: 3, padding: "4px 9px", cursor: "pointer",
};

const linkBtn = {
  background: "none", border: "none", padding: 0, cursor: "pointer",
  fontFamily: MONO, fontSize: 11.5, color: RED, textDecoration: "underline",
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
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", color: DIM, textTransform: "uppercase" }}>
          {side}
        </span>
      </div>

      {loaded ? (
        <div>
          <input
            value={slot.person}
            onChange={(e) => onPersonChange(e.target.value)}
            aria-label="Name"
            style={{
              fontFamily: GROTESK, fontSize: 16, fontWeight: 600, color: INK,
              background: "transparent", border: "none", borderBottom: "1px dashed rgba(28,27,25,0.25)",
              padding: "0 0 1px", width: "100%", minWidth: 0,
            }}
          />
          <div style={{ fontFamily: MONO, fontSize: 12, color: DIM, marginTop: 4 }}>
            {slot.films.length} films · {slot.username ? `@${slot.username}` : slot.filename}
          </div>
          {slot.total > slot.films.length && (
            <div style={{ fontFamily: MONO, fontSize: 11, color: RED, marginTop: 2 }}>
              fetched {slot.films.length} of {slot.total}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
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
            style={{ display: "flex", gap: 6 }}
          >
            <input
              value={uname}
              onChange={(e) => setUname(e.target.value)}
              placeholder="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Letterboxd username"
              style={{
                flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 16, color: INK,
                background: "rgba(255,255,255,0.35)", border: "1px solid rgba(28,27,25,0.25)",
                borderRadius: 3, padding: "6px 8px",
              }}
            />
            <button
              type="submit"
              className="press"
              disabled={fetching || !uname.trim()}
              style={{
                ...ghostBtn, background: INK, color: "#F5F3EC", border: `1px solid ${INK}`,
                padding: "6px 11px", opacity: fetching || !uname.trim() ? 0.45 : 1,
              }}
            >
              {fetching ? "…" : "fetch"}
            </button>
          </form>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: DIM, marginTop: 6 }}>
            {optional
              ? "optional — unlocks Date night & Duel"
              : "Letterboxd username (public watchlist)"}
          </div>
          <button
            onClick={() => fileRef.current && fileRef.current.click()}
            style={{ ...linkBtn, color: DIM, fontSize: 11, marginTop: 8 }}
          >
            or upload watchlist.csv
          </button>
        </div>
      )}

      {error && (
        <div style={{ fontFamily: MONO, fontSize: 11, color: RED, marginTop: 8, lineHeight: 1.4 }}>
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

/* ── duell-vindu ──────────────────────────────────────────────── */

function DuelWindow({ label, accent, film, rolling, isWinner, isLoser, flashing }) {
  return (
    <div
      className={`duel-win${flashing ? " flash" : ""}${isLoser ? " loser" : ""}`}
      style={{
        flex: 1, background: INK, borderRadius: 6, padding: "30px 16px 18px",
        minHeight: 128, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
        position: "relative", overflow: "hidden", minWidth: 0,
      }}
    >
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(120% 100% at 50% 0%, rgba(255,255,255,0.06), transparent 60%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: 9, left: 0, right: 0,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: accent }} />
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: "#8a8880", textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
      {film ? (
        <div className={`title-display${rolling ? " rolling" : ""}`}>
          <div style={{
            fontFamily: GROTESK, fontWeight: 700, color: "#F5F3EC",
            fontSize: "clamp(17px, 4.6vw, 23px)", lineHeight: 1.15, letterSpacing: "-0.01em",
            overflowWrap: "break-word",
          }}>
            {film.name}
          </div>
          {film.year && (
            <div style={{ fontFamily: MONO, fontSize: 12, color: "#9a988f", marginTop: 5 }}>{film.year}</div>
          )}
        </div>
      ) : (
        <span style={{ fontFamily: MONO, fontSize: 13, color: "#6f6d67" }}>—</span>
      )}
      {isWinner && (
        <div className="stamp" style={{
          position: "absolute", bottom: 8, left: "50%", marginLeft: -46,
          border: `2px solid ${RED}`, color: RED, borderRadius: 3,
          fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: "0.2em",
          padding: "3px 0 2px", background: "rgba(28,27,25,0.85)", width: 92, textAlign: "center",
        }}>
          WINNER
        </div>
      )}
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

  const [picks, setPicks] = useState([null, null]);
  const [displays, setDisplays] = useState([null, null]);
  const [spinning, setSpinning] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [winner, setWinner] = useState(null); // 0 | 1 | null
  const [flash, setFlash] = useState(null);   // vindu som lyser under tie-break

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
      if (reducedMotion) {
        setDisplays([target, null]);
        setPicks([target, null]);
        clunk();
        return;
      }
      setSpinning(true);
      landedRef.current = 0;
      scheduleRoll(0, 26, mode === "date" ? overlap : union, target, 1, true);
    }
  };

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
    setExcluded((s) => new Set(s).add(keyOf(chosenFilm)));
    resetRound();
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
        : "EVERYTHING'S BEEN SEEN — RESET?";

  const shown = displays[0] || picks[0];
  const landed = picks[0] && !spinning;

  return (
    <div style={{
      minHeight: "100%", background: "#B9B6AC",
      fontFamily: GROTESK, color: INK, padding: "22px 16px 40px",
      display: "flex", justifyContent: "center",
    }}>
      <div style={{
        width: "100%", maxWidth: 560, alignSelf: "flex-start",
        background: PANEL,
        border: `1px solid ${PANEL_LO}`,
        borderRadius: 8,
        boxShadow: "0 1px 0 rgba(255,255,255,0.5) inset, 0 18px 40px -22px rgba(0,0,0,0.55)",
        overflow: "hidden",
        position: "relative",
      }}>
        {/* Topplinje */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 18px 14px", borderBottom: `1px solid ${PANEL_LO}`,
        }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.015em" }}>Videokisen</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: DIM, letterSpacing: "0.1em", marginTop: 2 }}>
              ONE SPIN · ONE FILM
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", gap: 5 }}>
              <Dot c={ORANGE} /><Dot c={GREEN} /><Dot c={BLUE} />
            </div>
            <span className={`led${spinning || deciding ? " on" : ""}`} aria-hidden="true" />
            <button
              className="press"
              onClick={() => setSoundOn(!soundOn)}
              aria-pressed={soundOn}
              style={{ ...ghostBtn, fontSize: 10, padding: "3px 7px", color: soundOn ? INK : DIM }}
            >
              sound {soundOn ? "on" : "off"}
            </button>
          </div>
        </div>

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
                <button onClick={resetExcluded} style={linkBtn}>reset</button>
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
                  rolling={spinning}
                  isWinner={winner === 0} isLoser={winner === 1}
                  flashing={flash === 0}
                />
                <div className="duel-vs" style={{
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
                  rolling={spinning}
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
            <div style={{
              background: INK, borderRadius: 6, padding: "26px 22px",
              minHeight: 156, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", textAlign: "center",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(120% 100% at 50% 0%, rgba(255,255,255,0.06), transparent 60%)",
                pointerEvents: "none",
              }} />
              {!canSpin && !shown ? (
                <span style={{ color: "#6f6d67", fontFamily: MONO, fontSize: 12.5, letterSpacing: "0.06em" }}>
                  {emptyText}
                </span>
              ) : shown ? (
                <div className={landed ? "settled" : ""}>
                  <div className={`title-display${spinning ? " rolling" : ""}`}>
                    <div style={{
                      fontFamily: GROTESK, fontWeight: 700, color: "#F5F3EC",
                      fontSize: "clamp(22px, 7vw, 34px)", lineHeight: 1.1, letterSpacing: "-0.015em",
                      overflowWrap: "break-word",
                    }}>
                      {shown.name}
                    </div>
                    {shown.year && (
                      <div style={{ fontFamily: MONO, fontSize: 13, color: "#9a988f", marginTop: 6 }}>{shown.year}</div>
                    )}
                  </div>
                  {landed && (() => {
                    const w = whose(picks[0]);
                    return (
                      <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center", justifyContent: "center" }}>
                        {bothLoaded && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 11, color: "#b9b7ae" }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: w.color }} />
                            {w.label}
                          </span>
                        )}
                        {picks[0].uri && (
                          <a href={picks[0].uri} target="_blank" rel="noreferrer"
                            style={{ fontFamily: MONO, fontSize: 11, color: BLUE, textDecoration: "none", borderBottom: `1px solid ${BLUE}` }}>
                            Letterboxd ↗
                          </a>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <span style={{ color: "#6f6d67", fontFamily: MONO, fontSize: 12.5, letterSpacing: "0.06em" }}>
                  READY · PRESS SPIN
                </span>
              )}
            </div>
          )}
        </div>

        {/* skjermleser: annonser resultatet */}
        <div aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>
          {chosenFilm ? `Chosen film: ${chosenFilm.name} ${chosenFilm.year}` : ""}
        </div>

        {/* Modus */}
        <div style={{ display: "flex", gap: 8, padding: "14px 18px 6px" }}>
          {MODES.map((m) => {
            const on = mode === m.id;
            return (
              <button key={m.id}
                className="press"
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
                <div style={{ fontFamily: MONO, fontSize: 10, color: on ? "#9a988f" : DIM, marginTop: 3, paddingLeft: 13 }}>{m.sub}</div>
              </button>
            );
          })}
        </div>

        {/* Kontroller */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "10px 18px 20px" }}>
          {duelLanded && !fate && winner === null && (
            <button
              className="press"
              onClick={decide}
              disabled={deciding}
              style={{
                background: INK, color: "#F5F3EC", border: "none", borderRadius: 6,
                padding: "12px 16px", cursor: deciding ? "default" : "pointer",
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
                fontFamily: GROTESK, fontSize: 17, fontWeight: 700, letterSpacing: "0.02em",
                boxShadow: !canSpin ? "none" : "0 2px 0 rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.22) inset",
              }}>
              {spinning ? "spinning…" : picks[0] ? "Spin again" : "Spin"}
            </button>

            {chosenFilm && !spinning && !deciding && (
              <button className="press" onClick={markWatched} style={{ ...ghostBtn, padding: "13px 14px", fontSize: 11 }}>
                seen it ✓
              </button>
            )}

            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: MONO, fontSize: 11, color: DIM }}>
              <input type="checkbox" checked={noRepeat} onChange={(e) => setNoRepeat(e.target.checked)} style={{ accentColor: RED }} />
              no repeats
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
