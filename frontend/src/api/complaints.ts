import type { ComplaintDraft } from "@/types";
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

  /**
   * Deterministic rule-engine priority, attached by the API when
   * the rule engine produced one. Absent otherwise — the frontend
   * must not substitute a default.
   */
  priority?: string | null;

  /** Ground-truth validation outcome for this analysis. */
  validation?: {
    status?: string | null;
    manual_review_required?: boolean;
    reasons?: string[];
  };

  manual_review_required?: boolean;

  /**
   * PERSISTED workflow state after backend routing
   * (Manual Review / Escalated / Assigned / Analyzed).
   * The frontend must use this instead of guessing.
   */
  workflow?: {
    complaint_id: string;
    status: string;
    assigned_department?: string | null;
  };
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
  customer_responses?: Array<{
    message: string;
    created_at?: string;
  }>;
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
 * Customer answers the agent's Awaiting Customer request
 * (POST /api/complaints/{id}/respond). The backend enforces
 * ownership and the Awaiting Customer state, persists the
 * message, and returns the complaint to In Progress.
 */
export async function customerRespond(
  complaintId: string,
  message: string,
) {
  const response = await api.post<{
    message: string;
    complaint_id: string;
    status: string;
  }>(`/api/complaints/${complaintId}/respond`, { message });

  return response.data;
}
