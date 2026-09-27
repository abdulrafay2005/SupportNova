import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { Select } from "@/components/Select";
import { StatCard } from "@/components/StatCard";
import {
  createDepartment,
  getDepartmentStaff,
  getDepartments,
  updateDepartment,
  type Department,
  type DepartmentStaffMember,
} from "@/api/management";
import { cn } from "@/utils/cn";

const STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

function detailOf(error: unknown, fallback: string) {
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string } | undefined;
    if (first?.msg) return first.msg;
  }

  return fallback;
}

export function DepartmentsAdmin() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [routingSize, setRoutingSize] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Department | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState("Active");
  const [editError, setEditError] = useState<string | null>(null);

  const [staff, setStaff] = useState<DepartmentStaffMember[] | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await getDepartments();
      setDepartments(response.departments);
      setRoutingSize(response.routing_taxonomy_size);
      setError(null);
    } catch (e: unknown) {
      setError(detailOf(e, "Unable to load departments."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return departments;

    return departments.filter((d) =>
      `${d.name} ${d.code ?? ""} ${d.description}`.toLowerCase().includes(q),
    );
  }, [departments, query]);

  const totals = useMemo(
    () => ({
      active: departments.filter((d) => d.status === "Active").length,
      agents: departments.reduce((sum, d) => sum + d.agent_count, 0),
      unstaffed: departments.filter(
        (d) => d.status === "Active" && d.active_agent_count === 0,
      ).length,
    }),
    [departments],
  );

  async function openDepartment(department: Department) {
    setSelected(department);
    setEditName(department.name);
    setEditDescription(department.description);
    setEditStatus(department.status);
    setEditError(null);
    setStaff(null);
    setStaffError(null);
    setStaffLoading(true);

    try {
      const response = await getDepartmentStaff(department.name);
      setStaff(response.staff);
    } catch (e: unknown) {
      setStaffError(detailOf(e, "Unable to load the department roster."));
    } finally {
      setStaffLoading(false);
    }
  }

  async function submitCreate() {
    setCreateError(null);

    if (newName.trim().length < 2) {
      setCreateError("Department name must be at least 2 characters.");
      return;
    }

    setSaving(true);

    try {
      const created = await createDepartment({
        name: newName.trim(),
        description: newDescription.trim(),
      });

      setNotice(`${created.name} was created.`);
      setCreateOpen(false);
      setNewName("");
      setNewDescription("");
      await load();
    } catch (e: unknown) {
      setCreateError(detailOf(e, "Unable to create the department."));
    } finally {
      setSaving(false);
    }
  }

  async function submitEdit() {
    if (!selected) return;

    setEditError(null);
    setSaving(true);

    try {
      const payload: {
        name?: string;
        description?: string;
        status?: string;
      } = {};

      if (editName.trim() !== selected.name) payload.name = editName.trim();
      if (editDescription !== selected.description) {
        payload.description = editDescription;
      }
      if (editStatus !== selected.status) payload.status = editStatus;

      if (Object.keys(payload).length === 0) {
        setSelected(null);
        return;
      }

      const updated = await updateDepartment(selected.id, payload);

      setNotice(`${updated.name} was updated.`);
      setSelected(null);
      await load();
    } catch (e: unknown) {
      setEditError(detailOf(e, "Unable to update the department."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Departments are the routing targets the complaint classifier emits. Agents belong to a department and complaints are assigned to agents inside the matching department."
        actions={
          <Button
            onClick={() => {
              setCreateOpen(true);
              setCreateError(null);
            }}
          >
            New department
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Departments" value={departments.length} />
        <StatCard label="Active" value={totals.active} tone="success" />
        <StatCard label="Agents assigned" value={totals.agents} />
        <StatCard
          label="Without active agents"
          value={totals.unstaffed}
          tone={totals.unstaffed > 0 ? "warning" : "default"}
          hint="Complaints routed here cannot be auto-assigned"
        />
      </div>

      <div className="mb-3">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search departments..."
          className="sm:max-w-sm"
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
        <p className="text-[13px] text-ink-muted">Loading departments…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 size={18} />}
          title="No departments"
          description={
            query
              ? "No departments match your search."
              : "No departments have been registered yet. Create one to start routing complaints."
          }
        />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase tracking-wide text-ink-muted">
                  <th className="px-3 py-2 font-medium">Department</th>
                  <th className="px-3 py-2 font-medium">Responsibility</th>
                  <th className="px-3 py-2 font-medium">Agents</th>
                  <th className="px-3 py-2 font-medium">Managers</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-line last:border-0 hover:bg-canvas-subtle"
                  >
                    <td className="px-3 py-2">
                      <span className="block font-medium text-ink">
                        {d.name}
                      </span>
                      <span className="block text-[11px] text-ink-faint">
                        {d.code ? `${d.code} · ` : ""}
                        {d.source === "system"
                          ? "Routing taxonomy"
                          : "Custom"}
                      </span>
                    </td>
                    <td className="max-w-md px-3 py-2 text-ink-secondary">
                      {d.description || (
                        <span className="text-ink-faint">Not available</span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular">
                      {d.active_agent_count}
                      <span className="text-ink-faint">
                        {" / "}
                        {d.agent_count}
                      </span>
                      {d.status === "Active" && d.active_agent_count === 0 && (
                        <span className="ml-2 text-[11px] text-warning">
                          none available
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular">{d.manager_count}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "text-[12px]",
                          d.status === "Active"
                            ? "text-success"
                            : "text-ink-muted",
                        )}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-[12px] font-medium text-primary hover:underline"
                        onClick={() => void openDepartment(d)}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {routingSize > 0 && (
        <p className="mt-3 text-[12px] text-ink-faint">
          {routingSize} departments are defined in the classification routing
          taxonomy and are seeded automatically. Their names are fixed because
          the rule engine routes to those exact strings.
        </p>
      )}

      {/* ===================== CREATE ===================== */}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New department"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={() => void submitCreate()} disabled={saving}>
              {saving ? "Creating…" : "Create department"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {createError && (
            <p className="rounded border border-danger/30 p-2 text-[12px] text-danger">
              {createError}
            </p>
          )}

          <Input
            label="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />

          <Input
            label="Responsibility"
            value={newDescription}
            hint="Shown to administrators; optional."
            onChange={(e) => setNewDescription(e.target.value)}
          />

          <p className="rounded border border-line bg-canvas-subtle p-2 text-[12px] text-ink-secondary">
            Automatic routing sends a complaint to the department the
            classifier returns. A custom department only receives complaints
            that are reassigned to it manually.
          </p>
        </div>
      </Modal>

      {/* ===================== MANAGE ===================== */}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? "Department"}
        wide
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setSelected(null)}
              disabled={saving}
            >
              Close
            </Button>
            <Button onClick={() => void submitEdit()} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            {editError && (
              <p className="rounded border border-danger/30 p-2 text-[12px] text-danger">
                {editError}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Name"
                value={editName}
                disabled={selected.source === "system"}
                hint={
                  selected.source === "system"
                    ? "Routing departments cannot be renamed."
                    : undefined
                }
                onChange={(e) => setEditName(e.target.value)}
              />

              <Select
                label="Status"
                options={STATUS_OPTIONS}
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
              />
            </div>

            <Input
              label="Responsibility"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />

            <p className="text-[12px] text-ink-muted">
              Deactivating a department does not move existing staff or
              complaints. It only prevents new staff from being assigned to
              it.
            </p>

            <div>
              <h3 className="mb-2 text-[13px] font-semibold text-ink">
                Staff in this department
              </h3>

              {staffLoading ? (
                <p className="text-[12px] text-ink-muted">Loading roster…</p>
              ) : staffError ? (
                <p className="text-[12px] text-danger">{staffError}</p>
              ) : !staff || staff.length === 0 ? (
                <p className="rounded border border-line bg-canvas-subtle p-3 text-[12px] text-ink-secondary">
                  No staff are assigned to this department. Complaints routed
                  here cannot be auto-assigned until an active agent is added.
                </p>
              ) : (
                <ul className="divide-y divide-line rounded border border-line">
                  {staff.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">
                          {member.name ?? "—"}
                        </span>
                        <span className="block truncate text-[11px] text-ink-muted">
                          {member.email ?? "—"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[12px] text-ink-secondary">
                          {member.role ?? "—"}
                        </span>
                        <span
                          className={cn(
                            "block text-[11px]",
                            member.status === "Active"
                              ? "text-success"
                              : "text-ink-muted",
                          )}
                        >
                          {member.status ?? "—"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
