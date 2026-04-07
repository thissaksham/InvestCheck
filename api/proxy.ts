import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Target API returned ${response.status}` });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error("Proxy Error:", error);
    res.status(500).json({ error: "Failed to fetch from target API" });
  }
}
