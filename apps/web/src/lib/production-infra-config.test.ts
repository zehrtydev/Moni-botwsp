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
    (line, index) =>
      index > start &&
      (/^  [a-z0-9-]+:$/.test(line) || /^[a-z0-9-]+:$/.test(line)),
  );

  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

describe("production VPS configuration", () => {
  it("defines the Moni production stack with an immutable web image", () => {
    const composePath = resolve(repoRoot, "docker-compose.prod.yml");

    expect(existsSync(composePath)).toBe(true);

    const compose = readFileSync(composePath, "utf8");

    expect(compose).toContain("name: moni");

    expect(compose).toContain("web:");
    expect(compose).toContain("ollama:");

    expect(compose).not.toMatch(/^  caddy:$/m);
    expect(compose).not.toMatch(/^  evolution-api:$/m);
    expect(compose).not.toMatch(/^  evolution-postgres:$/m);
    expect(compose).not.toMatch(/^  evolution-redis:$/m);

    expect(compose).toContain(
      "image: ghcr.io/zehrtydev/moni-web:${MONI_IMAGE_TAG:?set MONI_IMAGE_TAG in .env.release}",
    );

    expect(compose).toContain("ollama/ollama:0.33.2");

    expect(compose).not.toMatch(/image:\s*[^\n]*:latest/);
  });

  it("keeps Moni ports internal and exposes web only through shared networks", () => {
    const compose = readRepoFile("docker-compose.prod.yml");

    const web = serviceBlock(compose, "web");
    const ollama = serviceBlock(compose, "ollama");

    expect(web).not.toContain("ports:");
    expect(ollama).not.toContain("ports:");

    expect(web).toContain("- edge");
    expect(web).toContain("- evolution");

    expect(ollama).not.toContain("- edge");
    expect(ollama).not.toContain("- evolution");

    expect(compose).toContain("external: true");
    expect(compose).toContain("name: edge");
    expect(compose).toContain("name: evolution");
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
      "EVOLUTION_INSTANCE_NAME",
    ]) {
      expect(example).toContain(`${name}=`);
      expect(compose).toContain(`\${${name}:?`);
    }

    expect(example).toContain(
      "EVOLUTION_API_URL=http://evolution-api:8080",
    );

    expect(example).not.toContain("EVOLUTION_DB_PASSWORD=");
    expect(compose).not.toContain("EVOLUTION_DB_PASSWORD");

    expect(releaseExample).toContain("MONI_IMAGE_TAG=");
    expect(compose).toContain("${MONI_IMAGE_TAG:?");
  });

  it("persists only Moni-owned application data", () => {
    const compose = readRepoFile("docker-compose.prod.yml");

    expect(compose).toContain("container_name: moni-web");
    expect(compose).toContain("container_name: moni-ollama");

    expect(compose).toContain("ollama_data:");

    expect(compose).not.toContain("evolution_instances:");
    expect(compose).not.toContain("evolution_postgres:");
    expect(compose).not.toContain("evolution_redis:");

    expect(compose).not.toContain("caddy_data:");
    expect(compose).not.toContain("caddy_config:");

    expect(compose).toContain(
      "AI_BASE_URL: ${AI_BASE_URL:-http://ollama:11434/v1}",
    );
    expect(compose).toContain("AI_MODEL: ${AI_MODEL:-qwen3:1.7b}");
  });

  it("uses the shared Evolution platform instead of owning Evolution services", () => {
    const compose = readRepoFile("docker-compose.prod.yml");
    const web = serviceBlock(compose, "web");

    expect(compose).not.toMatch(/^  evolution-api:$/m);
    expect(compose).not.toMatch(/^  evolution-postgres:$/m);
    expect(compose).not.toMatch(/^  evolution-redis:$/m);
    expect(compose).not.toContain("data-net:");

    expect(web).toContain(
      "EVOLUTION_API_URL: ${EVOLUTION_API_URL:-http://evolution-api:8080}",
    );

    expect(web).toContain(
      "EVOLUTION_API_KEY: ${EVOLUTION_API_KEY:?set EVOLUTION_API_KEY in .env.production}",
    );

    expect(web).toContain(
      "EVOLUTION_INSTANCE_NAME: ${EVOLUTION_INSTANCE_NAME:?set EVOLUTION_INSTANCE_NAME in .env.production}",
    );

    expect(web).toContain("- evolution");

    expect(compose).toContain("name: evolution");
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

  it("publishes an immutable image and delegates deployment to the restricted VPS command", () => {
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
  });
});
