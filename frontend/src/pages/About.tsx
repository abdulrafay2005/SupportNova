import { Link } from "react-router-dom";
import { SiteShell } from "@/components/PublicHeader";
import { buttonStyles } from "@/components/Button";
import { Reveal } from "@/components/marketing/Reveal";

const SECTIONS = [
  {
    title: "Why SupportNova exists",
    body: [
      "Complaints arrive as free text. They mix several issues, carry strong emotion and leave out details. Most are not hard because the problem is complicated. They are hard because nobody can see where they are.",
      "SupportNova exists to make that path visible — for everyone involved.",
    ],
  },
  {
    title: "Our approach",
    body: [
      "Every complaint follows the same structured path: understand it, check it, route it, resolve it and follow it up. Analysis identifies the issues, sentiment, urgency and priority. Validation checks the result against the organization’s own rules. People review anything uncertain.",
    ],
  },
  {
    title: "Who it’s for",
    body: [
      "Customers get a clear reference, a plain-language status and the next step. If we need more information, we ask a specific question rather than a vague one.",
      "Support teams get each complaint with its context already assembled: the analysis, the policy that applies, recommended steps and a draft reply to review before sending.",
    ],
  },
  {
    title: "Checked and traceable",
    body: [
      "Recommendations are compared with a rule-based check. When they agree, the recommendation moves forward. When they don’t, it goes to manual review. Each complaint also records which policy, section and version applied, so any decision can be traced back.",
    ],
  },
];

export function About() {
  return (
    <SiteShell>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">About</p>
          <h1 className="mt-3 text-[32px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[42px]">
            Complaint handling should be clear to the people living through it.
          </h1>
        </div>
      </section>
      <section className="bg-canvas">
        <div className="mx-auto max-w-3xl divide-y divide-line px-4 py-10 sm:px-6">
          {SECTIONS.map((s) => (
            <Reveal key={s.title} className="grid gap-3 py-10 md:grid-cols-[200px_1fr] md:gap-10">
              <h2 className="text-[16px] font-semibold text-ink">{s.title}</h2>
              <div className="space-y-3">
                {s.body.map((p) => (
                  <p key={p} className="text-[15px] leading-relaxed text-ink-secondary">
                    {p}
                  </p>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-[16px] font-medium text-ink">See it in action.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/complaints/new" className={buttonStyles("primary", "lg")}>
              Submit a complaint
            </Link>
            <Link to="/how-it-works" className={buttonStyles("outline", "lg")}>
              How it works
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}