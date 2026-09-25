import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getComplaintAnalysis } from "@/api/complaints";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Mail, Phone, UserRound } from "lucide-react";
import { AnalysisCard } from "@/components/AnalysisCard";
import { Avatar } from "@/components/Avatar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Button } from "@/components/Button";
import { EscalationPanel } from "@/components/EscalationPanel";
import { ErrorState } from "@/components/ErrorState";
import { Modal } from "@/components/Modal";
import { PolicyReference } from "@/components/PolicyReference";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ResolutionSteps } from "@/components/ResolutionSteps";
import { Select } from "@/components/Select";
import { SentimentBadge } from "@/components/SentimentBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/Textarea";
import { Timeline } from "@/components/Timeline";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { ValidationBadge, ValidationResult } from "@/components/ValidationResult";
import { WorkflowSteps } from "@/components/WorkflowSteps";
import { useAuth } from "@/auth/AuthContext";
import { useData } from "@/context/DataContext";
import { COMPLAINT_STATUSES, PRIORITIES, type ComplaintStatus, type Priority,  type Sentiment } from "@/types";
import { customerNextStep } from "@/utils/classify";
import { formatDateTime, formatRelative } from "@/utils/dates";
import { cn } from "@/utils/cn";

export function ComplaintDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, users } = useAuth();
  const { complaints, getCustomer, addComment, setStatus, setPriority, assignTo, updateComplaint} = useData();
  const complaint = complaints.find((c) => c.id === id);
  const customer = complaint ? getCustomer(complaint.customerId) : undefined;
  const assignee = users.find((u) => u.id === complaint?.assigneeId);
  const isStaff = user?.role === "Agent" || user?.role === "Admin";
  const isOwner = user?.role === "Customer" && complaint?.customerId === user.id;

  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState("");

  
  //useeffect
  useEffect(() => {
  if (!id || !complaint) return;

  const loadAnalysis = async () => {
    try {
      const analysis = await getComplaintAnalysis(id);

      console.log("Complaint analysis:", analysis);

      const backendSeverity =
        analysis.escalation.level || "Standard";

      const priorityMap: Record<string, Priority> = {
        Standard: "P3",
        Medium: "P2",
        High: "P1",
        Critical: "P0",
      };

      const urgencyMap: Record<string, "Low" | "Medium" | "High" | "Critical"> = {
        Standard: "Low",
        Medium: "Medium",
        High: "High",
        Critical: "Critical",
      };

      const priority =
        priorityMap[backendSeverity] ?? "P3";

      const urgency =
        urgencyMap[backendSeverity] ?? "Low";

      const sentimentLabel =
        analysis.sentiment.label?.toLowerCase();

      const sentiment: Sentiment =
        sentimentLabel === "positive"
          ? "Positive"
          : sentimentLabel === "negative"
            ? "Negative"
            : sentimentLabel === "strongly negative"
              ? "Strongly Negative"
              : "Neutral";

      const productService =
        analysis.entities.product ||
        complaint.productService ||
        "Unspecified";

      updateComplaint(id, {
        category: analysis.classification.category,
        subcategory: analysis.classification.subcategory,
        department: analysis.classification.department,

        productService,

        priority,
        urgency,
        sentiment,

        escalated: analysis.escalation.required,

        reference:
          analysis.entities.order_id ||
          complaint.reference,

        intelligence: {
          ...complaint.intelligence,

          summary:
            analysis.resolution.explanation || "",

          primaryIssue:
            analysis.complaint.title,

          category:
            analysis.classification.category,

          subcategory:
            analysis.classification.subcategory,

          sentiment,
          urgency,
          priority,
          productService,

          entities: [
            analysis.entities.order_id
              ? `Order: ${analysis.entities.order_id}`
              : "",
            analysis.entities.transaction_id
              ? `Transaction: ${analysis.entities.transaction_id}`
              : "",
            analysis.entities.product
              ? `Product: ${analysis.entities.product}`
              : "",
            analysis.entities.amount
              ? `Amount: ${analysis.entities.amount}`
              : "",
            analysis.entities.date
              ? `Date: ${analysis.entities.date}`
              : "",
          ].filter(Boolean),

          department:
            analysis.classification.department,

          escalation:
            analysis.escalation.required,

          reason:
            analysis.escalation.reason || "",

          recommendation:
            analysis.resolution.steps.join(" "),

          agentGuidance:
            analysis.agent_guidance
              ? [analysis.agent_guidance]
              : [],

          clarificationQuestions:
            analysis.clarification_questions || [],
        },

        customerResponse:
          analysis.customer_response || undefined,

        escalationAssessment: {
          required:
            analysis.escalation.required,

          level:
            analysis.escalation.required
              ? "Supervisor Review"
              : "No Escalation",

          reason:
            analysis.escalation.reason || "",

          validation: "Pending",
        },

        resolutionPlan: {
          steps: analysis.resolution.steps,
          requiredActions: analysis.resolution.steps,
          prohibitedActions: [],
        },

        followUp: analysis.follow_up.required
          ? {
              required: true,
              communication:
                analysis.follow_up.message,
            }
          : undefined,

        missingInfo:
          analysis.clarification_questions?.length
            ? {
                items:
                  analysis.clarification_questions,
                questions:
                  analysis.clarification_questions,
              }
            : undefined,
      });
    } catch (error) {
      console.error(
        "Failed to load complaint analysis:",
        error,
      );
    }
  };

  loadAnalysis();
}, [id]);
  //useeffect


  const related = useMemo(() => {
    if (!complaint) return [];
    return complaints.filter((c) => c.customerId === complaint.customerId && c.id !== complaint.id).slice(0, 4);
  }, [complaints, complaint]);

  if (!complaint) {
    return (
      <ErrorState
        title="Complaint not found"
        description="This ID does not match a complaint in the workspace."
        onRetry={() => navigate(user ? (user.role === "Customer" ? "/my-complaints" : "/complaints") : "/")}
      />
    );
  }

  if (user?.role === "Customer" && !isOwner) {
    return (
      <ErrorState
        title="Complaint not found"
        description="You can only view complaints you have submitted."
        onRetry={() => navigate("/my-complaints")}
      />
    );
  }

  const agents = users.filter((u) => u.role === "Agent" || u.role === "Admin");
  const backTo = !user ? "/" : user.role === "Customer" ? "/my-complaints" : "/complaints";
  const customerSafe = !isStaff;

  const onReply = (e: FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    addComment(complaint.id, reply.trim(), isStaff && internal);
    setReply("");
  };

  return (
    <div>
      <div className="mb-4">
        <Link to={backTo} className="mb-2 inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink">
          <ArrowLeft size={14} />
          {customerSafe ? "Back" : "Back to complaints"}
        </Link>
        <Breadcrumbs
          items={[
            { label: customerSafe ? "My complaints" : "Complaints", to: backTo },
            { label: complaint.id },
          ]}
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[12px] text-ink-muted">{complaint.id}</p>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-ink">{complaint.subject}</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Submitted {formatDateTime(complaint.createdAt)}
            {assignee && isStaff ? ` · Assigned to ${assignee.name}` : ""}
            {complaint.reference ? ` · ${complaint.reference}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={complaint.status} />
          <span className="inline-flex items-center rounded border border-line px-1.5 py-px text-[11px] font-medium">
            <PriorityBadge priority={complaint.priority} />
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded border px-1.5 py-px text-[11px] font-medium",
              complaint.escalated ? "border-danger-muted bg-danger-subtle text-danger" : "border-line text-ink-muted",
            )}
          >
            {complaint.escalated ? "Escalated" : "Not escalated"}
          </span>
          {isStaff && <ValidationBadge state={complaint.validation} />}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className="panel p-4">
            <h2 className="text-[13px] font-semibold text-ink">Complaint</h2>
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-secondary">{complaint.description}</p>
            <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Product / service</dt>
                <dd>{complaint.productService}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Preferred channel</dt>
                <dd>{complaint.contactChannel ?? "Portal"}</dd>
              </div>
              {complaint.previousComplaintId && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Previous complaint</dt>
                  <dd>
                    <Link to={`/complaints/${complaint.previousComplaintId}`} className="font-mono text-primary hover:underline">
                      {complaint.previousComplaintId}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
            {complaint.attachmentName && (
              <p className="mt-3 text-[12px] text-ink-muted">Attachment: {complaint.attachmentName}</p>
            )}
          </section>

          {customerSafe ? (
            <>
              <section className="panel p-4">
                <h2 className="text-[13px] font-semibold text-ink">Status</h2>
                <p className="mt-2 text-[13px] text-ink-secondary">
                  Current department: <span className="font-medium text-ink">{complaint.department}</span>
                </p>
                <p className="mt-1 text-[13px] text-ink-secondary">
                  Latest update: {complaint.latestUpdate ?? "Updated"} · {formatRelative(complaint.updatedAt)}
                </p>
                <p className="mt-1 text-[13px] text-ink-secondary">
                  Next step: <span className="font-medium text-ink">{complaint.nextAction ?? customerNextStep(complaint.status)}</span>
                </p>
                {complaint.customerResponse && (
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Latest message</p>
                    <p className="mt-1 text-[13px] text-ink-secondary">{complaint.customerResponse}</p>
                  </div>
                )}
              </section>
              {complaint.followUp?.required && (
                <section className="panel p-4">
                  <h2 className="text-[13px] font-semibold text-ink">Follow-up</h2>
                  <p className="mt-2 text-[13px] text-ink-secondary">{complaint.followUp.type}</p>
                  {complaint.followUp.communication && (
                    <p className="mt-1 text-[13px] text-ink-muted">{complaint.followUp.communication}</p>
                  )}
                </section>
              )}
            </>
          ) : (
            <>
              <section className="panel p-4">
                <h2 className="text-[13px] font-semibold text-ink">Complaint intelligence</h2>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
                  <Info label="Primary issue" value={complaint.intelligence.primaryIssue} />
                  <Info label="Category" value={complaint.category} />
                  <Info label="Subcategory" value={complaint.subcategory} />
                  <Info label="Department" value={complaint.department} />
                  <Info label="Product / service" value={complaint.productService} />
                  <Info label="Entities" value={complaint.intelligence.entities.join(", ") || "—"} />
                </dl>
                <div className="mt-3 flex flex-wrap gap-4">
                  <SentimentBadge sentiment={complaint.sentiment} />
                  <UrgencyBadge urgency={complaint.urgency} />
                  <PriorityBadge priority={complaint.priority} />
                </div>
              </section>

              <AnalysisCard intelligence={complaint.intelligence} />
              <PolicyReference policy={complaint.policy} />
              <ResolutionSteps plan={complaint.resolutionPlan} />
              <ValidationResult detail={complaint.validationDetail} />

              {complaint.missingInfo && (
                <section className="panel p-4">
                  <h2 className="text-[13px] font-semibold text-ink">Information needed</h2>
                  <ul className="mt-2 list-disc pl-4 text-[13px] text-ink-secondary">
                    {complaint.missingInfo.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Clarification questions</p>
                  <ol className="mt-1 list-decimal pl-4 text-[13px] text-ink-secondary">
                    {complaint.missingInfo.questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ol>
                </section>
              )}
            </>
          )}

          <section className="panel p-4">
            <h2 className="text-[13px] font-semibold text-ink">Next steps</h2>
            <div className="mt-3">
              <WorkflowSteps status={complaint.status} escalated={complaint.escalated} />
            </div>
          </section>

          {complaint.resolution && (
            <section className="panel p-4">
              <h2 className="text-[13px] font-semibold text-success">Resolution</h2>
              <p className="mt-2 text-[13px] text-ink-secondary">{complaint.resolution}</p>
            </section>
          )}

          <section className="panel p-4">
            <h2 className="mb-3 text-[13px] font-semibold text-ink">Activity</h2>
            <Timeline events={isStaff ? complaint.timeline : complaint.timeline.filter((e) => e.type !== "note")} />
            {user && (
              <form onSubmit={onReply} className="mt-4 border-t border-line pt-4">
                <Textarea
                  label={isStaff ? "Reply or note" : "Add more information"}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={4}
                  className="min-h-[96px]"
                  placeholder={isStaff ? "Update the customer or leave an internal note…" : "Add details or a question…"}
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  {isStaff ? (
                    <label className="flex items-center gap-2 text-[12px] text-ink-secondary">
                      <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                      Internal note (not visible to the customer)
                    </label>
                  ) : (
                    <span />
                  )}
                  <Button type="submit" size="sm" disabled={!reply.trim()}>
                    {isStaff ? "Add update" : "Send"}
                  </Button>
                </div>
              </form>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="panel p-4">
            <h2 className="mb-3 text-[13px] font-semibold text-ink">Customer</h2>
            <div className="flex items-start gap-3">
              <Avatar name={customer?.name ?? "Customer"} />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">{customer?.name ?? "Unknown"}</p>
                {customer?.company && <p className="text-[12px] text-ink-muted">{customer.company}</p>}
                {customer?.reference && <p className="font-mono text-[11px] text-ink-faint">{customer.reference}</p>}
                <p className="text-[12px] text-ink-muted">{customer?.customerType ?? complaint.customerType ?? "—"}</p>
              </div>
            </div>
            {isStaff && (
              <ul className="mt-3 space-y-1.5 text-[13px] text-ink-secondary">
                {customer?.email && (
                  <li className="flex items-center gap-2">
                    <Mail size={13} className="text-ink-faint" />
                    <span className="truncate">{customer.email}</span>
                  </li>
                )}
                {customer?.phone && (
                  <li className="flex items-center gap-2">
                    <Phone size={13} className="text-ink-faint" />
                    {customer.phone}
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <UserRound size={13} className="text-ink-faint" />
                  {customer ? `${customer.openComplaints} open` : "—"}
                </li>
              </ul>
            )}
          </section>

          {isStaff && (
            <>
              <EscalationPanel assessment={complaint.escalationAssessment} followUp={complaint.followUp} />
              <section className="panel p-4">
                <h2 className="mb-3 text-[13px] font-semibold text-ink">Properties</h2>
                <dl className="space-y-2 text-[13px]">
                  <Row label="Department" value={complaint.department} icon={<Building2 size={13} />} />
                  <Row label="Updated" value={formatRelative(complaint.updatedAt)} />
                  <Row label="Assignee" value={assignee?.name ?? "Unassigned"} />
                  {complaint.slaRisk && <Row label="SLA" value="At risk" />}
                </dl>
                <div className="mt-4 space-y-3 border-t border-line pt-3">
                  <Select
                    label="Status"
                    value={complaint.status}
                    options={COMPLAINT_STATUSES.map((s) => ({ value: s, label: s }))}
                    onChange={(e) => {
                      const next = e.target.value as ComplaintStatus;
                      if (next === "Resolved" || next === "Closed") {
                        setResolveOpen(true);
                        return;
                      }
                      setStatus(complaint.id, next);
                    }}
                  />
                  <Select
                    label="Priority"
                    value={complaint.priority}
                    options={PRIORITIES.map((s) => ({ value: s, label: s }))}
                    onChange={(e) => setPriority(complaint.id, e.target.value as Priority)}
                  />
                  <Select
                    label="Assignee"
                    value={complaint.assigneeId ?? ""}
                    placeholder="Unassigned"
                    options={agents.map((a) => ({ value: a.id, label: a.name }))}
                    onChange={(e) => {
                      const a = agents.find((x) => x.id === e.target.value);
                      if (a) assignTo(complaint.id, a.id, a.name);
                    }}
                  />
                  {!complaint.escalated && (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setStatus(complaint.id, "Escalated")}>
                      Escalate
                    </Button>
                  )}
                  {complaint.status !== "Resolved" && complaint.status !== "Closed" && (
                    <Button variant="secondary" size="sm" className="w-full" onClick={() => setResolveOpen(true)}>
                      Resolve
                    </Button>
                  )}
                </div>
              </section>
            </>
          )}

          {related.length > 0 && (
            <section className="panel p-4">
              <h2 className="mb-2 text-[13px] font-semibold text-ink">Other complaints from this customer</h2>
              <ul className="space-y-2">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link to={`/complaints/${r.id}`} className="block text-[13px] hover:text-primary">
                      <span className="font-mono text-[11px] text-ink-muted">{r.id}</span>
                      <span className="mt-0.5 block truncate text-ink">{r.subject}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      <Modal
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
        title="Resolve complaint"
        footer={
          <>
            <Button variant="outline" onClick={() => setResolveOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={resolution.trim().length < 8}
              onClick={() => {
                setStatus(complaint.id, "Resolved", resolution.trim());
                setResolveOpen(false);
                setResolution("");
              }}
            >
              Mark resolved
            </Button>
          </>
        }
      >
        <Textarea
          label="Resolution notes"
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          hint="Visible on the complaint. Describe what was done."
          rows={5}
        />
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="flex items-center gap-1.5 text-right font-medium text-ink">
        {icon}
        {value}
      </dd>
    </div>
  );
}
