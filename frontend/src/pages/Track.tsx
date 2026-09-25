import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, SearchX } from "lucide-react";
import { SiteShell } from "@/components/PublicHeader";
import { buttonStyles } from "@/components/Button";
import { TrackingCard, latestUpdateFor } from "@/components/marketing/TrackingCard";
import { useData } from "@/context/DataContext";
import { customerNextStep } from "@/utils/classify";
import { formatDateTime } from "@/utils/dates";

const ID_PATTERN = /^SN-\d{6}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Track() {
  const { complaints, getCustomer } = useData();
  const [params, setParams] = useSearchParams();
  const initialId = (params.get("id") ?? "").toUpperCase();

  const [idValue, setIdValue] = useState(initialId);
  const [emailValue, setEmailValue] = useState("");
  const [errors, setErrors] = useState<{ id?: string; email?: string; lookup?: string }>({});
  const [result, setResult] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => setIdValue(initialId), [initialId]);

  const found = result
    ? complaints.find((c) => {
        if (c.id !== result.id) return false;
        const customer = getCustomer(c.customerId);
        const complaintEmail = customer?.email;
        return complaintEmail?.toLowerCase() === result.email.toLowerCase();
      })
    : undefined;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const id = idValue.trim().toUpperCase();
    const email = emailValue.trim();
    const next: { id?: string; email?: string } = {};
    if (!id) next.id = "Enter your complaint ID.";
    else if (!ID_PATTERN.test(id)) next.id = "Complaint IDs look like SN-000124.";
    if (!email) next.email = "Enter the email you submitted with.";
    else if (!EMAIL_PATTERN.test(email)) next.email = "Enter a valid email.";
    setErrors(next);
    if (Object.keys(next).length) {
      setResult(null);
      return;
    }
    setParams({ id });
    setResult({ id, email });
  };

  const notFound = result && !found;

  return (
    <SiteShell>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">Track a complaint</p>
          <h1 className="mt-3 text-[30px] font-semibold tracking-tight text-ink sm:text-[36px]">Where is my complaint?</h1>
          <p className="mt-3 text-[15px] text-ink-secondary">
            Enter your complaint ID and the email you submitted with to see the current status, who is handling it and what happens next.
          </p>
          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            <div>
              <label htmlFor="track-id" className="text-[13px] font-medium text-ink-secondary">
                Complaint ID
              </label>
              <input
                id="track-id"
                value={idValue}
                onChange={(e) => setIdValue(e.target.value)}
                placeholder="SN-000124"
                aria-invalid={Boolean(errors.id)}
                aria-describedby={errors.id ? "track-id-error" : undefined}
                className="mt-1.5 h-11 w-full rounded-md border border-line-strong bg-surface px-3 font-mono text-[15px] text-ink placeholder:text-ink-faint focus:border-primary"
              />
              {errors.id && (
                <p id="track-id-error" className="mt-1.5 text-[13px] text-danger">
                  {errors.id}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="track-email" className="text-[13px] font-medium text-ink-secondary">
                Email used when submitting
              </label>
              <input
                id="track-email"
                type="email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                placeholder="ayesha.khan@example.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "track-email-error" : undefined}
                className="mt-1.5 h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-primary"
              />
              {errors.email && (
                <p id="track-email-error" className="mt-1.5 text-[13px] text-danger">
                  {errors.email}
                </p>
              )}
            </div>
            <button type="submit" className={buttonStyles("primary", "lg")}>
              Track complaint
            </button>
          </form>
        </div>
      </section>

      <section className="bg-canvas">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          {!result && (
            <p className="text-[14px] text-ink-muted">
              Your complaint ID and the email you used were both shown after you submitted, and in the confirmation we sent you.
            </p>
          )}

          {notFound && (
            <div className="panel flex flex-col items-center px-6 py-12 text-center">
              <SearchX size={22} className="text-ink-muted" aria-hidden />
              <h2 className="mt-3 text-[16px] font-semibold text-ink">We couldn't find a match</h2>
              <p className="mt-1 max-w-sm text-[14px] text-ink-muted">
                Check the ID and the email you used, and try again. If it still doesn't appear, contact us and we'll look into it.
              </p>
              <Link to="/contact" className={buttonStyles("outline", "md", "mt-5")}>
                Contact support
              </Link>
            </div>
          )}

          {found && (
            <div className="fade-in grid gap-6 md:grid-cols-[1.2fr_1fr]">
              <TrackingCard complaint={found} />
              <div className="space-y-4">
                <div className="panel p-5">
                  <h2 className="text-[14px] font-semibold text-ink">Current status</h2>
                  <p className="mt-1 text-[20px] font-semibold text-secondary-dark">{found.status}</p>
                  <p className="mt-2 text-[13px] text-ink-muted">{customerNextStep(found.status)}</p>
                </div>
                <div className="panel p-5">
                  <h2 className="text-[14px] font-semibold text-ink">Latest update</h2>
                  <p className="mt-1 text-[14px] text-ink-secondary">{latestUpdateFor(found)}</p>
                  <p className="mt-1 text-[12px] text-ink-faint">{formatDateTime(found.updatedAt)}</p>
                </div>
                {found.followUp?.required && found.followUp.type && (
                  <div className="panel p-5">
                    <h2 className="text-[14px] font-semibold text-ink">What to expect</h2>
                    <p className="mt-1 text-[14px] text-ink-secondary">{found.followUp.type}</p>
                  </div>
                )}
                <Link to={`/complaints/${found.id}`} className="inline-flex items-center gap-1.5 text-[14px] font-medium text-primary hover:text-secondary-dark">
                  View complaint details <ArrowRight size={15} aria-hidden />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}