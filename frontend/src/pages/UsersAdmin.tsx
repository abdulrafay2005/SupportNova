import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { Select } from "@/components/Select";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/auth/AuthContext";
import {
  getAdminUserOverview,
  getAdminUsers,
  updateAdminUserStatus,
  type AdminUser,
  type UserOverview,
} from "@/api/management";
import { formatDate } from "@/utils/dates";
import { cn } from "@/utils/cn";

const ROLE_OPTIONS = [
  { value: "Customer", label: "Customer" },
  { value: "Agent", label: "Agent" },
  { value: "Reviewer", label: "Reviewer" },
  { value: "Manager", label: "Manager" },
  { value: "Admin", label: "Admin" },
];

const STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

function detailOf(error: unknown, fallback: string) {
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

export function UsersAdmin() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [overview, setOverview] = useState<UserOverview | null>(null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const params: Record<string, string> = {};
      if (role) params.role = role;
      if (status) params.status = status;

      const [userResponse, overviewResponse] = await Promise.all([
        getAdminUsers(params),
        getAdminUserOverview(),
      ]);

      setUsers(userResponse.users);
      setOverview(overviewResponse);
      setError(null);
    } catch (e: unknown) {
      setError(detailOf(e, "Unable to load users."));
    } finally {
      setLoading(false);
    }
  }, [role, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return users;

    return users.filter((u) =>
      `${u.name ?? ""} ${u.email ?? ""} ${u.department ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [users, query]);

  async function toggleStatus(target: AdminUser) {
    const next = target.status === "Active" ? "Inactive" : "Active";

    setSaving(true);
    setNotice(null);

    try {
      await updateAdminUserStatus(target.id, next);
      setNotice(`${target.name ?? target.email} is now ${next}.`);
      setSelected(null);
      await load();
    } catch (e: unknown) {
      setError(detailOf(e, "Unable to update the user status."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Staff and customer accounts stored in the backend. Role based access is enforced on the server."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total users" value={overview?.total_users ?? 0} />
        <StatCard
          label="Active"
          value={overview?.status_distribution.Active ?? 0}
          tone="success"
        />
        <StatCard
          label="Inactive"
          value={overview?.status_distribution.Inactive ?? 0}
          tone="warning"
        />
        <StatCard
          label="Agents"
          value={overview?.role_distribution.Agent ?? 0}
          hint={`${overview?.role_distribution.Reviewer ?? 0} reviewers · ${
            overview?.role_distribution.Manager ?? 0
          } managers`}
        />
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search name or email..."
          className="sm:max-w-sm"
        />
        <Select
          options={ROLE_OPTIONS}
          placeholder="All roles"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="sm:w-40"
        />
        <Select
          options={STATUS_OPTIONS}
          placeholder="All statuses"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="sm:w-40"
        />
      </div>

      {error && (
        <p className="mb-3 rounded border border-danger/30 p-3 text-[13px] text-danger">
          {error}
        </p>
      )}

      {notice && (
        <p className="mb-3 rounded border border-success/30 p-3 text-[13px] text-success">
          {notice}
        </p>
      )}

      {loading ? (
        <p className="text-[13px] text-ink-muted">Loading users…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No users found"
          description="No accounts match the current search or filters."
        />
      ) : (
        <>
          <div className="panel hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase tracking-wide text-ink-muted">
                    <th className="px-3 py-2 font-medium">User</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                    <th className="px-3 py-2 font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-line last:border-0 hover:bg-canvas-subtle"
                    >
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <Avatar name={u.name ?? "?"} size="sm" />
                          <span>
                            <span className="block font-medium text-ink">
                              {u.name ?? "—"}
                            </span>
                            <span className="block text-[12px] text-ink-muted">
                              {u.department ?? "—"}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-ink-secondary">
                        {u.email ?? "—"}
                      </td>
                      <td className="px-3 py-2">{u.role ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "text-[12px]",
                            u.status === "Active"
                              ? "text-success"
                              : "text-ink-muted",
                          )}
                        >
                          {u.status ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[12px] text-ink-muted">
                        {u.created_at ? formatDate(u.created_at) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-[12px] font-medium text-primary hover:underline"
                          onClick={() => setSelected(u)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2 md:hidden">
            {filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelected(u)}
                className="panel flex w-full items-center gap-3 p-3 text-left"
              >
                <Avatar name={u.name ?? "?"} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {u.name ?? "—"}
                  </span>
                  <span className="block truncate text-[12px] text-ink-muted">
                    {u.role ?? "—"} · {u.email ?? "—"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="User"
        footer={
          <>
            {selected && selected.id !== currentUser?.id && (
              <Button
                variant={selected.status === "Active" ? "outline" : "primary"}
                disabled={saving}
                onClick={() => void toggleStatus(selected)}
              >
                {selected.status === "Active" ? "Deactivate" : "Activate"}
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
          </>
        }
      >
        {selected && (
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Name</dt>
              <dd className="font-medium">{selected.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Email</dt>
              <dd>{selected.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Role</dt>
              <dd>{selected.role ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Status</dt>
              <dd>{selected.status ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Department</dt>
              <dd>{selected.department ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Created</dt>
              <dd>
                {selected.created_at ? formatDate(selected.created_at) : "—"}
              </dd>
            </div>
            {selected.id === currentUser?.id && (
              <p className="pt-2 text-[12px] text-ink-faint">
                You cannot change the status of your own account.
              </p>
            )}
          </dl>
        )}
      </Modal>
    </div>
  );
}
