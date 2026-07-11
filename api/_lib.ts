// Shared between the Vercel functions (api/*) and the dev server (server.ts).

export const ALLOWED_PROXY_HOSTS = new Set([
  "api.mfapi.in",
  "query1.finance.yahoo.com",
  "query2.finance.yahoo.com",
]);

export function isAllowedProxyUrl(url: string): boolean {
  try {
    return ALLOWED_PROXY_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export interface CasHolding {
  name: string;
  units: number;
  folio?: string;
  isin?: string;
}

// Transform casparser.in v4 smart-parse response into a flat holdings list.
export function transformCasResponse(result: any): { data: CasHolding[]; statementDate?: string } {
  const statementDate = result.meta?.statement_period?.to || result.meta?.generated_at;
  const parsedData: CasHolding[] = [];

  if (Array.isArray(result.mutual_funds)) {
    result.mutual_funds.forEach((mf: any) => {
      const folio = mf.folio_number || mf.folio;
      if (Array.isArray(mf.schemes)) {
        mf.schemes.forEach((scheme: any) => {
          parsedData.push({
            name: scheme.scheme_name || scheme.name || "Unknown MF",
            units: parseFloat(scheme.units || scheme.balance || 0),
            folio,
            isin: scheme.isin || scheme.isin_code,
          });
        });
      }
    });
  }

  if (Array.isArray(result.demat_accounts)) {
    result.demat_accounts.forEach((acc: any) => {
      if (!acc.holdings) return;
      if (Array.isArray(acc.holdings.equities)) {
        acc.holdings.equities.forEach((eq: any) => {
          parsedData.push({
            name: eq.symbol || eq.name || eq.isin || "Unknown Stock",
            units: parseFloat(eq.quantity || eq.units || 0),
            isin: eq.isin || eq.isin_code,
          });
        });
      }
      if (Array.isArray(acc.holdings.demat_mutual_funds)) {
        acc.holdings.demat_mutual_funds.forEach((mf: any) => {
          parsedData.push({
            name: mf.scheme_name || mf.name || "Unknown Demat MF",
            units: parseFloat(mf.units || mf.quantity || 0),
            isin: mf.isin || mf.isin_code,
          });
        });
      }
    });
  }

  // Fallback for older response formats
  if (parsedData.length === 0 && (result.data || result.schemes)) {
    (result.data || result.schemes || []).forEach((item: any) => {
      parsedData.push({
        name: item.scheme || item.name || item.description,
        units: parseFloat(item.units || item.balance || 0),
      });
    });
  }

  return { data: parsedData, statementDate };
}

// Turn a non-OK casparser.in response body into a user-facing message.
export function casErrorMessage(status: number, errText: string): string {
  let errorMsg = `CASParser API Error (${status})`;
  try {
    const errJson = JSON.parse(errText);
    errorMsg = errJson.msg || errJson.error || errorMsg;
  } catch {
    if (errText.includes("Insufficient credits")) {
      errorMsg = "Insufficient credits in CASParser API account. Please top up.";
    } else if (errText.includes("Forbidden") || status === 403) {
      errorMsg = "Access Forbidden (403). This might be due to insufficient credits or an invalid API key.";
    }
  }
  return errorMsg;
}

function demo() {
  console.assert(isAllowedProxyUrl("https://api.mfapi.in/mf/12345"));
  console.assert(!isAllowedProxyUrl("https://evil.com/?x=api.mfapi.in"));
  console.assert(!isAllowedProxyUrl("not a url"));

  const { data, statementDate } = transformCasResponse({
    meta: { statement_period: { to: "2026-06-30" } },
    mutual_funds: [{ folio_number: "123/45", schemes: [{ scheme_name: "Test Fund", units: "10.5", isin: "INF123" }] }],
    demat_accounts: [{ holdings: { equities: [{ symbol: "TCS", quantity: "5", isin: "INE467B01029" }] } }],
  });
  console.assert(statementDate === "2026-06-30");
  console.assert(data.length === 2 && data[0].units === 10.5 && data[1].name === "TCS");
  console.assert(casErrorMessage(403, "<html>Forbidden</html>").includes("403"));
  console.log("api/_lib self-check passed");
}

// ponytail: run `npx tsx api/_lib.ts` for the self-check
if (process.argv[1]?.includes("_lib")) demo();
