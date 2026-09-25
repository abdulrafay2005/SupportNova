import type { TimelineEvent } from "@/types";
import { formatDateTime } from "@/utils/dates";
import { cn } from "@/utils/cn";

const dot: Record<string, string> = {
  submitted: "bg-ink-faint",
  classified: "bg-primary",
  routed: "bg-primary",
  assigned: "bg-primary",
  status: "bg-warning",
  comment: "bg-ink-muted",
  note: "bg-ink-faint",
  escalated: "bg-danger",
  resolved: "bg-success",
  closed: "bg-ink-faint",
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const ordered = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  if (ordered.length === 0) {
    return <p className="text-[13px] text-ink-muted">No activity yet.</p>;
  }

  return (
    <ol className="relative">
      {ordered.map((event, i) => (
        <li key={event.id} className="flex gap-3 pb-4 last:pb-0">
          <div className="flex w-3 flex-col items-center">
            <span className={cn("mt-1.5 h-2 w-2 rounded-full", dot[event.type] ?? "bg-ink-faint")} />
            {i < ordered.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-[13px] font-medium text-ink">{event.title}</p>
              <p className="text-[11px] text-ink-faint tabular">{formatDateTime(event.timestamp)}</p>
            </div>
            <p className="text-[12px] text-ink-muted">
              {event.actor}
              {event.actorRole !== "System" ? ` · ${event.actorRole}` : " · System"}
            </p>
            {event.description && (
              <p className="mt-1 text-[13px] text-ink-secondary">{event.description}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
