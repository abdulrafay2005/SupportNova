import type { EscalationAssessment, FollowUp } from "@/types";
import { ValidationBadge } from "@/components/ValidationResult";

export function EscalationPanel({
  assessment,
  followUp,
}: {
  assessment: EscalationAssessment;
  followUp?: FollowUp;
}) {
  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <h3 className="text-[13px] font-semibold text-ink">Escalation assessment</h3>
        <dl className="mt-3 space-y-2 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Escalation required</dt>
            <dd className={assessment.required ? "font-medium text-danger" : "font-medium text-ink"}>
              {assessment.required ? "Yes" : "No"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Level</dt>
            <dd className="text-right font-medium text-ink">{assessment.level}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Validation</dt>
            <dd>
              <ValidationBadge state={assessment.validation} />
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[13px] text-ink-secondary">{assessment.reason}</p>
        {assessment.notes && (
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Escalation notes</p>
            <p className="mt-1 text-[13px] text-ink-secondary">{assessment.notes}</p>
          </div>
        )}
      </div>

      <div className="panel p-4">
        <h3 className="text-[13px] font-semibold text-ink">Follow-up</h3>
        {!followUp || !followUp.required ? (
          <p className="mt-2 text-[13px] text-ink-muted">No follow-up is recorded on this complaint.</p>
        ) : (
          <dl className="mt-3 space-y-2 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Required</dt>
              <dd className="font-medium">Yes</dd>
            </div>
            {followUp.type && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Type</dt>
                <dd className="text-right">{followUp.type}</dd>
              </div>
            )}
            {followUp.scheduledDate && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Scheduled</dt>
                <dd>{new Date(followUp.scheduledDate).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</dd>
              </div>
            )}
            {followUp.communication && (
              <div>
                <dt className="text-ink-muted">Customer communication</dt>
                <dd className="mt-1 text-ink-secondary">{followUp.communication}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </div>
  );
}
