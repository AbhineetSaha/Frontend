"use client";

import type React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Plus, MessageSquare, Trash2, LogOut, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/api-client";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConversationsSidebarProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onCreateConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => Promise<void> | void;
}

export function ConversationsSidebar({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  onRenameConversation,
}: ConversationsSidebarProps) {
  const { signOut, user } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<
    string | null
  >(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [conversationToRename, setConversationToRename] = useState<
    string | null
  >(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    setConversationToDelete(conversationId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (conversationToDelete) {
      onDeleteConversation(conversationToDelete);
      setConversationToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const handleRenameClick = (
    e: React.MouseEvent,
    conversation: Conversation
  ) => {
    e.stopPropagation();
    setConversationToRename(conversation.conversation_id);
    setRenameValue(conversation.title);
    setRenameDialogOpen(true);
  };

  const handleConfirmRename = async () => {
    if (!conversationToRename || !renameValue.trim()) {
      return;
    }

    try {
      setRenaming(true);
      await onRenameConversation(conversationToRename, renameValue.trim());
      setRenameDialogOpen(false);
      setConversationToRename(null);
      setRenameValue("");
    } catch {
      // Keep dialog open so the user can try again
    } finally {
      setRenaming(false);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full bg-sidebar/95 backdrop-blur-xl">
        {/* Header */}
        <div className="p-4 border-b border-sidebar-border/50 animate-in fade-in slide-in-from-top duration-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-sidebar-foreground bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
              Conversations
            </h2>
            <Button
              onClick={onCreateConversation}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-sidebar-accent hover:scale-110 hover:rotate-90 transition-all duration-300 rounded-lg shadow-lg shadow-primary/10"
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">New conversation</span>
            </Button>
          </div>
          <div className="text-xs text-sidebar-foreground/60 truncate">
            {user?.email}
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.length === 0 ? (
              <div className="p-4 text-center text-sm text-sidebar-foreground/60 animate-in fade-in duration-500">
                No conversations yet. Create one to get started.
              </div>
            ) : (
              conversations.map((conversation, index) => (
                <div
                  key={conversation.conversation_id}
                  className={cn(
                    "group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all duration-200 animate-in fade-in slide-in-from-left",
                    selectedConversationId === conversation.conversation_id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-lg shadow-primary/10 border border-primary/20 scale-105"
                      : "hover:bg-sidebar-accent/50 text-sidebar-foreground hover:translate-x-1 hover:scale-105"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() =>
                    onSelectConversation(conversation.conversation_id)
                  }
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  <span className="flex-1 truncate text-sm">
                    {conversation.title}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:text-primary hover:scale-125 hover:rotate-6"
                    onClick={(e) => handleRenameClick(e, conversation)}
                  >
                    <Pencil className="h-3 w-3" />
                    <span className="sr-only">Rename conversation</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:text-destructive hover:scale-125 hover:rotate-12"
                    onClick={(e) =>
                      handleDeleteClick(e, conversation.conversation_id)
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                    <span className="sr-only">Delete conversation</span>
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border/50 animate-in fade-in slide-in-from-bottom duration-500">
          <Button
            onClick={signOut}
            variant="ghost"
            className="w-full justify-start hover:bg-sidebar-accent hover:scale-105 transition-all duration-200 rounded-lg"
            size="sm"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </div>

      {/* Delete dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its
              messages and documents. This action cannot be undone.
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

      {/* Rename dialog */}
      <Dialog
        open={renameDialogOpen}
        onOpenChange={(open) => {
          setRenameDialogOpen(open);
          if (!open) {
            setConversationToRename(null);
            setRenameValue("");
            setRenaming(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Enter a new title"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRename}
              disabled={!renameValue.trim() || renaming}
            >
              {renaming ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
