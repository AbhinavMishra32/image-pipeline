import { describe, expect, it } from "vitest";
import { assetUrl } from "./api";

describe("assetUrl", () => {
  it("builds a usable image url for the current environment", () => {
    expect(assetUrl("/api/jobs/job_123/image")).toContain("/api/jobs/job_123/image");
  });
});
