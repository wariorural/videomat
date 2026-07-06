/* GET /api/film?uri=<letterboxd.com/film/... eller boxd.it/...>
   Henter filmsiden og svarer { poster, synopsis, director, rating, runtime, genres }.
   Zero API-nøkler: alt leses fra og:-metaene og JSON-LD-blokken. */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Videokisen/1.0";

const ALLOWED_HOSTS = ["letterboxd.com", "www.letterboxd.com", "boxd.it"];

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;| /g, " ");
}

export default async function handler(req, res) {
  let url;
  try {
    url = new URL(String(req.query.uri || ""));
  } catch {
    res.status(400).json({ error: "bad_uri" });
    return;
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.includes(url.hostname)) {
    res.status(400).json({ error: "bad_uri" });
    return;
  }

  // Følg redirects manuelt (boxd.it → letterboxd.com/film/...) og revalider
  // host på HVERT hopp — ellers kan en åpen redirect på Letterboxd kapre
  // serverens fetch til et internt/annet mål (SSRF).
  let page;
  let current = url;
  try {
    for (let hop = 0; hop < 4; hop++) {
      if (current.protocol !== "https:" || !ALLOWED_HOSTS.includes(current.hostname)) {
        res.status(400).json({ error: "bad_uri" });
        return;
      }
      page = await fetch(current, {
        headers: { "User-Agent": UA, "Accept-Language": "en" },
        redirect: "manual",
      });
      if (page.status >= 300 && page.status < 400 && page.headers.get("location")) {
        current = new URL(page.headers.get("location"), current);
        continue;
      }
      break;
    }
  } catch {
    res.status(502).json({ error: "fetch_failed" });
    return;
  }
  if (!page || !page.ok) {
    res.status(502).json({ error: "fetch_failed" });
    return;
  }

  const html = await page.text();

  // JSON-LD-blokken er pakket i CDATA-kommentarer — strip dem før parsing
  let ld = null;
  const ldMatch = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
  );
  if (ldMatch) {
    try {
      ld = JSON.parse(ldMatch[1].replace(/\/\*[\s\S]*?\*\//g, "").trim());
    } catch {
      /* mangler LD → faller tilbake til og:-metaene */
    }
  }

  const meta = (prop) =>
    (html.match(new RegExp(`<meta property="${prop}" content="([^"]*)"`)) ||
      [])[1] || "";
  const runtimeMatch = html.match(/([0-9]+)\s*(?:&nbsp;|\s)mins/);

  res.setHeader(
    "Cache-Control",
    "s-maxage=604800, stale-while-revalidate=2592000"
  );
  res.status(200).json({
    poster: ld?.image || meta("og:image") || "",
    synopsis: decodeEntities(meta("og:description") || ""),
    director: ld?.director?.[0]?.name || "",
    rating: ld?.aggregateRating?.ratingValue
      ? Math.round(ld.aggregateRating.ratingValue * 10) / 10
      : null,
    runtime: runtimeMatch ? parseInt(runtimeMatch[1], 10) : null,
    genres: Array.isArray(ld?.genre) ? ld.genre : [],
  });
}
