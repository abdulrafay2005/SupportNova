import { api } from "@/api/client";

export interface KnowledgeDocument {
  document_id: string;
  filename: string;
  title: string;
  extension: string;
  version: string;
  status: "Active" | "Superseded";
  uploaded_at: string;
  character_count: number;
  word_count: number;
  content_hash: string;
}

export interface KnowledgeDocumentContent {
  document_id: string;
  filename: string;
  title: string;
  version: string;
  status: "Active" | "Superseded";
  text: string;
}

export interface KnowledgeSearchResult {
  score: number;
  document_id: string;
  title: string;
  version: string;
  source: Record<string, string | number>;
  text: string;
}

export async function listKnowledgeDocuments() {
  const response = await api.get<KnowledgeDocument[]>(
    "/api/admin/knowledge-base/documents"
  );

  return response.data;
}

export async function getKnowledgeDocument(
  documentId: string
) {
  const response = await api.get<KnowledgeDocumentContent>(
    `/api/admin/knowledge-base/documents/${encodeURIComponent(
      documentId
    )}`
  );

  return response.data;
}

export async function uploadKnowledgeDocument(
  file: File,
  version: string,
  title?: string
) {
  const form = new FormData();

  form.append("file", file);

  const response = await api.post<KnowledgeDocument>(
    "/api/admin/knowledge-base/documents",
    form,
    {
      params: {
        version,
        ...(title ? { title } : {}),
      },
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
}

export async function searchKnowledgeBase(
  query: string
) {
  const response = await api.get<{
    query: string;
    results: KnowledgeSearchResult[];
  }>(
    "/api/knowledge-base/search",
    {
      params: { query },
    }
  );

  return response.data;
}

export async function updateKnowledgeDocument(
  documentId: string,
  title: string,
  version: string
) {
  const response = await api.patch<KnowledgeDocument>(
    `/api/admin/knowledge-base/documents/${encodeURIComponent(
      documentId
    )}`,
    null,
    {
      params: {
        title,
        version,
      },
    }
  );

  return response.data;
}

export async function deleteKnowledgeDocument(
  documentId: string
) {
  const response = await api.delete(
    `/api/admin/knowledge-base/documents/${encodeURIComponent(
      documentId
    )}`
  );

  return response.data;
}