"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ConversationsSidebar } from "@/components/conversations-sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { DocumentsPanel } from "@/components/documents-panel";
import type { Conversation, Message, Document } from "@/lib/api-client";
import {
  API_BASE_URL,
  conversationsApi,
  messagesApi,
  documentsApi,
} from "@/lib/api-client";
import {
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";

const NORMALIZED_API_BASE = API_BASE_URL.replace(/\/$/, "");

type EnsureConversationResult = {
  conversationId: string;
  created: boolean;
};

const MAX_AUTO_TITLE_LENGTH = 60;

const deriveConversationTitle = (
  seed: string | undefined,
  fallbackIndex: number
) => {
  const trimmedSeed = seed?.trim();
  if (trimmedSeed) {
    const normalized = trimmedSeed.replace(/\s+/g, " ");
    if (normalized.length <= MAX_AUTO_TITLE_LENGTH) {
      return normalized;
    }
    return `${normalized.slice(0, MAX_AUTO_TITLE_LENGTH - 3).trimEnd()}...`;
  }
  return `New Conversation ${fallbackIndex}`;
};

export default function AppPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [previewingDocId, setPreviewingDocId] = useState<string | null>(null);
  const [isConversationsSidebarOpen, setIsConversationsSidebarOpen] =
    useState(true);
  const [isDocumentsPanelOpen, setIsDocumentsPanelOpen] = useState(true);
  const isMobile = useIsMobile();
  const [backendReady, setBackendReady] = useState(false);
  const [backendChecking, setBackendChecking] = useState(false);
  const [backendRetryCount, setBackendRetryCount] = useState(0);
  const [backendLastError, setBackendLastError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const healthCheckInFlightRef = useRef(false);
  const conversationCreationRef =
    useRef<Promise<EnsureConversationResult> | null>(null);
  const hasLoadedConversationsRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const ensureActiveConversation = useCallback(
    async (seedTitle?: string): Promise<EnsureConversationResult> => {
      if (selectedConversationId) {
        return { conversationId: selectedConversationId, created: false };
      }

      if (!conversationCreationRef.current) {
        const fallbackTitle = deriveConversationTitle(
          seedTitle,
          conversations.length + 1
        );

        const creationPromise = (async () => {
          const { conversation_id } =
            await conversationsApi.create(fallbackTitle);
          const now = new Date().toISOString();
          const newConversation: Conversation = {
            conversation_id,
            title: fallbackTitle,
            created_at: now,
            updated_at: now,
          };
          setConversations((prev) => [newConversation, ...prev]);
          setSelectedConversationId(conversation_id);
          setMessages([]);
          setDocuments([]);
          if (isMobile) {
            setIsConversationsSidebarOpen(false);
          }
          return { conversationId: conversation_id, created: true };
        })();

        conversationCreationRef.current = creationPromise;
      }

      const pendingCreation = conversationCreationRef.current;
      try {
        return await pendingCreation!;
      } finally {
        if (conversationCreationRef.current === pendingCreation) {
          conversationCreationRef.current = null;
        }
      }
    },
    [
      selectedConversationId,
      conversations.length,
      isMobile,
      setIsConversationsSidebarOpen,
    ]
  );

  const runHealthCheck = useCallback(async () => {
    if (
      backendReady ||
      healthCheckInFlightRef.current ||
      !isMountedRef.current
    ) {
      return;
    }

    healthCheckInFlightRef.current = true;
    if (isMountedRef.current) {
      setBackendChecking(true);
    }

    const healthPaths = ["/health", "/"];
    let lastErrorMessage = "Unable to reach backend";
    let reachable = false;

    try {
      for (const path of healthPaths) {
        try {
          const response = await fetch(`${NORMALIZED_API_BASE}${path}`, {
            method: "GET",
            cache: "no-store",
          });

          if (response.status < 500) {
            reachable = true;
            break;
          }

          lastErrorMessage = `Backend responded with status ${response.status} at ${path}`;
        } catch (error) {
          lastErrorMessage =
            error instanceof Error ? error.message : "Unable to reach backend";
        }
      }

      if (reachable && isMountedRef.current) {
        setBackendReady(true);
        setBackendLastError(null);
        setBackendRetryCount(0);
        return;
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error("Backend health check failed:", error);
        setBackendLastError(
          error instanceof Error
            ? error.message
            : "Unable to reach backend"
        );
        setBackendRetryCount((prev) => prev + 1);
      }
      return;
    } finally {
      if (isMountedRef.current) {
        setBackendChecking(false);
      }
      healthCheckInFlightRef.current = false;
    }

    if (isMountedRef.current && !reachable) {
      console.error("Backend health check failed:", lastErrorMessage);
      setBackendLastError(lastErrorMessage);
      setBackendRetryCount((prev) => prev + 1);
    }
  }, [backendReady]);

  useEffect(() => {
    if (backendReady) {
      return;
    }

    runHealthCheck();
    const interval = setInterval(() => {
      runHealthCheck();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [backendReady, runHealthCheck]);

  useEffect(() => {
    if (isMobile) {
      setIsConversationsSidebarOpen(false);
      setIsDocumentsPanelOpen(false);
    } else {
      setIsConversationsSidebarOpen(true);
      setIsDocumentsPanelOpen(true);
    }
  }, [isMobile]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Load conversations once backend is ready
  useEffect(() => {
    if (user && backendReady) {
      void loadConversations();
    }
  }, [user, backendReady]);

  // Load messages and documents when conversation is selected
  useEffect(() => {
    if (selectedConversationId) {
      loadMessages(selectedConversationId);
      loadDocuments(selectedConversationId);
    }
  }, [selectedConversationId]);

  const toggleConversationsSidebar = () => {
    setIsConversationsSidebarOpen((prev) => {
      const next = !prev;
      if (next && isMobile) {
        setIsDocumentsPanelOpen(false);
      }
      return next;
    });
  };

  const toggleDocumentsPanel = () => {
    setIsDocumentsPanelOpen((prev) => {
      const next = !prev;
      if (next && isMobile) {
        setIsConversationsSidebarOpen(false);
      }
      return next;
    });
  };

  const loadConversations = async () => {
    const shouldShowInitialSpinner =
      conversations.length === 0 && !hasLoadedConversationsRef.current;
    if (shouldShowInitialSpinner) {
      setLoading(true);
    }
    try {
      const loadedConversations = await conversationsApi.list();
      setConversations(loadedConversations);
      if (loadedConversations.length > 0 && !selectedConversationId) {
        setSelectedConversationId(loadedConversations[0].conversation_id);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
      toast({
        title: "Error",
        description: "Failed to load conversations. Using offline mode.",
        variant: "destructive",
      });
      const mockConversations: Conversation[] = [
        {
          conversation_id: "1",
          title: "Getting Started",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      setConversations(mockConversations);
      if (mockConversations.length > 0 && !selectedConversationId) {
        setSelectedConversationId(mockConversations[0].conversation_id);
      }
    } finally {
      hasLoadedConversationsRef.current = true;
      if (shouldShowInitialSpinner) {
        setLoading(false);
      }
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const loadedMessages = await messagesApi.list(conversationId);
      setMessages(loadedMessages);
    } catch (error) {
      console.error("Failed to load messages:", error);
      toast({
        title: "Error",
        description: "Failed to load messages. Using offline mode.",
        variant: "destructive",
      });
      const mockMessages: Message[] = [
        {
          message_id: "1",
          conversation_id: conversationId,
          role: "assistant",
          content:
            "Hello! I'm your AI assistant. Upload some documents and ask me questions about them.",
          timestamp: new Date().toISOString(),
        },
      ];
      setMessages(mockMessages);
    }
  };

  const loadDocuments = async (conversationId: string) => {
    try {
      const loadedDocuments = await documentsApi.list(conversationId);
      setDocuments(loadedDocuments);
    } catch (error) {
      console.error("Failed to load documents:", error);
      toast({
        title: "Error",
        description: "Failed to load documents. Using offline mode.",
        variant: "destructive",
      });
      setDocuments([]);
    }
  };

  const handleCreateConversation = async () => {
    try {
      const title = `New Conversation ${conversations.length + 1}`;
      const { conversation_id } = await conversationsApi.create(title);
      const now = new Date().toISOString();
      const newConversation: Conversation = {
        conversation_id,
        title,
        created_at: now,
        updated_at: now,
      };
      setConversations((prev) => [newConversation, ...prev]);
      setSelectedConversationId(conversation_id);
      if (isMobile) {
        setIsConversationsSidebarOpen(false);
      }
      toast({
        title: "Success",
        description: "Conversation created successfully",
      });
    } catch (error) {
      console.error("Failed to create conversation:", error);
      toast({
        title: "Error",
        description: "Failed to create conversation. Using offline mode.",
        variant: "destructive",
      });
      const newConversation: Conversation = {
        conversation_id: Date.now().toString(),
        title: `New Conversation ${conversations.length + 1}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setConversations([newConversation, ...conversations]);
      setSelectedConversationId(newConversation.conversation_id);
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    if (isMobile) {
      setIsConversationsSidebarOpen(false);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await conversationsApi.delete(conversationId);
      setConversations((prev) => {
        const remaining = prev.filter(
          (c) => c.conversation_id !== conversationId
        );
        if (selectedConversationId === conversationId) {
          const nextSelected =
            remaining.length > 0 ? remaining[0].conversation_id : null;
          setSelectedConversationId(nextSelected);
          setMessages([]);
          setDocuments([]);
          setPreviewDoc(null);
          setPreviewingDocId(null);
        }
        return remaining;
      });
      toast({
        title: "Success",
        description: "Conversation deleted successfully",
      });
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive",
      });
    }
  };

  const handleRenameConversation = async (
    conversationId: string,
    title: string
  ) => {
    try {
      await conversationsApi.rename(conversationId, title);
      const updatedAt = new Date().toISOString();
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.conversation_id === conversationId
            ? { ...conversation, title, updated_at: updatedAt }
            : conversation
        )
      );
      toast({
        title: "Conversation renamed",
        description: "Title updated successfully",
      });
    } catch (error) {
      console.error("Failed to rename conversation:", error);
      toast({
        title: "Error",
        description: "Failed to rename conversation",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleSendMessage = async (content: string) => {
    if (sendingMessage) return;

    setSendingMessage(true);
    let ensuredConversationId: string | null = null;
    let userMessageAppended = false;

    try {
      const ensured = await ensureActiveConversation(content);
      ensuredConversationId = ensured.conversationId;

      const userMessage: Message = {
        message_id: `temp-${Date.now()}`,
        conversation_id: ensuredConversationId,
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      userMessageAppended = true;

      const assistantMessage = await messagesApi.send(
        ensuredConversationId,
        content
      );
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Failed to send message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Using offline mode.",
        variant: "destructive",
      });
      if (ensuredConversationId && userMessageAppended) {
        const fallbackConversationId = ensuredConversationId;
        setTimeout(() => {
          const assistantMessage: Message = {
            message_id: (Date.now() + 1).toString(),
            conversation_id: fallbackConversationId,
            role: "assistant",
            content:
              "This is a mock response. Connect to your backend API to get real AI responses based on your documents.",
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }, 1000);
      }
    } finally {
      setSendingMessage(false);
    }
  };

  const handleUploadDocument = async (file: File) => {
    let ensuredConversationId: string | null = null;

    try {
      const ensured = await ensureActiveConversation();
      ensuredConversationId = ensured.conversationId;

      const newDocument = await documentsApi.upload(
        ensuredConversationId,
        file
      );
      setDocuments((prev) => [...prev, newDocument]);
      toast({
        title: "Success",
        description: `${file.name} uploaded successfully`,
      });
    } catch (error) {
      console.error("Failed to upload document:", error);
      toast({
        title: "Error",
        description: "Failed to upload document. Using offline mode.",
        variant: "destructive",
      });
      if (ensuredConversationId) {
        const newDocument: Document = {
          document_id: Date.now().toString(),
          conversation_id: ensuredConversationId,
          filename: file.name,
          file_size: file.size,
          upload_date: new Date().toISOString(),
          is_included: true,
        };
        setDocuments((prev) => [...prev, newDocument]);
      }
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!selectedConversationId) return;

    try {
      await documentsApi.delete(selectedConversationId, documentId);
      setDocuments((prev) => prev.filter((d) => d.document_id !== documentId));
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    } catch (error) {
      console.error("Failed to delete document:", error);
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  const handleToggleDocumentInclude = async (
    documentId: string,
    isIncluded: boolean
  ) => {
    if (!selectedConversationId) return;

    try {
      await documentsApi.toggleInclude(
        selectedConversationId,
        documentId,
        isIncluded
      );
      setDocuments((prev) =>
        prev.map((d) =>
          d.document_id === documentId ? { ...d, is_included: isIncluded } : d
        )
      );
    } catch (error) {
      console.error("Failed to toggle document:", error);
      toast({
        title: "Error",
        description: "Failed to update document",
        variant: "destructive",
      });
    }
  };

  const handlePreviewDocument = async (documentId: string) => {
    if (!selectedConversationId) return;

    try {
      setPreviewingDocId(documentId);
      const documentMeta = documents.find(
        (doc) => doc.document_id === documentId
      );
      const { signed_url } = await documentsApi.getSignedUrl(
        selectedConversationId,
        documentId
      );
      setPreviewDoc({
        url: signed_url,
        title: documentMeta?.filename ?? "Document preview",
      });
    } catch (error) {
      console.error("Failed to preview document:", error);
      toast({
        title: "Error",
        description: "Failed to preview document",
        variant: "destructive",
      });
    } finally {
      setPreviewingDocId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-background/95">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!backendReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-background via-background to-background/95 px-6 text-center">
        <Loader2
          className={`h-10 w-10 text-primary ${
            backendChecking ? "animate-spin" : ""
          }`}
        />
        <div className="space-y-2">
          <p className="text-lg font-semibold text-foreground">
            Warming up the backend
          </p>
          <p className="text-sm text-muted-foreground">
            {backendRetryCount === 0
              ? "Hold tight while we wake the Render instance. This can take up to a minute when coming from cold start."
              : `Still waiting for the backend to respond. We've retried ${backendRetryCount} time${
                  backendRetryCount === 1 ? "" : "s"
                } so far.`}
          </p>
          {backendLastError ? (
            <p className="text-xs text-muted-foreground">
              Last check: {backendLastError}
            </p>
          ) : null}
        </div>
        <Button
          variant="outline"
          onClick={runHealthCheck}
          disabled={backendChecking}
          className="flex items-center gap-2"
        >
          {backendChecking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            "Check again now"
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          We retry automatically every few seconds.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-background/95">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {/* Animated background elements */}
      <div className="relative flex flex-col md:flex-row h-screen overflow-hidden bg-gradient-to-br from-background via-background to-background/95 p-2 md:p-4 gap-3 md:gap-4">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-float-delayed" />
        </div>

        {/* Conversations Sidebar */}
        <div
          className={`hidden md:flex md:flex-shrink-0 transition-all duration-300 ease-in-out ${
            isConversationsSidebarOpen ? "md:w-64" : "md:w-0"
          } overflow-hidden`}
        >
          <div className="h-full rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl shadow-2xl shadow-primary/5 w-64 animate-in fade-in slide-in-from-left duration-500">
            <ConversationsSidebar
              conversations={conversations}
              selectedConversationId={selectedConversationId}
              onSelectConversation={handleSelectConversation}
              onCreateConversation={handleCreateConversation}
              onDeleteConversation={handleDeleteConversation}
              onRenameConversation={handleRenameConversation}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-3 md:gap-4">
          <div className="flex justify-between items-center gap-2 animate-in fade-in slide-in-from-top duration-500">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleConversationsSidebar}
              className="rounded-xl hover:bg-accent/50 hover:scale-110 transition-all duration-200 backdrop-blur-sm bg-card/30 border border-border/30 shadow-lg"
              aria-label={
                isConversationsSidebarOpen
                  ? "Close conversations sidebar"
                  : "Open conversations sidebar"
              }
            >
              {isConversationsSidebarOpen ? (
                <PanelLeftClose className="h-5 w-5" />
              ) : (
                <PanelLeftOpen className="h-5 w-5" />
              )}
            </Button>
            <span className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-primary via-primary/80 to-blue-400 bg-clip-text text-transparent drop-shadow">
              DocDrift
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDocumentsPanel}
              className="rounded-xl hover:bg-accent/50 hover:scale-110 transition-all duration-200 backdrop-blur-sm bg-card/30 border border-border/30 shadow-lg"
              aria-label={
                isDocumentsPanelOpen
                  ? "Close documents panel"
                  : "Open documents panel"
              }
            >
              {isDocumentsPanelOpen ? (
                <PanelRightClose className="h-5 w-5" />
              ) : (
                <PanelRightOpen className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl shadow-2xl shadow-primary/5 overflow-hidden animate-in fade-in zoom-in-95 duration-500 delay-100">
            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              loading={sendingMessage}
              conversationTitle={
                conversations.find(
                  (c) => c.conversation_id === selectedConversationId
                )?.title
              }
            />
          </div>
        </div>

        {/* Documents Panel */}
        <div
          className={`hidden md:flex md:flex-shrink-0 transition-all duration-300 ease-in-out ${
            isDocumentsPanelOpen ? "md:w-80" : "md:w-0"
          } overflow-hidden`}
        >
          <div className="h-full rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl shadow-2xl shadow-primary/5 w-80 animate-in fade-in slide-in-from-right duration-500">
            <DocumentsPanel
              documents={documents}
              onUploadDocument={handleUploadDocument}
              onDeleteDocument={handleDeleteDocument}
              onToggleInclude={handleToggleDocumentInclude}
              onPreviewDocument={handlePreviewDocument}
              previewingDocumentId={previewingDocId}
            />
          </div>
        </div>
      </div>

      {/* Mobile overlays */}
      {isMobile && isConversationsSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-md px-4 py-6 flex flex-col animate-in fade-in duration-300">
          <div className="flex justify-end mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsConversationsSidebarOpen(false)}
              className="rounded-xl hover:bg-accent/40 hover:scale-110 transition-all duration-200"
              aria-label="Close conversations"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md shadow-2xl shadow-primary/10">
            <ConversationsSidebar
              conversations={conversations}
              selectedConversationId={selectedConversationId}
              onSelectConversation={handleSelectConversation}
              onCreateConversation={handleCreateConversation}
              onDeleteConversation={handleDeleteConversation}
              onRenameConversation={handleRenameConversation}
            />
          </div>
        </div>
      )}

      {isMobile && isDocumentsPanelOpen && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-md px-4 py-6 flex flex-col animate-in fade-in duration-300">
          <div className="flex justify-end mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDocumentsPanelOpen(false)}
              className="rounded-xl hover:bg-accent/40 hover:scale-110 transition-all duration-200"
              aria-label="Close documents"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md shadow-2xl shadow-primary/10">
            <DocumentsPanel
              documents={documents}
              onUploadDocument={handleUploadDocument}
              onDeleteDocument={handleDeleteDocument}
              onToggleInclude={handleToggleDocumentInclude}
              onPreviewDocument={handlePreviewDocument}
              previewingDocumentId={previewingDocId}
            />
          </div>
        </div>
      )}

      {/* Document Preview Dialog */}
      <Dialog
        open={Boolean(previewDoc)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewDoc(null);
          }
        }}
      >
        <DialogContent className="w-full h-[85vh] flex flex-col gap-4 bg-card/95 backdrop-blur-xl border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
              {previewDoc?.title ?? "Document preview"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden rounded-lg border border-border/50 bg-muted/20 shadow-inner">
            {previewDoc ? (
              <iframe
                src={previewDoc.url}
                title={previewDoc.title}
                className="w-full h-full"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
