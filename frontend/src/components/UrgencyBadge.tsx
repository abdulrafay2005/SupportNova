import type { Urgency } from "@/types";
import { NotAvailable } from "@/components/NotAvailable";
import { cn } from "@/utils/cn";

const styles: Record<Urgency, string> = {
  Low: "text-ink-muted border-line bg-canvas-subtle",
  Medium: "text-ink-secondary border-line bg-surface",
  High: "text-warning border-warning-muted bg-warning-subtle",
  Critical: "text-danger border-danger-muted bg-danger-subtle",
};

export function UrgencyBadge({ urgency }: { urgency: Urgency | null | undefined }) {
  /* Urgency is not persisted on the complaint document. */
  if (!urgency) return <NotAvailable />;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-px text-[11px] font-medium leading-5",
        styles[urgency],
      )}
    >
      {urgency}
    </span>
  );
}
