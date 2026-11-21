import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Key from "./Key.jsx";
import SplitFlapDisplay from "./SplitFlap.jsx";
import CircuitLayer from "./CircuitLayer.jsx";

function Demo() {
  const [spinning, setSpinning] = useState(false);
  const [spinKey, setSpinKey] = useState(0);
  const [on, setOn] = useState(true);
  const [pos, setPos] = useState(1);
  return (
    <div className="page">
      <main className="machine">
        <CircuitLayer dep={spinKey} />
        <div className="light-blob warm" aria-hidden="true" />
        <div className="light-blob cool" aria-hidden="true" />
        <div className="frost" />
        <div className="machine-gloss" />
        <div style={{ position: "relative", zIndex: 1 }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 14px", borderBottom: "1px solid var(--panel-lo)" }}>
            <h1 style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-0.025em", margin: 0 }}>Demo</h1>
            <span className="dotlabel">LOOK CHECK</span>
          </header>
          <div className="slots" style={{ display: "flex", gap: 10, padding: "14px 18px 0" }}>
            <div data-node="in-a" style={{ flex: 1, height: 70, borderRadius: 4, border: "1.5px solid #DD5117", background: "rgba(28,27,25,0.035)", boxShadow: "inset 0 1.5px 4px rgba(0,0,0,0.18)" }} />
            <div data-node="in-b" style={{ flex: 1, height: 70, borderRadius: 4, border: "1.5px solid rgba(28,27,25,0.22)", background: "rgba(28,27,25,0.035)", boxShadow: "inset 0 1.5px 4px rgba(0,0,0,0.18)" }} />
          </div>
          <div className="modes" style={{ display: "flex", gap: 10, padding: "12px 18px 0" }}>
            <Key color="orange" on style={{ flex: 1 }}>one</Key>
            <Key color="white" style={{ flex: 1 }}>two</Key>
            <Key color="ink" className="locked" aria-disabled style={{ flex: 1 }}>locked</Key>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 18px", minHeight: 34 }}>
            <div className="tri-switch">
              <span className="tri-knob" style={{ transform: `translateX(${pos * 100}%)` }} />
              {["ALL", "≤100", ">100"].map((l, i) => (
                <button key={l} className={pos === i ? "on" : ""} onClick={() => setPos(i)}>{l}</button>
              ))}
            </div>
            <button className="chip on">DRAMA</button>
            <button className="chip">SCI-FI</button>
            <button className="linkbtn" style={{ marginLeft: "auto" }}>reset</button>
          </div>
          <div style={{ padding: "6px 18px 4px" }}>
            <div className="display-module" style={{ height: 264, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "26px 20px 30px" }}>
              <SplitFlapDisplay text="STALKER" spinning={spinning} spinKey={spinKey} landed={!spinning} onSettle={() => setSpinning(false)} />
              <div style={{ marginTop: 15, fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.14em", color: "var(--d-hi)" }}>1979 · 162 MIN</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, padding: "10px 18px 20px" }}>
            <Key color="orange" className="ctrl-spin" style={{ gridColumn: "1 / 3" }}
              onClick={() => { setSpinning(true); setSpinKey((k) => k + 1); }}
              capStyle={{ fontFamily: "var(--font-grotesk)", fontSize: 17, fontWeight: 700, letterSpacing: "0.01em", textTransform: "none", minHeight: 40 }}>
              Spin
            </Key>
            <Key color="ink" capStyle={{ minHeight: 40 }}>Seen it ✓</Key>
            <Key color="white" on={on} onClick={() => setOn(!on)} capStyle={{ minHeight: 40, fontSize: 10.5 }}>No repeats</Key>
          </div>
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<Demo />);
