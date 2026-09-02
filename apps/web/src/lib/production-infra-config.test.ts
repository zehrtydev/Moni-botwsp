import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd(), "../..");

function readRepoFile(relativePath: string) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("production VPS configuration", () => {
  it("defines the complete production stack with pinned images", () => {
    const composePath = resolve(repoRoot, "docker-compose.prod.yml");

    expect(existsSync(composePath)).toBe(true);
    const compose = readFileSync(composePath, "utf8");
    expect(compose).toContain("web:");
    expect(compose).toContain("evolution-api:");
    expect(compose).toContain("evolution-postgres:");
    expect(compose).toContain("evolution-redis:");
    expect(compose).toContain("evoapicloud/evolution-api:v2.3.7");
    expect(compose).not.toMatch(/image:\s*[^\n]*:latest/);
  });

  it("keeps public ports on loopback and data services internal", () => {
    const compose = readRepoFile("docker-compose.prod.yml");

    expect(compose).toContain('"127.0.0.1:3000:3000"');
    expect(compose).toContain('"127.0.0.1:8080:8080"');
    expect(compose).toContain("internal: true");
    expect(compose).not.toMatch(/-\s*["']?(?:0\.0\.0\.0:)?(?:5432|6379):/);
  });

  it("requires production secrets without committing their values", () => {
    const compose = readRepoFile("docker-compose.prod.yml");
    const example = readRepoFile(".env.production.example");

    for (const name of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "WHATSAPP_WEBHOOK_SECRET",
      "EVOLUTION_API_KEY",
      "EVOLUTION_SERVER_URL",
      "EVOLUTION_POSTGRES_PASSWORD",
    ]) {
      expect(example).toContain(`${name}=`);
    }
    for (const name of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "WHATSAPP_WEBHOOK_SECRET",
      "EVOLUTION_API_KEY",
      "EVOLUTION_POSTGRES_PASSWORD",
    ]) {
      expect(compose).toContain(`\${${name}:?`);
    }
    expect(`${compose}\n${example}`).not.toContain("evolutionpass");
  });

  it("enables Evolution production persistence and conservative defaults", () => {
    const compose = readRepoFile("docker-compose.prod.yml");

    expect(compose).toContain('DATABASE_ENABLED: "true"');
    expect(compose).toContain('CACHE_REDIS_SAVE_INSTANCES: "false"');
    expect(compose).toContain('CACHE_LOCAL_ENABLED: "false"');
    expect(compose).toContain('WEBHOOK_GLOBAL_ENABLED: "false"');
    expect(compose).toContain('AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES: "false"');
    expect(compose).toContain("SERVER_URL: ${EVOLUTION_SERVER_URL:-http://127.0.0.1:8080}");
    expect(compose).not.toContain("wget -qO-");
  });

  it("builds Next.js as a standalone production image", () => {
    const dockerfile = readRepoFile("apps/web/Dockerfile");
    const nextConfig = readRepoFile("apps/web/next.config.ts");

    expect(dockerfile).toContain("node:22.23.2-alpine3.23");
    expect(dockerfile).toContain("/app/.next/standalone");
    expect(dockerfile).toContain("USER nextjs");
    expect(dockerfile).toContain('["node", "server.js"]');
    expect(nextConfig).toContain('output: "standalone"');
  });

  it("deploys and waits for the complete stack", () => {
    const workflow = readRepoFile(".github/workflows/deploy-vps.yml");

    expect(workflow).toContain("up -d --remove-orphans --wait --wait-timeout 180");
    expect(workflow).not.toContain("up -d web");
    expect(workflow).toContain("secrets.VPS_HOST_FINGERPRINT");
    expect(workflow).toContain('test "$ACTUAL_FINGERPRINT" = "$VPS_HOST_FINGERPRINT"');
    expect(workflow).toContain("https://moni.zehrty.dev/api/health");
  });
});
