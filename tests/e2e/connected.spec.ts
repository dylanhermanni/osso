import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
test.skip(
  process.env.E2E_SUPABASE !== "1",
  "Requires the disposable local Supabase backend and a build using its public settings.",
);
async function signup(page: Page, email: string) {
  if (new URL(page.url()).searchParams.has("invite"))
    await expect(page.getByRole("dialog")).toBeVisible();
  else
    await page
      .getByRole("button", { name: "Inloggen", exact: true })
      .first()
      .click();
  await page
    .getByRole("button", { name: "Account maken", exact: true })
    .first()
    .click();
  await page.getByLabel("E-mailadres", { exact: true }).fill(email);
  await page
    .getByLabel("Wachtwoord", { exact: true })
    .fill("Local-e2e-House-2026!");
  await page
    .getByRole("button", { name: "Account maken", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function household(page: Page, name: string) {
  await page.getByRole("button", { name: "Huishouden instellen" }).click();
  await page.getByLabel("Jouw naam").fill(name);
  await page
    .getByRole("button", {
      name: /Ons huishouden maken|Uitnodiging accepteren/,
    })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".setup-notice")).toHaveCount(0);
}
async function add(page: Page, view: string, label: string, title: string) {
  await page.goto("/?view=" + view);
  await page
    .getByRole("button", { name: label + " toevoegen", exact: true })
    .first()
    .click();
  await page
    .getByLabel(view === "expenses" ? "Waarvoor?" : "Naam", { exact: true })
    .fill(title);
}
async function save(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Opslaan", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
test("twee echte accounts delen kamers, taken, geld en privébestanden", async ({
  page,
  browser,
  isMobile,
}) => {
  test.setTimeout(150000);
  const run = crypto.randomUUID().slice(0, 8);
  const dylan = `dylan-${run}@example.com`,
    floor = `floor-${run}@example.com`;
  await page.goto("/");
  await signup(page, dylan);
  await household(page, "Dylan");
  await add(page, "rooms", "Kamer", "Woonkamer");
  await page.getByLabel("Breedte (cm)").fill("500");
  await page.getByLabel("Lengte (cm)").fill("400");
  await save(page);
  await expect(
    page.getByRole("heading", { name: "Woonkamer", exact: true }),
  ).toBeVisible();
  if (isMobile) await page.getByRole("button", { name: "Menu openen" }).click();
  await page.locator(".profile").click();
  await page.getByLabel("E-mailadres partner").fill(floor);
  await page.getByRole("button", { name: "Uitnodigingslink maken" }).click();
  const invite = await page
    .getByLabel("Deel deze link zelf met je partner")
    .inputValue();
  await page.getByRole("button", { name: "Sluiten", exact: true }).click();
  const partnerContext = await browser.newContext({
    viewport: page.viewportSize()!,
  });
  const partner = await partnerContext.newPage();
  await partner.goto(invite);
  await signup(partner, floor);
  await household(partner, "Floor");
  await partner.goto("/?view=rooms");
  await expect(
    partner.getByRole("heading", { name: "Woonkamer", exact: true }),
  ).toBeVisible();
  await expect(partner.getByLabel("Live verbonden")).toBeVisible();
  await add(page, "rooms", "Kamer", "Keuken");
  await save(page);
  await expect(
    partner.getByRole("heading", { name: "Keuken", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await add(page, "ideas", "Idee", "Een groene muur");
  await page
    .getByRole("combobox", { name: "Kamer", exact: true })
    .selectOption({ label: "Woonkamer" });
  await save(page);
  await page
    .getByRole("heading", { name: "Een groene muur", exact: true })
    .click();
  await page.getByPlaceholder("Wat vind jij?").fill("Mooi met warm hout.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Toevoegen", exact: true })
    .click();
  await expect(
    page.getByText("Mooi met warm hout.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start een project" }).click();
  await expect(page.getByRole("dialog")).toContainText("Uitgevoerd");
  await page.getByRole("button", { name: "Sluiten", exact: true }).click();
  await add(page, "tasks", "Taak", "Vloer kiezen");
  await page
    .getByRole("combobox", { name: "Kamer", exact: true })
    .selectOption({ label: "Woonkamer" });
  await save(page);
  await page.getByRole("button", { name: "Vloer kiezen afronden" }).click();
  await expect(
    page.getByRole("button", { name: "Vloer kiezen heropenen" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Vloer kiezen heropenen" }),
  ).toBeVisible();
  await add(page, "expenses", "Uitgave", "Verf en kwasten");
  await page.getByLabel("Totaalbedrag (€)").fill("10,01");
  await page
    .getByLabel("Wie heeft betaald?", { exact: true })
    .selectOption({ label: "Dylan" });
  await save(page);
  await expect(
    page.getByText("€ 10,01", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("€ 5,00 te betalen", { exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Betaald", exact: true }).click();
  await expect(page.getByText("Alles in balans", { exact: true })).toHaveCount(
    2,
  );

  await add(page, "documents", "Document", "Handboek");
  await page.getByLabel("Bestand", { exact: true }).setInputFiles({
    name: "handboek.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
    ),
  });
  await save(page);
  await expect(page.getByText("Handboek", { exact: true })).toBeVisible();
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  const first = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  const { error: loginError } = await first.auth.signInWithPassword({
    email: dylan,
    password: "Local-e2e-House-2026!",
  });
  expect(loginError).toBeNull();
  const { data: docs, error: docsError } = await first
    .from("documents")
    .select("storage_path");
  expect(docsError).toBeNull();
  expect(docs?.length).toBeGreaterThan(0);
  const path = docs![0].storage_path;
  const { data: signed, error: signError } = await first.storage
    .from("home-files")
    .createSignedUrl(path, 60);
  expect(signError).toBeNull();
  expect((await page.request.get(signed!.signedUrl)).status()).toBe(200);
  const outsider = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  const { error: signupError } = await outsider.auth.signUp({
    email: `outsider-${run}@example.com`,
    password: "Local-e2e-House-2026!",
  });
  expect(signupError).toBeNull();
  const { error: createError } = await outsider.rpc("create_household", {
    house_name: "Apart testhuis",
    person_name: "Ander",
  });
  expect(createError).toBeNull();
  expect((await outsider.from("rooms").select("*")).data).toEqual([]);
  expect((await outsider.from("expenses").select("*")).data).toEqual([]);
  expect(
    (await outsider.storage.from("home-files").createSignedUrl(path, 60)).error,
  ).not.toBeNull();
  await partnerContext.close();
  if (isMobile) await page.getByRole("button", { name: "Menu openen" }).click();
  await page.locator(".profile").click();
  await page.getByRole("button", { name: "Uitloggen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Inloggen", exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inloggen", exact: true })
    .first()
    .click();
  await page.getByLabel("E-mailadres", { exact: true }).fill(dylan);
  await page
    .getByLabel("Wachtwoord", { exact: true })
    .fill("Local-e2e-House-2026!");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Inloggen", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/?view=rooms");
  await expect(
    page.getByRole("heading", { name: "Woonkamer", exact: true }),
  ).toBeVisible();
});

test("aankopen, projectfases, onderhoud, agenda en galerij zijn verbonden", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await signup(page, `modules-${crypto.randomUUID().slice(0, 8)}@example.com`);
  await household(page, "Floor");
  await add(page, "rooms", "Kamer", "Tuin");
  await save(page);
  await page.getByRole("heading", { name: "Tuin", exact: true }).click();
  await page
    .getByLabel("Foto toevoegen", { exact: true })
    .setInputFiles("public/icon-192.png");
  await page.getByRole("button", { name: "Foto bewaren", exact: true }).click();
  await expect(page.locator(".private-photo")).toBeVisible();
  await page.getByRole("button", { name: "Sluiten", exact: true }).click();
  await add(page, "projects", "Project", "Tuin aanleggen");
  await page.getByLabel("Budget (€)").fill("500");
  await save(page);
  await page
    .getByRole("heading", { name: "Tuin aanleggen", exact: true })
    .click();
  await page.getByPlaceholder("Voeg een stap toe…").fill("Voorbereiden");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Toevoegen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Voorbereiden afronden", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("100%", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Foto’s", exact: true }).click();
  await page
    .getByLabel("Foto toevoegen", { exact: true })
    .setInputFiles("public/icon-192.png");
  await page.getByRole("button", { name: "Foto bewaren", exact: true }).click();
  await expect(page.locator(".private-photo")).toBeVisible();
  await page.getByRole("button", { name: "Sluiten", exact: true }).click();
  await add(page, "wishlist_items", "Product", "Linnen gordijnen");
  await page.getByLabel("Geschatte prijs per stuk (€)").fill("35");
  await page.getByLabel("Aantal", { exact: true }).fill("2");
  await save(page);
  await expect(page.locator(".wishlist-subtotal")).toContainText(/70,00/);
  await page
    .getByRole("heading", { name: "Linnen gordijnen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Aankoop registreren", exact: true })
    .click();
  await page
    .getByLabel("Wie heeft betaald?", { exact: true })
    .selectOption({ label: "Floor" });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Aankoop opslaan/ })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator(".card-meta").getByText("Gekocht", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "Linnen gordijnen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Aankoop registreren", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sluiten", exact: true }).click();
  await add(
    page,
    "maintenance_items",
    "Onderhoud",
    "Ventilatiefilter vervangen",
  );
  await page.getByLabel("Herhalen iedere … maanden").fill("1");
  await save(page);
  await page.getByText("Ventilatiefilter vervangen", { exact: true }).click();
  await page.getByLabel("Uitgevoerd op").fill("2026-01-31");
  await page.getByLabel("Werkelijke kosten (€)").fill("20");
  await page
    .getByRole("button", { name: "Uitvoering opslaan", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("28 feb", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sluiten", exact: true }).click();
  await add(page, "calendar_events", "Afspraak", "Klusdag samen");
  await page.getByLabel("Begint (Amsterdam)").fill("2026-11-02T10:00");
  await page.getByLabel("Eindigt (Amsterdam)").fill("2026-11-02T12:00");
  await save(page);
  await expect(
    page.locator(".fc").getByText("Klusdag samen", { exact: true }),
  ).toBeVisible();
  await page.goto("/?view=expenses");
  await expect(
    page.getByText("€ 70,00", { exact: true }).first(),
  ).toBeVisible();
});
