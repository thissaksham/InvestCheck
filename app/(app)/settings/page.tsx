import { redirect } from "next/navigation";
import { SettingsView } from "@/components/settings/settings-view";
import { getUser } from "@/lib/supabase/server";
import type { Instrument } from "@/lib/types";

export default async function SettingsPage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  const [instrumentsRes, profileRes] = await Promise.all([
    supabase.from("instruments").select("*").eq("user_id", user.id).order("name"),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
  ]);

  return (
    <SettingsView
      instruments={(instrumentsRes.data ?? []) as Instrument[]}
      displayName={profileRes.data?.display_name ?? null}
      email={user.email ?? null}
    />
  );
}
