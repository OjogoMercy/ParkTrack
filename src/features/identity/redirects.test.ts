import { describe, expect, it } from "vitest";
import { consoleHome, safeNext } from "./redirects";

describe("consoleHome", () => {
  it("sends each staff role to its own home", () => {
    expect(consoleHome("AGENT")).toBe("/console/counter");
    expect(consoleHome("DRIVER")).toBe("/console/driver");
    expect(consoleHome("PARK_ADMIN")).toBe("/console/park");
    expect(consoleHome("PLATFORM_ADMIN")).toBe("/console/platform");
    expect(consoleHome("USER")).toBeNull();
  });

  it("links without the internal /console prefix", () => {});
});

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/send")).toBe("/send");
    expect(safeNext("/parcels/PT-7K3Q?tab=1")).toBe("/parcels/PT-7K3Q?tab=1");
    expect(safeNext(["/send", "/other"])).toBe("/send");
  });

  it("refuses anything that could leave the site", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "evil.com",
      "javascript:alert(1)",
      "/\nLocation: x",
      "",
      undefined,
      null,
    ]) {
      expect(safeNext(bad), String(bad)).toBeNull();
    }
  });
});
