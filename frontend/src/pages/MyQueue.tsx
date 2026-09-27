import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { NotAvailable } from "@/components/NotAvailable";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { SearchBar } from "@/components/SearchBar";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getAgentQueue,
  getAgentStatistics,
  type AgentStatistics,
  type WorkflowComplaint,
} from "@/api/workflows";
import { formatDate } from "@/utils/dates";
import type { ComplaintStatus, Priority } from "@/types";

function hours(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${value}h`;
}

/** Rule-engine priority label -> UI priority. Never guessed. */
const PRIORITY_MAP: Record<string, Priority> = {
  Critical: "P0",
  High: "P1",
  Medium: "P2",
  Low: "P3",
  P0: "P0",
  P1: "P1",
  P2: "P2",
  P3: "P3",
};

const KNOWN_STATUSES: ComplaintStatus[] = [
  "New",
  "Analyzed",
  "Assigned",
  "In Progress",
  "Awaiting Customer",
  "Escalated",
  "Resolved",
  "Closed",
  "Reopened",
  "Manual Review",
];

export function MyQueue() {
  const [items, setItems] = useState<WorkflowComplaint[]>([]);
  const [stats, setStats] = useState<AgentStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => {
    Promise.all([getAgentQueue(), getAgentStatistics()])
      .then(([queue, statistics]) => {
        setItems(queue);
        setStats(statistics);
      })
      .catch((e) =>
        setError(e?.response?.data?.detail ?? "Unable to load agent queue."),
      )
      .finally(() => setLoading(false));
  }, []);

  const open = useMemo(
    () =>
      items.filter(
        (x) => !["Resolved", "Closed"].includes(x.status),
      ),
    [items],
  );

  const visible = useMemo(() => {
    const source = showClosed ? items : open;
    const q = query.trim().toLowerCase();

    if (!q) return source;

    return source.filter((item) =>
      `${item.id} ${item.title} ${item.assigned_department ?? ""} ${
        item.category ?? ""
      }`
        .toLowerCase()
        .includes(q),
    );
  }, [items, open, query, showClosed]);

  return (
    <div>
      <PageHeader
        title="My queue"
        description="Complaints the workflow assigned to you. Open a complaint to start work, respond, escalate or resolve it."
        actions={
          <Link to="/complaints">
            <Button variant="outline">All complaints</Button>
          </Link>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Open assigned"
          value={stats?.open ?? open.length}
          tone="info"
          hint={`${stats?.assigned_total ?? items.length} assigned in total`}
        />
        <StatCard
          label="In progress"
          value={stats?.in_progress ?? 0}
          hint={`${stats?.awaiting_customer ?? 0} awaiting customer`}
        />
        <StatCard
          label="Escalated"
          value={stats?.escalated ?? 0}
          tone="danger"
        />
        <StatCard
          label="Resolved"
          value={stats?.resolved ?? 0}
          tone="success"
          hint={
            stats?.resolution_rate_percent === null ||
            stats?.resolution_rate_percent === undefined
              ? "No assigned complaints yet"
              : `${stats.resolution_rate_percent}% of assigned`
          }
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Avg handling time"
          value={hours(stats?.average_handling_hours)}
          hint={
            stats && stats.handling_time_unavailable > 0
              ? `${stats.measured_handling_count} measured · ${stats.handling_time_unavailable} unavailable`
              : `${stats?.measured_handling_count ?? 0} measured from workflow events`
          }
        />
        <StatCard
          label="Avg time to resolve"
          value={hours(stats?.average_resolution_hours)}
          hint={`${stats?.timed_resolutions ?? 0} resolved with timestamps`}
        />
        <StatCard
          label="Avg age of open"
          value={hours(stats?.average_open_age_hours)}
        />
        <StatCard
          label="Oldest open"
          value={hours(stats?.oldest_open_age_hours)}
          tone={
            stats?.oldest_open_age_hours && stats.oldest_open_age_hours > 72
              ? "warning"
              : "default"
          }
        />
      </div>

      {error && (
        <p className="mb-3 rounded border border-danger/30 p-3 text-[13px] text-danger">
          {error}
        </p>
      )}

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search ID, subject, department or category..."
          className="sm:max-w-sm"
        />

        <label className="flex items-center gap-2 text-[13px] text-ink-secondary">
          <input
            type="checkbox"
            checked={showClosed}
            onChange={(e) => setShowClosed(e.target.checked)}
          />
          Include resolved and closed
        </label>
      </div>

      {loading ? (
        <p className="text-[13px] text-ink-muted">Loading queue…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          title={
            query
              ? "No matching complaints"
              : showClosed
                ? "Nothing assigned yet"
                : "Queue is clear"
          }
          description={
            query
              ? "No complaint in your queue matches that search."
              : "The backend has no complaints assigned to you. Complaints reach this queue when the workflow assigns them to your account in your department."
          }
        />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase tracking-wide text-ink-muted">
                  <th className="px-3 py-2 font-medium">Complaint</th>
                  <th className="px-3 py-2 font-medium">Department</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Priority</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const priority = item.priority
                    ? (PRIORITY_MAP[item.priority.trim()] ?? null)
                    : null;

                  const status = KNOWN_STATUSES.includes(
                    item.status as ComplaintStatus,
                  )
                    ? (item.status as ComplaintStatus)
                    : null;

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-line last:border-0 hover:bg-canvas-subtle"
                    >
                      <td className="px-3 py-2">
                        <Link
                          to={`/complaints/${item.id}`}
                          className="font-mono text-[12px] text-primary hover:underline"
                        >
                          {item.id}
                        </Link>

                        <span className="mt-0.5 block max-w-md truncate font-medium text-ink">
                          {item.title}
                        </span>

                        {item.escalation_required && (
                          <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-danger">
                            <AlertTriangle size={11} />
                            Escalated
                            {item.escalation_level
                              ? ` · ${item.escalation_level}`
                              : ""}
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-2 text-ink-secondary">
                        {item.assigned_department ?? <NotAvailable />}
                      </td>

                      <td className="px-3 py-2 text-ink-secondary">
                        {item.category ?? <NotAvailable />}
                      </td>

                      <td className="px-3 py-2">
                        <PriorityBadge priority={priority} />
                      </td>

                      <td className="px-3 py-2">
                        {status ? (
                          <StatusBadge status={status} />
                        ) : (
                          <span className="text-[12px] text-ink-secondary">
                            {item.status}
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-2 text-[12px] text-ink-muted">
                        {item.created_at ? (
                          formatDate(item.created_at)
                        ) : (
                          <NotAvailable />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
