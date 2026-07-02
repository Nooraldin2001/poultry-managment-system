import { API_BASE_URL } from "@/services/config";
import { getAccessToken } from "./api/client";
import { ENDPOINTS } from "./api/endpoints";
import { ApiError } from "./api/errors";

export interface DocumentAttachmentRow {
  id: string;
  fileUrl: string;
  fileName: string;
  fileType?: string;
  uploadedAt?: string;
  notes?: string;
}

function mapAttachment(r: Record<string, unknown>, i: number): DocumentAttachmentRow {
  return {
    id: String(r.id ?? i),
    fileUrl: String(r.file ?? ""),
    fileName: String(r.original_filename ?? r.file_name ?? `file-${i}`),
    fileType: r.file_type ? String(r.file_type) : undefined,
    uploadedAt: r.uploaded_at ? String(r.uploaded_at).slice(0, 10) : undefined,
    notes: r.notes ? String(r.notes) : undefined,
  };
}

function extractAttachments(data: unknown): DocumentAttachmentRow[] {
  if (Array.isArray(data)) return data.map((r, i) => mapAttachment(r as Record<string, unknown>, i));
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.attachments)) {
      return obj.attachments.map((r, i) => mapAttachment(r as Record<string, unknown>, i));
    }
    if (Array.isArray(obj.results)) {
      return obj.results.map((r, i) => mapAttachment(r as Record<string, unknown>, i));
    }
  }
  return [];
}

export async function listPurchaseAttachments(purchaseId: string): Promise<DocumentAttachmentRow[]> {
  const data = await fetchJson(ENDPOINTS.tenant.purchaseAttachments(purchaseId));
  return extractAttachments(data);
}

export async function listExpenseAttachments(expenseId: string): Promise<DocumentAttachmentRow[]> {
  const data = await fetchJson(ENDPOINTS.tenant.expenseAttachments(expenseId));
  return extractAttachments(data);
}

export async function uploadPurchaseAttachment(
  purchaseId: string,
  file: File,
  fileType = "other",
): Promise<DocumentAttachmentRow[]> {
  await uploadMultipart(ENDPOINTS.tenant.purchaseAttachments(purchaseId), file, fileType);
  return listPurchaseAttachments(purchaseId);
}

export async function uploadExpenseAttachment(
  expenseId: string,
  file: File,
  fileType = "receipt",
): Promise<DocumentAttachmentRow[]> {
  await uploadMultipart(ENDPOINTS.tenant.expenseAttachments(expenseId), file, fileType);
  return listExpenseAttachments(expenseId);
}

async function fetchJson(path: string): Promise<unknown> {
  const base = (API_BASE_URL || "").replace(/\/$/, "");
  const url = `${base}/v1${path.startsWith("/") ? path : `/${path}`}`;
  const token = getAccessToken();
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    throw new ApiError("Request failed", { status: res.status });
  }
  if (res.status === 204) return null;
  return res.json();
}

async function uploadMultipart(path: string, file: File, fileType: string): Promise<void> {
  const base = (API_BASE_URL || "").replace(/\/$/, "");
  const url = `${base}/v1${path.startsWith("/") ? path : `/${path}`}`;
  const token = getAccessToken();
  const form = new FormData();
  form.append("file", file);
  form.append("file_type", fileType);
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    let message = "Upload failed";
    try {
      const data = await res.json();
      if (data && typeof data === "object" && "detail" in data) message = String((data as { detail: string }).detail);
    } catch {
      /* ignore */
    }
    throw new ApiError(message, { status: res.status });
  }
}
