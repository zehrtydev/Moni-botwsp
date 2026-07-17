"use server";

import { redirect } from "next/navigation";
import {
  processLoginForm,
  type LoginState,
} from "../../features/auth/login-flow";
import type { PhoneOtpClient } from "../../features/auth/phone-otp";
import { createServerSupabaseClient } from "../../lib/supabase/server";

export async function loginAction(
  previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  let nextState: LoginState;

  try {
    const client = await createServerSupabaseClient();
    nextState = await processLoginForm(
      client as unknown as PhoneOtpClient,
      previousState,
      formData,
    );
  } catch {
    return {
      ...previousState,
      message: "No pudimos iniciar el acceso. Intenta nuevamente.",
      tone: "error",
    };
  }

  if (nextState.step === "authenticated") {
    redirect("/dashboard");
  }

  return nextState;
}
