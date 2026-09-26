import { api } from "@/api/client";

export interface ManagementComplaint {
  id: string;
  title: string;
  description: string;
  customer_id?: string;
  status?: string;
  assigned_to?: string;
  assigned_department?: string;
  manual_review_required?: boolean;
  review_status?: string | null;
  reviewer_id?: string | null;
  created_at?: string;
  updated_at?: string;
  resolved_at?: string | null;
  closed_at?: string | null;
}

export interface ManagementResponse {
  count: number;
  complaints: ManagementComplaint[];
}

export async function getManagementComplaints(params?: Record<string, string>) {
  const response = await api.get<ManagementResponse>("/api/management/complaints", { params });
  return response.data;
}

export async function getManagementAnalytics() {
  const response = await api.get("/api/management/analytics");
  return response.data;
}

export async function getManagementReports() {
  const response = await api.get("/api/management/reports");
  return response.data;
}

export async function getManagementSla() {
  const response = await api.get("/api/management/sla");
  return response.data;
}

export async function getAdminUsers(params?: Record<string, string>) {
  const response = await api.get("/api/admin/users", { params });
  return response.data;
}

export async function updateAdminUserStatus(userId: string, status: string) {
  const response = await api.patch(`/api/admin/users/${userId}/status`, { status });
  return response.data;
}

export async function getAdminAuditLogs(limit = 100) {
  const response = await api.get("/api/admin/audit", { params: { limit } });
  return response.data;
}
