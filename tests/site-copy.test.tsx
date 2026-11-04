import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  catalog,
  findCopy,
  translateCopy,
  validateCopyValue,
} from "../src/lib/site-copy/core";
import { ContentProvider, CopyScope } from "../src/components/content-provider";
const key = (text: string) => {
  const found = findCopy(text);
  if (!found) throw new Error("Missing copy: " + text);
  return found.entry.key;
};
describe("editable site copy", () => {
  it("matches dynamic labels and punctuation without changing their values", () => {
    const add = catalog.find((entry) => entry.source === "{1} toevoegen")!;
    expect(
      translateCopy("Leverancier toevoegen", { [add.key]: "Nieuwe {1}" }),
    ).toBe("Nieuwe Leverancier");
    const welcome = catalog.find(
      (entry) => entry.source === "WELKOM THUIS{1}",
    )!;
    expect(translateCopy("WELKOM THUIS", { [welcome.key]: "Welkom{1}" })).toBe(
      "Welkom",
    );
    expect(
      translateCopy("WELKOM THUIS, DYLAN", { [welcome.key]: "Welkom{1}" }),
    ).toBe("Welkom, DYLAN");
    const remove = catalog.find((entry) =>
      entry.source.startsWith("“{1}” verwijderen?"),
    )!;
    expect(
      translateCopy(
        "“Keuken” verwijderen? Gekoppelde gegevens kunnen verwijderen blokkeren.",
        { [remove.key]: "Verwijder {1}?" },
      ),
    ).toBe("Verwijder Keuken?");
  });
  it("keeps surrounding spaces and dynamic business values", () => {
    expect(translateCopy(" betaald", { [key("betaald")]: "voldaan" })).toBe(
      " voldaan",
    );
    expect(translateCopy("€ 2.450,00", {})).toBe("€ 2.450,00");
    expect(translateCopy("Unieke zelf ingevoerde kamertitel", {})).toBe(
      "Unieke zelf ingevoerde kamertitel",
    );
  });
  it("preserves every template placeholder on save", () => {
    const entry = catalog.find(
      (entry) => entry.template && entry.source.includes("{1}"),
    )!;
    expect(validateCopyValue(entry.key, entry.source + " aangepast")).toBe(
      entry.source + " aangepast",
    );
    expect(() =>
      validateCopyValue(entry.key, "Weg met de invulvelden"),
    ).toThrow(/invulvelden/);
    expect(() => validateCopyValue(entry.key, entry.source + " {1}")).toThrow(
      /invulvelden/,
    );
  });
  it("rejects unknown keys and empty content, but supports reset", () => {
    expect(() => validateCopyValue("arbitrary", "text")).toThrow();
    expect(() => validateCopyValue(key("Taken"), "  ")).toThrow();
    expect(validateCopyValue(key("Taken"), null)).toBe(null);
  });
  it("renders plain text safely and never translates input or enum values", () => {
    const html = renderToStaticMarkup(
      <ContentProvider
        canEdit
        ready
        records={[
          { key: key("Afgerond"), value: "Klaar", version: 1, updated_at: "" },
          {
            key: key("Taken"),
            value: "<script>alert(1)</script>",
            version: 1,
            updated_at: "",
          },
          {
            key: key("Zoeken"),
            value: "Vind iets",
            version: 1,
            updated_at: "",
          },
        ]}
      >
        <CopyScope>
          <label>
            Taken
            <input defaultValue="Taken" placeholder="Zoeken" />
          </label>
          <select defaultValue="Afgerond">
            <option>Afgerond</option>
          </select>
        </CopyScope>
      </ContentProvider>,
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('value="Taken"');
    expect(html).toContain('placeholder="Vind iets"');
    expect(html).toMatch(/value="Afgerond"[^>]*>Klaar/);
  });
  it("does not translate text twice across nested component scopes", () => {
    function Nested({ children }: { children: React.ReactNode }) {
      return (
        <CopyScope>
          <button>{children}</button>
        </CopyScope>
      );
    }
    const html = renderToStaticMarkup(
      <ContentProvider
        canEdit
        ready
        records={[
          { key: key("Taken"), value: "Kamers", version: 1, updated_at: "" },
          {
            key: key("Kamers"),
            value: "Niet nog eens",
            version: 1,
            updated_at: "",
          },
        ]}
      >
        <CopyScope>
          <Nested>Taken</Nested>
        </CopyScope>
      </ContentProvider>,
    );
    expect(html).toContain(">Kamers</button>");
    expect(html).not.toContain("Niet nog eens");
  });
});
