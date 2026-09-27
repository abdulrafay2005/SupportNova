import { cn } from "@/utils/cn";

/**
 * Honest placeholder for a value the backend did not provide.
 *
 * SupportNova never substitutes a plausible default (a "Neutral"
 * sentiment, a "P3" priority, an "Unassigned" department) for data
 * that does not exist. Every such gap renders through this
 * component so it is obvious on screen — and in code review — that
 * nothing was invented.
 */
export function NotAvailable({
  label = "Not available",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-[12px] italic text-ink-faint whitespace-nowrap",
        className,
      )}
    >
      {label}
    </span>
  );
}
