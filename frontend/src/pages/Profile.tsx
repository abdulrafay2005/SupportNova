import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/auth/AuthContext";
import { useData } from "@/context/DataContext";
import { formatDate, formatRelative } from "@/utils/dates";

export function Profile() {
  const { user } = useAuth();
  const { complaints, auditLogs } = useData();
  if (!user) return null;

  const assigned = complaints.filter((c) => c.assigneeId === user.id);
  const submitted = complaints.filter((c) => c.customerId === user.id);
  const mineLogs = auditLogs.filter((l) => l.user === user.name).slice(0, 6);

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
              {" · "}
              {user.status}
            </p>
          </div>
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2 text-[13px]">
          <div className="rounded-md border border-line px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Last active</dt>
            <dd className="mt-0.5 font-medium">{formatRelative(user.lastActive)}</dd>
          </div>
          <div className="rounded-md border border-line px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Member since</dt>
            <dd className="mt-0.5 font-medium">{formatDate(user.createdAt)}</dd>
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
          {mineLogs.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No recorded actions yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {mineLogs.map((l) => (
                <li key={l.id} className="py-2">
                  <p className="text-[13px] text-ink">
                    {l.action} <span className="font-mono text-[12px] text-ink-muted">{l.resource}</span>
                  </p>
                  <p className="text-[12px] text-ink-muted">{formatRelative(l.timestamp)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
