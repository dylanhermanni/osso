import { test, expect } from "@playwright/test";
test.skip(
  Boolean(process.env.E2E_SUPABASE),
  "Configuration-mode tests run without a backend.",
);
test("dashboard is transparant over configuratie en werkt zonder fouten", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hé, wat pakken we aan?" }),
  ).toBeVisible();
  await expect(
    page.getByText("Koppel Supabase", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Waar begint jullie verhaal?")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("€ 12.");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `test-results/dashboard-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("alle modules openen via deep links", async ({ page }) => {
  for (const [view, title] of [
    ["rooms", "Jullie kamers"],
    ["ideas", "Inspiratie"],
    ["tasks", "Jullie taken"],
    ["projects", "Projecten"],
    ["expenses", "Financiën"],
    ["wishlist_items", "Verlanglijst"],
    ["calendar_events", "Planning"],
    ["maintenance_items", "Onderhoud"],
    ["documents", "Woningdossier"],
  ]) {
    await page.goto("/?view=" + view);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("toevoegen vereist een gekoppeld account; modal bedienbaar met toetsenbord", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("main")
    .getByRole("button", { name: "Nieuw toevoegen", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Idee Bewaar een mooie gedachte" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welkom thuis", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Inloggen", exact: true }).last(),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("kalender heeft maand-, week-, dag- en lijstweergave", async ({
  page,
}) => {
  await page.goto("/?view=calendar_events");
  await expect(page.locator(".fc-toolbar-title")).toBeVisible();
  for (const name of ["Week", "Dag", "Lijst", "Maand"]) {
    await page
      .locator(".fc")
      .getByRole("button", { name, exact: true })
      .click();
    await expect(page.locator(".fc-view")).toBeVisible();
  }
});
test("PWA-assets bestaan en bevatten geen private cache", async ({
  request,
}) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  expect((await manifest.json()).display).toBe("standalone");
  for (const path of [
    "/icon-192.png",
    "/icon-512.png",
    "/icon-maskable.png",
    "/apple-icon.png",
    "/offline.html",
  ])
    expect((await request.get(path)).status()).toBe(200);
  const sw = await request.get("/sw.js");
  expect(await sw.text()).toContain("cache.add('/offline.html')");
});
