import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  createComplaint,
  getComplaints,
  getComplaintAnalysis,
} from "@/api/complaints";

/*
 * Help-centre article content is static editorial content that
 * ships with the product. No OPERATIONAL data (complaints,
 * customers, routing rules, notifications, policy documents) is
 * seeded from mock data any more: every operational surface now
 * reads the backend, or shows an honest empty state when the
 * backend has no endpoint for it yet.
 */
import { articles as seedArticles } from "@/data/mockData";

import { useAuth } from "@/auth/AuthContext";

import type {
  Complaint,
  ComplaintDraft,
  ComplaintStatus,
  Customer,
  EscalationAssessment,
  KnowledgeArticle,
  NotificationItem,
  Priority,
  Sentiment,
  TimelineEvent,
} from "@/types";

interface DataContextValue {
  complaints: Complaint[];

  /**
   * Customer directory.
   *
   * The API exposes user records only to Admin
   * (GET /api/admin/users), so there is no customer directory
   * available to the other roles. It stays empty rather than
   * being filled with sample people.
   */
  customers: Customer[];

  articles: KnowledgeArticle[];

  /**
   * Session notifications.
   *
   * Generated from actions the signed-in user actually performed
   * in this session. The backend has no notification store, so
   * nothing is pre-populated and nothing survives a reload.
   */
  notifications: NotificationItem[];

  loadingComplaints: boolean;
  complaintError: string | null;

  addComplaint: (draft: ComplaintDraft) => Promise<Complaint>;

  refreshComplaints: () => Promise<void>;

  getComplaint: (id: string) => Complaint | undefined;

  getComplaintAnalysis: (id: string) => Promise<unknown>;

  updateComplaint: (
    id: string,
    patch: Partial<Complaint>,
    event?: Omit<TimelineEvent, "id" | "timestamp">,
  ) => void;

  addComment: (
    id: string,
    body: string,
    internal?: boolean,
  ) => void;

  setStatus: (
    id: string,
    status: ComplaintStatus,
    resolution?: string,
  ) => void;

  setPriority: (
    id: string,
    priority: Priority,
  ) => void;

  assignTo: (
    id: string,
    assigneeId: string,
    assigneeName: string,
  ) => void;

  markNotificationRead: (id: string) => void;

  markAllNotificationsRead: () => void;

  getCustomer: (id: string) => Customer | undefined;
}

const DataContext = createContext<DataContextValue | null>(null);

/* =========================================================
   HELPERS
   ========================================================= */

/**
 * Backend label -> frontend union.
 *
 * Every mapper returns `null` when the backend produced nothing.
 * A missing value is never replaced with a default: "Neutral",
 * "P3" or "Low" would be invented analysis output.
 */
function mapSentiment(
  label?: string | null,
): Sentiment | null {
  switch (label?.trim().toLowerCase()) {
    case "positive":
      return "Positive";

    case "strongly negative":
      return "Strongly Negative";

    case "negative":
      return "Negative";

    case "neutral":
      return "Neutral";

    default:
      return null;
  }
}

function mapPriority(
  level?: string | null,
): Priority | null {
  switch (level?.trim().toLowerCase()) {
    case "p0":
    case "critical":
      return "P0";

    case "p1":
    case "high":
      return "P1";

    case "p2":
    case "medium":
      return "P2";

    case "p3":
    case "low":
      return "P3";

    default:
      return null;
  }
}

function mapStatus(status?: string | null): ComplaintStatus {
  const allowed: ComplaintStatus[] = [
    "New",
    "Analyzed",
    "Assigned",
    "In Progress",
    "Awaiting Customer",
    "Escalated",
    "Resolved",
    "Closed",
    "Reopened",
    "Manual Review",
  ];

  if (
    status &&
    allowed.includes(status as ComplaintStatus)
  ) {
    return status as ComplaintStatus;
  }

  return "New";
}

function mapEscalationLevel(
  level?: string | null,
): EscalationAssessment["level"] {
  const value = level?.trim().toLowerCase();

  switch (value) {
    case "critical":
    case "critical management escalation":
      return "Critical Management Escalation";

    case "high":
    case "supervisor review":
      return "Supervisor Review";

    case "medium":
    case "department manager":
      return "Department Manager";

    case "low":
    case "specialist team":
      return "Specialist Team";

    case "compliance review":
      return "Compliance Review";

    case "none":
    case "no escalation":
      return "No Escalation";

    default:
      return null;
  }
}

/* =========================================================
   BACKEND COMPLAINT

   Mirrors the payload of GET /api/complaints. Analysis-derived
   fields (category, subcategory, sentiment, escalation) are
   merged in by the API from the `analyses` collection and are
   absent when a complaint has never been analyzed.
   ========================================================= */

interface BackendComplaint {
  id: string;
  title: string;
  description: string;
  user_id?: string | null;
  order_id?: string | null;
  transaction_id?: string | null;
  product?: string | null;
  amount?: string | null;
  date?: string | null;

  customer_id?: string | null;

  assigned_to?: string | null;
  assigned_department?: string | null;

  status?: string | null;

  manual_review_required?: boolean;
  review_status?: string | null;
  reviewer_id?: string | null;

  /* Persisted rule-engine output. */
  priority?: string | null;
  sla_due_at?: string | null;

  /* Merged from the stored analysis document. */
  category?: string | null;
  subcategory?: string | null;
  sentiment?: string | null;
  escalation_required?: boolean | null;
  escalation_level?: string | null;
  analysis_available?: boolean;

  created_at: string;
  updated_at?: string | null;

  resolved_at?: string | null;
  closed_at?: string | null;
}

/* =========================================================
   MAP BACKEND -> FRONTEND

   Rule for this function: every field is either a value the
   backend actually returned, or `null`. Nothing is derived from
   a guess, and no placeholder sentence is written into a field
   that is meant to hold analysis output. Screens render
   "Not available" for `null`.
   ========================================================= */

function mapBackendComplaint(
  item: BackendComplaint,
): Complaint {
  const createdAt = item.created_at;
  const updatedAt = item.updated_at ?? createdAt;

  const status = mapStatus(item.status);

  const escalated =
    item.escalation_required === true ||
    status === "Escalated";

  return {
    id: item.id,

    subject: item.title,

    description: item.description,

    customerId: item.user_id || "",

    category: item.category ?? null,

    subcategory: item.subcategory ?? null,

    department: item.assigned_department ?? null,

    productService: item.product ?? null,

    priority: mapPriority(item.priority),

    /*
     * `urgency` is not persisted on the complaint document and is
     * not returned by the list endpoint, so the list view has no
     * urgency to show.
     */
    urgency: null,

    sentiment: mapSentiment(item.sentiment),

    status,

    escalated,

    /*
     * The only validation signal the list endpoint carries is
     * whether the workflow flagged the complaint for manual
     * review. Anything else is unknown here.
     */
    validation: item.manual_review_required
      ? "Manual Review Required"
      : null,

    assigneeId: item.assigned_to ?? undefined,

    createdAt,

    updatedAt,

    reference: item.order_id ?? undefined,

    /*
     * The list endpoint intentionally returns no analysis body,
     * no ground-truth validation detail and no activity history.
     * ComplaintDetail loads those from
     * GET /api/complaints/{id}/analysis and
     * GET /api/complaints/{id}/activity.
     */
    intelligence: null,

    validationDetail: null,

    escalationAssessment: escalated
      ? {
          required: true,
          level: mapEscalationLevel(
            item.escalation_level,
          ),
          reason: "",
          validation: null,
        }
      : null,

    timeline: [],
  };
}

/* =========================================================
   PROVIDER
   ========================================================= */

export function DataProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();

  const [complaints, setComplaints] =
    useState<Complaint[]>([]);

  const [customers] =
    useState<Customer[]>([]);

  const [notifications, setNotifications] =
    useState<NotificationItem[]>([]);

  const [loadingComplaints, setLoadingComplaints] =
    useState(false);

  const [complaintError, setComplaintError] =
    useState<string | null>(null);

  const articles = seedArticles;

  /* =======================================================
     LOAD COMPLAINTS
     ======================================================= */

  const refreshComplaints = useCallback(
    async () => {
      if (!user) {
        setComplaints([]);
        return;
      }

      setLoadingComplaints(true);
      setComplaintError(null);

      try {
        const response = await getComplaints();

        const data = Array.isArray(response)
          ? response
          : response?.complaints ?? [];

        const mapped = data.map(
          (item: BackendComplaint) =>
            mapBackendComplaint(item),
        );

        setComplaints(mapped);
      } catch (error: any) {
        console.error(
          "Failed to load complaints:",
          error,
        );

        const message =
          error?.response?.data?.detail ??
          "Unable to load complaints.";

        setComplaintError(message);
      } finally {
        setLoadingComplaints(false);
      }
    },
    [user],
  );

  useEffect(() => {
    refreshComplaints();
  }, [refreshComplaints]);

  /* =======================================================
     GET COMPLAINT
     ======================================================= */

  const getComplaint = useCallback(
    (id: string) => {
      return complaints.find(
        (complaint) =>
          complaint.id === id,
      );
    },
    [complaints],
  );

  /* =======================================================
     GET FULL BACKEND ANALYSIS
     ======================================================= */

  const getAnalysis = useCallback(
    async (id: string) => {
      return getComplaintAnalysis(id);
    },
    [],
  );

  /* =======================================================
     CREATE COMPLAINT
     ======================================================= */

  const addComplaint = useCallback(
    async (
      draft: ComplaintDraft,
    ): Promise<Complaint> => {
      if (!user) {
        throw new Error(
          "You must be logged in to submit a complaint.",
        );
      }

      if (user.role !== "Customer") {
        throw new Error(
          "Only customers can submit complaints.",
        );
      }

      const result =
        await createComplaint(draft);

      const escalation =
        result.escalation;

      /*
       * Priority, urgency and sentiment come from the analysis
       * the backend just produced. When the analysis did not
       * produce them they stay null rather than defaulting.
       */
      const priority =
        mapPriority(result.priority);

      /*
       * The analysis payload carries no urgency field, so there
       * is nothing honest to show for it.
       */
      const urgency = null;

      const sentiment =
        mapSentiment(
          result.sentiment?.label,
        );

      /*
       * The backend returns the PERSISTED workflow status
       * after routing (Manual Review / Escalated /
       * Assigned / Analyzed). Never guess it locally —
       * the database is the source of truth.
       */
      const status: ComplaintStatus = mapStatus(
        result.workflow?.status,
      );

      const now =
        new Date().toISOString();

      const product =
        result.entities?.product ||
        draft.productService?.trim() ||
        null;

      const department =
        result.routing?.primary_department ||
        result.classification?.department ||
        null;

      const created: Complaint = {
        id: result.complaint.id,

        subject:
          result.complaint.title,

        description:
          result.complaint.description,

        customerId: user.id,

        category:
          result.classification?.category || null,

        subcategory:
          result.classification?.subcategory || null,

        department,

        productService: product,

        priority,

        urgency,

        sentiment,

        status,

        escalated:
          escalation?.required ??
          false,

        validation:
          result.manual_review_required
            ? "Manual Review Required"
            : null,

        createdAt: now,

        updatedAt: now,

        reference:
          result.entities?.order_id ??
          draft.reference?.trim() ??
          undefined,

        contactChannel:
          draft.contactChannel,

        customerType:
          draft.customerType,

        previousComplaintId:
          draft.previousComplaintId
            ?.trim() || undefined,

        attachmentName:
          draft.attachmentName,

        intelligence: {
          summary:
            result.resolution
              ?.explanation ?? "",

          primaryIssue:
            result.complaint.title,

          secondaryIssues: [],

          category:
            result.classification?.category || null,

          subcategory:
            result.classification?.subcategory || null,

          sentiment,

          urgency,

          priority,

          productService: product,

          entities: [
            result.entities?.order_id
              ? `Order: ${result.entities.order_id}`
              : "",

            result.entities
              ?.transaction_id
              ? `Transaction: ${result.entities.transaction_id}`
              : "",

            result.entities?.product
              ? `Product: ${result.entities.product}`
              : "",

            result.entities?.amount
              ? `Amount: ${result.entities.amount}`
              : "",

            result.entities?.date
              ? `Date: ${result.entities.date}`
              : "",
          ].filter(Boolean),

          department,

          escalation:
            escalation?.required ??
            false,

          reason:
            escalation?.reason ??
            "",

          recommendation:
            result.resolution
              ?.steps?.join(" ") ??
            "",

          agentGuidance:
            result.agent_guidance
              ? [result.agent_guidance]
              : [],

          clarificationQuestions:
            result.clarification_questions ??
            [],

          generatedResponse:
            result.customer_response ??
            undefined,
        },

        validationDetail: {
          overall:
            result.manual_review_required
              ? "Manual Review Required"
              : null,

          fields: [],

          policyValidated:
            Boolean(
              result.policies?.length,
            ),

          resolutionValidated:
            Boolean(
              result.resolution,
            ),
        },

        escalationAssessment: escalation
          ? {
              required:
                escalation.required ?? false,

              level:
                mapEscalationLevel(
                  escalation.level,
                ),

              reason:
                escalation.reason ?? "",

              validation: null,
            }
          : null,

        missingInfo:
          result.clarification_questions
            ?.length
            ? {
                items:
                  result.clarification_questions,

                questions:
                  result.clarification_questions,
              }
            : undefined,

        customerResponse:
          result.customer_response ??
          undefined,

        /*
         * The current frontend FollowUp type does not
         * contain the backend "message" field.
         *
         * Full follow-up information is still available
         * from GET /api/complaints/{id}/analysis.
         */
        followUp:
          undefined,

        timeline: [
          {
            id: `${result.complaint.id}-submitted`,

            timestamp: now,

            type: "submitted",

            title:
              "Complaint submitted and analyzed",

            actor: user.name,

            actorRole: user.role,
          },
        ],
      };

      setComplaints(
        (previous) => [
          created,
          ...previous.filter(
            (item) =>
              item.id !== created.id,
          ),
        ],
      );

      setNotifications(
        (previous) => [
          {
            id: `n-${Date.now()}`,

            title:
              `Complaint ${created.id}`,

            body:
              `${created.subject} · ${created.status}`,

            timestamp:
              created.createdAt,

            read: false,

            href:
              `/complaints/${created.id}`,
          },

          ...previous,
        ],
      );

      /*
       * Re-sync the list from the backend so the local
       * entry is replaced with the persisted record
       * (status, department, assignment).
       */
      void refreshComplaints();

      return created;
    },
    [user, refreshComplaints],
  );

  /* =======================================================
     LOCAL UPDATE
     ======================================================= */

  const updateComplaint = useCallback(
    (
      id: string,
      patch: Partial<Complaint>,
      event?: Omit<
        TimelineEvent,
        "id" | "timestamp"
      >,
    ) => {
      setComplaints(
        (previous) =>
          previous.map(
            (complaint) => {
              if (
                complaint.id !== id
              ) {
                return complaint;
              }

              const now =
                new Date().toISOString();

              const updated = {
                ...complaint,
                ...patch,
                updatedAt: now,
              };

              if (event) {
                updated.timeline = [
                  ...complaint.timeline,
                  {
                    ...event,
                    id: `${id}-${Date.now()}`,
                    timestamp: now,
                  },
                ];
              }

              return updated;
            },
          ),
      );
    },
    [],
  );

  /* =======================================================
     COMMENT
     ======================================================= */

  const addComment = useCallback(
    (
      id: string,
      body: string,
      internal = false,
    ) => {
      if (!user) return;

      updateComplaint(
        id,
        {},
        {
          type: internal
            ? "note"
            : "comment",

          title: internal
            ? "Internal note added"
            : "Comment added",

          description: body,

          actor: user.name,

          actorRole: user.role,
        },
      );

    },
    [user, updateComplaint],
  );

  /* =======================================================
     STATUS
     ======================================================= */

  const setStatus = useCallback(
    (
      id: string,
      status: ComplaintStatus,
      resolution?: string,
    ) => {
      if (!user) return;

      const patch: Partial<Complaint> = {
        status,
      };

      if (status === "Escalated") {
        patch.escalated = true;
      }

      if (resolution) {
        patch.resolution =
          resolution;
      }

      let type: TimelineEvent["type"] =
        "status";

      if (status === "Escalated") {
        type = "escalated";
      } else if (status === "Resolved") {
        type = "resolved";
      } else if (status === "Closed") {
        type = "closed";
      }

      updateComplaint(
        id,
        patch,
        {
          type,

          title:
            `Status changed to ${status}`,

          description:
            resolution,

          actor: user.name,

          actorRole: user.role,
        },
      );

    },
    [user, updateComplaint],
  );

  /* =======================================================
     PRIORITY
     ======================================================= */

  const setPriority = useCallback(
    (
      id: string,
      priority: Priority,
    ) => {
      if (!user) return;

      updateComplaint(
        id,
        { priority },
        {
          type: "status",

          title:
            `Priority set to ${priority}`,

          actor: user.name,

          actorRole: user.role,
        },
      );

    },
    [user, updateComplaint],
  );

  /* =======================================================
     ASSIGNMENT
     ======================================================= */

  const assignTo = useCallback(
    (
      id: string,
      assigneeId: string,
      assigneeName: string,
    ) => {
      if (!user) return;

      updateComplaint(
        id,
        { assigneeId },
        {
          type: "assigned",

          title:
            `Assigned to ${assigneeName}`,

          actor: user.name,

          actorRole: user.role,
        },
      );

    },
    [user, updateComplaint],
  );

  /* =======================================================
     NOTIFICATIONS
     ======================================================= */

  const markNotificationRead =
    useCallback((id: string) => {
      setNotifications(
        (previous) =>
          previous.map(
            (notification) =>
              notification.id === id
                ? {
                    ...notification,
                    read: true,
                  }
                : notification,
          ),
      );
    }, []);

  const markAllNotificationsRead =
    useCallback(() => {
      setNotifications(
        (previous) =>
          previous.map(
            (notification) => ({
              ...notification,
              read: true,
            }),
          ),
      );
    }, []);

  /* =======================================================
     CUSTOMER
     ======================================================= */

  const getCustomer = useCallback(
    (id: string) =>
      customers.find(
        (customer) =>
          customer.id === id,
      ),
    [customers],
  );

  /* =======================================================
     CONTEXT
     ======================================================= */

  const value = useMemo<DataContextValue>(
    () => ({
      complaints,

      customers,

      articles,

      notifications,

      loadingComplaints,

      complaintError,

      addComplaint,

      refreshComplaints,

      getComplaint,

      getComplaintAnalysis:
        getAnalysis,

      updateComplaint,

      addComment,

      setStatus,

      setPriority,

      assignTo,

      markNotificationRead,

      markAllNotificationsRead,

      getCustomer,
    }),
    [
      complaints,
      customers,
      articles,
      notifications,
      loadingComplaints,
      complaintError,
      addComplaint,
      refreshComplaints,
      getComplaint,
      getAnalysis,
      updateComplaint,
      addComment,
      setStatus,
      setPriority,
      assignTo,
      markNotificationRead,
      markAllNotificationsRead,
      getCustomer,
    ],
  );

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

/* =========================================================
   HOOK
   ========================================================= */

export function useData() {
  const context =
    useContext(DataContext);

  if (!context) {
    throw new Error(
      "useData must be used within DataProvider",
    );
  }

  return context;
}