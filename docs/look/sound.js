/* Syntetisk maskinlyd — ingen lydfiler. AudioContext lages først ved
   første lyd (krever uansett en brukerhandling i nettleseren). */

let ctx = null;
let enabled = true;

export function setSoundEnabled(v) {
  enabled = v;
}

function ac() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function blip(freq, dur, gain, type = "square") {
  if (!enabled) return;
  try {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur);
  } catch {
    /* lyd er pynt — aldri en feilkilde */
  }
}

// mekanisk klikk per rulle-steg
export const tick = () => blip(2100, 0.03, 0.028);

// fysisk «landing»
export const clunk = () => {
  blip(150, 0.09, 0.2);
  blip(70, 0.14, 0.16, "sine");
};

// liten fanfare når duellen er avgjort
export const win = () => {
  blip(523, 0.09, 0.055, "triangle");
  setTimeout(() => blip(784, 0.16, 0.055, "triangle"), 90);
};

/* Myk split-flap-klakk. En hel rad flakser samtidig, så vi (a) randomiserer
   pitch ±3 % + gain litt per kort så det ikke blir robotisk, og (b) struper til
   ~1 klakk / 22 ms — ellers maskingevær-klipper 20 kort lydutgangen. Klakken
   thinner naturlig ut når raden roer seg. */
const CLACK_BASES = [300, 330, 360, 285]; // liten "pool" å variere over
let lastClack = 0;

export function flapClack() {
  if (!enabled) return;
  try {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    if (t - lastClack < 0.022) return;
    lastClack = t;
    const detune = 1 + (Math.random() * 0.06 - 0.03); // ±3 %
    const base = CLACK_BASES[(Math.random() * CLACK_BASES.length) | 0];
    const gain = 0.018 + Math.random() * 0.01;
    // kropp: kort lavfrekvent transient (selve treffet)
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "square";
    o.frequency.value = base * detune;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.035);
    // kant: knapp høyfrekvent tikk (plast mot plast)
    const o2 = c.createOscillator();
    const g2 = c.createGain();
    o2.type = "triangle";
    o2.frequency.value = 1650 * detune;
    g2.gain.setValueAtTime(gain * 0.45, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
    o2.connect(g2).connect(c.destination);
    o2.start(t);
    o2.stop(t + 0.02);
  } catch {
    /* lyd er pynt — aldri en feilkilde */
  }
}
