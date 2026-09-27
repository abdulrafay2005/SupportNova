import { Shield } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";

/**
 * Routing and escalation rules.
 *
 * The rule matrix is owned by the deterministic rule engine and
 * lives in the `ml/data` CSV files that ship with the backend. The
 * API exposes no endpoint for reading or editing those rules, so
 * there is nothing real to render here.
 *
 * This page previously displayed a hand-written sample matrix with
 * an enable/disable switch that only mutated browser state. That
 * gave the impression an administrator could change live routing,
 * which was not true, so it has been removed rather than left in
 * place as decoration.
 */
export function RulesAdmin() {
  return (
    <div>
      <PageHeader
        title="Routing & escalation rules"
        description="Rules that decide category, department, priority and escalation for every complaint."
      />

      <EmptyState
        icon={<Shield size={18} />}
        title="Rules are not exposed through the API"
        description="Routing, escalation and resolution rules are evaluated by the backend rule engine from its own data files. SupportNova has no endpoint for reading or editing them, so no rule list can be shown here. The effect of the rules is visible on each complaint: the department it was routed to, the priority it was given and whether it was escalated."
      />

      <div className="panel mt-4 px-4 py-4">
        <h2 className="text-[13px] font-semibold text-ink">
          Where rule behaviour is visible today
        </h2>

        <ul className="mt-2 space-y-1.5 text-[13px] text-ink-secondary">
          <li>
            <span className="font-medium text-ink">Departments</span> — the
            routing targets the engine can emit, with the agents attached to
            each one.
          </li>
          <li>
            <span className="font-medium text-ink">Complaint detail</span> —
            the category, department, priority and escalation the engine
            produced for an individual complaint.
          </li>
          <li>
            <span className="font-medium text-ink">Manual review</span> —
            complaints the validation step could not confirm, with the
            reasons it recorded.
          </li>
          <li>
            <span className="font-medium text-ink">Audit logs</span> — every
            routing and assignment decision that was actually persisted.
          </li>
        </ul>
      </div>
    </div>
  );
}
