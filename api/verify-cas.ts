import type { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import fs from 'fs';

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

    const apiKey = process.env.CASPARSER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "CASPARSER_API_KEY is not configured" });
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
      
      let errorMsg = `CASParser API Error (${casResponse.status})`;
      try {
        const errJson = JSON.parse(errText);
        errorMsg = errJson.msg || errJson.error || errorMsg;
      } catch (e) {
        if (errText.includes("Insufficient credits")) {
          errorMsg = "Insufficient credits in CASParser API account. Please top up.";
        } else if (errText.includes("Forbidden") || casResponse.status === 403) {
          errorMsg = "Access Forbidden (403). This might be due to insufficient credits or an invalid API key.";
        }
      }
      return res.status(casResponse.status).json({ error: errorMsg });
    }

    const result = await casResponse.json();
    
    if (result.status === "failed") {
      return res.status(422).json({ 
        error: result.msg || "CASParser failed to parse the PDF. Ensure the password is correct and the file is a valid CAS statement." 
      });
    }

    // Transform v4 smart parse response to our expected format
    const parsedData: { name: string, units: number, folio?: string, isin?: string }[] = [];

    // 1. Extract from mutual_funds
    if (result.mutual_funds && Array.isArray(result.mutual_funds)) {
      result.mutual_funds.forEach((mf: any) => {
        const folio = mf.folio_number || mf.folio;
        if (mf.schemes && Array.isArray(mf.schemes)) {
          mf.schemes.forEach((scheme: any) => {
            parsedData.push({
              name: scheme.scheme_name || scheme.name || "Unknown MF",
              units: parseFloat(scheme.units || scheme.balance || 0),
              folio: folio,
              isin: scheme.isin || scheme.isin_code,
            });
          });
        }
      });
    }

    // 2. Extract from demat_accounts
    if (result.demat_accounts && Array.isArray(result.demat_accounts)) {
      result.demat_accounts.forEach((acc: any) => {
        if (acc.holdings) {
          if (acc.holdings.equities && Array.isArray(acc.holdings.equities)) {
            acc.holdings.equities.forEach((eq: any) => {
              parsedData.push({
                name: eq.symbol || eq.name || eq.isin || "Unknown Stock",
                units: parseFloat(eq.quantity || eq.units || 0),
                isin: eq.isin || eq.isin_code,
              });
            });
          }
          if (acc.holdings.demat_mutual_funds && Array.isArray(acc.holdings.demat_mutual_funds)) {
            acc.holdings.demat_mutual_funds.forEach((mf: any) => {
              parsedData.push({
                name: mf.scheme_name || mf.name || "Unknown Demat MF",
                units: parseFloat(mf.units || mf.quantity || 0),
                isin: mf.isin || mf.isin_code,
              });
            });
          }
        }
      });
    }

    // Fallback for older formats
    if (parsedData.length === 0 && (result.data || result.schemes)) {
      const legacyData = (result.data || result.schemes || []).map((item: any) => ({
        name: item.scheme || item.name || item.description,
        units: parseFloat(item.units || item.balance || 0),
      }));
      parsedData.push(...legacyData);
    }

    res.status(200).json({ data: parsedData });
  } catch (error) {
    console.error("Verification Error:", error);
    res.status(500).json({ error: "Internal server error during verification" });
  }
}
