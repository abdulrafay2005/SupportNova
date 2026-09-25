import { Check } from "lucide-react";
import { workflowSteps } from "@/utils/classify";
import { cn } from "@/utils/cn";
import type { ComplaintStatus } from "@/types";

export function WorkflowSteps({
  status,
  escalated,
}: {
  status: ComplaintStatus;
  escalated: boolean;
}) {
  const steps = workflowSteps(status, escalated);
  return (
    <ol className="space-y-2">
      {steps.map((step) => (
        <li key={step.key} className="flex items-center gap-2.5 text-[13px]">
          <span
            className={cn(
              "flex h-4.5 w-4.5 h-[18px] w-[18px] items-center justify-center rounded-full border",
              step.done
                ? "border-success bg-success text-white"
                : "border-line-strong bg-surface text-transparent",
            )}
          >
            {step.done && <Check size={11} strokeWidth={3} />}
          </span>
          <span className={step.done ? "text-ink" : "text-ink-muted"}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
