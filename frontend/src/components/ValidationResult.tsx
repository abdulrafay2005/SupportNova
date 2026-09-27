import type { GroundTruthValidation, ValidationState } from "@/types";
import { NotAvailable } from "@/components/NotAvailable";
import { cn } from "@/utils/cn";

const stateStyle: Record<ValidationState, string> = {
  Match: "text-success bg-success-subtle border-success-muted",
  Mismatch: "text-danger bg-danger-subtle border-danger-muted",
  Pending: "text-ink-muted bg-canvas border-line",
  "Manual Review Required": "text-warning bg-warning-subtle border-warning-muted",
};

export function ValidationBadge({ state }: { state: ValidationState | null | undefined }) {
  if (!state) return <NotAvailable />;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-px text-[11px] font-medium leading-5 whitespace-nowrap",
        stateStyle[state],
      )}
    >
      {state}
    </span>
  );
}

export function ValidationResult({ detail }: { detail: GroundTruthValidation | null }) {
  if (!detail) {
    return (
      <div className="panel px-4 py-4">
        <h3 className="text-[13px] font-semibold text-ink">
          Ground-truth validation
        </h3>
        <p className="mt-1 text-[13px] text-ink-muted">
          No validation record is stored for this complaint.
        </p>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div>
          <h3 className="text-[13px] font-semibold text-ink">Ground-truth validation</h3>
          <p className="text-[12px] text-ink-muted">GenAI output compared with the Python validation pipeline.</p>
        </div>
        <ValidationBadge state={detail.overall} />
      </div>
      {detail.reviewReason && (
        <p className="border-b border-line bg-warning-subtle px-4 py-2 text-[13px] text-warning">{detail.reviewReason}</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-2 font-medium">Field</th>
              <th className="px-4 py-2 font-medium">GenAI</th>
              <th className="px-4 py-2 font-medium">Python</th>
              <th className="px-4 py-2 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {detail.fields.map((f) => (
              <tr key={f.field} className="border-b border-line last:border-0">
                <td className="px-4 py-2 text-ink-secondary">{f.field}</td>
                <td className="px-4 py-2">{f.genai}</td>
                <td className="px-4 py-2">{f.python}</td>
                <td className="px-4 py-2">
                  <span className={f.result === "Match" ? "text-success" : "font-medium text-danger"}>{f.result}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-line bg-line text-[13px]">
        <div className="bg-surface px-4 py-2">
          Policy:{" "}
          <span className={detail.policyValidated ? "font-medium text-success" : "font-medium text-warning"}>
            {detail.policyValidated ? "Validated" : "Not validated"}
          </span>
        </div>
        <div className="bg-surface px-4 py-2">
          Resolution:{" "}
          <span className={detail.resolutionValidated ? "font-medium text-success" : "font-medium text-warning"}>
            {detail.resolutionValidated ? "Validated" : "Not validated"}
          </span>
        </div>
      </div>
    </div>
  );
}
