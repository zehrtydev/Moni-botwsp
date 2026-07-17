import { z } from "zod";

const publicConfigSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .regex(/^sb_publishable_[A-Za-z0-9_-]+$/),
});

type PublicEnvironment = Record<string, string | undefined>;

export function getSupabaseConfig(
  environment: PublicEnvironment = process.env,
) {
  const result = publicConfigSchema.safeParse(environment);

  if (!result.success) {
    throw new Error(
      "La configuracion publica de Supabase no esta disponible.",
    );
  }

  return {
    url: result.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey:
      result.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}
