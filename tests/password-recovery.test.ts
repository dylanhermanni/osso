import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({
  getUser: vi.fn(), updateUser: vi.fn(), resetPasswordForEmail: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ supabase: async () => ({ auth }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { changePassword, requestPasswordReset } from "../src/app/password-actions";
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://osso-nine.vercel.app"); });
describe("password recovery boundaries", () => {
  it("does not update a password without a verified session", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await changePassword("test-only-long-password", "test-only-long-password")).error).toBeTruthy();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("rejects short or mismatched passwords before contacting auth", async () => {
    expect((await changePassword("short", "short")).error).toBeTruthy();
    expect((await changePassword("test-only-long-password", "different-password")).error).toBeTruthy();
    expect(auth.getUser).not.toHaveBeenCalled();
  });
  it("uses the configured same-origin recovery destination", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    expect(await requestPasswordReset("test@example.com")).toEqual({ ok: true });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("test@example.com", { redirectTo: "https://osso-nine.vercel.app/auth/herstel" });
  });
  it("returns a useful error when mail delivery fails", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: { message: "provider detail" } });
    const result = await requestPasswordReset("test@example.com");
    expect(result.error).toMatch(/niet worden verstuurd/);
    expect(result.error).not.toContain("provider detail");
  });
});
