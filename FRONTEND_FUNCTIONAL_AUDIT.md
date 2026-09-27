# SupportNova — Frontend Functionality & Data-Integrity Audit

Scope of this work: **make the frontend real.** Admin staff management,
department management, agent–department assignment, complaint routing,
reviewer workflow, agent queue and manager views now run against the
existing FastAPI backend and MongoDB models. AI / GenAI / RAG / ML code
was **not** touched (see section **J**).

Branch: `arena/01a0ddf0-supportnova`
Verification date: 2026-09-27

---

## A. Frontend work completed

### A1. New / rewritten admin surfaces

| Screen | State before | State now |
|---|---|---|
| **Staff & Users** (`pages/UsersAdmin.tsx`) | Read-only list; no way to create staff; department was free text | Full staff administration: list with search + role/status/department filters, role badges for Customer / Agent / Reviewer / Manager / Admin, **Add staff** modal (name, email, password, role, department, status), **Edit staff** modal (name, role, department, status), activate / deactivate, counts from `GET /api/admin/users/overview`. Department pickers are populated from `GET /api/departments` — no hardcoded names. |
| **Departments** (`pages/DepartmentsAdmin.tsx`, new) | Did not exist | Department registry: list with live staff / agent / active-agent / manager counts, create, rename + edit description, activate / deactivate, per-department staff drill-down (`GET /api/admin/departments/{name}/staff`). Routing-taxonomy (`source="system"`) departments are shown as non-renameable, matching the backend rule. |
| **Rules** (`pages/RulesAdmin.tsx`) | Mock rules matrix with working-looking toggles | The rule engine exposes no CRUD API, so the page is now an honest `EmptyState` that says where rules actually live (`ml/data/*.csv`) instead of pretending to edit them. |

Navigation: `Sidebar.tsx` gained a **Departments** entry and the users entry
was renamed **Staff & Users**; `App.tsx` registers `/departments` inside the
existing Admin `RoleRoute` (no new dashboard, no new shell).

### A2. Screens connected to real persisted state

* **Dashboard** — role-specific cards and lists from `/api/admin/statistics`,
  `/api/agent/statistics`, `/api/review/statistics`, `/api/management/*`.
* **Complaints / My Queue / Manual Review** — `/api/complaints`,
  `/api/agent/queue`, `/api/review/queue`. My Queue was extended to show
  department, category, priority, escalation state, review status, created
  date, plus search and an include-closed toggle — every column comes from
  the queue payload.
* **Complaint Detail** — identity, department, status, category, priority,
  validation, escalation, activity timeline, responses and comments all come
  from `GET /api/complaints/{id}`, `/activity` and `/analysis`.
  The **assigned agent is now the real one**: the page reads
  `assigned_agent{id,name}` from the detail response instead of looking the
  id up in a client-side user list that was always empty (which made every
  assigned complaint read "Unassigned").
* **Analytics / Reports / Audit Logs** — `/api/management/analytics`,
  `/api/management/trends`, `/api/management/sla`,
  `/api/management/reports*`, `/api/admin/audit*`.
* **Documents (KB admin)** — `/api/admin/knowledge-base/documents`
  (unchanged behaviour; listed for completeness).
* **Profile / Settings** — `GET /api/auth/me`, plus the real audit trail for
  administrators.
* **Track** — rewritten. The old page asked an anonymous visitor for an
  `SN-######` id + email and "found" a complaint; no such endpoint exists.
  It now explains that complaints are private to the submitting account,
  offers sign-in / register, and for a signed-in customer searches **their
  own real complaints** by id with loading / empty / not-found / error states.
* **Submit a complaint** — `NewComplaint.tsx` now collects only what
  `POST /api/complaints` stores (title, description, product, order
  reference), shows a submitting state, and surfaces the server error
  message when creation fails. Inputs that the API silently discarded
  (customer type, contact channel, previous-complaint reference, file
  attachment) were removed and replaced by one honest note.

### A3. "Never fabricate" pass

* New `components/NotAvailable.tsx` renders a consistent *Not available*
  marker. `PriorityBadge`, `SentimentBadge`, `UrgencyBadge`,
  `ValidationResult`, `EscalationPanel`, `AnalysisCard`, and the detail-page
  `Info` / `Row` helpers all accept `null` and use it.
* `context/DataContext.tsx` — `mapBackendComplaint` no longer defaults
  category / priority / urgency / sentiment / department / validation /
  escalation. Missing values stay `null`. `types/index.ts` was widened
  accordingly, so the compiler now *forces* every consumer to handle the
  unknown case.
* Seeded client-side data was retired: `customers` and `notifications` start
  empty, the mock `rules` / `documents` collections and `toggleRule` were
  deleted.
* `data/mockData.ts` lost seven fake exports and is now clearly marketing-only
  content (`exampleComplaints`, `exampleCustomers`, …). The four marketing
  components and the landing page render those fixed examples and **no longer
  read `DataContext`**, so a signed-in user's real complaint can never appear
  as marketing material on a public page.
* `api/complaints.ts` lost its mock-era fallback (`pendingIntelligence`,
  `buildComplaintFromDraft`).
* `Topbar` — the customer "search" that filtered nothing was removed;
  notifications show an honest empty state.
* `AuthContext` no longer carries an always-empty `users` directory, and its
  local-only `updateProfile` was deleted (it made a profile edit look saved
  when nothing reached the server).
* `api/auth.ts::normalizeUser` no longer invents `lastActive`, `createdAt`
  or `status` (it used `new Date().toISOString()` and `"Active"`); it maps
  the stored fields and leaves the rest undefined. `Profile` / `Settings`
  render *Not available* instead.
* `ForgotPassword` no longer claims "reset instructions have been sent" —
  there is no such endpoint and no mailer. It explains the real recovery
  path (administrator re-provisioning / contact support).

### A4. States

Every newly connected surface has loading, empty, error, success and
validation states: skeleton/"Loading…" while fetching, `EmptyState` with a
factual message when a real query returns nothing, an inline error panel with
the server's `detail` when a call fails, success feedback on mutations, and
field-level validation in the staff / department modals (required name,
valid email, 8-char password, department required for Agents).

---

## B. Backend changes that were required by the frontend

Only the six categories the task allows. No unrelated refactors.

| # | Change | Files |
|---|---|---|
| 1 | **Admin staff provisioning** — create / update staff with role, department, status; password hashed with the existing `hash_password`; audit-logged; last-active-admin and self-edit guards | `api/staff.py` (new), `api/schemas.py` (`StaffCreateRequest`, `StaffUpdateRequest`) |
| 2 | **Department registry** — a `departments` collection seeded from the existing routing taxonomy (`ml/data/departments.csv`), with create / rename / describe / activate / deactivate and real staff counts | `api/departments.py` (new), `api/database.py`, `api/schemas.py` (`DepartmentCreateRequest`, `DepartmentUpdateRequest`), lifespan seeding in `api/main.py` |
| 3 | **Agent ↔ department assignment** — an Agent must belong to an existing, active department; renaming a custom department propagates to `users.department` | `api/staff.py`, `api/departments.py` |
| 4 | **Reviewer approval must reach an agent** — post-review routing through the existing assignment service, plus a post-condition that forbids the orphan state | `api/review.py` |
| 5 | **Department-strict assignment** — a complaint with a department may only be assigned to an active Agent *of that department* | `api/assignment.py` |
| 6 | **API responses the frontend needs** — `assigned_agent{id,name}` and analysis summary fields on complaint reads; `GET /api/auth/me` now also returns the stored `department`, `status`, `phone`, `created_at`, `updated_at` (never the password hash) so Profile/Settings do not have to invent them | `api/main.py` |

New endpoints and their authorization (asserted in
`api/tests/test_staff_departments.py::NEW_ENDPOINTS`):

| Method | Path | Allowed roles |
|---|---|---|
| POST | `/api/admin/users` | Admin |
| PATCH | `/api/admin/users/{user_id}` | Admin |
| POST | `/api/admin/departments` | Admin |
| PATCH | `/api/admin/departments/{department_id}` | Admin |
| GET | `/api/admin/departments/{department_name}/staff` | Manager, Admin |
| GET | `/api/admin/agents` | Manager, Admin |
| GET | `/api/departments` | Agent, Reviewer, Manager, Admin |

Public registration was verified to be **customer-only**: a `role` field in
the register payload is ignored and the created account is a `Customer`
(`test_public_registration_can_only_create_customers`).

> The working tree also contains the earlier analytics / SLA / reporting work
> (`api/analytics.py`, `api/sla.py`, `api/reports.py` + their tests). That is
> from the previous task, not this one; it is listed only so the diff is not
> mistaken for scope creep here.

---

## C. Staff management — confirmation

* **Create Agent** — `POST /api/admin/users` with `role="Agent"` and a
  department. A department is **mandatory** for Agents; unknown or inactive
  departments are rejected (400).
* **Create Reviewer** — created without a department (reviewers work the
  cross-department manual-review queue in this org model).
* **Create Manager** — created with an **optional** department.
* **Create Admin** — supported for completeness; Customer accounts cannot be
  created through this endpoint (they self-register).
* **Assign / change department** — `PATCH /api/admin/users/{id}` validates
  the target department against the registry; promoting an Agent to Reviewer
  clears the department.
* **Activate / deactivate** — via `PATCH /api/admin/users/{id}` or the
  existing `PATCH /api/admin/users/{id}/status`. An admin cannot change their
  own role or status, and the **last active administrator cannot be
  deactivated or demoted**.
* **Passwords** are hashed server-side and never returned; nothing is stored
  in browser storage except the JWT the app already used.

All of the above are covered by tests (section **G**).

---

## D. Department management

* Storage: a `departments` collection. On startup the eight departments of
  the existing routing taxonomy (`ml/data/departments.csv`) are seeded with
  `source="system"`; administrators can add `source="custom"` departments.
  **No competing department model was introduced** — routing still reads the
  same taxonomy, and staff records still carry `users.department`.
* Capabilities: list (with `staff_count`, `agent_count`,
  `active_agent_count`, `manager_count`), create, rename, edit description,
  activate / deactivate, list staff per department.
* Rules enforced by the backend and mirrored in the UI:
  * a system (routing-taxonomy) department cannot be renamed — renaming it
    would silently break classification routing;
  * renaming a custom department updates every staff record that referenced it;
  * deactivating a department blocks **new** assignments only; it never
    detaches existing staff or complaints;
  * status values are exactly `Active` / `Inactive`;
  * duplicate names (case-insensitive) are rejected.
* The frontend contains **no hardcoded department list**. Every picker —
  staff create, staff edit, department filters — is fed by
  `GET /api/departments`.

---

## E. Exact routing: complaint → department → agent → queue

**1. Submission.** `POST /api/complaints` (Customer only) stores the
complaint, runs the existing rule engine + GenAI + ground-truth validation
pipeline (untouched), and persists the resulting workflow fields, including
`assigned_department`, priority and SLA window.

**2. Branch on the persisted workflow status** (`api/main.py`, "AUTOMATIC
ROUTING"):

* `Manual Review` → a `routed` activity is recorded and the complaint waits
  in the reviewer queue. **It is not auto-assigned.**
* `Escalated` → an `escalated` activity is recorded; the management
  workflow owns it.
* otherwise → `auto_assign_complaint(...)` is called with the persisted
  `assigned_department`.

**3. `auto_assign_complaint` (`api/assignment.py`) — the single assignment
algorithm.** There is no second algorithm in the frontend.

```
candidates = users where role == "Agent"
                   and status == "Active"
                   and department == <complaint department>   # strict
agent      = candidate with the fewest OPEN complaints
```

* If no department was determined, and only then, the search widens to any
  active agent.
* If there is no eligible agent, **nothing is assigned**: the complaint keeps
  its current status, an `Awaiting manual assignment` activity is written
  ("No active agent is available in <department>."), and the UI says so.
* On success the complaint is updated **in one write** with
  `assigned_to = <agent id>` **and** `status = "Assigned"`, then an
  `assigned` activity and an audit-log entry are recorded.

**4. Reviewer approval** (`api/review.py`). When a review decision returns the
complaint to normal handling (`next_status == "Analyzed"`), the complaint is
re-read and pushed through the *same* `auto_assign_complaint` service using
its persisted department. If an agent is found, the persisted status becomes
`Assigned` with a real `assigned_to`, and the response reports the agent.
Escalated outcomes stay escalated; an explicit `Reassign` already names an
agent and is left alone.

**5. Agent My Queue.** `GET /api/agent/queue` filters on
`assigned_to == current_user.id`, so the agent that the assignment service
chose — and only that agent — sees the complaint. The UI renders exactly the
persisted `assigned_to`; there is no client-side ownership guess anywhere.

---

## F. The orphaned `Assigned` / `assigned_to = null` state is fixed

**Cause.** Reviewer approval set the complaint status to a post-review value
without ever routing it to an agent, so a complaint could be persisted as
`status="Assigned", assigned_to=null` — in nobody's queue, invisible to every
role except management.

**Fix (persisted state, not display).**

1. Approval now routes through `auto_assign_complaint`, so an approved
   complaint gets a **real, active, correct-department** agent.
2. `auto_assign_complaint` only ever writes `status="Assigned"` together with
   `assigned_to` in the same update — the two can no longer diverge.
3. A **post-condition** runs at the end of every review action: the complaint
   is re-read from MongoDB, and if it is `Assigned` with no `assigned_to`, it
   is written back to `Analyzed` and an `Awaiting manual assignment` activity
   is recorded. The work stays visible as unrouted instead of disappearing.

**Regression tests** (`api/tests/test_staff_departments.py`):

* `test_reviewer_approval_assigns_a_real_agent`
* `test_approved_complaint_is_never_assigned_without_an_owner`
* `test_reviewer_approval_puts_the_complaint_in_the_agent_queue`

All three assert against the persisted MongoDB document, not the API
response.

---

## G. Test results (exact)

### Backend — `PYTHONPATH=. python3 -m pytest -q api/tests`

```
177 passed, 1 warning in 9.85s
```

| File | Tests |
|---|---|
| `api/tests/test_staff_departments.py` | **39 passed** |
| `api/tests/test_complaint_workflow.py` | 34 passed |
| `api/tests/test_reports.py` | 30 passed |
| `api/tests/test_routes.py` | 21 passed |
| `api/tests/test_analytics.py` | 19 passed |
| `api/tests/test_admin_statistics.py` | 16 passed |
| `api/tests/test_role_statistics.py` | 11 passed |
| `api/tests/test_sla.py` | 7 passed |

The single warning is `passlib` deprecating Python's `crypt` module —
pre-existing, unrelated.

Requested scenarios, and the test that proves each:

| Required scenario | Test |
|---|---|
| Admin creates an Agent (with department) | `test_admin_creates_agent_with_department` |
| Admin creates a Reviewer | `test_admin_creates_reviewer_without_department` |
| Admin creates a Manager | `test_admin_creates_manager_with_optional_department` |
| Admin assigns / changes a department | `test_admin_changes_agent_department` |
| Every Agent belongs to a department | `test_agent_requires_a_department`, `test_agent_cannot_be_created_in_unknown_department`, `test_agent_cannot_be_created_in_inactive_department` |
| Reviewer approval assigns a real agent | `test_reviewer_approval_assigns_a_real_agent` |
| `assigned_to` is never null when status is `Assigned` | `test_approved_complaint_is_never_assigned_without_an_owner` |
| Assigned agent sees it in My Queue | `test_reviewer_approval_puts_the_complaint_in_the_agent_queue` |
| Wrong-department agent never receives it | `test_agent_of_another_department_never_receives_the_complaint` |
| Inactive agent never receives new work | `test_inactive_agent_never_receives_a_complaint` |
| Customer cannot create privileged staff | `test_customer_cannot_reach_staff_provisioning`, `test_public_registration_can_only_create_customers` |
| RBAC on every new endpoint | `test_new_endpoints_are_registered_and_role_guarded` (parametrised over all seven) |
| Profile response the frontend depends on | `test_auth_me_returns_the_stored_staff_profile`, `test_auth_me_omits_department_for_a_customer` |

These run the real persistence code against `mongomock`, so the pipelines,
guards and writes are genuinely executed.

### Backend — compile check

```
python3 -m compileall -q api   →  OK (no output)
```

### Frontend — TypeScript

```
npx tsc --noEmit --ignoreDeprecations 5.0   →  0 errors
```

(`--ignoreDeprecations 5.0` is required only because `tsconfig.json`
declares `"ignoreDeprecations": "6.0"` while the repo pins TypeScript 5.9.3.
No check was disabled; `strict`, `noUnusedLocals` and `noUnusedParameters`
remain on.) The pre-existing baseline of 16 `TS6133` errors in `Home.tsx` and
`NewComplaint.tsx` was cleared as part of this work — the tree is now clean.

### Frontend — production build

```
npm run build
✓ 2047 modules transformed
dist/index.html  658.52 kB │ gzip: 183.63 kB
✓ built in 4.11s
```

### What could **not** be verified

* **No live end-to-end run.** The sandbox has no MongoDB instance and no
  `.env`, and `ml/rule_engine.py` loads `ml/models/*.pkl` at import time —
  those artifacts are gitignored and absent, so `api.main` cannot be imported
  outside the test harness. The manual E2E script in section H is written and
  ready to run where those two prerequisites exist. Its automated equivalent
  (department A/B, agent per department, routing, approval, queue visibility)
  already runs in `test_staff_departments.py`.
* **No browser runtime check.** There is no browser or headless runner in the
  sandbox, so verification is limited to full type-checking and a clean
  production build.

---

## H. Remaining frontend work

1. **Manual E2E in a real environment** (needs MongoDB + `ml/models/*.pkl`):
   Admin login → create Dept A and Dept B → Agent A in A, Agent B in B →
   Reviewer → Manager → Customer submits a Dept-A complaint → reviewer
   approves if flagged → status `Assigned`, `assigned_to` = Agent A →
   Agent A sees it in My Queue, Agent B does not → agent actions → customer
   sees the real status and timeline.
2. **Help Center articles** are still static content from
   `data/mockData.ts` (`articles`, `kbCategories`). They are editorial help
   pages, not operational data, but they are not backed by the knowledge-base
   API; wiring them to `/api/knowledge-base` would need a public read endpoint.
3. **Notifications** are session-only. The backend stores no notifications,
   so the bell shows an honest empty state; a real feed needs a backend
   notification model (out of scope here).
4. **Profile / Settings are read-only.** There is no self-service profile
   update endpoint, so the UI says so rather than faking a save.
5. **Password reset** is informational only — no endpoint, no mailer.
6. **Dead code worth deleting in a cleanup pass**: `components/ComplaintTable.tsx`
   (no importers) and `utils/classify.ts::nextComplaintId` (no importers after
   the mock fallback was removed). Several commented-out marketing sections in
   `Home.tsx` remain; the identifiers they used were removed from the imports
   to keep the module clean, so restoring a section means restoring its import.
7. **`Resolved` is never observable in the UI** because the backend closes a
   complaint immediately on resolve (`api/agent.py`); the customer-facing
   status jumps to `Closed`. A frontend-only change cannot fix this.
8. **Manager department scoping** is not enforced by the backend today (see I).
   The Manager screens are department-aware in their presentation and will
   scope correctly the moment the backend filters by department.

---

## I. Remaining backend work (not done — outside the allowed scope)

1. **Department-scoped manager authorization.** `GET /api/management/*`
   returns organisation-wide data for every Manager. Scoping it would be a
   new authorization rule, which the task explicitly forbids inventing. It is
   documented here instead.
2. **Self-service profile update** (`PATCH /api/auth/me`) and
   **admin password reset** — both absent; they are not among the six allowed
   change categories.
3. **Anonymous complaint tracking** — no endpoint exists; the Track page is
   therefore sign-in gated.
4. **Notification persistence**, **attachment upload**, and a **public
   knowledge-base read endpoint** — all absent.
5. Pre-existing issues found during the audit and deliberately left alone:
   `ml/models/*.pkl` missing while `ml/rule_engine.py` loads them at import;
   `requirements.txt` swallows `python-multipart` on its last line;
   `ml/schemas/complaint_result.json` is an example rather than a schema;
   `ml/validator.py` is never imported by `api/`; credentials committed in
   `New Text Document.txt`; `New` / `Reopened` statuses have no writer;
   five escalation rules are unreachable. None of these were introduced by
   this work and all of them sit in AI/ML or deployment territory.

---

## J. AI / RAG / ML was **not** modified

No file under `ml/` was changed, added or deleted — confirmed by
`git status`: every modified path is under `api/` or `frontend/`.

Specifically untouched: the AI provider and client (`ml/genai.py`), all
prompts (`ml/prompts/`), RAG / retrieval, knowledge-base ingestion, chunking,
embeddings, grounding and citations, the rule engine (`ml/rule_engine.py`),
the validator (`ml/validator.py`), sentiment, duplicate detection,
missing-information logic and the adversarial/security checks, and every
dataset in `ml/data/`.

The only interaction with that layer is read-only: the department registry is
**seeded from** `ml/data/departments.csv` so the admin UI shows the same
taxonomy the router already uses, and `POST /api/complaints` attaches the
priority and SLA window the rule engine *already computed* to the response so
the frontend can display them instead of inventing them. No prompt, model,
threshold or analysis path was altered.

---

### A note on how completeness was judged

No screen is claimed as "done" because a UI exists. For every claim above,
the value shown in the browser was traced to the endpoint that returns it and,
where behaviour is involved, to a test that asserts the **persisted** MongoDB
document. Where the backend has no data, the UI now says *Not available* or
shows an empty state that explains why — it never fills the gap with a
plausible-looking value.
