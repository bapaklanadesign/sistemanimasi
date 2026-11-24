import { describe, expect, it } from "vitest";
import { labelCount } from "@/lib/packing-pdf";
describe("labelCount", () => {
  it("prints one label per koli", () => expect(labelCount(70)).toBe(70));
  it("prints at least one label", () => expect(labelCount(0)).toBe(1));
});
