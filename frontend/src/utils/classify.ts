import type { ComplaintStatus } from "@/types";

export function nextComplaintId(existing: string[]): string {
  const nums = existing.map((id) => {
    const m = id.match(/SN-(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  });
  const next = Math.max(100, ...nums) + 1;
  return `SN-${String(next).padStart(6, "0")}`;
}

export function workflowSteps(status: ComplaintStatus, escalated: boolean) {
  const index: Record<ComplaintStatus, number> = {
    New: 0,
    Analyzed: 1,
    Assigned: 3,
    "In Progress": 4,
    "Awaiting Customer": 4,
    Escalated: 4,
    Reopened: 4,
    Resolved: 5,
    Closed: 5,
    "Manual Review": 2,
  };
  const current = index[status] ?? 0;
  return [
    { key: "received", label: "Complaint received", done: true },
    { key: "analyzed", label: "Complaint analysis", done: current >= 1 },
    { key: "validated", label: "Ground-truth validation", done: current >= 1 },
    { key: "routed", label: "Department routing", done: current >= 3 },
    {
      key: "review",
      label: escalated ? "Escalated review" : "Support review",
      done: current >= 4,
    },
    { key: "resolution", label: "Resolution", done: current >= 5 },
  ];
}

export function customerNextStep(status: ComplaintStatus): string {
  switch (status) {
    case "New":
      return "Waiting for analysis";
    case "Analyzed":
      return "Waiting for department assignment";
    case "Assigned":
      return "Queued with the support team";
    case "In Progress":
      return "An agent is reviewing this";
    case "Awaiting Customer":
      return "A response from you is needed";
    case "Escalated":
      return "With a specialist team";
    case "Reopened":
      return "Reopened for further review";
    case "Resolved":
      return "Resolved — confirm if the issue is settled";
    case "Closed":
      return "Closed";
    default:
      return status;
  }
}
