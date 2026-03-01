import { useState, useCallback, useRef, useEffect } from "react";
import { GhostChat, type GhostChatMessage } from "./GhostChat";
import { api, type APIError } from "../services/api";

const FOLLOW_UP_DELAY_MS = 500;
const FOLLOW_UP_MESSAGE = "Is there anything else I can help with?";

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

export function ChatView({ agentAddress, currentTier, onPaymentComplete }: Props) {
  const [messages, setMessages] = useState<GhostChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{
    endpoint: string;
    amount: string;
  } | null>(null);
  const followUpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addMessage = useCallback((msg: Omit<GhostChatMessage, "timestamp">) => {
    const newMsg: GhostChatMessage = { ...msg, timestamp: new Date() };
    setMessages((prev) => [...prev, newMsg]);
  }, []);

  const scheduleFollowUp = useCallback(() => {
    if (followUpTimeoutRef.current) clearTimeout(followUpTimeoutRef.current);
    followUpTimeoutRef.current = setTimeout(() => {
      followUpTimeoutRef.current = null;
      addMessage({ role: "assistant", content: FOLLOW_UP_MESSAGE });
    }, FOLLOW_UP_DELAY_MS);
  }, [addMessage]);

  useEffect(() => {
    return () => {
      if (followUpTimeoutRef.current) clearTimeout(followUpTimeoutRef.current);
    };
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      if (followUpTimeoutRef.current) {
        clearTimeout(followUpTimeoutRef.current);
        followUpTimeoutRef.current = null;
      }
      addMessage({ role: "user", content: text.trim() });

      const endpoint = detectEndpoint(text);
      if (!endpoint) {
        addMessage({
          role: "assistant",
          content:
            "I can help with:\n• **Market data** — ask about prices, MON, market info\n• **Agent discovery** — find or search for agents\n• **Agent coordination** — coordinate tasks between agents\n\nWhat would you like to do?",
        });
        return;
      }

      const ep = ENDPOINT_MAP[endpoint];

      if (currentTier < ep.tier) {
        addMessage({
          role: "assistant",
          content: `🔒 This endpoint requires **Tier ${ep.tier}+**. Your current tier is ${currentTier}. Build more reputation to unlock this.`,
        });
        return;
      }

      setIsLoading(true);

      try {
        const data = await ep.call(agentAddress, false);
        addMessage({
          role: "assistant",
          content: typeof data === "string" ? data : JSON.stringify(data, null, 2),
        });
        scheduleFollowUp();
      } catch (err: unknown) {
        const e = err as APIError;
        if (e?.status === 402) {
          addMessage({
            role: "assistant",
            content: `⚡ **x402 Payment Required**\n\nEndpoint: \`${ep.path}\`\nAmount: **${ep.price} USDC**\nProtocol: Unlink (Private)\n\nApprove the payment to continue.`,
          });
          setPendingPayment({ endpoint, amount: ep.price });
        } else {
          addMessage({
            role: "assistant",
            content: `❌ Error: ${e?.message || String(err)}`,
          });
        }
      }
      setIsLoading(false);
    },
    [isLoading, currentTier, addMessage, agentAddress, scheduleFollowUp]
  );

  const handleApprovePayment = useCallback(async () => {
    if (!pendingPayment) return;
    setIsLoading(true);

    try {
      const payRes = await api.makePayment(agentAddress);
      onPaymentComplete?.(payRes);

      addMessage({
        role: "assistant",
        content: `✅ **Payment Confirmed**\n\nAmount: ${pendingPayment.amount} USDC\nScore: ${payRes.newScore} → Tier ${payRes.newTier}`,
      });

      const ep = ENDPOINT_MAP[pendingPayment.endpoint];
      const data = await ep.call(agentAddress, true);

      addMessage({
        role: "assistant",
        content: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      });
      scheduleFollowUp();

      setPendingPayment(null);
    } catch (retryErr: unknown) {
      const e = retryErr as APIError;
      addMessage({
        role: "assistant",
        content: `❌ ${e?.message || "Payment or data retrieval failed. Try again."}`,
      });
    }
    setIsLoading(false);
  }, [pendingPayment, agentAddress, onPaymentComplete, addMessage, scheduleFollowUp]);

  return (
    <GhostChat
      messages={messages}
      onSend={handleSend}
      isLoading={isLoading}
      aboveInput={
        pendingPayment && !isLoading ? (
          <button
            onClick={handleApprovePayment}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors"
          >
            ⚡ Approve Payment ({pendingPayment.amount} USDC)
          </button>
        ) : undefined
      }
    />
  );
}
