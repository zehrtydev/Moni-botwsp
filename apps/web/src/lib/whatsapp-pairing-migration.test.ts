import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "../../supabase/migrations/20260914090000_complete_whatsapp_pairing_atomically.sql",
);
const migration = readFileSync(migrationPath, "utf8").toLowerCase();

describe("atomic WhatsApp pairing migration", () => {
  it("accepts only an unused, unexpired pairing and locks it", () => {
    expect(migration).toContain("where codigo_hash = p_codigo_hash");
    expect(migration).toContain("and usado_en is null");
    expect(migration).toContain("and expira_en > v_completed_at");
    expect(migration).toContain("for update");
  });

  it("updates the user, maps the LID and consumes the pairing in one function", () => {
    const clearStaleMappings = migration.indexOf("delete from public.whatsapp_contactos_lid");
    const updateUser = migration.indexOf("update public.usuarios");
    const mapLid = migration.indexOf("insert into public.whatsapp_contactos_lid");
    const consumePairing = migration.lastIndexOf("update public.whatsapp_vinculaciones_pendientes");

    expect(clearStaleMappings).toBeGreaterThan(-1);
    expect(updateUser).toBeGreaterThan(clearStaleMappings);
    expect(updateUser).toBeGreaterThan(-1);
    expect(mapLid).toBeGreaterThan(updateUser);
    expect(consumePairing).toBeGreaterThan(mapLid);
    expect(migration).toContain("whatsapp_number_already_linked");
    expect(migration).toContain("using errcode = '23505'");
  });

  it("is restricted to the backend service role", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toMatch(/revoke all on function[\s\S]+from public, anon, authenticated;/);
    expect(migration).toMatch(/grant execute on function[\s\S]+to service_role;/);
  });
});
