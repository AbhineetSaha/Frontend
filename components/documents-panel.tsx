"use client";

import type React from "react";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText, Trash2, Eye, Loader2 } from "lucide-react";
import type { Document } from "@/lib/api-client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DocumentsPanelProps {
  documents: Document[];
  onUploadDocument: (file: File) => void;
  onDeleteDocument: (documentId: string) => void;
  onToggleInclude: (documentId: string, isIncluded: boolean) => void;
  onPreviewDocument: (documentId: string) => void;
  previewingDocumentId?: string | null;
}

export function DocumentsPanel({
  documents,
  onUploadDocument,
  onDeleteDocument,
  onToggleInclude,
  onPreviewDocument,
  previewingDocumentId,
}: DocumentsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Validate all files are PDFs
    const invalidFiles = Array.from(files).filter(
      (file) => file.type !== "application/pdf"
    );
    if (invalidFiles.length > 0) {
      alert("Please upload only PDF files");
      return;
    }

    setUploading(true);
    try {
      // Upload files sequentially to avoid overwhelming the server
      for (const file of Array.from(files)) {
        await onUploadDocument(file);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteClick = (documentId: string) => {
    setDocumentToDelete(documentId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (documentToDelete) {
      onDeleteDocument(documentToDelete);
      setDocumentToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const formatFileSize = (bytes?: number | null) => {
    if (bytes === undefined || bytes === null || Number.isNaN(bytes)) {
      return "Unknown size";
    }
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatUploadDate = (value?: string) => {
    if (!value) return "Unknown date";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Unknown date";
    return parsed.toLocaleDateString();
  };

  const includedCount = documents.filter((d) => d.is_included).length;

  return (
    <>
      <div className="flex flex-col h-full w-full overflow-hidden bg-background/95 backdrop-blur-xl relative">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />

        {/* Header */}
        <div className="relative flex-shrink-0 border-b border-border/50 px-6 py-5 bg-card/30 backdrop-blur-sm animate-in fade-in slide-in-from-top duration-500 z-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              Documents
            </h2>
            <Button
              onClick={handleUploadClick}
              size="sm"
              disabled={uploading}
              className="shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:scale-110 transition-all duration-200 rounded-lg"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Upload
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {includedCount} of {documents.length} included in context
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload PDF files"
          />
        </div>

        {/* Documents List */}
        <ScrollArea className="flex-1 overflow-x-hidden relative z-10">
          <div className="px-4 py-6 space-y-3">
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="rounded-full bg-primary/10 p-4 mb-4 shadow-lg shadow-primary/10 animate-pulse">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  No documents uploaded
                </p>
                <p className="text-xs text-muted-foreground">
                  Upload PDFs to get started
                </p>
              </div>
            ) : (
              documents.map((document, index) => (
                <div
                  key={document.document_id}
                  className="w-full overflow-hidden group border border-border/50 rounded-xl p-4 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 transition-all duration-200 bg-card/30 backdrop-blur-sm animate-in fade-in slide-in-from-right"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={document.is_included}
                      onCheckedChange={(checked) =>
                        onToggleInclude(
                          document.document_id,
                          checked as boolean
                        )
                      }
                      className="mt-1 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all duration-200 data-[state=checked]:scale-110"
                      aria-label={`Include ${document.filename} in context`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium text-foreground line-clamp-2 leading-relaxed break-words"
                            title={document.filename}
                          >
                            {document.filename}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(document.file_size)}
                            </p>
                            <span className="text-muted-foreground/50">•</span>
                            <p className="text-xs text-muted-foreground">
                              {formatUploadDate(document.upload_date)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-xs hover:bg-primary/10 hover:text-primary hover:scale-110 transition-all duration-200 rounded-lg"
                          onClick={() =>
                            onPreviewDocument(document.document_id)
                          }
                          disabled={
                            previewingDocumentId === document.document_id
                          }
                        >
                          {previewingDocumentId === document.document_id ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5 mr-1.5" />
                              Preview
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:scale-110 transition-all duration-200 rounded-lg"
                          onClick={() =>
                            handleDeleteClick(document.document_id)
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Info Footer */}
        <div className="flex-shrink-0 border-t border-border/50 px-6 py-4 bg-muted/20 backdrop-blur-sm animate-in fade-in slide-in-from-bottom duration-500 relative z-10">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Check documents to include them in the AI context. Only included
            documents will be used to answer your questions.
          </p>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this document. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
