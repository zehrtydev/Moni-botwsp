import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const requiredEnvironment = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "WHATSAPP_WEBHOOK_SECRET",
] as const;

function hasPlaceholder(value: string | undefined) {
  return !value || value.startsWith("replace-with-");
}

export async function GET() {
  const missingConfiguration = requiredEnvironment.filter((name) => hasPlaceholder(process.env[name]));
  if (missingConfiguration.length > 0) {
    return NextResponse.json(
      { status: "degraded", checks: { configuration: "failed", database: "not_checked" } },
      { status: 503 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("mensajes_entrantes").select("id", { head: true, count: "exact" });
    if (error) throw error;
    return NextResponse.json({ status: "ok", checks: { configuration: "ok", database: "ok" } });
  } catch (error) {
    console.error("health_database_check_failed", error);
    return NextResponse.json(
      { status: "degraded", checks: { configuration: "ok", database: "failed" } },
      { status: 503 },
    );
  }
}
