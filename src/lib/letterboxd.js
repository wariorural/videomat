import Papa from "papaparse";

/* Én nøkkel per film. CSV-eksporten bruker boxd.it-korturler og skrapingen
   bruker /film/slug/ — derfor kan ikke URI være nøkkel på tvers av kilder.
   Navn + år er stabilt i begge. */
export function keyOf(f) {
  return `${(f.name || "").toLowerCase().trim()}|${f.year || ""}`;
}

export function parseCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data || [];
        const films = [];
        const seen = new Set();
        for (const r of rows) {
          // Letterboxd bruker "Name","Year","Letterboxd URI". Vær romslig.
          const name = r.Name || r.name || r.Title || r.title || "";
          if (!name) continue;
          const year = (r.Year || r.year || "").toString().trim();
          const uri = r["Letterboxd URI"] || r.URI || r.uri || "";
          const f = { name: name.trim(), year, uri: uri.trim() };
          const k = keyOf(f);
          if (seen.has(k)) continue;
          seen.add(k);
          films.push(f);
        }
        if (films.length === 0) reject(new Error("csv_empty"));
        else resolve(films);
      },
      error: reject,
    });
  });
}

export async function fetchWatchlist(username) {
  const res = await fetch(`/api/watchlist?user=${encodeURIComponent(username.trim())}`);
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* ikke-JSON-svar behandles som ukjent feil under */
  }
  if (!res.ok) throw new Error(data?.error || "unknown");
  return data; // { user, total, fetched, films }
}

export const FETCH_ERRORS = {
  bad_user: "Det ser ikke ut som et Letterboxd-brukernavn",
  not_found: "Fant ingen bruker med det navnet",
  empty: "Watchlisten er tom eller privat",
  blocked: "Letterboxd svarte ikke — last opp CSV i stedet",
  unknown: "Noe gikk galt — prøv igjen, eller last opp CSV",
  csv_empty: "Fant ingen filmer i fila. Er det watchlist.csv fra Letterboxd-eksporten?",
};
