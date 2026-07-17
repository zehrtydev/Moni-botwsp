import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      provider: "v8",
      include: [
        "src/app/dashboard/actions.ts",
        "src/app/dashboard/page.tsx",
        "src/app/login/actions.ts",
        "src/app/login/login-form.tsx",
        "src/features/auth/*.ts",
        "src/features/dashboard/*.ts",
        "src/lib/phone.ts",
        "src/lib/supabase/config.ts",
        "src/lib/supabase/proxy.ts",
        "src/lib/supabase/server.ts",
        "src/proxy.ts",
      ],
      exclude: ["**/*.test.ts", "**/*.test.tsx"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
