import type { Intelligence } from "@/types";
import { PRIORITY_LABEL } from "@/types";
import { SentimentBadge } from "@/components/SentimentBadge";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { PriorityBadge } from "@/components/PriorityBadge";

export function AnalysisCard({ intelligence }: { intelligence: Intelligence }) {
  const rows: { label: string; value: string }[] = [
    { label: "Primary issue", value: intelligence.primaryIssue },
    { label: "Category", value: intelligence.category },
    { label: "Subcategory", value: intelligence.subcategory },
    { label: "Product / service", value: intelligence.productService },
    { label: "Department", value: intelligence.department },
    { label: "Supporting department", value: intelligence.supportingDepartment ?? "—" },
    { label: "Escalation", value: intelligence.escalation ? "Required" : "Not required" },
    { label: "Priority", value: PRIORITY_LABEL[intelligence.priority] },
  ];

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-line px-4 py-2.5">
        <h3 className="text-[13px] font-semibold text-ink">Complaint analysis</h3>
        <p className="text-[12px] text-ink-muted">
          Operational result stored on this complaint. The frontend does not generate this analysis.
        </p>
      </div>
      <div className="border-b border-line px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Complaint summary</p>
        <p className="mt-1 text-[13px] text-ink-secondary">{intelligence.summary}</p>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="bg-surface px-4 py-2.5">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{row.label}</dt>
            <dd className="mt-0.5 text-[13px] font-medium text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-4 border-t border-line px-4 py-3 text-[13px]">
        <span className="flex items-center gap-2">
          <span className="text-ink-muted">Sentiment</span>
          <SentimentBadge sentiment={intelligence.sentiment} />
        </span>
        <span className="flex items-center gap-2">
          <span className="text-ink-muted">Urgency</span>
          <UrgencyBadge urgency={intelligence.urgency} />
        </span>
        <span className="flex items-center gap-2">
          <span className="text-ink-muted">Priority</span>
          <PriorityBadge priority={intelligence.priority} />
        </span>
      </div>
      {intelligence.secondaryIssues.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Secondary issues</p>
          <p className="mt-1 text-[13px] text-ink-secondary">{intelligence.secondaryIssues.join(" · ")}</p>
        </div>
      )}
      {intelligence.entities.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Entities</p>
          <p className="mt-1 font-mono text-[12px] text-ink-secondary">{intelligence.entities.join(" · ")}</p>
        </div>
      )}
      <div className="border-t border-line px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Reason</p>
        <p className="mt-1 text-[13px] text-ink-secondary">{intelligence.reason}</p>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Resolution recommendation</p>
        <p className="mt-1 text-[13px] text-ink-secondary">{intelligence.recommendation}</p>
        {intelligence.agentGuidance.length > 0 && (
          <>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Agent guidance</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] text-ink-secondary">
              {intelligence.agentGuidance.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </>
        )}
        {intelligence.clarificationQuestions.length > 0 && (
          <>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Clarification questions</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4 text-[13px] text-ink-secondary">
              {intelligence.clarificationQuestions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </>
        )}
        {intelligence.generatedResponse && (
          <>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Generated response</p>
            <p className="mt-1 text-[13px] text-ink-secondary">{intelligence.generatedResponse}</p>
          </>
        )}
      </div>
    </div>
  );
}
