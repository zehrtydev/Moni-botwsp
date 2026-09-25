import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd(), "../..");

function readRepoFile(relativePath: string) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function serviceBlock(compose: string, service: string) {
  const lines = compose.split("\n");
  const start = lines.findIndex((line) => line === `  ${service}:`);
  const end = lines.findIndex(
    (line, index) => index > start && /^  [a-z0-9-]+:$/.test(line),
  );

  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

describe("production VPS configuration", () => {
  it("defines the Moni production stack with pinned dependencies and an immutable web image", () => {
    const composePath = resolve(repoRoot, "docker-compose.prod.yml");

    expect(existsSync(composePath)).toBe(true);

    const compose = readFileSync(composePath, "utf8");

    expect(compose).toContain("name: moni");

    expect(compose).not.toMatch(/^  caddy:$/m);

    expect(compose).toContain("web:");
    expect(compose).toContain("ollama:");
    expect(compose).toContain("evolution-api:");
    expect(compose).toContain("evolution-postgres:");
    expect(compose).toContain("evolution-redis:");

    expect(compose).toContain(
      "image: ghcr.io/zehrtydev/moni-web:${MONI_IMAGE_TAG:?set MONI_IMAGE_TAG in .env.release}",
    );

    expect(compose).toContain("ollama/ollama:0.33.2");
    expect(compose).toContain("evoapicloud/evolution-api:v2.3.7");
    expect(compose).toContain("postgres:15.19-alpine3.24");
    expect(compose).toContain("redis:7.4.11-alpine3.21");

    expect(compose).not.toMatch(/image:\s*[^\n]*:latest/);
  });

  it("keeps application and data ports internal and exposes web through the shared edge network", () => {
    const compose = readRepoFile("docker-compose.prod.yml");

    const web = serviceBlock(compose, "web");
    const evolution = serviceBlock(compose, "evolution-api");
    const postgres = serviceBlock(compose, "evolution-postgres");
    const redis = serviceBlock(compose, "evolution-redis");
    const ollama = serviceBlock(compose, "ollama");

    for (const block of [web, evolution, postgres, redis, ollama]) {
      expect(block).not.toContain("ports:");
    }

    expect(web).toContain("- edge");
    expect(ollama).not.toContain("- edge");

    expect(compose).toContain("internal: true");
    expect(compose).toContain("external: true");
    expect(compose).toContain("name: edge");

    expect(compose).not.toMatch(
      /-\s*["']?(?:0\.0\.0\.0:)?(?:5432|6379|8080|11434):/,
    );
  });

  it("requires production secrets and a release image tag without committing their values", () => {
    const compose = readRepoFile("docker-compose.prod.yml");
    const example = readRepoFile(".env.production.example");
    const releaseExample = readRepoFile(".env.release.example");

    for (const name of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "WHATSAPP_WEBHOOK_SECRET",
      "EVOLUTION_API_KEY",
      "EVOLUTION_DB_PASSWORD",
    ]) {
      expect(example).toContain(`${name}=`);
      expect(compose).toContain(`\${${name}:?`);
    }

    expect(releaseExample).toContain("MONI_IMAGE_TAG=");
    expect(compose).toContain("${MONI_IMAGE_TAG:?");

    expect(`${compose}\n${example}\n${releaseExample}`).not.toContain(
      "evolutionpass",
    );
  });

  it("persists Ollama and Evolution while preserving production service names", () => {
    const compose = readRepoFile("docker-compose.prod.yml");

    for (const name of [
      "moni-web",
      "moni-ollama",
      "moni-evolution",
      "moni-evolution-postgres",
      "moni-evolution-redis",
    ]) {
      expect(compose).toContain(`container_name: ${name}`);
    }

    for (const volume of [
      "ollama_data",
      "evolution_instances",
      "evolution_postgres",
      "evolution_redis",
    ]) {
      expect(compose).toContain(`${volume}:`);
    }

    expect(compose).not.toContain("caddy_data:");
    expect(compose).not.toContain("caddy_config:");

    expect(compose).toContain(
      "AI_BASE_URL: ${AI_BASE_URL:-http://ollama:11434/v1}",
    );
    expect(compose).toContain("AI_MODEL: ${AI_MODEL:-qwen3:1.7b}");
  });

  it("enables Evolution production persistence and conservative defaults", () => {
    const compose = readRepoFile("docker-compose.prod.yml");

    expect(compose).toContain('DATABASE_ENABLED: "true"');
    expect(compose).toContain('CACHE_REDIS_SAVE_INSTANCES: "false"');
    expect(compose).toContain('CACHE_LOCAL_ENABLED: "false"');
    expect(compose).toContain('WEBHOOK_GLOBAL_ENABLED: "false"');
    expect(compose).toContain(
      'AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES: "false"',
    );

    expect(compose).toContain(
      "SERVER_URL: ${EVOLUTION_SERVER_URL:-http://127.0.0.1:8080}",
    );

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

  it("publishes an immutable image and delegates production deployment to the restricted VPS command", () => {
    const workflow = readRepoFile(".github/workflows/deploy-vps.yml");

    expect(workflow).toContain("packages: write");

    expect(workflow).toContain(
      "${{ env.IMAGE_NAME }}:${{ github.sha }}",
    );

    expect(workflow).toContain(
      "NEXT_PUBLIC_SUPABASE_URL=${{ vars.NEXT_PUBLIC_SUPABASE_URL }}",
    );

    expect(workflow).toContain(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ vars.NEXT_PUBLIC_SUPABASE_ANON_KEY }}",
    );

    expect(workflow).toContain(
      "github.ref == 'refs/heads/master'",
    );

    expect(workflow).toContain(
      "vars.PRODUCTION_DEPLOY_ENABLED == 'true'",
    );

    expect(workflow).toContain(
      '"deploy-moni $GITHUB_SHA"',
    );

    expect(workflow).toContain(
      "secrets.VPS_HOST_FINGERPRINT",
    );

    expect(workflow).toContain(
      'test "$ACTUAL_FINGERPRINT" = "$VPS_HOST_FINGERPRINT"',
    );

    expect(workflow).toContain(
      "https://moni.zehrty.dev/api/health",
    );

    expect(workflow).not.toContain("git pull --ff-only");

    expect(workflow).not.toContain(
      "docker compose --env-file .env.production -f docker-compose.prod.yml build web",
    );
  });
});
