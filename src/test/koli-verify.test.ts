import { describe, expect, it } from "vitest";
import { matchScans } from "@/lib/koli-verify";
import { koliCode, labelRange } from "@/lib/packing-pdf";
describe("koli verification", () => {
  it("marks unscanned koli as unverified", () => {
    const r = matchScans("PL-1", 3, [koliCode("https://x.id", "tok", "PL-1", 1, 3), koliCode("https://x.id", "tok", "PL-1", 3, 3)]);
    expect(r.verified).toEqual([1, 3]); expect(r.unverified).toEqual([2]);
  });
  it("flags labels from another packing list", () => {
    expect(matchScans("PL-1", 2, [koliCode("https://x.id", "tok", "PL-2", 1, 2)]).problems).toHaveLength(1);
  });
});
describe("labelRange", () => {
  it("prints only the chosen koli numbers", () => expect(labelRange(70, 10, 20)).toEqual([10, 20]));
  it("keeps the range inside the total koli", () => expect(labelRange(70, 60, 99)).toEqual([60, 70]));
});
import { classifyScan } from "@/lib/koli-verify";
describe("classifyScan", () => {
  it("verifies a label of this packing list", () => expect(classifyScan("PL-1", 5, koliCode("https://x.id", "tok", "PL-1", 2, 5))).toEqual({ status: "verified", koli: 2 }));
  it("flags a label with a different koli total", () => expect(classifyScan("PL-1", 5, koliCode("https://x.id", "tok", "PL-1", 2, 6))).toMatchObject({ status: "problem", kind: "total_mismatch" }));
});
