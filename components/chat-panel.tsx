"use client";

import type React from "react";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Sparkles } from "lucide-react";
import type { Message } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  loading: boolean;
  conversationTitle?: string;
}

const markdownComponents: Components = {
  a: ({ node, ...props }) => (
    <a
      {...props}
      className={cn(
        "text-primary underline underline-offset-2 transition-colors hover:text-primary/80",
        props.className
      )}
      target={props.target ?? "_blank"}
      rel={props.rel ?? "noopener noreferrer"}
    />
  ),
  code: ({ node, inline, className, children, ...props }) => {
    if (inline) {
      return (
        <code
          {...props}
          className={cn(
            "rounded-md bg-muted/70 px-1.5 py-0.5 font-mono text-xs",
            className
          )}
        >
          {children}
        </code>
      );
    }

    return (
      <pre className="chat-markdown-pre">
        <code
          {...props}
          className={cn("font-mono text-xs sm:text-sm", className)}
        >
          {children}
        </code>
      </pre>
    );
  },
  ul: ({ node, className, ...props }) => (
    <ul {...props} className={cn("list-disc space-y-1 pl-5", className)} />
  ),
  ol: ({ node, className, ...props }) => (
    <ol {...props} className={cn("list-decimal space-y-1 pl-5", className)} />
  ),
  blockquote: ({ node, className, ...props }) => (
    <blockquote
      {...props}
      className={cn(
        "border-l-4 border-primary/40 pl-4 text-muted-foreground italic",
        className
      )}
    />
  ),
};

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
      className="chat-markdown"
    >
      {content}
    </ReactMarkdown>
  );
}

function TypingAnimation({
  content,
  timestamp,
}: {
  content: string;
  timestamp: string;
}) {
  const [displayedContent, setDisplayedContent] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < content.length) {
      const timeout = setTimeout(() => {
        setDisplayedContent((prev) => prev + content[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, 20); // Adjust speed here (lower = faster)

      return () => clearTimeout(timeout);
    }
  }, [currentIndex, content]);

  const isComplete = currentIndex >= content.length;

  return (
    <>
      {isComplete ? (
        <MarkdownMessage content={content} />
      ) : (
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {displayedContent}
          {currentIndex < content.length && (
            <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-current" />
          )}
        </div>
      )}
      <div className="text-xs opacity-60 mt-2">
        {new Date(timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
    </>
  );
}

export function ChatPanel({
  messages,
  onSendMessage,
  loading,
  conversationTitle,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const animatedMessageIdsRef = useRef<Set<string>>(new Set());
  const initializedMessagesRef = useRef(false);
  const activeConversationIdRef = useRef<string | null>(null);
  const [animatingMessageId, setAnimatingMessageId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (messages.length === 0) {
      animatedMessageIdsRef.current.clear();
      initializedMessagesRef.current = false;
      activeConversationIdRef.current = null;
      setAnimatingMessageId(null);
      return;
    }

    const activeConversationId = messages[0]?.conversation_id ?? null;
    if (
      activeConversationId &&
      activeConversationId !== activeConversationIdRef.current
    ) {
      activeConversationIdRef.current = activeConversationId;
      animatedMessageIdsRef.current.clear();
      initializedMessagesRef.current = false;
    }

    if (!initializedMessagesRef.current) {
      messages
        .filter((message) => message.role === "assistant")
        .forEach((message) => {
          animatedMessageIdsRef.current.add(message.message_id);
        });
      initializedMessagesRef.current = true;
      setAnimatingMessageId(null);
      return;
    }

    const latestMessage = messages[messages.length - 1];
    if (
      latestMessage.role === "assistant" &&
      !animatedMessageIdsRef.current.has(latestMessage.message_id)
    ) {
      animatedMessageIdsRef.current.add(latestMessage.message_id);
      setAnimatingMessageId(latestMessage.message_id);
    }
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !loading) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/50 relative overflow-hidden">
      {/* Subtle radial/diagonal glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border/50 px-6 py-4 bg-card/30 backdrop-blur-xl animate-in fade-in slide-in-from-top duration-500">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <h1 className="text-xl font-semibold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              {conversationTitle || "Select a conversation"}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 ml-7">
            Ask questions about your uploaded documents
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden px-6">
          <ScrollArea className="h-full">
            <div className="py-6 space-y-6 max-w-3xl mx-auto">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center animate-in fade-in zoom-in-95 duration-500">
                  <div className="space-y-3 p-8 rounded-2xl bg-card/30 backdrop-blur-sm border border-border/50">
                    <Sparkles className="h-12 w-12 text-primary mx-auto animate-pulse" />
                    <p className="text-lg font-medium text-foreground">
                      No messages yet
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Start a conversation by typing a message below
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message, index) => {
                  const shouldAnimate =
                    message.role === "assistant" &&
                    message.message_id === animatingMessageId;
                  const messageTimestamp =
                    message.timestamp ?? new Date().toISOString();

                  return (
                    <div
                      key={message.message_id}
                      className={cn(
                        "flex gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500",
                        message.role === "user"
                          ? "justify-end"
                          : "justify-start"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-3 shadow-lg transition-all duration-300 hover:shadow-2xl group",
                          message.role === "user"
                            ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-primary/30 hover:shadow-primary/40 hover:scale-[1.02]"
                            : "bg-card/50 text-card-foreground border border-border/50 shadow-card/50 backdrop-blur-sm hover:border-primary/30 hover:scale-[1.02]"
                        )}
                      >
                        {shouldAnimate ? (
                          <TypingAnimation
                            content={message.content}
                            timestamp={messageTimestamp}
                          />
                        ) : (
                          <>
                            <MarkdownMessage content={message.content} />
                            <div className="text-xs opacity-60 mt-2 group-hover:opacity-80 transition-opacity">
                              {new Date(messageTimestamp).toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              {loading && (
                <div className="flex gap-4 justify-start animate-in fade-in duration-300">
                  <div className="bg-card/50 text-card-foreground border border-primary/30 rounded-2xl px-4 py-3 shadow-lg shadow-primary/20 backdrop-blur-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-4 md:px-6 py-4 bg-gradient-to-t from-background via-background/90 to-transparent animate-in fade-in slide-in-from-bottom duration-500">
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
            <div className="rounded-2xl border border-border/50 bg-card/80 dark:bg-card/70 shadow-sm focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/15 transition-all duration-150">
              <div className="flex items-center gap-3 px-3 py-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Send a message..."
                  className="flex-1 min-h-[44px] max-h-[140px] resize-none border-0 bg-transparent pl-1 pr-0 py-2 text-sm leading-6 text-card-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:outline-none"
                  disabled={loading}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={loading || !input.trim()}
                  className="h-10 w-10 rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25 transition-colors duration-150 hover:bg-primary/85 disabled:opacity-60 disabled:hover:bg-primary"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="sr-only">Send message</span>
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 text-center md:text-left">
              DocDrift can make mistakes. Press Enter to send • Shift+Enter for
              a new line.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
