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

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  lastActive: string;
  createdAt: string;
  department?: string;
  phone?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  reference?: string;
  customerType?: string;
  joinedAt: string;
  openComplaints: number;
}

export interface FieldValidation {
  field: string;
  genai: string;
  python: string;
  result: "Match" | "Mismatch";
}

export interface GroundTruthValidation {
  overall: ValidationState;
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
  level: EscalationLevel;
  reason: string;
  validation: ValidationState;
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
  category: string;
  subcategory: string;
  sentiment: Sentiment;
  urgency: Urgency;
  priority: Priority;
  productService: string;
  entities: string[];
  department: string;
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

export interface Complaint {
  id: string;
  subject: string;
  description: string;
  customerId: string;
  category: string;
  subcategory: string;
  department: string;
  productService: string;
  priority: Priority;
  urgency: Urgency;
  sentiment: Sentiment;
  status: ComplaintStatus;
  escalated: boolean;
  validation: ValidationState;
  assigneeId?: string;
  createdAt: string;
  updatedAt: string;
  reference?: string;
  contactChannel?: string;
  customerType?: string;
  previousComplaintId?: string;
  attachmentName?: string;
  intelligence: Intelligence;
  policy?: PolicyRef;
  validationDetail: GroundTruthValidation;
  escalationAssessment: EscalationAssessment;
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

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  result: "Success" | "Failed";
  details: string;
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

export interface ReportDefinition {
  id: string;
  title: string;
  category: string;
  description: string;
}
