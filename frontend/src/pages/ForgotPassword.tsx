import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Logo } from "@/components/Logo";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setSent(true);
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[400px]">
        <Link to="/" aria-label="SupportNova home" className="inline-block"><Logo /></Link>
        <h1 className="mt-4 text-lg font-semibold text-ink">Reset your password</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Enter the email on your account. If it exists, we will send reset instructions.
        </p>
        {sent ? (
          <div className="panel mt-5 p-5">
            <p className="text-sm font-medium text-ink">Check your inbox</p>
            <p className="mt-1 text-[13px] text-ink-secondary">
              If an account exists for {email}, password reset instructions have been sent. The message may take a few minutes to arrive.
            </p>
            <Link to="/login" className="mt-4 inline-block text-[13px] font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="panel mt-5 space-y-3 p-5">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
            <Button type="submit" className="w-full">
              Send instructions
            </Button>
            <Link to="/login" className="block text-center text-[13px] text-ink-muted hover:text-ink">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
