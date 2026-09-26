import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { PageHeader } from "@/components/PageHeader";
import { Textarea } from "@/components/Textarea";
import { getReviewQueue, reviewAction, type WorkflowComplaint } from "@/api/workflows";

type ReviewerAction =
  | "approve"
  | "modify"
  | "reclassify"
  | "reassign"
  | "reject"
  | "escalate"
  | "comment"
  | "regenerate-response";

function extractDetail(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

export function ManualReview() {
  const [queue, setQueue] = useState<WorkflowComplaint[]>([]);
  const [selected, setSelected] = useState<WorkflowComplaint | null>(null);
  const [action, setAction] = useState<ReviewerAction>("approve");
  const [comment, setComment] = useState("");
  const [customerResponse, setCustomerResponse] = useState("");
  const [agentGuidance, setAgentGuidance] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [department, setDepartment] = useState("");
  const [agentId, setAgentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try { setQueue(await getReviewQueue()); setError(null); }
    catch (e: unknown) { setError(extractDetail(e, "Unable to load review queue.")); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  function resetForm() {
    setSelected(null); setAction("approve"); setComment("");
    setCustomerResponse(""); setAgentGuidance("");
    setCategory(""); setSubcategory(""); setDepartment(""); setAgentId("");
  }

  /*
   * Build the exact request body each backend schema expects.
   * Returns null when required fields are missing.
   */
  function buildPayload(): Record<string, unknown> | null {
    const trimmedComment = comment.trim();
    if (!trimmedComment) return null;

    if (action === "modify") {
      // ReviewModifyRequest: comment (required),
      // customer_response / agent_guidance (optional).
      const payload: Record<string, unknown> = { comment: trimmedComment };
      if (customerResponse.trim()) payload.customer_response = customerResponse.trim();
      if (agentGuidance.trim()) payload.agent_guidance = agentGuidance.trim();
      return payload;
    }

    if (action === "reclassify") {
      // ReviewReclassifyRequest: category, subcategory, department, comment.
      if (!category.trim() || !subcategory.trim() || !department.trim()) return null;
      return {
        category: category.trim(),
        subcategory: subcategory.trim(),
        department: department.trim(),
        comment: trimmedComment,
      };
    }

    if (action === "reassign") {
      // ReviewReassignRequest: agent_id, comment.
      if (!agentId.trim()) return null;
      return { agent_id: agentId.trim(), comment: trimmedComment };
    }

    // approve / reject / escalate / regenerate-response (ReviewActionRequest)
    // and comment (ReviewCommentRequest) all take { comment }.
    return { comment: trimmedComment };
  }

  const payloadReady = buildPayload() !== null;

  async function submit() {
    if (!selected || saving) return;
    const payload = buildPayload();
    if (!payload) return;

    setSaving(true);
    try {
      await reviewAction(selected.id, action, payload);
      resetForm();
      await refresh();
    } catch (e: unknown) {
      setError(extractDetail(e, "Reviewer action failed."));
    } finally {
      setSaving(false);
    }
  }

  return <div>
    <PageHeader title="Manual review" description="Live reviewer queue from the SupportNova backend." />
    {error && <p className="mb-3 rounded border border-danger/30 p-3 text-[13px] text-danger">{error}</p>}
    {loading ? <p className="text-[13px] text-ink-muted">Loading review queue…</p> : queue.length === 0 ? <EmptyState title="No cases in review" description="The backend has no pending review cases." /> : <div className="panel overflow-x-auto"><table className="w-full min-w-[700px] text-left text-[13px]"><thead><tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase text-ink-muted"><th className="px-3 py-2">ID</th><th className="px-3 py-2">Issue</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Review</th></tr></thead><tbody>{queue.map((c) => <tr key={c.id} className="border-b border-line"><td className="px-3 py-2"><Link className="text-primary hover:underline" to={`/complaints/${c.id}`}>{c.id}</Link></td><td className="px-3 py-2">{c.title}</td><td className="px-3 py-2">{c.status}</td><td className="px-3 py-2"><Button size="sm" onClick={() => setSelected(c)}>Review</Button></td></tr>)}</tbody></table></div>}

    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-surface p-5 shadow-xl">
      <h2 className="mb-3 font-semibold">Review {selected.id}</h2>

      <label className="block text-[13px]">Action
        <select className="mt-1 w-full rounded border p-2" value={action} onChange={(e) => setAction(e.target.value as ReviewerAction)}>
          <option value="approve">Approve</option>
          <option value="modify">Modify</option>
          <option value="reclassify">Reclassify</option>
          <option value="reassign">Reassign</option>
          <option value="reject">Reject</option>
          <option value="escalate">Escalate</option>
          <option value="comment">Comment</option>
          <option value="regenerate-response">Regenerate response</option>
        </select>
      </label>

      {action === "modify" && <div className="mt-3 space-y-3">
        <Textarea label="Customer response (optional)" value={customerResponse} onChange={(e) => setCustomerResponse(e.target.value)} rows={3} hint="Replaces the AI-drafted customer response when provided." />
        <Textarea label="Agent guidance (optional)" value={agentGuidance} onChange={(e) => setAgentGuidance(e.target.value)} rows={3} hint="Replaces the internal agent guidance when provided." />
      </div>}

      {action === "reclassify" && <div className="mt-3 space-y-3">
        <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Payments & Billing" />
        <Input label="Subcategory" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="e.g. Duplicate charge" />
        <Input label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Payments & Finance" />
        <p className="text-[12px] text-ink-muted">Values are recorded exactly as entered; the backend stores the new classification and re-routes the complaint.</p>
      </div>}

      {action === "reassign" && <div className="mt-3 space-y-3">
        <Input label="Agent ID" value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="Backend user ID of an active agent" />
        <p className="text-[12px] text-ink-muted">The backend verifies the ID belongs to an active agent in the complaint&apos;s assigned department. No reviewer-accessible agent directory endpoint exists yet, so the ID must be entered manually.</p>
      </div>}

      <Textarea className="mt-3" label="Comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={4} />

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={resetForm}>Cancel</Button>
        <Button disabled={saving || !payloadReady} onClick={() => void submit()}>{saving ? "Saving…" : "Submit"}</Button>
      </div>
    </div></div>}
  </div>;
}
