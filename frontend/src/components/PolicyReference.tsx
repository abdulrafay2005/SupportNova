import type { PolicyRef } from "@/types";

export function PolicyReference({ policy }: { policy?: PolicyRef }) {
  if (!policy) {
    return (
      <div className="panel p-4">
        <h3 className="text-[13px] font-semibold text-ink">Policy traceability</h3>
        <p className="mt-1 text-[13px] text-ink-muted">No policy document is attached to this complaint yet.</p>
      </div>
    );
  }

  const rows = [
    ["Policy ID", policy.id],
    ["Title", policy.title],
    ["Section", policy.section],
    ["Version", policy.version],
    ["Status", policy.status],
    ["Applicability", policy.applicability],
  ];

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-line px-4 py-2.5">
        <h3 className="text-[13px] font-semibold text-ink">Policy traceability</h3>
        <p className="text-[12px] text-ink-muted">Demo policy reference for this workspace. Not a live document store.</p>
      </div>
      <dl className="divide-y divide-line">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-4 py-2 text-[13px]">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="text-right font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {policy.source && (
        <p className="border-t border-line px-4 py-2 text-[12px] text-ink-muted">Source: {policy.source}</p>
      )}
    </div>
  );
}
