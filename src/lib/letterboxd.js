import Papa from "papaparse";

/* Én nøkkel per film. CSV-eksporten bruker boxd.it-korturler og skrapingen
   bruker /film/slug/ — derfor kan ikke URI være nøkkel på tvers av kilder.
   Navn + år er stabilt i begge. */
export function keyOf(f) {
  return `${(f.name || "").toLowerCase().trim()}|${f.year || ""}`;
}

/* En CSV kan deles av hvem som helst — en fiendtlig fil kan sette "Letterboxd
   URI" til javascript:… som ville kjørt i vår origin når lenken klikkes.
   Slipp bare gjennom ekte Letterboxd-lenker; alt annet blir tom uri. */
export function safeUri(raw) {
  const s = (raw || "").trim();
  if (/^https:\/\/(boxd\.it|letterboxd\.com)\//i.test(s)) return s;
  return "";
}

/* IMDb-watchlister inneholder også serier/episoder/spill — dette er en
   filmrulett, så bare film-aktige typer slipper inn. Normalisert uten
   skilletegn fordi eksportformatet har variert ("tvMovie" vs "TV Movie"). */
const FILM_TYPES = new Set(["movie", "tvmovie", "short", "video", "tvspecial"]);

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
          const type = (r["Title Type"] || "").toLowerCase().replace(/[^a-z]/g, "");
          if (type && !FILM_TYPES.has(type)) continue;
          const year = (r.Year || r.year || "").toString().trim();
          let uri = safeUri(r["Letterboxd URI"] || r.URI || r.uri || "");
          /* IMDb-eksporten har tt-id i "Const" — Letterboxd redirecter
             /imdb/tt…/ til filmsida, så detalj-pipelinen virker uendret. */
          const konst = (r.Const || "").trim();
          if (!uri && /^tt\d+$/.test(konst)) uri = `https://letterboxd.com/imdb/${konst}/`;
          const f = { name: name.trim(), year, uri };
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

export async function fetchFilmDetails(uri) {
  // v=2: buster CDN- og SW-cachen fra før cast-feltet fantes
  const res = await fetch(`/api/film?uri=${encodeURIComponent(uri)}&v=2`);
  if (!res.ok) throw new Error("film_failed");
  return res.json();
}

export const FETCH_ERRORS = {
  bad_user: "That doesn't look like a Letterboxd username",
  rate_limited: "Too many lookups — wait a minute and try again",
  not_found: "No user with that name",
  empty: "That watchlist is empty or private",
  blocked: "Letterboxd didn't answer — upload the CSV instead",
  unknown: "Something went wrong — try again, or upload the CSV",
  csv_empty: "No films in that file. Is it a watchlist export from Letterboxd or IMDb?",
};
