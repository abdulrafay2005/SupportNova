import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { PageHeader } from "@/components/PageHeader";
import { Textarea } from "@/components/Textarea";
import {
  getReviewQueue,
  reviewAction,
  type WorkflowComplaint,
} from "@/api/workflows";

type ReviewerStatus =
  | "Manual Review"
  | "Assigned"
  | "Escalated"
  | "Rejected";

type ReviewerAction =
  | "approve"
  | "modify"
  | "reclassify"
  | "reassign"
  | "reject"
  | "escalate"
  | "comment"
  | "regenerate-response";

function extractDetail(
  error: unknown,
  fallback: string,
): string {
  const detail = (
    error as {
      response?: {
        data?: {
          detail?: unknown;
        };
      };
    }
  )?.response?.data?.detail;

  return typeof detail === "string"
    ? detail
    : fallback;
}

export function ManualReview() {
  const [queue, setQueue] = useState<
    WorkflowComplaint[]
  >([]);

  const [selected, setSelected] =
    useState<WorkflowComplaint | null>(null);

  /*
   * Reviewer workflow status.
   *
   * Reviewers do NOT get Agent lifecycle states such as:
   * In Progress, Awaiting Customer, Resolved, or Closed.
   *
   * Their job is to decide what happens to the Manual Review
   * case and, when appropriate, hand it back to an Agent.
   */
  const [reviewerStatus, setReviewerStatus] =
    useState<ReviewerStatus>("Manual Review");

  const [action, setAction] =
    useState<ReviewerAction>("approve");

  const [comment, setComment] = useState("");
  const [customerResponse, setCustomerResponse] =
    useState("");
  const [agentGuidance, setAgentGuidance] =
    useState("");

  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] =
    useState("");
  const [department, setDepartment] =
    useState("");
  const [agentId, setAgentId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] =
    useState<string | null>(null);

  async function refresh() {
    setLoading(true);

    try {
      setQueue(await getReviewQueue());
      setError(null);
    } catch (e: unknown) {
      setError(
        extractDetail(
          e,
          "Unable to load review queue.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function openReview(
    complaint: WorkflowComplaint,
  ) {
    setSelected(complaint);

    setReviewerStatus("Manual Review");
    setAction("approve");

    setComment("");
    setCustomerResponse("");
    setAgentGuidance("");

    setCategory("");
    setSubcategory("");
    setDepartment(
      complaint.assigned_department ?? "",
    );
    setAgentId("");

    setError(null);
  }

  function resetForm() {
    setSelected(null);
    setReviewerStatus("Manual Review");
    setAction("approve");

    setComment("");
    setCustomerResponse("");
    setAgentGuidance("");

    setCategory("");
    setSubcategory("");
    setDepartment("");
    setAgentId("");
  }

  /*
   * ---------------------------------------------------------
   * Reviewer status -> backend action
   * ---------------------------------------------------------
   *
   * Assigned:
   *   Sends the reviewed complaint into the normal Agent
   *   workflow.
   *
   * Escalated:
   *   Leaves the Agent workflow and enters management/
   *   escalation handling.
   *
   * Rejected:
   *   Uses the existing backend reject action.
   */
  function getStatusAction(): ReviewerAction | null {
    if (reviewerStatus === "Assigned") {
      return "approve";
    }

    if (reviewerStatus === "Escalated") {
      return "escalate";
    }

    if (reviewerStatus === "Rejected") {
      return "reject";
    }

    return null;
  }

  /*
   * Build the exact request body expected by each backend
   * review schema.
   */
  function buildPayload(): Record<
    string,
    unknown
  > | null {
    const trimmedComment =
      comment.trim();

    /*
     * Status handoff requires a reviewer message.
     * This becomes the internal handoff context for
     * the Agent / audit timeline.
     */
    if (
      reviewerStatus !== "Manual Review" &&
      !trimmedComment
    ) {
      return null;
    }

    /*
     * Explicit Reviewer status workflow.
     */
    if (reviewerStatus !== "Manual Review") {
      return {
        comment: trimmedComment,
      };
    }

    /*
     * Existing detailed review actions.
     */
    if (!trimmedComment) {
      return null;
    }

    if (action === "modify") {
      const payload: Record<
        string,
        unknown
      > = {
        comment: trimmedComment,
      };

      if (customerResponse.trim()) {
        payload.customer_response =
          customerResponse.trim();
      }

      if (agentGuidance.trim()) {
        payload.agent_guidance =
          agentGuidance.trim();
      }

      return payload;
    }

    if (action === "reclassify") {
      if (
        !category.trim() ||
        !subcategory.trim() ||
        !department.trim()
      ) {
        return null;
      }

      return {
        category: category.trim(),
        subcategory: subcategory.trim(),
        department: department.trim(),
        comment: trimmedComment,
      };
    }

    if (action === "reassign") {
      if (!agentId.trim()) {
        return null;
      }

      return {
        agent_id: agentId.trim(),
        comment: trimmedComment,
      };
    }

    return {
      comment: trimmedComment,
    };
  }

  const statusAction =
    getStatusAction();

  const statusPayload =
    buildPayload();

  const statusReady =
    reviewerStatus === "Manual Review" ||
    statusPayload !== null;

  async function submit() {
    if (!selected || saving) {
      return;
    }

    /*
     * Explicit status workflow.
     */
    if (
      reviewerStatus !== "Manual Review"
    ) {
      const actionToRun =
        statusAction;

      const payload =
        buildPayload();

      if (!actionToRun || !payload) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        await reviewAction(
          selected.id,
          actionToRun,
          payload,
        );

        resetForm();
        await refresh();
      } catch (e: unknown) {
        setError(
          extractDetail(
            e,
            "Reviewer status change failed.",
          ),
        );
      } finally {
        setSaving(false);
      }

      return;
    }

    /*
     * Existing detailed review action.
     */
    const payload =
      buildPayload();

    if (!payload) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await reviewAction(
        selected.id,
        action,
        payload,
      );

      resetForm();
      await refresh();
    } catch (e: unknown) {
      setError(
        extractDetail(
          e,
          "Reviewer action failed.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Manual review"
        description="Review complaints requiring human validation before they enter the normal support workflow."
      />

      {error && (
        <p className="mb-3 rounded border border-danger/30 p-3 text-[13px] text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-[13px] text-ink-muted">
          Loading review queue…
        </p>
      ) : queue.length === 0 ? (
        <EmptyState
          title="No cases in review"
          description="The backend has no pending manual review cases."
        />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase text-ink-muted">
                <th className="px-3 py-2">
                  ID
                </th>

                <th className="px-3 py-2">
                  Issue
                </th>

                <th className="px-3 py-2">
                  Status
                </th>

                <th className="px-3 py-2">
                  Department
                </th>

                <th className="px-3 py-2">
                  Review
                </th>
              </tr>
            </thead>

            <tbody>
              {queue.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-line"
                >
                  <td className="px-3 py-2">
                    <Link
                      className="text-primary hover:underline"
                      to={`/complaints/${c.id}`}
                    >
                      {c.id}
                    </Link>
                  </td>

                  <td className="px-3 py-2">
                    {c.title}
                  </td>

                  <td className="px-3 py-2">
                    {c.status}
                  </td>

                  <td className="px-3 py-2">
                    {c.assigned_department ??
                      "Unassigned"}
                  </td>

                  <td className="px-3 py-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        openReview(c)
                      }
                    >
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-surface p-5 shadow-xl">
            <h2 className="mb-1 font-semibold">
              Review {selected.id}
            </h2>

            <p className="mb-4 text-[12px] text-ink-muted">
              This complaint requires human review
              before it enters the Agent workflow.
            </p>

            {/* ------------------------------------------------ */}
            {/* Reviewer status                                  */}
            {/* ------------------------------------------------ */}

            <label className="block text-[13px] font-medium">
              Status

              <select
                className="mt-1 w-full rounded border border-line bg-surface p-2"
                value={reviewerStatus}
                disabled={saving}
                onChange={(e) =>
                  setReviewerStatus(
                    e.target.value as ReviewerStatus,
                  )
                }
              >
                <option value="Manual Review">
                  Manual Review
                </option>

                <option value="Assigned">
                  Assigned
                </option>

                <option value="Escalated">
                  Escalated
                </option>

                <option value="Rejected">
                  Rejected
                </option>
              </select>
            </label>

            {/* ------------------------------------------------ */}
            {/* Assignment information                           */}
            {/* ------------------------------------------------ */}

            {reviewerStatus ===
              "Assigned" && (
              <div className="mt-3 rounded border border-line bg-canvas-subtle p-3">
                <p className="text-[12px] font-medium text-ink">
                  Agent handoff
                </p>

                <p className="mt-1 text-[12px] text-ink-muted">
                  The complaint will be assigned to
                  an active Agent in the selected
                  department.
                </p>

                <div className="mt-2 text-[12px]">
                  <span className="text-ink-muted">
                    Department:
                  </span>{" "}
                  <span className="font-medium text-ink">
                    {selected.assigned_department ??
                      department ??
                      "Unassigned"}
                  </span>
                </div>
              </div>
            )}

            {/* ------------------------------------------------ */}
            {/* Existing detailed review actions                */}
            {/* ------------------------------------------------ */}

            {reviewerStatus ===
              "Manual Review" && (
              <>
                <label className="mt-4 block text-[13px] font-medium">
                  Review action

                  <select
                    className="mt-1 w-full rounded border border-line bg-surface p-2"
                    value={action}
                    disabled={saving}
                    onChange={(e) =>
                      setAction(
                        e.target.value as ReviewerAction,
                      )
                    }
                  >
                    <option value="approve">
                      Approve
                    </option>

                    <option value="modify">
                      Modify
                    </option>

                    <option value="reclassify">
                      Reclassify
                    </option>

                    <option value="reassign">
                      Reassign
                    </option>

                    <option value="reject">
                      Reject
                    </option>

                    <option value="escalate">
                      Escalate
                    </option>

                    <option value="comment">
                      Comment
                    </option>

                    <option value="regenerate-response">
                      Regenerate response
                    </option>
                  </select>
                </label>

                {action ===
                  "modify" && (
                  <div className="mt-3 space-y-3">
                    <Textarea
                      label="Customer response (optional)"
                      value={customerResponse}
                      onChange={(e) =>
                        setCustomerResponse(
                          e.target.value,
                        )
                      }
                      rows={3}
                      hint="Replaces the AI-drafted customer response when provided."
                    />

                    <Textarea
                      label="Agent guidance (optional)"
                      value={agentGuidance}
                      onChange={(e) =>
                        setAgentGuidance(
                          e.target.value,
                        )
                      }
                      rows={3}
                      hint="Replaces the internal agent guidance when provided."
                    />
                  </div>
                )}

                {action ===
                  "reclassify" && (
                  <div className="mt-3 space-y-3">
                    <Input
                      label="Category"
                      value={category}
                      onChange={(e) =>
                        setCategory(
                          e.target.value,
                        )
                      }
                      placeholder="e.g. Payments & Billing"
                    />

                    <Input
                      label="Subcategory"
                      value={subcategory}
                      onChange={(e) =>
                        setSubcategory(
                          e.target.value,
                        )
                      }
                      placeholder="e.g. Duplicate charge"
                    />

                    <Input
                      label="Department"
                      value={department}
                      onChange={(e) =>
                        setDepartment(
                          e.target.value,
                        )
                      }
                      placeholder="e.g. Payments & Finance"
                    />

                    <p className="text-[12px] text-ink-muted">
                      The backend stores the
                      classification and re-routes
                      the complaint.
                    </p>
                  </div>
                )}

                {action ===
                  "reassign" && (
                  <div className="mt-3 space-y-3">
                    <Input
                      label="Agent ID"
                      value={agentId}
                      onChange={(e) =>
                        setAgentId(
                          e.target.value,
                        )
                      }
                      placeholder="Backend user ID of an active agent"
                    />

                    <p className="text-[12px] text-ink-muted">
                      The backend verifies that the
                      Agent is active and belongs to
                      the complaint's department.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ------------------------------------------------ */}
            {/* Reviewer / Agent handoff message                */}
            {/* ------------------------------------------------ */}

            <Textarea
              className="mt-4"
              label={
                reviewerStatus ===
                "Assigned"
                  ? "Message to agent"
                  : "Reviewer comment"
              }
              value={comment}
              onChange={(e) =>
                setComment(
                  e.target.value,
                )
              }
              rows={4}
              placeholder={
                reviewerStatus ===
                "Assigned"
                  ? "Tell the assigned agent what needs to be investigated..."
                  : "Explain the review decision..."
              }
              hint={
                reviewerStatus ===
                "Assigned"
                  ? "This becomes the review handoff context for the Agent."
                  : "The comment is stored with the review activity."
              }
            />

            {/* ------------------------------------------------ */}
            {/* Buttons                                           */}
            {/* ------------------------------------------------ */}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={saving}
                onClick={resetForm}
              >
                Cancel
              </Button>

              <Button
                disabled={
                  saving ||
                  !statusReady ||
                  (reviewerStatus ===
                    "Manual Review" &&
                    !buildPayload())
                }
                onClick={() =>
                  void submit()
                }
              >
                {saving
                  ? "Saving…"
                  : reviewerStatus ===
                      "Assigned"
                    ? "Send to Agent"
                    : reviewerStatus ===
                        "Escalated"
                      ? "Escalate"
                      : reviewerStatus ===
                          "Rejected"
                        ? "Reject"
                        : "Submit review"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}