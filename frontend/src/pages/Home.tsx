import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  FileCheck2,
  GitBranch,
  History,
  Scale,
  Search,
} from "lucide-react";
import { SiteShell } from "@/components/PublicHeader";
import { buttonStyles } from "@/components/Button";
import { PriorityBadge } from "@/components/PriorityBadge";
import { AgentWorkspace } from "@/components/marketing/AgentWorkspace";
import { Faq, type FaqItem } from "@/components/marketing/Faq";
import { HeroPreview } from "@/components/marketing/HeroPreview";
import { ProductTabs } from "@/components/marketing/ProductTabs";
import { Reveal, SectionHeading } from "@/components/marketing/Reveal";
import { TrackingCard } from "@/components/marketing/TrackingCard";
import { ValidationShowcase } from "@/components/marketing/ValidationShowcase";
import { WorkflowRail } from "@/components/marketing/WorkflowRail";
import { useData } from "@/context/DataContext";
import { complexExample, hardCases, kbCategories } from "@/data/mockData";
import { formatDate } from "@/utils/dates";
import { cn } from "@/utils/cn";

const FAQ: FaqItem[] = [
  {
    q: "What information should I include when submitting a complaint?",
    a: "What happened, when it happened, and what you would like us to do. An order, invoice or account reference helps a lot, as do photos or documents if they show the problem.",
  },
  {
    q: "What happens when the analysis and validation disagree?",
    a: "The complaint is not acted on automatically. It is marked as a mismatch and sent to manual review, where a reviewer can approve, reclassify, reassign or escalate it.",
  },
  {
    q: "How are escalation requirements handled?",
    a: "Escalation is assessed against defined conditions such as safety risk, account compromise, repeat complaints or privacy requests. The escalation level and reason are recorded, and the decision is validated like any other recommendation.",
  },
  {
    q: "Can customers track their complaints?",
    a: "Yes. Every complaint gets a reference such as SN-000124. Customers can use it to see the current status, the department handling it, the latest update and the next step.",
  },
  {
    q: "What happens when information is missing?",
    a: "SupportNova does not guess. It lists what is missing — an order number, a date, the product — and asks the customer focused clarification questions before a resolution is recommended.",
  },
];

const TRUST = [
  { icon: ClipboardList, title: "Structured complaint intelligence", body: "Issue, category, sentiment, urgency and priority recorded the same way every time." },
  { icon: FileCheck2, title: "Policy traceability", body: "Each recommendation points to the policy, section and version it relies on." },
  { icon: Scale, title: "Ground-truth validation", body: "Generated output is checked against rules before anyone acts on it." },
  { icon: GitBranch, title: "Clear escalation paths", body: "Defined levels, recorded reasons, and a manual review queue for uncertain cases." },
  { icon: History, title: "Audit-ready activity", body: "Every status change, reassignment and override is logged with who and when." },
];

export function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { complaints, articles } = useData();
  const sample = complaints.find((c) => c.id === "SN-000124");
  const [trackId, setTrackId] = useState("");
  const [kbQuery, setKbQuery] = useState("");

  useEffect(() => {
    const section = (location.state as { section?: string } | null)?.section;
    if (section) {
      requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView({ block: "start" }));
    }
  }, [location.state]);

  const onTrack = (e: FormEvent) => {
    e.preventDefault();
    const id = trackId.trim().toUpperCase();
    navigate(id ? `/track?id=${encodeURIComponent(id)}` : "/track");
  };

  const onKbSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = kbQuery.trim();
    navigate(q ? `/help-center?q=${encodeURIComponent(q)}` : "/help-center");
  };

  const kbPreview = ["kb-returns-01", "kb-delivery-01", "kb-payments-01"]
    .map((id) => articles.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  return (
    <SiteShell>
      {/* HERO */}
      <section className="overflow-hidden border-b border-line bg-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:pb-24 lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas-subtle px-3 py-1 text-[12px] font-medium text-secondary-dark">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Complaint resolution, start to finish
            </p>
            <h1 className="mt-5 text-[34px] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[44px]">
              Every complaint deserves a clear path forward.
            </h1>
            <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-ink-secondary">
              SupportNova helps customers submit issues, support teams understand what happened, and organizations move each complaint toward the right resolution.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/complaints/new" className={buttonStyles("primary", "lg")}>
                Submit a complaint
              </Link>
              <Link to="/how-it-works" className={buttonStyles("outline", "lg")}>
                See how it works
              </Link>
            </div>
            <Link to="/track" className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-medium text-primary hover:text-secondary-dark">
              Already submitted? Track a complaint <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
          <div className="relative">
            <div className="absolute -inset-x-6 -inset-y-8 -z-0 hidden rounded-3xl bg-primary-subtle sm:block" aria-hidden />
            <div className="relative">
              <HeroPreview />
            </div>
          </div>
        </div>
      </section>

      {/* HUMAN-FIRST */}
      {/* <section className="bg-canvas">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1fr] lg:py-24">
          <Reveal>
            <h2 className="text-[28px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[36px]">
              When something goes wrong, knowing what happens next matters.
            </h2>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-ink-secondary">
              Customers shouldn't have to wonder whether their complaint was received, who is handling it, or what they need to do next. SupportNova keeps the journey visible.
            </p>
          </Reveal>
          <ol className="border-l border-line-strong">
            {[
              ["Received", "Your complaint is recorded and given a clear reference you can keep."],
              ["Understood", "The issue is analyzed and routed to the team responsible for it."],
              ["Moving forward", "You can see the current status and the next step at any time."],
            ].map(([title, body], i) => (
              <Reveal as="li" key={title} delay={i * 120} className="relative pb-10 pl-8 last:pb-0">
                <span className="absolute -left-[5px] top-2 h-[9px] w-[9px] rounded-full bg-primary" aria-hidden />
                <p className="font-mono text-[12px] text-ink-faint">0{i + 1}</p>
                <p className="mt-1 text-[20px] font-semibold text-ink">{title}</p>
                <p className="mt-1.5 max-w-sm text-[15px] leading-relaxed text-ink-muted">{body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section> */}

      {/* HOW IT WORKS */}
      <section className="border-y border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              eyebrow="How it works"
              title="From complaint to resolution, without losing the thread."
              body="The same six stages apply to every complaint — from a damaged parcel to a security incident."
            />
            <Link to="/how-it-works" className="inline-flex shrink-0 items-center gap-1.5 text-[14px] font-medium text-primary hover:text-secondary-dark">
              See every stage <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
          <div className="mt-14">
            <WorkflowRail />
          </div>
        </div>
      </section>

      {/* PRODUCT */}
      {/* <section id="product" className="scroll-mt-16 bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <Reveal>
            <SectionHeading
              eyebrow="Product"
              title="Everything support teams need to understand a complaint."
              body="One record holds the complaint, its analysis, the validation result and the recommended resolution. Select a view to see it."
            />
          </Reveal>
          <Reveal className="mt-12" delay={100}>
            <ProductTabs />
          </Reveal>
        </div>
      </section> */}

      {/* CUSTOMERS */}
      <section id="customers" className="scroll-mt-16 border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <Reveal>
            <SectionHeading
              eyebrow="For customers"
              title="You shouldn't have to chase a complaint to know what's happening."
              body="Your complaint reference opens a plain-language view: where it is, who has it, and what happens next. No internal jargon, no guessing."
            />
            <form onSubmit={onTrack} className="mt-8 max-w-md">
              <label htmlFor="home-track" className="text-[13px] font-medium text-ink-secondary">
                Complaint ID
              </label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <input
                  id="home-track"
                  value={trackId}
                  onChange={(e) => setTrackId(e.target.value)}
                  placeholder="SN-000124"
                  className="h-11 flex-1 rounded-md border border-line-strong bg-surface px-3 font-mono text-[14px] text-ink placeholder:text-ink-faint focus:border-primary"
                />
                <button type="submit" className={buttonStyles("primary", "lg")}>
                  Track a complaint
                </button>
              </div>
            </form>
          </Reveal>
          <Reveal delay={120}>{sample && <TrackingCard complaint={sample} />}</Reveal>
        </div>
      </section>

      {/* SUPPORT TEAMS */}
      <section id="teams" className="scroll-mt-16 bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <Reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              eyebrow="For support teams"
              title="Give support teams the context they need before they respond."
              body="Agents open a complaint and see the customer, the analysis, the policy that applies, the validation result, the steps to take and a draft reply — in one place."
            />
            <Link to="/login" className={buttonStyles("outline", "md", "shrink-0 self-start lg:self-auto")}>
              Sign in to the workspace
            </Link>
          </Reveal>
          <Reveal className="mt-12" delay={100}>
            <AgentWorkspace />
          </Reveal>
          {/* <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Context", "Customer, history and complaint in one view."],
              ["Policy", "The applicable section and version, not a guess."],
              ["Validation", "A clear result before the agent commits."],
              ["Response", "A reviewed draft the agent can edit and send."],
            ].map(([t, b]) => (
              <div key={t} className="border-t-2 border-primary pt-3">
                <p className="text-[14px] font-semibold text-ink">{t}</p>
                <p className="mt-1 text-[13px] text-ink-muted">{b}</p>
              </div>
            ))}
          </div> */}
        </div>
      </section>

      {/* VALIDATION — dark */}
      <section className="bg-primary-dark">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.4fr] lg:py-24">
          <Reveal>
            <SectionHeading
              dark
              eyebrow="Ground-truth validation"
              title="Recommendations are checked before they become decisions."
              body={
                <>
                  <p>SupportNova does not treat a generated recommendation as the final answer.</p>
                  <p className="mt-3">
                    Each one is checked against organizational rules, approved policies, routing requirements, escalation conditions and resolution requirements. When the two disagree, a person decides.
                  </p>
                </>
              }
            />
          </Reveal>
          <Reveal delay={120}>
            <ValidationShowcase />
          </Reveal>
        </div>
      </section>

      {/* POLICY TRACEABILITY */}
      {/* <section className="bg-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <Reveal className="order-2 lg:order-1">
            {sample?.policy && (
              <div className="overflow-hidden rounded-xl border border-line-strong bg-surface shadow-[var(--shadow-preview)]">
                <div className="flex items-center justify-between border-b border-line bg-canvas-subtle px-5 py-3">
                  <span className="font-mono text-[13px] font-semibold text-secondary-dark">{sample.policy.id}</span>
                  <span className="rounded border border-success-muted bg-success-subtle px-1.5 py-px text-[11px] font-medium text-success">
                    {sample.policy.status}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-px bg-line">
                  {[
                    ["Policy", sample.policy.title],
                    ["Section", sample.policy.section],
                    ["Version", sample.policy.version],
                    ["Applicability", "Applicable"],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-surface px-5 py-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{k}</dt>
                      <dd className="mt-1 text-[14px] font-medium text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="border-t border-line px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Why it applies</p>
                  <p className="mt-1 text-[14px] text-ink-secondary">{sample.policy.applicability}</p>
                </div>
                <div className="border-t border-line bg-primary-subtle px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-secondary-dark">Recommended action</p>
                  <p className="mt-1 text-[14px] font-medium text-ink">{sample.intelligence.recommendation}</p>
                </div>
              </div>
            )}
          </Reveal>
          <Reveal className="order-1 lg:order-2">
            <SectionHeading
              eyebrow="Policy traceability"
              title="Every recommendation should have a reason behind it."
              body="Agents see which policy applied, which section, which version, and why it applies to this complaint. When a policy changes, the version on each complaint shows exactly what guidance was used."
            />
          </Reveal>
        </div>
      </section> */}

      {/* COMPLEX COMPLAINT */}
      <section className="border-y border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <Reveal>
            <SectionHeading
              eyebrow="Real complaints are messy"
              title="One message. Two problems. Two teams."
              body="Customers don't file neatly separated tickets. SupportNova separates the issues so each one reaches the team that can fix it."
            />
          </Reveal>
          <Reveal delay={100} className="mt-12 grid overflow-hidden rounded-xl border border-line-strong bg-surface lg:grid-cols-[1fr_1.2fr]">
            <div className="border-b border-line p-6 sm:p-8 lg:border-b-0 lg:border-r">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Customer wrote</p>
              <blockquote className="mt-4 text-[20px] font-medium leading-snug text-ink sm:text-[22px]">
                “{complexExample.message}”
              </blockquote>
              <p className="mt-5 text-[13px] text-ink-muted">{complexExample.reason}</p>
            </div>
            <dl className="grid grid-cols-2 gap-px bg-line">
              {[
                ["Primary issue", complexExample.primaryIssue],
                ["Secondary issue", complexExample.secondaryIssue],
                ["Primary department", complexExample.primaryDepartment],
                ["Supporting department", complexExample.supportingDepartment],
                ["Sentiment", complexExample.sentiment],
                ["Urgency", complexExample.urgency],
              ].map(([k, v]) => (
                <div key={k} className="bg-surface px-5 py-4 sm:px-6">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{k}</dt>
                  <dd className="mt-1 text-[15px] font-medium text-ink">{v}</dd>
                </div>
              ))}
              <div className="bg-surface px-5 py-4 sm:px-6">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Priority</dt>
                <dd className="mt-1.5"><PriorityBadge priority={complexExample.priority} /></dd>
              </div>
              <div className="bg-warning-subtle px-5 py-4 sm:px-6">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-warning">Escalation</dt>
                <dd className="mt-1 text-[15px] font-medium text-ink">{complexExample.escalation}</dd>
              </div>
            </dl>
          </Reveal>
        </div>
      </section>

      {/* HARD CASES */}
      {/* <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.5fr]">
            <Reveal>
              <SectionHeading
                eyebrow="The hard cases"
                title="The difficult complaints are where clarity matters most."
                body="How a customer sounds and how urgent their problem is are two different things. SupportNova keeps them apart."
              />
              <ul className="mt-8 space-y-2 text-[14px]">
                {["Sentiment is not urgency.", "Emotion is not priority.", "Generated output is not the final decision."].map((t) => (
                  <li key={t} className="flex items-center gap-3 font-medium text-ink">
                    <span className="h-px w-5 bg-primary" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
            <ul className="divide-y divide-line border-y border-line">
              {hardCases.map((h, i) => (
                <Reveal as="li" key={h.label} delay={i * 60} className="grid gap-3 py-5 sm:grid-cols-[1fr_190px] sm:gap-6">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-primary">{h.label}</p>
                      <p className="mt-1.5 text-[15px] leading-snug text-ink">“{h.message}”</p>
                      <p className="mt-1.5 text-[13px] text-ink-muted">{h.note}</p>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-[12px] sm:grid-cols-1 sm:gap-1.5">
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <dt className="text-ink-muted">Sentiment</dt>
                        <dd className="font-medium text-ink">{h.sentiment}</dd>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <dt className="text-ink-muted">Urgency</dt>
                        <dd className={cn("font-medium", h.urgency === "Critical" ? "text-danger" : h.urgency === "High" ? "text-warning" : "text-ink")}>
                          {h.urgency}
                        </dd>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:gap-3">
                        <dt className="text-ink-muted">Handling</dt>
                        <dd className="font-medium text-secondary-dark sm:text-right">{h.handling}</dd>
                      </div>
                    </dl>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section> */}

      {/* Help Center */}
      {/* <section className="border-y border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:items-start">
            <Reveal>
              <SectionHeading
                eyebrow="Help Center"
                title="Give customers answers before they need to ask."
                body="Short, current articles on the questions customers ask most — each one tied to the policy it describes."
              />
              <form onSubmit={onKbSearch} className="mt-8">
                <label htmlFor="home-kb" className="sr-only">Search Help Center</label>
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden />
                  <input
                    id="home-kb"
                    value={kbQuery}
                    onChange={(e) => setKbQuery(e.target.value)}
                    placeholder="Search Help Center"
                    className="h-11 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-[14px] text-ink placeholder:text-ink-faint focus:border-primary"
                  />
                </div>
              </form>
              <div className="mt-4 flex flex-wrap gap-2">
                {kbCategories.slice(0, 6).map((cat) => (
                  <Link
                    key={cat}
                    to={`/help-center?category=${encodeURIComponent(cat)}`}
                    className="rounded-md border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-secondary transition-colors hover:border-primary hover:text-primary"
                  >
                    {cat}
                  </Link>
                ))}
              </div>
            </Reveal>
            <Reveal delay={100}>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {kbPreview.map((a) => (
                  <li key={a.id}>
                    <Link to={`/help-center/${a.id}`} className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-canvas-subtle">
                      <BookOpen size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium text-ink group-hover:text-primary">{a.title}</p>
                        <p className="mt-0.5 text-[13px] text-ink-muted">{a.summary}</p>
                        <p className="mt-1.5 text-[12px] text-ink-faint">
                          {a.category} · Updated {formatDate(a.updatedAt)}
                          {a.policyId ? ` · ${a.policyId}` : ""}
                        </p>
                      </div>
                      <ArrowRight size={16} className="mt-1 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              <Link to="/help-center" className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-primary hover:text-secondary-dark">
                Browse Help Center <ArrowRight size={15} aria-hidden />
              </Link>
            </Reveal>
          </div>
        </div>
      </section> */}

      {/* TRUST */}
      {/* <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <Reveal>
            <SectionHeading
              eyebrow="Accountability"
              title="Built around clear decisions, traceable information, and accountable support."
            />
          </Reveal>
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
            {TRUST.map((t, i) => (
              <Reveal key={t.title} delay={i * 70} className="bg-surface p-6">
                <t.icon size={20} className="text-primary" aria-hidden />
                <p className="mt-4 text-[15px] font-semibold text-ink">{t.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{t.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section> */}

      {/* FAQ */}
      <section className="border-t border-line bg-canvas">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.4fr] lg:py-24">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <SectionHeading eyebrow="FAQ" title="Questions, answered plainly." />
            <p className="mt-4 text-[14px] text-ink-muted">
              Something else?{" "}
              <Link to="/contact" className="font-medium text-primary hover:underline">
                Contact us
              </Link>
              .
            </p>
          </div>
          <Faq items={FAQ} />
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-primary-dark">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-20">
          <div className="max-w-xl">
            <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-white sm:text-[34px]">
              Give every complaint a clear next step.
            </h2>
            <p className="mt-3 text-[16px] text-white/70">
              Submit an issue, follow its progress, and keep the path to resolution visible.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/complaints/new" className={buttonStyles("light", "lg")}>
              Submit a complaint
            </Link>
            <Link to="/track" className={buttonStyles("outlineLight", "lg")}>
              Track a complaint
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
