import { Link } from "react-router-dom";
import { Button } from "@/components/Button";
import { ComplaintTable } from "@/components/ComplaintTable";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/auth/AuthContext";
import { useData } from "@/context/DataContext";
import { OPEN_STATUSES } from "@/types";

export function MyQueue() {
  const { user } = useAuth();
  const { complaints, customers } = useData();
  if (!user) return null;

  const mine = complaints
    .filter((c) => c.assigneeId === user.id)
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  const open = mine.filter((c) => OPEN_STATUSES.includes(c.status));
  const escalated = open.filter((c) => c.escalated);
  const pending = open.filter((c) => c.status === "Awaiting Customer");

  return (
    <div>
      <PageHeader
        title="My queue"
        description={`Complaints assigned to ${user.name}${user.department ? ` · ${user.department}` : ""}.`}
        actions={
          <Link to="/complaints">
            <Button variant="outline">All complaints</Button>
          </Link>
        }
      />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label="Open assigned" value={open.length} tone="info" />
        <StatCard label="Awaiting customer" value={pending.length} tone="warning" />
        <StatCard label="Escalated" value={escalated.length} tone="danger" />
      </div>
      <ComplaintTable
        complaints={open}
        customers={customers}
        compact
        emptyTitle="Queue is clear"
        emptyDescription="There are no open complaints assigned to you."
      />
    </div>
  );
}
