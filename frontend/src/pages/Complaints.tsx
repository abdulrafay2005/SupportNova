import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { SearchBar } from "@/components/SearchBar";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/auth/AuthContext";
import { getAgentQueue, getReviewQueue } from "@/api/workflows";
import {
  getManagementComplaints,
  type ManagementResponse,
} from "@/api/management";
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
  category?: string | null;
  priority?: string | null;
}

interface ManagementFilters {
  status: string;
  department: string;
  category: string;
  priority: string;
  assigned_to: string;
  date_from: string;
  date_to: string;
}

const EMPTY_FILTERS: ManagementFilters = {
  status: "",
  department: "",
  category: "",
  priority: "",
  assigned_to: "",
  date_from: "",
  date_to: "",
};

function extractDetail(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

export function Complaints() {
  const { user } = useAuth();
  const role = user?.role;
  const isManagement = role === "Manager" || role === "Admin";

  const [rows, setRows] = useState<ComplaintRow[]>([]);
  const [meta, setMeta] = useState<ManagementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<ManagementFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  /* Server-side search needs a small debounce to avoid a request per keystroke. */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  /*
   * VISIBILITY = role + backend scope.
   *
   * Agent    -> GET /api/agent/queue        (assigned complaints)
   * Reviewer -> GET /api/review/queue       (manual-review population)
   * Manager  -> GET /api/management/complaints
   * Admin    -> GET /api/management/complaints
   *
   * The backend enforces each scope; this page only chooses
   * the role-appropriate endpoint. Manager/Admin filtering and
   * pagination run in MongoDB, so the counts shown describe the
   * whole matching set and not just the current page.
   */
  const load = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    setError(null);

    try {
      if (role === "Agent") {
        setRows(await getAgentQueue());
        setMeta(null);
      } else if (role === "Reviewer") {
        setRows(await getReviewQueue());
        setMeta(null);
      } else if (isManagement) {
        const data = await getManagementComplaints({
          ...filters,
          search: debouncedQuery,
          page,
          limit: PAGE_SIZE,
        });
        setRows(data.complaints);
        setMeta(data);
      } else {
        setRows([]);
        setMeta(null);
      }
    } catch (e: unknown) {
      setError(extractDetail(e, "Unable to load complaints."));
    } finally {
      setLoading(false);
    }
  }, [role, isManagement, filters, debouncedQuery, page]);

  useEffect(() => {
    void load();
  }, [load]);

  /* Agent and reviewer queues stay client-filtered: those endpoints return the full scoped queue. */
  const queueRows = useMemo(() => {
    if (isManagement) return rows;
    const q = debouncedQuery.toLowerCase();
    return rows.filter((row) => {
      if (
        q &&
        !`${row.id} ${row.title} ${row.description}`.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (filters.status && row.status !== filters.status) return false;
      return true;
    });
  }, [rows, debouncedQuery, filters.status, isManagement]);

  const total = isManagement ? (meta?.total ?? 0) : queueRows.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = isManagement
    ? rows
    : queueRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const setFilter = (key: keyof ManagementFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const filtersActive =
    debouncedQuery.length > 0 ||
    Object.values(filters).some((value) => value !== "");

  const statusOptions = (
    isManagement && meta?.available_statuses.length
      ? meta.available_statuses
      : (COMPLAINT_STATUSES as readonly string[])
  ).map((value) => ({ value, label: value }));

  const description =
    role === "Agent"
      ? "Complaints assigned to you, from the live agent queue."
      : role === "Reviewer"
        ? "Complaints currently requiring manual review."
        : "All complaints in the management scope, filtered by the backend.";

  return (
    <div>
      <PageHeader title="Complaints" description={description} />

      <div className="panel mb-4 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search ID, title, description..."
            className="sm:col-span-2"
          />
          <Select
            options={statusOptions}
            placeholder="All statuses"
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}
          />
        </div>

        {isManagement && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              options={(meta?.available_departments ?? []).map((value) => ({
                value,
                label: value,
              }))}
              placeholder="All departments"
              value={filters.department}
              onChange={(e) => setFilter("department", e.target.value)}
            />
            <Select
              options={(meta?.available_categories ?? []).map((value) => ({
                value,
                label: value,
              }))}
              placeholder="All categories"
              value={filters.category}
              onChange={(e) => setFilter("category", e.target.value)}
            />
            <Select
              options={(meta?.available_priorities ?? []).map((value) => ({
                value,
                label: value,
              }))}
              placeholder="All priorities"
              value={filters.priority}
              onChange={(e) => setFilter("priority", e.target.value)}
            />
            <Input
              placeholder="Assigned agent id"
              value={filters.assigned_to}
              onChange={(e) => setFilter("assigned_to", e.target.value)}
            />
            <Input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilter("date_from", e.target.value)}
            />
            <Input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilter("date_to", e.target.value)}
            />
          </div>
        )}

        {isManagement &&
          filtersActive &&
          (meta?.available_priorities.length ?? 0) === 0 && (
            <p className="mt-2 text-[12px] text-ink-muted">
              Priority is only stored for complaints submitted after SLA
              persistence was enabled, so the priority filter may be empty.
            </p>
          )}
      </div>

      {error && (
        <p className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-[13px] text-ink-muted">Loading complaints…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          title="No complaints"
          description="The backend returned no complaints for this scope and filter."
        />
      ) : (
        <>
          <p className="mb-2 text-[12px] text-ink-muted tabular">
            {total} complaint{total === 1 ? "" : "s"}
            {isManagement && filtersActive ? " matching the filters" : ""}
          </p>
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase tracking-wide text-ink-muted">
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  {isManagement && (
                    <th className="px-3 py-2 font-medium">Category</th>
                  )}
                  <th className="px-3 py-2 font-medium">Department</th>
                  <th className="px-3 py-2 font-medium">Review</th>
                  <th className="px-3 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-line last:border-0 hover:bg-canvas-subtle"
                  >
                    <td className="px-3 py-2 font-mono text-[12px]">
                      <Link
                        className="text-primary hover:underline"
                        to={`/complaints/${row.id}`}
                      >
                        {row.id}
                      </Link>
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-ink">
                      {row.title}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        status={(row.status ?? "New") as ComplaintStatus}
                      />
                    </td>
                    {isManagement && (
                      <td className="px-3 py-2 text-ink-secondary">
                        {row.category ?? "—"}
                      </td>
                    )}
                    <td className="px-3 py-2 text-ink-secondary">
                      {row.assigned_department ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-ink-muted">
                      {row.manual_review_required
                        ? (row.review_status ?? "Pending")
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-ink-muted">
                      {row.updated_at
                        ? formatRelative(row.updated_at)
                        : row.created_at
                          ? formatRelative(row.created_at)
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={safePage}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
