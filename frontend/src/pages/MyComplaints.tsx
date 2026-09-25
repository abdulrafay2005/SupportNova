import { Link } from "react-router-dom";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/auth/AuthContext";
import { useData } from "@/context/DataContext";
import { formatDate, formatRelative } from "@/utils/dates";
import { workflowSteps } from "@/utils/classify";

export function MyComplaints() {
  const { user } = useAuth();
  const { complaints } = useData();
  if (!user) return null;
  const mine = complaints
    .filter((c) => c.customerId === user.id)
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));

  return (
    <div>
      <PageHeader
        title="My complaints"
        description="Status, department, and next step for each request you have submitted."
        actions={
          <Link to="/complaints/new">
            <Button>Submit a complaint</Button>
          </Link>
        }
      />
      {mine.length === 0 ? (
        <EmptyState
          title="No complaints yet"
          description="When you submit a complaint you will see its ID, status, and progress here."
          action={
            <Link to="/complaints/new">
              <Button>Submit a complaint</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {mine.map((c) => {
            const steps = workflowSteps(c.status, c.escalated);
            const next = steps.find((s) => !s.done)?.label ?? "Complete";
            return (
              <Link key={c.id} to={`/complaints/${c.id}`} className="panel block p-4 hover:border-line-strong">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-mono text-[12px] text-primary">{c.id}</p>
                    <p className="mt-0.5 text-[14px] font-medium text-ink">{c.subject}</p>
                    <p className="mt-1 text-[12px] text-ink-muted">
                      Submitted {formatDate(c.createdAt)} · {c.department} · Updated {formatRelative(c.updatedAt)}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <p className="mt-3 text-[12px] text-ink-secondary">
                  Next step: <span className="font-medium text-ink">{next}</span>
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
