export type User = {
  id: string;
  email: string;
};

export type Job = {
  id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FLAGGED" | "FAILED";
  currentStage: string;
  originalFilename: string;
  mimeType: string;
  imageUrl: string;
  caption: string | null;
  labels: Array<{ name: string; confidence: string }> | null;
  safetyResult:
    | null
    | {
        safe: boolean;
        flagged: boolean;
        categories: string[];
        primaryCategory: string;
        reason: string;
        rawText?: string;
      };
  lastError: null | { message?: string };
  flagged: boolean;
  flaggedCategory: string | null;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  steps: Array<{
    id: string;
    name: string;
    status: string;
    position: number;
    attempt: number;
    errorJson: null | { message?: string };
  }>;
  events: Array<{
    id: string;
    type: string;
    createdAt: string;
    payloadJson: unknown;
  }>;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

const apiBaseUrl = import.meta.env.DEV ? "http://localhost:3001/api" : "/api";
const assetBaseUrl = import.meta.env.DEV ? "http://localhost:3001" : "";

function apiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

export function assetUrl(path: string) {
  return `${assetBaseUrl}${path}`;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? "Request failed");
  }

  return data as T;
}

export async function signup(payload: { email: string; password: string }) {
  const response = await fetch(apiUrl("/auth/signup"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return readJson<{ user: User }>(response);
}

export async function login(payload: { email: string; password: string }) {
  const response = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return readJson<{ user: User }>(response);
}

export async function me() {
  const response = await fetch(apiUrl("/auth/me"), {
    credentials: "include"
  });

  return readJson<{ user: User }>(response);
}

export async function logout() {
  const response = await fetch(apiUrl("/auth/logout"), {
    method: "POST",
    credentials: "include"
  });

  return readJson<{ ok: boolean }>(response);
}

export async function createJob(file: File) {
  const form = new FormData();
  form.append("image", file);

  const response = await fetch(apiUrl("/jobs"), {
    method: "POST",
    credentials: "include",
    body: form
  });

  return readJson<{ jobId: string; status: string }>(response);
}

export async function listJobs() {
  const response = await fetch(apiUrl("/jobs"), {
    credentials: "include"
  });

  return readJson<{ jobs: Job[] }>(response);
}

export async function getJob(jobId: string) {
  const response = await fetch(apiUrl(`/jobs/${jobId}`), {
    credentials: "include"
  });

  return readJson<{ job: Job }>(response);
}

export async function retryJob(jobId: string) {
  const response = await fetch(apiUrl(`/jobs/${jobId}/retry`), {
    method: "POST",
    credentials: "include"
  });

  return readJson<{ jobId: string; status: string }>(response);
}

export async function listNotifications() {
  const response = await fetch(apiUrl("/notifications"), {
    credentials: "include"
  });

  return readJson<{ notifications: Notification[] }>(response);
}

export async function readNotification(notificationId: string) {
  const response = await fetch(apiUrl(`/notifications/${notificationId}/read`), {
    method: "POST",
    credentials: "include"
  });

  return readJson<{ notification: Notification }>(response);
}

export async function health() {
  const response = await fetch(apiUrl("/health"), {
    credentials: "include"
  });

  return readJson<{
    status: string;
    uptime: number;
    database: string;
    userCount: number;
  }>(response);
}
