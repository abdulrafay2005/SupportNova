import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { useData } from "@/context/DataContext";
import { cn } from "@/utils/cn";

export function RulesAdmin() {
  const { rules, toggleRule } = useData();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter((r) =>
      `${r.id} ${r.category} ${r.subcategory} ${r.condition} ${r.department} ${r.policy}`.toLowerCase().includes(q),
    );
  }, [rules, query]);

  return (
    <div>
      <PageHeader
        title="Complaint resolution rules"
        description="Display of the rule matrix used for routing and escalation. Rules are not executed in this build."
      />
      <div className="mb-3 max-w-sm">
        <SearchBar value={query} onChange={setQuery} placeholder="Search rule, category, department..." />
      </div>
      <div className="panel hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase tracking-wide text-ink-muted">
                <th className="px-3 py-2 font-medium">Rule ID</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Subcategory</th>
                <th className="px-3 py-2 font-medium">Condition</th>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 font-medium">Urgency</th>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium">Policy</th>
                <th className="px-3 py-2 font-medium">Escalation</th>
                <th className="px-3 py-2 font-medium">Follow-up</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-canvas-subtle">
                  <td className="px-3 py-2 font-mono text-[12px]">{r.id}</td>
                  <td className="px-3 py-2">{r.category}</td>
                  <td className="px-3 py-2">{r.subcategory}</td>
                  <td className="max-w-[200px] px-3 py-2 text-ink-secondary">{r.condition}</td>
                  <td className="px-3 py-2">{r.department}</td>
                  <td className="px-3 py-2">{r.urgency}</td>
                  <td className="px-3 py-2">{r.priority}</td>
                  <td className="px-3 py-2 font-mono text-[12px]">{r.policy}</td>
                  <td className="px-3 py-2 text-ink-secondary">{r.escalation}</td>
                  <td className="px-3 py-2 text-ink-secondary">{r.followUp}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleRule(r.id)}
                      className={cn(
                        "rounded border px-1.5 py-px text-[11px] font-medium",
                        r.status === "Active"
                          ? "border-success-muted bg-success-subtle text-success"
                          : "border-line bg-canvas text-ink-muted",
                      )}
                    >
                      {r.status}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="space-y-2 md:hidden">
        {filtered.map((r) => (
          <div key={r.id} className="panel p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[11px] text-ink-faint">{r.id}</p>
                <p className="text-[13px] font-medium text-ink">
                  {r.category} · {r.subcategory}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleRule(r.id)}
                className={cn(
                  "rounded border px-1.5 py-px text-[11px] font-medium",
                  r.status === "Active"
                    ? "border-success-muted bg-success-subtle text-success"
                    : "border-line bg-canvas text-ink-muted",
                )}
              >
                {r.status}
              </button>
            </div>
            <p className="mt-2 text-[12px] text-ink-secondary">{r.condition}</p>
            <p className="mt-1 text-[12px] text-ink-muted">
              {r.department} · {r.escalation}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
