import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SiteShell } from "@/components/PublicHeader";
import { buttonStyles } from "@/components/Button";
import { Reveal } from "@/components/marketing/Reveal";

interface Stage {
  title: string;
  body: string;
  example: string;
}

interface Phase {
  id: string;
  name: string;
  summary: string;
  stages: Stage[];
}

const PHASES: Phase[] = [
  {
    id: "intake",
    name: "Intake",
    summary: "The complaint arrives and is made ready to read.",
    stages: [
      { title: "Complaint submission", body: "The customer describes what happened and adds any references, product details or attachments.", example: "“My order arrived damaged and I want a replacement.” · ORD-88421" },
      { title: "Input checks", body: "Required fields, reference formats and attachment types are checked, and the text is cleaned and screened before analysis.", example: "Accepted · reference SN-000124 issued" },
    ],
  },
  {
    id: "understanding",
    name: "Understanding",
    summary: "What happened, how serious it is, and what it involves.",
    stages: [
      { title: "Issue and classification", body: "The primary issue is identified, along with any secondary issues, and placed in a category and subcategory.", example: "Damaged parcel · Product Quality" },
      { title: "Entity extraction", body: "Specific details — order numbers, products, amounts, dates — are pulled out for the agent.", example: "ORD-88421 · ceramic bowl · replacement" },
      { title: "Sentiment, urgency and priority", body: "Tone is recorded separately from urgency. Priority (P0–P3) is then set from urgency, impact and the rule matrix.", example: "Negative · High urgency · P1" },
    ],
  },
  {
    id: "decision",
    name: "Decision",
    summary: "Who handles it, under which policy, and what they should do.",
    stages: [
      { title: "Routing and policy", body: "The responsible department is chosen, and the approved policy section that applies is retrieved with its version.", example: "Returns · RET-POL-02 §4.1 · v3.0" },
      { title: "Resolution recommendation", body: "Ordered steps are recommended, with required and prohibited actions and refund or replacement eligibility.", example: "Verify order → review evidence → check eligibility → replace → update customer" },
    ],
  },
  {
    id: "checks",
    name: "Checks",
    summary: "Nothing moves forward on a generated answer alone.",
    stages: [
      { title: "Rule check", body: "The generated category, department, urgency, escalation, policy and resolution are compared with the rule-based result.", example: "All fields match · Validated" },
      { title: "Escalation", body: "Escalation conditions are evaluated and a level is assigned — from no escalation to critical management escalation.", example: "No escalation" },
    ],
  },
  {
    id: "communication",
    name: "Communication",
    summary: "What the customer hears, and when.",
    stages: [
      { title: "Response and follow-up", body: "A professional reply is drafted and checked for tone and unsupported promises before an agent sends it. A follow-up is scheduled where needed.", example: "“Returns is reviewing order ORD-88421…” · status update to follow" },
    ],
  },
  {
    id: "closure",
    name: "Oversight & closure",
    summary: "People stay in control of uncertain cases.",
    stages: [
      { title: "Manual review", body: "Disagreements, missing policy support, ambiguous or sensitive complaints go to a reviewer who can approve, modify, reclassify, reassign or escalate.", example: "Not required for this complaint" },
      { title: "Closure", body: "The complaint is resolved, the customer confirms, and the case is closed with a complete audit trail.", example: "Pending — replacement in progress" },
    ],
  },
];

export function HowItWorks() {
  let counter = 0;
  return (
    <SiteShell>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">How it works</p>
          <h1 className="mt-3 max-w-3xl text-[32px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[42px]">
            Every stage a complaint passes through, in order.
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-secondary">
            Twelve stages, grouped into six phases. Each example follows one complaint — SN-000124, a damaged parcel — from submission to closure.
          </p>
        </div>
      </section>

      <section className="bg-canvas">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[220px_1fr] lg:py-20">
          <nav aria-label="Phases" className="hidden lg:block">
            <ol className="sticky top-24 space-y-1">
              {PHASES.map((p, i) => (
                <li key={p.id}>
                  <a
                    href={`#${p.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(p.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-[14px] text-ink-secondary transition-colors hover:bg-surface hover:text-ink"
                  >
                    <span className="font-mono text-[11px] text-ink-faint">0{i + 1}</span>
                    {p.name}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="space-y-14">
            {PHASES.map((phase, pi) => (
              <section key={phase.id} id={phase.id} className="scroll-mt-20">
                <Reveal>
                  <p className="font-mono text-[12px] text-primary">Phase 0{pi + 1}</p>
                  <h2 className="mt-1 text-[24px] font-semibold tracking-tight text-ink">{phase.name}</h2>
                  <p className="mt-1 text-[15px] text-ink-muted">{phase.summary}</p>
                </Reveal>
                <ol className="mt-6 border-l border-line-strong">
                  {phase.stages.map((s) => {
                    counter += 1;
                    const n = counter;
                    return (
                      <Reveal as="li" key={s.title} className="relative pb-6 pl-7 last:pb-0">
                        <span className="absolute -left-[13px] top-0 flex h-[26px] w-[26px] items-center justify-center rounded-full border border-primary bg-surface font-mono text-[10px] font-semibold text-primary">
                          {n}
                        </span>
                        <div className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-[1fr_260px] md:gap-6">
                          <div>
                            <h3 className="text-[16px] font-semibold text-ink">{s.title}</h3>
                            <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">{s.body}</p>
                          </div>
                          <div className="rounded-md bg-canvas-subtle px-3 py-2 md:self-start">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Example</p>
                            <p className="mt-0.5 text-[13px] text-secondary-dark">{s.example}</p>
                          </div>
                        </div>
                      </Reveal>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary-dark">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[26px] font-semibold tracking-tight text-white">See the process on a real complaint.</h2>
            <p className="mt-2 text-[15px] text-white/70">Track SN-000124, or submit your own.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/track" className={buttonStyles("light", "lg")}>
              Track your complaint <ArrowRight size={16} aria-hidden />
            </Link>
            <Link to="/complaints/new" className={buttonStyles("outlineLight", "lg")}>
              Submit a complaint
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}