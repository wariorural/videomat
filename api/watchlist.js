/* GET /api/watchlist?user=<letterboxd-brukernavn>
   Skraper brukerens offentlige watchlist-sider (28 filmer per side)
   og svarer { user, total, fetched, films: [{ name, year, uri }] }. */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Videomat/1.0";
const PER_PAGE = 28;
const MAX_PAGES = 40; // ~1120 filmer — over det sier vi ærlig fra i UI-et

function decodeEntities(s) {
  return s
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;| /g, " ")
    .replace(/&amp;/g, "&"); // sist — ellers dobbel-dekodes escapede entiteter
}

function parseFilms(html) {
  const films = [];
  // Hvert plakat-element bærer data-item-name="Tittel (År)" + data-target-link="/film/slug/"
  const tags = html.match(/<[^>]*data-item-name="[^"]*"[^>]*>/g) || [];
  for (const tag of tags) {
    const rawName = (tag.match(/data-item-name="([^"]*)"/) || [])[1];
    if (!rawName) continue;
    const link = (tag.match(/data-target-link="([^"]*)"/) || [])[1] || "";
    const decoded = decodeEntities(rawName).trim();
    const m = decoded.match(/^(.*)\s+\((\d{4})\)$/);
    films.push({
      name: m ? m[1] : decoded,
      year: m ? m[2] : "",
      uri: link ? `https://letterboxd.com${link}` : "",
    });
  }
  return films;
}

function fetchPage(user, page) {
  const url =
    `https://letterboxd.com/${user}/watchlist/` +
    (page > 1 ? `page/${page}/` : "");
  return fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en" },
  });
}

import { rateLimited, clientIp } from "./_ratelimit.js";

export default async function handler(req, res) {
  const ip = clientIp(req);
  if (rateLimited(`wl:${ip}`)) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "rate_limited" });
    return;
  }

  const user = String(req.query.user || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(user)) {
    res.status(400).json({ error: "bad_user" });
    return;
  }

  let first;
  try {
    first = await fetchPage(user, 1);
  } catch {
    res.status(502).json({ error: "blocked" });
    return;
  }
  if (first.status === 404) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (!first.ok) {
    res.status(502).json({ error: "blocked" });
    return;
  }

  const html = await first.text();
  const films = parseFilms(html);
  if (films.length === 0) {
    res.status(404).json({ error: "empty" });
    return;
  }

  const countMatch = html.match(/js-watchlist-count">([^<]*)/);
  const total = countMatch
    ? parseInt(countMatch[1].replace(/\D/g, ""), 10)
    : films.length;

  const pages = Math.min(Math.ceil(total / PER_PAGE), MAX_PAGES);
  // hent resten i puljer på 8 — raskt uten å hamre Letterboxd
  for (let start = 2; start <= pages; start += 8) {
    const batch = [];
    for (let p = start; p < start + 8 && p <= pages; p++) {
      batch.push(
        fetchPage(user, p)
          .then((r) => (r.ok ? r.text() : ""))
          .then(parseFilms)
          .catch(() => [])
      );
    }
    for (const pageFilms of await Promise.all(batch)) films.push(...pageFilms);
  }

  const seen = new Set();
  const unique = films.filter((f) => {
    const k = `${f.name.toLowerCase()}|${f.year}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  res.setHeader(
    "Cache-Control",
    "s-maxage=3600, stale-while-revalidate=86400"
  );
  res.status(200).json({ user, total, fetched: unique.length, films: unique });
}
