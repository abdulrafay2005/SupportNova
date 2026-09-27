import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { Select } from "@/components/Select";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/auth/AuthContext";
import {
  STAFF_ROLES,
  createStaffUser,
  getAdminUserOverview,
  getAdminUsers,
  getDepartments,
  updateAdminUserStatus,
  updateStaffUser,
  type AdminUser,
  type Department,
  type StaffRole,
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

const STAFF_ROLE_OPTIONS = STAFF_ROLES.map((role) => ({
  value: role,
  label: role,
}));

/** Department rules enforced by the backend, mirrored for the form. */
const DEPARTMENT_REQUIRED: StaffRole[] = ["Agent"];
const DEPARTMENT_OPTIONAL: StaffRole[] = ["Manager"];

const ROLE_TONE: Record<string, string> = {
  Admin: "bg-danger-subtle text-danger",
  Manager: "bg-primary-subtle text-primary",
  Reviewer: "bg-warning-subtle text-warning",
  Agent: "bg-success-subtle text-success",
  Customer: "bg-canvas-subtle text-ink-secondary",
};

function RoleBadge({ role }: { role?: string | null }) {
  if (!role) return <span className="text-ink-muted">—</span>;

  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium",
        ROLE_TONE[role] ?? "bg-canvas-subtle text-ink-secondary",
      )}
    >
      {role}
    </span>
  );
}

function detailOf(error: unknown, fallback: string) {
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string; loc?: unknown[] } | undefined;
    if (first?.msg) {
      const field = Array.isArray(first.loc)
        ? String(first.loc[first.loc.length - 1])
        : "";
      return field ? `${field}: ${first.msg}` : first.msg;
    }
  }

  return fallback;
}

interface StaffFormState {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
  department: string;
  status: string;
}

const EMPTY_FORM: StaffFormState = {
  name: "",
  email: "",
  password: "",
  role: "Agent",
  department: "",
  status: "Active",
};

export function UsersAdmin() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [overview, setOverview] = useState<UserOverview | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<StaffFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<{
    name: string;
    role: StaffRole | "Customer";
    department: string;
    status: string;
  } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const params: Record<string, string> = {};
      if (role) params.role = role;
      if (status) params.status = status;

      const [userResponse, overviewResponse, departmentResponse] =
        await Promise.all([
          getAdminUsers(params),
          getAdminUserOverview(),
          getDepartments(),
        ]);

      setUsers(userResponse.users);
      setOverview(overviewResponse);
      setDepartments(departmentResponse.departments);
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

  const activeDepartmentOptions = useMemo(
    () =>
      departments
        .filter((d) => d.status === "Active")
        .map((d) => ({ value: d.name, label: d.name })),
    [departments],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return users;

    return users.filter((u) =>
      `${u.name ?? ""} ${u.email ?? ""} ${u.department ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [users, query]);

  const staffCount = useMemo(
    () =>
      (overview?.role_distribution.Agent ?? 0) +
      (overview?.role_distribution.Reviewer ?? 0) +
      (overview?.role_distribution.Manager ?? 0) +
      (overview?.role_distribution.Admin ?? 0),
    [overview],
  );

  function departmentRequirement(target: StaffRole | "Customer") {
    if (DEPARTMENT_REQUIRED.includes(target as StaffRole)) return "required";
    if (DEPARTMENT_OPTIONAL.includes(target as StaffRole)) return "optional";
    return "none";
  }

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

  function validateCreate(): boolean {
    const errors: Record<string, string> = {};

    if (form.name.trim().length < 2) {
      errors.name = "Enter the staff member's full name.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = "Enter a valid email address.";
    }

    if (form.password.length < 8) {
      errors.password = "Use at least 8 characters.";
    }

    if (
      departmentRequirement(form.role) === "required" &&
      !form.department
    ) {
      errors.department =
        "Agents must belong to a department: complaints are routed by department.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submitCreate() {
    setFormError(null);

    if (!validateCreate()) return;

    setSaving(true);

    try {
      const created = await createStaffUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        department:
          departmentRequirement(form.role) === "none"
            ? undefined
            : form.department || undefined,
        status: form.status,
      });

      setNotice(
        `${created.name} was created as ${created.role}${
          created.department ? ` in ${created.department}` : ""
        }.`,
      );
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setFieldErrors({});
      await load();
    } catch (e: unknown) {
      setFormError(detailOf(e, "Unable to create the staff account."));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(target: AdminUser) {
    setSelected(target);
    setEditError(null);
    setEditForm({
      name: target.name ?? "",
      role: (target.role as StaffRole) ?? "Agent",
      department: target.department ?? "",
      status: target.status ?? "Active",
    });
    setEditOpen(true);
  }

  async function submitEdit() {
    if (!selected || !editForm) return;

    setEditError(null);
    setSaving(true);

    try {
      const payload: {
        name?: string;
        role?: StaffRole;
        department?: string | null;
        status?: string;
      } = {};

      if (editForm.name.trim() !== (selected.name ?? "")) {
        payload.name = editForm.name.trim();
      }

      if (editForm.role !== selected.role) {
        payload.role = editForm.role as StaffRole;
      }

      const requirement = departmentRequirement(editForm.role);
      const nextDepartment =
        requirement === "none" ? "" : editForm.department;

      if (nextDepartment !== (selected.department ?? "")) {
        payload.department = nextDepartment;
      }

      if (editForm.status !== selected.status) {
        payload.status = editForm.status;
      }

      if (Object.keys(payload).length === 0) {
        setEditOpen(false);
        return;
      }

      const updated = await updateStaffUser(selected.id, payload);

      setNotice(`${updated.name ?? "Account"} was updated.`);
      setEditOpen(false);
      setSelected(null);
      await load();
    } catch (e: unknown) {
      setEditError(detailOf(e, "Unable to update the account."));
    } finally {
      setSaving(false);
    }
  }

  const isCustomer = selected?.role === "Customer";

  return (
    <div>
      <PageHeader
        title="Staff & users"
        description="Customers register themselves. Agent, Reviewer, Manager and Admin accounts are provisioned here and are enforced by the backend."
        actions={
          <Button onClick={() => { setCreateOpen(true); setFormError(null); }}>
            Add staff
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total users" value={overview?.total_users ?? 0} />
        <StatCard
          label="Staff accounts"
          value={staffCount}
          hint={`${overview?.role_distribution.Customer ?? 0} customers`}
        />
        <StatCard
          label="Active"
          value={overview?.status_distribution.Active ?? 0}
          tone="success"
          hint={`${overview?.status_distribution.Inactive ?? 0} inactive`}
        />
        <StatCard
          label="Agents"
          value={overview?.role_distribution.Agent ?? 0}
          hint={`${overview?.role_distribution.Reviewer ?? 0} reviewers · ${
            overview?.role_distribution.Manager ?? 0
          } managers · ${overview?.role_distribution.Admin ?? 0} admins`}
        />
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search name, email or department..."
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
              <table className="w-full min-w-[820px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase tracking-wide text-ink-muted">
                    <th className="px-3 py-2 font-medium">User</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Department</th>
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
                          <span className="block font-medium text-ink">
                            {u.name ?? "—"}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-ink-secondary">
                        {u.email ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-3 py-2 text-ink-secondary">
                        {u.department ?? (
                          <span className="text-ink-faint">
                            {u.role === "Agent" ? "Not assigned" : "—"}
                          </span>
                        )}
                      </td>
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
                          onClick={() => openEdit(u)}
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

          <div className="space-y-2 md:hidden">
            {filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => openEdit(u)}
                className="panel flex w-full items-center gap-3 p-3 text-left"
              >
                <Avatar name={u.name ?? "?"} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {u.name ?? "—"}
                  </span>
                  <span className="block truncate text-[12px] text-ink-muted">
                    {u.role ?? "—"}
                    {u.department ? ` · ${u.department}` : ""} · {u.email ?? "—"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ===================== CREATE STAFF ===================== */}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add staff account"
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
              {saving ? "Creating…" : "Create account"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="rounded border border-line bg-canvas-subtle p-2 text-[12px] text-ink-secondary">
            This creates a privileged account directly. Public registration
            can only create Customer accounts.
          </p>

          {formError && (
            <p className="rounded border border-danger/30 p-2 text-[12px] text-danger">
              {formError}
            </p>
          )}

          <Input
            label="Full name"
            value={form.name}
            error={fieldErrors.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <Input
            label="Email"
            type="email"
            value={form.email}
            error={fieldErrors.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <Input
            label="Temporary password"
            type="password"
            value={form.password}
            error={fieldErrors.password}
            hint="Minimum 8 characters. Stored only as a bcrypt hash."
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <Select
            label="Role"
            options={STAFF_ROLE_OPTIONS}
            value={form.role}
            onChange={(e) =>
              setForm({
                ...form,
                role: e.target.value as StaffRole,
                department:
                  departmentRequirement(e.target.value as StaffRole) === "none"
                    ? ""
                    : form.department,
              })
            }
          />

          {departmentRequirement(form.role) === "none" ? (
            <p className="text-[12px] text-ink-muted">
              {form.role} accounts work across all departments in this
              architecture, so no department is assigned.
            </p>
          ) : activeDepartmentOptions.length === 0 ? (
            <p className="rounded border border-warning/30 p-2 text-[12px] text-warning">
              No active departments exist yet. Create one in Departments
              before adding an agent.
            </p>
          ) : (
            <Select
              label={
                departmentRequirement(form.role) === "required"
                  ? "Department (required)"
                  : "Department (optional)"
              }
              options={activeDepartmentOptions}
              placeholder={
                departmentRequirement(form.role) === "required"
                  ? "Select a department"
                  : "No department"
              }
              value={form.department}
              error={fieldErrors.department}
              onChange={(e) =>
                setForm({ ...form, department: e.target.value })
              }
            />
          )}

          <Select
            label="Account status"
            options={STATUS_OPTIONS}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          />
        </div>
      </Modal>

      {/* ===================== MANAGE STAFF ===================== */}

      <Modal
        open={editOpen && Boolean(selected)}
        onClose={() => setEditOpen(false)}
        title={selected?.name ?? "Account"}
        footer={
          <>
            {selected && selected.id !== currentUser?.id && (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => void toggleStatus(selected)}
              >
                {selected.status === "Active" ? "Deactivate" : "Activate"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Close
            </Button>
            {!isCustomer && (
              <Button onClick={() => void submitEdit()} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            )}
          </>
        }
      >
        {selected && editForm && (
          <div className="space-y-3">
            {editError && (
              <p className="rounded border border-danger/30 p-2 text-[12px] text-danger">
                {editError}
              </p>
            )}

            <dl className="space-y-1 text-[13px]">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Email</dt>
                <dd>{selected.email ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Created</dt>
                <dd>
                  {selected.created_at
                    ? formatDate(selected.created_at)
                    : "—"}
                </dd>
              </div>
            </dl>

            {isCustomer ? (
              <p className="rounded border border-line bg-canvas-subtle p-2 text-[12px] text-ink-secondary">
                This is a self-registered customer account. Customer records
                are not edited here; only the account status can be changed.
              </p>
            ) : (
              <>
                <Input
                  label="Full name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />

                <Select
                  label="Role"
                  options={STAFF_ROLE_OPTIONS}
                  value={editForm.role}
                  disabled={selected.id === currentUser?.id}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      role: e.target.value as StaffRole,
                      department:
                        departmentRequirement(e.target.value as StaffRole) ===
                        "none"
                          ? ""
                          : editForm.department,
                    })
                  }
                />

                {departmentRequirement(editForm.role) === "none" ? (
                  <p className="text-[12px] text-ink-muted">
                    {editForm.role} accounts are not department bound.
                  </p>
                ) : (
                  <Select
                    label={
                      departmentRequirement(editForm.role) === "required"
                        ? "Department (required)"
                        : "Department (optional)"
                    }
                    options={activeDepartmentOptions}
                    placeholder={
                      departmentRequirement(editForm.role) === "required"
                        ? "Select a department"
                        : "No department"
                    }
                    value={editForm.department}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        department: e.target.value,
                      })
                    }
                  />
                )}

                <Select
                  label="Account status"
                  options={STATUS_OPTIONS}
                  value={editForm.status}
                  disabled={selected.id === currentUser?.id}
                  onChange={(e) =>
                    setEditForm({ ...editForm, status: e.target.value })
                  }
                />
              </>
            )}

            {selected.id === currentUser?.id && (
              <p className="text-[12px] text-ink-faint">
                You cannot change your own role or account status.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
