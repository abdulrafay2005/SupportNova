import { useId, type TextareaHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, className, id, ...props }: TextareaProps) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium text-ink-secondary">{label}</span>
      )}
      <textarea
        id={areaId}
        className={cn(
          "w-full rounded-md border bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint",
          "transition-colors hover:border-line-strong resize-y min-h-[120px]",
          error ? "border-danger" : "border-line focus:border-primary",
          className,
        )}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
      {!error && hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}
