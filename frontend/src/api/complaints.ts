import type { Complaint, ComplaintDraft, Intelligence } from "@/types";
import { nextComplaintId } from "@/utils/classify";
import { api } from "@/api/client";

/**
 * Frontend service for the SupportNova complaint API.
 *
 * Backend:
 *   POST /api/complaints
 *   GET  /api/complaints
 *   GET  /api/complaints/{complaint_id}
 *   GET  /api/complaints/{complaint_id}/analysis
 */

export interface CreateComplaintResponse {
  complaint: {
    id: string;
    title: string;
    description: string;
  };

  classification: {
    category: string;
    subcategory: string;
    department: string;
  };

  sentiment: {
    label: string;
    emotion: string;
  };

  entities: {
    order_id?: string;
    transaction_id?: string;
    product?: string;
    amount?: string;
    date?: string;
  };

  policies: Array<{
    Policy_ID: string;
    Policy_Name: string;
    Policy_Rule: string;
    Owner_Department: string;
    Status: string;
  }>;

  resolution: {
    steps: string[];
    explanation: string;
  };

  escalation: {
    required: boolean;
    level: string;
    reason: string;
    rules: string[];
  };

  routing: {
    primary_department: string;
    supporting_departments: string[];
    normal_rule_department: string;
  };

  prompt: {
    name: string;
    version: string;
  };

  customer_response: string;

  follow_up: {
    required: boolean;
    message: string;
  };

  agent_guidance: string;

  clarification_questions: string[];
}

/**
 * Sends a complaint to the FastAPI backend.
 *
 * Only fields currently supported by the backend are sent.
 */
export async function createComplaint(
  draft: ComplaintDraft,
): Promise<CreateComplaintResponse> {
  const response = await api.post<CreateComplaintResponse>("/api/complaints", {
    title: draft.subject.trim(),
    description: draft.description.trim(),
    order_id: draft.reference?.trim() || undefined,
    product: draft.productService?.trim() || undefined,
  });

  return response.data;
}

export async function getComplaints() {
  const response = await api.get("/api/complaints");

  return response.data;
}

export async function getComplaintAnalysis(complaintId: string) {
  const response = await api.get(
    `/api/complaints/${complaintId}/analysis`,
  );

  return response.data;
}

/**
 * Backend complaint detail (GET /api/complaints/{id}).
 * Staff receive the actual submitter identity and workflow
 * fields; customers receive the customer-safe subset.
 */
export interface ComplaintDetailResponse {
  id: string;
  title: string;
  description: string;
  order_id?: string | null;
  transaction_id?: string | null;
  product?: string | null;
  amount?: string | null;
  date?: string | null;
  status: string;
  assigned_department?: string | null;
  customer_facing_request?: string | null;
  resolution_comment?: string | null;
  created_at?: string;
  updated_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  // staff-only fields
  assigned_to?: string | null;
  manual_review_required?: boolean;
  review_status?: string | null;
  reviewer_id?: string | null;
  user_id?: string;
  customer?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  assigned_agent?: {
    id: string;
    name?: string | null;
  } | null;
}

export async function getComplaintDetail(complaintId: string) {
  const response = await api.get<ComplaintDetailResponse>(
    `/api/complaints/${complaintId}`,
  );

  return response.data;
}

/**
 * Persistent activity timeline
 * (GET /api/complaints/{id}/activity).
 * The backend filters customer-visible events for customers.
 */
export interface ComplaintActivityEntry {
  id: string;
  timestamp: string;
  type: string;
  title: string;
  description: string;
  actor: string;
  actorRole: string;
  metadata?: Record<string, unknown>;
}

export async function getComplaintActivity(complaintId: string) {
  const response = await api.get<ComplaintActivityEntry[]>(
    `/api/complaints/${complaintId}/activity`,
  );

  return response.data;
}

/**
 * Temporary frontend fallback used by the existing mock UI.
 * Keep this until the DataContext is switched to the real API.
 */
const pendingIntelligence = (
  subject: string,
  product?: string,
): Intelligence => ({
  summary:
    "Analysis has not been produced yet. Results will come from the processing pipeline.",
  primaryIssue: subject.trim() || "Unclassified",
  secondaryIssues: [],
  category: "Pending analysis",
  subcategory: "Pending analysis",
  sentiment: "Neutral",
  urgency: "Medium",
  priority: "P2",
  productService: product?.trim() || "Unspecified",
  entities: [],
  department: "Unassigned",
  escalation: false,
  reason: "This complaint is waiting for analysis and Python validation.",
  recommendation: "Do not route or resolve until analysis is available.",
  agentGuidance: [
    "Wait for the pipeline result before contacting the customer with a resolution.",
  ],
  clarificationQuestions: [],
});

export function buildComplaintFromDraft(
  draft: ComplaintDraft,
  existingIds: string[],
  customerId: string,
  customerName: string,
): Complaint {
  const now = new Date().toISOString();
  const id = nextComplaintId(existingIds);
  const missingItems: string[] = [];
  const questions: string[] = [];

  if (!draft.reference?.trim()) {
    missingItems.push("Order or reference number");
    questions.push(
      "What is the order, invoice, or account reference for this issue?",
    );
  }

  if (!draft.productService?.trim()) {
    missingItems.push("Product or service");
    questions.push("Which product or service does this relate to?");
  }

  if (draft.description.trim().length < 40) {
    missingItems.push("Problem description");
    questions.push(
      "Can you describe what happened, including dates and what you would like us to do?",
    );
  }

  return {
    id,
    subject: draft.subject.trim(),
    description: draft.description.trim(),
    customerId,
    category: "Pending analysis",
    subcategory: "Pending analysis",
    department: "Unassigned",
    productService: draft.productService?.trim() || "Unspecified",
    priority: "P2",
    urgency: "Medium",
    sentiment: "Neutral",
    status: "New",
    escalated: false,
    validation: "Pending",
    createdAt: now,
    updatedAt: now,
    reference: draft.reference?.trim() || undefined,
    contactChannel: draft.contactChannel || "Portal",
    customerType: draft.customerType,
    previousComplaintId: draft.previousComplaintId?.trim() || undefined,
    attachmentName: draft.attachmentName,
    intelligence: pendingIntelligence(
      draft.subject,
      draft.productService,
    ),
    validationDetail: {
      overall: "Pending",
      fields: [],
      policyValidated: false,
      resolutionValidated: false,
    },
    escalationAssessment: {
      required: false,
      level: "No Escalation",
      reason: "Escalation has not been assessed yet.",
      validation: "Pending",
    },
    missingInfo: missingItems.length
      ? { items: missingItems, questions }
      : undefined,
    timeline: [
      {
        id: `${id}-t1`,
        timestamp: now,
        type: "submitted",
        title: "Complaint submitted",
        actor: customerName,
        actorRole: "Customer",
      },
    ],
  };
}