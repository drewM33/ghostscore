import { useState, useRef, useEffect, useCallback } from "react";
import { api, type APIError } from "../services/api";

interface Message {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: Date;
  type?: "text" | "payment_prompt" | "payment_confirmed" | "api_response" | "error";
  meta?: {
    amount?: string;
    token?: string;
    recipient?: string;
    txHash?: string;
    endpoint?: string;
    data?: unknown;
  };
}

interface Props {
  agentAddress: string;
  currentTier: number;
  onPaymentComplete?: (res: { newScore: number; newTier: number; nullifierHash: string }) => void;
}

const ENDPOINT_MAP: Record<string, { path: string; tier: number; price: string; call: (addr: string, paid: boolean) => Promise<unknown> }> = {
  market: { path: "/api/market-data", tier: 1, price: "0.001", call: (addr, paid) => api.callMarketData(addr, paid) },
  discover: { path: "/api/agent-discovery", tier: 2, price: "0.005", call: (addr, paid) => api.callAgentDiscovery(addr, 1, paid) },
  coordinate: { path: "/api/agent-coordination", tier: 3, price: "0.01", call: (addr, paid) => api.callAgentCoordination(addr, "0x0000000000000000000000000000000000000002", "1000000", "coordination", paid) },
};

function detectEndpoint(message: string): string | null {
  const lower = message.toLowerCase();
  if (lower.includes("market") || lower.includes("price") || lower.includes("mon")) return "market";
  if (lower.includes("discover") || lower.includes("find agent") || lower.includes("search agent")) return "discover";
  if (lower.includes("coordinate") || lower.includes("collaborate") || lower.includes("task")) return "coordinate";
  return null;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function ChatView({ agentAddress, currentTier, onPaymentComplete }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      role: "agent",
      content: "Welcome to GhostScore. I can access on-chain market data, discover agents, or coordinate tasks — all through private x402 payments on Monad. What do you need?",
      timestamp: new Date(),
      type: "text",
    },
  ]);
  const [input, setInput] = useState("");
  const [pendingPayment, setPendingPayment] = useState<{
    messageId: string;
    endpoint: string;
    amount: string;
    token: string;
    recipient: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = useCallback((msg: Omit<Message, "id" | "timestamp">) => {
    const newMsg: Message = { ...msg, id: generateId(), timestamp: new Date() };
    setMessages((prev) => [...prev, newMsg]);
    return newMsg.id;
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isProcessing) return;
    setInput("");

    addMessage({ role: "user", content: text });

    const endpoint = detectEndpoint(text);
    if (!endpoint) {
      addMessage({
        role: "agent",
        content: "I can help with:\n• **Market data** — ask about prices, MON, market info\n• **Agent discovery** — find or search for agents\n• **Agent coordination** — coordinate tasks between agents\n\nWhat would you like to do?",
        type: "text",
      });
      return;
    }

    const ep = ENDPOINT_MAP[endpoint];

    if (currentTier < ep.tier) {
      addMessage({
        role: "system",
        content: `🔒 This endpoint requires **Tier ${ep.tier}+**. Your current tier is ${currentTier}. Build more reputation to unlock this.`,
        type: "error",
      });
      return;
    }

    setIsProcessing(true);

    addMessage({
      role: "system",
      content: `Calling ${ep.path}...`,
      type: "text",
    });

    try {
      const data = await ep.call(agentAddress, false);
      addMessage({
        role: "agent",
        content: "Here's the data:",
        type: "api_response",
        meta: { data, endpoint: ep.path },
      });
      setIsProcessing(false);
    } catch (err: unknown) {
      const e = err as APIError;
      if (e?.status === 402) {
        const paymentId = addMessage({
          role: "system",
          content: `⚡ **x402 Payment Required**\n\nEndpoint: \`${ep.path}\`\nAmount: **${ep.price} USDC**\nProtocol: Unlink (Private)\n\nThis payment is routed through Unlink so your transaction amount and identity stay confidential.`,
          type: "payment_prompt",
          meta: {
            amount: ep.price,
            token: e.headers?.["X-Payment-Token"] || e.headers?.["x-payment-token"] || "USDC",
            recipient: e.headers?.["X-Payment-Recipient"] || e.headers?.["x-payment-recipient"] || "",
            endpoint: ep.path,
          },
        });
        setPendingPayment({
          messageId: paymentId,
          endpoint: endpoint,
          amount: ep.price,
          token: "USDC",
          recipient: e.headers?.["X-Payment-Recipient"] || e.headers?.["x-payment-recipient"] || "",
        });
        setIsProcessing(false);
      } else {
        addMessage({
          role: "system",
          content: `❌ Error: ${e?.message || String(err)}`,
          type: "error",
        });
        setIsProcessing(false);
      }
    }
  }, [input, isProcessing, currentTier, addMessage]);

  const handleApprovePayment = useCallback(async () => {
    if (!pendingPayment) return;
    setIsProcessing(true);

    addMessage({
      role: "system",
      content: "🔄 Processing private payment via Unlink...",
      type: "text",
    });

    try {
      const payRes = await api.makePayment(agentAddress);
      onPaymentComplete?.(payRes);

      addMessage({
        role: "system",
        content: `✅ **Payment Confirmed**\n\nAmount: ${pendingPayment.amount} USDC\nNullifier: \`${payRes.nullifierHash.slice(0, 16)}...\`\nScore: ${payRes.newScore} → Tier ${payRes.newTier}\n\n[View on MonadScan](https://testnet.monadexplorer.com/tx/${payRes.txHash})`,
        type: "payment_confirmed",
        meta: { txHash: payRes.txHash },
      });

      const ep = ENDPOINT_MAP[pendingPayment.endpoint];
      const data = await ep.call(agentAddress, true);

      addMessage({
        role: "agent",
        content: typeof data === "string" ? data : JSON.stringify(data, null, 2),
        type: "api_response",
        meta: { data, endpoint: ep.path },
      });

      setPendingPayment(null);
    } catch (retryErr: unknown) {
      const e = retryErr as APIError;
      addMessage({
        role: "system",
        content: `❌ ${e?.message || "Payment or data retrieval failed. Try again."}`,
        type: "error",
      });
    }
    setIsProcessing(false);
  }, [pendingPayment, agentAddress, onPaymentComplete, addMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-120px)] bg-gray-950 rounded-xl border border-gray-800">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
          <span className="text-xs font-bold text-black">GS</span>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">GhostScore Agent</h2>
          <p className="text-xs text-gray-500">Private reputation · x402 payments · Monad</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-gray-500">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-md"
                  : msg.role === "agent"
                    ? "bg-gray-800 text-gray-100 rounded-bl-md"
                    : msg.type === "payment_prompt"
                      ? "bg-amber-950/40 border border-amber-700/50 text-amber-100 rounded-bl-md"
                      : msg.type === "payment_confirmed"
                        ? "bg-emerald-950/40 border border-emerald-700/50 text-emerald-100 rounded-bl-md"
                        : msg.type === "error"
                          ? "bg-red-950/40 border border-red-700/50 text-red-200 rounded-bl-md"
                          : "bg-gray-900 text-gray-300 rounded-bl-md"
              }`}
            >
              <div className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{
                __html: msg.content
                  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                  .replace(/`([^`]+)`/g, '<code class="bg-black/30 px-1 rounded text-xs">$1</code>')
                  .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" class="underline hover:opacity-80">$1</a>')
                  .replace(/\n/g, "<br />")
              }} />
              <p className={`text-[10px] mt-2 ${
                msg.role === "user" ? "text-indigo-300" : "text-gray-600"
              }`}>
                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {/* Approve Payment Button */}
        {pendingPayment && !isProcessing && (
          <div className="flex justify-start">
            <button
              onClick={handleApprovePayment}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40"
            >
              ⚡ Approve Payment ({pendingPayment.amount} USDC)
            </button>
          </div>
        )}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-4 border-t border-gray-800">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about market data, discover agents, or coordinate tasks..."
              rows={1}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
              style={{ minHeight: "44px", maxHeight: "120px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "44px";
                target.style.height = target.scrollHeight + "px";
              }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mt-2 text-center">
          Payments are private via Unlink · Reputation on Monad · x402 Protocol
        </p>
      </div>
    </div>
  );
}
