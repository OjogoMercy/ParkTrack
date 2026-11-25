import { describe, expect, it } from "vitest";
import { destinationLabel, formatJourney } from "./format";

describe("sender formatting", () => {
  it("journey times", () => {
    expect(formatJourney(90)).toBe("1h 30m");
    expect(formatJourney(270)).toBe("4h 30m");
    expect(formatJourney(540)).toBe("9h");
    expect(formatJourney(45)).toBe("45m");
  });
  it("destinations: city first unless the name already starts with it", () => {
    expect(destinationLabel({ city: "Ibadan", name: "Iwo Road Park" })).toBe(
      "Ibadan · Iwo Road Park",
    );
    expect(
      destinationLabel({ city: "Ogbomoso", name: "Ogbomoso Motor Park" }),
    ).toBe("Ogbomoso Motor Park");
  });
});
