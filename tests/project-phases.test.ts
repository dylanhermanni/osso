import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  member: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  result: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabase: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => {
      const chain = {
        select: () => chain,
        eq: (...args: unknown[]) => {
          mocks.eq(...args);
          return chain;
        },
        single: mocks.member,
        maybeSingle: mocks.result,
        insert: mocks.insert,
        update: (...args: unknown[]) => {
          mocks.update(...args);
          return chain;
        },
      };
      return chain;
    },
  }),
}));
import { addProjectPhase, renameProjectPhase } from "../src/app/actions";
const h = "00000000-0000-4000-8000-000000000001",
  project = "00000000-0000-4000-8000-000000000002",
  phase = "00000000-0000-4000-8000-000000000003";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user" } } });
  mocks.member.mockResolvedValue({ data: { user_id: "user" }, error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.result.mockResolvedValue({ data: { id: phase }, error: null });
});
describe("projectfase opslaan", () => {
  it("weigert wijzigingen buiten het eigen huishouden", async () => {
    mocks.member.mockResolvedValue({ data: null, error: null });
    expect(
      (await renameProjectPhase(h, project, phase, "Oud", "Nieuw")).ok,
    ).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("beveiligt een naamswijziging tegen gelijktijdig overschrijven", async () => {
    expect(
      (await renameProjectPhase(h, project, phase, "Oud", " Nieuw ")).ok,
    ).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({ title: "Nieuw" });
    expect(mocks.eq).toHaveBeenCalledWith("household_id", h);
    expect(mocks.eq).toHaveBeenCalledWith("project_id", project);
    expect(mocks.eq).toHaveBeenCalledWith("id", phase);
    expect(mocks.eq).toHaveBeenCalledWith("title", "Oud");
    mocks.result.mockResolvedValue({ data: null, error: null });
    expect(
      await renameProjectPhase(h, project, phase, "Oud", "Nieuw"),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining("ondertussen gewijzigd"),
    });
  });
  it("kan een verloren antwoord opnieuw proberen zonder de fase te dupliceren", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "23505" } });
    expect((await addProjectPhase(h, project, phase, "Schilderen")).ok).toBe(
      true,
    );
    expect(mocks.eq).toHaveBeenCalledWith("title", "Schilderen");
    mocks.result.mockResolvedValue({ data: null, error: null });
    expect((await addProjectPhase(h, project, phase, "Andere titel")).ok).toBe(
      false,
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("weigert lege namen voordat een databaseverbinding nodig is", async () => {
    expect((await addProjectPhase(h, project, phase, "  ")).ok).toBe(false);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});
