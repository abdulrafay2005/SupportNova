import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/auth/AuthContext";

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const requested = (location.state as { from?: string } | null)?.from;
  const from = requested && requested !== "/" && requested !== "/login" ? requested : "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  if (user) return <Navigate to={from} replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof fieldErrors = {};
    if (!email.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";
    setFieldErrors(next);
    if (Object.keys(next).length) return;
    const result = login(email, password, remember);
    if (!result.ok) {
      setError(result.error ?? "Unable to sign in.");
      return;
    }
    navigate(from, { replace: true });
  };

  const fill = (value: string) => {
    setEmail(value);
    setPassword("demo123");
    setError("");
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-start gap-3">
          <Link to="/" aria-label="SupportNova home" className="inline-block"><Logo /></Link>
          <div>
            <h1 className="text-lg font-semibold text-ink">Welcome back</h1>
            <p className="mt-0.5 text-[13px] text-ink-muted">Sign in to the customer-care workspace.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="panel p-5">
          <div className="space-y-3">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
              placeholder="you@company.com"
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-[13px] text-ink-secondary">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-[13px] text-primary hover:underline">
              Forgot password
            </Link>
          </div>
          {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
          <Button type="submit" className="mt-4 w-full">
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-[13px] text-ink-muted">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create account
          </Link>
        </p>

        <div className="mt-6 rounded-md border border-line bg-surface px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Demo access</p>
          <p className="mt-1 text-[12px] text-ink-muted">Password for all accounts: demo123</p>
          <ul className="mt-2 space-y-1 text-[12px]">
            <li>
              <button type="button" className="text-primary hover:underline" onClick={() => fill("nora.hayes@supportnova.com")}>
                nora.hayes@supportnova.com
              </button>
              <span className="text-ink-faint"> · Agent</span>
            </li>
            <li>
              <button type="button" className="text-primary hover:underline" onClick={() => fill("marcus.adeyemi@supportnova.com")}>
                marcus.adeyemi@supportnova.com
              </button>
              <span className="text-ink-faint"> · Admin</span>
            </li>
            <li>
              <button type="button" className="text-primary hover:underline" onClick={() => fill("ayesha.khan@example.com")}>
                ayesha.khan@example.com
              </button>
              <span className="text-ink-faint"> · Customer</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
