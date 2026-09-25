import { useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { useData } from "@/context/DataContext";
import { formatDate } from "@/utils/dates";
import type { PolicyDocument } from "@/types";
import { cn } from "@/utils/cn";

const statusStyle: Record<PolicyDocument["status"], string> = {
  Active: "text-success",
  Previous: "text-ink-muted",
  Superseded: "text-warning",
  Draft: "text-ink-secondary",
};

export function Documents() {
  const { documents } = useData();
  const [view, setView] = useState<PolicyDocument | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const history = historyFor
    ? documents.filter((d) => d.title === documents.find((x) => x.id === historyFor)?.title)
    : [];

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Policy and SOP versions for this demo workspace. Upload does not send files anywhere."
        actions={
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            Upload document
          </Button>
        }
      />
      <div className="panel hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase tracking-wide text-ink-muted">
                <th className="px-3 py-2 font-medium">Document ID</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Version</th>
                <th className="px-3 py-2 font-medium">Effective</th>
                <th className="px-3 py-2 font-medium">Expiry</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Uploaded</th>
                <th className="px-3 py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className="border-b border-line last:border-0 hover:bg-canvas-subtle">
                  <td className="px-3 py-2 font-mono text-[12px]">{d.id}</td>
                  <td className="px-3 py-2">{d.title}</td>
                  <td className="px-3 py-2 text-ink-secondary">{d.category}</td>
                  <td className="px-3 py-2">{d.version}</td>
                  <td className="px-3 py-2 text-[12px] text-ink-muted">{formatDate(d.effectiveDate)}</td>
                  <td className="px-3 py-2 text-[12px] text-ink-muted">{d.expiryDate ? formatDate(d.expiryDate) : "—"}</td>
                  <td className={cn("px-3 py-2 text-[12px] font-medium", statusStyle[d.status])}>{d.status}</td>
                  <td className="px-3 py-2 text-[12px] text-ink-muted">{formatDate(d.uploadedAt)}</td>
                  <td className="px-3 py-2">
                    <button type="button" className="mr-2 text-[12px] font-medium text-primary hover:underline" onClick={() => setView(d)}>View</button>
                    <button type="button" className="text-[12px] text-ink-secondary hover:underline" onClick={() => setHistoryFor(d.id)}>History</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="space-y-2 md:hidden">
        {documents.map((d) => (
          <button key={d.id} type="button" className="panel w-full p-3 text-left" onClick={() => setView(d)}>
            <p className="font-mono text-[11px] text-ink-faint">{d.id}</p>
            <p className="text-[13px] font-medium">{d.title}</p>
            <p className="text-[12px] text-ink-muted">{d.category} · v{d.version} · {d.status}</p>
          </button>
        ))}
      </div>

      <Modal open={Boolean(view)} onClose={() => setView(null)} title="Document" footer={<Button variant="outline" onClick={() => setView(null)}>Close</Button>}>
        {view && (
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between gap-4"><dt className="text-ink-muted">ID</dt><dd className="font-mono">{view.id}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink-muted">Title</dt><dd>{view.title}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink-muted">Format</dt><dd>{view.format}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink-muted">Status</dt><dd>{view.status}</dd></div>
            <p className="text-[12px] text-ink-muted">File contents are not stored in this frontend demo.</p>
          </dl>
        )}
      </Modal>
      <Modal open={Boolean(historyFor)} onClose={() => setHistoryFor(null)} title="Version history" footer={<Button variant="outline" onClick={() => setHistoryFor(null)}>Close</Button>}>
        <ul className="space-y-2 text-[13px]">
          {history.map((d) => (
            <li key={d.id} className="flex justify-between border-b border-line pb-2">
              <span>v{d.version}</span>
              <span className="text-ink-muted">{d.status} · {formatDate(d.effectiveDate)}</span>
            </li>
          ))}
        </ul>
      </Modal>
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload document" footer={<Button variant="outline" onClick={() => setUploadOpen(false)}>Close</Button>}>
        <p className="text-[13px] text-ink-secondary">PDF and DOCX are supported when document storage is connected. No file is uploaded from this screen.</p>
        <label className="mt-3 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-line-strong px-3 py-6 text-[13px] text-ink-muted">
          Choose a PDF or DOCX
          <input type="file" accept=".pdf,.docx" className="sr-only" />
        </label>
      </Modal>
    </div>
  );
}
