export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query, jurisdiction, number } = req.query;

  try {
    // Company details lookup
    if (jurisdiction && number) {
      const response = await fetch(
        `https://api.opencorporates.com/v0.4/companies/${encodeURIComponent(jurisdiction.toLowerCase())}/${encodeURIComponent(number)}`
      );

      if (!response.ok) {
        return res.status(response.status).json({ error: "OpenCorporates request failed" });
      }

      const data = await response.json();
      return res.status(200).json(data);
    }

    // Company search
    if (!query) {
      return res.status(400).json({ error: "Query parameter required" });
    }

    const response = await fetch(
      `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(query)}&per_page=5&format=json`
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: "OpenCorporates request failed" });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Company proxy error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
