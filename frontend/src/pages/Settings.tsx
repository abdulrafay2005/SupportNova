import { FormEvent, useState } from "react";

import { Input } from "@/components/Input";
import { NotAvailable } from "@/components/NotAvailable";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";

import { useAuth } from "@/auth/AuthContext";
import { changePassword } from "@/api/auth";
import { formatDate } from "@/utils/dates";


export function Settings() {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [passwordLoading, setPasswordLoading] =
    useState(false);

  const [passwordError, setPasswordError] =
    useState<string | null>(null);

  const [passwordSuccess, setPasswordSuccess] =
    useState<string | null>(null);

  if (!user) return null;

  const isCustomer = user.role === "Customer";
  const isStaff = !isCustomer;

  async function handlePasswordChange(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8) {
      setPasswordError(
        "New password must be at least 8 characters.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(
        "New passwords do not match.",
      );
      return;
    }

    setPasswordLoading(true);

    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setPasswordSuccess(
        "Password changed successfully.",
      );
    } catch (error) {
      const detail = (
        error as {
          response?: {
            data?: {
              detail?: unknown;
            };
          };
        }
      )?.response?.data?.detail;

      setPasswordError(
        typeof detail === "string"
          ? detail
          : "Unable to change your password.",
      );
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Settings"
        description="Manage your account settings."
      />

      {/* -------------------------------------------------- */}
      {/* Profile                                             */}
      {/* -------------------------------------------------- */}

      <section className="panel space-y-3 p-4">
        <div>
          <h2 className="text-[13px] font-semibold text-ink">
            Profile
          </h2>

          <p className="mt-0.5 text-[12px] text-ink-muted">
            Your account information is read from the
            SupportNova server.
          </p>
        </div>

        <Input
          label="Display name"
          value={user.name}
          readOnly
          disabled
        />

        <Input
          label="Email"
          value={user.email}
          readOnly
          disabled
          hint="Used to sign in. Email changes are not supported."
        />

        <Input
          label="Phone"
          value={user.phone ?? ""}
          readOnly
          disabled
          placeholder="Not on file"
        />
      </section>

      {/* -------------------------------------------------- */}
      {/* Password                                            */}
      {/* -------------------------------------------------- */}

      <section className="panel mt-4 p-4">
        <div>
          <h2 className="text-[13px] font-semibold text-ink">
            Change password
          </h2>

          <p className="mt-0.5 text-[12px] text-ink-muted">
            Change the password for your current account.
          </p>
        </div>

        <form
          onSubmit={handlePasswordChange}
          className="mt-4 space-y-3"
        >
          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(event) =>
              setCurrentPassword(event.target.value)
            }
            autoComplete="current-password"
            required
          />

          <Input
            label="New password"
            type="password"
            value={newPassword}
            onChange={(event) =>
              setNewPassword(event.target.value)
            }
            autoComplete="new-password"
            minLength={8}
            required
            hint="Must be at least 8 characters."
          />

          <Input
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
            autoComplete="new-password"
            minLength={8}
            required
          />

          {passwordError && (
            <p className="rounded-md border border-danger/30 bg-danger/5 px-2.5 py-1.5 text-[12px] text-danger">
              {passwordError}
            </p>
          )}

          {passwordSuccess && (
            <p className="rounded-md border border-success/30 bg-success/5 px-2.5 py-1.5 text-[12px] text-success">
              {passwordSuccess}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={
                passwordLoading ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
            >
              {passwordLoading
                ? "Changing password…"
                : "Change password"}
            </Button>
          </div>
        </form>
      </section>

      {/* -------------------------------------------------- */}
      {/* Notifications                                       */}
      {/* -------------------------------------------------- */}

      <section className="panel mt-4 p-4">
        <h2 className="text-[13px] font-semibold text-ink">
          Notifications
        </h2>

        <p className="mt-1 text-[13px] text-ink-secondary">
          {isCustomer
            ? "SupportNova sends important account and complaint updates to your registered email address."
            : "Staff accounts do not receive the customer email notifications. Workflow activity is available through the staff workspace."}
        </p>
      </section>

      {/* -------------------------------------------------- */}
      {/* Workspace                                           */}
      {/* -------------------------------------------------- */}

      <section className="panel mt-4 p-4">
        <h2 className="text-[13px] font-semibold text-ink">
          Workspace
        </h2>

        <dl className="mt-2 space-y-2 text-[13px]">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">
              Role
            </dt>

            <dd className="font-medium">
              {user.role}
            </dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">
              Department
            </dt>

            <dd className="font-medium">
              {user.department ?? (
                <NotAvailable
                  label={
                    isStaff
                      ? "Not assigned"
                      : "Not department bound"
                  }
                />
              )}
            </dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">
              Account status
            </dt>

            <dd className="font-medium">
              {user.status ?? (
                <NotAvailable />
              )}
            </dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">
              Member since
            </dt>

            <dd className="font-medium">
              {user.createdAt ? (
                formatDate(user.createdAt)
              ) : (
                <NotAvailable />
              )}
            </dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">
              Session
            </dt>

            <dd className="text-ink-secondary">
              Signed in with a JWT bearer token
            </dd>
          </div>
        </dl>
      </section>

      {/* -------------------------------------------------- */}
      {/* Recovery                                            */}
      {/* -------------------------------------------------- */}

      {isCustomer && (
        <section className="panel mt-4 p-4">
          <h2 className="text-[13px] font-semibold text-ink">
            Password recovery
          </h2>

          <p className="mt-1 text-[13px] text-ink-secondary">
            Forgot your password? Use Forgot Password on
            the sign-in page to receive a secure reset link
            by email.
          </p>
        </section>
      )}
    </div>
  );
}