import { useState } from "react";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { useData } from "@/context/DataContext";

export function Reports() {
  const { reports } = useData();
  const [message, setMessage] = useState("");

  const exportAs = (title: string, format: string) => {
    setMessage(`${format} export for “${title}” will be available when report generation is connected.`);
  };

  return (
    <div>
      <PageHeader title="Reports" description="Report categories for this workspace. Export buttons are placeholders." />
      {message && <p className="mb-3 rounded-md border border-line bg-canvas-subtle px-3 py-2 text-[13px] text-ink-secondary">{message}</p>}
      <ul className="divide-y divide-line panel overflow-hidden">
        {reports.map((r) => (
          <li key={r.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[13px] font-medium text-ink">{r.title}</p>
              <p className="text-[12px] text-ink-muted">{r.category}</p>
              <p className="mt-1 text-[13px] text-ink-secondary">{r.description}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button variant="outline" size="sm" onClick={() => exportAs(r.title, "CSV")}>CSV</Button>
              <Button variant="outline" size="sm" onClick={() => exportAs(r.title, "PDF")}>PDF</Button>
              <Button variant="outline" size="sm" onClick={() => exportAs(r.title, "Excel")}>Excel</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
