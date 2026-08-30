type AuthErrorLike = {
  code?: unknown;
};

const knownMessages: Record<string, string> = {
  email_exists: "Ese correo ya tiene una cuenta. Intenta iniciar sesión.",
  email_address_invalid: "Escribe un correo electrónico válido.",
  invalid_credentials: "El correo o la contraseña no son correctos.",
  over_request_rate_limit: "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.",
  signup_disabled: "El registro de nuevas cuentas está temporalmente desactivado.",
};

export function getAuthErrorMessage(error: unknown, registering: boolean): string {
  if (error && typeof error === "object") {
    const authError = error as AuthErrorLike;
    const code = typeof authError.code === "string" ? authError.code : "";
    if (knownMessages[code]) return knownMessages[code];
  }

  return registering ? "No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo." : "No se pudo iniciar sesión.";
}

export function getSignupSuccessMessage(hasSession: boolean): string {
  return hasSession ? "Cuenta creada correctamente. Ya puedes comenzar." : "Cuenta creada. Revisa tu correo si Supabase solicita confirmación.";
}
