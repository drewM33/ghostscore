import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface GhostChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface GhostChatProps {
  messages: GhostChatMessage[];
  onSend: (message: string) => void;
  isLoading: boolean;
  /** Optional content rendered above the input (e.g. Approve Payment button) */
  aboveInput?: React.ReactNode;
}

const SUGGESTIONS = [
  "What's my current score?",
  "Show available endpoints",
  "How do I increase my tier?",
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderMarkdown(content: string): string {
  return content
    .replace(/\*\*(.+?)\*\*/g, "<strong class='font-semibold text-white'>$1</strong>")
    .replace(/`([^`]+)`/g, "<code class='bg-white/[0.08] px-1.5 py-0.5 rounded text-xs font-mono text-white/80'>$1</code>")
    .replace(/```([\s\S]*?)```/g, "<pre class='bg-white/[0.08] rounded-lg p-3 text-xs font-mono text-white/90 overflow-x-auto my-2'><code>$1</code></pre>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline text-emerald-400 hover:text-emerald-300">$1</a>')
    .replace(/^[-*] (.+)$/gm, "<span class='block ml-4'>• $1</span>")
    .replace(/\n/g, "<br />");
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function SendUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  );
}

export function GhostChat({ messages, onSend, isLoading, aboveInput }: GhostChatProps) {
  const [input, setInput] = useState("");
  const [showNewMessages, setShowNewMessages] = useState(false);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageCountRef = useRef(messages.length);

  const hasMessages = messages.length > 0;

  const handleTextareaInput = useCallback(() => {
    const target = textareaRef.current;
    if (!target) return;
    target.style.height = "44px";
    target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    onSend(text);
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, [input, isLoading, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (text: string) => {
    setInput(text);
  };

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setUserScrolledUp(false);
    setShowNewMessages(false);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 80;
    if (!isNearBottom) {
      setUserScrolledUp(true);
    } else {
      setUserScrolledUp(false);
      setShowNewMessages(false);
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    const prev = lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;

    if (messages.length > prev) {
      if (userScrolledUp) {
        setShowNewMessages(true);
      } else {
        scrollToBottom();
      }
    }
  }, [messages.length, userScrolledUp, scrollToBottom]);

  return (
    <div className="relative flex flex-col h-full min-h-0 bg-[#0b0b0f]">
      {/* Slim top bar — 44px */}
      <header className="flex items-center justify-between h-11 shrink-0 px-4 border-b border-white/[0.06]">
        <h1 className="text-sm font-medium text-white">GhostScore Chat</h1>
        <div className="flex items-center gap-1.5 text-emerald-500 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Connected</span>
        </div>
      </header>

      {/* Scrollable message area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0"
      >
        <div className={`max-w-[680px] mx-auto px-4 py-6 ${!hasMessages ? "min-h-full flex flex-col" : ""}`}>
          {!hasMessages ? (
            /* Empty state — icon, title, subtitle, pills, input centered as a group */
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
              <div className="flex flex-col items-center w-full max-w-[680px]">
                <span className="text-5xl mb-4" role="img" aria-label="Ghost">
                  👻
                </span>
                <h2 className="text-lg font-semibold text-white mb-1">GhostScore</h2>
                <p className="text-sm text-white/40 mb-6">Private agent intelligence on Monad</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((text) => (
                    <button
                      key={text}
                      onClick={() => handleSuggestionClick(text)}
                      className="rounded-full px-4 py-2 bg-white/[0.05] border border-white/[0.08] text-xs text-white/50 hover:bg-white/[0.08] hover:text-white/70 hover:border-white/[0.12] transition-colors"
                    >
                      {text}
                    </button>
                  ))}
                </div>
                {/* Input directly below pills, 16px gap */}
                <div className="w-full mt-4">
                  <div className="rounded-2xl bg-[#1a1a2e] border border-white/[0.06] overflow-hidden focus-within:border-white/[0.1] transition-colors">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onInput={handleTextareaInput}
                      onKeyDown={handleKeyDown}
                      placeholder="Message GhostScore..."
                      rows={1}
                      className="w-full min-h-[44px] max-h-[200px] py-3 pl-4 pr-4 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none resize-none"
                      style={{ height: "44px" }}
                    />
                    <div className="flex items-center justify-between px-3 pb-3 pt-0">
                      <button
                        type="button"
                        className="p-2 rounded-lg text-white/40 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
                        aria-label="Attach"
                      >
                        <PlusIcon />
                      </button>
                      <button
                        type="button"
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                          input.trim() && !isLoading
                            ? "bg-[#10b981] text-white hover:bg-emerald-500"
                            : "bg-white/[0.08] text-white/30 cursor-not-allowed"
                        }`}
                        aria-label="Send"
                      >
                        <SendUpIcon />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence mode="popLayout">
                {messages.map((msg, i) => (
                  <motion.div
                    key={`${msg.timestamp.getTime()}-${i}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(i * 0.03, 0.3) }}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="group flex gap-3 max-w-[85%]">
                        <span className="text-[16px] shrink-0 mt-0.5" role="img" aria-label="Ghost">
                          👻
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-white/50 mb-1">GhostScore</p>
                          <div
                            className="text-sm text-white/90 leading-relaxed [&_code]:bg-white/[0.08] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:text-white/80 [&_pre]:bg-white/[0.08] [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs [&_pre]:font-mono [&_pre]:my-2 [&_pre]:overflow-x-auto"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                          />
                          <p className="text-xs text-white/30 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {formatTime(msg.timestamp)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="group max-w-[85%]">
                        <div className="rounded-lg bg-white/[0.05] border border-white/[0.06] px-4 py-3 text-sm text-white">
                          <div
                            className="whitespace-pre-wrap break-words [&_code]:bg-white/[0.1] [&_code]:px-1 [&_code]:rounded"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                          />
                        </div>
                        <p className="text-xs text-white/30 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {formatTime(msg.timestamp)}
                        </p>
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Typing indicator */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3"
                  >
                    <span className="text-base shrink-0 mt-0.5" role="img" aria-label="Ghost">
                      👻
                    </span>
                    <div className="flex items-center gap-1 py-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-[pulse_1.4s_ease-in-out_infinite]" />
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* New messages pill */}
      {showNewMessages && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={scrollToBottom}
            className="rounded-full px-4 py-2 bg-white/[0.08] border border-white/[0.1] text-xs text-white/70 hover:bg-white/[0.12] transition-colors shadow-lg"
          >
            ↓ New messages
          </button>
        </div>
      )}

      {/* Conversation view: input pinned at bottom (only when has messages) */}
      {hasMessages && (
        <>
          {/* Optional content above input (e.g. Approve Payment) */}
          {aboveInput && (
            <div className="shrink-0 px-4 pb-2">
              <div className="max-w-[680px] mx-auto">{aboveInput}</div>
            </div>
          )}

          {/* Input container — pinned bottom */}
          <div className="shrink-0 py-5 px-4 border-t border-white/[0.06]">
            <div className="max-w-[680px] mx-auto">
              <div className="rounded-2xl bg-[#1a1a2e] border border-white/[0.06] overflow-hidden focus-within:border-white/[0.1] transition-colors">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onInput={handleTextareaInput}
                  onKeyDown={handleKeyDown}
                  placeholder="Message GhostScore..."
                  rows={1}
                  className="w-full min-h-[44px] max-h-[200px] py-3 pl-4 pr-4 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none resize-none"
                  style={{ height: "44px" }}
                />
                <div className="flex items-center justify-between px-3 pb-3 pt-0">
                  <button
                    type="button"
                    className="p-2 rounded-lg text-white/40 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
                    aria-label="Attach"
                  >
                    <PlusIcon />
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      input.trim() && !isLoading
                        ? "bg-[#10b981] text-white hover:bg-emerald-500"
                        : "bg-white/[0.08] text-white/30 cursor-not-allowed"
                    }`}
                    aria-label="Send"
                  >
                    <SendUpIcon />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
