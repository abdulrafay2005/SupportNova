import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getComplaintAnalysis,
  getComplaintDetail,
  getComplaintActivity,
  customerRespond,
  type ComplaintDetailResponse,
  type ComplaintActivityEntry,
} from "@/api/complaints";
import {
  agentStart,
  agentAwait,
  agentResolve,
  agentEscalate,
  agentComment,
} from "@/api/workflows";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";

import { AnalysisCard } from "@/components/AnalysisCard";
import { Avatar } from "@/components/Avatar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Button } from "@/components/Button";
import { EscalationPanel } from "@/components/EscalationPanel";
import { ErrorState } from "@/components/ErrorState";
import { Modal } from "@/components/Modal";
import { NotAvailable } from "@/components/NotAvailable";
import { PolicyReference } from "@/components/PolicyReference";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ResolutionSteps } from "@/components/ResolutionSteps";
import { Select } from "@/components/Select";
import { SentimentBadge } from "@/components/SentimentBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/Textarea";
import { Timeline } from "@/components/Timeline";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import {
  ValidationBadge,
  ValidationResult,
} from "@/components/ValidationResult";
import { WorkflowSteps } from "@/components/WorkflowSteps";

import { useAuth } from "@/auth/AuthContext";
import { useData } from "@/context/DataContext";


import { customerNextStep } from "@/utils/classify";
import {
  type ComplaintStatus,
  type Customer,
  type DocumentStatus,
  type Priority,
  type Sentiment,
  type TimelineEvent,
  type Urgency,
  type ValidationState,
} from "@/types";
import { api } from "@/api/client";

/*
 * Agent-selectable workflow transitions.
 *
 * "Assigned" is a routing state produced by automatic
 * assignment / reviewer reassignment / management
 * reassignment — never something an Agent sets manually.
 * "Closed" finalization is not an Agent action either.
 */
const AGENT_TRANSITIONS: ComplaintStatus[] = [
  "In Progress",
  "Awaiting Customer",
  "Escalated",
  "Resolved",
];
const MANAGEMENT_TRANSITIONS: ComplaintStatus[] = [
  "In Progress",
  "Resolved",
  "Closed",
];

import { formatDateTime, formatRelative } from "@/utils/dates";
import { cn } from "@/utils/cn";

export function ComplaintDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { user } = useAuth();

  const {
    complaints,
    getCustomer,

    updateComplaint,
    refreshComplaints,
  } = useData();

  const complaint = complaints.find((c) => c.id === id);

  /*
   * Backend complaint detail + persistent activity timeline.
   *
   * The detail response carries the ACTUAL submitter identity
   * (staff only) and the activity endpoint returns the
   * database-backed timeline (customer-filtered server-side).
   */
  const [detail, setDetail] =
    useState<ComplaintDetailResponse | null>(null);
  const [backendActivity, setBackendActivity] =
    useState<ComplaintActivityEntry[] | null>(null);

  /* Stored-analysis fetch state, surfaced instead of failing silently. */
  const [analysisLoading, setAnalysisLoading] =
    useState(false);
  const [analysisError, setAnalysisError] =
    useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    if (!id) return;

    try {
      setDetail(await getComplaintDetail(id));
    } catch {
      setDetail(null);
    }

    try {
      setBackendActivity(await getComplaintActivity(id));
    } catch {
      setBackendActivity(null);
    }
  }, [id]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  /*
   * Customer identity
   *
   * A customer viewing their OWN complaint is the submitter,
   * so their profile is correct. Staff must see the actual
   * complaint submitter from the backend — NEVER the
   * currently logged-in staff user.
   */
  const isViewerOwner =
    user?.role === "Customer" &&
    complaint?.customerId === user.id;

  const customer: Customer | undefined = isViewerOwner && user
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        joinedAt: user.createdAt,
        openComplaints: complaints.filter(
          (c) =>
            c.customerId === user.id &&
            c.status !== "Resolved" &&
            c.status !== "Closed",
        ).length,
      }
    : detail?.customer
      ? {
          id: detail.customer.id,
          name: detail.customer.name ?? "Unknown",
          email: detail.customer.email ?? "",
          phone: detail.customer.phone ?? undefined,
          joinedAt: "",
          openComplaints: 0,
        }
      : complaint
        ? getCustomer(complaint.customerId)
        : undefined;

  /*
   * The assigned agent comes from the backend detail response
   * (staff-only field), so the name shown always matches the
   * persisted `assigned_to`. There is no client-side user
   * directory to look names up in.
   */
  const assignee = detail?.assigned_agent ?? null;

  const assigneeLabel =
    assignee?.name ??
    (complaint?.assigneeId || detail?.assigned_to
      ? "Assigned (name unavailable)"
      : null);

  const isStaff =
    user?.role === "Agent" ||
    user?.role === "Reviewer" ||
    user?.role === "Manager" ||
    user?.role === "Admin";

  const isOwner =
    user?.role === "Customer" &&
    complaint?.customerId === user.id;

  const [reply, setReply] = useState("");
  const [customerReply, setCustomerReply] = useState("");

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState("");

  /*
   * Agent backend actions.
   *
   * When the signed-in user is an Agent, the controls below
   * call the real backend endpoints instead of only mutating
   * local context state. The backend remains authoritative
   * for assignment and role checks (403 when the complaint
   * is not assigned to this agent).
   */
  const isAgent = user?.role === "Agent";
  const isManagement =
  user?.role === "Manager" ||
  user?.role === "Admin";

  const [actionLoading, setActionLoading] = useState<
    string | null
  >(null);
  const [actionError, setActionError] = useState<
    string | null
  >(null);
  const [commentAction, setCommentAction] = useState<
    "escalate" | "await-customer" | null
  >(null);
  const [actionComment, setActionComment] = useState("");

  const runAgentAction = async (
    name: string,
    action: () => Promise<unknown>,
  ) => {
    if (actionLoading) return false;

    setActionLoading(name);
    setActionError(null);

    try {
      await action();
      await refreshComplaints();
      await loadMeta();
      return true;
    } catch (error) {
      const detail = (error as {
        response?: { data?: { detail?: unknown } };
      })?.response?.data?.detail;

      setActionError(
        typeof detail === "string"
          ? detail
          : `The "${name}" action failed. Please try again.`,
      );
      return false;
    } finally {
      setActionLoading(null);
    }
  };

const runManagementStatusChange = async (
  status: ComplaintStatus,
) => {
  if (!isManagement) return;

  if (!complaint) {
    setActionError("Complaint not found.");
    return;
  }

  if (complaint.status !== "Escalated") {
    setActionError(
      "Management can only override escalated complaints.",
    );
    return;
  }

  if (actionLoading) return;

  setActionLoading(`Management: ${status}`);
  setActionError(null);

  try {
    await api.patch(
      `/api/complaints/${complaint.id}`,
      {
        status,
      },
    );

    await refreshComplaints();
    await loadMeta();
  } catch (error) {
    const detail = (
      error as {
        response?: {
          data?: {
            detail?: unknown;
          };
        };
      }
    )?.response?.data?.detail;

    setActionError(
      typeof detail === "string"
        ? detail
        : `Unable to change the complaint status to "${status}".`,
    );
  } finally {
    setActionLoading(null);
  }
};

  /*
   * Load the real backend analysis.
   */
  useEffect(() => {
    if (!id || !complaint) return;

    const loadAnalysis = async () => {
      setAnalysisLoading(true);
      setAnalysisError(null);

      try {
        const analysis = await getComplaintAnalysis(id);

        /*
         * ----------------------------------------------------
         * Priority
         *
         * The rule engine writes a real priority onto the
         * analysis. It is NOT derived from the escalation
         * severity, and it is left empty when the engine did
         * not produce one.
         * ----------------------------------------------------
         */

        const priorityMap: Record<string, Priority> = {
          Critical: "P0",
          High: "P1",
          Medium: "P2",
          Low: "P3",
          P0: "P0",
          P1: "P1",
          P2: "P2",
          P3: "P3",
        };

        const rawPriority =
          typeof analysis.priority === "string"
            ? analysis.priority.trim()
            : "";

        const priority: Priority | null =
          priorityMap[rawPriority] ?? null;

        /*
         * ----------------------------------------------------
         * Urgency
         *
         * No urgency value is produced by the analysis
         * pipeline or persisted on the complaint, so there is
         * nothing to show.
         * ----------------------------------------------------
         */

        const urgency: Urgency | null = null;

        /*
         * ----------------------------------------------------
         * Sentiment
         * ----------------------------------------------------
         */

        const sentimentLabel =
          analysis.sentiment?.label
            ?.trim()
            .toLowerCase();

        const sentiment: Sentiment | null =
          sentimentLabel === "positive"
            ? "Positive"
            : sentimentLabel === "strongly negative"
              ? "Strongly Negative"
              : sentimentLabel === "negative"
                ? "Negative"
                : sentimentLabel === "neutral"
                  ? "Neutral"
                  : null;

        /*
         * ----------------------------------------------------
         * Product
         * ----------------------------------------------------
         */

        const productService =
          analysis.entities?.product ||
          complaint.productService ||
          null;

        /*
         * ----------------------------------------------------
         * Escalation
         * ----------------------------------------------------
         */

        const escalationLevel =
          typeof analysis.escalation?.level === "string"
            ? analysis.escalation.level.trim()
            : "";

        const escalated =
          analysis.escalation?.required ?? false;

        /*
         * ----------------------------------------------------
         * Policy
         * ----------------------------------------------------
         */

        const policy = analysis.policies?.[0]
          ? {
              id: analysis.policies[0].Policy_ID,
              title: analysis.policies[0].Policy_Name,
              section: analysis.policies[0].Policy_Rule,
              version: "N/A",
              status: (
                analysis.policies[0].Status?.trim().toLowerCase() === "active"
                  ? "Active"
                  : "Previous"
              ) as DocumentStatus,
              applicability: analysis.policies[0].Owner_Department,
            }
          : undefined;

        /*
         * ----------------------------------------------------
         * Validation
         * ----------------------------------------------------
         */

        const validationStatus: ValidationState | null =
          analysis.validation?.manual_review_required
            ? "Manual Review Required"
            : analysis.validation?.status === "Passed"
              ? "Match"
              : analysis.validation?.status === "Failed"
                ? "Mismatch"
                : null;

        /*
         * ----------------------------------------------------
         * Resolution
         * ----------------------------------------------------
         */

        const resolutionSteps =
          analysis.resolution?.steps ?? [];

        /*
         * ----------------------------------------------------
         * Supporting department
         * ----------------------------------------------------
         */

        const supportingDepartment =
          analysis.routing
            ?.supporting_departments?.[0];

        /*
         * ----------------------------------------------------
         * Update the existing complaint object.
         * No UI is changed here.
         * ----------------------------------------------------
         */

        updateComplaint(id, {
          category:
            analysis.classification?.category ||
            complaint.category ||
            null,

          subcategory:
            analysis.classification?.subcategory ||
            complaint.subcategory ||
            null,

          /*
           * The routing department the workflow persisted on the
           * complaint wins: that is where the complaint actually
           * went. The classification department is only a
           * fallback for complaints that were never routed.
           */
          department:
            complaint.department ||
            analysis.routing?.primary_department ||
            analysis.classification?.department ||
            null,

          productService,

          priority,
          urgency,
          sentiment,

          escalated,

          validation: validationStatus,

          reference:
            analysis.entities?.order_id ||
            complaint.reference,

          policy,

          intelligence: {
            secondaryIssues: [],

            summary:
              analysis.resolution?.explanation ||
              "",

            primaryIssue:
              analysis.complaint?.title ||
              complaint.subject,

            category:
              analysis.classification?.category ||
              complaint.category ||
              null,

            subcategory:
              analysis.classification?.subcategory ||
              complaint.subcategory ||
              null,

            sentiment,
            urgency,
            priority,
            productService,

            entities: [
              analysis.entities?.order_id
                ? `Order: ${analysis.entities.order_id}`
                : "",

              analysis.entities?.transaction_id
                ? `Transaction: ${analysis.entities.transaction_id}`
                : "",

              analysis.entities?.product
                ? `Product: ${analysis.entities.product}`
                : "",

              analysis.entities?.amount
                ? `Amount: ${analysis.entities.amount}`
                : "",

              analysis.entities?.date
                ? `Date: ${analysis.entities.date}`
                : "",
            ].filter(Boolean),

            department:
              complaint.department ||
              analysis.routing?.primary_department ||
              analysis.classification?.department ||
              null,

            supportingDepartment,

            escalation: escalated,

            reason:
              analysis.escalation?.reason || "",

            recommendation:
              resolutionSteps.join(" "),

            agentGuidance:
              analysis.agent_guidance
                ? [analysis.agent_guidance]
                : [],

            clarificationQuestions:
              analysis.clarification_questions ??
              [],

            generatedResponse:
              analysis.customer_response ||
              undefined,
          },

          validationDetail: {
            overall: validationStatus,

            /*
             * The current backend validation response
             * provides issues rather than individual
             * field comparisons.
             */
            fields:
                      analysis.validation?.issues?.map(
              (issue: string | { message: string }) => ({
                field: "Validation",
                genai: "Analysis output",
                python:
                  typeof issue === "string"
                    ? issue
                    : issue.message,
                result: "Mismatch",
              }),
            )
              ?? [],

            policyValidated:
              Boolean(
                analysis.policies?.length,
              ) &&
              validationStatus === "Match",

            resolutionValidated:
              Boolean(resolutionSteps.length) &&
              validationStatus === "Match",

            reviewReason:
              analysis.validation
                ?.manual_review_required
                ? "Manual review is required for this complaint."
                : undefined,
          },

          escalationAssessment: {
            required: escalated,

            /*
             * The stored escalation level, mapped onto the
             * levels the UI knows. An unrecognised or missing
             * level renders as "Not available" rather than
             * being guessed from the severity.
             */
            level: escalated
              ? escalationLevel === "Critical"
                ? "Critical Management Escalation"
                : escalationLevel === "High"
                  ? "Supervisor Review"
                  : escalationLevel === "Medium"
                    ? "Department Manager"
                    : escalationLevel === "Low"
                      ? "Specialist Team"
                      : null
              : "No Escalation",

            reason:
              analysis.escalation?.reason || "",

            validation: validationStatus,
          },

          resolutionPlan:
            resolutionSteps.length
              ? {
                  steps: resolutionSteps,
                  requiredActions:
                    resolutionSteps,
                  prohibitedActions: [],
                }
              : undefined,

          followUp:
            analysis.follow_up?.required
              ? {
                  required: true,
                  communication:
                    analysis.follow_up.message ||
                    undefined,
                }
              : undefined,

          missingInfo:
            analysis.clarification_questions
              ?.length
              ? {
                  items:
                    analysis.clarification_questions,
                  questions:
                    analysis.clarification_questions,
                }
              : undefined,

          customerResponse:
            analysis.customer_response ||
            undefined,
        });
      } catch (error: unknown) {
        const status = (
          error as { response?: { status?: number } }
        )?.response?.status;

        /*
         * 404 simply means no analysis document exists for
         * this complaint, which is a valid state.
         */
        setAnalysisError(
          status === 404
            ? null
            : "The stored analysis could not be loaded.",
        );
      } finally {
        setAnalysisLoading(false);
      }
    };

    void loadAnalysis();
  }, [id]);

  /*
   * --------------------------------------------------------
   * Related complaints
   * --------------------------------------------------------
   */

  const related = useMemo(() => {
    if (!complaint) return [];

    return complaints
      .filter(
        (c) =>
          c.customerId === complaint.customerId &&
          c.id !== complaint.id,
      )
      .slice(0, 4);
  }, [complaints, complaint]);

  /*
   * --------------------------------------------------------
   * Not found
   * --------------------------------------------------------
   */

  if (!complaint) {
    return (
      <ErrorState
        title="Complaint not found"
        description="This ID does not match a complaint in the workspace."
        onRetry={() =>
          navigate(
            user
              ? user.role === "Customer"
                ? "/my-complaints"
                : "/complaints"
              : "/",
          )
        }
      />
    );
  }

  /*
   * Customer ownership protection.
   */
  if (user?.role === "Customer" && !isOwner) {
    return (
      <ErrorState
        title="Complaint not found"
        description="You can only view complaints you have submitted."
        onRetry={() => navigate("/my-complaints")}
      />
    );
  }

  const backTo = !user
    ? "/"
    : user.role === "Customer"
      ? "/my-complaints"
      : "/complaints";

  const customerSafe = !isStaff;

  /*
   * --------------------------------------------------------
   * Customer next step
   *
   * The old helper returned "Waiting for department
   * assignment" for an Analyzed complaint even when the
   * backend had already assigned a department.
   * --------------------------------------------------------
   */

  const nextStep = (() => {
    if (complaint.department) {
      switch (complaint.status) {
        case "New":
          return "Complaint analysis";

        case "Analyzed":
          return complaint.assigneeId
            ? "Support review"
            : "Waiting for support review";

        case "Assigned":
          return "Support review";

        case "In Progress":
          return "Resolution";

        case "Awaiting Customer":
          return "Your response";

        case "Escalated":
          return "Escalation review";

        case "Reopened":
          return "Support review";

        case "Resolved":
          return "Resolution complete";

        case "Closed":
          return "Complaint closed";

        case "Manual Review":
          return "Manual review";

        default:
          return customerNextStep(
            complaint.status,
          );
      }
    }

    return customerNextStep(
      complaint.status,
    );
  })();

  /*
   * --------------------------------------------------------
   * Reply
   * --------------------------------------------------------
   */

  const onReply = (e: FormEvent) => {
    e.preventDefault();

    if (!reply.trim()) return;

    const text = reply.trim();

    /*
     * Agents submit comments to the real backend endpoint.
     * The persistent timeline is refetched from the
     * database after the backend confirms the comment
     * (runAgentAction -> loadMeta), so no local/fake
     * timeline entry is appended.
     */
    void runAgentAction("Comment", () =>
      agentComment(complaint.id, text),
    ).then((ok) => {
      if (ok) {
        setReply("");
      }
    });
  };

const timelineEvents = (backendActivity ?? []).map((entry) => ({
  id: entry.id,
  timestamp: entry.timestamp,
  type: entry.type as TimelineEvent["type"],
  title: entry.title,
  description: entry.description,
  actor: entry.actor,
  actorRole:
    entry.actorRole as TimelineEvent["actorRole"],
}));

  return (
    <div>
      {/* -------------------------------------------------- */}
      {/* Header */}
      {/* -------------------------------------------------- */}

      <div className="mb-4">
        <Link
          to={backTo}
          className="mb-2 inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={14} />
          {customerSafe
            ? "Back"
            : "Back to complaints"}
        </Link>

        <Breadcrumbs
          items={[
            {
              label: customerSafe
                ? "My complaints"
                : "Complaints",
              to: backTo,
            },
            {
              label: complaint.id,
            },
          ]}
        />
      </div>

      {/* -------------------------------------------------- */}
      {/* Complaint header */}
      {/* -------------------------------------------------- */}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[12px] text-ink-muted">
            {complaint.id}
          </p>

          <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-ink">
            {complaint.subject}
          </h1>

          <p className="mt-1 text-[13px] text-ink-muted">
            Submitted{" "}
            {formatDateTime(complaint.createdAt)}

            {isStaff && assigneeLabel
              ? ` · Assigned to ${assigneeLabel}`
              : ""}

            {complaint.reference
              ? ` · ${complaint.reference}`
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={complaint.status} />

          <span className="inline-flex items-center rounded border border-line px-1.5 py-px text-[11px] font-medium">
            <PriorityBadge
              priority={complaint.priority}
            />
          </span>

          <span
            className={cn(
              "inline-flex items-center rounded border px-1.5 py-px text-[11px] font-medium",
              complaint.escalated
                ? "border-danger-muted bg-danger-subtle text-danger"
                : "border-line text-ink-muted",
            )}
          >
            {complaint.escalated
              ? "Escalated"
              : "Not escalated"}
          </span>

          {isStaff && (
            <ValidationBadge
              state={complaint.validation}
            />
          )}
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* Main layout */}
      {/* -------------------------------------------------- */}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {/* ------------------------------------------------ */}
          {/* Complaint */}
          {/* ------------------------------------------------ */}

          <section className="panel p-4">
            <h2 className="text-[13px] font-semibold text-ink">
              Complaint
            </h2>

            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-secondary">
              {complaint.description}
            </p>

            <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-muted">
                  Product / service
                </dt>
                <dd>
                  {complaint.productService ?? <NotAvailable />}
                </dd>
              </div>

              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-muted">
                  Preferred channel
                </dt>
                <dd>
                  {complaint.contactChannel ?? (
                    <NotAvailable />
                  )}
                </dd>
              </div>

              {complaint.previousComplaintId && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-ink-muted">
                    Previous complaint
                  </dt>

                  <dd>
                    <Link
                      to={`/complaints/${complaint.previousComplaintId}`}
                      className="font-mono text-primary hover:underline"
                    >
                      {
                        complaint.previousComplaintId
                      }
                    </Link>
                  </dd>
                </div>
              )}
            </dl>

            {complaint.attachmentName && (
              <p className="mt-3 text-[12px] text-ink-muted">
                Attachment:{" "}
                {complaint.attachmentName}
              </p>
            )}
          </section>

          {/* ------------------------------------------------ */}
          {/* Customer view */}
          {/* ------------------------------------------------ */}

          {customerSafe ? (
            <>
              <section className="panel p-4">
                <h2 className="text-[13px] font-semibold text-ink">
                  Status
                </h2>

                <p className="mt-2 text-[13px] text-ink-secondary">
                  Current department:{" "}
                  <span className="font-medium text-ink">
                    {complaint.department}
                  </span>
                </p>

                <p className="mt-1 text-[13px] text-ink-secondary">
                  Latest update:{" "}
                  {complaint.latestUpdate ??
                    "Updated"}{" "}
                  ·{" "}
                  {formatRelative(
                    complaint.updatedAt,
                  )}
                </p>

                <p className="mt-1 text-[13px] text-ink-secondary">
                  Next step:{" "}
                  <span className="font-medium text-ink">
                    {complaint.nextAction ??
                      nextStep}
                  </span>
                </p>

                {complaint.customerResponse && (
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                      Latest message
                    </p>

                    <p className="mt-1 text-[13px] text-ink-secondary">
                      {
                        complaint.customerResponse
                      }
                    </p>
                  </div>
                )}
              </section>

              {complaint.followUp?.required && (
                <section className="panel p-4">
                  <h2 className="text-[13px] font-semibold text-ink">
                    Follow-up
                  </h2>

                  {complaint.followUp.type && (
                    <p className="mt-2 text-[13px] text-ink-secondary">
                      {complaint.followUp.type}
                    </p>
                  )}

                  {complaint.followUp.communication && (
                    <p className="mt-1 text-[13px] text-ink-muted">
                      {
                        complaint.followUp
                          .communication
                      }
                    </p>
                  )}
                </section>
              )}
            </>
          ) : (
            <>
              {/* ------------------------------------------------ */}
              {/* Staff intelligence */}
              {/* ------------------------------------------------ */}

              <section className="panel p-4">
                <h2 className="text-[13px] font-semibold text-ink">
                  Complaint intelligence
                </h2>

                <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
                  <Info
                    label="Primary issue"
                    value={
                      complaint.intelligence
                        ?.primaryIssue
                    }
                  />

                  <Info
                    label="Category"
                    value={complaint.category}
                  />

                  <Info
                    label="Subcategory"
                    value={complaint.subcategory}
                  />

                  <Info
                    label="Department"
                    value={complaint.department}
                  />

                  <Info
                    label="Product / service"
                    value={
                      complaint.productService
                    }
                  />

                  <Info
                    label="Entities"
                    value={
                      complaint.intelligence?.entities
                        .join(", ") || null
                    }
                  />
                </dl>

                <div className="mt-3 flex flex-wrap gap-4">
                  <SentimentBadge
                    sentiment={complaint.sentiment}
                  />

                  <UrgencyBadge
                    urgency={complaint.urgency}
                  />

                  <PriorityBadge
                    priority={complaint.priority}
                  />
                </div>
              </section>

              {complaint.intelligence ? (
                <AnalysisCard
                  intelligence={
                    complaint.intelligence
                  }
                />
              ) : (
                <section className="panel p-4">
                  <h2 className="text-[13px] font-semibold text-ink">
                    Complaint analysis
                  </h2>

                  <p className="mt-1 text-[13px] text-ink-muted">
                    {analysisError
                      ? analysisError
                      : analysisLoading
                        ? "Loading the stored analysis…"
                        : "No analysis is stored for this complaint."}
                  </p>
                </section>
              )}

              <PolicyReference
                policy={complaint.policy}
              />

              <ResolutionSteps
                plan={complaint.resolutionPlan}
              />

              <ValidationResult
                detail={
                  complaint.validationDetail
                }
              />

              {complaint.missingInfo && (
                <section className="panel p-4">
                  <h2 className="text-[13px] font-semibold text-ink">
                    Information needed
                  </h2>

                  <ul className="mt-2 list-disc pl-4 text-[13px] text-ink-secondary">
                    {complaint.missingInfo.items.map(
                      (item) => (
                        <li key={item}>
                          {item}
                        </li>
                      ),
                    )}
                  </ul>

                  <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                    Clarification questions
                  </p>

                  <ol className="mt-1 list-decimal pl-4 text-[13px] text-ink-secondary">
                    {complaint.missingInfo.questions.map(
                      (question) => (
                        <li key={question}>
                          {question}
                        </li>
                      ),
                    )}
                  </ol>
                </section>
              )}
            </>
          )}

          {/* ------------------------------------------------ */}
          {/* Workflow */}
          {/* ------------------------------------------------ */}

          <section className="panel p-4">
            <h2 className="text-[13px] font-semibold text-ink">
              Next steps
            </h2>

            <div className="mt-3">
              <WorkflowSteps
                status={complaint.status}
                escalated={complaint.escalated}
              />
            </div>
          </section>

          {/* ------------------------------------------------ */}
          {/* Awaiting Customer — the owner answers the       */}
          {/* agent's persisted customer-facing request.      */}
          {/* ------------------------------------------------ */}

          {isOwner &&
            (detail?.status ?? complaint.status) ===
              "Awaiting Customer" && (
              <section className="panel border-warning/40 p-4">
                <h2 className="text-[13px] font-semibold text-ink">
                  Support needs your input
                </h2>

                {detail?.customer_facing_request && (
                  <p className="mt-2 whitespace-pre-wrap rounded-md border border-line bg-surface-muted px-3 py-2 text-[13px] text-ink-secondary">
                    {detail.customer_facing_request}
                  </p>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();

                    const text = customerReply.trim();
                    if (!text) return;

                    void runAgentAction(
                      "Respond",
                      () =>
                        customerRespond(
                          complaint.id,
                          text,
                        ),
                    ).then((ok) => {
                      if (ok) {
                        setCustomerReply("");
                      }
                    });
                  }}
                  className="mt-3"
                >
                  <Textarea
                    label="Your response"
                    value={customerReply}
                    onChange={(e) =>
                      setCustomerReply(e.target.value)
                    }
                    rows={4}
                    placeholder="Provide the requested information…"
                    hint="Your response is added to the complaint and support continues working on it."
                  />

                  {actionError && (
                    <p className="mt-2 rounded-md border border-danger/30 bg-danger/5 px-2.5 py-1.5 text-[12px] text-danger">
                      {actionError}
                    </p>
                  )}

                  <div className="mt-2 flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={
                        !customerReply.trim() ||
                        Boolean(actionLoading)
                      }
                    >
                      {actionLoading === "Respond"
                        ? "Sending…"
                        : "Send response"}
                    </Button>
                  </div>
                </form>
              </section>
            )}

          {/* ------------------------------------------------ */}
          {/* Customer responses already on record            */}
          {/* ------------------------------------------------ */}

          {(detail?.customer_responses?.length ?? 0) >
            0 && (
            <section className="panel p-4">
              <h2 className="text-[13px] font-semibold text-ink">
                {isOwner
                  ? "Your responses"
                  : "Customer responses"}
              </h2>

              <ul className="mt-2 space-y-2">
                {detail?.customer_responses?.map(
                  (entry, index) => (
                    <li
                      key={`${entry.created_at ?? index}`}
                      className="rounded-md border border-line px-3 py-2 text-[13px] text-ink-secondary"
                    >
                      <p className="whitespace-pre-wrap">
                        {entry.message}
                      </p>
                      {entry.created_at && (
                        <p className="mt-1 text-[11px] text-ink-muted">
                          {formatDateTime(
                            entry.created_at,
                          )}
                        </p>
                      )}
                    </li>
                  ),
                )}
              </ul>
            </section>
          )}

          {/* ------------------------------------------------ */}
          {/* Resolution (persisted by the backend)           */}
          {/* ------------------------------------------------ */}

          {(detail?.resolution_comment ||
            complaint.resolution) && (
            <section className="panel p-4">
              <h2 className="text-[13px] font-semibold text-success">
                Resolution
              </h2>

              <p className="mt-2 whitespace-pre-wrap text-[13px] text-ink-secondary">
                {detail?.resolution_comment ??
                  complaint.resolution}
              </p>
            </section>
          )}

          {/* ------------------------------------------------ */}
          {/* Activity */}
          {/* ------------------------------------------------ */}

          <section className="panel p-4">
            <h2 className="mb-3 text-[13px] font-semibold text-ink">
              Activity
            </h2>

            {/*
              The timeline is reconstructed from the
              persistent complaint_activity collection.
              The backend filters customer-visible events
              for customers. Local session events are only
              a fallback when the activity API is
              unavailable.
            */}
            {backendActivity === null && (
              <p className="mb-2 rounded-md border border-line bg-surface-muted px-2.5 py-1.5 text-[12px] text-ink-muted">
                The activity history could not be loaded.
              </p>
            )}

            <Timeline events={timelineEvents} />

            {/*
              Comment form is Agent-only: the agent comment
              endpoint is the only backend-supported comment
              mutation on this page. Customers respond via
              the Awaiting Customer flow; reviewer comments
              live in Manual Review.
            */}
            {isAgent && (
              <form
                onSubmit={onReply}
                className="mt-4 border-t border-line pt-4"
              >
                <Textarea
                  label="Internal comment"
                  value={reply}
                  onChange={(e) =>
                    setReply(e.target.value)
                  }
                  rows={4}
                  className="min-h-[96px]"
                  placeholder="Leave an internal comment on this complaint…"
                  hint="Stored on the complaint. Not visible to the customer."
                />

                {actionError && (
                  <p className="mt-2 rounded-md border border-danger/30 bg-danger/5 px-2.5 py-1.5 text-[12px] text-danger">
                    {actionError}
                  </p>
                )}

                <div className="mt-2 flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      !reply.trim() ||
                      Boolean(actionLoading)
                    }
                  >
                    {actionLoading === "Comment"
                      ? "Sending…"
                      : "Add comment"}
                  </Button>
                </div>
              </form>
            )}
          </section>
        </div>

        {/* -------------------------------------------------- */}
        {/* Sidebar */}
        {/* -------------------------------------------------- */}

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          {/* ------------------------------------------------ */}
          {/* Customer */}
          {/* ------------------------------------------------ */}


          <section className="panel p-4">
            <h2 className="mb-3 text-[13px] font-semibold text-ink">
              Customer
            </h2>

            <div className="flex items-start gap-3">
              <Avatar
                name={
                  customer?.name ?? "Customer"
                }
              />

              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">
                  {customer?.name ?? "Unknown"}
                </p>

                {customer?.company && (
                  <p className="text-[12px] text-ink-muted">
                    {customer.phone}
                  </p>
                )}

                {customer?.reference && (
                  <p className="font-mono text-[11px] text-ink-faint">
                    {customer.reference}
                  </p>
                )}

                <p className="text-[12px] text-ink-muted">
                  {customer?.customerType ??
                    complaint.customerType ??
                    "Customer"}
                </p>
              </div>
            </div>

            {isStaff && (
              <ul className="mt-3 space-y-1.5 text-[13px] text-ink-secondary">
                {customer?.email && (
                  <li className="flex items-center gap-2">
                    <Mail
                      size={13}
                      className="text-ink-faint"
                    />

                    <a
                      className="truncate text-primary hover:underline"
                      href={`mailto:${customer.email}?subject=SupportNova complaint ${complaint.id}`}
                    >
                      {customer.email}
                    </a>
                  </li>
                )}

                {customer?.phone && (
                  <li className="flex items-center gap-2">
                    <Phone
                      size={13}
                      className="text-ink-faint"
                    />

                    <span>
                      {customer.phone}
                    </span>
                  </li>
                )}

                <li className="flex items-center gap-2">
                  <UserRound
                    size={13}
                    className="text-ink-faint"
                  />

                  {customer?.openComplaints === undefined ? (
                    <NotAvailable label="Open complaints not available" />
                  ) : (
                    `${customer.openComplaints} open`
                  )}
                </li>
              </ul>
            )}
          </section>


          {/* ------------------------------------------------ */}
          {/* Staff controls */}
          {/* ------------------------------------------------ */}

          {isStaff && (
            <>
              <EscalationPanel
                assessment={
                  complaint.escalationAssessment
                }
                followUp={complaint.followUp}
              />

              <section className="panel p-4">
                <h2 className="mb-3 text-[13px] font-semibold text-ink">
                  Properties
                </h2>

                <dl className="space-y-2 text-[13px]">
                  <Row
                    label="Department"
                    value={complaint.department}
                    icon={
                      <Building2 size={13} />
                    }
                  />

                  <Row
                    label="Updated"
                    value={formatRelative(
                      complaint.updatedAt,
                    )}
                  />

                  <Row
                    label="Assignee"
                    value={assigneeLabel ?? "Not assigned"}
                  />

                  {complaint.slaRisk && (
                    <Row
                      label="SLA"
                      value="At risk"
                    />
                  )}
                </dl>

                {/*
                  Workflow controls are shown only to the
                  Agent role: every control here maps to a
                  real backend endpoint that enforces the
                  assigned-agent check. Reviewer actions
                  live in Manual Review; Manager/Admin
                  intervention on escalated complaints is
                  enforced by the backend, not this panel.
                */}
                {isAgent && (
                <div className="mt-4 space-y-3 border-t border-line pt-3">
                  <Select
                    label="Status"
                    value={complaint.status}
                    options={AGENT_TRANSITIONS.map(
                      (status) => ({
                        value: status,
                        label: status,
                      }),
                    )}
                    disabled={Boolean(actionLoading)}
                    onChange={(e) => {
                      const next =
                        e.target.value as ComplaintStatus;

                      if (
                        next === "Resolved" ||
                        next === "Closed"
                      ) {
                        setResolveOpen(true);
                        return;
                      }

                      if (isAgent) {
                        /*
                         * Route agent transitions through
                         * the real backend endpoints.
                         */
                        if (next === "In Progress") {
                          void runAgentAction(
                            "Start handling",
                            () =>
                              agentStart(complaint.id),
                          );
                          return;
                        }

                        if (
                          next === "Awaiting Customer"
                        ) {
                          setCommentAction(
                            "await-customer",
                          );
                          return;
                        }

                        if (next === "Escalated") {
                          setCommentAction("escalate");
                          return;
                        }

                        setActionError(
                          `Agents cannot set the "${next}" status. Supported transitions: In Progress, Awaiting Customer, Escalated, Resolved.`,
                        );
                        return;
                      }
                    }}
                  />

                  {!complaint.escalated && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={Boolean(actionLoading)}
                      onClick={() =>
                        setCommentAction("escalate")
                      }
                    >
                      {actionLoading === "Escalate"
                        ? "Escalating…"
                        : "Escalate"}
                    </Button>
                  )}

                  {complaint.status !==
                    "Resolved" &&
                    complaint.status !==
                      "Closed" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        disabled={Boolean(actionLoading)}
                        onClick={() =>
                          setResolveOpen(true)
                        }
                      >
                        Resolve
                      </Button>
                    )}

                  {actionError && (
                    <p className="rounded-md border border-danger/30 bg-danger/5 px-2.5 py-1.5 text-[12px] text-danger">
                      {actionError}
                    </p>
                  )}
                </div>
                )}

                {isManagement &&
  complaint.status === "Escalated" && (
    <div className="mt-4 space-y-3 border-t border-line pt-3">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Management override
        </p>

        <p className="mt-1 text-[12px] text-ink-muted">
          This complaint is escalated and can be updated by
          Management or Administration.
        </p>
      </div>

      <Select
        label="Override status"
        value=""
        options={[
          {
            value: "",
            label: "Select new status",
          },
          ...MANAGEMENT_TRANSITIONS.map(
            (status) => ({
              value: status,
              label: status,
            }),
          ),
        ]}
        disabled={Boolean(actionLoading)}
        onChange={(e) => {
          const next = e.target.value;

          if (!next) return;

          void runManagementStatusChange(
            next as ComplaintStatus,
          );
        }}
      />

      {actionError && (
        <p className="rounded-md border border-danger/30 bg-danger/5 px-2.5 py-1.5 text-[12px] text-danger">
          {actionError}
        </p>
      )}

      {actionLoading?.startsWith(
        "Management:",
      ) && (
        <p className="text-[12px] text-ink-muted">
          Updating complaint…
        </p>
      )}
    </div>
  )}
              </section>
            </>
          )}

          {/* ------------------------------------------------ */}
          {/* Related complaints */}
          {/* ------------------------------------------------ */}

          {related.length > 0 && (
            <section className="panel p-4">
              <h2 className="mb-2 text-[13px] font-semibold text-ink">
                Other complaints from this
                customer
              </h2>

              <ul className="space-y-2">
                {related.map((relatedComplaint) => (
                  <li
                    key={relatedComplaint.id}
                  >
                    <Link
                      to={`/complaints/${relatedComplaint.id}`}
                      className="block text-[13px] hover:text-primary"
                    >
                      <span className="font-mono text-[11px] text-ink-muted">
                        {relatedComplaint.id}
                      </span>

                      <span className="mt-0.5 block truncate text-ink">
                        {
                          relatedComplaint.subject
                        }
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {/* ---------------------------------------------------- */}
      {/* Resolve modal */}
      {/* ---------------------------------------------------- */}

      <Modal
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
        title="Resolve complaint"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() =>
                setResolveOpen(false)
              }
            >
              Cancel
            </Button>

            <Button
              disabled={
                resolution.trim().length < 8 ||
                Boolean(actionLoading)
              }
              onClick={() => {
                const text = resolution.trim();

                /*
                 * Resolve through the real backend
                 * endpoint only. The backend persists the
                 * resolution, records the activity, and
                 * finalizes the complaint to Closed. The
                 * refreshed state comes back from the
                 * database — no local status mutation.
                 */
                void runAgentAction(
                  "Resolve",
                  () =>
                    agentResolve(
                      complaint.id,
                      text,
                    ),
                ).then((ok) => {
                  if (ok) {
                    setResolveOpen(false);
                    setResolution("");
                  }
                });
              }}
            >
              {actionLoading === "Resolve"
                ? "Resolving…"
                : "Mark resolved"}
            </Button>
          </>
        }
      >
        <Textarea
          label="Resolution notes"
          value={resolution}
          onChange={(e) =>
            setResolution(e.target.value)
          }
          hint="Visible on the complaint. Describe what was done."
          rows={5}
        />
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* Agent action comment modal                            */}
      {/* (escalate / awaiting customer need a comment)         */}
      {/* ---------------------------------------------------- */}

      <Modal
        open={commentAction !== null}
        onClose={() => {
          setCommentAction(null);
          setActionComment("");
        }}
        title={
          commentAction === "escalate"
            ? "Escalate complaint"
            : "Set awaiting customer"
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setCommentAction(null);
                setActionComment("");
              }}
            >
              Cancel
            </Button>

            <Button
              disabled={
                !actionComment.trim() ||
                Boolean(actionLoading)
              }
              onClick={() => {
                const text = actionComment.trim();
                const mode = commentAction;

                if (!mode) return;

                void runAgentAction(
                  mode === "escalate"
                    ? "Escalate"
                    : "Await customer",
                  () =>
                    mode === "escalate"
                      ? agentEscalate(
                          complaint.id,
                          text,
                        )
                      : agentAwait(
                          complaint.id,
                          text,
                        ),
                ).then((ok) => {
                  if (ok) {
                    setCommentAction(null);
                    setActionComment("");
                  }
                });
              }}
            >
              {actionLoading
                ? "Submitting…"
                : commentAction === "escalate"
                  ? "Escalate"
                  : "Confirm"}
            </Button>
          </>
        }
      >
        <Textarea
          label="Comment"
          value={actionComment}
          onChange={(e) =>
            setActionComment(e.target.value)
          }
          hint="Required. The backend records this comment in the audit log."
          rows={4}
        />
      </Modal>
    </div>
  );
}

/* ========================================================= */
/* Helpers                                                   */
/* ========================================================= */

function Info({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const present = Boolean(value && value.trim());

  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-muted">
        {label}
      </dt>

      <dd className="mt-0.5 font-medium text-ink">
        {present ? value : <NotAvailable />}
      </dd>
    </div>
  );
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: ReactNode;
}) {
  const present = Boolean(value && value.trim());

  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-ink-muted">
        {label}
      </dt>

      <dd className="flex items-center gap-1.5 text-right font-medium text-ink">
        {present && icon}
        {present ? value : <NotAvailable />}
      </dd>
    </div>
  );
}