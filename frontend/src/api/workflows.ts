import { api } from "@/api/client";

export interface WorkflowComplaint { id: string; title: string; description: string; status: string; assigned_to?: string; assigned_department?: string; manual_review_required?: boolean; review_status?: string | null; reviewer_id?: string | null; created_at?: string; updated_at?: string; }
export interface ActionResponse { message: string; complaint_id: string; status?: string; [key: string]: unknown; }

export async function getAgentQueue() { return (await api.get<WorkflowComplaint[]>("/api/agent/queue")).data; }
export async function agentStart(id: string) { return (await api.post<ActionResponse>(`/api/agent/${id}/start`)).data; }
export async function agentAwait(id: string, comment: string) { return (await api.post<ActionResponse>(`/api/agent/${id}/await-customer`, { comment })).data; }
export async function agentResolve(id: string, comment: string) { return (await api.post<ActionResponse>(`/api/agent/${id}/resolve`, { comment })).data; }
export async function agentEscalate(id: string, comment: string) { return (await api.post<ActionResponse>(`/api/agent/${id}/escalate`, { comment })).data; }
export async function agentComment(id: string, comment: string) { return (await api.post<ActionResponse>(`/api/agent/${id}/comment`, { comment })).data; }

export async function getReviewQueue() { return (await api.get<WorkflowComplaint[]>("/api/review/queue")).data; }
export async function reviewAction(id: string, action: string, payload: Record<string, unknown> = {}) { return (await api.post<ActionResponse>(`/api/review/${id}/${action}`, payload)).data; }

// ============================================================
// STATISTICS
//
// Real aggregations from the backend. Every field is derived
// from stored complaints, review history and workflow activity;
// unavailable measurements are returned as null so the UI can
// state that they are unavailable instead of showing a zero.
// ============================================================

export interface AgentStatistics {
  generated_at: string;
  agent_id: string;
  assigned_total: number;
  open: number;
  in_progress: number;
  awaiting_customer: number;
  escalated: number;
  resolved: number;
  closed: number;
  resolution_rate_percent: number | null;
  status_distribution: Record<string, number>;
  average_resolution_hours: number | null;
  timed_resolutions: number;
  average_handling_hours: number | null;
  measured_handling_count: number;
  handling_time_unavailable: number;
  average_open_age_hours: number | null;
  oldest_open_age_hours: number | null;
  recent_activity: Array<{
    complaint_id: string;
    type: string;
    title: string;
    description?: string;
    timestamp: string;
  }>;
}

export interface ReviewerWorkloadRow {
  reviewer_id: string;
  reviewer_name?: string | null;
  actions: number;
  approvals: number;
  rejections: number;
  last_action_at?: string | null;
}

export interface ValidationStatistics {
  generated_at: string;
  analyzed_complaints: number;
  validation_passed: number;
  validation_failed: number;
  pass_rate_percent: number | null;
  complaints_with_issues: number;
  ground_truth_valid: number;
  ground_truth_failed: number;
  manual_review_required: number;
  ai_output_blocked: number;
  issue_code_distribution: Record<string, number>;
  issue_type_distribution: Record<string, number>;
  field_level_comparison_available: boolean;
}

export interface ReviewStatistics {
  generated_at: string;
  pending_reviews: number;
  completed_reviews: number;
  complaints_with_review_history: number;
  outcome_counts: Record<string, number>;
  other_outcome_counts: Record<string, number>;
  total_review_actions: number;
  reviewer_workload: ReviewerWorkloadRow[];
  recent_activity: Array<{
    complaint_id: string;
    complaint_title: string;
    complaint_status?: string;
    action: string;
    reviewer_id?: string;
    reviewer_name?: string;
    comment?: string | null;
    created_at?: string | null;
  }>;
  validation: ValidationStatistics;
  my_statistics: {
    reviewer_id: string;
    actions: number;
    approvals: number;
    rejections: number;
    last_action_at?: string | null;
    completed_reviews: number;
  } | null;
}

export async function getAgentStatistics() {
  return (await api.get<AgentStatistics>("/api/agent/statistics")).data;
}

export async function getReviewStatistics() {
  return (await api.get<ReviewStatistics>("/api/review/statistics")).data;
}
