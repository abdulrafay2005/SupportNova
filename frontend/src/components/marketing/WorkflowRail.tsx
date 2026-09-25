import { useState } from "react";
import { useInView } from "@/components/marketing/Reveal";
import { cn } from "@/utils/cn";

export const WORKFLOW = [
  {
    n: "01",
    title: "Submit",
    body: "Tell SupportNova what happened and provide the information needed to investigate the issue.",
    output: "Reference SN-000124 issued",
  },
  {
    n: "02",
    title: "Understand",
    body: "The complaint is analyzed for issue, category, sentiment, urgency, priority and relevant entities.",
    output: "Damaged parcel · P1 – High",
  },
  {
    n: "03",
    title: "Validate",
    body: "Generated recommendations are checked against structured organizational rules and approved policies.",
    output: "Validated against RET-POL-02",
  },
  {
    n: "04",
    title: "Route",
    body: "The complaint goes to the responsible department, with supporting teams identified when needed.",
    output: "Assigned to Returns",
  },
  {
    n: "05",
    title: "Resolve",
    body: "Support teams receive recommended resolution steps and a draft customer communication.",
    output: "Verify replacement eligibility",
  },
  {
    n: "06",
    title: "Follow up",
    body: "Customers receive updates until the complaint is resolved and closed.",
    output: "Replacement-status update",
  },
];

export function WorkflowRail() {
  const { ref, inView } = useInView<HTMLDivElement>(0.25);
  const [active, setActive] = useState<number | null>(null);

  return (
    <div ref={ref}>
      {/* Desktop: horizontal connected rail */}
      <ol className="relative hidden grid-cols-6 gap-5 lg:grid">
        <div className="pointer-events-none absolute left-[calc(100%/12)] right-[calc(100%/12)] top-4 h-px bg-line" aria-hidden>
          <div
            className="h-full bg-primary transition-[width] duration-[1800ms] ease-out"
            style={{ width: inView ? "100%" : "0%" }}
          />
        </div>
        {WORKFLOW.map((s, i) => (
          <li
            key={s.n}
            className="relative flex flex-col items-center text-center"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border font-mono text-[11px] font-semibold transition-colors duration-500",
                inView ? "border-primary bg-primary text-white" : "border-line-strong bg-surface text-ink-muted",
              )}
              style={{ transitionDelay: inView ? `${i * 280}ms` : "0ms" }}
            >
              {s.n}
            </span>
            <div
              className={cn(
                "mt-4 w-full rounded-lg border px-3 py-4 transition-colors",
                active === i ? "border-primary-muted bg-primary-subtle" : "border-transparent",
              )}
            >
              <p className="text-[15px] font-semibold text-ink">{s.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{s.body}</p>
              <p className="mt-3 inline-block rounded border border-line bg-surface px-2 py-1 font-mono text-[11px] text-secondary-dark">
                {s.output}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* Mobile / tablet: vertical timeline */}
      <ol className="lg:hidden">
        {WORKFLOW.map((s, i) => (
          <li key={s.n} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-semibold transition-colors duration-500",
                  inView ? "border-primary bg-primary text-white" : "border-line-strong bg-surface text-ink-muted",
                )}
                style={{ transitionDelay: inView ? `${i * 200}ms` : "0ms" }}
              >
                {s.n}
              </span>
              {i < WORKFLOW.length - 1 && <span className="w-px flex-1 bg-line" />}
            </div>
            <div className="pb-7">
              <p className="text-[15px] font-semibold text-ink">{s.title}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">{s.body}</p>
              <p className="mt-2 inline-block rounded border border-line bg-surface px-2 py-1 font-mono text-[11px] text-secondary-dark">
                {s.output}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
