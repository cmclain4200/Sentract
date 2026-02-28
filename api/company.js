const SEC_USER_AGENT = "Sentract app@sentract.com";

let tickerCache = null;
let tickerCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

async function fetchTickers() {
  if (tickerCache && Date.now() - tickerCacheTime < CACHE_TTL) return tickerCache;

  const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: { "User-Agent": SEC_USER_AGENT },
  });
  if (!res.ok) throw new Error(`SEC tickers fetch failed: ${res.status}`);

  const data = await res.json();
  tickerCache = Object.values(data);
  tickerCacheTime = Date.now();
  return tickerCache;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query, cik } = req.query;

  try {
    // Company details by CIK
    if (cik) {
      const paddedCik = String(cik).padStart(10, "0");
      const response = await fetch(
        `https://data.sec.gov/submissions/CIK${paddedCik}.json`,
        { headers: { "User-Agent": SEC_USER_AGENT } }
      );

      if (!response.ok) {
        return res.status(response.status).json({ error: "SEC EDGAR request failed" });
      }

      const data = await response.json();
      return res.status(200).json(data);
    }

    // Company search
    if (!query) {
      return res.status(400).json({ error: "Query parameter required" });
    }

    const tickers = await fetchTickers();
    const q = query.toLowerCase();

    const matches = tickers
      .filter((t) => t.title?.toLowerCase().includes(q) || t.ticker?.toLowerCase().includes(q))
      .slice(0, 5)
      .map((t) => ({
        name: t.title,
        cik: t.cik_str,
        ticker: t.ticker,
      }));

    return res.status(200).json({ results: matches });
  } catch (error) {
    console.error("Company proxy error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
