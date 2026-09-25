import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createComplaint, getComplaints, getComplaintAnalysis } from "@/api/complaints";
import {
  articles as seedArticles,
  auditLogs as seedLogs,
  complaints as seedComplaints,
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
  EscalationLevel,
  ComplaintStatus,
  Customer,
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
 addComplaint: (draft: ComplaintDraft) => Promise<Complaint>;
  updateComplaint: (id: string, patch: Partial<Complaint>, event?: Omit<TimelineEvent, "id" | "timestamp">) => void;
  addComment: (id: string, body: string, internal?: boolean) => void;
  setStatus: (id: string, status: ComplaintStatus, resolution?: string) => void;
  setPriority: (id: string, priority: Priority) => void;
  assignTo: (id: string, assigneeId: string, assigneeName: string) => void;
  toggleRule: (id: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  getCustomer: (id: string) => Customer | undefined;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>(seedComplaints);
  const [customers, setCustomers] = useState<Customer[]>(seedCustomers);
  const [rules, setRules] = useState<RoutingRule[]>(seedRules);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(seedLogs);
  const [notifications, setNotifications] = useState<NotificationItem[]>(seedNotes);
  const articles = seedArticles;

// addition

const mapBackendComplaint = (backendComplaint: {
  id: string;
  title: string;
  description: string;
  order_id?: string | null;
  transaction_id?: string | null;
  product?: string | null;
  amount?: string | null;
  date?: string | null;
  created_at: string;
}): Complaint => {
  const createdAt = backendComplaint.created_at;

  return {
    id: backendComplaint.id,
    subject: backendComplaint.title,
    description: backendComplaint.description,

    // GET /api/complaints currently does not contain a frontend user/customer ID.
    customerId: "c-guest",

    category: "Pending analysis",
    subcategory: "Pending analysis",
    department: "Unassigned",

    productService:
      backendComplaint.product || "Unspecified",

    priority: "P2",
    urgency: "Medium",
    sentiment: "Neutral",

    status: "Analyzed",
    escalated: false,
    validation: "Pending",

    createdAt,
    updatedAt: createdAt,

    reference:
      backendComplaint.order_id || undefined,

    intelligence: {
      summary:
        "Complaint retrieved from the SupportNova backend.",

      primaryIssue:
        backendComplaint.title,

      secondaryIssues: [],

      category: "Pending analysis",
      subcategory: "Pending analysis",

      sentiment: "Neutral",
      urgency: "Medium",
      priority: "P2",

      productService:
        backendComplaint.product || "Unspecified",

      entities: [
        backendComplaint.order_id
          ? `Order: ${backendComplaint.order_id}`
          : "",
        backendComplaint.transaction_id
          ? `Transaction: ${backendComplaint.transaction_id}`
          : "",
        backendComplaint.amount
          ? `Amount: ${backendComplaint.amount}`
          : "",
        backendComplaint.date
          ? `Date: ${backendComplaint.date}`
          : "",
      ].filter(Boolean),

      department: "Unassigned",
      escalation: false,
      reason: "",

      recommendation:
        "Open the complaint to retrieve its analysis.",

      agentGuidance: [],

      clarificationQuestions: [],
    },

    validationDetail: {
      overall: "Pending",
      fields: [],
      policyValidated: false,
      resolutionValidated: false,
    },

    escalationAssessment: {
      required: false,
      level: "No Escalation",
      reason: "",
      validation: "Pending",
    },

    timeline: [
      {
        id: `${backendComplaint.id}-t1`,
        timestamp: createdAt,
        type: "submitted",
        title: "Complaint retrieved from backend",
        actor: "System",
        actorRole: "System",
      },
    ],
  };
};

useEffect(() => {
  const loadComplaints = async () => {
    console.log("1. Loading complaints...");

    try {
      const backendComplaints = await getComplaints();

      console.log("2. Backend complaints:", backendComplaints);

      const mappedComplaints = backendComplaints.map(
        mapBackendComplaint,
      );

      console.log("3. Mapped complaints:", mappedComplaints);

      setComplaints(mappedComplaints);

      console.log("4. Complaints state updated");
    } catch (error) {
      console.error("5. Failed to load complaints:", error);
    }
  };

  loadComplaints();
}, []);

//useeffect2
useEffect(() => {
  const testAnalysis = async () => {
    try {
      const analysis = await getComplaintAnalysis(
        "6ab627d7a676fa4da8ebe5ac",
      );

      console.log("Backend analysis:", analysis);
    } catch (error) {
      console.error("Failed to load analysis:", error);
    }
  };

  testAnalysis();
}, []);
//useeffect2

  const log = useCallback(
    (action: string, resource: string, details: string, result: AuditLog["result"] = "Success") => {
      const entry: AuditLog = {
        id: `a-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user: user?.name ?? "System",
        action,
        resource,
        result,
        details,
      };
      setAuditLogs((prev) => [entry, ...prev]);
    },
    [user],
  );


  const updateComplaint = useCallback(
    (id: string, patch: Partial<Complaint>, event?: Omit<TimelineEvent, "id" | "timestamp">) => {
      setComplaints((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const next: Complaint = {
            ...c,
            ...patch,
            updatedAt: new Date().toISOString(),
          };
          if (event) {
            next.timeline = [
              ...c.timeline,
              {
                ...event,
                id: `${id}-${Date.now()}`,
                timestamp: new Date().toISOString(),
              },
            ];
          }
          return next;
        }),
      );
    },
    [],
  );

const addComment = useCallback(
  (complaintId: string, text: string, internal = false) => {
    if (!user) return;

    updateComplaint(
      complaintId,
      {},
      {
        type: internal ? "note" : "comment",
        title: internal ? "Internal note added" : "Comment added",
        description: text,
        actor: user.name,
        actorRole: user.role,
      },
    );

    log(
      internal ? "Added internal note" : "Added comment",
      complaintId,
      text,
    );
  },
  [user, updateComplaint, log],
);
const addComplaint = useCallback(
  async (draft: ComplaintDraft): Promise<Complaint> => {
    const isStaff = user?.role === "Agent" || user?.role === "Admin";

    let customerId = user?.id ?? "c-guest";
    let customerName =
      draft.customerName?.trim() || user?.name || "Customer";
    let countedOnCreate = false;

    if ((isStaff || !user) && draft.customerEmail) {
      const existing = customers.find(
        (c) =>
          c.email.toLowerCase() ===
          draft.customerEmail!.trim().toLowerCase(),
      );

      if (existing) {
        customerId = existing.id;
        customerName = existing.name;
      } else {
        customerId = `c-${Date.now()}`;
        customerName = draft.customerName?.trim() || draft.customerEmail;

        const createdCustomer: Customer = {
          id: customerId,
          name: customerName,
          email: draft.customerEmail.trim(),
          reference: draft.reference,
          joinedAt: new Date().toISOString(),
          openComplaints: 1,
        };

        setCustomers((prev) => [createdCustomer, ...prev]);
        countedOnCreate = true;
      }
    } else if (user?.role === "Customer") {
      customerId = user.id;
      customerName = user.name;

      if (!customers.some((c) => c.id === user.id)) {
        setCustomers((prev) => [
          {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            joinedAt: user.createdAt,
            openComplaints: 1,
          },
          ...prev,
        ]);

        countedOnCreate = true;
      }
    }

    // Send complaint to the real FastAPI backend.
    const backendResult = await createComplaint(draft);

    const now = new Date().toISOString();

    // --------------------------------------------------------
    // Backend severity → existing frontend UI model
    // --------------------------------------------------------

    const backendSeverity =
      backendResult.escalation.level || "Standard";

    const priorityMap: Record<string, Priority> = {
      Standard: "P3",
      Medium: "P2",
      High: "P1",
      Critical: "P0",
    };

    const urgencyMap: Record<string, Urgency> = {
      Standard: "Low",
      Medium: "Medium",
      High: "High",
      Critical: "Critical",
    };

    const escalationLevelMap: Record<string, EscalationLevel> = {
      Standard: "No Escalation",
      Medium: "Supervisor Review",
      High: "Department Manager",
      Critical: "Critical Management Escalation",
    };

    const priority =
      priorityMap[backendSeverity] ?? "P3";

    const urgency =
      urgencyMap[backendSeverity] ?? "Low";

    const sentimentLabel =
      backendResult.sentiment.label?.toLowerCase();

    const sentiment: Sentiment =
      sentimentLabel === "positive"
        ? "Positive"
        : sentimentLabel === "negative"
          ? "Negative"
          : sentimentLabel === "strongly negative"
            ? "Strongly Negative"
            : "Neutral";

    const escalationLevel =
      backendResult.escalation.required
        ? (
            escalationLevelMap[backendSeverity] ??
            "Supervisor Review"
          )
        : "No Escalation";

    const productService =
      backendResult.entities.product ||
      draft.productService?.trim() ||
      "Unspecified";

    const created: Complaint = {
      id: backendResult.complaint.id,
      subject: backendResult.complaint.title,
      description: backendResult.complaint.description,
      customerId,

      category: backendResult.classification.category,
      subcategory: backendResult.classification.subcategory,
      department: backendResult.classification.department,

      productService,

      priority,
      urgency,
      sentiment,

      status: "Analyzed",

      escalated: backendResult.escalation.required,

      // Ground-truth validator is not part of the live API flow yet.
      validation: "Pending",

      createdAt: now,
      updatedAt: now,

      reference:
        backendResult.entities.order_id ||
        draft.reference?.trim() ||
        undefined,

      contactChannel: draft.contactChannel || "Portal",
      customerType: draft.customerType,

      previousComplaintId:
        draft.previousComplaintId?.trim() || undefined,

      attachmentName: draft.attachmentName,

      intelligence: {
        summary:
          backendResult.resolution.explanation || "",

        primaryIssue:
          backendResult.complaint.title,

        secondaryIssues: [],

        category:
          backendResult.classification.category,

        subcategory:
          backendResult.classification.subcategory,

        sentiment,

        urgency,

        priority,

        productService,

        entities: [
          backendResult.entities.order_id
            ? `Order: ${backendResult.entities.order_id}`
            : "",
          backendResult.entities.transaction_id
            ? `Transaction: ${backendResult.entities.transaction_id}`
            : "",
          backendResult.entities.product
            ? `Product: ${backendResult.entities.product}`
            : "",
          backendResult.entities.amount
            ? `Amount: ${backendResult.entities.amount}`
            : "",
          backendResult.entities.date
            ? `Date: ${backendResult.entities.date}`
            : "",
        ].filter(Boolean),

        department:
          backendResult.classification.department,

        escalation:
          backendResult.escalation.required,

        reason:
          backendResult.escalation.reason || "",

        recommendation:
          backendResult.resolution.steps?.join(" ") || "",

        agentGuidance:
          backendResult.agent_guidance
            ? [backendResult.agent_guidance]
            : [],

        clarificationQuestions:
          backendResult.clarification_questions || [],

        generatedResponse:
          backendResult.customer_response || undefined,
      },

      validationDetail: {
        overall: "Pending",
        fields: [],
        policyValidated: false,
        resolutionValidated: false,
      },

      escalationAssessment: {
        required:
          backendResult.escalation.required,

        level: escalationLevel,

        reason:
          backendResult.escalation.reason || "",

        validation: "Pending",
      },

      missingInfo:
        backendResult.clarification_questions?.length
          ? {
              items:
                backendResult.clarification_questions,

              questions:
                backendResult.clarification_questions,
            }
          : undefined,

      customerResponse:
        backendResult.customer_response || undefined,

      timeline: [
        {
          id: `${backendResult.complaint.id}-t1`,
          timestamp: now,
          type: "submitted",
          title: "Complaint submitted and analyzed",
          actor: customerName,
          actorRole: "Customer",
        },
      ],
    };

    setComplaints((prev) => [created, ...prev]);

    if (!countedOnCreate) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customerId
            ? {
                ...c,
                openComplaints: c.openComplaints + 1,
              }
            : c,
        ),
      );
    }

    log(
      "Created complaint",
      created.id,
      created.subject,
    );

    setNotifications((prev) => [
      {
        id: `n-${Date.now()}`,
        title: `New complaint ${created.id}`,
        body: `${created.subject} · analyzed`,
        timestamp: created.createdAt,
        read: false,
        href: `/complaints/${created.id}`,
      },
      ...prev,
    ]);

    return created;
  },
  [user, customers, log],
);

  const setStatus = useCallback(
    (id: string, status: ComplaintStatus, resolution?: string) => {
      if (!user) return;
      const patch: Partial<Complaint> = { status };
      if (status === "Escalated") patch.escalated = true;
      if (resolution) patch.resolution = resolution;
      let type: TimelineEvent["type"] = "status";
      if (status === "Escalated") type = "escalated";
      if (status === "Resolved") type = "resolved";
      if (status === "Closed") type = "closed";
      updateComplaint(id, patch, {
        type,
        title: status === "Resolved" || status === "Closed" ? `Complaint ${status.toLowerCase()}` : `Status changed to ${status}`,
        description: resolution,
        actor: user.name,
        actorRole: user.role,
      });
      log("Changed complaint status", id, `Status set to ${status}`);
    },
    [user, updateComplaint, log],
  );

  const setPriority = useCallback(
    (id: string, priority: Priority) => {
      if (!user) return;
      updateComplaint(id, { priority }, {
        type: "status",
        title: `Priority set to ${priority}`,
        actor: user.name,
        actorRole: user.role,
      });
      log("Changed priority", id, `Priority set to ${priority}`);
    },
    [user, updateComplaint, log],
  );

  const assignTo = useCallback(
    (id: string, assigneeId: string, assigneeName: string) => {
      if (!user) return;
      updateComplaint(id, { assigneeId }, {
        type: "assigned",
        title: `Assigned to ${assigneeName}`,
        actor: user.name,
        actorRole: user.role,
      });
      log("Assigned complaint", id, `Assigned to ${assigneeName}`);
    },
    [user, updateComplaint, log],
  );

  const toggleRule = useCallback(
    (id: string) => {
      setRules((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: r.status === "Active" ? "Disabled" : "Active",
                updatedAt: new Date().toISOString(),
              }
            : r,
        ),
      );
      const current = rules.find((r) => r.id === id);
      log(
        current?.status === "Active" ? "Disabled routing rule" : "Enabled routing rule",
        id,
        current?.subcategory ?? id,
      );
    },
    [rules, log],
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const getCustomer = useCallback((id: string) => customers.find((c) => c.id === id), [customers]);

  const value = useMemo(
    () => ({
      complaints,
      customers,
      articles,
      rules,
      documents,
      reports,
      auditLogs,
      notifications,
      addComplaint,
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
      auditLogs,
      notifications,
      addComplaint,
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

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
