import { Check } from "lucide-react";
import { NotAvailable } from "@/components/NotAvailable";
import { StatusBadge } from "@/components/StatusBadge";
import type { Complaint } from "@/types";
import { customerNextStep } from "@/utils/classify";
import { formatDate } from "@/utils/dates";
import { cn } from "@/utils/cn";

type StepState = "done" | "current" | "upcoming";

export function trackingSteps(c: Complaint): { label: string; state: StepState }[] {
  const labels = [
    "Submitted",
    "Analyzed",
    c.department ? `Assigned to ${c.department}` : "Assigned to a department",
    "Under review",
    "Resolution",
  ];
  const reached =
    c.status === "New" ? 1 : c.status === "Analyzed" ? 2 : c.status === "Resolved" || c.status === "Closed" ? 5 : 3;
  return labels.map((label, i) => ({
    label,
    state: i < reached ? "done" : i === reached ? "current" : "upcoming",
  }));
}

export function latestUpdateFor(c: Complaint) {
  if (c.latestUpdate) return c.latestUpdate;
  const visible = c.timeline.filter((e) => e.type !== "note");
  /*
   * The list endpoint carries no activity history; the complaint
   * page loads the persisted timeline. Nothing is invented here
   * when there is no event to show.
   */
  return visible[visible.length - 1]?.title ?? null;
}

export function TrackingCard({ complaint, className }: { complaint: Complaint; className?: string }) {
  const steps = trackingSteps(complaint);
  return (
    <div className={cn("panel overflow-hidden shadow-[var(--shadow-overlay)]", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="font-mono text-[12px] text-ink-muted">Complaint #{complaint.id}</p>
          <p className="mt-0.5 truncate text-[16px] font-semibold text-ink">{complaint.subject}</p>
          <p className="text-[12px] text-ink-muted">Submitted {formatDate(complaint.createdAt)}</p>
        </div>
        <StatusBadge status={complaint.status} />
      </div>
      <ol className="px-5 py-4">
        {steps.map((s, i) => (
          <li key={s.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-white",
                  s.state === "done" && "border-primary bg-primary",
                  s.state === "current" && "border-primary bg-surface",
                  s.state === "upcoming" && "border-line-strong bg-surface",
                )}
              >
                {s.state === "done" && <Check size={12} strokeWidth={3} />}
                {s.state === "current" && <span className="h-2 w-2 rounded-full bg-primary" />}
              </span>
              {i < steps.length - 1 && (
                <span className={cn("my-0.5 w-px flex-1 min-h-4", s.state === "done" ? "bg-primary" : "bg-line")} />
              )}
            </div>
            <p
              className={cn(
                "pb-3 text-[13px]",
                s.state === "upcoming" ? "text-ink-faint" : "text-ink",
                s.state === "current" && "font-semibold",
              )}
            >
              {s.label}
              {s.state === "current" && <span className="ml-2 text-[11px] font-medium text-primary">Now</span>}
            </p>
          </li>
        ))}
      </ol>
      <dl className="grid gap-px border-t border-line bg-line sm:grid-cols-2">
        <div className="bg-surface px-5 py-3">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Current department</dt>
          <dd className="mt-0.5 text-[13px] font-medium text-ink">
            {complaint.department ?? <NotAvailable />}
          </dd>
        </div>
        <div className="bg-surface px-5 py-3">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Latest update</dt>
          <dd className="mt-0.5 text-[13px] text-ink-secondary">
            {latestUpdateFor(complaint) ?? <NotAvailable />}
          </dd>
        </div>
      </dl>
      <div className="border-t border-line bg-primary-subtle px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-dark">Next step</p>
        <p className="mt-0.5 text-[14px] font-medium text-ink">{complaint.nextAction ?? customerNextStep(complaint.status)}</p>
      </div>
    </div>
  );
}
