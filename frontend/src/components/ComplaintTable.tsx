import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { SentimentBadge } from "@/components/SentimentBadge";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { ValidationBadge } from "@/components/ValidationResult";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import type { Complaint, Customer } from "@/types";
import { formatRelative } from "@/utils/dates";
import { cn } from "@/utils/cn";

interface ComplaintTableProps {
  complaints: Complaint[];
  customers: Customer[];
  onClearFilters?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  compact?: boolean;
}

export function ComplaintTable({
  complaints,
  customers,
  onClearFilters,
  emptyTitle = "No complaints found",
  emptyDescription = "There are no complaints matching your current filters.",
  compact,
}: ComplaintTableProps) {
  const nameOf = (id: string) => customers.find((c) => c.id === id)?.name ?? "Unknown customer";

  if (complaints.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={
          onClearFilters ? (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <div className="panel hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-line bg-canvas-subtle text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Complaint</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 font-medium">Priority</th>
                {!compact && <th className="px-3 py-2 font-medium">Sentiment</th>}
                {!compact && <th className="px-3 py-2 font-medium">Urgency</th>}
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Escalation</th>
                {!compact && <th className="px-3 py-2 font-medium">Validation</th>}
                <th className="px-3 py-2 font-medium">Updated</th>
                <th className="px-3 py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-canvas-subtle">
                  <td className="px-3 py-2">
                    <Link to={`/complaints/${c.id}`} className="font-mono text-[12px] text-primary hover:underline">
                      {c.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-ink">{nameOf(c.customerId)}</td>
                  <td className="max-w-[200px] px-3 py-2">
                    <p className="truncate text-ink">{c.subject}</p>
                    <p className="truncate text-[12px] text-ink-muted">{c.subcategory}</p>
                  </td>
                  <td className="px-3 py-2 text-ink-secondary">{c.category}</td>
                  <td className="px-3 py-2 text-ink-secondary">{c.department}</td>
                  <td className="px-3 py-2">
                    <PriorityBadge priority={c.priority} />
                  </td>
                  {!compact && (
                    <td className="px-3 py-2">
                      <SentimentBadge sentiment={c.sentiment} />
                    </td>
                  )}
                  {!compact && (
                    <td className="px-3 py-2">
                      <UrgencyBadge urgency={c.urgency} />
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("text-[12px]", c.escalated ? "font-medium text-danger" : "text-ink-faint")}>
                      {c.escalated ? "Escalated" : "—"}
                    </span>
                  </td>
                  {!compact && (
                    <td className="px-3 py-2">
                      <ValidationBadge state={c.validation} />
                    </td>
                  )}
                  <td className="px-3 py-2 text-[12px] text-ink-muted tabular">{formatRelative(c.updatedAt)}</td>
                  <td className="px-3 py-2">
                    <Link to={`/complaints/${c.id}`} className="text-[12px] font-medium text-primary hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2 md:hidden">
        {complaints.map((c) => (
          <Link key={c.id} to={`/complaints/${c.id}`} className="panel block p-3 hover:border-line-strong">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-[11px] text-primary">{c.id}</p>
                <p className="mt-0.5 truncate text-[13px] font-medium text-ink">{c.subject}</p>
                <p className="truncate text-[12px] text-ink-muted">
                  {nameOf(c.customerId)} · {c.department}
                </p>
              </div>
              <StatusBadge status={c.status} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <PriorityBadge priority={c.priority} />
              <span className="text-[11px] text-ink-faint">{formatRelative(c.updatedAt)}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
