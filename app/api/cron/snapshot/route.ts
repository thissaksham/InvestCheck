import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getPortfolio } from "@/lib/data";
import { snapshotPayload } from "@/lib/valuation";
import { materializeEpfRecurring } from "@/lib/epf-recurring";
import { todayIST } from "@/lib/utils";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profiles } = await service.from("profiles").select("id");
  const date = todayIST();
  let saved = 0;
  const errors: string[] = [];

  let epfGenerated = 0;
  for (const profile of profiles ?? []) {
    try {
      // due recurring EPF contributions first, so the snapshot includes them
      epfGenerated += await materializeEpfRecurring(service, profile.id, date);

      const portfolio = await getPortfolio(service, profile.id);
      // no instruments and no EPF yet → nothing to remember
      if (portfolio.instruments.length === 0 && portfolio.epfEntries.length === 0) continue;
      const payload = snapshotPayload(portfolio.positions, portfolio.epfEntries);
      const { error } = await service
        .from("snapshots")
        .upsert({ user_id: profile.id, date, ...payload }, { onConflict: "user_id,date" });
      if (error) errors.push(`${profile.id}: ${error.message}`);
      else saved++;
    } catch (e) {
      errors.push(`${profile.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ saved, epfGenerated, errors });
}
