import type { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import fs from 'fs';
import { transformCasResponse, casErrorMessage } from './_lib';

export const config = {
  api: {
    bodyParser: false, // Disable Vercel's default body parser to handle multipart form data
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = formidable({});
  
  try {
    const [fields, files] = await form.parse(req);
    const file = files.file?.[0];
    const password = fields.password?.[0];

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const apiKey = req.headers["x-casparser-api-key"] as string;

    if (!apiKey) {
      return res.status(400).json({ error: "CASParser API Key is required. Please provide your personal key in Settings." });
    }

    // Prepare form data for casparser.in API
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(file.filepath);
    const blob = new Blob([fileBuffer], { type: file.mimetype || 'application/pdf' });
    formData.append("file", blob, file.originalFilename || "cas.pdf");
    if (password) {
      formData.append("password", password);
    }

    // Call casparser.in API
    const casResponse = await fetch("https://api.casparser.in/v4/smart/parse", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Accept": "application/json",
      },
      body: formData,
    });

    if (!casResponse.ok) {
      const errText = await casResponse.text();
      console.error(`CASParser API HTTP Error (${casResponse.status}):`, errText);
      return res.status(casResponse.status).json({ error: casErrorMessage(casResponse.status, errText) });
    }

    const result = await casResponse.json();

    if (result.status === "failed") {
      return res.status(422).json({
        error: result.msg || "CASParser failed to parse the PDF. Ensure the password is correct and the file is a valid CAS statement."
      });
    }

    res.status(200).json(transformCasResponse(result));
  } catch (error) {
    console.error("Verification Error:", error);
    res.status(500).json({ error: "Internal server error during verification" });
  }
}
