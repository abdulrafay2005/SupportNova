import { PRIORITY_LABEL, type Priority } from "@/types";
import { cn } from "@/utils/cn";

const styles: Record<Priority, string> = {
  P3: "text-ink-muted",
  P2: "text-ink-secondary",
  P1: "text-warning",
  P0: "text-danger",
};

const dots: Record<Priority, string> = {
  P3: "bg-ink-faint",
  P2: "bg-primary",
  P1: "bg-warning",
  P0: "bg-danger",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap", styles[priority])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dots[priority])} />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
