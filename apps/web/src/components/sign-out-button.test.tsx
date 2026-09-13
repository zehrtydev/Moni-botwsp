import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignOutButton } from "./sign-out-button";

const { replace, refresh, signOut } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), signOut: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({ auth: { signOut } }) }));

describe("SignOutButton", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    signOut.mockReset();
  });

  it("ends the session and returns to the public landing", async () => {
    signOut.mockResolvedValue({ error: null });
    render(<SignOutButton />);

    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(signOut).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/");
    expect(refresh).toHaveBeenCalled();
  });
});
