import { describe, expect, it } from "vitest";
import { publicToken } from "@/lib/ids";
import { BUCKETS, objectPath, parseViewPath, uploadSide } from "./rules";

const parcelId = "cmwtd9fby0000yssdc9uk42ao";

describe("photo buckets", () => {
  it("one private bucket per kind of photo", () => {
    expect(new Set(Object.values(BUCKETS)).size).toBe(4);
  });

  it("drop-off photos belong to the origin park, the rest to the arrival park", () => {
    expect(uploadSide("dropoff")).toBe("origin");
    expect(uploadSide("arrival_damage")).toBe("destination");
    expect(uploadSide("release")).toBe("destination");
    expect(uploadSide("collector")).toBe("destination");
  });
});

describe("view paths", () => {
  const file = `${publicToken()}.jpg`;

  it("accepts our own paths", () => {
    expect(
      parseViewPath([
        BUCKETS.dropoff,
        ...objectPath(parcelId, file.replace(".jpg", "")).split("/"),
      ]),
    ).toEqual({
      bucket: "parcel-dropoff",
      parcelId,
      object: `${parcelId}/${file}`,
    });
  });

  it("refuses anything else", () => {
    for (const bad of [
      ["other-bucket", parcelId, file],
      [BUCKETS.dropoff, parcelId],
      [BUCKETS.dropoff, parcelId, file, "extra"],
      [BUCKETS.dropoff, "..", file],
      [BUCKETS.dropoff, parcelId, "../../secret.jpg"],
      [BUCKETS.dropoff, parcelId, "photo.png"],
      [BUCKETS.dropoff, "PARCEL WITH SPACES", file],
    ]) {
      expect(parseViewPath(bad), bad.join("/")).toBeNull();
    }
  });

  it("object names can't be guessed", () => {
    expect(objectPath(parcelId, publicToken())).not.toBe(
      objectPath(parcelId, publicToken()),
    );
  });
});
