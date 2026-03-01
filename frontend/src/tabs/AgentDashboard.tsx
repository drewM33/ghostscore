import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { APITestCard } from "../components/APITestCard";
import { NullifierList } from "../components/NullifierList";
import type { GhostScoreHook } from "../hooks/useGhostScoreEvents";
import { api } from "../services/api";
import type { AgentScore, AgentProfile, DiscoveredAgent, NullifierEntry, GhostEvent, TierLevel, APIInfo } from "../types";
import { TIER_META } from "../types";

const API_DESCRIPTIONS: Record<string, string> = {
  "Market Data": "Zero-knowledge relay for private transaction routing across L2 bridges.",
  "Agent Discovery (ERC-8004)": "High-frequency oracle endpoint for real-time price feeds with MEV protection.",
  "Agent Discovery": "High-frequency oracle endpoint for real-time price feeds with MEV protection.",
  "Agent Coordination": "Vault-secured coordination protocol for trusted multi-agent task execution.",
  "Shielded Transfer Relay": "Execute a real shielded transfer through Unlink to any address.",
  "ZK Identity Attestation": "On-chain score and tier verification with signed attestation.",
};

function getApiIcon(name: string): "shield" | "bolt" | "network" {
  if (name.includes("Discovery")) return "bolt";
  if (name.includes("Coordination") || name.includes("Relay")) return "network";
  return "shield";
}

function getApiCallHandler(
  a: APIInfo,
  agentAddress: string,
  paid: boolean
): () => Promise<unknown> {
  if (a.name === "Market Data") return () => api.callMarketData(agentAddress, paid);
  if (a.name.includes("Agent Discovery")) return () => api.callAgentDiscovery(agentAddress, 1, paid);
  if (a.name === "Agent Coordination")
    return () =>
      api.callAgentCoordination(
        agentAddress,
        "0x0000000000000000000000000000000000000002",
        "1000000",
        "demo coordination",
        paid
      );
  if (a.name === "Shielded Transfer Relay")
    return () =>
      api.callShieldedRelay(
        agentAddress,
        "0x0000000000000000000000000000000000000002",
        "0.001",
        paid
      );
  if (a.name === "ZK Identity Attestation")
    return () => api.callZkAttestation(agentAddress, agentAddress, 20, paid);
  return () => Promise.reject(new Error(`Unknown API: ${a.name}`));
}

interface Props {
  agentAddress: string;
  ghostScore: GhostScoreHook;
  isNewAgent?: boolean;
}

// ─── Phantom Activity helpers ────────────────────────────────────────────────

const EXPLORER_TX = "https://testnet.monadscan.com/tx/";

const PHANTOM_LABELS: Record<GhostEvent["type"], string> = {
  "payment:made": "Shield Deposit",
  "score:updated": "Proof Submit",
  "tier:changed": "Bridge Exit",
  "api:called": "Relay Forward",
  "validation:new": "Vault Sync",
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

interface PhantomAmountResult {
  text: string;
  positive: boolean;
}

function getPhantomAmount(evt: GhostEvent): PhantomAmountResult | null {
  const d = evt.data;
  switch (evt.type) {
    case "payment:made":
      if (d.error) return null;
      return { text: `+${String(d.amount ?? "?")} MON`, positive: true };
    case "score:updated": {
      const newScore = d.newScore as number | undefined;
      if (newScore !== undefined) return { text: `Score ${newScore}`, positive: true };
      return null;
    }
    case "tier:changed":
      return { text: `→ Tier ${d.newTier}`, positive: true };
    case "api:called":
      return { text: `-0.00 MON`, positive: false };
    case "validation:new":
      return { text: d.success ? "passed" : "failed", positive: !!d.success };
    default:
      return null;
  }
}

function getPhantomHash(evt: GhostEvent): string | null {
  const d = evt.data;
  const hash = (d.txHash ?? d.nullifier ?? d.nullifierHash) as string | undefined;
  return hash ? `${hash.slice(0, 6)}...${hash.slice(-4)}` : null;
}

function getTxHashForLink(evt: GhostEvent): string | null {
  const d = evt.data;
  const txHash = d.txHash as string | undefined;
  return txHash && txHash.length > 0 ? txHash : null;
}

function formatEventMessage(evt: GhostEvent): ReactNode {
  const d = evt.data;
  switch (evt.type) {
    case "score:updated":
      if (d.message) return String(d.message);
      return `Score → ${d.newScore}${d.tierLabel ? ` (${d.tierLabel})` : d.newTier !== undefined ? ` (Tier ${d.newTier})` : ""}`;
    case "tier:changed":
      return `Tier changed: ${d.oldTier} → ${d.newTier}`;
    case "api:called":
      return `API called: ${d.apiName || `ID ${d.apiId}`}`;
    case "validation:new":
      return `Validation: ${d.success ? "passed" : "failed"}`;
    case "payment:made": {
      if (d.error) return `Error: ${d.error}`;
      const hash = d.txHash as string | undefined;
      return `Payment: ${String(d.amount ?? "?")} MON${hash ? ` (${hash.slice(0, 10)}...)` : ""}`;
    }
    default:
      return JSON.stringify(d);
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PhantomRow({ evt, idx }: { evt: GhostEvent; idx: number }) {
  const label = PHANTOM_LABELS[evt.type] ?? evt.type;
  const hash = getPhantomHash(evt);
  const txHash = getTxHashForLink(evt);
  const amount = getPhantomAmount(evt);
  const borderColor =
    idx === 0
      ? "border-l-emerald-400"
      : idx === 1
        ? "border-l-emerald-500/60"
        : "border-l-emerald-700/40";

  return (
    <div
      className={`flex items-center justify-between gap-3 py-3.5 border-b border-gray-800/60 border-l-2 pl-4 overflow-hidden ${borderColor}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white leading-tight truncate">{label}</p>
        {hash ? (
          <p className="text-[11px] text-gray-500 font-mono mt-0.5">
            {txHash ? (
              <a
                href={`${EXPLORER_TX}${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-400 hover:text-teal-300 underline underline-offset-1 decoration-teal-400/40 hover:decoration-teal-300/60 transition-colors"
              >
                {hash}
              </a>
            ) : (
              hash
            )}
          </p>
        ) : (
          <p className="text-[11px] text-gray-600 mt-0.5 truncate">{formatEventMessage(evt)}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        {amount && (
          <p className={`text-[13px] font-semibold whitespace-nowrap ${amount.positive ? "text-emerald-400" : "text-gray-300"}`}>
            {amount.text}
          </p>
        )}
        <p className="text-[11px] text-gray-500 mt-0.5 whitespace-nowrap">{timeAgo(evt.timestamp)}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentDashboard({ agentAddress, ghostScore, isNewAgent = false }: Props) {
  const { score, tier, events, pushEvent } = ghostScore;

  const [localScore, setLocalScore] = useState<AgentScore | null>(
    isNewAgent ? { score: 0, tier: 0, totalPayments: 0, lastPaymentTimestamp: 0 } : null
  );
  const [nullifiers, setNullifiers] = useState<NullifierEntry[]>([]);
  const [paying, setPaying] = useState(false);
  const [profile, setProfile] = useState<AgentProfile | null>(isNewAgent ? ({} as AgentProfile) : null);
  const [agentName, setAgentName] = useState("Agent Alpha");
  const [registering, setRegistering] = useState(false);
  const [previousScore, setPreviousScore] = useState<number>(0);
  const [showRegister, setShowRegister] = useState(false);
  const hydratedRef = useRef(false);

  const effectiveScore = isNewAgent ? (localScore?.score ?? 0) : (localScore?.score ?? score);
  const effectiveTier = isNewAgent ? (localScore?.tier ?? 0) as TierLevel : (localScore?.tier ?? tier);
  const scoreDelta = effectiveScore - previousScore;
  // Only suppress events for truly new agents with zero payments; once they have payments, show the feed
  const hasPayments = (localScore?.totalPayments ?? 0) > 0;
  const effectiveEvents = isNewAgent && !hasPayments ? [] : events;

  // Debug: log events when they change (remove after debugging)
  useEffect(() => {
    console.log("[AgentDashboard] Ghost Activity: events.length =", events.length, "effectiveEvents.length =", effectiveEvents.length, "isNewAgent =", isNewAgent, "hasPayments =", hasPayments);
  }, [events.length, effectiveEvents.length, isNewAgent, hasPayments]);

  // ─── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!agentAddress || isNewAgent) return;
    hydratedRef.current = false;
    api.getScore(agentAddress)
      .then((data) => {
        setLocalScore(data);
        setPreviousScore(data.score);
      })
      .catch(() => {});
    api.getNullifiers(agentAddress)
      .then((data) => {
        const raw = data as { nullifierHashes?: string[] } | NullifierEntry[];
        const arr = Array.isArray(raw) ? raw : raw?.nullifierHashes ?? [];
        const entries: NullifierEntry[] = arr.map((item: string | NullifierEntry) =>
          typeof item === "string" ? { hash: item, timestamp: Date.now() / 1000 } : item
        );
        setNullifiers(entries);
        // Hydrate Ghost Activity from real nullifiers when events are empty (e.g. after refresh)
        if (entries.length > 0 && events.length === 0 && !hydratedRef.current) {
          hydratedRef.current = true;
          api.getScore(agentAddress).then((scoreData) => {
            entries.slice(0, 10).forEach((n, i) => {
              pushEvent({
                id: `hydrate-${n.hash.slice(0, 16)}-${i}`,
                type: "payment:made",
                timestamp: (n.timestamp || Date.now() / 1000) * 1000,
                data: { amount: "0.001", nullifier: n.hash, nullifierHash: n.hash },
              });
              if (i === 0) {
                pushEvent({
                  id: `hydrate-score-${n.hash.slice(0, 16)}`,
                  type: "score:updated",
                  timestamp: (n.timestamp || Date.now() / 1000) * 1000,
                  data: { newScore: scoreData.score, newTier: scoreData.tier },
                });
              }
            });
          }).catch(() => {
            entries.slice(0, 10).forEach((n, i) => {
              pushEvent({
                id: `hydrate-${n.hash.slice(0, 16)}-${i}`,
                type: "payment:made",
                timestamp: (n.timestamp || Date.now() / 1000) * 1000,
                data: { amount: "0.001", nullifier: n.hash, nullifierHash: n.hash },
              });
            });
          });
        }
      })
      .catch(() => {});
    api.getAgentProfile(agentAddress)
      .then((p) => { setProfile(p); if (p.name) setAgentName(p.name); })
      .catch(() => {});
  }, [agentAddress, isNewAgent, pushEvent]);

  // ─── Sync websocket score into localScore ──────────────────────────────────
  const prevScoreRef = useRef<number | null>(null);
  useEffect(() => {
    if (localScore && score > 0 && score !== localScore.score) {
      if (prevScoreRef.current === null) prevScoreRef.current = localScore.score;
      setPreviousScore(prevScoreRef.current);
      prevScoreRef.current = score;
      setLocalScore((prev) => prev ? { ...prev, score, tier } : prev);
    }
  }, [score, tier, localScore]);

  // ─── Registration ──────────────────────────────────────────────────────────
  const handleRegister = useCallback(async () => {
    if (registering) return;
    setRegistering(true);
    try {
      const res = await api.registerAgent(agentAddress, {
        name: agentName,
        description: "Autonomous trading agent",
        capabilities: ["market-data", "payments"],
      });
      if (res.profile) {
        setProfile(res.profile);
      } else {
        setProfile({ name: agentName, description: "Autonomous trading agent", capabilities: ["market-data", "payments"] });
      }
      setShowRegister(false);
      pushEvent({
        id: `local-reg-${Date.now()}`,
        type: "score:updated",
        timestamp: Date.now(),
        data: { message: `Agent "${agentName}" registered` },
      });
    } catch (err: unknown) {
      const e = err as { status?: number; code?: string; message?: string };
      if (e?.code === "ALREADY_REGISTERED" || e?.status === 409) {
        setProfile({ name: agentName, description: "Autonomous trading agent", capabilities: ["market-data", "payments"] });
        setShowRegister(false);
        pushEvent({
          id: `local-reg-${Date.now()}`,
          type: "score:updated",
          timestamp: Date.now(),
          data: { message: `Agent already registered on-chain` },
        });
      } else {
        console.error("[register] POST /agent/register failed:", err);
        pushEvent({
          id: `local-reg-err-${Date.now()}`,
          type: "payment:made",
          timestamp: Date.now(),
          data: { error: e?.message || "Registration failed" },
        } as GhostEvent);
      }
    } finally {
      setRegistering(false);
    }
  }, [agentAddress, agentName, registering, pushEvent]);

  // ─── Payment ───────────────────────────────────────────────────────────────
  const applyPaymentResult = useCallback(
    (res: { newScore: number; newTier: number; nullifierHash: string; txHash?: string; amount?: string; tierLabel?: string }) => {
      setLocalScore((prev) =>
        prev
          ? { ...prev, score: res.newScore, tier: res.newTier as TierLevel, totalPayments: prev.totalPayments + 1, lastPaymentTimestamp: Date.now() / 1000 }
          : { score: res.newScore, tier: res.newTier as TierLevel, totalPayments: 1, lastPaymentTimestamp: Date.now() / 1000 }
      );
      setNullifiers((prev) => [{ hash: res.nullifierHash, timestamp: Date.now() / 1000 }, ...prev]);
      pushEvent({
        id: `local-${Date.now()}`,
        type: "payment:made",
        timestamp: Date.now(),
        data: { amount: res.amount ?? "0.001", txHash: res.txHash, nullifier: res.nullifierHash },
      });
      pushEvent({
        id: `local-score-${Date.now()}`,
        type: "score:updated",
        timestamp: Date.now(),
        data: { newScore: res.newScore, newTier: res.newTier, tierLabel: res.tierLabel, agent: agentAddress },
      });
    },
    [agentAddress, pushEvent]
  );

  const handlePayment = useCallback(async () => {
    if (paying) return;
    setPaying(true);
    try {
      const res = await api.makePayment(agentAddress);
      applyPaymentResult(res);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Payment failed";
      console.error("[payment] POST /pay failed:", err);
      pushEvent({
        id: `local-err-${Date.now()}`,
        type: "payment:made",
        timestamp: Date.now(),
        data: { error: msg },
      } as GhostEvent);
    } finally {
      setPaying(false);
    }
  }, [agentAddress, paying, pushEvent, applyPaymentResult]);

  // ─── Shielded APIs (from GET /provider/apis) ─────────────────────────────────
  const [shieldedApis, setShieldedApis] = useState<APIInfo[]>([]);
  useEffect(() => {
    api.getProviderAPIs().then(setShieldedApis).catch(() => {});
  }, []);

  // ─── Discovery renderer ────────────────────────────────────────────────────
  const renderDiscoveryResults = useCallback((data: unknown) => {
    const agents = data as DiscoveredAgent[];
    if (!Array.isArray(agents) || agents.length === 0) return <p className="text-gray-500 text-xs">No agents found</p>;
    return (
      <div className="space-y-1.5">
        {agents.map((a) => (
          <div key={a.address} className="flex items-center justify-between px-2 py-1.5 rounded bg-gray-800/60">
            <div className="min-w-0 flex-1">
              <span className="text-emerald-300 font-medium text-xs">{a.profile?.name ?? `${a.address.slice(0, 10)}...`}</span>
              {a.profile?.capabilities && <span className="ml-2 text-[10px] text-gray-500">{a.profile.capabilities.join(", ")}</span>}
            </div>
            <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ml-2 ${TIER_META[(a.tier as TierLevel) ?? 0].bgColor} ${TIER_META[(a.tier as TierLevel) ?? 0].color}`}>
              T{a.tier} · {a.score}
            </span>
          </div>
        ))}
      </div>
    );
  }, []);

  // ─── Derived display values ────────────────────────────────────────────────
  const tierLabel = `Tier ${effectiveTier} — ${TIER_META[effectiveTier].label}`;
  const totalPayments = localScore?.totalPayments ?? 0;
  const scoreBarPct = Math.max(0, Math.min(100, effectiveScore));

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl overflow-hidden border border-gray-800 bg-[#0b0b0f]">

      {/* ── 1. Score section ─────────────────────────────────────────────── */}
      <div className="px-6 pt-7 pb-5">
        {/* Tick marks */}
        <div className="flex justify-between text-[10px] text-gray-600 mb-1.5 tracking-[0.08em] uppercase select-none">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>

        {/* Gradient bar */}
        <div
          className="relative h-2.5 w-full rounded-full overflow-hidden score-bar-track"
          style={{
            background:
              "linear-gradient(to right, #ef4444 0%, #f97316 18%, #eab308 36%, #22c55e 52%, #06b6d4 70%, #3b82f6 86%, #818cf8 100%)",
          }}
        >
          {/* Marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 rounded-full bg-white shadow-[0_0_8px_3px_rgba(255,255,255,0.85)]"
            style={{ left: `${scoreBarPct}%`, transform: "translateX(-50%)" }}
          />
        </div>

        {/* Score number */}
        <div className="text-center mt-7 mb-3">
          <div
            className="text-[7rem] font-black text-white leading-none tabular-nums"
            style={{ textShadow: "0 0 60px rgba(255,255,255,0.25), 0 0 120px rgba(255,255,255,0.1)" }}
          >
            {effectiveScore}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-emerald-400 text-[15px] tracking-wide">{tierLabel}</span>
          </div>
          {/* Payment button — lives in the hero, right below tier label */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={handlePayment}
              disabled={paying}
              className="flex items-center justify-center gap-2.5 px-8 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 text-sm font-semibold tracking-widest uppercase shadow-lg shadow-emerald-500/10 transition-all disabled:opacity-50 disabled:cursor-wait"
            >
              {paying ? (
                <>
                  <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                  Make Private Payment (x402)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. Stats row (Previous / Current / Change) ───────────────────── */}
      <div className="grid grid-cols-3 divide-x divide-gray-800/70 border-t border-gray-800/70">
        {[
          { label: "Previous", value: previousScore, delta: false },
          { label: "Current", value: effectiveScore, delta: false },
          { label: "Change", value: scoreDelta, delta: true },
        ].map(({ label, value, delta }) => (
          <div key={label} className="py-5 text-center">
            <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500 mb-1.5">{label}</div>
            <div
              className={`text-3xl font-bold tabular-nums ${
                delta
                  ? value > 0
                    ? "text-emerald-400"
                    : value < 0
                      ? "text-red-400"
                      : "text-gray-500"
                  : "text-white"
              }`}
            >
              {delta && value > 0 ? `+${value}` : value}
            </div>
          </div>
        ))}
      </div>

      {/* ── 4. Info strip ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-800/70 border-t border-gray-800/70">
        <div className="px-4 py-3 flex items-center justify-center gap-1.5 text-sm">
          <span className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Score</span>
          <span className="text-white font-medium">{effectiveScore}/100</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-center gap-1.5 text-sm">
          <span className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Tier</span>
          <span className="text-white font-medium">{tierLabel}</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-center gap-1.5 text-sm">
          <span className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Payments</span>
          <span className="text-white font-medium">{totalPayments}</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-center gap-1.5 text-sm">
          <span className="text-white text-xs">Shielded via Unlink</span>
          <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      {/* ── 5. Main two-column ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 border-t border-gray-800/70 divide-y lg:divide-y-0 lg:divide-x divide-gray-800/70">

        {/* Left: Shielded Endpoints (discovered from GET /provider/apis) */}
        <div className="p-6">
          <h2 className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-5 font-medium">
            Shielded Endpoints
          </h2>
          <div className="space-y-3">
            {shieldedApis
              .filter((a) => a.name?.trim() && a.requiredTier > 0 && parseFloat(a.pricePerCall) > 0)
              .map((a, idx) => (
              <APITestCard
                key={a.apiId}
                name={a.name}
                requiredTier={a.requiredTier as TierLevel}
                price={a.pricePerCall}
                currentTier={effectiveTier}
                agentAddress={agentAddress}
                onCall={() => getApiCallHandler(a, agentAddress, false)()}
                onCallPaid={() => getApiCallHandler(a, agentAddress, true)()}
                onPaymentComplete={applyPaymentResult}
                renderResult={a.name.includes("Discovery") ? renderDiscoveryResults : undefined}
                icon={getApiIcon(a.name)}
                description={API_DESCRIPTIONS[a.name] ?? API_DESCRIPTIONS[a.name.replace(/ \(ERC-8004\)$/, "")] ?? `${a.pricePerCall} USDC per call`}
                animationDelay={idx * 120}
              />
            ))}
          </div>
        </div>

        {/* Right: Ghost Activity */}
        <div className="p-6 flex flex-col">
          <h2 className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-1 font-medium">
            Ghost Activity
          </h2>

          <div className="flex-1 min-h-0">
            {effectiveEvents.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3 text-center">
                <svg className="w-10 h-10 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C7.029 2 3 6.029 3 11v8.5c0 .414.336.75.75.75s.75-.336.75-.75V19h.75c.414 0 .75-.336.75-.75S5.664 18 5.25 18H4.5v-1.5h.75c.414 0 .75-.336.75-.75s-.336-.75-.75-.75H4.5V11c0-4.136 3.364-7.5 7.5-7.5s7.5 3.364 7.5 7.5v4h-.75c-.414 0-.75.336-.75.75s.336.75.75.75H19.5v1.5h-.75c-.414 0-.75.336-.75.75s.336.75.75.75h.75v.5c0 .414.336.75.75.75s.75-.336.75-.75V11c0-4.971-4.029-9-9-9zm-2.25 9.75a1.125 1.125 0 100-2.25 1.125 1.125 0 000 2.25zm4.5 0a1.125 1.125 0 100-2.25 1.125 1.125 0 000 2.25z" />
                </svg>
                <p className="text-[12px] text-gray-600 leading-relaxed">
                  No ghost activity yet.
                  <br />
                  Make a payment to get started.
                </p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {effectiveEvents.slice(0, 8).map((evt, idx) => (
                  <PhantomRow key={evt.id} evt={evt} idx={idx} />
                ))}
              </div>
            )}
          </div>

          {agentAddress && (
            <a
              href={`https://testnet.monadexplorer.com/address/${agentAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-400 transition-colors group"
            >
              View all on MonadScan
              <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* ── 6. Nullifier + optional registration ─────────────────────────── */}
      <div className="border-t border-gray-800/70 px-6 pt-6 pb-0 space-y-4">

        {/* Registration form (when profile is not yet loaded) */}
        {!profile && (
          <div className="rounded-xl border border-gray-700/50 bg-gray-900/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">Register this agent to build on-chain reputation</p>
              <button
                onClick={() => setShowRegister((v) => !v)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showRegister ? "Hide" : "Show"}
              </button>
            </div>
            {showRegister && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Agent name..."
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  onClick={handleRegister}
                  disabled={registering || !agentName.trim()}
                  className="w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-emerald-500/30 disabled:opacity-50 disabled:cursor-wait text-white text-xs font-medium transition-all uppercase tracking-[0.08em]"
                >
                  {registering ? "Registering..." : `Register "${agentName}"`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Nullifier History — glassmorphism card, full width */}
        <div className="rounded-2xl border border-white/[0.04] bg-[#0d1117]/80 backdrop-blur-xl p-6">
          <NullifierList nullifiers={nullifiers} />
        </div>
      </div>

      {/* bottom padding so the last card doesn't hug the rounded corner */}
      <div className="pb-2" />

    </div>
  );
}
