import { describe, expect, it } from "vitest";
import { formatNaira, formatNairaCompact } from "./money";

describe("formatNaira", () => {
  it("formats whole naira with thousands separators", () => {
    expect(formatNaira(265_000)).toBe("₦2,650");
    expect(formatNaira(2_500_000)).toBe("₦25,000");
    expect(formatNaira(0)).toBe("₦0");
  });

  it("shows kobo only when there are any", () => {
    expect(formatNaira(265_050)).toBe("₦2,650.50");
    expect(formatNaira(5)).toBe("₦0.05");
  });

  it("uses a real minus sign for negatives, like the ledger", () => {
    expect(formatNaira(-165_000)).toBe("−₦1,650");
  });

  it("adds + only when asked", () => {
    expect(formatNaira(3_950_000, { sign: true })).toBe("+₦39,500");
    expect(formatNaira(0, { sign: true })).toBe("₦0");
    expect(formatNaira(-50_000, { sign: true })).toBe("−₦500");
  });

  it("rejects non-integer kobo", () => {
    expect(() => formatNaira(26.5)).toThrow(TypeError);
    expect(() => formatNaira(Number.NaN)).toThrow(TypeError);
  });
});

describe("formatNairaCompact", () => {
  it("abbreviates large KPI values", () => {
    expect(formatNairaCompact(240_000_000)).toBe("₦2.4M");
    expect(formatNairaCompact(121_000_000)).toBe("₦1.21M");
    expect(formatNairaCompact(41_260_000)).toBe("₦412.6k");
    expect(formatNairaCompact(62_400)).toBe("₦624");
  });
});
