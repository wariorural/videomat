/* Best-effort rate limit, delt av /api/watchlist og /api/film.
   In-memory per lambda-instans (ikke delt på tvers av Vercels instanser),
   men bremser den mest åpenbare misbruken — én klient som hamrer endepunktene
   som gratis skrape-proxy. For hard garanti trengs en delt teller
   (Upstash/Edge Config). Filer med _-prefiks blir ikke egne funksjoner. */

const HITS = new Map(); // nøkkel -> [tidsstempler]
const WINDOW_MS = 60_000;

export function rateLimited(key, maxPerWindow = 12) {
  const now = Date.now();
  const recent = (HITS.get(key) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  HITS.set(key, recent);
  if (HITS.size > 5000) HITS.clear(); // enkel opprydding mot minnevekst
  return recent.length > maxPerWindow;
}

export function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
}
