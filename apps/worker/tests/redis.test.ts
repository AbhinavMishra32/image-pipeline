import { describe, expect, it } from "vitest";
import { createBullmqConnection } from "../src/lib/redis-options.js";

describe("createBullmqConnection", () => {
  it("parses host, port, db, and credentials from a redis url", () => {
    expect(
      createBullmqConnection("redis://user:secret@redis.internal:6380/4")
    ).toEqual({
      host: "redis.internal",
      port: 6380,
      username: "user",
      password: "secret",
      db: 4,
      maxRetriesPerRequest: null
    });
  });
});
