import { useId, type SelectHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Option[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  options,
  placeholder,
  className,
  id,
  ...props
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <label className="block min-w-0">
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium text-ink-secondary">{label}</span>
      )}
      <select
        id={selectId}
        className={cn(
          "h-9 w-full rounded-md border bg-surface px-2.5 text-[13px] text-ink",
          "transition-colors hover:border-line-strong",
          error ? "border-danger" : "border-line focus:border-primary",
          className,
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}
