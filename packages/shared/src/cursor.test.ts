import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./cursor";

describe("cursor encoding", () => {
  it("round-trips id and value", () => {
    const raw = encodeCursor({ id: 123, v: 45.6 });
    const decoded = decodeCursor(raw);
    expect(decoded).toEqual({ id: 123, v: 45.6 });
  });

  it("supports cursor without v", () => {
    const raw = encodeCursor({ id: 123 });
    const decoded = decodeCursor(raw);
    expect(decoded).toEqual({ id: 123 });
  });

  it("throws on invalid payloads", () => {
    expect(() => decodeCursor("not-base64")).toThrow();
    const raw = Buffer.from(JSON.stringify({ id: "nope" }), "utf8").toString("base64url");
    expect(() => decodeCursor(raw)).toThrow();
  });
});

