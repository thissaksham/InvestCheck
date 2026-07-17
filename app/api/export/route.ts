// Export .xlsx of all tables (§4.7). Generated server-side, streamed, never persisted (§15).
// Route handler instead of a Server Action because the response is a file download.

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getUser } from "@/lib/supabase/server";

export async function GET() {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const [instruments, transactions, deposits, epf, snapshots, prices] = await Promise.all([
    supabase.from("instruments").select("*").eq("user_id", user.id).order("name"),
    supabase.from("transactions").select("*").eq("user_id", user.id).order("date"),
    supabase.from("fixed_deposits").select("*").eq("user_id", user.id).order("maturity_date"),
    supabase.from("epf_entries").select("*").eq("user_id", user.id).order("date"),
    supabase.from("snapshots").select("date, invested, current_value").eq("user_id", user.id).order("date"),
    supabase.from("prices").select("instrument_id, date, price, source").order("date", { ascending: false }).limit(10000),
  ]);

  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: unknown[] | null) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows ?? []), name);

  add("Instruments", instruments.data);
  add("Transactions", transactions.data);
  add("Fixed deposits", deposits.data);
  add("EPF", epf.data);
  add("Snapshots", snapshots.data);
  add("Prices", prices.data);

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="investcheck-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
