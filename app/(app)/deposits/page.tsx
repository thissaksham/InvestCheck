import { redirect } from "next/navigation";
import { DepositsView } from "@/components/deposits/deposits-view";
import { getUser } from "@/lib/supabase/server";
import type { FixedDeposit } from "@/lib/types";

export default async function DepositsPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>;
}) {
  const { add } = await searchParams;
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("fixed_deposits")
    .select("*")
    .eq("user_id", user.id)
    .order("maturity_date");

  return <DepositsView fds={(data ?? []) as FixedDeposit[]} initialAddOpen={add === "1"} />;
}
