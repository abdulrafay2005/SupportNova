import { useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { Select } from "@/components/Select";
import { useAuth } from "@/auth/AuthContext";
import { formatDate, formatRelative } from "@/utils/dates";
import type { User } from "@/types";
import { cn } from "@/utils/cn";

export function UsersAdmin() {
  const { users } = useAuth();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [selected, setSelected] = useState<User | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (role && u.role !== role) return false;
      if (!q) return true;
      return `${u.name} ${u.email} ${u.department ?? ""}`.toLowerCase().includes(q);
    });
  }, [users, query, role]);

  return (
    <div>
      <PageHeader title="Users" description="Staff and customer accounts. Access control is enforced on the server when authentication is connected." />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <SearchBar value={query} onChange={setQuery} placeholder="Search name or email..." className="sm:max-w-sm" />
        <Select
          options={[
            { value: "Customer", label: "Customer" },
            { value: "Agent", label: "Agent" },
            { value: "Admin", label: "Admin" },
          ]}
          placeholder="All roles"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="sm:w-40"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No users found" description="No accounts match the current search." />
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
                    <th className="px-3 py-2 font-medium">Last active</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                    <th className="px-3 py-2 font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className="border-b border-line last:border-0 hover:bg-canvas-subtle">
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <Avatar name={u.name} size="sm" />
                          <span>
                            <span className="block font-medium text-ink">{u.name}</span>
                            <span className="block text-[12px] text-ink-muted">{u.department ?? "—"}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-ink-secondary">{u.email}</td>
                      <td className="px-3 py-2">{u.role}</td>
                      <td className="px-3 py-2">
                        <span className={cn("text-[12px]", u.status === "Active" ? "text-success" : "text-ink-muted")}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[12px] text-ink-muted">{formatRelative(u.lastActive)}</td>
                      <td className="px-3 py-2 text-[12px] text-ink-muted">{formatDate(u.createdAt)}</td>
                      <td className="px-3 py-2">
                        <button type="button" className="text-[12px] font-medium text-primary hover:underline" onClick={() => setSelected(u)}>
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
                <Avatar name={u.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{u.name}</span>
                  <span className="block truncate text-[12px] text-ink-muted">
                    {u.role} · {u.email}
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
          <Button variant="outline" onClick={() => setSelected(null)}>
            Close
          </Button>
        }
      >
        {selected && (
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Name</dt>
              <dd className="font-medium">{selected.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Email</dt>
              <dd>{selected.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Role</dt>
              <dd>{selected.role}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Status</dt>
              <dd>{selected.status}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Department</dt>
              <dd>{selected.department ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Created</dt>
              <dd>{formatDate(selected.createdAt)}</dd>
            </div>
          </dl>
        )}
      </Modal>
    </div>
  );
}
