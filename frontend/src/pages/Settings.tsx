import { FormEvent, useState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/auth/AuthContext";

export function Settings() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saved, setSaved] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [queueAlerts, setQueueAlerts] = useState(true);
  const [weekly, setWeekly] = useState(false);

  if (!user) return null;

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    updateProfile({ name: name.trim() || user.name, phone: phone.trim() || undefined });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" description="Profile details and notification preferences for this workspace." />

      <form onSubmit={onSave} className="panel space-y-3 p-4">
        <h2 className="text-[13px] font-semibold text-ink">Profile</h2>
        <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Email" value={user.email} disabled hint="Email changes will require verification when authentication is connected." />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm">
            Save profile
          </Button>
          {saved && <span className="text-[13px] text-success">Saved</span>}
        </div>
      </form>

      <section className="panel mt-4 p-4">
        <h2 className="text-[13px] font-semibold text-ink">Notifications</h2>
        <p className="mb-3 text-[12px] text-ink-muted">Preferences are stored in this browser only.</p>
        <label className="flex items-start gap-2 py-2 text-[13px]">
          <input type="checkbox" className="mt-0.5" checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} />
          <span>
            <span className="font-medium text-ink">Email on new replies</span>
            <span className="block text-[12px] text-ink-muted">Send a message when a complaint you follow is updated.</span>
          </span>
        </label>
        {user.role !== "Customer" && (
          <label className="flex items-start gap-2 py-2 text-[13px]">
            <input type="checkbox" className="mt-0.5" checked={queueAlerts} onChange={(e) => setQueueAlerts(e.target.checked)} />
            <span>
              <span className="font-medium text-ink">Queue assignments</span>
              <span className="block text-[12px] text-ink-muted">Notify me when a complaint is assigned to me.</span>
            </span>
          </label>
        )}
        <label className="flex items-start gap-2 py-2 text-[13px]">
          <input type="checkbox" className="mt-0.5" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} />
          <span>
            <span className="font-medium text-ink">Weekly summary</span>
            <span className="block text-[12px] text-ink-muted">A digest of open complaints every Monday.</span>
          </span>
        </label>
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
            <dd>{user.department ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Authentication</dt>
            <dd className="text-ink-muted">Prepared for JWT · not connected</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
