import type { ResolutionPlan } from "@/types";

export function ResolutionSteps({ plan }: { plan?: ResolutionPlan }) {
  if (!plan) {
    return (
      <div className="panel p-4">
        <h3 className="text-[13px] font-semibold text-ink">Recommended resolution</h3>
        <p className="mt-1 text-[13px] text-ink-muted">No validated resolution plan is stored on this complaint yet.</p>
      </div>
    );
  }

  return (
    <div className="panel p-4">
      <h3 className="text-[13px] font-semibold text-ink">Recommended resolution</h3>
      <ol className="mt-3 space-y-1.5">
        {plan.steps.map((step, i) => (
          <li key={step} className="flex gap-2 text-[13px] text-ink-secondary">
            <span className="tabular text-ink-faint">{i + 1}.</span>
            {step}
          </li>
        ))}
      </ol>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Required actions</p>
          <ul className="mt-1 list-disc pl-4 text-[13px] text-ink-secondary">
            {plan.requiredActions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Prohibited actions</p>
          <ul className="mt-1 list-disc pl-4 text-[13px] text-ink-secondary">
            {plan.prohibitedActions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-ink-muted">
        <span>Refund: {plan.refundEligible ? "Eligible" : plan.refundEligible === false ? "Not eligible" : "Not assessed"}</span>
        <span>Replacement: {plan.replacementEligible ? "Eligible" : plan.replacementEligible === false ? "Not eligible" : "Not assessed"}</span>
      </div>
    </div>
  );
}
