import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Logo } from "@/components/Logo";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    if (!token) {
      setError("This password reset link is invalid.");
      return;
    }

    if (newPassword.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/auth/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
            new_password: newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Unable to reset your password."
        );
      }

      setSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reset your password."
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
          Reset your password
        </h1>

        <p className="mt-0.5 text-[13px] text-ink-muted">
          Choose a new password for your SupportNova account.
        </p>

        <div className="panel mt-5 p-5">
          {success ? (
            <div className="space-y-4">
              <div>
                <p className="text-[13px] font-medium text-ink">
                  Password reset successful
                </p>

                <p className="mt-1 text-[13px] text-ink-secondary">
                  Your password has been updated. You can now
                  sign in with your new password.
                </p>
              </div>

              <Link
                to="/login"
                className="inline-block text-[13px] font-medium text-primary hover:underline"
              >
                Continue to sign in
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {!token && (
                <p className="text-[12px] text-red-500">
                  This password reset link is invalid or
                  incomplete.
                </p>
              )}

              <div>
                <label
                  htmlFor="new-password"
                  className="mb-1.5 block text-[13px] font-medium text-ink"
                >
                  New password
                </label>

                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) =>
                    setNewPassword(event.target.value)
                  }
                  placeholder="Enter new password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[13px] text-ink outline-none transition focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-1.5 block text-[13px] font-medium text-ink"
                >
                  Confirm password
                </label>

                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  placeholder="Enter password again"
                  required
                  minLength={8}
                  autoComplete="new-password"
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
                disabled={loading || !token}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Resetting..."
                  : "Reset password"}
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