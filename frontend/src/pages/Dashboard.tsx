import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/auth/AuthContext";
import { useData } from "@/context/DataContext";
import { OPEN_STATUSES, type ComplaintStatus } from "@/types";
import { customerNextStep } from "@/utils/classify";
import { greetingForNow, todayLabel, formatRelative } from "@/utils/dates";
import {
  getAgentQueue,
  getAgentStatistics,
  getReviewQueue,
  getReviewStatistics,
  type AgentStatistics,
  type ReviewStatistics,
  type WorkflowComplaint,
} from "@/api/workflows";
import {
  getAdminStatistics,
  getManagementAnalytics,
  getManagementTrends,
  getResolutionStatistics,
  type AdminStatistics,
  type ComplaintTrends,
  type OperationalAnalytics,
  type ResolutionStatistics,
} from "@/api/management";

// ============================================================
// SHARED HELPERS
//
// Every figure on this page comes from the backend. Metrics the
// stored data cannot support are rendered as "—" instead of a
// fabricated number.
// ============================================================

function hours(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${value}h`;
}

function percent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${value}%`;
}

function DistributionPanel({
  title,
  distribution,
  emptyLabel,
  barClass = "bg-primary",
  footer,
}: {
  title: string;
  distribution: Record<string, number>;
  emptyLabel: string;
  barClass?: string;
  footer?: string;
}) {
  const entries = Object.entries(distribution);
  const max = Math.max(...entries.map(([, value]) => value), 1);

  return (
    <div className="panel p-4">
      <p className="mb-3 text-[13px] font-semibold text-ink">{title}</p>

      {entries.length === 0 ? (
        <p className="text-[12px] text-ink-muted">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {entries.map(([label, value]) => (
            <li key={label} className="flex items-center gap-3 text-[12px]">
              <span
                className="w-32 shrink-0 truncate text-ink-secondary"
                title={label}
              >
                {label}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-sm bg-canvas">
                <span
                  className={`block h-full ${barClass}`}
                  style={{ width: `${(value / max) * 100}%` }}
                />
              </span>
              <span className="w-6 text-right tabular text-ink">{value}</span>
            </li>
          ))}
        </ul>
      )}

      {footer && <p className="mt-3 text-[11px] text-ink-faint">{footer}</p>}
    </div>
  );
}

function QueueList({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: WorkflowComplaint[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="panel divide-y divide-line">
      {items.map((item) => (
        <Link
          key={item.id}
          to={`/complaints/${item.id}`}
          className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-canvas-subtle"
        >
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-ink">
              {item.title}
            </p>
            <p className="font-mono text-[11px] text-primary">{item.id}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-[12px] text-ink-muted">
              {item.assigned_department ?? "Unassigned"}
            </span>
            <StatusBadge status={item.status as ComplaintStatus} />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ============================================================
// ROLE ROUTER
// ============================================================

export function Dashboard() {
  const { user } = useAuth();

  if (!user) return null;
  if (user.role === "Customer") return <CustomerHome />;
  if (user.role === "Agent") return <AgentHome />;
  if (user.role === "Reviewer") return <ReviewerHome />;

  return <ManagementHome />;
}

// ============================================================
// AGENT
// ============================================================

function AgentHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AgentStatistics | null>(null);
  const [queue, setQueue] = useState<WorkflowComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getAgentStatistics(), getAgentQueue()])
      .then(([statistics, items]) => {
        setStats(statistics);
        setQueue(items);
        setError(null);
      })
      .catch((e) =>
        setError(e?.response?.data?.detail ?? "Unable to load your workload."),
      )
      .finally(() => setLoading(false));
  }, []);

  const open = queue.filter((item) => !["Resolved", "Closed"].includes(item.status));

  return (
    <div>
      <PageHeader
        title={`${greetingForNow()}, ${user?.name.split(" ")[0]}`}
        description={`${todayLabel()}. Complaints assigned to you, with handling times measured from recorded workflow events.`}
        actions={
          <Link to="/queue">
            <Button variant="outline">View queue</Button>
          </Link>
        }
      />

      {error && <p className="mb-3 text-[13px] text-danger">{error}</p>}

      <section className="mb-5">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Workload
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Open assigned"
            value={stats?.open ?? 0}
            hint={`${stats?.assigned_total ?? 0} assigned in total`}
            tone="info"
            icon={<Inbox size={16} />}
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
            icon={<AlertTriangle size={16} />}
          />
          <StatCard
            label="Resolved"
            value={stats?.resolved ?? 0}
            tone="success"
            hint={percent(stats?.resolution_rate_percent)}
            icon={<CheckCircle2 size={16} />}
          />
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Timing
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Avg handling time"
            value={hours(stats?.average_handling_hours)}
            hint={`${stats?.measured_handling_count ?? 0} measured · ${
              stats?.handling_time_unavailable ?? 0
            } unavailable`}
          />
          <StatCard
            label="Avg time to resolve"
            value={hours(stats?.average_resolution_hours)}
            hint={`${stats?.timed_resolutions ?? 0} resolutions`}
          />
          <StatCard
            label="Oldest open case"
            value={hours(stats?.oldest_open_age_hours)}
            tone="warning"
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              My queue
            </h2>
            <Link
              to="/queue"
              className="text-[12px] font-medium text-primary hover:underline"
            >
              Open queue
            </Link>
          </div>

          {loading ? (
            <p className="text-[13px] text-ink-muted">Loading queue…</p>
          ) : (
            <QueueList
              items={open.slice(0, 6)}
              emptyTitle="Nothing in your queue"
              emptyDescription="You have no open complaints assigned to you."
            />
          )}
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Recent activity
          </h2>

          {(stats?.recent_activity ?? []).length === 0 ? (
            <div className="panel px-3 py-4">
              <p className="text-[12px] text-ink-muted">
                No recorded activity yet.
              </p>
            </div>
          ) : (
            <div className="panel divide-y divide-line">
              {stats?.recent_activity.map((entry) => (
                <Link
                  key={`${entry.complaint_id}-${entry.timestamp}`}
                  to={`/complaints/${entry.complaint_id}`}
                  className="block px-3 py-2.5 hover:bg-canvas-subtle"
                >
                  <p className="text-[13px] text-ink">
                    <span className="font-medium">{entry.title}</span>
                  </p>
                  <p className="text-[12px] text-ink-muted">
                    {formatRelative(entry.timestamp)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ============================================================
// REVIEWER
// ============================================================

function ReviewerHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ReviewStatistics | null>(null);
  const [queue, setQueue] = useState<WorkflowComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getReviewStatistics(), getReviewQueue()])
      .then(([statistics, items]) => {
        setStats(statistics);
        setQueue(items);
        setError(null);
      })
      .catch((e) =>
        setError(
          e?.response?.data?.detail ?? "Unable to load review statistics.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title={`${greetingForNow()}, ${user?.name.split(" ")[0]}`}
        description={`${todayLabel()}. Complaints awaiting human validation, and the outcomes of completed reviews.`}
        actions={
          <Link to="/manual-review">
            <Button variant="outline">Open review queue</Button>
          </Link>
        }
      />

      {error && <p className="mb-3 text-[13px] text-danger">{error}</p>}

      <section className="mb-5">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Review workload
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Pending reviews"
            value={stats?.pending_reviews ?? 0}
            tone="warning"
            icon={<ClipboardCheck size={16} />}
          />
          <StatCard
            label="Completed reviews"
            value={stats?.completed_reviews ?? 0}
            tone="success"
          />
          <StatCard
            label="My review actions"
            value={stats?.my_statistics?.actions ?? 0}
            hint={`${stats?.my_statistics?.approvals ?? 0} approved · ${
              stats?.my_statistics?.rejections ?? 0
            } rejected`}
          />
          <StatCard
            label="Validation failures"
            value={stats?.validation.validation_failed ?? 0}
            tone="danger"
            hint={`${percent(stats?.validation.pass_rate_percent)} pass rate`}
          />
        </div>
      </section>

      <div className="mb-5 grid gap-3 lg:grid-cols-2">
        <DistributionPanel
          title="Review outcomes"
          distribution={stats?.outcome_counts ?? {}}
          emptyLabel="No review actions recorded yet."
        />
        <DistributionPanel
          title="Validation issues"
          distribution={stats?.validation.issue_code_distribution ?? {}}
          emptyLabel="No validation issues recorded."
          barClass="bg-danger"
          footer={
            stats && !stats.validation.field_level_comparison_available
              ? "Field-level GenAI vs Python comparison is not stored by the analysis pipeline."
              : undefined
          }
        />
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Pending review queue
          </h2>
          <Link
            to="/manual-review"
            className="text-[12px] font-medium text-primary hover:underline"
          >
            Open manual review
          </Link>
        </div>

        {loading ? (
          <p className="text-[13px] text-ink-muted">Loading review queue…</p>
        ) : (
          <QueueList
            items={queue.slice(0, 6)}
            emptyTitle="No cases in review"
            emptyDescription="The backend has no pending manual review cases."
          />
        )}
      </section>
    </div>
  );
}

// ============================================================
// MANAGER + ADMIN
// ============================================================

function ManagementHome() {
  const { user } = useAuth();
  const { complaints } = useData();

  const [analytics, setAnalytics] = useState<OperationalAnalytics | null>(null);
  const [resolution, setResolution] = useState<ResolutionStatistics | null>(
    null,
  );
  const [trends, setTrends] = useState<ComplaintTrends | null>(null);
  const [admin, setAdmin] = useState<AdminStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === "Admin";

  useEffect(() => {
    Promise.all([
      getManagementAnalytics(),
      getResolutionStatistics(),
      getManagementTrends({ days: 7 }),
      isAdmin ? getAdminStatistics() : Promise.resolve(null),
    ])
      .then(([operational, resolutionStats, trend, adminStats]) => {
        setAnalytics(operational);
        setResolution(resolutionStats);
        setTrends(trend);
        setAdmin(adminStats);
        setError(null);
      })
      .catch((e) =>
        setError(e?.response?.data?.detail ?? "Unable to load analytics."),
      )
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const recent = [...complaints]
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        title={`${greetingForNow()}, ${user?.name.split(" ")[0]}`}
        description={`${todayLabel()}. Workload, validation status and escalations aggregated from stored complaint data.`}
        actions={
          <>
            <Link to="/analytics">
              <Button>Analytics</Button>
            </Link>
            <Link to="/complaints">
              <Button variant="outline">All complaints</Button>
            </Link>
          </>
        }
      />

      {error && <p className="mb-3 text-[13px] text-danger">{error}</p>}

      <section className="mb-5">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Workload
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Open complaints"
            value={resolution?.open_complaints ?? 0}
            hint={`${analytics?.total_complaints ?? 0} complaints in total`}
            tone="info"
            icon={<Inbox size={16} />}
          />
          <StatCard
            label="Manual review"
            value={analytics?.manual_review_count ?? 0}
            hint={`${
              analytics?.manual_review_completed_count ?? 0
            } reviews completed`}
            tone="warning"
            icon={<ClipboardCheck size={16} />}
          />
          <StatCard
            label="Escalated"
            value={analytics?.escalation_count ?? 0}
            hint={`${
              analytics?.escalation_required_count ?? 0
            } flagged by analysis`}
            tone="danger"
            icon={<AlertTriangle size={16} />}
          />
          <StatCard
            label="Resolved"
            value={resolution?.resolved_complaints ?? 0}
            hint={`${resolution?.resolved_last_7_days ?? 0} in the last 7 days`}
            tone="success"
            icon={<CheckCircle2 size={16} />}
          />
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Quality and timing
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Validation failures"
            value={analytics?.validation.validation_failed ?? 0}
            hint={`${percent(
              analytics?.validation.pass_rate_percent,
            )} pass rate`}
          />
          <StatCard
            label="AI output blocked"
            value={analytics?.validation.ai_output_blocked ?? 0}
            hint="Rejected by the Python guard"
          />
          <StatCard
            label="Avg. resolution time"
            value={hours(resolution?.average_resolution_hours)}
            hint={`${resolution?.timed_resolutions ?? 0} measured`}
          />
          <StatCard
            label="Created last 7 days"
            value={trends?.totals.created ?? 0}
            hint={`${trends?.totals.escalated ?? 0} escalations recorded`}
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Recent complaints
          </h2>

          {recent.length === 0 ? (
            <EmptyState
              title="No complaints yet"
              description="Complaints submitted by customers will appear here."
            />
          ) : (
            <div className="panel divide-y divide-line">
              {recent.map((complaint) => (
                <Link
                  key={complaint.id}
                  to={`/complaints/${complaint.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-canvas-subtle"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {complaint.subject}
                    </p>
                    <p className="text-[12px] text-ink-muted">
                      {complaint.department} · updated{" "}
                      {formatRelative(complaint.updatedAt)}
                    </p>
                  </div>
                  <StatusBadge status={complaint.status} />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Departments
          </h2>
          <DistributionPanel
            title="Complaints by department"
            distribution={analytics?.department_distribution ?? {}}
            emptyLabel="No complaints recorded yet."
            barClass="bg-secondary-dark"
          />
        </section>
      </div>

      {isAdmin && (
        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Administration
            </h2>
            <Link
              to="/audit-logs"
              className="text-[12px] font-medium text-primary hover:underline"
            >
              Audit logs
            </Link>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Users"
              value={admin?.users.total ?? 0}
              hint={`${
                admin?.users.status_distribution.Active ?? 0
              } active · ${
                admin?.users.status_distribution.Inactive ?? 0
              } inactive`}
            />
            <StatCard
              label="Agents"
              value={admin?.users.role_distribution.Agent ?? 0}
              hint={`${
                admin?.users.role_distribution.Reviewer ?? 0
              } reviewers · ${
                admin?.users.role_distribution.Manager ?? 0
              } managers`}
            />
            <StatCard
              label="Audit events (30d)"
              value={admin?.audit.logs_in_window ?? 0}
              hint={`${admin?.audit.total_logs ?? 0} recorded in total`}
            />
            <StatCard
              label="Complaints without analysis"
              value={admin?.complaints.without_analysis ?? 0}
              tone={
                (admin?.complaints.without_analysis ?? 0) > 0
                  ? "warning"
                  : "default"
              }
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <DistributionPanel
              title="Users by role"
              distribution={admin?.users.role_distribution ?? {}}
              emptyLabel="No user accounts stored."
            />
            <DistributionPanel
              title="Audit activity by role"
              distribution={admin?.audit.actor_role_distribution ?? {}}
              emptyLabel="No audit activity in the last 30 days."
              barClass="bg-secondary-dark"
            />
            <div className="panel p-4">
              <p className="mb-3 text-[13px] font-semibold text-ink">
                Most active accounts
              </p>

              {(admin?.audit.top_actors ?? []).length === 0 ? (
                <p className="text-[12px] text-ink-muted">
                  No audit activity in the last 30 days.
                </p>
              ) : (
                <ul className="space-y-1.5 text-[12px]">
                  {admin?.audit.top_actors.slice(0, 6).map((actor) => (
                    <li
                      key={actor.actor_id}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="truncate text-ink-secondary">
                        {actor.actor_name ?? actor.actor_id}
                      </span>
                      <span className="tabular font-medium">
                        {actor.actions}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="mt-5">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Complaint overview
        </h2>

        {loading && !analytics ? (
          <p className="text-[13px] text-ink-muted">Loading analytics…</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            <DistributionPanel
              title="Status distribution"
              distribution={analytics?.status_distribution ?? {}}
              emptyLabel="No complaints recorded yet."
            />
            <DistributionPanel
              title="Category distribution"
              distribution={analytics?.category_distribution ?? {}}
              emptyLabel="No analysed complaints yet."
              barClass="bg-secondary-dark"
              footer={
                analytics && analytics.complaints_without_analysis > 0
                  ? `${analytics.complaints_without_analysis} complaint(s) have no stored analysis.`
                  : undefined
              }
            />
          </div>
        )}
      </section>
    </div>
  );
}

// ============================================================
// CUSTOMER (unchanged behaviour)
// ============================================================

function CustomerHome() {
  const { user } = useAuth();
  const { complaints } = useData();
  if (!user) return null;
  const mine = complaints
    .filter((c) => c.customerId === user.id)
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  const open = mine.filter((c) => OPEN_STATUSES.includes(c.status));

  return (
    <div>
      <PageHeader
        title={`${greetingForNow()}, ${user.name.split(" ")[0]}`}
        description="Track your support requests and see what happens next."
        actions={
          <Link to="/complaints/new">
            <Button>Submit a complaint</Button>
          </Link>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Open requests" value={open.length} tone="info" />
        <StatCard label="Total submitted" value={mine.length} />
        <StatCard
          label="Latest update"
          value={mine[0] ? formatRelative(mine[0].updatedAt) : "—"}
          hint={mine[0]?.id}
        />
      </div>
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
        Your complaints
      </h2>
      {mine.length === 0 ? (
        <div className="panel px-5 py-10 text-center">
          <p className="text-sm font-semibold text-ink">
            You have not submitted a complaint yet
          </p>
          <p className="mt-1 text-[13px] text-ink-muted">
            When you do, you will see status, department, and next steps here.
          </p>
          <Link to="/complaints/new" className="mt-4 inline-block">
            <Button>Submit a complaint</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {mine.map((c) => (
            <Link
              key={c.id}
              to={`/complaints/${c.id}`}
              className="panel flex flex-col gap-2 p-4 hover:border-line-strong sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-mono text-[11px] text-primary">{c.id}</p>
                <p className="truncate text-[14px] font-medium text-ink">
                  {c.subject}
                </p>
                <p className="text-[12px] text-ink-muted">
                  {c.department} · Updated {formatRelative(c.updatedAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={c.status} />
                <span className="text-[12px] text-ink-muted">
                  {customerNextStep(c.status)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
