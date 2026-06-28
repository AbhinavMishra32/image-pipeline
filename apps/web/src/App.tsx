import {
  AlertCircleIcon,
  BellIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  Clock3Icon,
  EllipsisIcon,
  FileImageIcon,
  HeartPulseIcon,
  ImagePlusIcon,
  KeyRoundIcon,
  Layers3Icon,
  Loader2Icon,
  LogOutIcon,
  RadarIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TimerResetIcon,
  UploadIcon
} from "lucide-react";
import { useEffect, useRef } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams
} from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  assetUrl,
  createJob,
  getJob,
  health,
  listJobs,
  listNotifications,
  login,
  logout,
  me,
  readNotification,
  retryJob,
  signup,
  type Job
} from "./api";

const statusCopy: Record<Job["status"], string> = {
  PENDING: "Waiting",
  PROCESSING: "Checking",
  COMPLETED: "Ready",
  FLAGGED: "Needs review",
  FAILED: "Failed"
};

const stepCopy: Record<string, string> = {
  IMAGE_CAPTIONING: "Description",
  LABEL_DETECTION: "Labels",
  CONTENT_SAFETY: "Safety"
};

const eventCopy: Record<string, string> = {
  JOB_CREATED: "Job created",
  JOB_QUEUED: "Queued",
  JOB_STARTED: "Worker started",
  STEP_STARTED: "Step started",
  STEP_COMPLETED: "Step completed",
  STEP_FAILED: "Step failed",
  STEP_REUSED: "Step reused",
  JOB_COMPLETED: "Completed",
  JOB_FLAGGED: "Flagged",
  JOB_FAILED: "Failed",
  JOB_RETRIED: "Retried"
};

function useCurrentUser() {
  return useQuery({
    queryKey: ["me"],
    queryFn: me,
    retry: false
  });
}

function getStatusVariant(status: Job["status"]) {
  if (status === "FAILED") return "destructive";
  if (status === "COMPLETED") return "default";
  if (status === "FLAGGED") return "secondary";
  return "outline";
}

function StatusBadge({ status }: { status: Job["status"] }) {
  return <Badge variant={getStatusVariant(status)}>{statusCopy[status]}</Badge>;
}

function AppShell({
  children,
  email
}: {
  children: React.ReactNode;
  email?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/login");
    }
  });

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r bg-card px-4 py-5 lg:flex lg:flex-col">
        <Link to="/dashboard" className="flex items-center gap-2">
          <Avatar className="size-8 rounded-lg">
            <AvatarFallback>IP</AvatarFallback>
          </Avatar>
        </Link>
        <nav className="mt-8 flex flex-col gap-1">
          <Button asChild variant="secondary" className="justify-start">
            <Link to="/dashboard">
              <FileImageIcon data-icon="inline-start" />
              Images
            </Link>
          </Button>
          <Button asChild variant="ghost" className="justify-start">
            <Link to="/health">
              <HeartPulseIcon data-icon="inline-start" />
              Service
            </Link>
          </Button>
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-lg border p-2">
          <Avatar className="size-8">
            <AvatarFallback>{email?.slice(0, 2).toUpperCase() ?? "IP"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{email ?? "Signed in"}</div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                <LogOutIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sign out</TooltipContent>
          </Tooltip>
        </div>
      </aside>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-8">
          <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback>IP</AvatarFallback>
            </Avatar>
          </Link>
          <div className="hidden text-sm text-muted-foreground lg:block">Jobs</div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm">
                <EllipsisIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">Images</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/health">Service</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (payload: { email: string; password: string }) =>
      mode === "login" ? login(payload) : signup(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/dashboard");
    }
  });

  const isLogin = mode === "login";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,oklch(0.99_0.01_96),oklch(0.96_0.02_210))] p-4 sm:p-8">
      <Card className="w-full max-w-sm border-background/80 bg-background/95 shadow-2xl shadow-foreground/10 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-2xl">{isLogin ? "Sign in" : "Create account"}</CardTitle>
          <CardDescription>
            {isLogin ? "Enter your credentials to continue." : "Create credentials to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              mutation.mutate({
                email: String(formData.get("email") ?? ""),
                password: String(formData.get("password") ?? "")
              });
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" type="email" required defaultValue="admin@example.com" autoComplete="email" />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input id="password" name="password" type="password" required defaultValue="password123" autoComplete={isLogin ? "current-password" : "new-password"} />
              </Field>
              {mutation.isError ? (
                <Field>
                  <FieldError>{(mutation.error as Error).message}</FieldError>
                </Field>
              ) : null}
              <Button type="submit" disabled={mutation.isPending} className="w-full">
                {mutation.isPending ? <Loader2Icon data-icon="inline-start" /> : <KeyRoundIcon data-icon="inline-start" />}
                {isLogin ? "Sign in" : "Create account"}
              </Button>
              <Separator />
              <Button asChild variant="ghost" className="w-full">
                <Link to={isLogin ? "/signup" : "/login"}>
                  {isLogin ? "Create account" : "Sign in instead"}
                </Link>
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const meQuery = useCurrentUser();
  const jobsQuery = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => (await listJobs()).jobs,
    refetchInterval: (query) =>
      query.state.data?.some((job) => ["PENDING", "PROCESSING"].includes(job.status))
        ? 2500
        : false
  });
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await listNotifications()).notifications,
    refetchInterval: 5000
  });
  const uploadMutation = useMutation({
    mutationFn: createJob,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
    }
  });
  const readNotificationMutation = useMutation({
    mutationFn: readNotification,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  if (meQuery.isLoading) {
    return (
      <AppShell>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-80 w-full" />
      </AppShell>
    );
  }

  if (meQuery.isError || !meQuery.data) {
    return <Navigate to="/login" replace />;
  }

  const jobs = jobsQuery.data ?? [];
  const activeCount = jobs.filter((job) => ["PENDING", "PROCESSING"].includes(job.status)).length;
  const flaggedCount = jobs.filter((job) => job.status === "FLAGGED").length;
  const failedCount = jobs.filter((job) => job.status === "FAILED").length;

  return (
    <AppShell email={meQuery.data.user.email}>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-medium tracking-tight">Images</h1>
        <p className="text-sm text-muted-foreground">Upload an image and review the description, labels, and safety check.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Recent checks</CardTitle>
            <CardDescription>{jobs.length} image{jobs.length === 1 ? "" : "s"} in your workspace</CardDescription>
            <CardAction>
              <Button asChild variant="outline" size="sm">
                <Link to="/health">
                  <HeartPulseIcon data-icon="inline-start" />
                  Service
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {jobsQuery.isLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : jobs.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileImageIcon />
                  </EmptyMedia>
                  <EmptyTitle>No images yet</EmptyTitle>
                  <EmptyDescription>Your uploads will appear here after the first check starts.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Current check</TableHead>
                    <TableHead className="hidden lg:table-cell">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow
                      key={job.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/jobs/${job.id}`)}
                    >
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <img
                            alt={job.originalFilename}
                            src={assetUrl(job.imageUrl)}
                            className="size-10 rounded-lg object-cover ring-1 ring-border"
                          />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{job.originalFilename}</div>
                            {job.lastError?.message ? (
                              <div className="truncate text-xs text-destructive">{job.lastError.message}</div>
                            ) : (
                              <div className="text-xs text-muted-foreground">{job.mimeType}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={job.status} /></TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {stepCopy[job.currentStage] ?? "Complete"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Add image</CardTitle>
              <CardDescription>JPG, PNG, or WEBP up to 5MB.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  const file = formData.get("image");

                  if (file instanceof File) {
                    uploadMutation.mutate(file);
                  }
                }}
              >
                <FieldGroup>
                  <Field data-invalid={uploadMutation.isError || undefined}>
                    <FieldLabel htmlFor="image">Image file</FieldLabel>
                    <Input id="image" name="image" type="file" accept="image/jpeg,image/png,image/webp" required />
                    <FieldDescription>The check starts automatically after upload.</FieldDescription>
                    {uploadMutation.isError ? (
                      <FieldError>{(uploadMutation.error as Error).message}</FieldError>
                    ) : null}
                  </Field>
                  <Button type="submit" disabled={uploadMutation.isPending}>
                    {uploadMutation.isPending ? (
                      <Loader2Icon data-icon="inline-start" />
                    ) : (
                      <UploadIcon data-icon="inline-start" />
                    )}
                    Upload
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              <Metric label="Active" value={activeCount} icon={<Clock3Icon />} />
              <Metric label="Review" value={flaggedCount} icon={<ShieldAlertIcon />} />
              <Metric label="Failed" value={failedCount} icon={<AlertCircleIcon />} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alerts</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {(notificationsQuery.data?.length ?? 0) === 0 ? (
                <Empty className="border-0 p-2">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><BellIcon /></EmptyMedia>
                    <EmptyTitle>No alerts</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : (
                notificationsQuery.data?.slice(0, 4).map((notification) => (
                  <Button
                    key={notification.id}
                    variant={notification.readAt ? "ghost" : "outline"}
                    className="h-auto justify-start text-left"
                    onClick={() => readNotificationMutation.mutate(notification.id)}
                  >
                    <BellIcon data-icon="inline-start" />
                    <span className="min-w-0 truncate">{notification.title}</span>
                  </Button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-2">
      <div className="mb-2 text-muted-foreground">{icon}</div>
      <div className="font-heading text-xl font-medium">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function eventIcon(type: string) {
  if (type.includes("FAILED")) return <AlertCircleIcon />;
  if (type.includes("FLAGGED")) return <ShieldAlertIcon />;
  if (type.includes("COMPLETED")) return <CheckCircle2Icon />;
  if (type.includes("RETRIED")) return <TimerResetIcon />;
  if (type.includes("STEP")) return <SparklesIcon />;
  return <Clock3Icon />;
}

function formatEventPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.stepName === "string") {
    return stepCopy[record.stepName] ?? record.stepName;
  }

  if (typeof record.category === "string") {
    return record.category;
  }

  if (record.error && typeof record.error === "object" && "message" in record.error) {
    const error = record.error as { message?: unknown };
    return typeof error.message === "string" ? error.message : null;
  }

  return null;
}

function EventTimeline({ events }: { events: Job["events"] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth"
    });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <Empty className="border-0 p-4">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Clock3Icon /></EmptyMedia>
          <EmptyTitle>No events yet</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div ref={scrollRef} className="max-h-96 overflow-y-auto pr-2">
      <div className="relative flex flex-col gap-0 pl-5">
        <div className="absolute bottom-4 left-[15px] top-4 w-px bg-border" />
        {events.map((event, index) => {
          const detail = formatEventPayload(event.payloadJson);
          const isLatest = index === events.length - 1;

          return (
            <div
              key={event.id}
              className={cn(
                "relative grid grid-cols-[28px_1fr] gap-3 pb-5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
                isLatest && "timeline-latest"
              )}
            >
              <div
                className={cn(
                  "relative z-10 mt-1 flex size-7 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm",
                  isLatest && "border-primary text-primary"
                )}
              >
                {eventIcon(event.type)}
              </div>
              <div className={cn("rounded-lg border bg-card p-3", isLatest && "border-primary/40")}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-medium">{eventCopy[event.type] ?? event.type.replaceAll("_", " ")}</div>
                  <div className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleTimeString()}</div>
                </div>
                {detail ? (
                  <div className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepProgress({ job }: { job: Job }) {
  return (
    <div className="flex flex-col gap-2">
      {job.steps.map((step) => (
        <div key={step.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{step.position}. {stepCopy[step.name] ?? step.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">Attempt {step.attempt}</div>
            {step.errorJson?.message ? (
              <div className="mt-1 truncate text-xs text-destructive">{step.errorJson.message}</div>
            ) : null}
          </div>
          <Badge variant={step.status === "FAILED" ? "destructive" : step.status === "COMPLETED" ? "default" : "outline"}>
            {step.status.toLowerCase()}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function JobDetailPage() {
  const { jobId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const jobQuery = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => (await getJob(jobId)).job,
    refetchInterval: (query) =>
      query.state.data && ["PENDING", "PROCESSING"].includes(query.state.data.status)
        ? 2500
        : false
  });
  const retryMutation = useMutation({
    mutationFn: async () => retryJob(jobId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    }
  });
  const meQuery = useCurrentUser();

  if (jobQuery.isLoading) {
    return (
      <AppShell email={meQuery.data?.user.email}>
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </AppShell>
    );
  }

  if (jobQuery.isError) {
    return (
      <AppShell email={meQuery.data?.user.email}>
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Could not open image</AlertTitle>
          <AlertDescription>{(jobQuery.error as Error).message}</AlertDescription>
        </Alert>
      </AppShell>
    );
  }

  const job = jobQuery.data;

  if (!job) {
    return (
      <AppShell email={meQuery.data?.user.email}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><FileImageIcon /></EmptyMedia>
            <EmptyTitle>Image not found</EmptyTitle>
          </EmptyHeader>
        </Empty>
      </AppShell>
    );
  }

  return (
    <AppShell email={meQuery.data?.user.email}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon-sm" onClick={() => navigate("/dashboard")}>
            <ChevronLeftIcon />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-2xl font-medium tracking-tight">{job.originalFilename}</h1>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={job.status} />
              <span className="text-sm text-muted-foreground">{stepCopy[job.currentStage] ?? "Complete"}</span>
            </div>
          </div>
        </div>
        {job.status === "FAILED" ? (
          <Button onClick={() => retryMutation.mutate()} disabled={retryMutation.isPending}>
            {retryMutation.isPending ? <Loader2Icon data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
            Run again
          </Button>
        ) : null}
      </div>

      {job.flagged ? (
        <Alert>
          <ShieldAlertIcon />
          <AlertTitle>Needs review</AlertTitle>
          <AlertDescription>
            This image was flagged for {job.flaggedCategory ?? "manual review"}.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <img
            alt={job.originalFilename}
            src={assetUrl(job.imageUrl)}
            className="aspect-square w-full object-cover"
          />
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{job.mimeType}</span>
              <span className="text-sm text-muted-foreground">{new Date(job.createdAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{job.caption ?? "Not ready yet."}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Labels</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {job.labels?.length ? (
                job.labels.map((label) => (
                  <Badge key={label.name} variant="outline">
                    <SparklesIcon data-icon="inline-start" />
                    {label.name}
                    <span className="text-muted-foreground">{label.confidence}</span>
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Not ready yet.</span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Safety</CardTitle>
              <CardDescription>{job.safetyResult?.reason || "Not ready yet."}</CardDescription>
            </CardHeader>
            {job.safetyResult ? (
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant={job.safetyResult.flagged ? "secondary" : "default"}>
                  {job.safetyResult.flagged ? <ShieldAlertIcon data-icon="inline-start" /> : <CheckCircle2Icon data-icon="inline-start" />}
                  {job.safetyResult.flagged ? "Review needed" : "Looks okay"}
                </Badge>
                {job.safetyResult.categories.map((category) => (
                  <Badge key={category} variant="outline">{category}</Badge>
                ))}
              </CardContent>
            ) : null}
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            Attempt {job.attempts} of {job.maxAttempts}. Automatic retries run before manual retry becomes available.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <StepProgress job={job} />
          <EventTimeline events={job.events} />
        </CardContent>
      </Card>
    </AppShell>
  );
}

function HealthPage() {
  const meQuery = useCurrentUser();
  const query = useQuery({
    queryKey: ["health"],
    queryFn: health,
    refetchInterval: 4000
  });

  if (meQuery.isError) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell email={meQuery.data?.user.email}>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-medium tracking-tight">Service</h1>
        <p className="text-sm text-muted-foreground">Current app health.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>Updates every few seconds.</CardDescription>
        </CardHeader>
        <CardContent>
          {query.data ? (
            <div className="grid gap-3 md:grid-cols-3">
              <Metric label="API" value={query.data.status === "ok" ? 1 : 0} icon={<CheckCircle2Icon />} />
              <Metric label="Database" value={query.data.database === "ok" ? 1 : 0} icon={<HeartPulseIcon />} />
              <Metric label="Users" value={query.data.userCount} icon={<BellIcon />} />
            </div>
          ) : (
            <Skeleton className="h-28 w-full" />
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/jobs/:jobId" element={<JobDetailPage />} />
      <Route path="/health" element={<HealthPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
