import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import {
  listKnowledgeDocuments,
  getKnowledgeDocument,
  uploadKnowledgeDocument,
  updateKnowledgeDocument,
  deleteKnowledgeDocument,
  type KnowledgeDocument,
} from "@/api/knowledgeBase";
import { formatDate } from "@/utils/dates";

export function Documents() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [selected, setSelected] = useState<KnowledgeDocument | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editVersion, setEditVersion] = useState("");

  const [viewText, setViewText] = useState("");
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);

  const [dragging, setDragging] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);

    try {
      setDocuments(await listKnowledgeDocuments());
      setError(null);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ??
          "Unable to load knowledge-base documents."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function handleFile(file: File | undefined) {
    if (!file) return;

    const extension = file.name
      .toLowerCase()
      .split(".")
      .pop();

    const allowed =
      file.type === "application/pdf" ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      extension === "pdf" ||
      extension === "docx";

    if (!allowed) {
      setError("Only PDF and DOCX documents are supported.");
      return;
    }

    setFile(file);
    setError(null);
  }

  function handleDrop(
    e: React.DragEvent<HTMLDivElement>
  ) {
    e.preventDefault();
    setDragging(false);

    handleFile(e.dataTransfer.files?.[0]);
  }

  async function submitUpload() {
    if (!file || !version.trim()) {
      setError(
        "Choose a PDF or DOCX file and provide a version."
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await uploadKnowledgeDocument(
        file,
        version.trim()
      );

      setUploadOpen(false);
      setFile(null);
      setVersion("");
      setDragging(false);

      await refresh();
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ??
          "Document upload failed."
      );
    } finally {
      setSaving(false);
    }
  }

  function openDocument(
    document: KnowledgeDocument
  ) {
    setSelected(document);
    setEditTitle(document.title);
    setEditVersion(document.version);
    setError(null);
  }

  async function submitEdit() {
    if (!selected) return;

    if (
      !editTitle.trim() ||
      !editVersion.trim()
    ) {
      setError("Title and version are required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateKnowledgeDocument(
        selected.document_id,
        editTitle.trim(),
        editVersion.trim()
      );

      setSelected(null);

      await refresh();
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ??
          "Document update failed."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeDocumentById(
    documentId: string
  ) {
    if (!window.confirm("Delete this document?")) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await deleteKnowledgeDocument(
        documentId
      );

      setSelected(null);

      await refresh();
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ??
          "Document deletion failed."
      );
    } finally {
      setSaving(false);
    }
  }

  async function viewDocument(
    documentId: string
  ) {
    setViewOpen(true);
    setViewLoading(true);
    setViewText("");
    setError(null);

    try {
      const document =
        await getKnowledgeDocument(
          documentId
        );

      setViewText(document.text);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ??
          "Unable to read document."
      );

      setViewOpen(false);
    } finally {
      setViewLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Live policy and SOP documents from the SupportNova knowledge base."
        actions={
          <Button
            size="sm"
            onClick={() => setUploadOpen(true)}
          >
            Upload document
          </Button>
        }
      />

      {error && (
        <p className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-[13px] text-ink-muted">
          Loading documents…
        </p>
      ) : documents.length === 0 ? (
        <EmptyState
          title="No documents"
          description="No validated documents are available in the backend knowledge base."
        />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line bg-canvas-subtle text-[11px] uppercase text-ink-muted">
                <th className="px-3 py-2">
                  Document ID
                </th>
                <th className="px-3 py-2">
                  Title
                </th>
                <th className="px-3 py-2">
                  Version
                </th>
                <th className="px-3 py-2">
                  Format
                </th>
                <th className="px-3 py-2">
                  Status
                </th>
                <th className="px-3 py-2">
                  Uploaded
                </th>
                <th className="px-3 py-2">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {documents.map((d) => (
                <tr
                  key={d.document_id}
                  className="border-b border-line last:border-0 hover:bg-canvas-subtle"
                >
                  <td className="px-3 py-2 font-mono text-[12px]">
                    <button
                      className="text-primary hover:underline"
                      onClick={() =>
                        openDocument(d)
                      }
                    >
                      {d.document_id}
                    </button>
                  </td>

                  <td className="px-3 py-2">
                    {d.title}
                  </td>

                  <td className="px-3 py-2">
                    {d.version}
                  </td>

                  <td className="px-3 py-2 uppercase">
                    {d.extension.replace(
                      ".",
                      ""
                    )}
                  </td>

                  <td className="px-3 py-2">
                    {d.status}
                  </td>

                  <td className="px-3 py-2 text-ink-muted">
                    {formatDate(
                      d.uploaded_at
                    )}
                  </td>

                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void viewDocument(
                            d.document_id
                          )
                        }
                      >
                        View
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          openDocument(d)
                        }
                      >
                        Edit
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() =>
                          void removeDocumentById(
                            d.document_id
                          )
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      <Modal
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          setFile(null);
          setVersion("");
          setDragging(false);
        }}
        title="Upload policy or SOP"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setUploadOpen(false);
                setFile(null);
                setVersion("");
                setDragging(false);
              }}
            >
              Cancel
            </Button>

            <Button
              disabled={saving}
              onClick={() =>
                void submitUpload()
              }
            >
              {saving
                ? "Uploading…"
                : "Upload"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() =>
              setDragging(false)
            }
            onDrop={handleDrop}
            className={`rounded-lg border border-dashed px-4 py-7 text-center transition ${
              dragging
                ? "border-primary bg-primary/5"
                : "border-line bg-canvas-subtle"
            }`}
          >
            <p className="text-[13px] font-medium text-ink">
              Drag & drop your PDF or DOCX here
            </p>

            <p className="mt-1 text-[12px] text-ink-muted">
              or choose a file from your computer
            </p>

            <label className="mt-3 inline-block cursor-pointer">
              <span className="inline-flex items-center rounded-md border border-line bg-canvas px-3 py-2 text-[13px] font-medium text-ink transition hover:bg-canvas-subtle">
                Choose file
              </span>

              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) =>
                  handleFile(
                    e.target.files?.[0]
                  )
                }
              />
            </label>

            {file && (
              <p className="mt-3 text-[12px] text-ink">
                Selected:{" "}
                <span className="font-medium">
                  {file.name}
                </span>
              </p>
            )}
          </div>

          <Input
            label="Version"
            value={version}
            onChange={(e) =>
              setVersion(e.target.value)
            }
            placeholder="e.g. 1.0"
          />
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={Boolean(selected)}
        onClose={() =>
          setSelected(null)
        }
        title="Document metadata"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() =>
                setSelected(null)
              }
            >
              Close
            </Button>

            <Button
              variant="outline"
              disabled={saving}
              onClick={() =>
                selected &&
                void removeDocumentById(
                  selected.document_id
                )
              }
            >
              Delete
            </Button>

            <Button
              disabled={saving}
              onClick={() =>
                void submitEdit()
              }
            >
              {saving
                ? "Saving…"
                : "Save"}
            </Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-3">
            <Input
              label="Title"
              value={editTitle}
              onChange={(e) =>
                setEditTitle(
                  e.target.value
                )
              }
            />

            <Input
              label="Version"
              value={editVersion}
              onChange={(e) =>
                setEditVersion(
                  e.target.value
                )
              }
            />

            <div className="text-[13px] text-ink-muted">
              ID:{" "}
              <span className="font-mono text-ink">
                {selected.document_id}
              </span>
            </div>

            <div className="text-[13px] text-ink-muted">
              Hash:{" "}
              <span className="font-mono text-[11px] text-ink">
                {selected.content_hash}
              </span>
            </div>

            <div className="text-[13px] text-ink-muted">
              Words:{" "}
              <span className="text-ink">
                {selected.word_count}
              </span>
            </div>

            <div className="text-[13px] text-ink-muted">
              Status:{" "}
              <span className="text-ink">
                {selected.status}
              </span>
            </div>
          </div>
        )}
      </Modal>

      {/* View Modal */}
      <Modal
        open={viewOpen}
        onClose={() =>
          setViewOpen(false)
        }
        title="Document content"
        footer={
          <Button
            variant="outline"
            onClick={() =>
              setViewOpen(false)
            }
          >
            Close
          </Button>
        }
      >
        {viewLoading ? (
          <p className="text-[13px] text-ink-muted">
            Loading document…
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded-md border border-line bg-canvas-subtle p-4">
            <pre className="whitespace-pre-wrap text-[13px] leading-6 text-ink">
              {viewText}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
}