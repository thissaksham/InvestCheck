# InvestCheck | Portfolio Integrity & Verification

## The Problem: The "Dashboard vs. Reality" Gap
In the modern fintech landscape, investors rely almost exclusively on the user interfaces of their primary brokers and investment apps. This creates a significant **verification gap**: users see their holdings on a digital dashboard, but they lack a simple, independent way to confirm if those investments have actually been registered with the Asset Management Company (AMC) or the Exchange.

Recent high-profile incidents in the industry have highlighted cases where investors faced discrepancies between their app's dashboard and their actual ownership records. This "black box" effect leaves investors vulnerable to reporting errors or platform-side failures, with no easy way to "Trust but Verify" their hard-earned money.

## The Solution: InvestCheck
**InvestCheck** is a dedicated portfolio management and integrity verification tool designed to bridge this gap. It provides investors with an independent layer of truth by cross-referencing their manually tracked portfolio against official **Consolidated Account Statements (CAS)**.

By securely parsing your CAS PDF (generated from NSDL/CDSL or CAMS/KFintech), InvestCheck ensures that every unit and share you believe you own is accurately reflected in the official depository or AMC records.

## Key Features
- **🛡️ Portfolio Integrity Verification:** Securely upload your CAS PDF to verify your Mutual Fund and Stock holdings. The app uses the **CASParser API** to extract official data and compare it with your dashboard.
- **🔑 Bring Your Own Key (BYOK):** To use the CAS verification feature, you must provide your own **CASParser API key** in the settings. This ensures your data remains private and you aren't limited by shared platform quotas.
- **📊 Unified Dashboard:** A clean, high-performance interface to track Mutual Funds, Stocks, and Fixed Deposits in one place.
- **📈 Real-time Data:** 
  - **Mutual Funds:** Latest NAVs fetched directly via MFAPI.
  - **Stocks:** Real-time prices synced using Yahoo Finance.
- **📜 Transaction History:** Maintain a detailed log of every Buy/Sell transaction with automatic weighted average cost calculation and descending chronological view.
- **🔒 Secure & Private:** Built with Supabase Auth (Google login) and Postgres with Row Level Security, ensuring your financial data is private and accessible only to you.
- **⚡ Serverless Architecture:** Optimized for Vercel with serverless functions handling API proxies and PDF parsing to ensure reliability and bypass CORS restrictions.

## Tech Stack
- **Frontend:** React 19, TypeScript, Tailwind CSS, Motion (animations), Lucide React (icons).
- **Backend:** 
  - **Supabase:** Authentication (Google Login) and Postgres with Row Level Security. Transactions are the source of truth; holdings are derived, never stored.
  - **Vercel Serverless Functions:** Node.js functions for secure API interactions.
- **APIs:**
  - **CASParser API:** For official statement parsing.
  - **MFAPI:** For Mutual Fund NAVs and search.
  - **Yahoo Finance:** For real-time stock market data.

## Environment Variables
Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon key (also set them in Vercel for production). CAS parsing uses a **BYOK (Bring Your Own Key)** model, so no server-side keys are needed.

## Bring Your Own Key (BYOK)
InvestCheck operates on a strict "Bring Your Own Key" model for CAS statement parsing. There is no default or shared API key provided by the platform.
- **Requirement:** You **must** provide your own personal API key from [CASParser](https://app.casparser.in/) to verify your portfolio statements.
- **Privacy:** Your personal API key is stored securely in your private Firestore document and is only used for your own requests.
- **Setup:** Click your profile photo, open **Settings**, and paste your key.

## Supabase Setup
1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` in the SQL editor (tables + Row Level Security policies).
3. Enable the **Google** provider under Authentication → Providers, and add your app URLs (localhost + Vercel) to the redirect allowlist.
4. Copy the project URL and anon key into `.env.local` (see `.env.example`).

## Migrating from the old Firebase version
Open `/export-firebase.html` in the running app, sign in with your old Google account, and download the JSON export. Then in the new app: **Settings → Import legacy data**. Import once, into an empty account.

## Getting Started
1. Clone the repository.
2. Install dependencies: `npm install`.
3. Set up Supabase (see above) and create `.env.local`.
4. Start the development server: `npm run dev`.
5. Build for production: `npm run build`.

---
*InvestCheck is not a broker. It is an independent verification layer for your financial peace of mind.*
