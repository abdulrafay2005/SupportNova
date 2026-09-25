import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "info" | "warning" | "danger" | "success";
  icon?: ReactNode;
}

const tones: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-ink",
  info: "text-primary",
  warning: "text-warning",
  danger: "text-danger",
  success: "text-success",
};

export function StatCard({ label, value, hint, tone = "default", icon }: StatCardProps) {
  return (
    <div className="panel px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">{label}</p>
        {icon && <span className="text-ink-faint">{icon}</span>}
      </div>
      <p className={cn("mt-1 text-2xl font-semibold tabular tracking-tight", tones[tone])}>{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-ink-muted">{hint}</p>}
    </div>
  );
}
