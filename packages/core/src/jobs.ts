import { z } from "zod";

export const maxUploadBytes = 5 * 1024 * 1024;
export const acceptedMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export const jobStatuses = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FLAGGED",
  "FAILED"
] as const;

export const stepStatuses = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED"
] as const;

export const stepNames = [
  "IMAGE_CAPTIONING",
  "LABEL_DETECTION",
  "CONTENT_SAFETY"
] as const;

export const jobEventTypes = [
  "JOB_CREATED",
  "JOB_QUEUED",
  "JOB_STARTED",
  "STEP_STARTED",
  "STEP_COMPLETED",
  "STEP_FAILED",
  "STEP_REUSED",
  "JOB_COMPLETED",
  "JOB_FLAGGED",
  "JOB_FAILED",
  "JOB_RETRIED"
] as const;

export type JobStatus = (typeof jobStatuses)[number];
export type StepStatus = (typeof stepStatuses)[number];
export type StepName = (typeof stepNames)[number];
export type JobEventType = (typeof jobEventTypes)[number];

export const labelConfidenceSchema = z.enum(["low", "medium", "high"]);
export const safeSearchLikelihoodSchema = z.enum([
  "UNKNOWN",
  "VERY_UNLIKELY",
  "UNLIKELY",
  "POSSIBLE",
  "LIKELY",
  "VERY_LIKELY"
]);

export const captionResultSchema = z.object({
  caption: z.string().min(1)
});

export const labelResultSchema = z.object({
  labels: z.array(
    z.object({
      name: z.string().min(1),
      confidence: labelConfidenceSchema
    })
  ).min(1)
});

export const safeSearchCategoryNames = [
  "adult",
  "spoof",
  "medical",
  "violence",
  "racy"
] as const;

export type SafeSearchCategoryName = (typeof safeSearchCategoryNames)[number];
export type SafeSearchLikelihood = z.infer<typeof safeSearchLikelihoodSchema>;

const safeSearchRatingsSchema = z.object({
  adult: safeSearchLikelihoodSchema,
  spoof: safeSearchLikelihoodSchema,
  medical: safeSearchLikelihoodSchema,
  violence: safeSearchLikelihoodSchema,
  racy: safeSearchLikelihoodSchema
});

const likelihoodSeverity: Record<SafeSearchLikelihood, number> = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  VERY_LIKELY: 5
};

export function isFlaggedLikelihood(value: SafeSearchLikelihood) {
  return likelihoodSeverity[value] >= likelihoodSeverity.LIKELY;
}

export function getFlaggedSafetyCategories(
  ratings: Record<SafeSearchCategoryName, SafeSearchLikelihood>
) {
  return safeSearchCategoryNames.filter((name) => isFlaggedLikelihood(ratings[name]));
}

export const safetyResultSchema = z.object({
  safe: z.boolean(),
  flagged: z.boolean(),
  categories: z.array(z.string()),
  primaryCategory: z.string(),
  reason: z.string(),
  ratings: safeSearchRatingsSchema
}).superRefine((value, context) => {
  const trimmedReason = value.reason.trim();
  const trimmedPrimaryCategory = value.primaryCategory.trim();
  const normalizedCategories = value.categories.map((category) => category.trim()).filter(Boolean);
  const flaggedCategories = getFlaggedSafetyCategories(value.ratings);
  const expectedSafe = flaggedCategories.length === 0;
  const expectedFlagged = flaggedCategories.length > 0;

  if (!trimmedReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Safety reason must not be empty"
    });
  }

  if (value.safe !== expectedSafe) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Safety safe flag must match the SafeSearch-style ratings"
    });
  }

  if (value.flagged !== expectedFlagged) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Safety flagged flag must match the SafeSearch-style ratings"
    });
  }

  if (value.flagged || !value.safe) {
    if (!trimmedPrimaryCategory) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Flagged safety results must include a primary category"
      });
    }

    if (normalizedCategories.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Flagged safety results must include at least one category"
      });
    }

    if (!normalizedCategories.includes(trimmedPrimaryCategory)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Primary category must appear in categories"
      });
    }
  }

  for (const flaggedCategory of flaggedCategories) {
    if (!normalizedCategories.includes(flaggedCategory)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Flagged category ${flaggedCategory} must appear in categories`
      });
    }
  }
});

export type CaptionResult = z.infer<typeof captionResultSchema>;
export type LabelResult = z.infer<typeof labelResultSchema>;
export type SafetyResult = z.infer<typeof safetyResultSchema>;

export const orderedSteps: Array<{ name: StepName; position: number }> = [
  { name: "IMAGE_CAPTIONING", position: 1 },
  { name: "LABEL_DETECTION", position: 2 },
  { name: "CONTENT_SAFETY", position: 3 }
];

export const mediaQueueName = "media-jobs";

export type MediaJobRecord = {
  id: string;
  userId: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  caption: string | null;
  labels: unknown;
  safetyResult: unknown;
  flagged: boolean;
  flaggedCategory: string | null;
  lastError: unknown;
};

export type JobStepRecord = {
  id: string;
  jobId: string;
  name: StepName;
  position: number;
  status: StepStatus;
  attempt: number;
  outputJson: unknown;
  errorJson: unknown;
};
