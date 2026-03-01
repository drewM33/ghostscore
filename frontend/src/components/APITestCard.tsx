import { useState, useCallback } from "react";
import type { TierLevel } from "../types";
import { TIER_META } from "../types";
import { api, type APIError } from "../services/api";

interface PaymentHeaders {
  amount: string;
  token: string;
  recipient: string;
}

interface Props {
  name: string;
  requiredTier: TierLevel;
  price: string;
  currentTier: TierLevel;
  agentAddress: string;
  onCall: () => Promise<unknown>;
  onCallPaid: () => Promise<unknown>;
  onPaymentComplete?: (res: { newScore: number; newTier: number; nullifierHash: string }) => void;
  renderResult?: (data: unknown) => React.ReactNode;
  icon?: "shield" | "bolt" | "network";
  description?: string;
  animationDelay?: number;
}

type CardState =
  | "idle"
  | "locked"
  | "loading"
  | "payment_required"
  | "paying"
  | "success"
  | "error";

const Spinner = () => (
  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function NetworkIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

export function APITestCard({
  name,
  requiredTier,
  price,
  currentTier,
  agentAddress,
  onCall,
  onCallPaid,
  onPaymentComplete,
  renderResult,
  icon = "shield",
  description,
  animationDelay = 0,
}: Props) {
  const [state, setState] = useState<CardState>("idle");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string>("");
  const [paymentHeaders, setPaymentHeaders] = useState<PaymentHeaders | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const isLocked = currentTier < requiredTier;

  const handleCall = useCallback(async () => {
    if (isLocked) return;
    setState("loading");
    setResult(null);
    setError("");
    setPaymentHeaders(null);
    const t0 = Date.now();

    try {
      const data = await onCall();
      setLatency(Date.now() - t0);
      setResult(data);
      setState("success");
    } catch (err: unknown) {
      setLatency(Date.now() - t0);
      const e = err as APIError;
      if (e?.status === 402 && e.headers) {
        setPaymentHeaders({
          amount: e.headers["X-Payment-Amount"],
          token: e.headers["X-Payment-Token"],
          recipient: e.headers["X-Payment-Recipient"],
        });
        setState("payment_required");
        return;
      }
      if (e?.status === 403) {
        setError(e.message || `Tier ${requiredTier} required (you have ${currentTier})`);
        setState("error");
        return;
      }
      setError(e?.message || String(err));
      setState("error");
    }
  }, [isLocked, onCall, requiredTier, currentTier]);

  const handlePayAndAccess = useCallback(async () => {
    setState("paying");
    try {
      const data = await onCallPaid();
      const payment = (data as Record<string, unknown>)?.payment as
        | { txHash?: string; nullifierHash?: string; amount?: string; newScore?: number; newTier?: number }
        | undefined;
      if (payment?.nullifierHash) {
        const score = await api.getScore(agentAddress);
        onPaymentComplete?.({
          newScore: score.score,
          newTier: score.tier,
          nullifierHash: payment.nullifierHash,
        });
      }
      setResult(data);
      setPaymentHeaders(null);
      setState("success");
    } catch (retryErr: unknown) {
      const e = retryErr as APIError;
      setError(e?.message || "Payment failed");
      setState("error");
    }
  }, [agentAddress, onCallPaid, onPaymentComplete]);

  const tierMeta = TIER_META[requiredTier];

  const borderClass = isLocked
    ? "border-gray-800/80 bg-gray-900/20"
    : state === "success"
      ? "border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-500/40"
      : state === "payment_required"
        ? "border-amber-500/30 bg-amber-950/10 hover:border-amber-500/40"
        : state === "error"
          ? "border-red-500/30 bg-red-950/10 hover:border-red-500/40"
          : "border-gray-700/50 hover:border-emerald-500/20";

  const iconEl =
    icon === "bolt" ? <BoltIcon className="w-4 h-4 text-gray-400" /> :
    icon === "network" ? <NetworkIcon className="w-4 h-4 text-gray-500" /> :
    <ShieldIcon className="w-4 h-4 text-gray-400" />;

  return (
    <div
      className={`rounded-xl border transition-all duration-300 card-fade-in ${borderClass} ${isLocked ? "opacity-60" : ""}`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isLocked ? "bg-gray-800/60" : "bg-gray-800/80"}`}>
            {isLocked ? <LockIcon className="w-4 h-4 text-gray-600" /> : iconEl}
          </div>
          <h3 className="text-sm font-semibold text-white">{name}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-[0.08em] ${tierMeta.bgColor} ${tierMeta.color}`}>
            Tier {requiredTier}
          </span>
          {!isLocked && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 uppercase tracking-[0.08em]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE{latency !== null ? ` ~${latency}ms` : ""}
            </span>
          )}
        </div>
      </div>

      {description && (
        <p className="px-4 text-xs text-gray-500 leading-relaxed">{description}</p>
      )}

      {!description && (
        <p className="px-4 text-xs text-gray-600">{price} USDC per call</p>
      )}

      {/* Divider */}
      <div className="h-px bg-gray-700/40 mx-4 my-3" />

      {/* Action area */}
      <div className="px-4 pb-4 space-y-3">
        {isLocked ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <LockIcon className="w-4 h-4 text-gray-600" />
            <p className="text-xs text-gray-500 uppercase tracking-[0.08em]">Score {tierMeta.minScore}+ required</p>
          </div>
        ) : state === "payment_required" && paymentHeaders ? (
          <div className="space-y-3">
            <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-700/40 text-xs space-y-1">
              <p className="text-amber-400 font-semibold uppercase tracking-[0.08em]">HTTP 402 — Payment Required</p>
              <div className="text-gray-300 font-mono space-y-0.5 mt-1.5">
                <p>Amount: <span className="text-amber-300">{paymentHeaders.amount}</span></p>
                <p>Token: <span className="text-amber-300 break-all">{paymentHeaders.token}</span></p>
                <p>To: <span className="text-amber-300 break-all">{paymentHeaders.recipient}</span></p>
              </div>
            </div>
            <button
              onClick={handlePayAndAccess}
              className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-amber-500/20 uppercase tracking-[0.08em]"
            >
              Pay &amp; Access
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={handleCall}
              disabled={state === "loading" || state === "paying"}
              className="w-full py-2 rounded-lg bg-transparent border border-white/[0.08] hover:border-white/[0.15] disabled:opacity-50 disabled:cursor-wait text-gray-400 hover:text-white text-sm transition-all flex items-center justify-center gap-2"
            >
              {state === "loading" || state === "paying" ? (
                <>
                  <Spinner />
                  {state === "paying" ? "Processing Payment..." : "Calling..."}
                </>
              ) : (
                <>
                  Call Endpoint
                  <span className="text-gray-400">→</span>
                </>
              )}
            </button>
          </>
        )}

        {state === "success" && result != null && (
          <div className="p-2.5 rounded-lg bg-gray-900/80 border border-emerald-500/20 text-xs text-emerald-300 max-h-40 overflow-auto">
            <div className="flex items-center gap-1.5 mb-1.5 text-emerald-400 font-semibold uppercase tracking-[0.08em] text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>200 OK</span>
            </div>
            {renderResult ? (
              renderResult(result)
            ) : (
              <pre className="whitespace-pre-wrap break-all text-emerald-300/80">
                {JSON.stringify(result, null, 2) as string}
              </pre>
            )}
          </div>
        )}

        {state === "error" && error && (
          <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-700/40 text-xs text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
