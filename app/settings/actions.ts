"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function disconnectGoogle(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("integration_tokens")
    .delete()
    .eq("provider", "google");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/integrations");
  return { ok: true };
}
