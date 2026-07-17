import { describe, expect, it } from "vitest";
import { getSupabaseConfig } from "./config";

describe("getSupabaseConfig", () => {
  it("returns only the public project URL and publishable key", () => {
    expect(
      getSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
        SUPABASE_SERVICE_ROLE_KEY: "must-never-leave-the-server",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_example",
    });
  });

  it("fails lazily when public configuration is missing", () => {
    expect(() => getSupabaseConfig({})).toThrow(
      "La configuracion publica de Supabase no esta disponible.",
    );
  });

  it("does not include invalid URL details in the public error", () => {
    expect(() =>
      getSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "database-password-in-error",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      }),
    ).toThrow("La configuracion publica de Supabase no esta disponible.");
  });

  it("rejects a secret key in the public key variable", () => {
    expect(() =>
      getSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_misconfigured",
      }),
    ).toThrow("La configuracion publica de Supabase no esta disponible.");
  });
});
