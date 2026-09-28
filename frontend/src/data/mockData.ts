/**
 * STATIC EDITORIAL / MARKETING CONTENT (NOT OPERATIONAL DATA).
 *
 * No operational records live here. The authenticated application
 * reads complaints, users, departments, audit logs, analytics and
 * knowledge-base documents from the API only — none of those screens
 * import this file.
 *
 * What remains here:
 *   exampleComplaints / exampleCustomers  illustrative records used
 *                                         ONLY by the public
 *                                         landing-page product
 *                                         previews (marketing/*).
 *   complexExample / hardCases            landing-page copy.
 *   articles / kbCategories               help-centre EDITORIAL
 *                                         content. NOTE: the Help
 *                                         Center (/help-center) is
 *                                         reachable from both the
 *                                         public header and the
 *                                         signed-in sidebar, so this
 *                                         static editorial content is
 *                                         rendered inside the product.
 *                                         It has no backend API yet;
 *                                         it is fixed documentation
 *                                         text, not fabricated
 *                                         operational data.
 *
 * Removed deliberately: demo staff accounts, mock routing rules,
 * mock policy documents and mock notifications. Those screens are
 * wired to the backend or show an honest empty state instead.
 */

import type {
  Complaint,
  ComplaintStatus,
  Customer,
  EscalationAssessment,
  EscalationLevel,
  FollowUp,
  GroundTruthValidation,
  Intelligence,
  KnowledgeArticle,
  PolicyRef,
  Priority,
  ResolutionPlan,
  TimelineEvent,
  ValidationState,
} from "@/types";
import { daysAgo, hoursAgo } from "@/utils/dates";

export const exampleCustomers: Customer[] = [
  { id: "c-ayesha", name: "Ayesha Khan", email: "ayesha.khan@example.com", phone: "+44 7700 900124", company: "Northbridge Clinic", reference: "CUS-10421", customerType: "Business", joinedAt: daysAgo(64, 13, 20), openComplaints: 2 },
  { id: "c-marcus", name: "Marcus Chen", email: "marcus.chen@example.com", phone: "+44 7700 900331", company: "Helio Analytics", reference: "CUS-09811", customerType: "Business", joinedAt: daysAgo(120, 10, 0), openComplaints: 1 },
  { id: "c-priya", name: "Priya Sharma", email: "priya.sharma@example.com", phone: "+44 7700 900882", reference: "CUS-11204", customerType: "Consumer", joinedAt: daysAgo(28, 9, 0), openComplaints: 1 },
  { id: "c-james", name: "James Okafor", email: "james.okafor@example.com", reference: "CUS-08770", customerType: "Consumer", joinedAt: daysAgo(200, 11, 0), openComplaints: 1 },
  { id: "c-elena", name: "Elena Rossi", email: "elena.rossi@example.com", phone: "+39 347 0100 229", company: "Rossi Atelier", reference: "CUS-12119", customerType: "Business", joinedAt: daysAgo(40, 15, 0), openComplaints: 1 },
  { id: "c-daniel", name: "Daniel Park", email: "daniel.park@example.com", reference: "CUS-07442", customerType: "Consumer", joinedAt: daysAgo(310, 12, 0), openComplaints: 1 },
  { id: "c-fatima", name: "Fatima Al-Hassan", email: "fatima.alhassan@example.com", company: "Sahara Goods Ltd", reference: "CUS-10102", customerType: "Business", joinedAt: daysAgo(88, 8, 30), openComplaints: 1 },
  { id: "c-thomas", name: "Thomas Wright", email: "thomas.wright@example.com", reference: "CUS-06618", customerType: "Consumer", joinedAt: daysAgo(400, 10, 0), openComplaints: 1 },
  { id: "c-sofia", name: "Sofia Mendes", email: "sofia.mendes@example.com", reference: "CUS-09014", customerType: "Consumer", joinedAt: daysAgo(150, 16, 0), openComplaints: 0 },
  { id: "c-raj", name: "Raj Patel", email: "raj.patel@example.com", company: "Patel Grocery Group", reference: "CUS-11580", customerType: "Business", joinedAt: daysAgo(22, 11, 0), openComplaints: 1 },
  { id: "c-hannah", name: "Hannah Berg", email: "hannah.berg@example.com", reference: "CUS-08331", customerType: "Consumer", joinedAt: daysAgo(175, 9, 0), openComplaints: 1 },
  { id: "c-omar", name: "Omar Farouk", email: "omar.farouk@example.com", reference: "CUS-10944", customerType: "Consumer", joinedAt: daysAgo(55, 14, 0), openComplaints: 1 },
  { id: "c-lila", name: "Lila Nguyen", email: "lila.nguyen@example.com", reference: "CUS-05117", customerType: "Consumer", joinedAt: daysAgo(500, 10, 0), openComplaints: 0 },
  { id: "c-chris", name: "Christopher Walsh", email: "chris.walsh@example.com", reference: "CUS-07721", customerType: "Consumer", joinedAt: daysAgo(260, 13, 0), openComplaints: 0 },
  { id: "c-mei", name: "Mei Tanaka", email: "mei.tanaka@example.com", company: "Tanaka Imports", reference: "CUS-11802", customerType: "Business", joinedAt: daysAgo(18, 9, 40), openComplaints: 1 },
  { id: "c-nathan", name: "Nathan Cole", email: "nathan.cole@example.com", reference: "CUS-09408", customerType: "Consumer", joinedAt: daysAgo(70, 12, 0), openComplaints: 1 },
  { id: "c-ingrid", name: "Ingrid Solberg", email: "ingrid.solberg@example.com", reference: "CUS-06190", customerType: "Consumer", joinedAt: daysAgo(340, 11, 0), openComplaints: 0 },
  { id: "c-yusuf", name: "Yusuf Ibrahim", email: "yusuf.ibrahim@example.com", reference: "CUS-10277", customerType: "Consumer", joinedAt: daysAgo(45, 8, 0), openComplaints: 1 },
  { id: "c-clara", name: "Clara Dubois", email: "clara.dubois@example.com", company: "Maison Dubois", reference: "CUS-12001", customerType: "Business", joinedAt: daysAgo(9, 15, 0), openComplaints: 1 },
  { id: "c-ben", name: "Ben Adler", email: "ben.adler@example.com", company: "Adler & Co", reference: "CUS-08844", customerType: "Business", joinedAt: daysAgo(190, 10, 0), openComplaints: 1 },
  { id: "c-nadia", name: "Nadia Rahman", email: "nadia.rahman@example.com", reference: "CUS-10730", customerType: "Consumer", joinedAt: daysAgo(33, 17, 0), openComplaints: 1 },
  { id: "c-peter", name: "Peter Novak", email: "peter.novak@example.com", reference: "CUS-07912", customerType: "Consumer", joinedAt: daysAgo(240, 12, 0), openComplaints: 0 },
  { id: "c-amira", name: "Amira Hassan", email: "amira.hassan@example.com", reference: "CUS-11455", customerType: "Consumer", joinedAt: daysAgo(14, 10, 20), openComplaints: 1 },
  { id: "c-lucas", name: "Lucas Ferreira", email: "lucas.ferreira@example.com", reference: "CUS-09660", customerType: "Consumer", joinedAt: daysAgo(80, 9, 0), openComplaints: 1 },
  { id: "c-grace", name: "Grace Okonkwo", email: "grace.okonkwo@example.com", reference: "CUS-10388", customerType: "Consumer", joinedAt: daysAgo(50, 11, 0), openComplaints: 1 },
  { id: "c-ethan", name: "Ethan Brooks", email: "ethan.brooks@example.com", reference: "CUS-11029", customerType: "Consumer", joinedAt: daysAgo(26, 16, 0), openComplaints: 1 },
];

function ev(id: string, timestamp: string, type: TimelineEvent["type"], title: string, actor: string, actorRole: TimelineEvent["actorRole"], description?: string): TimelineEvent {
  return { id, timestamp, type, title, actor, actorRole, description };
}

function matched(fields: Record<string, string>, extras?: Partial<GroundTruthValidation>): GroundTruthValidation {
  return {
    overall: "Match",
    fields: Object.entries(fields).map(([field, value]) => ({ field, genai: value, python: value, result: "Match" as const })),
    policyValidated: true,
    resolutionValidated: true,
    ...extras,
  };
}

function mismatched(
  fields: Record<string, string>,
  mismatch: { field: string; genai: string; python: string },
  reason: string,
): GroundTruthValidation {
  return {
    overall: "Mismatch",
    fields: [
      ...Object.entries(fields)
        .filter(([field]) => field !== mismatch.field)
        .map(([field, value]) => ({ field, genai: value, python: value, result: "Match" as const })),
      { field: mismatch.field, genai: mismatch.genai, python: mismatch.python, result: "Mismatch" },
    ],
    policyValidated: false,
    resolutionValidated: false,
    reviewReason: reason,
  };
}

function pendingValidation(): GroundTruthValidation {
  return { overall: "Pending", fields: [], policyValidated: false, resolutionValidated: false };
}

interface BuildInput {
  latestUpdate?: string;
  nextAction?: string;
  id: string;
  subject: string;
  description: string;
  customerId: string;
  status: ComplaintStatus;
  createdAt: string;
  updatedAt: string;
  assigneeId?: string;
  reference?: string;
  contactChannel?: string;
  customerType?: string;
  previousComplaintId?: string;
  attachmentName?: string;
  resolution?: string;
  customerResponse?: string;
  slaRisk?: boolean;
  duplicateOf?: string;
  reviewReasons?: string[];
  missingInfo?: Complaint["missingInfo"];
  productService: string;
  intel: Omit<Intelligence, "sentiment" | "urgency" | "priority" | "secondaryIssues" | "entities" | "agentGuidance" | "clarificationQuestions" | "escalation"> &
    Partial<Pick<Intelligence, "sentiment" | "urgency" | "priority" | "secondaryIssues" | "entities" | "agentGuidance" | "clarificationQuestions" | "escalation" | "generatedResponse" | "supportingDepartment">>;
  policy?: PolicyRef;
  validation?: GroundTruthValidation;
  escalationLevel?: EscalationLevel;
  escalationNotes?: string;
  escalationValidation?: ValidationState;
  plan?: ResolutionPlan;
  followUp?: FollowUp;
  timeline: TimelineEvent[];
}

function build(input: BuildInput): Complaint {
  const intelligence: Intelligence = {
    secondaryIssues: [],
    entities: [],
    agentGuidance: [],
    clarificationQuestions: [],
    sentiment: "Negative",
    urgency: "Medium",
    priority: "P2",
    escalation: false,
    ...input.intel,
  };
  const required = intelligence.escalation;
  const level = input.escalationLevel ?? (required ? "Specialist Team" : "No Escalation");
  const assessment: EscalationAssessment = {
    required,
    level,
    reason: intelligence.reason,
    validation: input.escalationValidation ?? (input.validation?.overall === "Mismatch" ? "Manual Review Required" : "Match"),
    notes: input.escalationNotes,
  };
  const validation = input.validation ?? matched({
    Category: intelligence.category ?? "",
    Department: intelligence.department ?? "",
    Urgency: intelligence.urgency ?? "",
    Escalation: required ? "Required" : "Not required",
  });
  return {
    id: input.id,
    subject: input.subject,
    description: input.description,
    customerId: input.customerId,
    category: intelligence.category,
    subcategory: intelligence.subcategory,
    department: intelligence.department,
    productService: input.productService,
    priority: intelligence.priority,
    urgency: intelligence.urgency,
    sentiment: intelligence.sentiment,
    status: input.status,
    escalated: required || input.status === "Escalated",
    validation: validation.overall === "Mismatch" ? "Manual Review Required" : validation.overall,
    assigneeId: input.assigneeId,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    reference: input.reference,
    contactChannel: input.contactChannel ?? "Portal",
    customerType: input.customerType,
    previousComplaintId: input.previousComplaintId,
    attachmentName: input.attachmentName,
    intelligence,
    policy: input.policy,
    validationDetail: validation,
    escalationAssessment: assessment,
    resolutionPlan: input.plan,
    followUp: input.followUp,
    missingInfo: input.missingInfo,
    customerResponse: input.customerResponse,
    resolution: input.resolution,
    slaRisk: input.slaRisk,
    latestUpdate: input.latestUpdate,
    nextAction: input.nextAction,
    duplicateOf: input.duplicateOf,
    reviewReasons: input.reviewReasons,
    timeline: input.timeline,
  };
}

const retPol: PolicyRef = { id: "RET-POL-02", title: "Returns and Replacement Policy", section: "4.1 Damaged goods", version: "3.0", status: "Active", applicability: "Applicable — physical damage on delivery", source: "Help Center / Returns" };
const delPol: PolicyRef = { id: "DEL-POL-04", title: "Delivery Resolution Policy", section: "5.2 Failed delivery", version: "2.1", status: "Active", applicability: "Applicable — delivered scan disputed", source: "Help Center / Delivery" };
const billPol: PolicyRef = { id: "BIL-POL-01", title: "Billing Correction Policy", section: "2.4 Duplicate capture", version: "1.8", status: "Active", applicability: "Applicable — payment dispute", source: "Help Center / Payments" };
const secPol: PolicyRef = { id: "SEC-POL-03", title: "Account Security Incident Policy", section: "1.2 Suspected takeover", version: "4.0", status: "Active", applicability: "Applicable — unrecognised access", source: "Help Center / Security" };
const privPol: PolicyRef = { id: "PRI-POL-01", title: "Data Subject Request Policy", section: "3.1 Access requests", version: "2.0", status: "Active", applicability: "Applicable — export request", source: "Help Center / Privacy" };

export const exampleComplaints: Complaint[] = [
  build({
    id: "SN-000124",
    subject: "Damaged parcel",
    description: "My order arrived damaged and I want a replacement. The outer carton was crushed on one corner and the ceramic bowl inside is cracked. Order was delivered this morning. I have photos of the packaging and the item if you need them.",
    customerId: "c-ayesha",
    status: "In Progress",
    assigneeId: "u-nora",
    createdAt: hoursAgo(5.1),
    updatedAt: hoursAgo(0.7),
    reference: "ORD-88421",
    customerType: "Business",
    attachmentName: "parcel-damage.jpg",
    productService: "Tableware — ceramic bowl",
    slaRisk: false,
    latestUpdate: "Support team is reviewing replacement eligibility.",
    nextAction: "Verify replacement eligibility",
    intel: {
      summary: "Delivered order ORD-88421 arrived with a crushed carton and a cracked ceramic bowl. Customer requests a replacement.",
      primaryIssue: "Damaged parcel",
      secondaryIssues: ["Packaging failure"],
      category: "Product Quality",
      subcategory: "Damaged parcel",
      department: "Returns",
      productService: "Tableware — ceramic bowl",
      sentiment: "Negative",
      urgency: "High",
      priority: "P1",
      entities: ["ORD-88421", "ceramic bowl", "cracked", "replacement"],
      reason: "The complaint describes physical damage to a delivered order and requests a replacement.",
      recommendation: "Verify the order, review the photos, and ship a replacement under RET-POL-02 if eligibility is met.",
      agentGuidance: ["Do not ask the customer to return a shattered ceramic item unless policy requires evidence retention.", "Offer replacement before refund unless stock is unavailable."],
      generatedResponse: "We are sorry your ceramic bowl arrived damaged. Returns is reviewing order ORD-88421 and will confirm a replacement once the photos are checked.",
    },
    policy: retPol,
    plan: {
      steps: ["Verify order ORD-88421 and delivery confirmation", "Review delivery evidence provided by the customer", "Determine replacement eligibility under RET-POL-02", "Arrange a replacement shipment", "Send the customer an update with tracking"],
      requiredActions: ["Confirm SKU and stock", "Apply approved replacement"],
      prohibitedActions: ["Promise same-day delivery unless already in policy", "Ask the customer to pay return postage for a damaged inbound item"],
      replacementEligible: true,
      refundEligible: true,
    },
    followUp: { required: true, type: "Replacement-status update", scheduledDate: hoursAgo(-18), communication: "Send tracking once the replacement is labelled." },
    timeline: [
      ev("t1", hoursAgo(5.1), "submitted", "Complaint submitted", "Ayesha Khan", "Customer", "Submitted via the customer portal."),
      ev("t2", hoursAgo(5.08), "preprocessed", "Complaint pre-processing completed", "System", "System"),
      ev("t3", hoursAgo(5.07), "analyzed", "Complaint analysis completed", "System", "System", "Primary issue: Damaged parcel"),
      ev("t4", hoursAgo(5.06), "validated", "Python validation completed", "System", "System", "Category, department, urgency and escalation matched."),
      ev("t5", hoursAgo(5.05), "routed", "Routed to Returns", "System", "System", "Policy RET-POL-02 applied."),
      ev("t6", hoursAgo(4.6), "assigned", "Assigned to Nora Hayes", "Marcus Adeyemi", "Admin"),
      ev("t7", hoursAgo(1.2), "status", "Status changed to In Progress", "Nora Hayes", "Agent"),
      ev("t8", hoursAgo(0.7), "comment", "Requested confirmation of inner packaging", "Nora Hayes", "Agent"),
    ],
  }),
  build({
    id: "SN-000125",
    subject: "Duplicate charge on invoice",
    description: "I was charged twice for invoice INV-20331. The first payment went through on Monday and an identical capture appeared yesterday. Please reverse the duplicate and send a corrected statement.",
    customerId: "c-marcus",
    status: "Awaiting Customer",
    assigneeId: "u-priya",
    createdAt: daysAgo(1, 9, 18),
    updatedAt: hoursAgo(3),
    reference: "INV-20331",
    customerType: "Business",
    productService: "Subscription invoice",
    intel: {
      summary: "Two captured payments against invoice INV-20331. Customer wants the later capture reversed.",
      primaryIssue: "Duplicate charge",
      category: "Billing",
      subcategory: "Payment dispute",
      department: "Billing",
      productService: "Subscription invoice",
      sentiment: "Negative",
      urgency: "High",
      priority: "P1",
      entities: ["INV-20331", "duplicate capture"],
      reason: "A billing dispute over a suspected duplicate payment capture.",
      recommendation: "Confirm both processor IDs. Refund the later capture if it is a true duplicate.",
      agentGuidance: ["Do not refund an authorisation hold.", "Send a corrected statement after the reversal."],
    },
    policy: billPol,
    followUp: { required: true, type: "Refund-status update", scheduledDate: hoursAgo(-8), communication: "Waiting on the customer to confirm the last four digits of the card." },
    timeline: [
      ev("t1", daysAgo(1, 9, 18), "submitted", "Complaint submitted", "Marcus Chen", "Customer"),
      ev("t2", daysAgo(1, 9, 19), "analyzed", "Complaint analysis completed", "System", "System"),
      ev("t3", daysAgo(1, 9, 20), "validated", "Python validation completed", "System", "System"),
      ev("t4", daysAgo(1, 9, 21), "routed", "Routed to Billing", "System", "System"),
      ev("t5", daysAgo(1, 11, 4), "assigned", "Assigned to Priya Nair", "Marcus Adeyemi", "Admin"),
      ev("t6", hoursAgo(3), "status", "Awaiting customer confirmation", "Priya Nair", "Agent"),
    ],
  }),
  build({
    id: "SN-000126",
    subject: "Package not delivered",
    description: "Tracking shows delivered yesterday at 18:14 but nothing was left at the property. No card, no photo. Neighbours did not receive it either. Order ORD-89002.",
    customerId: "c-priya",
    status: "Assigned",
    assigneeId: "u-david",
    createdAt: hoursAgo(20),
    updatedAt: hoursAgo(4),
    reference: "ORD-89002",
    productService: "Parcel delivery",
    slaRisk: true,
    intel: {
      summary: "Delivered scan on ORD-89002 with no goods received and no proof of delivery photo.",
      primaryIssue: "Failed delivery",
      category: "Delivery",
      subcategory: "Failed delivery",
      department: "Delivery Operations",
      productService: "Parcel delivery",
      sentiment: "Negative",
      urgency: "High",
      priority: "P1",
      entities: ["ORD-89002", "delivered scan", "18:14"],
      reason: "A delivered scan is disputed with no proof of receipt.",
      recommendation: "Request POD and GPS. Open a tracer. Replace if unfound.",
    },
    policy: delPol,
    timeline: [
      ev("t1", hoursAgo(20), "submitted", "Complaint submitted", "Priya Sharma", "Customer"),
      ev("t2", hoursAgo(19.9), "analyzed", "Complaint analysis completed", "System", "System"),
      ev("t3", hoursAgo(19.8), "validated", "Python validation completed", "System", "System"),
      ev("t4", hoursAgo(19.7), "routed", "Routed to Delivery Operations", "System", "System"),
      ev("t5", hoursAgo(12), "assigned", "Assigned to David Okonkwo", "Marcus Adeyemi", "Admin"),
      ev("t6", hoursAgo(4), "comment", "Carrier tracer TR-44109 opened", "David Okonkwo", "Agent"),
    ],
  }),
  build({
    id: "SN-000127",
    subject: "Cannot reset password",
    description: "The reset email never arrives. I have checked spam and waited overnight. I need access today to download invoices for month-end.",
    customerId: "c-james",
    status: "New",
    createdAt: hoursAgo(1.4),
    updatedAt: hoursAgo(1.4),
    productService: "Customer portal",
    intel: {
      summary: "Password-reset mail is not arriving. Customer needs portal access for invoicing.",
      primaryIssue: "Login issue",
      category: "Account Access",
      subcategory: "Login issue",
      department: "Technical Support",
      productService: "Customer portal",
      sentiment: "Negative",
      urgency: "Medium",
      priority: "P2",
      entities: ["password reset", "email"],
      reason: "Authentication delivery failure reported; analysis is still pending pipeline completion in this record.",
      recommendation: "Verify identity, inspect mail logs, issue a manual reset.",
    },
    validation: pendingValidation(),
    missingInfo: { items: ["Registered email confirmation", "Last order number"], questions: ["Which email is on the account?", "What is a recent order or invoice number we can use to verify you?"] },
    timeline: [
      ev("t1", hoursAgo(1.4), "submitted", "Complaint submitted", "James Okafor", "Customer"),
      ev("t2", hoursAgo(1.38), "preprocessed", "Complaint pre-processing completed", "System", "System", "Queued for analysis."),
    ],
  }),
  build({
    id: "SN-000128",
    subject: "Unauthorised login attempts",
    description: "I received four login alerts from São Paulo last night. I was in Milan. I did not recognise the device. Please secure the account.",
    customerId: "c-elena",
    status: "Escalated",
    assigneeId: "u-samir",
    createdAt: hoursAgo(11),
    updatedAt: hoursAgo(0.5),
    customerType: "Business",
    productService: "Customer account",
    slaRisk: true,
    intel: {
      summary: "Unrecognised logins from São Paulo while the customer was in Milan. Possible account takeover.",
      primaryIssue: "Account takeover",
      category: "Account Access",
      subcategory: "Account takeover",
      department: "Account Security",
      productService: "Customer account",
      sentiment: "Strongly Negative",
      urgency: "Critical",
      priority: "P0",
      escalation: true,
      entities: ["São Paulo", "Milan", "login alerts"],
      reason: "Unauthorised access from an unrecognised location and device.",
      recommendation: "Lock the account, revoke sessions, verify identity, reset credentials.",
      agentGuidance: ["Do not discuss recovery codes on an unverified channel."],
      generatedResponse: "We have locked the account and revoked open sessions. Please complete the identity check we sent so we can restore access safely.",
    },
    policy: secPol,
    escalationLevel: "Specialist Team",
    escalationNotes: "Sessions revoked. Identity check outstanding.",
    followUp: { required: true, type: "Escalation acknowledgement", communication: "Identity verification questions sent." },
    timeline: [
      ev("t1", hoursAgo(11), "submitted", "Complaint submitted", "Elena Rossi", "Customer"),
      ev("t2", hoursAgo(10.98), "analyzed", "Complaint analysis completed", "System", "System"),
      ev("t3", hoursAgo(10.97), "validated", "Python validation completed", "System", "System", "Escalation required — matched."),
      ev("t4", hoursAgo(10.96), "escalated", "Escalated to Account Security", "System", "System"),
      ev("t5", hoursAgo(10.5), "assigned", "Assigned to Samir Volkov", "Marcus Adeyemi", "Admin"),
      ev("t6", hoursAgo(9), "note", "Sessions revoked", "Samir Volkov", "Agent"),
      ev("t7", hoursAgo(0.5), "comment", "Awaiting identity check", "Samir Volkov", "Agent"),
    ],
  }),
  build({
    id: "SN-000131",
    subject: "App crashes on checkout",
    description: "On iPhone 14, iOS 18.3, the app closes when I tap Pay. Happened four times this morning. I can check out on the website.",
    customerId: "c-thomas",
    status: "Assigned",
    assigneeId: "u-jordan",
    createdAt: hoursAgo(8),
    updatedAt: hoursAgo(2.2),
    productService: "iOS app checkout",
    reviewReasons: ["GenAI/Python disagreement"],
    intel: {
      summary: "Reproducible iOS crash at payment confirmation. Web checkout still works.",
      primaryIssue: "Application error",
      category: "Technical Issue",
      subcategory: "Application error",
      department: "Technical Support",
      productService: "iOS app checkout",
      sentiment: "Negative",
      urgency: "Medium",
      priority: "P2",
      entities: ["iPhone 14", "iOS 18.3", "Pay"],
      reason: "Software defect at checkout. Department routing disagrees between pipelines.",
      recommendation: "Collect app version and crash logs. Offer web checkout as a workaround.",
    },
    validation: mismatched(
      { Category: "Technical Issue", Urgency: "Medium", Escalation: "Not required" },
      { field: "Department", genai: "Technical Support", python: "Product Support" },
      "Department mismatch — manual review required before the customer is contacted.",
    ),
    escalationValidation: "Manual Review Required",
    timeline: [
      ev("t1", hoursAgo(8), "submitted", "Complaint submitted", "Thomas Wright", "Customer"),
      ev("t2", hoursAgo(7.9), "analyzed", "Complaint analysis completed", "System", "System"),
      ev("t3", hoursAgo(7.85), "validated", "Python validation completed", "System", "System", "Department mismatch."),
      ev("t4", hoursAgo(7.8), "review", "Flagged for manual review", "System", "System"),
      ev("t5", hoursAgo(6), "assigned", "Assigned to Jordan Ellis", "Jordan Ellis", "Agent"),
    ],
  }),
  build({
    id: "SN-000132",
    subject: "Wrong size received",
    description: "I ordered a size 42 jacket and received a 46. The label on the bag says 42 but the garment is 46. Please send an exchange.",
    customerId: "c-sofia",
    status: "Resolved",
    assigneeId: "u-nora",
    createdAt: daysAgo(6, 11, 40),
    updatedAt: daysAgo(1, 15, 10),
    reference: "ORD-86011",
    productService: "Apparel — jacket",
    resolution: "Exchange shipped (ORD-89940). Prepaid return label sent. Customer confirmed the replacement size.",
    customerResponse: "The jacket exchange arrived today and the size is correct.",
    intel: {
      summary: "Size mismatch between ordered 42 and delivered 46 jacket.",
      primaryIssue: "Item not as described",
      category: "Product Quality",
      subcategory: "Item not as described",
      department: "Product Support",
      supportingDepartment: "Returns",
      productService: "Apparel — jacket",
      sentiment: "Neutral",
      urgency: "Low",
      priority: "P3",
      entities: ["size 42", "size 46", "ORD-86011"],
      reason: "Packed SKU does not match the ordered size.",
      recommendation: "Exchange under the returns window.",
    },
    policy: retPol,
    followUp: { required: true, type: "Resolution confirmation", communication: "Customer confirmed the exchange." },
    timeline: [
      ev("t1", daysAgo(6, 11, 40), "submitted", "Complaint submitted", "Sofia Mendes", "Customer"),
      ev("t2", daysAgo(6, 11, 41), "analyzed", "Complaint analysis completed", "System", "System"),
      ev("t3", daysAgo(6, 11, 42), "routed", "Routed to Product Support", "System", "System"),
      ev("t4", daysAgo(5, 10, 0), "assigned", "Assigned to Nora Hayes", "Nora Hayes", "Agent"),
      ev("t5", daysAgo(1, 15, 10), "resolved", "Complaint resolved", "Nora Hayes", "Agent"),
    ],
  }),
  build({
    id: "SN-000133",
    subject: "Delivery left at the wrong address",
    description: "The driver left two crates at 14 Harbour Lane. We are 41 Harbour Lane. A neighbour signed. The crates contain chilled goods.",
    customerId: "c-raj",
    status: "Escalated",
    assigneeId: "u-david",
    createdAt: hoursAgo(7),
    updatedAt: hoursAgo(1.1),
    reference: "ORD-90114",
    customerType: "Business",
    productService: "Chilled grocery delivery",
    slaRisk: true,
    intel: {
      summary: "Misdelivery of chilled crates to 14 Harbour Lane instead of 41. Time-limited salvage.",
      primaryIssue: "Failed delivery",
      secondaryIssues: ["Perishable goods at risk"],
      category: "Delivery",
      subcategory: "Failed delivery",
      department: "Delivery Operations",
      productService: "Chilled grocery delivery",
      sentiment: "Strongly Negative",
      urgency: "Critical",
      priority: "P0",
      escalation: true,
      entities: ["ORD-90114", "14 Harbour Lane", "41 Harbour Lane", "chilled"],
      reason: "Misdelivery of chilled goods requires same-day recovery or replacement.",
      recommendation: "Recover the crates or replace today. Do not wait on a standard tracer window.",
    },
    policy: { ...delPol, section: "5.4 Perishable misdelivery", applicability: "Applicable — chilled goods, wrong address" },
    escalationLevel: "Department Manager",
    escalationNotes: "Duty manager notified. Driver returning to the street.",
    followUp: { required: true, type: "Escalation acknowledgement" },
    timeline: [
      ev("t1", hoursAgo(7), "submitted", "Complaint submitted", "Raj Patel", "Customer"),
      ev("t2", hoursAgo(6.95), "analyzed", "Complaint analysis completed", "System", "System"),
      ev("t3", hoursAgo(6.9), "validated", "Python validation completed", "System", "System"),
      ev("t4", hoursAgo(6.85), "escalated", "Escalated — chilled goods", "System", "System"),
      ev("t5", hoursAgo(6.2), "assigned", "Assigned to David Okonkwo", "David Okonkwo", "Agent"),
      ev("t6", hoursAgo(1.1), "comment", "Driver returning to street", "David Okonkwo", "Agent"),
    ],
  }),
  build({
    id: "SN-000139",
    subject: "Replacement still has not shipped",
    description: "Following SN-000124, I was told a replacement bowl would ship yesterday. Tracking has not been issued and I have an event on Saturday.",
    customerId: "c-ayesha",
    status: "Reopened",
    assigneeId: "u-nora",
    createdAt: hoursAgo(3.2),
    updatedAt: hoursAgo(0.9),
    reference: "ORD-88421",
    previousComplaintId: "SN-000124",
    productService: "Tableware — ceramic bowl",
    intel: {
      summary: "Follow-up on SN-000124. Replacement for the damaged bowl has not shipped.",
      primaryIssue: "Damaged parcel",
      secondaryIssues: ["Missed replacement dispatch"],
      category: "Product Quality",
      subcategory: "Damaged parcel",
      department: "Returns",
      productService: "Tableware — ceramic bowl",
      sentiment: "Negative",
      urgency: "High",
      priority: "P1",
      entities: ["SN-000124", "ORD-88421", "replacement"],
      reason: "Repeat contact on an open damaged-goods case where dispatch was promised.",
      recommendation: "Link to SN-000124, confirm stock, send tracking the same day.",
    },
    policy: retPol,
    followUp: { required: true, type: "Replacement-status update" },
    timeline: [
      ev("t1", hoursAgo(3.2), "submitted", "Complaint submitted", "Ayesha Khan", "Customer", "Follow-up to SN-000124."),
      ev("t2", hoursAgo(3.15), "analyzed", "Complaint analysis completed", "System", "System"),
      ev("t3", hoursAgo(3.1), "validated", "Python validation completed", "System", "System"),
      ev("t4", hoursAgo(3.05), "routed", "Routed to Returns", "System", "System"),
      ev("t5", hoursAgo(2.4), "assigned", "Assigned to Nora Hayes", "Nora Hayes", "Agent"),
      ev("t6", hoursAgo(2.3), "status", "Reopened related case", "Nora Hayes", "Agent"),
    ],
  }),
  build({
    id: "SN-000140",
    subject: "Promo code not applying",
    description: "Code SPRING15 is advertised on the homepage but checkout rejects it as expired. The banner still shows it as live.",
    customerId: "c-nathan",
    status: "Analyzed",
    createdAt: hoursAgo(0.8),
    updatedAt: hoursAgo(0.8),
    productService: "Checkout promotions",
    intel: {
      summary: "Public promotion SPRING15 fails at checkout while still advertised.",
      primaryIssue: "Promotion not applied",
      category: "Billing",
      subcategory: "Promotion not applied",
      department: "Billing",
      productService: "Checkout promotions",
      sentiment: "Neutral",
      urgency: "Low",
      priority: "P3",
      entities: ["SPRING15"],
      reason: "A listed promotion code is rejected at checkout.",
      recommendation: "Verify campaign dates. Apply a manual adjustment if the code should have worked.",
    },
    timeline: [
      ev("t1", hoursAgo(0.8), "submitted", "Complaint submitted", "Nathan Cole", "Customer"),
      ev("t2", hoursAgo(0.78), "analyzed", "Complaint analysis completed", "System", "System"),
      ev("t3", hoursAgo(0.77), "validated", "Python validation completed", "System", "System"),
    ],
  }),
  build({
    id: "SN-000143",
    subject: "Late delivery of perishable goods",
    description: "Flower order ORD-91220 was due yesterday 10:00 for an event. It is still in the depot. The event has passed. I need a refund and an explanation.",
    customerId: "c-clara",
    status: "Escalated",
    assigneeId: "u-david",
    createdAt: hoursAgo(9),
    updatedAt: hoursAgo(0.3),
    reference: "ORD-91220",
    customerType: "Business",
    productService: "Event flowers",
    slaRisk: true,
    intel: {
      summary: "Event-dated flower order missed its window and is still in the depot.",
      primaryIssue: "Delayed delivery",
      category: "Delivery",
      subcategory: "Delayed delivery",
      department: "Delivery Operations",
      productService: "Event flowers",
      sentiment: "Strongly Negative",
      urgency: "Critical",
      priority: "P0",
      escalation: true,
      entities: ["ORD-91220", "flowers", "event"],
      reason: "A perishable, event-dated delivery missed its window.",
      recommendation: "Stop the shipment if still in network. Issue a full refund. Record a carrier incident.",
    },
    policy: { ...delPol, section: "6.1 Event-dated perishable", applicability: "Applicable — event window missed" },
    escalationLevel: "Critical Management Escalation",
    plan: {
      steps: ["Stop the shipment if still in network", "Issue a full refund", "Record a carrier incident", "Contact the customer with the outcome"],
      requiredActions: ["Full refund", "Incident log"],
      prohibitedActions: ["Offer next-day replacement unless the customer asks and the date still allows it"],
      refundEligible: true,
      replacementEligible: false,
    },
    followUp: { required: true, type: "Refund-status update" },
    timeline: [
      ev("t1", hoursAgo(9), "submitted", "Complaint submitted", "Clara Dubois", "Customer"),
      ev("t2", hoursAgo(8.98), "analyzed", "Complaint analysis completed", "System", "System"),
      ev("t3", hoursAgo(8.9), "escalated", "Escalated — perishable SLA breach", "System", "System"),
      ev("t4", hoursAgo(8.4), "assigned", "Assigned to David Okonkwo", "David Okonkwo", "Agent"),
      ev("t5", hoursAgo(0.3), "comment", "Refund queued, awaiting manager sign-off", "David Okonkwo", "Agent"),
    ],
  }),
  build({
    id: "SN-000145",
    subject: "Product not as described",
    description: "The listing said the desk is solid oak. The underside is particle board. I want to return it and be reimbursed for collection.",
    customerId: "c-nadia",
    status: "In Progress",
    assigneeId: "u-jordan",
    createdAt: daysAgo(1, 15, 50),
    updatedAt: hoursAgo(7),
    reference: "ORD-89330",
    productService: "Furniture — oak desk",
    reviewReasons: ["Ambiguous complaint", "Policy contradiction"],
    intel: {
      summary: "Customer alleges solid-oak listing for a desk with a particle-board underside.",
      primaryIssue: "Item not as described",
      category: "Product Quality",
      subcategory: "Item not as described",
      department: "Product Support",
      productService: "Furniture — oak desk",
      sentiment: "Negative",
      urgency: "Medium",
      priority: "P2",
      entities: ["ORD-89330", "solid oak", "particle board"],
      reason: "Possible misrepresentation of materials. Category matched; urgency did not.",
      recommendation: "Compare listing copy with the SKU specification before approving collection.",
    },
    validation: mismatched(
      { Category: "Product Quality", Department: "Product Support", Escalation: "Not required" },
      { field: "Urgency", genai: "High", python: "Medium" },
      "Urgency mismatch — reviewer should confirm whether listing accuracy is treated as high urgency.",
    ),
    timeline: [
      ev("t1", daysAgo(1, 15, 50), "submitted", "Complaint submitted", "Nadia Rahman", "Customer"),
      ev("t2", daysAgo(1, 15, 51), "analyzed", "Complaint analysis completed", "System", "System"),
      ev("t3", daysAgo(1, 15, 52), "validated", "Python validation completed", "System", "System", "Urgency mismatch."),
      ev("t4", daysAgo(1, 16, 10), "routed", "Routed to Product Support", "System", "System"),
      ev("t5", hoursAgo(7), "assigned", "Assigned to Jordan Ellis", "Jordan Ellis", "Agent"),
    ],
  }),
  build({
    id: "SN-000147",
    subject: "Payment declined but amount held",
    description: "Checkout said the card was declined, but my bank shows a £186 authorisation hold. I never received an order confirmation.",
    customerId: "c-amira",
    status: "In Progress",
    assigneeId: "u-priya",
    createdAt: hoursAgo(13),
    updatedAt: hoursAgo(1.8),
    productService: "Checkout payments",
    intel: {
      summary: "Authorisation hold of £186 without an order capture.",
      primaryIssue: "Payment capture issue",
      category: "Payments",
      subcategory: "Payment capture issue",
      department: "Billing",
      productService: "Checkout payments",
      sentiment: "Negative",
      urgency: "High",
      priority: "P1",
      entities: ["£186", "authorisation hold"],
      reason: "Hold without a successful order capture.",
      recommendation: "Inspect gateway logs. Void the hold if no order exists. Advise the bank-release window.",
      agentGuidance: ["Do not issue a refund for a hold — void it."],
    },
    policy: billPol,
    missingInfo: { items: ["Approximate checkout time"], questions: ["What time did you attempt checkout, and which card brand was used?"] },
    timeline: [
      ev("t1", hoursAgo(13), "submitted", "Complaint submitted", "Amira Hassan", "Customer"),
      ev("t2", hoursAgo(12.9), "analyzed", "Complaint analysis completed", "System", "System"),
      ev("t3", hoursAgo(12.8), "validated", "Python validation completed", "System", "System"),
      ev("t4", hoursAgo(12.7), "routed", "Routed to Billing", "System", "System"),
      ev("t5", hoursAgo(8), "assigned", "Assigned to Priya Nair", "Priya Nair", "Agent"),
      ev("t6", hoursAgo(1.8), "status", "Status changed to In Progress", "Priya Nair", "Agent"),
    ],
  }),
  build({
    id: "SN-000149",
    subject: "Request for data export",
    description: "Please export all personal data you hold on my account, including orders, messages and stored payment methods, under data-protection rules.",
    customerId: "c-grace",
    status: "Awaiting Customer",
    assigneeId: "u-samir",
    createdAt: daysAgo(5, 9, 0),
    updatedAt: daysAgo(1, 10, 0),
    productService: "Account data",
    intel: {
      summary: "Data-subject access request covering orders, messages and stored payment methods.",
      primaryIssue: "Data request",
      category: "Account Access",
      subcategory: "Data request",
      department: "Account Security",
      supportingDepartment: "Compliance",
      productService: "Account data",
      sentiment: "Neutral",
      urgency: "Medium",
      priority: "P2",
      escalation: true,
      entities: ["data export", "payment methods"],
      reason: "Privacy requests follow a controlled process.",
      recommendation: "Verify identity. Log in the privacy register. Fulfil without PAN data.",
    },
    policy: privPol,
    escalationLevel: "Compliance Review",
    followUp: { required: true, type: "Additional information request", communication: "Identity check received; compiling export without payment tokens." },
    timeline: [
      ev("t1", daysAgo(5, 9, 0), "submitted", "Complaint submitted", "Grace Okonkwo", "Customer"),
      ev("t2", daysAgo(5, 9, 1), "analyzed", "Complaint analysis completed", "System", "System"),
      ev("t3", daysAgo(5, 9, 2), "escalated", "Escalated — data subject request", "System", "System"),
      ev("t4", daysAgo(4, 11, 0), "assigned", "Assigned to Samir Volkov", "Samir Volkov", "Agent"),
      ev("t5", daysAgo(1, 10, 0), "status", "Identity check received, compiling export", "Samir Volkov", "Agent"),
    ],
  }),
  build({
    id: "SN-000150",
    subject: "Replacement arrived damaged too",
    description: "This is the second broken glass vase. The first was SN-000098. The replacement was packed the same way and the rim is chipped. I want a refund, not a third attempt.",
    customerId: "c-ethan",
    status: "Escalated",
    assigneeId: "u-nora",
    createdAt: hoursAgo(6.5),
    updatedAt: hoursAgo(1.5),
    reference: "ORD-90551",
    previousComplaintId: "SN-000098",
    productService: "Glassware — vase",
    slaRisk: true,
    intel: {
      summary: "Second damaged delivery of the same vase SKU. Customer refuses another replacement and wants a refund.",
      primaryIssue: "Damaged parcel",
      secondaryIssues: ["Repeat packing failure"],
      category: "Product Quality",
      subcategory: "Damaged parcel",
      department: "Returns",
      productService: "Glassware — vase",
      sentiment: "Strongly Negative",
      urgency: "Critical",
      priority: "P0",
      escalation: true,
      entities: ["SN-000098", "ORD-90551", "vase"],
      reason: "Repeat damage on a replacement indicates a packing failure.",
      recommendation: "Do not send a third replacement. Refund in full and flag packing for this SKU.",
    },
    policy: { ...retPol, section: "4.3 Repeat damage", applicability: "Applicable — second damaged replacement" },
    escalationLevel: "Supervisor Review",
    plan: {
      steps: ["Stop further replacements", "Issue a full refund", "Flag packing process for this SKU", "Apologise and close with the customer"],
      requiredActions: ["Full refund", "Packing incident"],
      prohibitedActions: ["Offer another replacement of the same SKU"],
      refundEligible: true,
      replacementEligible: false,
    },
    timeline: [
      ev("t1", hoursAgo(6.5), "submitted", "Complaint submitted", "Ethan Brooks", "Customer"),
      ev("t2", hoursAgo(6.4), "analyzed", "Complaint analysis completed", "System", "System"),
      ev("t3", hoursAgo(6.3), "escalated", "Escalated — repeat damage", "System", "System"),
      ev("t4", hoursAgo(5.5), "assigned", "Assigned to Nora Hayes", "Nora Hayes", "Agent"),
      ev("t5", hoursAgo(1.5), "note", "Refund recommended, awaiting supervisor", "Nora Hayes", "Agent"),
    ],
  }),
  build({
    id: "SN-000136",
    subject: "Warranty claim for blender",
    description: "The motor on blender BL-900 stopped after 11 months. I still have the receipt. Please start a warranty replacement.",
    customerId: "c-lila",
    status: "Closed",
    assigneeId: "u-nora",
    createdAt: daysAgo(18, 10, 0),
    updatedAt: daysAgo(8, 14, 0),
    reference: "ORD-70119",
    productService: "Small appliances — blender",
    resolution: "Warranty approved. Replacement dispatched. Case closed after delivery confirmation.",
    intel: {
      summary: "In-warranty motor failure on blender BL-900 with proof of purchase.",
      primaryIssue: "Warranty claim",
      category: "Product Quality",
      subcategory: "Item not as described",
      department: "Product Support",
      productService: "Small appliances — blender",
      sentiment: "Neutral",
      urgency: "Low",
      priority: "P3",
      entities: ["BL-900", "ORD-70119"],
      reason: "Hardware failure inside the warranty window.",
      recommendation: "Validate warranty window and ship a replacement.",
    },
    followUp: { required: true, type: "Closure confirmation" },
    timeline: [
      ev("t1", daysAgo(18, 10, 0), "submitted", "Complaint submitted", "Lila Nguyen", "Customer"),
      ev("t2", daysAgo(18, 10, 1), "analyzed", "Complaint analysis completed", "System", "System"),
      ev("t3", daysAgo(17, 9, 0), "assigned", "Assigned to Nora Hayes", "Nora Hayes", "Agent"),
      ev("t4", daysAgo(12, 11, 0), "resolved", "Warranty replacement shipped", "Nora Hayes", "Agent"),
      ev("t5", daysAgo(8, 14, 0), "closed", "Complaint closed", "Nora Hayes", "Agent"),
    ],
  }),
  build({
    id: "SN-000151",
    subject: "Thank you — replacement received",
    description: "The jacket exchange arrived today and the size is correct. Happy for you to close any remaining notes on this order.",
    customerId: "c-sofia",
    status: "Closed",
    assigneeId: "u-nora",
    createdAt: hoursAgo(26),
    updatedAt: hoursAgo(18),
    reference: "ORD-89940",
    previousComplaintId: "SN-000132",
    productService: "Apparel — jacket",
    resolution: "Customer confirmed the exchange. No further action. Closed.",
    intel: {
      summary: "Positive confirmation on a completed exchange. No operational action required.",
      primaryIssue: "Resolution confirmation",
      category: "General Inquiry",
      subcategory: "Unclassified request",
      department: "Customer Accounts",
      productService: "Apparel — jacket",
      sentiment: "Positive",
      urgency: "Low",
      priority: "P3",
      entities: ["ORD-89940"],
      reason: "Closure confirmation from the customer.",
      recommendation: "Close the related complaint and thank the customer.",
    },
    followUp: { required: false },
    timeline: [
      ev("t1", hoursAgo(26), "submitted", "Complaint submitted", "Sofia Mendes", "Customer"),
      ev("t2", hoursAgo(25.9), "analyzed", "Complaint analysis completed", "System", "System"),
      ev("t3", hoursAgo(18), "closed", "Complaint closed", "Nora Hayes", "Agent"),
    ],
  }),
  build({
    id: "SN-000138",
    subject: "Order cancelled without notice",
    description: "Order ORD-91002 was cancelled overnight. I did not cancel it. Stock still shows as available. I need this order for a client presentation on Friday.",
    customerId: "c-mei",
    status: "Awaiting Customer",
    createdAt: hoursAgo(16),
    updatedAt: hoursAgo(2.8),
    reference: "ORD-91002",
    customerType: "Business",
    productService: "Wholesale order",
    reviewReasons: ["Missing policy support"],
    intel: {
      summary: "Order ORD-91002 cancelled overnight without customer action. Stock still listed as available.",
      primaryIssue: "Cancellation",
      category: "Order Issue",
      subcategory: "Cancellation",
      department: "Customer Accounts",
      productService: "Wholesale order",
      sentiment: "Negative",
      urgency: "High",
      priority: "P1",
      entities: ["ORD-91002"],
      reason: "Cancellation source is not yet identified. Policy support for silent cancellation is missing.",
      recommendation: "Review cancellation source. Restore the order if cancelled in error.",
    },
    validation: {
      overall: "Manual Review Required",
      fields: [
        { field: "Category", genai: "Order Issue", python: "Order Issue", result: "Match" },
        { field: "Department", genai: "Customer Accounts", python: "Customer Accounts", result: "Match" },
        { field: "Escalation", genai: "Not required", python: "Not required", result: "Match" },
      ],
      policyValidated: false,
      resolutionValidated: false,
      reviewReason: "No active policy section covers system-initiated cancellation without notice.",
    },
    timeline: [
      ev("t1", hoursAgo(16), "submitted", "Complaint submitted", "Mei Tanaka", "Customer"),
      ev("t2", hoursAgo(15.9), "analyzed", "Complaint analysis completed", "System", "System"),
      ev("t3", hoursAgo(15.8), "validated", "Python validation completed", "System", "System", "Policy not validated."),
      ev("t4", hoursAgo(2.8), "status", "Waiting on order desk", "System", "System"),
    ],
  }),
];

export const articles: KnowledgeArticle[] = [
  { id: "kb-orders-01", title: "How to track an order", category: "Orders", summary: "Where customers find tracking and when to open a complaint.", updatedAt: daysAgo(4, 11, 0), relatedIds: ["kb-delivery-01"], policyId: "DEL-POL-04", version: "1.4", effectiveDate: daysAgo(40, 9, 0), content: ["Customers can track an order from the account page or the dispatch email. Tracking appears once the warehouse has handed the parcel to the carrier.", "If a shipment remains on ‘label created’ for more than 24 hours, check with Delivery Operations before telling the customer it is lost.", "Open a complaint for a delivered scan with no goods, a misdelivery, or a missed committed window."] },
  { id: "kb-payments-01", title: "Duplicate charges and authorisation holds", category: "Payments", summary: "How to tell a true duplicate capture from a bank hold.", updatedAt: daysAgo(6, 14, 0), relatedIds: ["kb-payments-02"], policyId: "BIL-POL-01", version: "1.8", effectiveDate: daysAgo(90, 9, 0), content: ["An authorisation hold is not a capture. If checkout failed, the hold should release in 1–7 working days. Do not issue a refund for a hold — void it in the gateway if it is still open.", "A duplicate charge has two captured payments with different processor IDs against one invoice. Refund the later capture and send a corrected statement."] },
  { id: "kb-payments-02", title: "Refund timescales", category: "Payments", summary: "When a refund is approved versus when it reaches the customer.", updatedAt: daysAgo(20, 10, 0), relatedIds: ["kb-payments-01"], policyId: "BIL-POL-01", version: "1.2", effectiveDate: daysAgo(200, 9, 0), content: ["Approved refunds leave our side the same working day. Card refunds typically appear in 3–5 working days.", "If a refund is older than 10 working days, raise it with Billing and attach the processor payout ID."] },
  { id: "kb-delivery-01", title: "Proof of delivery disputes", category: "Delivery", summary: "Handling ‘delivered’ scans when the customer has not received the goods.", updatedAt: daysAgo(3, 16, 0), relatedIds: ["kb-delivery-02", "kb-orders-01"], policyId: "DEL-POL-04", version: "2.1", effectiveDate: daysAgo(60, 9, 0), content: ["Ask the carrier for photo POD and GPS of the scan. If the GPS is not at the delivery address, treat it as a misdelivery.", "Do not accuse the customer of receiving the parcel. Offer a replacement or refund once the tracer has run, or immediately if the goods are perishable."] },
  { id: "kb-delivery-02", title: "Perishable and timed deliveries", category: "Delivery", summary: "Escalation when a time-critical shipment misses its window.", updatedAt: daysAgo(7, 8, 0), relatedIds: ["kb-delivery-01"], policyId: "DEL-POL-04", version: "2.1", effectiveDate: daysAgo(60, 9, 0), content: ["Flower, food, and event-dated orders are flagged perishable. If the committed window is missed, escalate to Delivery Operations.", "Default remedy is a full refund. Do not offer a next-day replacement unless the customer asks and the date still allows it."] },
  { id: "kb-returns-01", title: "Damaged-in-transit replacements", category: "Returns", summary: "When to replace, when to refund, and what evidence is required.", updatedAt: daysAgo(2, 15, 0), relatedIds: ["kb-warranty-01"], policyId: "RET-POL-02", version: "3.0", effectiveDate: daysAgo(30, 9, 0), content: ["For a first damaged delivery, a replacement is the default if stock is available.", "If a replacement of the same SKU also arrives damaged, do not send a third. Refund in full and flag packing."] },
  { id: "kb-accounts-01", title: "Password reset and lockouts", category: "Accounts", summary: "Identity checks required before a manual password reset.", updatedAt: daysAgo(9, 11, 0), relatedIds: ["kb-security-01"], policyId: "SEC-POL-03", version: "4.0", effectiveDate: daysAgo(20, 9, 0), content: ["Never reset a password from chat or email without an identity check.", "Travel-related lockouts are common. If the customer can describe recent orders, unlock and log the exception."] },
  { id: "kb-security-01", title: "Suspected account takeover", category: "Security", summary: "Immediate steps when a customer reports unrecognised logins.", updatedAt: daysAgo(1, 9, 0), relatedIds: ["kb-security-02", "kb-accounts-01"], policyId: "SEC-POL-03", version: "4.0", effectiveDate: daysAgo(20, 9, 0), content: ["Escalate immediately. Lock the account, revoke sessions, and reset credentials only after identity verification.", "Review new payees, address changes, and recent orders."] },
  { id: "kb-security-02", title: "Data-subject access requests", category: "Privacy", summary: "How to log, verify, and fulfil an export or deletion request.", updatedAt: daysAgo(11, 14, 0), relatedIds: ["kb-security-01"], policyId: "PRI-POL-01", version: "2.0", effectiveDate: daysAgo(80, 9, 0), content: ["All export and deletion requests are escalated to Account Security and logged in the privacy register.", "Do not send personal data to an email address that is not already on the account."] },
  { id: "kb-warranty-01", title: "In-warranty hardware claims", category: "Warranty", summary: "Proof of purchase and replacement path for appliances.", updatedAt: daysAgo(15, 9, 0), relatedIds: ["kb-returns-01"], policyId: "RET-POL-02", version: "3.0", effectiveDate: daysAgo(30, 9, 0), content: ["Most small appliances carry a 12-month warranty from delivery.", "A receipt or order number is required. Cosmetic wear is excluded."] },
  { id: "kb-tech-01", title: "App and checkout defects", category: "Technical Support", summary: "What to collect before logging a defect.", updatedAt: daysAgo(8, 10, 0), relatedIds: ["kb-payments-01"], version: "1.0", effectiveDate: daysAgo(50, 9, 0), content: ["Collect device, OS, app version, and the exact step that fails.", "Offer the website checkout as a workaround when the app fails at payment."] },
  { id: "kb-general-01", title: "How complaint handling works", category: "General Support", summary: "What customers should expect after submitting a complaint.", updatedAt: daysAgo(5, 12, 0), relatedIds: ["kb-orders-01"], version: "1.1", effectiveDate: daysAgo(10, 9, 0), content: ["Every complaint receives an ID. It is analysed, checked against policy, and routed to a department.", "You can track status with the complaint ID. We will ask only for information needed to investigate."] },
];

export const kbCategories = [
  "Orders",
  "Payments",
  "Delivery",
  "Returns",
  "Accounts",
  "Security",
  "Warranty",
  "Technical Support",
  "Privacy",
  "General Support",
] as const;

/** Illustrative examples used on the public site. They show how handling differs; they are not live complaints. */
export const complexExample: {
  message: string;
  primaryIssue: string;
  secondaryIssue: string;
  primaryDepartment: string;
  supportingDepartment: string;
  priority: Priority;
  sentiment: string;
  urgency: string;
  escalation: string;
  reason: string;
} = {
  message: "My order arrived damaged and I still haven't received the refund from my previous complaint.",
  primaryIssue: "Damaged product",
  secondaryIssue: "Refund delay",
  primaryDepartment: "Returns",
  supportingDepartment: "Billing",
  priority: "P1",
  sentiment: "Negative",
  urgency: "High",
  escalation: "Supervisor review",
  reason: "Two issues in one message, and one of them repeats an earlier complaint that is still open.",
};

export const hardCases: {
  message: string;
  label: string;
  sentiment: string;
  urgency: string;
  handling: string;
  note: string;
}[] = [
  {
    message: "The kettle base gets hot enough to scorch the counter. Nobody was hurt — just thought you should know.",
    label: "Calm message, safety risk",
    sentiment: "Neutral",
    urgency: "Critical",
    handling: "Safety · critical escalation",
    note: "A polite tone does not lower the risk.",
  },
  {
    message: "This is ridiculous. Your promo code STILL doesn't work. Fix it.",
    label: "Angry message, low risk",
    sentiment: "Strongly negative",
    urgency: "Low",
    handling: "Billing · standard queue",
    note: "Strong emotion does not raise priority on its own.",
  },
  {
    message: "Third time writing about the same missing refund. Nobody has replied.",
    label: "Repeated, unresolved",
    sentiment: "Negative",
    urgency: "High",
    handling: "Billing · supervisor review",
    note: "History changes how the complaint is handled.",
  },
  {
    message: "Please delete everything you hold about me and confirm when it's done.",
    label: "Privacy request",
    sentiment: "Neutral",
    urgency: "Medium",
    handling: "Account Security · compliance review",
    note: "Sensitive requests follow a controlled process.",
  },
  {
    message: "My thing broke. Please sort it out.",
    label: "Missing information",
    sentiment: "Negative",
    urgency: "Medium",
    handling: "Clarification requested",
    note: "No order, product or date — ask before acting.",
  },
  {
    message: "Wrong item delivered and I was charged twice for it.",
    label: "More than one issue",
    sentiment: "Negative",
    urgency: "High",
    handling: "Returns + Billing",
    note: "One complaint, two responsible teams.",
  },
];
