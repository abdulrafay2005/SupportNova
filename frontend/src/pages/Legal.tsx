import { SiteShell } from "@/components/PublicHeader";

const CONTENT = {
  privacy: {
    title: "Privacy",
    intro: "How SupportNova treats the information you provide when you submit or track a complaint.",
    items: [
      ["What we collect", "Your name, contact details, the complaint you describe, references you provide and any attachments you add."],
      ["Why we use it", "To investigate and resolve your complaint, route it to the right team, and keep you informed."],
      ["Who can see it", "Support staff handling your complaint and reviewers where a case requires manual review. Internal notes are not shown on the customer view."],
      ["Data requests", "You can ask for a copy of your information, or for it to be deleted. These requests follow a controlled, verified process."],
    ],
  },
  terms: {
    title: "Terms",
    intro: "The basic terms for using SupportNova to submit and track complaints.",
    items: [
      ["Accurate information", "Please describe your complaint honestly and include the references you have. It helps us resolve it correctly."],
      ["Respectful communication", "We will treat you with respect and ask the same in return."],
      ["Outcomes", "Resolutions follow the applicable policies. A recommendation shown during handling is not a final decision until it has been validated and confirmed by the support team."],
      ["Complaint references", "Keep your complaint ID. It is how you and our team refer to the same case."],
    ],
  },
} as const;

export function Legal({ kind }: { kind: keyof typeof CONTENT }) {
  const c = CONTENT[kind];
  return (
    <SiteShell>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h1 className="text-[32px] font-semibold tracking-tight text-ink">{c.title}</h1>
          <p className="mt-3 text-[15px] text-ink-secondary">{c.intro}</p>
        </div>
      </section>
      <section className="bg-canvas">
        <dl className="mx-auto max-w-3xl divide-y divide-line px-4 py-8 sm:px-6">
          {c.items.map(([k, v]) => (
            <div key={k} className="grid gap-2 py-6 md:grid-cols-[200px_1fr] md:gap-8">
              <dt className="text-[15px] font-semibold text-ink">{k}</dt>
              <dd className="text-[15px] leading-relaxed text-ink-secondary">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </SiteShell>
  );
}
