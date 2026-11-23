import { describe, expect, it } from "vitest";
import {
  hostnameOf,
  parkHostLabel,
  parkUrl,
  resolveHost,
  routeRequest,
} from "./host";

const PROD = "parktrack.ng";
const DEV = "localhost:3000";

describe("resolveHost", () => {
  it("maps park subdomains in production and on *.localhost", () => {
    expect(resolveHost("ogbomoso.parktrack.ng", PROD)).toEqual({
      kind: "park",
      slug: "ogbomoso",
    });
    expect(resolveHost("Ibadan.ParkTrack.ng:443", PROD)).toEqual({
      kind: "park",
      slug: "ibadan",
    });
    expect(resolveHost("ogbomoso.localhost:3000", DEV)).toEqual({
      kind: "park",
      slug: "ogbomoso",
    });
  });

  it("sends app. to the console and the apex/www to the public root", () => {
    expect(resolveHost("app.parktrack.ng", PROD)).toEqual({ kind: "console" });
    expect(resolveHost("app.localhost:3000", DEV)).toEqual({ kind: "console" });
    expect(resolveHost("parktrack.ng", PROD)).toEqual({ kind: "root" });
    expect(resolveHost("www.parktrack.ng", PROD)).toEqual({ kind: "root" });
    expect(resolveHost("localhost:3000", DEV)).toEqual({ kind: "root" });
  });

  it("treats foreign hosts (previews, IPs) as the public root", () => {
    expect(resolveHost("parktrack-git-x.vercel.app", PROD)).toEqual({
      kind: "root",
    });
    expect(resolveHost("127.0.0.1:3000", DEV)).toEqual({ kind: "root" });
    expect(resolveHost("evil-parktrack.ng", PROD)).toEqual({ kind: "root" });
  });

  it("never treats reserved or malformed labels as parks (PARK-3)", () => {
    for (const host of [
      "admin.parktrack.ng",
      "api.parktrack.ng",
      "a.b.parktrack.ng",
      "-bad.parktrack.ng",
      "x.parktrack.ng",
    ])
      expect(resolveHost(host, PROD).kind, host).toBe("unknown");
  });
});

describe("routeRequest", () => {
  it("rewrites park hosts into /sites/{slug}", () => {
    expect(routeRequest("ogbomoso.parktrack.ng", "/", PROD)).toEqual({
      action: "rewrite",
      pathname: "/sites/ogbomoso",
    });
    expect(routeRequest("ogbomoso.parktrack.ng", "/send/review", PROD)).toEqual(
      { action: "rewrite", pathname: "/sites/ogbomoso/send/review" },
    );
  });

  it("rewrites app. into /console without doubling the prefix", () => {
    expect(routeRequest("app.parktrack.ng", "/", PROD)).toEqual({
      action: "rewrite",
      pathname: "/console",
    });
    expect(routeRequest("app.parktrack.ng", "/counter/scan", PROD)).toEqual({
      action: "rewrite",
      pathname: "/console/counter/scan",
    });
    expect(routeRequest("app.parktrack.ng", "/console/driver", PROD)).toEqual({
      action: "rewrite",
      pathname: "/console/driver",
    });
  });

  it("leaves the public root alone and hides internal trees there", () => {
    expect(routeRequest("parktrack.ng", "/t/abc", PROD)).toEqual({
      action: "next",
    });
    expect(routeRequest("parktrack.ng", "/collect/xyz", PROD)).toEqual({
      action: "next",
    });
    expect(routeRequest("parktrack.ng", "/sites/ogbomoso", PROD)).toEqual({
      action: "not_found",
    });
    expect(routeRequest("parktrack.ng", "/console", PROD)).toEqual({
      action: "not_found",
    });
    expect(routeRequest("parktrack.ng", "/sitesmap", PROD)).toEqual({
      action: "next",
    });
  });

  it("blocks cross-tree paths on park hosts", () => {
    expect(
      routeRequest("ogbomoso.parktrack.ng", "/sites/ibadan", PROD),
    ).toEqual({ action: "not_found" });
    expect(routeRequest("ogbomoso.parktrack.ng", "/console", PROD)).toEqual({
      action: "not_found",
    });
  });

  it("sends unknown subdomains to the park-not-found page (S13)", () => {
    expect(routeRequest("admin.parktrack.ng", "/anything", PROD)).toEqual({
      action: "rewrite",
      pathname: "/not-found-park",
    });
  });
});

describe("helpers", () => {
  it("normalises hostnames", () => {
    expect(hostnameOf(" Ogbomoso.ParkTrack.NG:8080 ")).toBe(
      "ogbomoso.parktrack.ng",
    );
  });

  it("builds park URLs and labels", () => {
    expect(parkUrl("ibadan", PROD)).toBe("https://ibadan.parktrack.ng");
    expect(parkUrl("ibadan", DEV)).toBe("http://ibadan.localhost:3000");
    expect(parkHostLabel("ibadan", DEV)).toBe("ibadan.localhost");
  });
});
