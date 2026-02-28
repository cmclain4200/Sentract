export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.HIBP_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "HIBP API key not configured" });
  }

  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: "Email parameter required" });
  }

  if (!email.includes("@") || email.length > 254) {
    return res.status(400).json({ error: "Invalid email" });
  }

  try {
    const response = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
      {
        headers: {
          "hibp-api-key": apiKey,
          "user-agent": "Sentract-Intelligence-Platform",
        },
      }
    );

    if (response.status === 404) {
      return res.status(200).json([]);
    }

    if (response.status === 429) {
      return res.status(429).json({ error: "Rate limited. Try again in a few seconds." });
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: "HIBP request failed" });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("HIBP proxy error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
