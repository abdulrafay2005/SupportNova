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
