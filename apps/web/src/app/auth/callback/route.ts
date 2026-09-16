import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PUBLIC_SITE_URL = "https://moni.zehrty.dev";
const acceptedEmailOtpTypes = ["email"] as const satisfies readonly EmailOtpType[];

function isAcceptedEmailOtpType(value: string | null): value is (typeof acceptedEmailOtpTypes)[number] {
  return value !== null && acceptedEmailOtpTypes.some((acceptedType) => acceptedType === value);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (tokenHash && isAcceptedEmailOtpType(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    return NextResponse.redirect(
      new URL(error ? "/login?error=confirmacion_fallida" : "/dashboard", PUBLIC_SITE_URL),
    );
  }

  return NextResponse.redirect(
    new URL("/login?error=confirmacion_invalida", PUBLIC_SITE_URL),
  );
}
