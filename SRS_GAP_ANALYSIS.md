# SupportNova SRS Gap Audit

This audit is based on repository evidence at the time of review. It deliberately does not infer functionality from UI labels or mock data.

| Requirement | SRS area | Status | Evidence | Verification / notes |
|---|---|---|---|---|
| JWT authentication and password hashing | Authentication | IMPLEMENTED | `api/auth.py`, `api/main.py` | Token decode and bcrypt verification are implemented; requires configured MongoDB/JWT secret. |
| Role-based backend authorization | Authorization | IMPLEMENTED | `api/main.py` (`require_roles`) | Backend dependencies enforce roles; endpoint workflow still needs integration testing. |
| Complaint submission and ownership | Complaint flow | IMPLEMENTED | `api/main.py`, `api/schemas.py` | Customer-only create and customer ownership checks are present. |
| Deterministic rule engine | Two-pipeline | IMPLEMENTED | `ml/rule_engine.py` | Existing engine is used before AI. |
| Independent ground-truth validation | Two-pipeline | IMPLEMENTED | `ml/validator.py`, `api/workflow_validation.py` | Existing validator is called independently; test requires data dependencies. |
| GenAI structured output and guards | AI pipeline | PARTIALLY IMPLEMENTED | `ml/genai.py`, `ml/schema_validator.py`, `ml/ai_output_guard.py` | Provider and environment dependent; no live provider verification was possible here. |
| Complaint API/frontend integration | Integration | PARTIALLY IMPLEMENTED | `frontend/src/api/*`, `frontend/src/context/DataContext.tsx` | Auth, create, list, and analysis calls exist. Several dashboard/admin surfaces still use seed/mock data and local-only mutations. |
| Persistent login and expiry handling | Authentication | PARTIALLY IMPLEMENTED | `frontend/src/auth/AuthContext.tsx`, `frontend/src/api/client.ts` | Storage and 401 clearing exist; expiry UX and cross-tab synchronization are not verified. |
| Manual review and reviewer actions | Workflow | PARTIALLY IMPLEMENTED | `api/review.py`, `api/main.py`, `frontend/src/pages/ManualReview.tsx` | Backend routes exist; frontend action integration requires end-to-end verification. |
| Status updates, assignment, audit | Workflow | PARTIALLY IMPLEMENTED | `api/agent.py`, `api/assignment.py`, `api/audit.py` | Backend exists; frontend context currently contains local update paths. |
| Analytics, reports, exports | Management | PARTIALLY IMPLEMENTED | `api/management.py`, management routes, frontend pages | Backend routes exist; frontend pages retain mock/seed presentation in places. |
| PDF/DOCX upload, parsing, version traceability | Knowledge base | NOT IMPLEMENTED | No upload/parser API found in current repository | Existing static knowledge-base data is not evidence of upload processing. |
| Duplicate/repeat detection and SLA risk | Complaint intelligence | PARTIALLY IMPLEMENTED | `ml`, `api/management.py` | Some rule/workflow support exists; complete persisted detection lifecycle not verified. |
| Responsive frontend | Frontend | IMPLEMENTED | `frontend/src`, successful Vite build | Build passed; visual/manual browser review remains required. |
| Prompt versioning and injection protection | Security | PARTIALLY IMPLEMENTED | `ml/prompt_manager.py`, `ml/ai_output_guard.py`, `ml/rule_engine.py` | Versioning and guards exist; full adversarial test suite was not run in this environment. |

## Verification limitations
- No `.env` values were inspected or changed.
- MongoDB, JWT secret, and optional GenAI provider were not available for live API tests.
- The repository has no complete frontend integration test suite configured.
- `npm audit` reports 2 dependency vulnerabilities from the locked dependency tree; no automatic upgrade was applied to avoid unnecessary technology changes.
