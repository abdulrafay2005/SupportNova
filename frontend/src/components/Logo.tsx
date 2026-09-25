import { cn } from "@/utils/cn";

export function Logo({
  compact = false,
  className,
  light = false,
}: {
  compact?: boolean;
  className?: string;
  light?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5 min-w-0", className)}>
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden className="shrink-0">
        <rect width="24" height="24" rx="5" className={light ? "fill-soft-green" : "fill-primary"} />
        <path
          d="M12 5.6l1.35 3.72h3.92l-3.17 2.28 1.21 3.8L12 13.28 8.69 15.4l1.21-3.8-3.17-2.28h3.92L12 5.6z"
          className={light ? "fill-primary-dark" : "fill-white"}
        />
      </svg>
      {!compact && (
        <span className={cn("truncate text-[15px] font-semibold tracking-tight", light ? "text-white" : "text-ink")}>
          SupportNova
        </span>
      )}
    </div>
  );
}
