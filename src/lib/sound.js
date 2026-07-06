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
