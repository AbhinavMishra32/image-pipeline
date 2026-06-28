import { describe, expect, it } from "vitest";
import { z } from "zod";
import { labelResultSchema, safetyResultSchema } from "../src/jobs.js";
import { StructuredOutputError, parseStructuredJson } from "../src/openrouter.js";

describe("parseStructuredJson", () => {
  it("parses fenced JSON payloads", () => {
    const result = parseStructuredJson(
      '```json\n{"caption":"A calm beach at sunrise."}\n```',
      z.object({ caption: z.string() }),
      "Caption"
    );

    expect(result).toEqual({ caption: "A calm beach at sunrise." });
  });

  it("throws a structured error for invalid JSON", () => {
    expect(() =>
      parseStructuredJson(
        "safety=unsafe",
        z.object({ safe: z.boolean() }),
        "Safety"
      )
    ).toThrowError(StructuredOutputError);
  });

  it("rejects degenerate safe responses with empty reasoning", () => {
    expect(() =>
      parseStructuredJson(
        "{\"safe\":true,\"flagged\":false,\"categories\":[],\"primaryCategory\":\"\",\"reason\":\"\",\"ratings\":{\"adult\":\"VERY_UNLIKELY\",\"spoof\":\"VERY_UNLIKELY\",\"medical\":\"VERY_UNLIKELY\",\"violence\":\"VERY_UNLIKELY\",\"racy\":\"VERY_UNLIKELY\"}}",
        safetyResultSchema,
        "Safety"
      )
    ).toThrowError(StructuredOutputError);
  });

  it("rejects empty label arrays", () => {
    expect(() =>
      parseStructuredJson(
        "{\"labels\":[]}",
        labelResultSchema,
        "Label"
      )
    ).toThrowError("Label response did not match the required schema");
  });
});
