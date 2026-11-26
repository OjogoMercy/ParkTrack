import { describe, expect, it } from "vitest";
import {
  hostnameOf,
  parkAddressLabel,
  parkPath,
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

describe("routeRequest (one domain, Q45)", () => {
  const go = (pathname: string, toRoot = true) => ({
    action: "redirect",
    pathname,
    toRoot,
  });

  it("serves the main domain directly", () => {
    for (const path of [
      "/",
      "/t/abc",
      "/collect/xyz",
      "/console/counter",
      "/parks/ogbomoso",
      "/signin",
    ])
      expect(routeRequest("parktrack.ng", path, PROD), path).toEqual({
        action: "next",
      });
    expect(routeRequest("localhost:3000", "/send", DEV)).toEqual({
      action: "next",
    });
  });

  it("sends old park addresses to the park's page on the main domain", () => {
    expect(routeRequest("ogbomoso.parktrack.ng", "/", PROD)).toEqual(
      go("/parks/ogbomoso"),
    );
    expect(routeRequest("ogbomoso.parktrack.ng", "/send/review", PROD)).toEqual(
      go("/send/review"),
    );
    expect(routeRequest("ibadan.localhost:3000", "/", DEV)).toEqual(
      go("/parks/ibadan"),
    );
  });

  it("sends old console addresses to /console on the main domain", () => {
    expect(routeRequest("app.parktrack.ng", "/", PROD)).toEqual(go("/console"));
    expect(routeRequest("app.parktrack.ng", "/counter/scan", PROD)).toEqual(
      go("/console/counter/scan"),
    );
    expect(routeRequest("app.parktrack.ng", "/console/driver", PROD)).toEqual(
      go("/console/driver"),
    );
    expect(routeRequest("app.parktrack.ng", "/signin", PROD)).toEqual(
      go("/signin"),
    );
  });

  it("sends unknown subdomains home, and the old staff sign-in to /signin", () => {
    expect(routeRequest("admin.parktrack.ng", "/anything", PROD)).toEqual(
      go("/"),
    );
    expect(routeRequest("parktrack.ng", "/console/signin", PROD)).toEqual(
      go("/signin", false),
    );
  });
});

describe("helpers", () => {
  it("normalises hostnames", () => {
    expect(hostnameOf(" Ogbomoso.ParkTrack.NG:8080 ")).toBe(
      "ogbomoso.parktrack.ng",
    );
  });

  it("builds park page paths and labels", () => {
    expect(parkPath("ibadan")).toBe("/parks/ibadan");
    expect(parkAddressLabel("ibadan", PROD)).toBe("parktrack.ng/parks/ibadan");
    expect(parkAddressLabel("ibadan", DEV)).toBe("localhost/parks/ibadan");
  });
});
