# Frontend Integration Audit

Evidence-based audit after the current pass.

| Frontend feature | Backend endpoint | Status | Mock removed | Authenticated | Tested |
|---|---|---|---:|---:|---:|
| Login/register/me | `/api/auth/login`, `/api/auth/register`, `/api/auth/me` | CONNECTED | Yes | Yes | Build only |
| Customer complaint create/list/analysis | `/api/complaints`, `/api/complaints/{id}/analysis` | CONNECTED | Yes | Yes | Build only |
| Agent queue | `GET /api/agent/queue` | CONNECTED | Yes | Yes | Build only |
| Agent start/await/resolve/escalate/comment | `POST /api/agent/{id}/*` | PARTIALLY CONNECTED | No | Backend yes | Not live-tested |
| Reviewer queue | `GET /api/review/queue` | CONNECTED | Yes | Yes | Build only |
| Reviewer approve/modify/reject/escalate/comment/regenerate | `POST /api/review/{id}/*` | CONNECTED for common action UI | Yes | Yes | Build only; specialized payloads not exposed |
| Manager analytics | `/api/management/analytics` | PARTIALLY CONNECTED | No | Yes | Not live-tested |
| Manager reports | `/api/management/reports` | PARTIALLY CONNECTED | No | Yes | Not live-tested |
| Admin users | `/api/admin/users`, `/api/admin/users/{id}/status` | PARTIALLY CONNECTED | No | Yes | Not live-tested |
| Admin audit logs | `/api/admin/audit` | PARTIALLY CONNECTED | No | Yes | Not live-tested |
| Knowledge-base upload/list | `/api/admin/knowledge-base/documents` | CONNECTED | Yes | Yes | Build only |
| Knowledge-base search | `/api/knowledge-base/search` | PARTIALLY CONNECTED | N/A | Yes | API helper only; no page search UI |
| Complaint activity | `/api/complaints/{id}/activity` | NOT CONNECTED | No | Yes | Not tested |
| SLA | `/api/management/sla` | API helper only | No | Yes | Not tested |
| Duplicate/repeat | No dedicated backend route found | BACKEND NOT AVAILABLE | N/A | N/A | N/A |

The frontend production build passing does not constitute live API verification. MongoDB-backed workflows remain environment-dependent.
