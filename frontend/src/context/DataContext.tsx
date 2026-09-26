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

import {
  articles as seedArticles,
  auditLogs as seedLogs,
  customers as seedCustomers,
  documents,
  notifications as seedNotes,
  reports,
  rules as seedRules,
} from "@/data/mockData";

import { useAuth } from "@/auth/AuthContext";

import type {
  AuditLog,
  Complaint,
  ComplaintDraft,
  ComplaintStatus,
  Customer,
  EscalationAssessment,
  KnowledgeArticle,
  NotificationItem,
  PolicyDocument,
  Priority,
  ReportDefinition,
  RoutingRule,
  Sentiment,
  TimelineEvent,
  Urgency,
} from "@/types";

interface DataContextValue {
  complaints: Complaint[];
  customers: Customer[];
  articles: KnowledgeArticle[];
  rules: RoutingRule[];
  documents: PolicyDocument[];
  reports: ReportDefinition[];
  auditLogs: AuditLog[];
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

  toggleRule: (id: string) => void;

  markNotificationRead: (id: string) => void;

  markAllNotificationsRead: () => void;

  getCustomer: (id: string) => Customer | undefined;
}

const DataContext = createContext<DataContextValue | null>(null);

/* =========================================================
   HELPERS
   ========================================================= */

function mapSentiment(label?: string): Sentiment {
  switch (label?.trim().toLowerCase()) {
    case "positive":
      return "Positive";

    case "strongly negative":
      return "Strongly Negative";

    case "negative":
      return "Negative";

    default:
      return "Neutral";
  }
}

function mapPriority(level?: string): Priority {
  switch (level?.trim().toLowerCase()) {
    case "critical":
      return "P0";

    case "high":
      return "P1";

    case "medium":
      return "P2";

    default:
      return "P3";
  }
}

function mapUrgency(level?: string): Urgency {
  switch (level?.trim().toLowerCase()) {
    case "critical":
      return "Critical";

    case "high":
      return "High";

    case "medium":
      return "Medium";

    default:
      return "Low";
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
  level?: string,
): EscalationAssessment["level"] {
  switch (level?.trim().toLowerCase()) {
    case "critical":
      return "Critical Management Escalation";

    case "high":
      return "Supervisor Review";

    case "medium":
      return "Department Manager";

    case "low":
      return "Specialist Team";

    default:
      return "No Escalation";
  }
}

/* =========================================================
   BACKEND COMPLAINT
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

  created_at: string;
  updated_at?: string | null;

  resolved_at?: string | null;
  closed_at?: string | null;
}

/* =========================================================
   MAP BACKEND → FRONTEND
   ========================================================= */

function mapBackendComplaint(
  item: BackendComplaint,
): Complaint {
  const createdAt = item.created_at;
  const updatedAt = item.updated_at ?? createdAt;

  const status = mapStatus(item.status);

  const priority = mapPriority(
    item.manual_review_required
      ? "critical"
      : undefined,
  );

  const urgency = mapUrgency(
    item.manual_review_required
      ? "critical"
      : undefined,
  );

  const product =
    item.product ?? "Unspecified";

  const department =
    item.assigned_department ??
    "Unassigned";

  const escalated =
    status === "Escalated" ||
    item.manual_review_required === true;

  return {
    id: item.id,

    subject: item.title,

    description: item.description,


    customerId: item.user_id || "unknown",

    category: "Analysis available in complaint details",

    subcategory: "Analysis available in complaint details",

    department,

    productService: product,

    priority,

    urgency,

    sentiment: "Neutral",

    status,

    escalated,

    validation: item.manual_review_required
      ? "Manual Review Required"
      : "Pending",

    assigneeId:
      item.assigned_to ?? undefined,

    createdAt,

    updatedAt,

    reference:
      item.order_id ?? undefined,

    intelligence: {
      summary:
        "Open this complaint to view its complete SupportNova intelligence analysis.",

      primaryIssue: item.title,

      secondaryIssues: [],

      category:
        "Open complaint analysis",

      subcategory:
        "Open complaint analysis",

      sentiment: "Neutral",

      urgency,

      priority,

      productService: product,

      entities: [
        item.order_id
          ? `Order: ${item.order_id}`
          : "",

        item.transaction_id
          ? `Transaction: ${item.transaction_id}`
          : "",

        item.product
          ? `Product: ${item.product}`
          : "",

        item.amount
          ? `Amount: ${item.amount}`
          : "",

        item.date
          ? `Date: ${item.date}`
          : "",
      ].filter(Boolean),

      department,

      escalation: escalated,

      reason: item.manual_review_required
        ? "Manual review is required."
        : "",

      recommendation:
        "Open the complaint to view classification, policy, resolution, escalation and agent guidance.",

      agentGuidance: [],

      clarificationQuestions: [],
    },

    validationDetail: {
      overall: item.manual_review_required
        ? "Manual Review Required"
        : "Pending",

      fields: [],

      policyValidated: false,

      resolutionValidated: false,
    },

    escalationAssessment: {
      required: escalated,

      level: escalated
        ? "Supervisor Review"
        : "No Escalation",

      reason: item.manual_review_required
        ? "Manual review is required."
        : "",

      validation: "Pending",
    },

    timeline: [
      {
        id: `${item.id}-created`,
        timestamp: createdAt,
        type: "submitted",
        title: "Complaint submitted",
        actor: "System",
        actorRole: "System",
      },
    ],
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
    useState<Customer[]>(seedCustomers);

  const [rules, setRules] =
    useState<RoutingRule[]>(seedRules);

  const [auditLogs, setAuditLogs] =
    useState<AuditLog[]>(seedLogs);

  const [notifications, setNotifications] =
    useState<NotificationItem[]>(seedNotes);

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
     LOCAL AUDIT
     ======================================================= */

  const log = useCallback(
    (
      action: string,
      resource: string,
      details: string,
      result: AuditLog["result"] = "Success",
    ) => {
      const entry: AuditLog = {
        id: `a-${Date.now()}`,

        timestamp:
          new Date().toISOString(),

        user:
          user?.name ?? "System",

        action,

        resource,

        result,

        details,
      };

      setAuditLogs(
        (previous) => [
          entry,
          ...previous,
        ],
      );
    },
    [user],
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

      const severity =
        escalation?.level;

      const priority =
        mapPriority(severity);

      const urgency =
        mapUrgency(severity);

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
        result.entities?.product ??
        draft.productService?.trim() ??
        "Unspecified";

      const department =
        result.routing?.primary_department ??
        result.classification
          ?.department ??
        "Unassigned";

      const created: Complaint = {
        id: result.complaint.id,

        subject:
          result.complaint.title,

        description:
          result.complaint.description,

        customerId: user.id,

        category:
          result.classification.category,

        subcategory:
          result.classification
            .subcategory,

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
          escalation?.required
            ? "Manual Review Required"
            : "Pending",

        createdAt: now,

        updatedAt: now,

        reference:
          result.entities?.order_id ??
          draft.reference?.trim() ??
          undefined,

        contactChannel:
          draft.contactChannel ??
          "Portal",

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
            result.classification
              .category,

          subcategory:
            result.classification
              .subcategory,

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
            escalation?.required
              ? "Manual Review Required"
              : "Pending",

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

        escalationAssessment: {
          required:
            escalation?.required ??
            false,

          level:
            mapEscalationLevel(
              escalation?.level,
            ),

          reason:
            escalation?.reason ??
            "",

          validation: "Pending",
        },

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

      log(
        "Created complaint",
        created.id,
        created.subject,
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
    [user, log, refreshComplaints],
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

      log(
        internal
          ? "Added internal note"
          : "Added comment",
        id,
        body,
      );
    },
    [user, updateComplaint, log],
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

      log(
        "Changed complaint status",
        id,
        `Status set to ${status}`,
      );
    },
    [user, updateComplaint, log],
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

      log(
        "Changed priority",
        id,
        `Priority set to ${priority}`,
      );
    },
    [user, updateComplaint, log],
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

      log(
        "Assigned complaint",
        id,
        `Assigned to ${assigneeName}`,
      );
    },
    [user, updateComplaint, log],
  );

  /* =======================================================
     RULES
     ======================================================= */

  const toggleRule = useCallback(
    (id: string) => {
      const current =
        rules.find(
          (rule) => rule.id === id,
        );

      if (!current) return;

      setRules(
        (previous) =>
          previous.map(
            (rule) =>
              rule.id === id
                ? {
                    ...rule,

                    status:
                      rule.status ===
                      "Active"
                        ? "Disabled"
                        : "Active",

                    updatedAt:
                      new Date().toISOString(),
                  }
                : rule,
          ),
      );

      log(
        current.status === "Active"
          ? "Disabled routing rule"
          : "Enabled routing rule",
        id,
        current.subcategory,
      );
    },
    [rules, log],
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

      rules,

      documents,

      reports,

      auditLogs,

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

      toggleRule,

      markNotificationRead,

      markAllNotificationsRead,

      getCustomer,
    }),
    [
      complaints,
      customers,
      articles,
      rules,
      documents,
      reports,
      auditLogs,
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
      toggleRule,
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