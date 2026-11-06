import { describe, expect, it } from "vitest";
import {
  parseOperationType,
  sourcingPolicy,
  validateOperation,
} from "../src/lib/domain";
import { formatMoney, formatDate } from "../src/lib/config";
const operation = {
  name: "Retreat",
  type: "RETREAT" as const,
  startDate: new Date("2026-11-10T15:00:00Z"),
  endDate: new Date("2026-11-12T15:00:00Z"),
  expectedDiners: 32,
  billableParticipants: 26,
};
describe("operational rules", () => {
  it("keeps diners and billed participants independent", () => {
    expect(() => validateOperation(operation)).not.toThrow();
  });
  it("rejects invalid ranges, counts, names and non-retreat billing", () => {
    for (const data of [
      { ...operation, name: " " },
      { ...operation, endDate: new Date("2020-01-01") },
      { ...operation, startDate: new Date("invalid") },
      { ...operation, expectedDiners: -1 },
      { ...operation, expectedDiners: 2.5 },
      { ...operation, type: "CITY_SERVICE" as const },
    ])
      expect(() => validateOperation(data)).toThrow();
  });
  it("requires school ownership and organic sourcing only for retreats", () => {
    expect(sourcingPolicy("RETREAT")).toEqual({
      inventoryOwner: "SCHOOL",
      organicRequired: true,
    });
    for (const type of ["CITY_SERVICE", "PRIVATE_EVENT"] as const)
      expect(sourcingPolicy(type)).toEqual({
        inventoryOwner: "BUSINESS",
        organicRequired: false,
      });
  });
  it("parses only supported operation types", () => {
    for (const type of ["RETREAT", "CITY_SERVICE", "PRIVATE_EVENT"])
      expect(parseOperationType(type)).toBe(type);
    expect(parseOperationType("unknown")).toBeUndefined();
    expect(parseOperationType(["RETREAT"])).toBeUndefined();
  });
  it("formats integer BRL centavos and business-local dates", () => {
    expect(formatMoney(15000)).toBe("R$ 150.00");
    expect(() => formatMoney(1.5)).toThrow();
    expect(formatDate(new Date("2026-11-06T01:00:00Z"))).toBe("5 Nov 2026");
  });
});
