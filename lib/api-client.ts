// frontend/lib/api.ts
import axios from "axios";
import supabase from "./supabase"; // keep your default export if that's what you have

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Inject bearer token AND ?user_id on every request
apiClient.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || null;
  const uid = data.session?.user?.id || null;

  config.headers = config.headers ?? {};
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Always pass user_id=... as query param (backend contract)
  config.params = {
    ...(config.params || {}),
    ...(uid ? { user_id: uid } : {}),
  };
  return config;
});

/** ---------- Frontend-facing types ---------- */
export interface Conversation {
  conversation_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  message_id?: string; // backend doesn't return IDs on POST, so optional
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface Document {
  document_id: string;
  conversation_id: string;
  filename: string;
  file_size?: number; // backend does not provide this; optional
  upload_date: string;
  is_included: boolean;
  storage_path?: string;
}

/** ---------- Backend raw types (for mapping) ---------- */
type ConversationRow = {
  id: string;
  user_id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
};

type MessageRow = {
  id?: string;
  conversation_id: string;
  sender: "user" | "ai";
  content: string;
  timestamp?: string;
};

type DocumentRow = {
  id: string;
  conversation_id: string;
  filename: string;
  storage_path: string;
  include: boolean | string; // can come as string in some setups
  uploaded_at?: string;
};

/** ---------- Mappers ---------- */
const mapConversation = (r: ConversationRow): Conversation => ({
  conversation_id: r.id,
  title: r.title ?? "New Conversation",
  created_at: r.created_at ?? "",
  updated_at: r.updated_at ?? "",
});

const mapMessage = (r: MessageRow): Message => ({
  message_id: r.id,
  conversation_id: r.conversation_id,
  role: r.sender === "ai" ? "assistant" : "user",
  content: r.content,
  timestamp: r.timestamp,
});

const toBoolean = (v: unknown, fallback = true) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.trim().toLowerCase() === "true";
  return fallback ? Boolean(v) : false;
};

const mapDocument = (r: DocumentRow): Document => ({
  document_id: r.id,
  conversation_id: r.conversation_id,
  filename: r.filename,
  upload_date: r.uploaded_at ?? "",
  is_included: toBoolean(r.include, true),
  storage_path: r.storage_path,
});

/** ---------- API functions ---------- */
export const conversationsApi = {
  // GET /conversations?user_id=...
  list: async () => {
    const res = await apiClient.get<ConversationRow[]>("conversations");
    return res.data.map(mapConversation);
  },

  // POST /conversations?user_id=...
  // Backend returns { conversation_id }
  create: async (title?: string) => {
    const res = await apiClient.post<{ conversation_id: string }>(
      "conversations",
      { title }
    );
    return { conversation_id: res.data.conversation_id };
  },

  // DELETE /conversations/:id?user_id=...
  delete: async (conversationId: string) => {
    await apiClient.delete(`conversations/${conversationId}`);
    return { ok: true };
  },

  // PATCH /conversations/:id?user_id=...
  rename: async (conversationId: string, title: string) => {
    await apiClient.patch(`conversations/${conversationId}`, { title });
    return { ok: true };
  },
};

export const messagesApi = {
  // GET /conversations/:id/messages?user_id=...
  list: async (conversationId: string) => {
    const res = await apiClient.get<MessageRow[]>(
      `conversations/${conversationId}/messages`
    );
    return res.data.map(mapMessage);
  },

  // POST /conversations/:id/messages?user_id=...
  // Backend returns { answer: string }
  send: async (conversationId: string, content: string) => {
    const res = await apiClient.post<{ answer: string }>(
      `conversations/${conversationId}/messages`,
      { content }
    );
    // Return assistant message shape for the UI
    const messageId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `assistant-${crypto.randomUUID()}`
        : `assistant-${Date.now()}`;
    const assistant: Message = {
      message_id: messageId,
      conversation_id: conversationId,
      role: "assistant",
      content: res.data.answer,
      timestamp: new Date().toISOString(),
    };
    return assistant;
  },
};

export const documentsApi = {
  // GET /conversations/:id/documents?user_id=...
  list: async (conversationId: string) => {
    const res = await apiClient.get<DocumentRow[]>(
      `conversations/${conversationId}/documents`
    );
    return res.data.map(mapDocument);
  },

  // POST /conversations/:id/documents?user_id=... (multipart/form-data)
  upload: async (conversationId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    // Backend returns: { status, chunks, path, doc_id }
    const res = await apiClient.post<{
      status: string;
      chunks: number;
      path: string;
      doc_id: string;
    }>(`conversations/${conversationId}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    // Minimal doc object to append in UI (you can re-fetch the list instead)
    const now = new Date().toISOString();
    const doc: Document = {
      document_id: res.data.doc_id,
      conversation_id: conversationId,
      filename: file.name,
      upload_date: now,
      is_included: true,
      storage_path: res.data.path,
    };
    return doc;
  },

  // DELETE /conversations/:id/documents/:docId?user_id=...
  delete: async (conversationId: string, documentId: string) => {
    await apiClient.delete(
      `conversations/${conversationId}/documents/${documentId}`
    );
    return { ok: true };
  },

  // PATCH /conversations/:id/documents/:docId?user_id=...
  // Body must be { include: boolean } per backend
  toggleInclude: async (
    conversationId: string,
    documentId: string,
    isIncluded: boolean
  ) => {
    await apiClient.patch(
      `conversations/${conversationId}/documents/${documentId}`,
      {
        include: isIncluded,
      }
    );
    return { ok: true };
  },

  // GET /conversations/:id/documents/:docId/url?user_id=...
  // Backend returns { url }
  getSignedUrl: async (conversationId: string, documentId: string) => {
    const res = await apiClient.get<{ url: string }>(
      `conversations/${conversationId}/documents/${documentId}/url`
    );
    return { signed_url: res.data.url }; // keep your UI prop name if it expects 'signed_url'
  },
};
