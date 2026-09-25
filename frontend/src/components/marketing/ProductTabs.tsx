import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, X as XIcon } from "lucide-react";
import { PriorityBadge } from "@/components/PriorityBadge";
import { SentimentBadge } from "@/components/SentimentBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { useData } from "@/context/DataContext";
import { cn } from "@/utils/cn";

const TABS = [
  { id: "complaint", label: "Complaint", blurb: "Who raised it, what they said, and what came before." },
  { id: "analysis", label: "Analysis", blurb: "Issue, category, sentiment, urgency, priority and extracted details." },
  { id: "validation", label: "Validation", blurb: "The generated recommendation, checked field by field against rules." },
  { id: "resolution", label: "Resolution", blurb: "What to do, what not to do, and what the customer will hear." },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ProductTabs() {
  const { complaints, getCustomer } = useData();
  const c = complaints.find((x) => x.id === "SN-000124");
  const [tab, setTab] = useState<TabId>("complaint");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  if (!c) return null;
  const customer = getCustomer(c.customerId);
  const related = complaints.filter((x) => x.customerId === c.customerId && x.id !== c.id);

  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    setTab(TABS[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr] lg:gap-10">
      <div role="tablist" aria-label="Complaint views" aria-orientation="vertical" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {TABS.map((t, i) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "shrink-0 rounded-lg border px-4 py-3 text-left transition-colors lg:w-full",
                selected ? "border-primary bg-surface shadow-[var(--shadow-panel)]" : "border-transparent hover:bg-surface/70",
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn("h-1.5 w-1.5 rounded-full", selected ? "bg-primary" : "bg-line-strong")} />
                <span className={cn("text-[14px] font-semibold", selected ? "text-ink" : "text-ink-secondary")}>{t.label}</span>
              </span>
              <span className="mt-1 hidden text-[13px] leading-snug text-ink-muted lg:block">{t.blurb}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="overflow-hidden rounded-xl border border-line-strong bg-surface shadow-[var(--shadow-preview)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-canvas-subtle px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] text-ink-muted">{c.id}</span>
            <span className="text-[13px] font-semibold text-ink">{c.subject}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={c.status} />
            <PriorityBadge priority={c.priority} />
          </div>
        </div>

        <div key={tab} className="fade-in p-5">
          {tab === "complaint" && (
            <div className="grid gap-5 md:grid-cols-[1fr_220px]">
              <div>
                <Label>Description</Label>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-secondary">{c.description}</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Field label="Order reference" value={c.reference ?? "—"} mono />
                  <Field label="Product / service" value={c.productService} />
                  <Field label="Channel" value={c.contactChannel ?? "Portal"} />
                  <Field label="Attachment" value={c.attachmentName ?? "—"} />
                </div>
              </div>
              <div className="space-y-4 md:border-l md:border-line md:pl-5">
                <div>
                  <Label>Customer</Label>
                  <p className="mt-1.5 text-[14px] font-medium text-ink">{customer?.name}</p>
                  <p className="text-[12px] text-ink-muted">{customer?.company}</p>
                  <p className="font-mono text-[11px] text-ink-faint">{customer?.reference} · {customer?.customerType}</p>
                </div>
                <div>
                  <Label>Previous complaints</Label>
                  <ul className="mt-1.5 space-y-1.5">
                    {related.map((r) => (
                      <li key={r.id} className="text-[12px]">
                        <span className="font-mono text-ink-muted">{r.id}</span>
                        <span className="block text-ink-secondary">{r.subject}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {tab === "analysis" && (
            <div>
              <p className="text-[14px] leading-relaxed text-ink-secondary">{c.intelligence.summary}</p>
              <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
                <Cell label="Primary issue">{c.intelligence.primaryIssue}</Cell>
                <Cell label="Secondary issue">{c.intelligence.secondaryIssues.join(", ") || "None"}</Cell>
                <Cell label="Category">{c.category}</Cell>
                <Cell label="Subcategory">{c.subcategory}</Cell>
                <Cell label="Sentiment"><SentimentBadge sentiment={c.sentiment} /></Cell>
                <Cell label="Urgency"><UrgencyBadge urgency={c.urgency} /></Cell>
                <Cell label="Priority"><PriorityBadge priority={c.priority} /></Cell>
                <Cell label="Department">{c.department}</Cell>
              </div>
              <Label className="mt-4">Entities</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {c.intelligence.entities.map((e) => (
                  <span key={e} className="rounded border border-line bg-canvas-subtle px-2 py-0.5 font-mono text-[12px] text-ink-secondary">
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}

          {tab === "validation" && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-muted">
                      <th className="py-2 pr-3 font-medium">Field</th>
                      <th className="py-2 pr-3 font-medium">Generated</th>
                      <th className="py-2 pr-3 font-medium">Python result</th>
                      <th className="py-2 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.validationDetail.fields.map((f) => (
                      <tr key={f.field} className="border-b border-line last:border-0">
                        <td className="py-2.5 pr-3 text-ink-muted">{f.field}</td>
                        <td className="py-2.5 pr-3 text-ink">{f.genai}</td>
                        <td className="py-2.5 pr-3 text-ink">{f.python}</td>
                        <td className="py-2.5">
                          <span className="inline-flex items-center gap-1 font-medium text-success">
                            <Check size={13} strokeWidth={3} aria-hidden /> {f.result}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Check2 label="Policy result" ok={c.validationDetail.policyValidated} detail={c.policy?.id} />
                <Check2 label="Resolution result" ok={c.validationDetail.resolutionValidated} />
                <Check2 label="Routing result" ok detail={c.department} />
                <Check2 label="Escalation result" ok detail={c.escalationAssessment.level} />
              </div>
            </div>
          )}

          {tab === "resolution" && c.resolutionPlan && (
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Label>Recommended steps</Label>
                <ol className="mt-2 space-y-1.5">
                  {c.resolutionPlan.steps.map((s, i) => (
                    <li key={s} className="flex gap-2 text-[13px] text-ink-secondary">
                      <span className="font-mono text-ink-faint">{i + 1}.</span>
                      {s}
                    </li>
                  ))}
                </ol>
                <Label className="mt-4">Required actions</Label>
                <ul className="mt-1.5 space-y-1">
                  {c.resolutionPlan.requiredActions.map((a) => (
                    <li key={a} className="flex items-center gap-2 text-[13px] text-ink">
                      <Check size={13} className="text-success" aria-hidden /> {a}
                    </li>
                  ))}
                </ul>
                <Label className="mt-4">Prohibited actions</Label>
                <ul className="mt-1.5 space-y-1">
                  {c.resolutionPlan.prohibitedActions.map((a) => (
                    <li key={a} className="flex items-start gap-2 text-[13px] text-ink-secondary">
                      <XIcon size={13} className="mt-0.5 shrink-0 text-danger" aria-hidden /> {a}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4">
                <div className="rounded-md border border-line bg-canvas-subtle p-3">
                  <Label>Customer response</Label>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">{c.intelligence.generatedResponse}</p>
                </div>
                <div>
                  <Label>Follow-up</Label>
                  <p className="mt-1.5 text-[13px] font-medium text-ink">{c.followUp?.type}</p>
                  <p className="text-[13px] text-ink-muted">{c.followUp?.communication}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted", className)}>{children}</p>;
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className={cn("mt-1 text-[13px] text-ink", mono && "font-mono")}>{value}</p>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-surface px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{label}</p>
      <div className="mt-1 text-[13px] font-medium text-ink">{children}</div>
    </div>
  );
}

function Check2({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-[13px]">
      <span className="text-ink-muted">{label}</span>
      <span className={cn("inline-flex items-center gap-1 font-medium", ok ? "text-success" : "text-warning")}>
        {ok && <Check size={13} strokeWidth={3} aria-hidden />}
        {ok ? "Validated" : "Review"}
        {detail && <span className="font-normal text-ink-faint">· {detail}</span>}
      </span>
    </div>
  );
}
