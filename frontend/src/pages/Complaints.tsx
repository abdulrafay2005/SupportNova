import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { SearchBar } from "@/components/SearchBar";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/auth/AuthContext";
import { getAgentQueue, getReviewQueue } from "@/api/workflows";
import { getManagementComplaints } from "@/api/management";
import { COMPLAINT_STATUSES, type ComplaintStatus } from "@/types";
import { formatRelative } from "@/utils/dates";

const PAGE_SIZE = 10;

/*
 * Shared shape of the role-scoped backend complaint rows
 * (agent queue, review queue, management complaints).
 */
interface ComplaintRow {
  id: string;
  title: string;
  description: string;
  status?: string;
  assigned_to?: string | null;
  assigned_department?: string | null;
  manual_review_required?: boolean;
  review_status?: string | null;
  created_at?: string;
  updated_at?: string;
}

function extractDetail(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

export function Complaints() {
  const { user } = useAuth();
  const role = user?.role;

  const [rows, setRows] = useState<ComplaintRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  /*
   * VISIBILITY = role + backend scope.
   *
   * Agent    -> GET /api/agent/queue        (assigned complaints)
   * Reviewer -> GET /api/review/queue       (manual-review population)
   * Manager  -> GET /api/management/complaints
   * Admin    -> GET /api/management/complaints
   *
   * The backend enforces each scope; this page only chooses
   * the role-appropriate endpoint.
   */
  const load = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    setError(null);

    try {
      if (role === "Agent") {
        setRows(await getAgentQueue());
      } else if (role === "Reviewer") {
        setRows(await getReviewQueue());
      } else if (role === "Manager" || role === "Admin") {
        const params: Record<string, string> = {};
        if (status) params.status = status;
        const data = await getManagementComplaints(params);
        setRows(data.complaints);
      } else {
        setRows([]);
      }
    } catch (e: unknown) {
      setError(extractDetail(e, "Unable to load complaints."));
    } finally {
      setLoading(false);
    }
  }, [role, status]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (q && !`${row.id} ${row.title} ${row.description}`.toLowerCase().includes(q)) return false;
      // Agent/Reviewer queues are filtered client-side;
      // Manager/Admin status filtering is server-side via params.
      if (status && (role === "Agent" || role === "Reviewer") && row.status !== status) return false;
      return true;
    });
  }, [rows, query, status, role]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const description =
    role === "Agent"
      ? "Complaints assigned to you, from the live agent queue."
      : role === "Reviewer"
        ? "Complaints currently requiring manual review."
        : "All complaints in the management scope.";

  return (
    <div>
      <PageHeader title="Complaints" description={description} />

      <div className="panel mb-4 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <SearchBar value={query} onChange={(v) => { setQuery(v); setPage(1); }} placeholder="Search ID, title, description..." className="sm:col-span-2" />
          <Select
            options={COMPLAINT_STATUSES.map((s: ComplaintStatus) => ({ value: s, label: s }))}
            placeholder="All statuses"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {error && <p className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">{error}</p>}

      {loading ? (
        <p className="text-[13px] text-ink-muted">Loading complaints…</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="No complaints" description="The backend returned no complaints for this scope and filter." />
      ) : (
        <>
          <p className="mb-2 text-[12px] text-ink-muted tabular">{filtered.length} complaints</p>
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase tracking-wide text-ink-muted">
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Department</th>
                  <th className="px-3 py-2 font-medium">Review</th>
                  <th className="px-3 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0 hover:bg-canvas-subtle">
                    <td className="px-3 py-2 font-mono text-[12px]">
                      <Link className="text-primary hover:underline" to={`/complaints/${row.id}`}>{row.id}</Link>
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-ink">{row.title}</td>
                    <td className="px-3 py-2"><StatusBadge status={(row.status ?? "New") as ComplaintStatus} /></td>
                    <td className="px-3 py-2 text-ink-secondary">{row.assigned_department ?? "—"}</td>
                    <td className="px-3 py-2 text-[12px] text-ink-muted">
                      {row.manual_review_required ? (row.review_status ?? "Pending") : "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-ink-muted">
                      {row.updated_at ? formatRelative(row.updated_at) : row.created_at ? formatRelative(row.created_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
