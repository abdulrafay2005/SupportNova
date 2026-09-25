import type { ComplaintStatus } from "@/types";
import { cn } from "@/utils/cn";

const styles: Record<ComplaintStatus, string> = {
  New: "text-ink-secondary bg-canvas border-line",
  Analyzed: "text-info bg-info-subtle border-primary-muted",
  Assigned: "text-primary bg-primary-subtle border-primary-muted",
  "In Progress": "text-secondary-dark bg-primary-subtle border-primary-muted",
  "Awaiting Customer": "text-warning bg-warning-subtle border-warning-muted",
  Escalated: "text-danger bg-danger-subtle border-danger-muted",
  Resolved: "text-success bg-success-subtle border-success-muted",
  Closed: "text-ink-muted bg-canvas-subtle border-line",
  Reopened: "text-warning bg-warning-subtle border-warning-muted",
};

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-px text-[11px] font-medium leading-5 whitespace-nowrap",
        styles[status],
      )}
    >
      {status}
    </span>
  );
}
