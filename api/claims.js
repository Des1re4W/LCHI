
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const googleUrl = process.env.GOOGLE_SHEETS_JSON_URL;

  if (!googleUrl) {
    return res.status(500).json({
      error: "Data source is not configured"
    });
  }

  try {
    const source = new URL(googleUrl);

    // Only allow your expected Google Apps Script host.
    if (source.hostname !== "script.google.com") {
      return res.status(500).json({
        error: "Invalid data source configuration"
      });
    }

    source.searchParams.set("callback", "serverClaimsCallback");

    const response = await fetch(source.toString(), {
      signal: AbortSignal.timeout(60000),
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error("Upstream request failed");
    }

    const body = await response.text();
    const match = body.match(
      /^\s*serverClaimsCallback\s*\(([\s\S]*)\)\s*;?\s*$/
    );

    if (!match) {
      throw new Error("Unexpected data source response");
    }

    const data = JSON.parse(match[1]);

    if (!data || typeof data !== "object" || data.error) {
      throw new Error("Invalid claims response");
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(data);
  } catch (error) {
    console.error("Claims proxy error:", error.message);

    return res.status(502).json({
      error: "Unable to retrieve claims data"
    });
  }
}
