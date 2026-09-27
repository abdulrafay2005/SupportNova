import { api } from "@/api/client";
import type { ValidationStatistics } from "@/api/workflows";

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
  category?: string | null;
  subcategory?: string | null;
  priority?: string | null;
  sla_hours?: number | null;
  sla_due_at?: string | null;
  escalation_level?: string | null;
}

export interface ManagementResponse {
  count: number;
  total: number;
  page: number;
  limit: number;
  pages: number;
  has_more: boolean;
  filters: Record<string, string | null>;
  available_statuses: string[];
  available_departments: string[];
  available_categories: string[];
  available_priorities: string[];
  complaints: ManagementComplaint[];
}

export interface ManagementComplaintQuery {
  status?: string;
  department?: string;
  assigned_to?: string;
  category?: string;
  priority?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export async function getManagementComplaints(
  params?: ManagementComplaintQuery | Record<string, string>,
) {
  const response = await api.get<ManagementResponse>(
    "/api/management/complaints",
    { params: cleanQuery(params) },
  );
  return response.data;
}

/* Drops empty filters so the backend receives only real values. */
function cleanQuery(
  params?: ManagementComplaintQuery | Record<string, string>,
): Record<string, string | number> | undefined {
  if (!params) return undefined;
  const cleaned: Record<string, string | number> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    cleaned[key] = value as string | number;
  });
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

export async function getManagementAnalytics() {
  const response = await api.get<OperationalAnalytics>(
    "/api/management/analytics",
  );
  return response.data;
}

export interface SlaDepartmentRow {
  department: string;
  total: number;
  Met: number;
  Breached: number;
  "At risk": number;
  "On track": number;
  Unavailable: number;
}

export interface SlaAttentionRow {
  id: string;
  title?: string | null;
  status?: string | null;
  assigned_department?: string | null;
  assigned_to?: string | null;
  priority?: string | null;
  sla_hours?: number | null;
  sla_due_at?: string | null;
  sla_state?: string | null;
  hours_remaining?: number | null;
}

export interface SlaOverview {
  generated_at: string;
  total_complaints: number;
  resolved_complaints: number;
  unresolved_complaints: number;
  open_complaints: number;
  average_resolution_hours: number | null;
  with_sla_target: number;
  without_sla_target: number;
  coverage_percent: number | null;
  at_risk_threshold_ratio: number;
  met: number;
  breached: number;
  at_risk: number;
  on_track: number;
  unavailable: number;
  compliance_percent: number | null;
  state_distribution: Record<string, number>;
  departments: SlaDepartmentRow[];
  priorities: Array<Record<string, number | string>>;
  attention: SlaAttentionRow[];
}

export async function getManagementSla() {
  const response = await api.get<SlaOverview>("/api/management/sla");
  return response.data;
}

// ============================================================
// ADMIN
// ============================================================

export interface AdminUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  department?: string | null;
  status?: string | null;
  created_at?: string | null;
}

export interface AdminUsersResponse {
  count: number;
  users: AdminUser[];
}

export interface UserOverview {
  total_users: number;
  role_distribution: Record<string, number>;
  status_distribution: Record<string, number>;
}

export interface AuditSummary {
  generated_at: string;
  days: number;
  total_logs: number;
  logs_in_window: number;
  action_distribution: Record<string, number>;
  actor_role_distribution: Record<string, number>;
  entity_type_distribution: Record<string, number>;
  top_actors: Array<{
    actor_id: string;
    actor_name: string | null;
    actions: number;
    last_action_at: string | null;
  }>;
  daily_activity: Array<{ date: string; count: number }>;
  last_activity_at: string | null;
}

export interface AdminStatistics {
  generated_at: string;
  complaints: {
    total: number;
    analyzed: number;
    without_analysis: number;
    open: number;
    resolved: number;
    closed: number;
    escalated: number;
    manual_review: number;
    manual_review_completed: number;
    status_distribution: Record<string, number>;
    category_distribution: Record<string, number>;
    department_distribution: Record<string, number>;
    escalation_level_distribution: Record<string, number>;
  };
  resolution: {
    average_resolution_hours: number | null;
    median_resolution_hours: number | null;
    resolution_rate_percent: number | null;
    timed_resolutions: number;
    resolution_time_unavailable: number;
  };
  validation: ValidationStatistics;
  users: {
    total: number;
    role_distribution: Record<string, number>;
    status_distribution: Record<string, number>;
    departments: string[];
  };
  audit: AuditSummary;
}

export interface AuditLogRow {
  id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;
  action?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  details: Record<string, unknown>;
  created_at?: string | null;
}

export interface AuditLogsResponse {
  count: number;
  total: number;
  page: number;
  limit: number;
  pages: number;
  has_more: boolean;
  logs: AuditLogRow[];
  result_filter_available: boolean;
  available_actions: string[];
  available_roles: string[];
  available_entity_types: string[];
}

export async function getAdminUsers(params?: Record<string, string>) {
  const response = await api.get<AdminUsersResponse>("/api/admin/users", {
    params,
  });
  return response.data;
}

export async function getAdminUserOverview() {
  const response = await api.get<UserOverview>("/api/admin/users/overview");
  return response.data;
}

export async function updateAdminUserStatus(userId: string, status: string) {
  const response = await api.patch(`/api/admin/users/${userId}/status`, {
    status,
  });
  return response.data;
}

export async function getAdminStatistics() {
  const response = await api.get<AdminStatistics>("/api/admin/statistics");
  return response.data;
}

// ============================================================
// STAFF PROVISIONING
//
// Privileged accounts are created by an Administrator through
// these endpoints. Public registration always creates a Customer.
// ============================================================

export type StaffRole = "Agent" | "Reviewer" | "Manager" | "Admin";

export const STAFF_ROLES: StaffRole[] = [
  "Agent",
  "Reviewer",
  "Manager",
  "Admin",
];

export interface StaffCreatePayload {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
  department?: string | null;
  status?: string;
}

export interface StaffUpdatePayload {
  name?: string;
  role?: StaffRole;
  department?: string | null;
  status?: string;
}

export async function createStaffUser(payload: StaffCreatePayload) {
  const response = await api.post<AdminUser>("/api/admin/users", {
    ...payload,
    department: payload.department || undefined,
  });
  return response.data;
}

export async function updateStaffUser(
  userId: string,
  payload: StaffUpdatePayload,
) {
  const response = await api.patch<AdminUser>(
    `/api/admin/users/${userId}`,
    payload,
  );
  return response.data;
}

export interface AssignableAgent {
  id: string;
  name?: string | null;
  email?: string | null;
  department?: string | null;
  status?: string | null;
}

export async function getAssignableAgents(department?: string) {
  const response = await api.get<{ agents: AssignableAgent[] }>(
    "/api/admin/agents",
    { params: department ? { department } : undefined },
  );
  return response.data.agents;
}

// ============================================================
// DEPARTMENTS
//
// The department registry mirrors the routing taxonomy the
// classification engine uses. The frontend never hardcodes
// department names.
// ============================================================

export interface Department {
  id: string;
  name: string;
  code: string | null;
  description: string;
  status: "Active" | "Inactive";
  source: "system" | "custom";
  created_at?: string | null;
  staff_count: number;
  agent_count: number;
  active_agent_count: number;
  manager_count: number;
}

export interface DepartmentsResponse {
  count: number;
  departments: Department[];
  routing_taxonomy_size: number;
}

export async function getDepartments(status?: string) {
  const response = await api.get<DepartmentsResponse>("/api/departments", {
    params: status ? { status } : undefined,
  });
  return response.data;
}

export async function createDepartment(payload: {
  name: string;
  description?: string;
}) {
  const response = await api.post<Department>(
    "/api/admin/departments",
    payload,
  );
  return response.data;
}

export async function updateDepartment(
  departmentId: string,
  payload: { name?: string; description?: string; status?: string },
) {
  const response = await api.patch<Department>(
    `/api/admin/departments/${departmentId}`,
    payload,
  );
  return response.data;
}

export interface DepartmentStaffMember {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
}

export async function getDepartmentStaff(departmentName: string) {
  const response = await api.get<{
    department: string;
    staff: DepartmentStaffMember[];
  }>(`/api/admin/departments/${encodeURIComponent(departmentName)}/staff`);
  return response.data;
}

export interface AuditLogQuery {
  limit?: number;
  page?: number;
  action?: string;
  actor_id?: string;
  actor_role?: string;
  entity_type?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
}

export async function getAdminAuditLogs(params: AuditLogQuery = {}) {
  const query: Record<string, string | number> = {};

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query[key] = value;
    }
  });

  const response = await api.get<AuditLogsResponse>("/api/admin/audit", {
    params: query,
  });
  return response.data;
}

export async function getAdminAuditSummary(days = 30) {
  const response = await api.get<AuditSummary>("/api/admin/audit/summary", {
    params: { days },
  });
  return response.data;
}

// ============================================================
// ANALYTICS
//
// Backed by real MongoDB aggregations (api/analytics.py).
// Values that cannot be derived from stored data are returned
// as null, never as an estimate.
// ============================================================

export interface OperationalAnalytics {
  total_complaints: number;
  analyzed_complaints: number;
  complaints_without_analysis: number;
  status_distribution: Record<string, number>;
  department_distribution: Record<string, number>;
  category_distribution: Record<string, number>;
  escalation_level_distribution: Record<string, number>;
  sentiment_distribution: Record<string, number>;
  priority_distribution: Record<string, number>;
  priority_unavailable_count: number;
  manual_review_count: number;
  manual_review_completed_count: number;
  escalation_count: number;
  escalation_required_count: number;
  validation: ValidationStatistics;
}

export interface TrendPoint {
  date: string;
  created: number;
  resolved: number;
  escalated: number;
}

export interface ComplaintTrends {
  generated_at: string;
  days: number;
  department: string | null;
  start_date: string;
  end_date: string;
  points: TrendPoint[];
  undated_complaints: number;
  totals: {
    created: number;
    resolved: number;
    escalated: number;
  };
}

export interface DepartmentPerformanceRow {
  department: string;
  total: number;
  open: number;
  in_progress: number;
  awaiting_customer: number;
  escalated: number;
  manual_review: number;
  resolved: number;
  closed: number;
  average_resolution_hours: number | null;
  resolution_rate_percent: number | null;
}

export interface DepartmentPerformance {
  generated_at: string;
  department_count: number;
  departments: DepartmentPerformanceRow[];
  totals: {
    total: number;
    open: number;
    escalated: number;
    resolved: number;
    closed: number;
  };
}

export interface ResolutionStatistics {
  generated_at: string;
  total_complaints: number;
  resolved_complaints: number;
  closed_complaints: number;
  open_complaints: number;
  resolution_rate_percent: number | null;
  resolved_last_7_days: number;
  resolved_last_30_days: number;
  timed_resolutions: number;
  resolution_time_unavailable: number;
  average_resolution_hours: number | null;
  median_resolution_hours: number | null;
  fastest_resolution_hours: number | null;
  slowest_resolution_hours: number | null;
}

export interface SentimentDistribution {
  generated_at: string;
  analyzed_complaints: number;
  complaints_without_analysis: number;
  unlabelled_count: number;
  distribution: Record<string, number>;
  urgency_available: boolean;
}

export async function getManagementTrends(params?: {
  days?: number;
  department?: string;
}) {
  const response = await api.get<ComplaintTrends>("/api/management/trends", {
    params,
  });
  return response.data;
}

export async function getDepartmentPerformance() {
  const response = await api.get<DepartmentPerformance>(
    "/api/management/department-performance",
  );
  return response.data;
}

export async function getResolutionStatistics() {
  const response = await api.get<ResolutionStatistics>(
    "/api/management/resolution-statistics",
  );
  return response.data;
}

export async function getSentimentDistribution() {
  const response = await api.get<SentimentDistribution>(
    "/api/management/sentiment",
  );
  return response.data;
}

// ============================================================
// ESCALATIONS
// ============================================================

export interface EscalationRow extends ManagementComplaint {
  escalation_level?: string | null;
  escalation_reason?: string | null;
  escalation_rules?: string[];
  escalation_required?: boolean | null;
  category?: string | null;
  escalated_at?: string | null;
  escalated_by?: string | null;
  escalated_by_role?: string | null;
  escalation_note?: string | null;
  hours_since_escalation?: number | null;
}

export interface EscalationOverview {
  generated_at: string;
  count: number;
  escalations: EscalationRow[];
  statistics: {
    currently_escalated: number;
    ever_escalated: number;
    resolved_after_escalation: number;
    level_distribution: Record<string, number>;
    department_distribution: Record<string, number>;
    reason_distribution: Record<string, number>;
    average_hours_since_escalation: number | null;
    longest_hours_since_escalation: number | null;
    escalation_time_unavailable: number;
  };
}

export async function getManagementEscalations() {
  const response = await api.get<EscalationOverview>(
    "/api/management/escalations",
  );
  return response.data;
}

// ============================================================
// REPORTS
// ============================================================

export interface ReportColumn {
  key: string;
  label: string;
}

export interface UnavailableMetric {
  metric: string;
  reason: string;
}

export interface GeneratedReport {
  report_type: string;
  title: string;
  generated_at: string;
  filters: Record<string, string | null>;
  summary: Record<string, unknown>;
  columns: ReportColumn[];
  rows: Array<Record<string, unknown>>;
  row_count: number;
  unavailable: UnavailableMetric[];
}

export interface ReportCatalogueEntry {
  report_type: string;
  title: string;
  export_formats: string[];
}

export interface ReportCatalogue {
  generated_at: string;
  analytics: OperationalAnalytics;
  sla: Record<string, unknown>;
  reports: ReportCatalogueEntry[];
  export_formats_unavailable: Array<{ format: string; reason: string }>;
}

export interface ReportFilters {
  date_from?: string;
  date_to?: string;
  department?: string;
}

function cleanParams(filters: ReportFilters) {
  const params: Record<string, string> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (value) params[key] = value;
  });

  return params;
}

export async function getReportCatalogue() {
  const response = await api.get<ReportCatalogue>("/api/management/reports");
  return response.data;
}

export async function getReport(
  reportType: string,
  filters: ReportFilters = {},
) {
  const response = await api.get<GeneratedReport>(
    `/api/management/reports/${reportType}`,
    { params: cleanParams(filters) },
  );
  return response.data;
}

export async function downloadReportCsv(
  reportType: string,
  filters: ReportFilters = {},
) {
  const response = await api.get(
    `/api/management/reports/${reportType}/export`,
    {
      params: { format: "csv", ...cleanParams(filters) },
      responseType: "blob",
    },
  );

  const disposition = String(
    response.headers["content-disposition"] ?? "",
  );
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? `${reportType}.csv`;

  const url = window.URL.createObjectURL(
    new Blob([response.data as BlobPart], { type: "text/csv" }),
  );

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);

  return filename;
}
