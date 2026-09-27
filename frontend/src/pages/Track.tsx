import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Lock, SearchX } from "lucide-react";
import { SiteShell } from "@/components/PublicHeader";
import { buttonStyles } from "@/components/Button";
import {
  TrackingCard,
  latestUpdateFor,
} from "@/components/marketing/TrackingCard";
import { useAuth } from "@/auth/AuthContext";
import { useData } from "@/context/DataContext";
import { customerNextStep } from "@/utils/classify";
import { formatDateTime } from "@/utils/dates";

/**
 * Track a complaint.
 *
 * SupportNova has no anonymous tracking endpoint: a complaint can
 * only be read by the account that submitted it (or by staff), and
 * the API enforces that. This page therefore looks a complaint up
 * in the signed-in customer's own complaints — real data from
 * GET /api/complaints — and asks anonymous visitors to sign in
 * rather than pretending an ID-plus-email lookup exists.
 */
export function Track() {
  const { user } = useAuth();
  const { complaints, loadingComplaints, complaintError } = useData();

  const [params, setParams] = useSearchParams();
  const initialId = params.get("id") ?? "";

  const [idValue, setIdValue] = useState(initialId);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string | null>(
    initialId || null,
  );

  useEffect(() => setIdValue(initialId), [initialId]);

  const normalized = (query ?? "").trim().toLowerCase();

  const found = normalized
    ? complaints.find(
        (c) =>
          c.id.toLowerCase() === normalized ||
          c.id.toLowerCase().endsWith(normalized),
      )
    : undefined;

  const notFound = Boolean(query) && !loadingComplaints && !found;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();

    const id = idValue.trim();

    if (!id) {
      setError("Enter the complaint ID shown when you submitted.");
      setQuery(null);
      return;
    }

    setError(null);
    setParams({ id });
    setQuery(id);
  };

  return (
    <SiteShell>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">
            Track a complaint
          </p>

          <h1 className="mt-3 text-[30px] font-semibold tracking-tight text-ink sm:text-[36px]">
            Where is my complaint?
          </h1>

          <p className="mt-3 text-[15px] text-ink-secondary">
            Complaints are private to the account that raised them, so
            tracking happens inside your account. Sign in and enter your
            complaint ID to see its current status, the department handling
            it and what happens next.
          </p>

          {!user ? (
            <div className="mt-8 rounded-md border border-line bg-canvas-subtle p-5">
              <p className="flex items-center gap-2 text-[14px] font-medium text-ink">
                <Lock size={15} aria-hidden />
                Sign in to track your complaint
              </p>

              <p className="mt-1 text-[13px] text-ink-secondary">
                We never expose complaint details to an ID-and-email lookup.
                Signing in keeps your complaint, the messages on it and your
                personal details private.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/login" className={buttonStyles("primary", "md")}>
                  Sign in
                </Link>

                <Link to="/register" className={buttonStyles("outline", "md")}>
                  Create an account
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
              <div>
                <label
                  htmlFor="track-id"
                  className="text-[13px] font-medium text-ink-secondary"
                >
                  Complaint ID
                </label>

                <input
                  id="track-id"
                  value={idValue}
                  onChange={(e) => setIdValue(e.target.value)}
                  placeholder="Paste the ID from your confirmation"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "track-id-error" : undefined}
                  className="mt-1.5 h-11 w-full rounded-md border border-line-strong bg-surface px-3 font-mono text-[15px] text-ink placeholder:text-ink-faint focus:border-primary"
                />

                {error && (
                  <p
                    id="track-id-error"
                    className="mt-1.5 text-[13px] text-danger"
                  >
                    {error}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="submit" className={buttonStyles("primary", "lg")}>
                  Track complaint
                </button>

                <Link
                  to="/my-complaints"
                  className={buttonStyles("outline", "lg")}
                >
                  See all my complaints
                </Link>
              </div>
            </form>
          )}
        </div>
      </section>

      <section className="bg-canvas">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          {complaintError && (
            <p className="mb-4 rounded border border-danger/30 p-3 text-[13px] text-danger">
              {complaintError}
            </p>
          )}

          {user && loadingComplaints && (
            <p className="text-[14px] text-ink-muted">
              Loading your complaints…
            </p>
          )}

          {user && !query && !loadingComplaints && (
            <p className="text-[14px] text-ink-muted">
              Your complaint ID was shown after you submitted and is listed
              against every complaint in your account.
            </p>
          )}

          {notFound && (
            <div className="panel flex flex-col items-center px-6 py-12 text-center">
              <SearchX size={22} className="text-ink-muted" aria-hidden />

              <h2 className="mt-3 text-[16px] font-semibold text-ink">
                No complaint with that ID in your account
              </h2>

              <p className="mt-1 max-w-sm text-[14px] text-ink-muted">
                Check the ID and try again. If the complaint was raised from a
                different account, sign in with that account instead.
              </p>

              <Link
                to="/contact"
                className={buttonStyles("outline", "md", "mt-5")}
              >
                Contact support
              </Link>
            </div>
          )}

          {found && (
            <div className="fade-in grid gap-6 md:grid-cols-[1.2fr_1fr]">
              <TrackingCard complaint={found} />

              <div className="space-y-4">
                <div className="panel p-5">
                  <h2 className="text-[14px] font-semibold text-ink">
                    Current status
                  </h2>

                  <p className="mt-1 text-[20px] font-semibold text-secondary-dark">
                    {found.status}
                  </p>

                  <p className="mt-2 text-[13px] text-ink-muted">
                    {customerNextStep(found.status)}
                  </p>
                </div>

                <div className="panel p-5">
                  <h2 className="text-[14px] font-semibold text-ink">
                    Latest update
                  </h2>

                  <p className="mt-1 text-[14px] text-ink-secondary">
                    {latestUpdateFor(found) ??
                      "Open the complaint to see its full history."}
                  </p>

                  <p className="mt-1 text-[12px] text-ink-faint">
                    {formatDateTime(found.updatedAt)}
                  </p>
                </div>

                <Link
                  to={`/complaints/${found.id}`}
                  className="inline-flex items-center gap-1.5 text-[14px] font-medium text-primary hover:text-secondary-dark"
                >
                  View complaint details{" "}
                  <ArrowRight size={15} aria-hidden />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
