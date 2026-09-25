import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Inbox } from "lucide-react";
import { Button } from "@/components/Button";
import { ComplaintTable } from "@/components/ComplaintTable";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/auth/AuthContext";
import { useData } from "@/context/DataContext";
import { COMPLAINT_STATUSES, OPEN_STATUSES } from "@/types";
import { customerNextStep } from "@/utils/classify";
import { greetingForNow, todayLabel, formatRelative } from "@/utils/dates";

export function Dashboard() {
  const { user } = useAuth();
  const { complaints, customers } = useData();
  if (!user) return null;
  if (user.role === "Customer") return <CustomerHome />;

  const mine = complaints.filter((c) => c.assigneeId === user.id && OPEN_STATUSES.includes(c.status));
  const open = complaints.filter((c) => OPEN_STATUSES.includes(c.status) && c.status !== "Awaiting Customer" && c.status !== "Escalated");
  const pending = complaints.filter((c) => c.status === "Awaiting Customer");
  const escalated = complaints.filter((c) => c.escalated && c.status !== "Resolved" && c.status !== "Closed");
  const resolvedToday = complaints.filter((c) => {
    if (c.status !== "Resolved" && c.status !== "Closed") return false;
    return new Date(c.updatedAt).toDateString() === new Date().toDateString();
  });
  const manual = complaints.filter((c) => c.validation === "Mismatch" || c.validation === "Manual Review Required");
  const sla = complaints.filter((c) => c.slaRisk);
  const mismatch = complaints.filter((c) => c.validationDetail.overall === "Mismatch");

  const recent = [...complaints].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 6);
  const activity = [...complaints]
    .flatMap((c) => c.timeline.map((t) => ({ ...t, complaintId: c.id })))
    .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
    .slice(0, 8);

  const statusCounts = COMPLAINT_STATUSES.map((label) => ({
    label,
    value: complaints.filter((c) => c.status === label).length,
  }));
  const maxStatus = Math.max(...statusCounts.map((s) => s.value), 1);
  const categoryMap = new Map<string, number>();
  complaints.forEach((c) => categoryMap.set(c.category, (categoryMap.get(c.category) ?? 0) + 1));
  const cats = [...categoryMap.entries()].sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(...cats.map((c) => c[1]), 1);

  return (
    <div>
      <PageHeader
        title={`${greetingForNow()}, ${user.name.split(" ")[0]}`}
        description={`${todayLabel()}. Review complaint workload, validation status, escalations, and cases requiring attention. Demo data.`}
        actions={
          <>
            <Link to="/complaints/new">
              <Button>New complaint</Button>
            </Link>
            <Link to="/queue">
              <Button variant="outline">View queue</Button>
            </Link>
          </>
        }
      />

      <section className="mb-5">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Workload</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Open complaints" value={open.length} hint="New through in progress" tone="info" icon={<Inbox size={16} />} />
          <StatCard label="Pending review" value={pending.length} hint="Awaiting customer" tone="warning" />
          <StatCard label="Escalated" value={escalated.length} hint="Specialist or manager review" tone="danger" icon={<AlertTriangle size={16} />} />
          <StatCard label="Resolved today" value={resolvedToday.length} hint="Resolved or closed since midnight" tone="success" icon={<CheckCircle2 size={16} />} />
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Attention</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Manual review" value={manual.length} hint="Disagreement or missing policy" icon={<ClipboardCheck size={16} />} />
          <StatCard label="SLA risk" value={sla.length} hint="Response or resolution target" tone="warning" />
          <StatCard label="GenAI / Python mismatch" value={mismatch.length} hint="Field-level disagreement" tone="danger" />
        </div>
      </section>

      <section className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">My queue</h2>
          <Link to="/queue" className="text-[12px] font-medium text-primary hover:underline">
            Open queue
          </Link>
        </div>
        <ComplaintTable complaints={mine.slice(0, 6)} customers={customers} compact emptyTitle="Nothing in your queue" emptyDescription="You have no open complaints assigned to you." />
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Recent complaints</h2>
          <ComplaintTable complaints={recent} customers={customers} compact />
        </section>
        <section className="lg:col-span-2">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Recent activity</h2>
          <div className="panel divide-y divide-line">
            {activity.map((a) => (
              <Link key={a.id + a.timestamp} to={`/complaints/${a.complaintId}`} className="block px-3 py-2.5 hover:bg-canvas-subtle">
                <p className="text-[13px] text-ink">
                  <span className="font-medium">{a.title}</span>
                  <span className="text-ink-muted"> · {a.complaintId}</span>
                </p>
                <p className="text-[12px] text-ink-muted">
                  {a.actor} · {formatRelative(a.timestamp)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-5">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Complaint overview</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="panel p-4">
            <p className="mb-3 text-[13px] font-semibold text-ink">Status distribution</p>
            <ul className="space-y-2">
              {statusCounts.map((s) => (
                <li key={s.label} className="flex items-center gap-3 text-[12px]">
                  <span className="w-28 shrink-0 text-ink-secondary">{s.label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-sm bg-canvas">
                    <span className="block h-full bg-primary" style={{ width: `${(s.value / maxStatus) * 100}%` }} />
                  </span>
                  <span className="w-6 text-right tabular text-ink">{s.value}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel p-4">
            <p className="mb-3 text-[13px] font-semibold text-ink">Category distribution</p>
            <ul className="space-y-2">
              {cats.map(([label, value]) => (
                <li key={label} className="flex items-center gap-3 text-[12px]">
                  <span className="w-32 shrink-0 truncate text-ink-secondary">{label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-sm bg-canvas">
                    <span className="block h-full bg-secondary-dark" style={{ width: `${(value / maxCat) * 100}%` }} />
                  </span>
                  <span className="w-6 text-right tabular text-ink">{value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

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
        <StatCard label="Latest update" value={mine[0] ? formatRelative(mine[0].updatedAt) : "—"} hint={mine[0]?.id} />
      </div>
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Your complaints</h2>
      {mine.length === 0 ? (
        <div className="panel px-5 py-10 text-center">
          <p className="text-sm font-semibold text-ink">You have not submitted a complaint yet</p>
          <p className="mt-1 text-[13px] text-ink-muted">When you do, you will see status, department, and next steps here.</p>
          <Link to="/complaints/new" className="mt-4 inline-block">
            <Button>Submit a complaint</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {mine.map((c) => (
            <Link key={c.id} to={`/complaints/${c.id}`} className="panel flex flex-col gap-2 p-4 hover:border-line-strong sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[11px] text-primary">{c.id}</p>
                <p className="truncate text-[14px] font-medium text-ink">{c.subject}</p>
                <p className="text-[12px] text-ink-muted">
                  {c.department} · Updated {formatRelative(c.updatedAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={c.status} />
                <span className="text-[12px] text-ink-muted">{customerNextStep(c.status)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
