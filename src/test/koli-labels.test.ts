import { describe, expect, it } from "vitest";
import { labelCount, labelRange } from "@/lib/packing-pdf";
describe("labelCount", () => {
  it("prints one label per koli", () => expect(labelCount(70)).toBe(70));
  it("prints at least one label", () => expect(labelCount(0)).toBe(1));
});
describe("labelRange", () => {
  it("prints only the chosen koli numbers", () => expect(labelRange(70, 10, 20)).toEqual([10, 20]));
  it("keeps the range inside the total koli", () => expect(labelRange(70, 60, 99)).toEqual([60, 70]));
});
