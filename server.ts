import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";

console.log("Starting server.ts...");
dotenv.config();

const upload = multer({ dest: "uploads/" });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Ensure uploads directory exists
  if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
  }

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Proxy endpoint for external APIs (to avoid CORS issues)
  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    try {
      console.log(`Proxying request to: ${targetUrl}`);
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
      res.json(data);
    } catch (error) {
      console.error("Proxy Error:", error);
      res.status(500).json({ error: "Failed to fetch from target API" });
    }
  });

  // API Route for CAS verification
  app.post("/api/verify-cas", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { password } = req.body;
      const apiKey = process.env.CASPARSER_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "CASPARSER_API_KEY is not configured" });
      }

      // Prepare form data for casparser.in API
      const formData = new FormData();
      const fileBuffer = fs.readFileSync(req.file.path);
      const blob = new Blob([fileBuffer], { type: req.file.mimetype });
      formData.append("file", blob, req.file.originalname);
      if (password) {
        formData.append("password", password);
      }

      // Call casparser.in API
      console.log(`Calling CASParser API for file: ${req.file.originalname}`);
      // Updated to v4 smart parse endpoint as per user request
      const casResponse = await fetch("https://api.casparser.in/v4/smart/parse", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Accept": "application/json",
        },
        body: formData,
      });

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      if (!casResponse.ok) {
        const errText = await casResponse.text();
        console.error(`CASParser API HTTP Error (${casResponse.status}):`, errText);
        
        let errorMsg = `CASParser API Error (${casResponse.status})`;
        
        // Try to parse as JSON first
        try {
          const errJson = JSON.parse(errText);
          errorMsg = errJson.msg || errJson.error || errorMsg;
        } catch (e) {
          // If not JSON, check for common error strings in the text/HTML
          if (errText.includes("Insufficient credits")) {
            errorMsg = "Insufficient credits in CASParser API account. Please top up.";
          } else if (errText.includes("Forbidden") || casResponse.status === 403) {
            errorMsg = "Access Forbidden (403). This might be due to insufficient credits or an invalid API key.";
          }
        }
        
        return res.status(casResponse.status).json({ error: errorMsg });
      }

      const result = await casResponse.json();
      console.log("CASParser API Response Status:", result.status || "OK");
      
      // Check for 'failed' status in the JSON response (if applicable in v4)
      if (result.status === "failed") {
        console.error("CASParser API Logical Failure:", result.msg);
        return res.status(422).json({ 
          error: result.msg || "CASParser failed to parse the PDF. Ensure the password is correct and the file is a valid CAS statement." 
        });
      }

      // Transform v4 smart parse response to our expected format
      // Expected format: { data: { name: string, units: number, folio?: string, isin?: string }[] }
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

      // 2. Extract from demat_accounts (equities and demat_mutual_funds)
      if (result.demat_accounts && Array.isArray(result.demat_accounts)) {
        result.demat_accounts.forEach((acc: any) => {
          if (acc.holdings) {
            // Equities
            if (acc.holdings.equities && Array.isArray(acc.holdings.equities)) {
              acc.holdings.equities.forEach((eq: any) => {
                parsedData.push({
                  name: eq.symbol || eq.name || eq.isin || "Unknown Stock",
                  units: parseFloat(eq.quantity || eq.units || 0),
                  isin: eq.isin || eq.isin_code,
                });
              });
            }
            // Demat Mutual Funds
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

      // Fallback for older formats if v4 structure is missing
      if (parsedData.length === 0 && (result.data || result.schemes)) {
        const legacyData = (result.data || result.schemes || []).map((item: any) => ({
          name: item.scheme || item.name || item.description,
          units: parseFloat(item.units || item.balance || 0),
        }));
        parsedData.push(...legacyData);
      }

      res.json({ data: parsedData });
    } catch (error) {
      console.error("Verification Error:", error);
      res.status(500).json({ error: "Internal server error during verification" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
