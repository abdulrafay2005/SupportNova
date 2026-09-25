import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { useData } from "@/context/DataContext";
import { COMPLAINT_STATUSES } from "@/types";
import { analyticsDemo } from "@/data/mockData";

export function Analytics() {
  const { complaints } = useData();
  const { volumeByDay, categoryCounts, departmentWorkload, avgResolutionHours, volume30d, resolved30d, escalations30d, trends, repeatComplaints } =
    analyticsDemo;
  const maxVol = Math.max(...volumeByDay);
  const maxCat = Math.max(...categoryCounts.map((c) => c.value));
  const liveEsc = complaints.filter((c) => c.escalated && !["Resolved", "Closed"].includes(c.status)).length;
  const liveOpen = complaints.filter((c) => !["Resolved", "Closed"].includes(c.status)).length;
  const manual = complaints.filter((c) => c.validation === "Mismatch" || c.validation === "Manual Review Required").length;
  const mismatch = complaints.filter((c) => c.validationDetail.overall === "Mismatch").length;
  const sla = complaints.filter((c) => c.slaRisk).length;

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Operational view of this demo workspace. Figures are illustrative mock data, not organisational performance."
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Complaint volume" value={volume30d} hint="Last 30 days · demo" />
        <StatCard label="Resolved (demo 30d)" value={resolved30d} hint="Count only — not a success rate" />
        <StatCard label="Avg. resolution time" value={`${avgResolutionHours}h`} hint="Demo average" />
        <StatCard label="Escalations" value={escalations30d} hint={`${liveEsc} currently open`} tone="danger" />
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="SLA risk" value={sla} hint="Open cases flagged" tone="warning" />
        <StatCard label="Repeat complaints" value={repeatComplaints} hint="Demo 30 days" />
        <StatCard label="Manual review" value={manual} hint="Open in this workspace" />
        <StatCard label="GenAI / Python mismatch" value={mismatch} hint="Field disagreements" />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-5">
        <section className="panel p-4 lg:col-span-3">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold text-ink">Volume by day</h2>
            <p className="text-[12px] text-ink-muted">Last 14 days · demo</p>
          </div>
          <div className="flex h-40 items-end gap-1.5">
            {volumeByDay.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-32 w-full items-end">
                  <div className="w-full rounded-sm bg-primary/80" style={{ height: `${(v / maxVol) * 100}%` }} title={`${v} complaints`} />
                </div>
                <span className="text-[10px] text-ink-faint tabular">{14 - i}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel p-4 lg:col-span-2">
          <h2 className="mb-3 text-[13px] font-semibold text-ink">Status in workspace now</h2>
          <p className="mb-3 text-[12px] text-ink-muted">{liveOpen} open · {complaints.length} total</p>
          <StatusBars />
        </section>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="mb-3 text-[13px] font-semibold text-ink">Complaint categories</h2>
          <ul className="space-y-2">
            {categoryCounts.map((c) => (
              <li key={c.label} className="flex items-center gap-3 text-[12px]">
                <span className="w-32 shrink-0 truncate text-ink-secondary">{c.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-sm bg-canvas">
                  <span className="block h-full bg-secondary-dark" style={{ width: `${(c.value / maxCat) * 100}%` }} />
                </span>
                <span className="w-8 text-right tabular text-ink">{c.value}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel overflow-hidden">
          <div className="border-b border-line px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-ink">Department workload</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase tracking-wide text-ink-muted">
                  <th className="px-3 py-2 font-medium">Department</th>
                  <th className="px-3 py-2 font-medium">Open</th>
                  <th className="px-3 py-2 font-medium">Pending</th>
                  <th className="px-3 py-2 font-medium">Escalated</th>
                  <th className="px-3 py-2 font-medium">Resolved</th>
                  <th className="px-3 py-2 font-medium">SLA risk</th>
                </tr>
              </thead>
              <tbody>
                {departmentWorkload.map((d) => {
                  const risk = d.escalated >= 2 || d.open + d.pending >= 8;
                  return (
                    <tr key={d.department} className="border-b border-line last:border-0">
                      <td className="px-3 py-2 text-ink">{d.department}</td>
                      <td className="px-3 py-2 tabular">{d.open}</td>
                      <td className="px-3 py-2 tabular">{d.pending}</td>
                      <td className="px-3 py-2 tabular text-danger">{d.escalated}</td>
                      <td className="px-3 py-2 tabular">{d.resolved}</td>
                      <td className="px-3 py-2">
                        <span className={risk ? "text-[12px] font-medium text-warning" : "text-[12px] text-ink-faint"}>
                          {risk ? "Watch" : "Stable"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="panel p-4">
        <h2 className="mb-3 text-[13px] font-semibold text-ink">Observed trends (demo)</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {trends.map((t) => (
            <li key={t.title} className="border border-line px-3 py-2">
              <p className="text-[13px] font-medium text-ink">{t.title}</p>
              <p className="mt-1 text-[12px] text-ink-muted">{t.detail}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatusBars() {
  const { complaints } = useData();
  const counts = COMPLAINT_STATUSES.map((l) => ({ label: l, value: complaints.filter((c) => c.status === l).length }));
  const max = Math.max(...counts.map((c) => c.value), 1);
  return (
    <ul className="space-y-2">
      {counts.map((s) => (
        <li key={s.label} className="flex items-center gap-3 text-[12px]">
          <span className="w-28 shrink-0 text-ink-secondary">{s.label}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-sm bg-canvas">
            <span className="block h-full bg-primary" style={{ width: `${(s.value / max) * 100}%` }} />
          </span>
          <span className="w-6 text-right tabular">{s.value}</span>
        </li>
      ))}
    </ul>
  );
}
