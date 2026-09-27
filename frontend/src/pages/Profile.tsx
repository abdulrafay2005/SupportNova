import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { NotAvailable } from "@/components/NotAvailable";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/auth/AuthContext";
import { useData } from "@/context/DataContext";
import { getAdminAuditLogs, type AuditLogRow } from "@/api/management";
import { formatDate, formatRelative } from "@/utils/dates";

export function Profile() {
  const { user } = useAuth();
  const { complaints } = useData();
  const [myLogs, setMyLogs] = useState<AuditLogRow[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);

  /*
   * Recent actions come from the real audit trail. Only the
   * Admin role is authorised to read GET /api/admin/audit, so
   * other roles are told the trail is not exposed to them
   * rather than being shown invented activity.
   */
  const canReadAudit = user?.role === "Admin";
  const userId = user?.id;

  useEffect(() => {
    if (!canReadAudit || !userId) return;
    let active = true;

    getAdminAuditLogs({ actor_id: userId, limit: 6 })
      .then((data) => {
        if (active) setMyLogs(data.logs);
      })
      .catch(() => {
        if (active) setLogsError("Unable to load your audit trail.");
      });

    return () => {
      active = false;
    };
  }, [canReadAudit, userId]);

  if (!user) return null;

  const assigned = complaints.filter((c) => c.assigneeId === user.id);
  const submitted = complaints.filter((c) => c.customerId === user.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Profile" description="Your account details in this workspace." />
      <section className="panel p-5">
        <div className="flex items-start gap-4">
          <Avatar name={user.name} size="lg" />
          <div>
            <h2 className="text-base font-semibold text-ink">{user.name}</h2>
            <p className="text-[13px] text-ink-muted">{user.email}</p>
            <p className="mt-1 text-[13px] text-ink-secondary">
              {user.role}
              {user.department ? ` · ${user.department}` : ""}
              {user.status ? ` · ${user.status}` : ""}
            </p>
          </div>
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2 text-[13px]">
          <div className="rounded-md border border-line px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Member since</dt>
            <dd className="mt-0.5 font-medium">
              {user.createdAt ? formatDate(user.createdAt) : <NotAvailable />}
            </dd>
          </div>
          <div className="rounded-md border border-line px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Department</dt>
            <dd className="mt-0.5 font-medium">
              {user.department ?? (
                <NotAvailable
                  label={
                    user.role === "Customer" || user.role === "Reviewer" || user.role === "Admin"
                      ? "Not department bound"
                      : "Not assigned"
                  }
                />
              )}
            </dd>
          </div>
          {user.phone && (
            <div className="rounded-md border border-line px-3 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Phone</dt>
              <dd className="mt-0.5 font-medium">{user.phone}</dd>
            </div>
          )}
          {user.role !== "Customer" && (
            <div className="rounded-md border border-line px-3 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Assigned complaints</dt>
              <dd className="mt-0.5 font-medium">{assigned.length}</dd>
            </div>
          )}
          {user.role === "Customer" && (
            <div className="rounded-md border border-line px-3 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Submitted complaints</dt>
              <dd className="mt-0.5 font-medium">{submitted.length}</dd>
            </div>
          )}
        </dl>
      </section>

      {user.role !== "Customer" && (
        <section className="mt-4 panel p-4">
          <h2 className="mb-2 text-[13px] font-semibold text-ink">Recent actions</h2>
          {!canReadAudit ? (
            <p className="text-[13px] text-ink-muted">
              The audit trail is only readable by administrators, so your own
              recorded actions are not shown here.
            </p>
          ) : logsError ? (
            <p className="text-[13px] text-danger">{logsError}</p>
          ) : myLogs.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No recorded actions yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {myLogs.map((l) => (
                <li key={l.id} className="py-2">
                  <p className="text-[13px] text-ink">
                    {l.action}{" "}
                    <span className="font-mono text-[12px] text-ink-muted">
                      {l.entity_type}
                      {l.entity_id ? ` · ${l.entity_id}` : ""}
                    </span>
                  </p>
                  <p className="text-[12px] text-ink-muted">
                    {l.created_at ? formatRelative(l.created_at) : "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
