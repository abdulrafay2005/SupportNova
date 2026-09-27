import { useEffect, useState, type ReactNode } from "react";
import { Bell, Check, Search } from "lucide-react";
import { PriorityBadge } from "@/components/PriorityBadge";
import { SentimentBadge } from "@/components/SentimentBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { exampleComplaints } from "@/data/mockData";
import { cn } from "@/utils/cn";

/**
 * Hero visual: the SN-000124 complaint as it appears in the workspace.
 * Stored results are revealed one at a time, once, to show how the record fills in.
 */
/*
 * Public marketing preview.
 *
 * This renders a fixed illustrative record from
 * `@/data/mockData`, NOT live data. It deliberately no longer
 * reads DataContext: the landing page is public, and the signed-in
 * user's real complaints must never be rendered as marketing
 * material.
 */
export function HeroPreview() {
  const c = exampleComplaints.find((x) => x.id === "SN-000124");
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setStage(4);
      return;
    }
    const timers = [1, 2, 3, 4].map((s, i) => window.setTimeout(() => setStage(s), 1100 + i * 1000));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  if (!c) return null;

  const timeline = [
    { label: "Complaint submitted", at: 0 },
    { label: "Analysis completed", at: 1 },
    { label: `Routed to ${c.department}`, at: 2 },
    { label: "Python validation completed", at: 3 },
    { label: "Agent review started", at: 4 },
  ];

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-xl border border-line-strong bg-surface shadow-[var(--shadow-preview)]">
        {/* app chrome */}
        <div className="flex items-center gap-3 border-b border-line bg-primary-dark px-4 py-2.5">
          <span className="text-[12px] font-semibold text-white">SupportNova</span>
          <span className="hidden text-[12px] text-white/50 sm:inline">Complaints / {c.id}</span>
          <div className="ml-auto flex items-center gap-2 text-white/60">
            <Search size={14} aria-hidden />
            <Bell size={14} aria-hidden />
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-soft-green text-[9px] font-semibold text-primary-dark">
              NH
            </span>
          </div>
        </div>

        <div className="border-b border-line px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[12px] text-ink-muted">Complaint #{c.id}</p>
              <p className="mt-0.5 text-[17px] font-semibold text-ink">{c.subject}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={c.status} />
              <PriorityBadge priority={c.priority} />
            </div>
          </div>
          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink-secondary">“{c.description}”</p>
        </div>

        <div className="grid sm:grid-cols-[1.25fr_1fr]">
          <div className="border-b border-line px-5 py-4 sm:border-b-0 sm:border-r">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Complaint analysis</p>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              <Row label="Primary issue" show>
                <span className="font-medium text-ink">{c.intelligence?.primaryIssue ?? c.subject}</span>
              </Row>
              <Row label="Sentiment" show>
                <SentimentBadge sentiment={c.sentiment} />
              </Row>
              <Row label="Urgency" show>
                <UrgencyBadge urgency={c.urgency} />
              </Row>
              <Row label="Category" show={stage >= 1}>
                <span className="font-medium text-ink">{c.category}</span>
              </Row>
              <Row label="Department" show={stage >= 2}>
                <span className="font-medium text-ink">{c.department}</span>
              </Row>
              <Row label="Python validation" show={stage >= 3}>
                <span className="inline-flex items-center gap-1 font-medium text-success">
                  <Check size={13} strokeWidth={3} aria-hidden />
                  Validated
                </span>
              </Row>
            </dl>
            <div
              className={cn(
                "stage-value mt-4 rounded-md border border-primary-muted bg-primary-subtle px-3 py-2.5",
                stage < 4 && "stage-hidden",
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-dark">Next step</p>
              <p className="mt-0.5 text-[13px] font-medium text-ink">{c.nextAction}</p>
            </div>
          </div>

          <div className="px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Activity</p>
            <ol className="mt-3 space-y-0">
              {timeline.map((t, i) => {
                const done = stage > t.at || (t.at === 0);
                const current = stage === t.at && t.at > 0;
                const visible = stage >= t.at;
                return (
                  <li key={t.label} className={cn("stage-value flex gap-2.5", !visible && "stage-hidden")}>
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "mt-1 h-2 w-2 rounded-full",
                          current ? "bg-primary ring-4 ring-primary-muted" : done ? "bg-primary" : "bg-line-strong",
                        )}
                      />
                      {i < timeline.length - 1 && <span className="w-px flex-1 min-h-5 bg-line" />}
                    </div>
                    <p className={cn("pb-3 text-[12px]", current ? "font-semibold text-ink" : "text-ink-secondary")}>{t.label}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "stage-value absolute -bottom-5 left-5 hidden items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 shadow-[var(--shadow-overlay)] sm:flex",
          stage < 2 && "stage-hidden",
        )}
        aria-hidden
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="text-[12px] text-ink">
          Routed to <span className="font-semibold">{c.department}</span>
        </span>
        <span className="text-[11px] text-ink-faint">just now</span>
      </div>
    </div>
  );
}

function Row({ label, show, children }: { label: string; show: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="relative min-h-5 text-right">
        <span className={cn("stage-value inline-flex", !show && "stage-hidden")}>{children}</span>
        {!show && <span className="absolute right-0 top-1/2 h-2.5 w-16 -translate-y-1/2 rounded-sm bg-surface-muted" aria-hidden />}
      </dd>
    </div>
  );
}
