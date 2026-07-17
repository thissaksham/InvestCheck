/** Contract for every fetcher (§8). A failed fetch never overwrites a stored price. */
export type FetchSuccess = {
  price: number;
  asOf: string;
  /** extras used for auto-detection at add-time; absent on some sources */
  currency?: string | null;
  name?: string | null;
  quoteType?: string | null; // yahoo: EQUITY | ETF | …
  category?: string | null; // mfapi: scheme_category
};
export type FetchResult = FetchSuccess | { error: string };

export function isFetchError(r: FetchResult): r is { error: string } {
  return "error" in r;
}
