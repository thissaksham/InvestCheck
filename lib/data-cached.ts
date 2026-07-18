import { cache } from "react";
import { getSessionUser } from "./supabase/server";
import { getPortfolio, type Portfolio } from "./data";

/** Per-request cached portfolio — layout and page share one set of queries. */
export const getPortfolioCached = cache(async (): Promise<Portfolio | null> => {
  const { supabase, user } = await getSessionUser();
  if (!user) return null;
  return getPortfolio(supabase, user.id);
});
