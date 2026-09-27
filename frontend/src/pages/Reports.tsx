import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { PageHeader } from "@/components/PageHeader";
import { Select } from "@/components/Select";
import { StatCard } from "@/components/StatCard";
import {
  downloadReportCsv,
  getDepartmentPerformance,
  getReport,
  getReportCatalogue,
  type GeneratedReport,
  type ReportCatalogue,
  type ReportFilters,
} from "@/api/management";
import { formatDateTime } from "@/utils/dates";

function detailOf(error: unknown, fallback: string) {
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

function renderCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
  ) {
    return formatDateTime(value);
  }

  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);

  return String(value);
}

function summaryEntries(summary: Record<string, unknown>) {
  return Object.entries(summary).filter(
    ([, value]) => typeof value !== "object" || value === null,
  );
}

function distributionEntries(summary: Record<string, unknown>) {
  return Object.entries(summary).filter(
    ([, value]) =>
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value as Record<string, unknown>).length > 0,
  ) as Array<[string, Record<string, number>]>;
}

function humanise(key: string) {
  return key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function Reports() {
  const [catalogue, setCatalogue] = useState<ReportCatalogue | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [reportType, setReportType] = useState("complaint-analysis");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getReportCatalogue(), getDepartmentPerformance()])
      .then(([reportCatalogue, performance]) => {
        setCatalogue(reportCatalogue);
        setDepartments(
          performance.departments
            .map((row) => row.department)
            .filter((name) => name && name !== "Unassigned"),
        );
      })
      .catch((e) => setError(detailOf(e, "Unable to load reports.")));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getReport(reportType, filters)
      .then((data) => {
        if (cancelled) return;
        setReport(data);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(detailOf(e, "Unable to generate this report."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reportType, filters]);

  async function exportCsv() {
    setExporting(true);
    setNotice(null);

    try {
      const filename = await downloadReportCsv(reportType, filters);
      setNotice(`Downloaded ${filename}`);
    } catch (e: unknown) {
      setError(detailOf(e, "Unable to export this report."));
    } finally {
      setExporting(false);
    }
  }

  const unavailableFormats = catalogue?.export_formats_unavailable ?? [];

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Reports generated from stored complaint, analysis, review and audit data."
        actions={
          <Button onClick={() => void exportCsv()} loading={exporting}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          options={(catalogue?.reports ?? []).map((entry) => ({
            value: entry.report_type,
            label: entry.title,
          }))}
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          aria-label="Report type"
        />
        <Select
          options={departments.map((name) => ({
            value: name,
            label: name,
          }))}
          placeholder="All departments"
          value={filters.department ?? ""}
          onChange={(e) =>
            setFilters((current) => ({
              ...current,
              department: e.target.value || undefined,
            }))
          }
        />
        <Input
          type="date"
          value={filters.date_from ?? ""}
          onChange={(e) =>
            setFilters((current) => ({
              ...current,
              date_from: e.target.value || undefined,
            }))
          }
          aria-label="From date"
        />
        <Input
          type="date"
          value={filters.date_to ?? ""}
          onChange={(e) =>
            setFilters((current) => ({
              ...current,
              date_to: e.target.value || undefined,
            }))
          }
          aria-label="To date"
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

      {loading && !report ? (
        <p className="text-[13px] text-ink-muted">Generating report…</p>
      ) : !report ? (
        <EmptyState
          title="No report selected"
          description="Choose a report type to generate it from stored data."
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summaryEntries(report.summary)
              .slice(0, 8)
              .map(([key, value]) => (
                <StatCard
                  key={key}
                  label={humanise(key)}
                  value={
                    value === null || value === undefined
                      ? "—"
                      : String(value)
                  }
                />
              ))}
          </div>

          {distributionEntries(report.summary).length > 0 && (
            <div className="mb-4 grid gap-3 lg:grid-cols-3">
              {distributionEntries(report.summary).map(([key, value]) => (
                <div className="panel p-3" key={key}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    {humanise(key)}
                  </p>
                  <ul className="space-y-1 text-[12px]">
                    {Object.entries(value)
                      .slice(0, 8)
                      .map(([label, count]) => (
                        <li className="flex justify-between gap-3" key={label}>
                          <span className="truncate text-ink-muted">
                            {label}
                          </span>
                          <span className="tabular font-medium">
                            {renderCell(count)}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <div>
                <h2 className="text-[13px] font-semibold text-ink">
                  {report.title}
                </h2>
                <p className="text-[12px] text-ink-muted">
                  {report.row_count} row(s) · generated{" "}
                  {formatDateTime(report.generated_at)}
                </p>
              </div>
            </div>

            {report.rows.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-ink-muted">
                No records match this report and the selected filters.
              </p>
            ) : (
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full min-w-[720px] text-left text-[13px]">
                  <thead className="sticky top-0">
                    <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase tracking-wide text-ink-muted">
                      {report.columns.map((column) => (
                        <th className="px-3 py-2 font-medium" key={column.key}>
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row, index) => (
                      <tr
                        key={`${String(row.complaint_id ?? index)}-${index}`}
                        className="border-b border-line last:border-0"
                      >
                        {report.columns.map((column) => (
                          <td
                            className="max-w-[260px] truncate px-3 py-2"
                            key={column.key}
                            title={renderCell(row[column.key])}
                          >
                            {renderCell(row[column.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {report.unavailable.length > 0 && (
            <section className="panel mt-4 p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                Not available in this report
              </p>
              <ul className="space-y-1.5 text-[12px] text-ink-muted">
                {report.unavailable.map((item) => (
                  <li key={item.metric}>
                    <span className="font-medium text-ink-secondary">
                      {humanise(item.metric)}:
                    </span>{" "}
                    {item.reason}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {unavailableFormats.length > 0 && (
            <p className="mt-3 text-[11px] text-ink-faint">
              Export formats:{" "}
              {catalogue?.reports
                .find((entry) => entry.report_type === reportType)
                ?.export_formats.join(", ") ?? "csv"}
              .{" "}
              {unavailableFormats
                .map((item) => `${item.format.toUpperCase()}: ${item.reason}`)
                .join(" ")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
