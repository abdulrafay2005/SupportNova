import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Select } from "@/components/Select";
import {
  getDepartmentPerformance,
  getManagementAnalytics,
  getManagementEscalations,
  getManagementSla,
  getManagementTrends,
  getResolutionStatistics,
  getSentimentDistribution,
  type ComplaintTrends,
  type DepartmentPerformance,
  type EscalationOverview,
  type OperationalAnalytics,
  type SlaOverview,
  type ResolutionStatistics,
  type SentimentDistribution,
} from "@/api/management";
import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import type { ComplaintStatus } from "@/types";
import { formatDateTime } from "@/utils/dates";

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

function hours(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${value}h`;
}

function percent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${value}%`;
}

function DistributionBars({
  distribution,
  emptyLabel,
  barClass = "bg-primary",
}: {
  distribution: Record<string, number>;
  emptyLabel: string;
  barClass?: string;
}) {
  const entries = Object.entries(distribution);

  if (entries.length === 0) {
    return <p className="text-[12px] text-ink-muted">{emptyLabel}</p>;
  }

  const max = Math.max(...entries.map(([, value]) => value), 1);

  return (
    <ul className="space-y-2">
      {entries.map(([label, value]) => (
        <li key={label} className="flex items-center gap-3 text-[12px]">
          <span className="w-32 shrink-0 truncate text-ink-secondary" title={label}>
            {label}
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-sm bg-canvas">
            <span
              className={`block h-full ${barClass}`}
              style={{ width: `${(value / max) * 100}%` }}
            />
          </span>
          <span className="w-8 text-right tabular text-ink">{value}</span>
        </li>
      ))}
    </ul>
  );
}

export function Analytics() {
  const [days, setDays] = useState("30");
  const [analytics, setAnalytics] = useState<OperationalAnalytics | null>(null);
  const [trends, setTrends] = useState<ComplaintTrends | null>(null);
  const [performance, setPerformance] = useState<DepartmentPerformance | null>(
    null,
  );
  const [resolution, setResolution] = useState<ResolutionStatistics | null>(
    null,
  );
  const [sentiment, setSentiment] = useState<SentimentDistribution | null>(null);
  const [escalations, setEscalations] = useState<EscalationOverview | null>(
    null,
  );
  const [sla, setSla] = useState<SlaOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getManagementAnalytics(),
      getManagementTrends({ days: Number(days) }),
      getDepartmentPerformance(),
      getResolutionStatistics(),
      getSentimentDistribution(),
      getManagementEscalations(),
      getManagementSla(),
    ])
      .then(
        ([
          operational,
          trend,
          departments,
          resolutionStats,
          sentiments,
          escalationOverview,
          slaOverview,
        ]) => {
          if (cancelled) return;
          setAnalytics(operational);
          setTrends(trend);
          setPerformance(departments);
          setResolution(resolutionStats);
          setSentiment(sentiments);
          setEscalations(escalationOverview);
          setSla(slaOverview);
          setError(null);
        },
      )
      .catch((e) => {
        if (cancelled) return;
        setError(e?.response?.data?.detail ?? "Unable to load analytics.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [days]);

  const points = trends?.points ?? [];
  const maxVolume = Math.max(...points.map((p) => p.created), 1);

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Operational analytics aggregated from stored complaints, analyses and workflow activity."
        actions={
          <Select
            value={days}
            onChange={(event) => setDays(event.target.value)}
            options={RANGE_OPTIONS}
            aria-label="Trend range"
          />
        }
      />

      {error && (
        <p className="mb-3 rounded border border-danger/30 p-3 text-[13px] text-danger">
          {error}
        </p>
      )}

      {loading && !analytics ? (
        <p className="text-[13px] text-ink-muted">Loading analytics…</p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Total complaints"
              value={analytics?.total_complaints ?? 0}
              hint={`${trends?.totals.created ?? 0} created in the last ${
                trends?.days ?? days
              } days`}
            />
            <StatCard
              label="Resolved"
              value={resolution?.resolved_complaints ?? 0}
              tone="success"
              hint={`${percent(
                resolution?.resolution_rate_percent,
              )} of all complaints`}
            />
            <StatCard
              label="Avg. resolution time"
              value={hours(resolution?.average_resolution_hours)}
              hint={`median ${hours(
                resolution?.median_resolution_hours,
              )} · ${resolution?.timed_resolutions ?? 0} measured`}
            />
            <StatCard
              label="Escalations"
              value={analytics?.escalation_count ?? 0}
              tone="danger"
              hint={`${
                analytics?.escalation_required_count ?? 0
              } flagged by analysis`}
            />
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Open complaints"
              value={resolution?.open_complaints ?? 0}
              tone="info"
            />
            <StatCard
              label="Manual review"
              value={analytics?.manual_review_count ?? 0}
              tone="warning"
              hint={`${
                analytics?.manual_review_completed_count ?? 0
              } reviews completed`}
            />
            <StatCard
              label="Validation failures"
              value={analytics?.validation.validation_failed ?? 0}
              hint={`${percent(
                analytics?.validation.pass_rate_percent,
              )} pass rate`}
            />
            <StatCard
              label="Resolved last 7 days"
              value={resolution?.resolved_last_7_days ?? 0}
              hint={`${
                resolution?.resolved_last_30_days ?? 0
              } in the last 30 days`}
            />
          </div>

          <div className="mb-5 grid gap-4 lg:grid-cols-5">
            <section className="panel p-4 lg:col-span-3">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-[13px] font-semibold text-ink">
                  Volume by day
                </h2>
                <p className="text-[12px] text-ink-muted">
                  {trends
                    ? `${trends.start_date} → ${trends.end_date}`
                    : "No data"}
                </p>
              </div>

              {points.length === 0 ? (
                <p className="text-[12px] text-ink-muted">
                  No complaints in this period.
                </p>
              ) : (
                <div className="flex h-40 items-end gap-1.5">
                  {points.map((point) => (
                    <div
                      key={point.date}
                      className="flex flex-1 flex-col items-center gap-1"
                    >
                      <div className="flex h-32 w-full items-end">
                        <div
                          className="w-full rounded-sm bg-primary/80"
                          style={{
                            height: `${(point.created / maxVolume) * 100}%`,
                          }}
                          title={`${point.date}: ${point.created} created, ${point.resolved} resolved, ${point.escalated} escalated`}
                        />
                      </div>
                      <span className="text-[10px] tabular text-ink-faint">
                        {point.date.slice(8)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-3 text-[12px] text-ink-muted">
                {trends?.totals.created ?? 0} created ·{" "}
                {trends?.totals.resolved ?? 0} resolved ·{" "}
                {trends?.totals.escalated ?? 0} escalated
                {trends && trends.undated_complaints > 0
                  ? ` · ${trends.undated_complaints} without a creation date`
                  : ""}
              </p>
            </section>

            <section className="panel p-4 lg:col-span-2">
              <h2 className="mb-3 text-[13px] font-semibold text-ink">
                Status distribution
              </h2>
              <p className="mb-3 text-[12px] text-ink-muted">
                {resolution?.open_complaints ?? 0} open ·{" "}
                {analytics?.total_complaints ?? 0} total
              </p>
              <DistributionBars
                distribution={analytics?.status_distribution ?? {}}
                emptyLabel="No complaints recorded yet."
              />
            </section>
          </div>

          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            <section className="panel p-4">
              <h2 className="mb-3 text-[13px] font-semibold text-ink">
                Complaint categories
              </h2>
              <DistributionBars
                distribution={analytics?.category_distribution ?? {}}
                emptyLabel="No analysed complaints yet."
                barClass="bg-secondary-dark"
              />
              {analytics && analytics.complaints_without_analysis > 0 && (
                <p className="mt-3 text-[11px] text-ink-faint">
                  {analytics.complaints_without_analysis} complaint(s) have no
                  stored analysis.
                </p>
              )}
            </section>

            <section className="panel overflow-hidden">
              <div className="border-b border-line px-4 py-2.5">
                <h2 className="text-[13px] font-semibold text-ink">
                  Department performance
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase tracking-wide text-ink-muted">
                      <th className="px-3 py-2 font-medium">Department</th>
                      <th className="px-3 py-2 font-medium">Total</th>
                      <th className="px-3 py-2 font-medium">Open</th>
                      <th className="px-3 py-2 font-medium">Escalated</th>
                      <th className="px-3 py-2 font-medium">Resolved</th>
                      <th className="px-3 py-2 font-medium">Avg. time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(performance?.departments ?? []).length === 0 ? (
                      <tr>
                        <td
                          className="px-3 py-3 text-[12px] text-ink-muted"
                          colSpan={6}
                        >
                          No complaints recorded yet.
                        </td>
                      </tr>
                    ) : (
                      performance?.departments.map((row) => (
                        <tr
                          key={row.department}
                          className="border-b border-line last:border-0"
                        >
                          <td className="px-3 py-2 text-ink">
                            {row.department}
                          </td>
                          <td className="px-3 py-2 tabular">{row.total}</td>
                          <td className="px-3 py-2 tabular">{row.open}</td>
                          <td className="px-3 py-2 tabular text-danger">
                            {row.escalated}
                          </td>
                          <td className="px-3 py-2 tabular">{row.resolved}</td>
                          <td className="px-3 py-2 tabular text-ink-muted">
                            {hours(row.average_resolution_hours)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="panel p-4">
              <h2 className="mb-3 text-[13px] font-semibold text-ink">
                Sentiment
              </h2>
              <DistributionBars
                distribution={sentiment?.distribution ?? {}}
                emptyLabel="No sentiment labels stored yet."
                barClass="bg-warning"
              />
              {sentiment && sentiment.complaints_without_analysis > 0 && (
                <p className="mt-3 text-[11px] text-ink-faint">
                  {sentiment.complaints_without_analysis} complaint(s) without
                  an analysis.
                </p>
              )}
            </section>

            <section className="panel p-4">
              <h2 className="mb-3 text-[13px] font-semibold text-ink">
                Escalation levels
              </h2>
              <DistributionBars
                distribution={analytics?.escalation_level_distribution ?? {}}
                emptyLabel="No escalation levels recorded."
                barClass="bg-danger"
              />
            </section>

            <section className="panel p-4">
              <h2 className="mb-3 text-[13px] font-semibold text-ink">
                Python validation
              </h2>
              <ul className="space-y-1.5 text-[12px]">
                <li className="flex justify-between">
                  <span className="text-ink-muted">Analyses checked</span>
                  <span className="tabular font-medium">
                    {analytics?.validation.analyzed_complaints ?? 0}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-ink-muted">Passed</span>
                  <span className="tabular font-medium text-success">
                    {analytics?.validation.validation_passed ?? 0}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-ink-muted">Failed</span>
                  <span className="tabular font-medium text-danger">
                    {analytics?.validation.validation_failed ?? 0}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-ink-muted">Ground truth valid</span>
                  <span className="tabular font-medium">
                    {analytics?.validation.ground_truth_valid ?? 0}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-ink-muted">AI output blocked</span>
                  <span className="tabular font-medium">
                    {analytics?.validation.ai_output_blocked ?? 0}
                  </span>
                </li>
              </ul>

              {analytics &&
                !analytics.validation.field_level_comparison_available && (
                  <p className="mt-3 text-[11px] text-ink-faint">
                    Field-level GenAI vs Python comparison is not stored by the
                    analysis pipeline, so it cannot be reported.
                  </p>
                )}
            </section>
          </div>

          <section className="panel mt-5 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink">
                SLA status
              </h2>
              <p className="text-[12px] text-ink-muted">
                Targets come from the rule engine; at risk means{" "}
                {Math.round((sla?.at_risk_threshold_ratio ?? 0.2) * 100)}% or
                less of the window remains
              </p>
            </div>

            <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Breached"
                value={sla?.breached ?? 0}
                tone="danger"
                hint={`${sla?.at_risk ?? 0} at risk · ${
                  sla?.on_track ?? 0
                } on track`}
              />
              <StatCard
                label="Resolved within SLA"
                value={sla?.met ?? 0}
                tone="success"
                hint={`${percent(sla?.compliance_percent)} compliance`}
              />
              <StatCard
                label="Complaints with a target"
                value={sla?.with_sla_target ?? 0}
                hint={`${percent(sla?.coverage_percent)} of all complaints`}
              />
              <StatCard
                label="No SLA data"
                value={sla?.without_sla_target ?? 0}
                tone="warning"
                hint="Created before SLA targets were stored"
              />
            </div>

            {(sla?.attention ?? []).length > 0 && (
              <div className="overflow-x-auto border-b border-line">
                <table className="w-full min-w-[720px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase tracking-wide text-ink-muted">
                      <th className="px-3 py-2 font-medium">Complaint</th>
                      <th className="px-3 py-2 font-medium">Priority</th>
                      <th className="px-3 py-2 font-medium">Department</th>
                      <th className="px-3 py-2 font-medium">Target</th>
                      <th className="px-3 py-2 font-medium">Due</th>
                      <th className="px-3 py-2 font-medium">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sla?.attention.slice(0, 10).map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-line last:border-0"
                      >
                        <td className="px-3 py-2">
                          <Link
                            className="text-primary hover:underline"
                            to={`/complaints/${row.id}`}
                          >
                            {row.title}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{row.priority ?? "—"}</td>
                        <td className="px-3 py-2">
                          {row.assigned_department ?? "Unassigned"}
                        </td>
                        <td className="px-3 py-2 tabular">
                          {row.sla_hours ? `${row.sla_hours}h` : "—"}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-ink-muted">
                          {row.sla_due_at
                            ? formatDateTime(row.sla_due_at)
                            : "—"}
                        </td>
                        <td
                          className={
                            row.sla_state === "Breached"
                              ? "px-3 py-2 font-medium text-danger"
                              : "px-3 py-2 font-medium text-warning"
                          }
                        >
                          {row.sla_state}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sla && sla.with_sla_target === 0 && (
              <p className="border-b border-line px-4 py-3 text-[12px] text-ink-muted">
                No complaint carries a stored SLA target yet. Targets are
                persisted for complaints submitted from now on.
              </p>
            )}
          </section>

          <section className="panel mt-5 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink">
                Escalations
              </h2>
              <p className="text-[12px] text-ink-muted">
                {escalations?.statistics.currently_escalated ?? 0} open ·{" "}
                {escalations?.statistics.ever_escalated ?? 0} escalated at some
                point · {escalations?.statistics.resolved_after_escalation ?? 0}{" "}
                later resolved
              </p>
            </div>

            <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Currently escalated"
                value={escalations?.statistics.currently_escalated ?? 0}
                tone="danger"
              />
              <StatCard
                label="Avg. time since escalation"
                value={hours(
                  escalations?.statistics.average_hours_since_escalation,
                )}
                hint={
                  escalations &&
                  escalations.statistics.escalation_time_unavailable > 0
                    ? `${escalations.statistics.escalation_time_unavailable} without a recorded escalation event`
                    : undefined
                }
              />
              <StatCard
                label="Longest open escalation"
                value={hours(
                  escalations?.statistics.longest_hours_since_escalation,
                )}
                tone="warning"
              />
              <StatCard
                label="Resolved after escalation"
                value={escalations?.statistics.resolved_after_escalation ?? 0}
                tone="success"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase tracking-wide text-ink-muted">
                    <th className="px-3 py-2 font-medium">Complaint</th>
                    <th className="px-3 py-2 font-medium">Level</th>
                    <th className="px-3 py-2 font-medium">Reason</th>
                    <th className="px-3 py-2 font-medium">Department</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Escalated</th>
                  </tr>
                </thead>
                <tbody>
                  {(escalations?.escalations ?? []).length === 0 ? (
                    <tr>
                      <td
                        className="px-3 py-3 text-[12px] text-ink-muted"
                        colSpan={6}
                      >
                        No complaints are currently escalated.
                      </td>
                    </tr>
                  ) : (
                    escalations?.escalations.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-line last:border-0"
                      >
                        <td className="px-3 py-2">
                          <Link
                            className="text-primary hover:underline"
                            to={`/complaints/${row.id}`}
                          >
                            {row.title}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          {row.escalation_level ?? (
                            <span className="text-ink-faint">Not recorded</span>
                          )}
                        </td>
                        <td className="max-w-[260px] truncate px-3 py-2 text-ink-secondary">
                          {row.escalation_reason ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {row.assigned_department ?? "Unassigned"}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            status={(row.status ?? "Escalated") as ComplaintStatus}
                          />
                        </td>
                        <td className="px-3 py-2 text-[12px] text-ink-muted">
                          {row.escalated_at
                            ? formatDateTime(row.escalated_at)
                            : "Not recorded"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {analytics && analytics.priority_unavailable_count > 0 && (
            <p className="mt-4 text-[11px] text-ink-faint">
              Priority is available for{" "}
              {analytics.total_complaints -
                analytics.priority_unavailable_count}{" "}
              of {analytics.total_complaints} complaints;{" "}
              {analytics.priority_unavailable_count} were created before
              priority was persisted.
            </p>
          )}
        </>
      )}
    </div>
  );
}
