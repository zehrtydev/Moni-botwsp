import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PUBLIC_SITE_URL = "https://moni.zehrty.dev";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=confirmacion_invalida", PUBLIC_SITE_URL),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=confirmacion_fallida", PUBLIC_SITE_URL),
    );
  }

  return NextResponse.redirect(
    new URL("/dashboard", PUBLIC_SITE_URL),
  );
}
