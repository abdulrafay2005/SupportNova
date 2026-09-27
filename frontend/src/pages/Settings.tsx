import { Input } from "@/components/Input";
import { NotAvailable } from "@/components/NotAvailable";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/auth/AuthContext";
import { formatDate } from "@/utils/dates";

/**
 * Settings
 *
 * Everything on this page is read from the authenticated session
 * (GET /api/auth/me).
 *
 * The API exposes no self-service profile update and no
 * notification-preference storage, so this page does not pretend to
 * save either. It states where each value can actually be changed
 * instead of showing a "Saved" confirmation for a write that never
 * reaches the server.
 */
export function Settings() {
  const { user } = useAuth();

  if (!user) return null;

  const isStaff = user.role !== "Customer";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Settings"
        description="Your account as it is stored on the server."
      />

      <section className="panel space-y-3 p-4">
        <div>
          <h2 className="text-[13px] font-semibold text-ink">Profile</h2>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            {isStaff
              ? "Staff records are maintained by an administrator in Staff & Users. There is no self-service profile update endpoint, so these fields are read-only here."
              : "There is no self-service profile update endpoint yet, so these details are read-only. Contact support to have them corrected."}
          </p>
        </div>

        <Input label="Display name" value={user.name} readOnly disabled />

        <Input
          label="Email"
          value={user.email}
          readOnly
          disabled
          hint="Used to sign in. Email changes are not supported by the API."
        />

        <Input
          label="Phone"
          value={user.phone ?? ""}
          readOnly
          disabled
          placeholder="Not on file"
        />
      </section>

      <section className="panel mt-4 p-4">
        <h2 className="text-[13px] font-semibold text-ink">Notifications</h2>
        <p className="mt-1 text-[13px] text-ink-secondary">
          The backend does not send email or push notifications and stores no
          delivery preferences, so there is nothing to configure here yet.
          In-app updates appear on your complaints and, for staff, in the
          queue you work from.
        </p>
      </section>

      <section className="panel mt-4 p-4">
        <h2 className="text-[13px] font-semibold text-ink">Workspace</h2>
        <dl className="mt-2 space-y-2 text-[13px]">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Role</dt>
            <dd className="font-medium">{user.role}</dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Department</dt>
            <dd className="font-medium">
              {user.department ?? (
                <NotAvailable
                  label={isStaff ? "Not assigned" : "Not department bound"}
                />
              )}
            </dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Account status</dt>
            <dd className="font-medium">
              {user.status ?? <NotAvailable />}
            </dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Member since</dt>
            <dd className="font-medium">
              {user.createdAt ? formatDate(user.createdAt) : <NotAvailable />}
            </dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Session</dt>
            <dd className="text-ink-secondary">
              Signed in with a JWT bearer token
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
