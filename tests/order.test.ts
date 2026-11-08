import { describe, it, expect } from "vitest";
import { orderedRecords, mergeVisibleOrder } from "../src/lib/domain/order";
import type { RecordData } from "../src/lib/types";
const records = ["a", "b", "c", "d"].map(
  (id, sort_order) =>
    ({
      id,
      sort_order,
      household_id: "home",
      title: id,
      version: 1,
    }) satisfies RecordData,
);
describe("gedeelde tegelvolgorde", () => {
  it("houdt verborgen tegels op hun plek bij gefilterd slepen", () => {
    expect(mergeVisibleOrder(["a", "b", "c", "d"], ["d", "b"])).toEqual([
      "a",
      "d",
      "c",
      "b",
    ]);
  });
  it("bewaart bestaande kamervolgorde en voegt nieuwe kamers achteraan toe", () => {
    expect(
      orderedRecords(
        records,
        { entity: "rooms", record_ids: ["c", "a"], version: 1 },
        "rooms",
      ).map((r) => r.id),
    ).toEqual(["c", "a", "b", "d"]);
    expect(
      orderedRecords(records, undefined, "rooms").map((r) => r.id),
    ).toEqual(["a", "b", "c", "d"]);
  });
  it("houdt projecten in uitvoering bovenaan met de gekozen volgorde binnen iedere groep", () => {
    const projects = records.map((r) => ({
      ...r,
      status: ["a", "c"].includes(r.id) ? "In uitvoering" : "Gepland",
    }));
    expect(
      orderedRecords(
        projects,
        { entity: "projects", record_ids: ["d", "c", "b", "a"], version: 1 },
        "projects",
      ).map((r) => r.id),
    ).toEqual(["c", "a", "d", "b"]);
  });
  it("negeert verwijderde tegels in een opgeslagen volgorde", () => {
    expect(
      orderedRecords(records, {
        entity: "ideas",
        record_ids: ["removed", "b", "a"],
        version: 1,
      }).map((r) => r.id),
    ).toEqual(["b", "a", "c", "d"]);
  });
});
