import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || "Unable to process the request."
        );
      }

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to process the request."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[400px]">
        <Link
          to="/"
          aria-label="SupportNova home"
          className="inline-block"
        >
          <Logo />
        </Link>

        <h1 className="mt-4 text-lg font-semibold text-ink">
          Forgot your password?
        </h1>

        <p className="mt-0.5 text-[13px] text-ink-muted">
          Enter your email and we’ll send you a password reset link.
        </p>

        <div className="panel mt-5 p-5">
          {submitted ? (
            <div className="space-y-4">
              <div>
                <p className="text-[13px] font-medium text-ink">
                  Check your email
                </p>

                <p className="mt-1 text-[13px] text-ink-secondary">
                  If an account exists for this email, a password
                  reset link has been sent.
                </p>
              </div>

              <p className="text-[12px] text-ink-muted">
                The reset link expires after 30 minutes.
              </p>

              <div className="border-t border-line pt-3">
                <Link
                  to="/login"
                  className="text-[13px] font-medium text-primary hover:underline"
                >
                  Back to sign in
                </Link>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-[13px] font-medium text-ink"
                >
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[13px] text-ink outline-none transition focus:border-primary"
                />
              </div>

              {error && (
                <p className="text-[12px] text-red-500">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Sending..."
                  : "Send reset link"}
              </button>

              <div className="border-t border-line pt-3">
                <Link
                  to="/login"
                  className="text-[13px] font-medium text-primary hover:underline"
                >
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}