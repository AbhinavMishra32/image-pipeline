import { z } from "zod";
import {
  captionResultSchema,
  labelResultSchema,
  safetyResultSchema,
  type CaptionResult,
  type LabelResult,
  type SafetyResult
} from "./jobs.js";

export class StructuredOutputError extends Error {
  constructor(
    message: string,
    public readonly rawText: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "StructuredOutputError";
  }
}

export class ProviderRequestError extends Error {
  constructor(
    message: string,
    public readonly details: {
      label: string;
      model: string;
      status: number;
      requestId?: string | null;
      responseBody?: unknown;
    }
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}

function extractJsonCandidate(rawText: string) {
  const fenced = rawText.match(/```json\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return rawText.slice(firstBrace, lastBrace + 1);
  }

  return rawText.trim();
}

export function parseStructuredJson<T>(
  rawText: string,
  schema: z.ZodSchema<T>,
  label: string
) {
  try {
    const parsed = JSON.parse(extractJsonCandidate(rawText));

    try {
      return schema.parse(parsed);
    } catch (error) {
      throw new StructuredOutputError(
        `${label} response did not match the required schema`,
        rawText,
        error instanceof z.ZodError ? error.flatten() : error
      );
    }
  } catch (error) {
    if (error instanceof StructuredOutputError) {
      throw error;
    }

    throw new StructuredOutputError(
      `${label} response was not valid JSON`,
      rawText,
      error instanceof Error ? error.message : error
    );
  }
}

export type VisionProvider = {
  captionImage(imageDataUrl: string): Promise<{ parsed: CaptionResult; rawText: string }>;
  detectLabels(imageDataUrl: string): Promise<{ parsed: LabelResult; rawText: string }>;
  checkContentSafety(imageDataUrl: string): Promise<{ parsed: SafetyResult; rawText: string }>;
};

export class OpenRouterVisionProvider implements VisionProvider {
  constructor(
    private readonly options: {
      apiKey: string;
      captionModel: string;
      labelModel: string;
      safetyModel: string;
      baseUrl?: string;
      appName?: string;
    }
  ) {}

  async captionImage(imageDataUrl: string) {
    return this.callModel(
      this.options.captionModel,
      "Return strict JSON only with the shape {\"caption\":\"A natural-language description of the image.\"}.",
      imageDataUrl,
      captionResultSchema,
      "Caption"
    );
  }

  async detectLabels(imageDataUrl: string) {
    return this.callModel(
      this.options.labelModel,
      "Return strict JSON only with the shape {\"labels\":[{\"name\":\"dog\",\"confidence\":\"high\"}]}. Confidence must be one of low, medium, high. Always return 3 to 8 useful labels. For screenshots, interfaces, and documents, include concept labels such as dashboard, software, analytics, text, chart, sidebar, workflow, form, table, or presentation when relevant. Do not return an empty labels array.",
      imageDataUrl,
      labelResultSchema,
      "Label"
    );
  }

  async checkContentSafety(imageDataUrl: string) {
    return this.callModel(
      this.options.safetyModel,
      "Return strict JSON only. Use SafeSearch-style likelihood enums with exactly these values: UNKNOWN, VERY_UNLIKELY, UNLIKELY, POSSIBLE, LIKELY, VERY_LIKELY. Respond with the shape {\"safe\":true,\"flagged\":false,\"categories\":[],\"primaryCategory\":\"\",\"reason\":\"A brief explanation of why the image is safe.\",\"ratings\":{\"adult\":\"VERY_UNLIKELY\",\"spoof\":\"VERY_UNLIKELY\",\"medical\":\"VERY_UNLIKELY\",\"violence\":\"VERY_UNLIKELY\",\"racy\":\"VERY_UNLIKELY\"}}. Mark flagged=true when any rating is LIKELY or VERY_LIKELY. Include every flagged category name in categories and set primaryCategory to the strongest flagged category. Never leave reason empty.",
      imageDataUrl,
      safetyResultSchema,
      "Safety"
    );
  }

  private async callModel<T>(
    model: string,
    instruction: string,
    imageDataUrl: string,
    schema: z.ZodSchema<T>,
    label: string
  ) {
    const response = await fetch(
      `${this.options.baseUrl ?? "https://openrouter.ai"}/api/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
          ...(this.options.appName ? { "HTTP-Referer": this.options.appName } : {})
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: instruction
            },
            {
              role: "user",
              content: [
                { type: "text", text: instruction },
                {
                  type: "image_url",
                  image_url: {
                    url: imageDataUrl
                  }
                }
              ]
            }
          ]
        })
      }
    );

    const rawResponseText = await response.text();
    let json:
      | {
          error?: { message?: string };
          choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
        }
      | undefined;

    try {
      json = rawResponseText ? JSON.parse(rawResponseText) as {
        error?: { message?: string };
        choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
      } : undefined;
    } catch {
      json = undefined;
    }

    if (!response.ok) {
      throw new ProviderRequestError(
        json?.error?.message ?? `${label} request failed`,
        {
          label,
          model,
          status: response.status,
          requestId: response.headers.get("x-request-id"),
          responseBody: json ?? rawResponseText
        }
      );
    }

    const content = json?.choices?.[0]?.message?.content;
    const rawText = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((entry) => entry.text ?? "").join("\n")
        : "";

    return {
      parsed: parseStructuredJson(rawText, schema, label),
      rawText
    };
  }
}
