import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
}

export function Input({ label, error, hint, trailing, className, id, ...props }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium text-ink-secondary">{label}</span>
      )}
      <span className="relative block">
        <input
          id={inputId}
          className={cn(
            "h-9 w-full rounded-md border bg-surface px-3 text-[13px] text-ink placeholder:text-ink-faint",
            "transition-colors hover:border-line-strong",
            error ? "border-danger" : "border-line focus:border-primary",
            trailing && "pr-9",
            className,
          )}
          {...props}
        />
        {trailing && (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-ink-faint">
            {trailing}
          </span>
        )}
      </span>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
      {!error && hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}
