export type Role =
  | "Customer"
  | "Agent"
  | "Reviewer"
  | "Manager"
  | "Admin";

export type UserStatus = "Active" | "Inactive";

export type ComplaintStatus =
  | "New"
  | "Analyzed"
  | "Assigned"
  | "In Progress"
  | "Awaiting Customer"
  | "Escalated"
  | "Resolved"
  | "Closed"
  | "Reopened"
  | "Manual Review";

export type Priority = "P0" | "P1" | "P2" | "P3";

export type Urgency = "Low" | "Medium" | "High" | "Critical";

export type Sentiment = "Positive" | "Neutral" | "Negative" | "Strongly Negative";

export type ValidationState = "Match" | "Mismatch" | "Pending" | "Manual Review Required";

export type EscalationLevel =
  | "No Escalation"
  | "Supervisor Review"
  | "Department Manager"
  | "Specialist Team"
  | "Compliance Review"
  | "Critical Management Escalation";

export type FollowUpType =
  | "Additional information request"
  | "Resolution confirmation"
  | "Refund-status update"
  | "Replacement-status update"
  | "Escalation acknowledgement"
  | "Closure confirmation";

export type TimelineType =
  | "submitted"
  | "preprocessed"
  | "analyzed"
  | "validated"
  | "routed"
  | "assigned"
  | "status"
  | "comment"
  | "note"
  | "escalated"
  | "review"
  | "resolved"
  | "closed";

export type DocumentStatus = "Active" | "Previous" | "Superseded" | "Draft";

export const PRIORITY_LABEL: Record<Priority, string> = {
  P0: "P0 – Critical",
  P1: "P1 – High",
  P2: "P2 – Medium",
  P3: "P3 – Low",
};

export const COMPLAINT_STATUSES: ComplaintStatus[] = [
  "New",
  "Analyzed",
  "Assigned",
  "In Progress",
  "Awaiting Customer",
  "Escalated",
  "Resolved",
  "Closed",
  "Reopened",
  "Manual Review",
];

export const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];
export const URGENCIES: Urgency[] = ["Low", "Medium", "High", "Critical"];
export const SENTIMENTS: Sentiment[] = ["Positive", "Neutral", "Negative", "Strongly Negative"];

export const OPEN_STATUSES: ComplaintStatus[] = [
  "New",
  "Analyzed",
  "Assigned",
  "In Progress",
  "Awaiting Customer",
  "Escalated",
  "Reopened",
  "Manual Review",
];

/**
 * The signed-in account, as returned by GET /api/auth/me.
 *
 * Optional fields are optional because the API does not always
 * store them — they are reported as unavailable, never defaulted.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status?: UserStatus;
  createdAt?: string;
  department?: string;
  phone?: string;
}

/**
 * A customer as shown next to a complaint.
 *
 * `joinedAt` and `openComplaints` are only known when the viewer
 * is the customer themselves; the complaint detail endpoint
 * returns identity fields only, so they are optional and rendered
 * as unavailable rather than as zero.
 */
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  reference?: string;
  customerType?: string;
  joinedAt?: string;
  openComplaints?: number;
}

export interface FieldValidation {
  field: string;
  genai: string;
  python: string;
  result: "Match" | "Mismatch";
}

export interface GroundTruthValidation {
  overall: ValidationState | null;
  fields: FieldValidation[];
  policyValidated: boolean;
  resolutionValidated: boolean;
  reviewReason?: string;
}

export interface PolicyRef {
  id: string;
  title: string;
  section: string;
  version: string;
  status: DocumentStatus;
  applicability: string;
  source?: string;
}

export interface EscalationAssessment {
  required: boolean;
  level: EscalationLevel | null;
  reason: string;
  validation: ValidationState | null;
  notes?: string;
}

export interface FollowUp {
  required: boolean;
  type?: FollowUpType;
  scheduledDate?: string;
  communication?: string;
}

export interface ResolutionPlan {
  steps: string[];
  requiredActions: string[];
  prohibitedActions: string[];
  refundEligible?: boolean;
  replacementEligible?: boolean;
}

export interface MissingInfo {
  items: string[];
  questions: string[];
}

export interface Intelligence {
  summary: string;
  primaryIssue: string;
  secondaryIssues: string[];
  category: string | null;
  subcategory: string | null;
  sentiment: Sentiment | null;
  urgency: Urgency | null;
  priority: Priority | null;
  productService: string | null;
  entities: string[];
  department: string | null;
  supportingDepartment?: string;
  escalation: boolean;
  reason: string;
  recommendation: string;
  agentGuidance: string[];
  clarificationQuestions: string[];
  generatedResponse?: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: TimelineType;
  title: string;
  description?: string;
  actor: string;
  actorRole: Role | "System";
}

/**
 * A complaint as the frontend knows it.
 *
 * Fields that the backend does not always produce are nullable on
 * purpose. `null` means "the backend has no value for this" and the
 * UI must render an honest placeholder — it must never be replaced
 * with a default such as "Neutral", "P3" or "Unassigned", because
 * that would present an invented value as if it were analysis
 * output.
 */
export interface Complaint {
  id: string;
  subject: string;
  description: string;
  customerId: string;
  /** From the stored analysis document. `null` when not analyzed. */
  category: string | null;
  subcategory: string | null;
  /** Persisted `assigned_department`. `null` until routing runs. */
  department: string | null;
  productService: string | null;
  /** Rule-engine priority, persisted on the complaint. */
  priority: Priority | null;
  urgency: Urgency | null;
  sentiment: Sentiment | null;
  status: ComplaintStatus;
  escalated: boolean;
  validation: ValidationState | null;
  assigneeId?: string;
  createdAt: string;
  updatedAt: string;
  reference?: string;
  contactChannel?: string;
  customerType?: string;
  previousComplaintId?: string;
  attachmentName?: string;
  /** Full analysis payload. Only loaded on the detail page. */
  intelligence: Intelligence | null;
  policy?: PolicyRef;
  validationDetail: GroundTruthValidation | null;
  escalationAssessment: EscalationAssessment | null;
  resolutionPlan?: ResolutionPlan;
  followUp?: FollowUp;
  missingInfo?: MissingInfo;
  customerResponse?: string;
  latestUpdate?: string;
  nextAction?: string;
  resolution?: string;
  slaRisk?: boolean;
  duplicateOf?: string;
  reviewReasons?: string[];
  timeline: TimelineEvent[];
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string[];
  updatedAt: string;
  relatedIds: string[];
  policyId?: string;
  version?: string;
  effectiveDate?: string;
}

export interface RoutingRule {
  id: string;
  category: string;
  subcategory: string;
  condition: string;
  department: string;
  urgency: Urgency;
  priority: Priority;
  policy: string;
  escalation: string;
  requiredActions: string;
  prohibitedActions: string;
  followUp: string;
  status: "Active" | "Disabled";
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  href: string;
}

export interface ComplaintDraft {
  subject: string;
  description: string;
  productService?: string;
  reference?: string;
  customerType?: string;
  previousComplaintId?: string;
  contactChannel?: string;
  attachmentName?: string;
  customerName?: string;
  customerEmail?: string;
}

export interface PolicyDocument {
  id: string;
  title: string;
  category: string;
  version: string;
  effectiveDate: string;
  expiryDate?: string;
  status: DocumentStatus;
  uploadedAt: string;
  format: "PDF" | "DOCX";
}
