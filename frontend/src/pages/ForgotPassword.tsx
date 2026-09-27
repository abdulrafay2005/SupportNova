import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

/**
 * Password reset
 *
 * The API has no password-reset endpoint and the application sends
 * no email, so this page does not collect an address and does not
 * claim that instructions were sent. It explains the real recovery
 * path instead: an administrator re-provisions the credential.
 */
export function ForgotPassword() {
  return (
    <div className="flex min-h-full items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[400px]">
        <Link to="/" aria-label="SupportNova home" className="inline-block">
          <Logo />
        </Link>

        <h1 className="mt-4 text-lg font-semibold text-ink">
          Password help
        </h1>

        <p className="mt-0.5 text-[13px] text-ink-muted">
          Self-service password reset is not available yet.
        </p>

        <div className="panel mt-5 space-y-3 p-5">
          <p className="text-[13px] text-ink-secondary">
            SupportNova does not currently send password reset emails. To
            regain access to an account:
          </p>

          <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-ink-secondary">
            <li>
              <span className="font-medium text-ink">Staff accounts</span> —
              ask an administrator, who provisions staff credentials from
              Staff &amp; Users in the admin dashboard.
            </li>
            <li>
              <span className="font-medium text-ink">Customer accounts</span> —
              contact support, or create a new account if you have not
              submitted a complaint yet.
            </li>
          </ul>

          <div className="flex flex-wrap gap-4 border-t border-line pt-3">
            <Link
              to="/login"
              className="text-[13px] font-medium text-primary hover:underline"
            >
              Back to sign in
            </Link>

            <Link
              to="/contact"
              className="text-[13px] font-medium text-primary hover:underline"
            >
              Contact support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
