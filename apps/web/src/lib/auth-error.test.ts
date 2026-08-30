import { describe, expect, it } from "vitest";
import { getAuthErrorMessage, getSignupSuccessMessage } from "./auth-error";

describe("getAuthErrorMessage", () => {
  it("does not render an empty object when Supabase returns an unknown error shape", () => {
    expect(getAuthErrorMessage({}, true)).toBe("No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.");
  });

  it("uses a safe, actionable message for known signup errors", () => {
    expect(getAuthErrorMessage({ code: "email_exists", message: "User already registered" }, true)).toBe(
      "Ese correo ya tiene una cuenta. Intenta iniciar sesión.",
    );
  });

  it("does not expose internal provider details", () => {
    expect(getAuthErrorMessage({ message: "Database error saving new user" }, true)).toBe(
      "No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.",
    );
  });

  it("uses a success message without email confirmation when a session exists", () => {
    expect(getSignupSuccessMessage(true)).toBe("Cuenta creada correctamente. Ya puedes comenzar.");
  });

  it("keeps the confirmation message when Supabase requires email confirmation", () => {
    expect(getSignupSuccessMessage(false)).toBe("Cuenta creada. Revisa tu correo si Supabase solicita confirmación.");
  });
});
