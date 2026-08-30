"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return <button type="button" className="secondary-button action-button sign-out-icon" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={signOut}><LogOut size={17} aria-hidden="true" /></button>;
}
