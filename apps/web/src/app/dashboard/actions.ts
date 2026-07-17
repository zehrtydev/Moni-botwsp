"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../lib/supabase/server";

export async function logoutAction() {
  try {
    const client = await createServerSupabaseClient();
    await client.auth.signOut({ scope: "local" });
  } catch {
    // Redirecting to login remains safe if the local session is already absent.
  }

  redirect("/login");
}
