import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import { isAllowedProxyUrl, transformCasResponse, casErrorMessage } from "./api/_lib";

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
    if (!isAllowedProxyUrl(targetUrl)) {
      return res.status(403).json({ error: "Host not allowed" });
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
      const userApiKey = req.headers["x-casparser-api-key"] as string;
      const systemApiKey = process.env.CASPARSER_API_KEY;
      const apiKey = userApiKey || systemApiKey;

      if (!apiKey) {
        return res.status(500).json({ error: "CASPARSER_API_KEY is not configured and no user key provided" });
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
        return res.status(casResponse.status).json({ error: casErrorMessage(casResponse.status, errText) });
      }

      const result = await casResponse.json();

      if (result.status === "failed") {
        console.error("CASParser API Logical Failure:", result.msg);
        return res.status(422).json({
          error: result.msg || "CASParser failed to parse the PDF. Ensure the password is correct and the file is a valid CAS statement."
        });
      }

      res.json(transformCasResponse(result));
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
