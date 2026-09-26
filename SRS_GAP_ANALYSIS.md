# SupportNova SRS Gap Audit

Audited against the SRS requirements represented in the repository and the previous gap list. Statuses are evidence-based and do not count UI copy or seed data as implementation.

| Requirement | Status | Evidence | Verification / limitation |
|---|---|---|---|
| JWT authentication and password hashing | IMPLEMENTED | `api/auth.py`, `api/main.py` | Backend token/password implementation exists; live DB verification requires environment. |
| Backend role authorization | IMPLEMENTED | `api/main.py:require_roles` and endpoint dependencies | Role checks exist for customer, staff, reviewer, management, and admin actions. |
| Complaint submission and ownership | IMPLEMENTED | `api/main.py`, `api/schemas.py` | Customer-only submission and ownership checks exist. |
| Deterministic rule engine | IMPLEMENTED | `ml/rule_engine.py` | Runs before GenAI. |
| Independent ground-truth validation | IMPLEMENTED | `ml/validator.py`, `api/workflow_validation.py` | Independent validator is called; does not ask GenAI to validate itself. |
| Structured GenAI output and guards | PARTIALLY IMPLEMENTED | `ml/genai.py`, `ml/schema_validator.py`, `ml/ai_output_guard.py` | Implemented provider path and guards, but no live provider verification and no complete persisted comparison model. |
| Complaint frontend/backend integration | PARTIALLY IMPLEMENTED | `frontend/src/api/*`, `frontend/src/context/DataContext.tsx` | Auth/create/list/analysis are connected; several action and management surfaces remain local/mock. |
| Persistent login and expiration UX | PARTIALLY IMPLEMENTED | `frontend/src/auth/AuthContext.tsx`, `frontend/src/api/client.ts` | Storage and 401 cleanup exist; cross-tab and proactive expiry UX are not implemented. |
| Manual review and reviewer actions | PARTIALLY IMPLEMENTED | `api/review.py`, review routes, `frontend/src/pages/ManualReview.tsx` | Backend actions exist; frontend explicitly remains UI-only. |
| Status lifecycle, assignment, and audit | PARTIALLY IMPLEMENTED | `api/agent.py`, `api/assignment.py`, `api/audit.py` | Backend actions exist; context mutation paths are not all API-backed. |
| Analytics, trends, reports, search, filters, exports | PARTIALLY IMPLEMENTED | `api/management.py`, management routes, frontend pages | Backend data functions exist; frontend pages still use seed data and export integration is incomplete. |
| PDF/DOCX upload and parsing | PARTIALLY IMPLEMENTED | `api/main.py` knowledge-base routes, `ml/knowledge_base/processor.py`, `service.py` | Admin upload now validates MIME/type, parses, chunks, stores, and audits; live endpoint and optional parser dependency not verified. |
| Document metadata and source traceability | PARTIALLY IMPLEMENTED | `ml/knowledge_base/service.py` | Stores document ID, hash, filename, version, chunk and source references; policy-specific section/page extraction is not complete. |
| Versioning and superseded policies | PARTIALLY IMPLEMENTED | `api/main.py` upload route | Active same-title versions are superseded; effective/expiry applicability rules are not yet implemented. |
| Policy/SOP retrieval | PARTIALLY IMPLEMENTED | `api/main.py /api/knowledge-base/search`, `service.py` | Active-document chunk search exists; complaint resolution is not yet wired to this retrieval endpoint. |
| Unsupported promises, hallucination, contradiction, injection guards | PARTIALLY IMPLEMENTED | `ml/ai_output_guard.py`, rule engine, tests | Existing deterministic guards/tests exist; complete generated-claim provenance and live adversarial workflow are not verified. |
| AI retry/error fallback and prompt version tracking | PARTIALLY IMPLEMENTED | `ml/genai.py`, `ml/prompt_manager.py` | Fallback and metadata exist; retry policy and provider integration are not fully verified. |
| Duplicate/repeat/near-duplicate detection | PARTIALLY IMPLEMENTED | `ml`, complaint workflow | Some intelligence and tests exist, but no complete persisted duplicate lifecycle/API is evidenced. |
| Complaint history and SLA risk | PARTIALLY IMPLEMENTED | `api/management.py`, workflow fields | History/status fields and management SLA functions exist; complete persisted SLA timers/risk transitions are incomplete. |
| Missing information and clarification | IMPLEMENTED | `ml/rule_engine.py`, `ml/genai.py`, frontend mapping | Rule/AI output fields and frontend display mapping exist; live end-to-end verification remains pending. |
| Responsive frontend | IMPLEMENTED | `frontend/src`, successful production build | Build verified; browser visual review remains manual. |
| Admin user management and audit viewing | PARTIALLY IMPLEMENTED | Admin routes in `api/main.py`, `api/management.py`, frontend pages | Protected backend routes exist; frontend still has incomplete live integration. |

## Verification limitations

- No `.env` values were inspected or changed.
- MongoDB, JWT secret, and optional GenAI provider were unavailable for live API tests.
- `python-multipart`, `python-docx`, and `pypdf` were added to `requirements.txt` for the upload route but were not installed in this environment.
- No complete frontend integration/E2E test suite is configured.
- Existing frontend dependency audit reports two vulnerabilities; no broad dependency upgrade was applied.

## Current audited counts

22 requirement items: 7 IMPLEMENTED, 15 PARTIALLY IMPLEMENTED, 0 NOT IMPLEMENTED, 0 BLOCKED.

Percentages: **32% IMPLEMENTED / 68% PARTIAL / 0% NOT IMPLEMENTED / 0% BLOCKED** (rounded to whole percentages; counts are the source of truth).
