const KEY = "videokisen:v1"; // historisk nøkkel fra før Videomat-navnet — IKKE endre (mister brukernes lagrede lister)

export function loadState() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

let timer = null;

// Skriv sjelden: state endres på hvert tastetrykk i navnefeltet, men vi
// trenger bare å persistere når det roer seg.
export function saveState(state) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* full/blokkert storage skal aldri velte appen */
    }
  }, 300);
}

/* Lærte filmfakta (spilletid/sjangre) for filterspinnet — egen nøkkel så
   den store mappen ikke skrives på hvert tastetrykk i navnefeltet. */
const FACTS_KEY = "videomat:facts:v1";
const FACTS_MAX = 3000; // taket holder oss langt unna storage-kvoten

export function loadFacts() {
  try {
    return JSON.parse(localStorage.getItem(FACTS_KEY)) || {};
  } catch {
    return {};
  }
}

let factsTimer = null;

export function saveFacts(facts) {
  clearTimeout(factsTimer);
  factsTimer = setTimeout(() => {
    try {
      let entries = Object.entries(facts);
      // innsettingsrekkefølge ≈ alder — eldst ryker først
      if (entries.length > FACTS_MAX) entries = entries.slice(entries.length - FACTS_MAX);
      localStorage.setItem(FACTS_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      /* full/blokkert storage skal aldri velte appen */
    }
  }, 300);
}
