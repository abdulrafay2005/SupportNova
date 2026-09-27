import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { SearchBar } from "@/components/SearchBar";
import { Select } from "@/components/Select";
import { StatCard } from "@/components/StatCard";
import {
  getAdminAuditLogs,
  getAdminAuditSummary,
  type AuditLogsResponse,
  type AuditSummary,
} from "@/api/management";
import { formatDateTime } from "@/utils/dates";

const PAGE_SIZE = 10;

function detailText(details: Record<string, unknown>) {
  const entries = Object.entries(details ?? {}).filter(
    ([, value]) =>
      value !== null &&
      value !== undefined &&
      value !== "" &&
      !(typeof value === "object" && Object.keys(value).length === 0),
  );

  if (entries.length === 0) return "—";

  return entries
    .map(([key, value]) =>
      typeof value === "object"
        ? `${key}: ${JSON.stringify(value)}`
        : `${key}: ${String(value)}`,
    )
    .join(" · ");
}

export function AuditLogs() {
  const [data, setData] = useState<AuditLogsResponse | null>(null);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const [actorRole, setActorRole] = useState("");
  const [entityType, setEntityType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [logs, activity] = await Promise.all([
        getAdminAuditLogs({
          limit: PAGE_SIZE,
          page,
          search: query.trim() || undefined,
          action: action || undefined,
          actor_role: actorRole || undefined,
          entity_type: entityType || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
        getAdminAuditSummary(30),
      ]);

      setData(logs);
      setSummary(activity);
      setError(null);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      setError(
        typeof detail === "string" ? detail : "Unable to load audit logs.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, query, action, actorRole, entityType, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetToFirstPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  const logs = data?.logs ?? [];

  return (
    <div>
      <PageHeader
        title="Audit logs"
        description="Every administrative and workflow action recorded by the backend audit trail."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Recorded events" value={summary?.total_logs ?? 0} />
        <StatCard
          label="Last 30 days"
          value={summary?.logs_in_window ?? 0}
          tone="info"
        />
        <StatCard
          label="Distinct actions"
          value={Object.keys(summary?.action_distribution ?? {}).length}
        />
        <StatCard
          label="Last activity"
          value={
            summary?.last_activity_at
              ? formatDateTime(summary.last_activity_at)
              : "—"
          }
        />
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <SearchBar
          value={query}
          onChange={resetToFirstPage(setQuery)}
          placeholder="Search action or entity..."
          className="lg:col-span-2"
        />
        <Select
          options={(data?.available_actions ?? []).map((value) => ({
            value,
            label: value,
          }))}
          placeholder="All actions"
          value={action}
          onChange={(e) => resetToFirstPage(setAction)(e.target.value)}
        />
        <Select
          options={(data?.available_roles ?? []).map((value) => ({
            value,
            label: value,
          }))}
          placeholder="All roles"
          value={actorRole}
          onChange={(e) => resetToFirstPage(setActorRole)(e.target.value)}
        />
        <Select
          options={(data?.available_entity_types ?? []).map((value) => ({
            value,
            label: value,
          }))}
          placeholder="All entities"
          value={entityType}
          onChange={(e) => resetToFirstPage(setEntityType)(e.target.value)}
        />
        <div className="flex gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => resetToFirstPage(setDateFrom)(e.target.value)}
            aria-label="From date"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => resetToFirstPage(setDateTo)(e.target.value)}
            aria-label="To date"
          />
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded border border-danger/30 p-3 text-[13px] text-danger">
          {error}
        </p>
      )}

      {loading && !data ? (
        <p className="text-[13px] text-ink-muted">Loading audit logs…</p>
      ) : logs.length === 0 ? (
        <EmptyState
          title="No log entries"
          description="Nothing matches the current filters."
        />
      ) : (
        <>
          <div className="panel hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase tracking-wide text-ink-muted">
                    <th className="px-3 py-2 font-medium">Timestamp</th>
                    <th className="px-3 py-2 font-medium">Actor</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Entity</th>
                    <th className="px-3 py-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-line last:border-0 hover:bg-canvas-subtle"
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-[12px] tabular text-ink-muted">
                        {log.created_at ? formatDateTime(log.created_at) : "—"}
                      </td>
                      <td className="px-3 py-2 text-ink">
                        {log.actor_name ?? (
                          <span className="font-mono text-[12px] text-ink-muted">
                            {log.actor_id ?? "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-ink-secondary">
                        {log.actor_role ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-ink-secondary">
                        {log.action ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[12px]">
                        {log.entity_type ?? "—"}
                        {log.entity_id ? ` · ${log.entity_id}` : ""}
                      </td>
                      <td className="max-w-[280px] truncate px-3 py-2 text-[12px] text-ink-muted">
                        {detailText(log.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2 md:hidden">
            {logs.map((log) => (
              <div key={log.id} className="panel p-3">
                <p className="text-[12px] text-ink-faint">
                  {log.created_at ? formatDateTime(log.created_at) : "—"}
                </p>
                <p className="text-[13px] font-medium text-ink">
                  {log.action ?? "—"}
                </p>
                <p className="text-[12px] text-ink-secondary">
                  {log.actor_name ?? log.actor_id ?? "—"} ·{" "}
                  {log.actor_role ?? "—"}
                </p>
                <p className="mt-1 text-[12px] text-ink-muted">
                  {detailText(log.details)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <Pagination
              page={data?.page ?? 1}
              pageSize={data?.limit ?? PAGE_SIZE}
              total={data?.total ?? 0}
              onPageChange={setPage}
            />
          </div>
        </>
      )}

      {data && !data.result_filter_available && (
        <p className="mt-3 text-[11px] text-ink-faint">
          The audit trail records actor, role, action, entity and timestamp. It
          stores no success or failure outcome, so results cannot be filtered
          on one.
        </p>
      )}
    </div>
  );
}
