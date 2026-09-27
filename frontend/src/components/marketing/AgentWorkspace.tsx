import { BookOpen, Check, Inbox, LayoutDashboard, ListTodo, ShieldCheck } from "lucide-react";
import { PriorityBadge } from "@/components/PriorityBadge";
import { SentimentBadge } from "@/components/SentimentBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { exampleComplaints, exampleCustomers } from "@/data/mockData";
import { OPEN_STATUSES } from "@/types";
import { cn } from "@/utils/cn";

/** A read-only rendering of the agent workspace, built from the same records as the app. */
/*
 * Public marketing preview.
 *
 * This renders a fixed illustrative record from
 * `@/data/mockData`, NOT live data. It deliberately no longer
 * reads DataContext: the landing page is public, and the signed-in
 * user's real complaints must never be rendered as marketing
 * material.
 */
export function AgentWorkspace() {
  const complaints = exampleComplaints;
  const getCustomer = (id: string) =>
    exampleCustomers.find((customer) => customer.id === id);
  const c = complaints.find((x) => x.id === "SN-000124");
  if (!c) return null;

  const intel = c.intelligence;
  const escalation = c.escalationAssessment;
  if (!intel || !escalation) return null;
  const queue = complaints.filter((x) => x.assigneeId === "u-nora" && OPEN_STATUSES.includes(x.status)).slice(0, 4);
  const customer = getCustomer(c.customerId);

  return (
    <div className="overflow-hidden rounded-xl border border-line-strong bg-surface shadow-[var(--shadow-preview-lg)]">
      <div className="flex">
        {/* nav rail */}
        <div className="hidden w-12 shrink-0 flex-col items-center gap-3 bg-primary-dark py-4 text-white/60 md:flex" aria-hidden>
          <span className="mb-2 h-6 w-6 rounded bg-soft-green" />
          <LayoutDashboard size={16} />
          <Inbox size={16} className="text-white" />
          <ListTodo size={16} />
          <ShieldCheck size={16} />
          <BookOpen size={16} />
        </div>

        {/* queue */}
        <div className="hidden w-60 shrink-0 border-r border-line bg-canvas-subtle md:block">
          <div className="border-b border-line px-4 py-3">
            <p className="text-[12px] font-semibold text-ink">My queue</p>
            <p className="text-[11px] text-ink-muted">{queue.length} open · Returns</p>
          </div>
          <ul>
            {queue.map((q) => (
              <li
                key={q.id}
                className={cn(
                  "border-b border-line px-4 py-2.5",
                  q.id === c.id ? "border-l-2 border-l-primary bg-surface" : "border-l-2 border-l-transparent",
                )}
              >
                <p className="font-mono text-[10px] text-ink-muted">{q.id}</p>
                <p className="truncate text-[12px] font-medium text-ink">{q.subject}</p>
                <div className="mt-1 flex items-center justify-between">
                  <PriorityBadge priority={q.priority} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* detail */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-5 py-3.5">
            <div className="min-w-0">
              <p className="font-mono text-[11px] text-ink-muted">{c.id} · {customer?.name} · {customer?.reference}</p>
              <p className="text-[15px] font-semibold text-ink">{c.subject}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={c.status} />
              <span className="inline-flex items-center gap-1 rounded border border-success-muted bg-success-subtle px-1.5 py-px text-[11px] font-medium text-success">
                <Check size={11} strokeWidth={3} aria-hidden /> Validated
              </span>
            </div>
          </div>

          <div className="grid xl:grid-cols-[1fr_240px]">
            <div className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Mini label="Category" value={c.category ?? "Not available"} />
                <Mini label="Department" value={c.department ?? "Not available"} />
                <div>
                  <MiniLabel>Priority</MiniLabel>
                  <div className="mt-1"><PriorityBadge priority={c.priority} /></div>
                </div>
                <div>
                  <MiniLabel>Sentiment · Urgency</MiniLabel>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <SentimentBadge sentiment={c.sentiment} />
                    <UrgencyBadge urgency={c.urgency} />
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-line px-3 py-2.5">
                <MiniLabel>Policy reference</MiniLabel>
                <p className="mt-1 text-[13px] text-ink">
                  <span className="font-mono text-secondary-dark">{c.policy?.id}</span> · {c.policy?.title} · §{c.policy?.section} · v{c.policy?.version}
                </p>
              </div>

              <div>
                <MiniLabel>Resolution steps</MiniLabel>
                <ol className="mt-1.5 space-y-1">
                  {c.resolutionPlan?.steps.slice(0, 4).map((s, i) => (
                    <li key={s} className="flex gap-2 text-[13px] text-ink-secondary">
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px]",
                          i < 2 ? "border-primary bg-primary text-white" : "border-line-strong text-ink-faint",
                        )}
                      >
                        {i < 2 ? <Check size={9} strokeWidth={3} /> : i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-md border border-line bg-canvas-subtle">
                <div className="flex items-center justify-between border-b border-line px-3 py-2">
                  <MiniLabel>Customer response · draft</MiniLabel>
                  <span className="rounded bg-primary px-2 py-0.5 text-[11px] font-medium text-white">Review & send</span>
                </div>
                <p className="px-3 py-2.5 text-[13px] leading-relaxed text-ink-secondary">{intel.generatedResponse}</p>
              </div>
            </div>

            <div className="hidden space-y-4 border-l border-line bg-canvas-subtle px-4 py-4 xl:block">
              <div>
                <MiniLabel>Agent guidance</MiniLabel>
                <ul className="mt-1.5 space-y-2">
                  {intel.agentGuidance.map((g) => (
                    <li key={g} className="text-[12px] leading-snug text-ink-secondary">{g}</li>
                  ))}
                </ul>
              </div>
              <div>
                <MiniLabel>Escalation</MiniLabel>
                <p className="mt-1 text-[12px] text-ink">{escalation.level}</p>
              </div>
              <div>
                <MiniLabel>Follow-up</MiniLabel>
                <p className="mt-1 text-[12px] text-ink">{c.followUp?.type}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniLabel({ children }: { children: string }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{children}</p>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <MiniLabel>{label}</MiniLabel>
      <p className="mt-1 text-[13px] font-medium text-ink">{value}</p>
    </div>
  );
}
