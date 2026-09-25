import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { SearchBar } from "@/components/SearchBar";
import { Select } from "@/components/Select";
import { useData } from "@/context/DataContext";
import { formatDateTime } from "@/utils/dates";
import { cn } from "@/utils/cn";

const PAGE_SIZE = 10;

export function AuditLogs() {
  const { auditLogs } = useData();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return auditLogs.filter((l) => {
      if (result && l.result !== result) return false;
      if (!q) return true;
      return `${l.user} ${l.action} ${l.resource} ${l.details}`.toLowerCase().includes(q);
    });
  }, [auditLogs, query, result]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div>
      <PageHeader title="Audit logs" description="A record of administrative and case actions in this workspace." />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <SearchBar
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          placeholder="Search user, action, resource..."
          className="sm:max-w-sm"
        />
        <Select
          options={[
            { value: "Success", label: "Success" },
            { value: "Failed", label: "Failed" },
          ]}
          placeholder="All results"
          value={result}
          onChange={(e) => {
            setResult(e.target.value);
            setPage(1);
          }}
          className="sm:w-40"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No log entries" description="Nothing matches the current filters." />
      ) : (
        <>
          <div className="panel hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase tracking-wide text-ink-muted">
                    <th className="px-3 py-2 font-medium">Timestamp</th>
                    <th className="px-3 py-2 font-medium">User</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Resource</th>
                    <th className="px-3 py-2 font-medium">Result</th>
                    <th className="px-3 py-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((l) => (
                    <tr key={l.id} className="border-b border-line last:border-0 hover:bg-canvas-subtle">
                      <td className="whitespace-nowrap px-3 py-2 text-[12px] tabular text-ink-muted">{formatDateTime(l.timestamp)}</td>
                      <td className="px-3 py-2 text-ink">{l.user}</td>
                      <td className="px-3 py-2 text-ink-secondary">{l.action}</td>
                      <td className="px-3 py-2 font-mono text-[12px]">{l.resource}</td>
                      <td className="px-3 py-2">
                        <span className={cn("text-[12px] font-medium", l.result === "Success" ? "text-success" : "text-danger")}>
                          {l.result}
                        </span>
                      </td>
                      <td className="max-w-[280px] px-3 py-2 text-[12px] text-ink-muted">{l.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-2 md:hidden">
            {slice.map((l) => (
              <div key={l.id} className="panel p-3">
                <p className="text-[12px] text-ink-faint">{formatDateTime(l.timestamp)}</p>
                <p className="text-[13px] font-medium text-ink">{l.action}</p>
                <p className="text-[12px] text-ink-secondary">
                  {l.user} · {l.resource}
                </p>
                <p className="mt-1 text-[12px] text-ink-muted">{l.details}</p>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
