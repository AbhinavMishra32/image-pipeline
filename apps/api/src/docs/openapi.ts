const errorResponse = {
  type: "object",
  properties: {
    message: { type: "string", example: "Unauthorized" },
    requestId: { type: "string", example: "8d4f2f8d-7ad5-40fc-b6a4-cce7f6e5e5db" }
  },
  required: ["message"]
} as const;

const userSchema = {
  type: "object",
  properties: {
    id: { type: "string", example: "cm123job123" },
    email: { type: "string", format: "email", example: "jane@example.com" }
  },
  required: ["id", "email"]
} as const;

const jobStepSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: {
      type: "string",
      enum: ["IMAGE_CAPTIONING", "LABEL_DETECTION", "CONTENT_SAFETY"]
    },
    status: {
      type: "string",
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"]
    },
    position: { type: "integer", example: 1 },
    attempt: { type: "integer", example: 1 },
    outputJson: { nullable: true },
    errorJson: { nullable: true },
    startedAt: { type: "string", format: "date-time", nullable: true },
    completedAt: { type: "string", format: "date-time", nullable: true }
  },
  required: ["id", "name", "status", "position", "attempt"]
} as const;

const jobEventSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    type: {
      type: "string",
      enum: [
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
      ]
    },
    payloadJson: { nullable: true },
    createdAt: { type: "string", format: "date-time" }
  },
  required: ["id", "type", "createdAt"]
} as const;

const jobSchema = {
  type: "object",
  properties: {
    id: { type: "string", example: "cm123job123" },
    status: {
      type: "string",
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FLAGGED", "FAILED"]
    },
    currentStage: {
      type: "string",
      example: "LABEL_DETECTION"
    },
    originalFilename: { type: "string", example: "invoice.png" },
    mimeType: { type: "string", example: "image/png" },
    imageUrl: { type: "string", example: "/api/jobs/cm123job123/image" },
    caption: { type: "string", nullable: true },
    labels: {
      type: "array",
      nullable: true,
      items: {
        type: "object",
        properties: {
          name: { type: "string", example: "dashboard" },
          confidence: { type: "string", enum: ["low", "medium", "high"] }
        },
        required: ["name", "confidence"]
      }
    },
    safetyResult: {
      type: "object",
      nullable: true,
      properties: {
        safe: { type: "boolean" },
        flagged: { type: "boolean" },
        categories: { type: "array", items: { type: "string" } },
        primaryCategory: { type: "string" },
        reason: { type: "string" },
        ratings: {
          type: "object",
          properties: {
            adult: { type: "string" },
            spoof: { type: "string" },
            medical: { type: "string" },
            violence: { type: "string" },
            racy: { type: "string" }
          }
        }
      }
    },
    lastError: { nullable: true },
    flagged: { type: "boolean" },
    flaggedCategory: { type: "string", nullable: true },
    attempts: { type: "integer", example: 1 },
    maxAttempts: { type: "integer", example: 3 },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    steps: {
      type: "array",
      items: jobStepSchema
    },
    events: {
      type: "array",
      items: jobEventSchema
    }
  },
  required: [
    "id",
    "status",
    "currentStage",
    "originalFilename",
    "mimeType",
    "imageUrl",
    "flagged",
    "attempts",
    "maxAttempts",
    "createdAt",
    "updatedAt",
    "steps",
    "events"
  ]
} as const;

const notificationSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string", example: "Content flagged" },
    body: { type: "string", example: "A media job was flagged for violence." },
    dataJson: { nullable: true },
    readAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" }
  },
  required: ["id", "title", "body", "createdAt"]
} as const;

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Image Pipeline API",
    version: "1.0.0",
    description: "Authenticated API for image upload, asynchronous media processing, job tracking, and flagged-content notifications."
  },
  servers: [
    { url: "http://localhost:3001", description: "Local API server" }
  ],
  tags: [
    { name: "Auth" },
    { name: "Jobs" },
    { name: "Notifications" },
    { name: "Health" }
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "image_pipeline_token"
      },
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    },
    schemas: {
      ErrorResponse: errorResponse,
      User: userSchema,
      Job: jobSchema,
      Notification: notificationSchema
    }
  },
  paths: {
    "/api/auth/signup": {
      post: {
        tags: ["Auth"],
        summary: "Create account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 }
                },
                required: ["email", "password"]
              }
            }
          }
        },
        responses: {
          "201": {
            description: "Account created and authenticated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: userSchema
                  },
                  required: ["user"]
                }
              }
            }
          },
          "400": { description: "Invalid payload", content: { "application/json": { schema: errorResponse } } },
          "409": { description: "Email already exists", content: { "application/json": { schema: errorResponse } } },
          "429": { description: "Rate limited", content: { "application/json": { schema: errorResponse } } }
        }
      }
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 }
                },
                required: ["email", "password"]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Authenticated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: userSchema
                  },
                  required: ["user"]
                }
              }
            }
          },
          "400": { description: "Invalid payload", content: { "application/json": { schema: errorResponse } } },
          "401": { description: "Invalid credentials", content: { "application/json": { schema: errorResponse } } },
          "429": { description: "Rate limited", content: { "application/json": { schema: errorResponse } } }
        }
      }
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "200": {
            description: "Current authenticated user",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: userSchema
                  },
                  required: ["user"]
                }
              }
            }
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: errorResponse } } }
        }
      }
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout",
        responses: {
          "200": {
            description: "Signed out",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true }
                  },
                  required: ["ok"]
                }
              }
            }
          }
        }
      }
    },
    "/api/jobs": {
      post: {
        tags: ["Jobs"],
        summary: "Upload image and create media job",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  image: {
                    type: "string",
                    format: "binary",
                    description: "JPG, PNG, or WEBP image up to 5MB"
                  }
                },
                required: ["image"]
              }
            }
          }
        },
        responses: {
          "201": {
            description: "Job created and queued",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    jobId: { type: "string" },
                    status: { type: "string", enum: ["PENDING"] }
                  },
                  required: ["jobId", "status"]
                }
              }
            }
          },
          "400": { description: "Invalid upload", content: { "application/json": { schema: errorResponse } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: errorResponse } } },
          "429": { description: "Rate limited", content: { "application/json": { schema: errorResponse } } }
        }
      },
      get: {
        tags: ["Jobs"],
        summary: "List authenticated user's jobs",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "200": {
            description: "Job list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    jobs: {
                      type: "array",
                      items: jobSchema
                    }
                  },
                  required: ["jobs"]
                }
              }
            }
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: errorResponse } } }
        }
      }
    },
    "/api/jobs/{jobId}": {
      get: {
        tags: ["Jobs"],
        summary: "Get media job detail",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          {
            name: "jobId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Job detail",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    job: jobSchema
                  },
                  required: ["job"]
                }
              }
            }
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: errorResponse } } },
          "404": { description: "Job not found", content: { "application/json": { schema: errorResponse } } }
        }
      }
    },
    "/api/jobs/{jobId}/image": {
      get: {
        tags: ["Jobs"],
        summary: "Stream image asset for a job owned by the current user",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          {
            name: "jobId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Image bytes",
            content: {
              "image/jpeg": {},
              "image/png": {},
              "image/webp": {}
            }
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: errorResponse } } },
          "404": { description: "Job not found", content: { "application/json": { schema: errorResponse } } }
        }
      }
    },
    "/api/jobs/{jobId}/retry": {
      post: {
        tags: ["Jobs"],
        summary: "Retry a failed job and reset its attempt counter",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          {
            name: "jobId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Job re-queued",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    jobId: { type: "string" },
                    status: { type: "string", enum: ["PENDING"] }
                  },
                  required: ["jobId", "status"]
                }
              }
            }
          },
          "400": { description: "Job is not retryable", content: { "application/json": { schema: errorResponse } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: errorResponse } } },
          "404": { description: "Job not found", content: { "application/json": { schema: errorResponse } } }
        }
      }
    },
    "/api/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "List in-app notifications for the current user",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          "200": {
            description: "Notification list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    notifications: {
                      type: "array",
                      items: notificationSchema
                    }
                  },
                  required: ["notifications"]
                }
              }
            }
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: errorResponse } } }
        }
      }
    },
    "/api/notifications/{id}/read": {
      post: {
        tags: ["Notifications"],
        summary: "Mark a notification as read",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Notification updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    notification: notificationSchema
                  },
                  required: ["notification"]
                }
              }
            }
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: errorResponse } } },
          "404": { description: "Notification not found", content: { "application/json": { schema: errorResponse } } }
        }
      }
    },
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          "200": {
            description: "Current API health",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    uptime: { type: "number", example: 42.3 },
                    database: { type: "string", example: "ok" },
                    userCount: { type: "integer", example: 3 }
                  },
                  required: ["status", "uptime", "database", "userCount"]
                }
              }
            }
          }
        }
      }
    }
  }
} as const;
