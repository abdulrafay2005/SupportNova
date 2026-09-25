import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/Textarea";
import { ValidationBadge } from "@/components/ValidationResult";
import { useData } from "@/context/DataContext";
import type { Complaint } from "@/types";

const ACTIONS = ["Approve", "Reject", "Modify", "Reclassify", "Reassign", "Escalate", "Regenerate Response", "Add Comment"] as const;

export function ManualReview() {
  const { complaints, customers, addComment } = useData();
  const queue = complaints.filter(
    (c) => c.validation === "Mismatch" || c.validation === "Manual Review Required" || (c.reviewReasons && c.reviewReasons.length > 0),
  );
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [action, setAction] = useState<(typeof ACTIONS)[number]>("Add Comment");
  const [note, setNote] = useState("");
  const [done, setDone] = useState("");

  const nameOf = (id: string) => customers.find((c) => c.id === id)?.name ?? "Unknown";

  return (
    <div>
      <PageHeader
        title="Manual review"
        description="Cases flagged for reviewer action. Controls update this demo workspace only — they are not sent to a backend."
      />
      <p className="mb-3 rounded-md border border-line bg-canvas-subtle px-3 py-2 text-[12px] text-ink-muted">
        Typical reasons: GenAI/Python disagreement, missing policy support, ambiguous complaint, escalation uncertainty, policy contradiction, or a sensitive complaint.
      </p>
      {queue.length === 0 ? (
        <EmptyState title="No cases in review" description="Nothing in this workspace currently requires manual review." />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase tracking-wide text-ink-muted">
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Issue</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                  <th className="px-3 py-2 font-medium">Validation</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {queue.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-canvas-subtle">
                    <td className="px-3 py-2 font-mono text-[12px]">
                      <Link to={`/complaints/${c.id}`} className="text-primary hover:underline">{c.id}</Link>
                    </td>
                    <td className="px-3 py-2">{nameOf(c.customerId)}</td>
                    <td className="px-3 py-2">{c.subject}</td>
                    <td className="px-3 py-2 text-ink-secondary">{c.reviewReasons?.join(", ") || c.validationDetail.reviewReason || "Review required"}</td>
                    <td className="px-3 py-2"><ValidationBadge state={c.validation} /></td>
                    <td className="px-3 py-2"><StatusBadge status={c.status} /></td>
                    <td className="px-3 py-2">
                      <button type="button" className="text-[12px] font-medium text-primary hover:underline" onClick={() => { setSelected(c); setDone(""); setNote(""); }}>
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Review ${selected.id}` : "Review"}
        footer={
          <>
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            <Button
              disabled={!note.trim()}
              onClick={() => {
                if (!selected) return;
                addComment(selected.id, `${action}: ${note.trim()}`, true);
                setDone(`${action} recorded on ${selected.id} in this demo session.`);
                setNote("");
              }}
            >
              Record action
            </Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-secondary">{selected.validationDetail.reviewReason || selected.reviewReasons?.join(" · ")}</p>
            <label className="block text-[13px] font-medium text-ink-secondary">
              Reviewer action
              <select
                className="mt-1.5 h-9 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]"
                value={action}
                onChange={(e) => setAction(e.target.value as (typeof ACTIONS)[number])}
              >
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>
            <Textarea label="Comment" value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
            {done && <p className="text-[13px] text-success">{done}</p>}
            <p className="text-[12px] text-ink-muted">UI only until backend integration exists.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
