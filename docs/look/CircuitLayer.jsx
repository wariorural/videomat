import React, { useRef, useState, useLayoutEffect } from "react";

/* ─────────────────────────────────────────────────────────────
   PCB-laget — kobberspor som viser signalveien mellom panelene.

   Poenget er ikke pynt: sporene skal koble de faktiske feltene i
   riktig rekkefølge, så maskinen forklarer sin egen dataflyt.
   Derfor måles panelene i DOM-en (getBoundingClientRect mot
   forelderen) og rutes med ortogonale linjer med 45°-avfasede
   knekk — ekte PCB-ruting. ResizeObserver tegner om når maskinen
   endrer størrelse (brytepunkt, felt som kommer og går).

   Bruk: legg <CircuitLayer nodes={…} dep={noeSomEndrerLayout} />
   som FØRSTE barn i .machine, og gi feltene stabile selectorer.
   Krever at forelderen har position: relative.
   ───────────────────────────────────────────────────────────── */

// ortogonal rute med 45°-avfasing der den svinger sidelengs
export function routeDown(x0, y0, x1, y1, c = 6) {
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

/* nodes: liste av CSS-selectorer i signalrekkefølge. Standarden under
   speiler Videomat: to innganger → modusvalg → display → utløser.
   Hver hopp tegnes fra bunnen av forrige felt til toppen av neste. */
const DEFAULT_NODES = ['[data-node="in-a"]', '[data-node="in-b"]', ".modes", ".display-module", ".ctrl-spin"];

export default function CircuitLayer({ dep, nodes = DEFAULT_NODES }) {
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
      const [a, b, modes, disp, out] = nodes.map(box);
      if (!a || !b || !modes || !disp || !out) { setNet(null); return; }

      // signalvei: begge inngangene samles i modusvalget, videre til
      // displayet, og ut til utløseren
      const lines = [
        routeDown(a.x + a.w * 0.5, a.y + a.h, modes.x + modes.w * 0.2, modes.y),
        routeDown(b.x + b.w * 0.5, b.y + b.h, modes.x + modes.w * 0.8, modes.y),
        routeDown(modes.x + modes.w * 0.5, modes.y + modes.h, disp.x + disp.w * 0.5, disp.y),
        routeDown(disp.x + disp.w * 0.35, disp.y + disp.h, out.x + out.w * 0.5, out.y),
      ];
      const vias = [
        { x: a.x + a.w * 0.5, y: a.y + a.h },
        { x: b.x + b.w * 0.5, y: b.y + b.h },
        { x: modes.x + modes.w * 0.5, y: modes.y + modes.h },
        { x: out.x + out.w * 0.5, y: out.y },
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
  }, [dep, nodes]);

  return (
    <svg ref={ref} className="pcb" aria-hidden="true" {...(net ? { viewBox: `0 0 ${net.w} ${net.h}` } : {})}>
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
