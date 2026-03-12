"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { Send, Sparkles, X } from "lucide-react";
import { useState } from "react";

export function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || isLoading) {
      return;
    }

    sendMessage({ text: input });
    setInput("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-sky-500 via-cyan-400 to-amber-300 text-slate-950 shadow-[0_25px_50px_-24px_rgba(14,165,233,0.9)] transition-transform duration-300 hover:-translate-y-1"
        aria-label="Toggle AI Assistant"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Sparkles className="h-6 w-6" />
        )}
      </button>

      {isOpen && (
        <div className="surface-panel fixed bottom-24 right-6 z-40 flex h-[600px] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden">
          <div className="border-b border-white/45 bg-gradient-to-r from-slate-950 via-sky-950 to-cyan-950 p-4 text-white dark:border-white/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                  AI companion
                </p>
                <h3 className="mt-1 font-display text-xl font-bold">
                  Market Assistant
                </h3>
                <p className="mt-1 text-sm text-white/68">
                  Ask for fast reads, context, and narrative summaries.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-white/12 bg-white/8 p-2 transition-colors hover:bg-white/12"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-white/45 p-4 dark:bg-slate-950/35">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="rounded-full bg-sky-500/10 p-4 text-sky-700 dark:text-sky-200">
                  <Sparkles className="h-8 w-8" />
                </div>
                <h4 className="mt-4 font-display text-xl font-bold tracking-tight">
                  Start a sharper conversation
                </h4>
                <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                  Try asking which market looks most interesting, what could
                  resolve soon, or how the current board breaks down.
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-sm ${
                      message.role === "user"
                        ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                        : "border border-slate-200/70 bg-white/90 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                    }`}
                  >
                    {message.parts
                      .map((part) => (part.type === "text" ? part.text : ""))
                      .join("")}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-[22px] border border-slate-200/70 bg-white/90 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <div className="flex space-x-2">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-sky-500" />
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-cyan-400"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-amber-300"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-white/45 bg-white/65 p-4 dark:border-white/10 dark:bg-slate-950/45"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask for a market read..."
                disabled={isLoading}
                className="h-12 flex-1 rounded-2xl border border-slate-200/80 bg-white/92 px-4 text-sm outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950"
              >
                <Send className="h-4.5 w-4.5" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
