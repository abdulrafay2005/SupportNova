import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, FileWarning, HelpCircle, LifeBuoy } from "lucide-react";
import { SiteShell } from "@/components/PublicHeader";
import { Button, buttonStyles } from "@/components/Button";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import { cn } from "@/utils/cn";

const TOPICS = [
  { id: "customer", label: "Customer support", body: "Questions about an order, account or payment.", icon: LifeBuoy },
  { id: "complaint", label: "Complaint support", body: "Help with a complaint you've already submitted.", icon: FileWarning },
  { id: "general", label: "General enquiry", body: "Anything else about SupportNova.", icon: HelpCircle },
] as const;

export function Contact() {
  const [topic, setTopic] = useState<(typeof TOPICS)[number]["id"]>("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address.";
    if (subject.trim().length < 3) next.subject = "Add a short subject.";
    if (message.trim().length < 20) next.message = "Tell us a little more (at least 20 characters).";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSent(true);
  };

  return (
    <SiteShell>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">Contact</p>
          <h1 className="mt-3 text-[32px] font-semibold tracking-tight text-ink sm:text-[40px]">How can we help?</h1>
          <p className="mt-3 max-w-xl text-[15px] text-ink-secondary">
            For a problem with an order or service, submitting a complaint is the fastest route — it gets a reference and goes straight to the right team.
          </p>
        </div>
      </section>

      <section className="bg-canvas">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-muted">What is this about?</p>
            <div role="radiogroup" aria-label="Topic" className="space-y-2">
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={topic === t.id}
                  onClick={() => setTopic(t.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border bg-surface p-4 text-left transition-colors",
                    topic === t.id ? "border-primary shadow-[var(--shadow-panel)]" : "border-line hover:border-line-strong",
                  )}
                >
                  <t.icon size={18} className={topic === t.id ? "text-primary" : "text-ink-muted"} aria-hidden />
                  <span>
                    <span className="block text-[14px] font-semibold text-ink">{t.label}</span>
                    <span className="block text-[13px] text-ink-muted">{t.body}</span>
                  </span>
                </button>
              ))}
            </div>
            {topic === "complaint" && (
              <p className="rounded-md border border-line bg-surface px-4 py-3 text-[13px] text-ink-secondary">
                You can check progress yourself on the{" "}
                <Link to="/track" className="font-medium text-primary hover:underline">
                  tracking page
                </Link>
                .
              </p>
            )}
          </div>

          <div className="panel p-6">
            {sent ? (
              <div className="py-8 text-center">
                <CheckCircle2 size={28} className="mx-auto text-success" aria-hidden />
                <h2 className="mt-3 text-[18px] font-semibold text-ink">Thanks, {name.split(" ")[0]}.</h2>
                <p className="mx-auto mt-2 max-w-sm text-[14px] text-ink-muted">
                  Your message has been recorded in this session. Email delivery isn't connected yet, so for anything urgent please submit a complaint.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Link to="/complaints/new" className={buttonStyles("primary", "md")}>
                    Submit a complaint
                  </Link>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSent(false);
                      setSubject("");
                      setMessage("");
                    }}
                  >
                    Send another message
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="name" />
                  <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoComplete="email" />
                </div>
                <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} error={errors.subject} />
                <Textarea label="Message" value={message} onChange={(e) => setMessage(e.target.value)} error={errors.message} rows={6} />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] text-ink-faint">Topic: {TOPICS.find((t) => t.id === topic)?.label}</p>
                  <Button type="submit" size="lg">
                    Send message
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
