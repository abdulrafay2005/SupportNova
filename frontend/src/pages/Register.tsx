import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/auth/AuthContext";

export function Register() {
  const { user, register } = useAuth();

  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const next: Record<string, string> = {};

    if (name.trim().length < 2) {
      next.name = "Enter your full name.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Enter a valid email address.";
    }

    if (password.length < 8) {
      next.password = "Password must be at least 8 characters.";
    }

    if (confirm !== password) {
      next.confirm = "Passwords do not match.";
    }

    setErrors(next);
    setFormError("");

    if (Object.keys(next).length) {
      return;
    }

    setLoading(true);

    try {
      const result = await register(
        name.trim(),
        email.trim().toLowerCase(),
        password,
      );

      if (!result.ok) {
        setFormError(result.error ?? "Unable to create account.");
        return;
      }

      navigate("/dashboard", { replace: true });
    } catch {
      setFormError(
        "Unable to connect to SupportNova. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6">
          <Link to="/" aria-label="SupportNova home" className="inline-block">
            <Logo />
          </Link>

          <h1 className="mt-4 text-lg font-semibold text-ink">
            Create an account
          </h1>

          <p className="mt-0.5 text-[13px] text-ink-muted">
            Register to submit and track complaints with the support team.
          </p>
        </div>

        <form onSubmit={onSubmit} className="panel space-y-3 p-5">
          <Input
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            autoComplete="name"
            disabled={loading}
          />

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            autoComplete="email"
            disabled={loading}
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            hint="At least 8 characters."
            autoComplete="new-password"
            disabled={loading}
          />

          <Input
            label="Confirm password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm}
            autoComplete="new-password"
            disabled={loading}
          />

          {formError && (
            <p className="text-[13px] text-danger">
              {formError}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-center text-[13px] text-ink-muted">
          Already registered?{" "}
          <Link
            to="/login"
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}