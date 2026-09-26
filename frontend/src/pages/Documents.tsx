import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { listKnowledgeDocuments, uploadKnowledgeDocument, type KnowledgeDocument } from "@/api/knowledgeBase";
import { formatDate } from "@/utils/dates";

export function Documents() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [selected, setSelected] = useState<KnowledgeDocument | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try { setDocuments(await listKnowledgeDocuments()); setError(null); }
    catch (e: any) { setError(e?.response?.data?.detail ?? "Unable to load knowledge-base documents."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function submitUpload() {
    if (!file || !version.trim()) { setError("Choose a PDF or DOCX file and provide a version."); return; }
    setSaving(true); setError(null);
    try { await uploadKnowledgeDocument(file, version.trim()); setUploadOpen(false); setFile(null); setVersion(""); await refresh(); }
    catch (e: any) { setError(e?.response?.data?.detail ?? "Document upload failed."); }
    finally { setSaving(false); }
  }

  return <div>
    <PageHeader title="Documents" description="Live policy and SOP documents from the SupportNova knowledge base." actions={<Button size="sm" onClick={() => setUploadOpen(true)}>Upload document</Button>} />
    {error && <p className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">{error}</p>}
    {loading ? <p className="text-[13px] text-ink-muted">Loading documents…</p> : documents.length === 0 ? <EmptyState title="No documents" description="No validated documents are available in the backend knowledge base." /> :
      <div className="panel overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[13px]"><thead><tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase text-ink-muted"><th className="px-3 py-2">Document ID</th><th className="px-3 py-2">Title</th><th className="px-3 py-2">Version</th><th className="px-3 py-2">Format</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Uploaded</th></tr></thead><tbody>{documents.map((d) => <tr key={d.document_id} className="border-b border-line last:border-0 hover:bg-canvas-subtle"><td className="px-3 py-2 font-mono text-[12px]"><button className="text-primary hover:underline" onClick={() => setSelected(d)}>{d.document_id}</button></td><td className="px-3 py-2">{d.title}</td><td className="px-3 py-2">{d.version}</td><td className="px-3 py-2 uppercase">{d.extension.replace(".", "")}</td><td className="px-3 py-2">{d.status}</td><td className="px-3 py-2 text-ink-muted">{formatDate(d.uploaded_at)}</td></tr>)}</tbody></table></div>}
    <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload policy or SOP" footer={<><Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button><Button disabled={saving} onClick={() => void submitUpload()}>{saving ? "Uploading…" : "Upload"}</Button></>}><div className="space-y-3"><label className="block text-[13px] font-medium">File<input className="mt-1 block w-full text-[13px]" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label><Input label="Version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g. 2.1" /></div></Modal>
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Document metadata" footer={<Button variant="outline" onClick={() => setSelected(null)}>Close</Button>}>{selected && <dl className="space-y-2 text-[13px]"><div className="flex justify-between"><dt className="text-ink-muted">ID</dt><dd className="font-mono">{selected.document_id}</dd></div><div className="flex justify-between"><dt className="text-ink-muted">Hash</dt><dd className="font-mono text-[11px]">{selected.content_hash}</dd></div><div className="flex justify-between"><dt className="text-ink-muted">Words</dt><dd>{selected.word_count}</dd></div><div className="flex justify-between"><dt className="text-ink-muted">Status</dt><dd>{selected.status}</dd></div></dl>}</Modal>
  </div>;
}
