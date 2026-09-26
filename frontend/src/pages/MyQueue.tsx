import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import {
  getAgentQueue,
  getAgentStatistics,
  type AgentStatistics,
  type WorkflowComplaint,
} from "@/api/workflows";

function hours(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${value}h`;
}

export function MyQueue() {
  const [items, setItems] = useState<WorkflowComplaint[]>([]);
  const [stats, setStats] = useState<AgentStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const open = items.filter((x) => !["Resolved", "Closed"].includes(x.status));

  return (
    <div>
      <PageHeader
        title="My queue"
        description="Complaints assigned to the authenticated agent."
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

      {error && <p className="mb-3 text-danger">{error}</p>}

      {loading ? (
        <p className="text-ink-muted">Loading queue…</p>
      ) : open.length === 0 ? (
        <EmptyState
          title="Queue is clear"
          description="The backend has no open complaints assigned to you."
        />
      ) : (
        <div className="panel divide-y divide-line">
          {open.map((item) => (
            <Link
              className="block p-3 hover:bg-canvas-subtle"
              key={item.id}
              to={`/complaints/${item.id}`}
            >
              <span className="font-mono text-[12px] text-primary">
                {item.id}
              </span>
              <span className="ml-3 text-[13px] font-medium">{item.title}</span>
              <span className="float-right text-[12px] text-ink-muted">
                {item.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
