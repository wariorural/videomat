const KEY = "videokisen:v1";

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
