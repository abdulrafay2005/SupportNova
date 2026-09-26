# Frontend Integration Audit

Evidence-based audit after the current pass.

| Frontend feature | Backend endpoint | Real API connected | Mock removed | Authenticated | Tested |
|---|---|---:|---:|---:|---:|
| Login/register/me | `/api/auth/login`, `/api/auth/register`, `/api/auth/me` | Yes | Yes | Yes | Build only |
| Customer complaint create | `POST /api/complaints` | Yes | Yes | Yes | Build only |
| Customer complaint list | `GET /api/complaints` | Yes | Yes | Yes | Build only |
| Complaint analysis | `GET /api/complaints/{id}/analysis` | Yes | Yes | Yes | Build only |
| Knowledge-base upload | `POST /api/admin/knowledge-base/documents` | Yes | Yes | Yes | Build only |
| Knowledge-base document list | `GET /api/admin/knowledge-base/documents` | Yes | Yes | Yes | Build only |
| Knowledge-base search API | `GET /api/knowledge-base/search` | API only | N/A | Yes | Not surfaced in a page |
| Agent queue/actions | `/api/agent/*`, `/api/agent/queue` | API exists, page not fully wired | No | Backend yes | Not live-tested |
| Reviewer queue/actions | `/api/review/*`, `/api/review/queue` | API exists, page actions remain local | No | Backend yes | Not live-tested |
| Manager analytics | `/api/management/analytics` | API exists, page uses seed analytics | No | Yes | Not live-tested |
| Reports | `/api/management/reports` | API exists, page uses seed report definitions/placeholders | No | Yes | Not live-tested |
| Admin users | `/api/admin/users` | API helper exists, page still uses AuthContext users | No | Yes | Not live-tested |
| Audit logs | `/api/admin/audit` | API helper exists, page still uses DataContext seed logs | No | Yes | Not live-tested |

The frontend production build passing does not constitute live API verification. MongoDB-backed workflows remain environment-dependent.
