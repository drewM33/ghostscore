import { useEffect, useState } from "react";
import { api } from "../services/api";
import { MOCK_APIS } from "../mocks/data";
import type { APIInfo, GhostEvent, TierLevel } from "../types";
import { TIER_META } from "../types";

// Descriptions matching Agent dashboard Shielded Endpoints cards
const API_DESCRIPTIONS: Record<string, string> = {
  "Market Data":
    "Zero-knowledge relay for private transaction routing across L2 bridges.",
  "Agent Discovery":
    "High-frequency oracle endpoint for real-time price feeds with MEV protection.",
  "Agent Discovery (ERC-8004)":
    "High-frequency oracle endpoint for real-time price feeds with MEV protection.",
  "Agent Coordination":
    "Vault-secured coordination protocol for trusted multi-agent task execution.",
  "Shielded Transfer Relay":
    "Execute a real shielded transfer through Unlink to any address.",
  "ZK Identity Attestation":
    "On-chain score and tier verification with signed attestation.",
};

function ApiIcon({ name }: { name: string }) {
  const iconClass = "w-4 h-4 text-gray-400";
  if (name.includes("Agent Discovery"))
    return (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    );
  if (name === "Agent Coordination")
    return (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    );
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

interface Props {
  events: GhostEvent[];
}

export function ProviderDashboard({ events }: Props) {
  const [apis, setApis] = useState<APIInfo[]>(MOCK_APIS);

  useEffect(() => {
    api
      .getProviderAPIs()
      .then((data) => setApis(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const totalRevenue = apis.reduce(
    (sum, a) => sum + parseFloat(a.totalRevenue),
    0
  );
  const totalCalls = apis.reduce((sum, a) => sum + a.totalCalls, 0);

  const callHistory = events
    .filter((e) => e.type === "payment:made" || e.type === "score:updated" || e.type === "api:called")
    .slice(0, 20);

  return (
    <div className="rounded-xl overflow-hidden border border-gray-800 bg-[#0b0b0f]">
      {/* ── 1. Privacy banner (subtle, dark, no purple gradient) ───────────── */}
      <div className="px-6 py-4 border-b border-gray-800/70">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 flex items-center justify-center gap-2">
          <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <p className="text-sm text-gray-400">
            All agent identities are private. Revenue flows in. Agent addresses stay hidden via Unlink shielded transfers.
          </p>
        </div>
      </div>

      {/* ── 2. Stats strip (horizontal bar like Agent dashboard) ───────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-800/70 border-b border-gray-800/70">
        <div className="px-4 py-5 flex items-center justify-center gap-1.5 text-sm">
          <span className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Revenue</span>
          <span className="text-white font-medium tabular-nums">{totalRevenue.toFixed(3)} USDC</span>
        </div>
        <div className="px-4 py-5 flex items-center justify-center gap-1.5 text-sm">
          <span className="text-[10px] uppercase tracking-[0.1em] text-gray-500">API Calls</span>
          <span className="text-white font-medium tabular-nums">{totalCalls}</span>
        </div>
        <div className="px-4 py-5 flex items-center justify-center gap-1.5 text-sm">
          <span className="text-[10px] uppercase tracking-[0.1em] text-gray-500">APIs</span>
          <span className="text-white font-medium tabular-nums">{apis.length}</span>
        </div>
        <div className="px-4 py-5 flex items-center justify-center gap-1.5 text-sm">
          <span className="text-white text-xs">Shielded via Unlink</span>
          <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      {/* ── 3. Main two-column: API cards + Recent calls ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 border-t border-gray-800/70 divide-y lg:divide-y-0 lg:divide-x divide-gray-800/70">
        {/* Left: Registered APIs (Shielded Endpoints style) */}
        <div className="p-6">
          <h2 className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-5 font-medium">
            Registered APIs
          </h2>
          <div className="space-y-3">
            {apis.map((a) => (
              <div
                key={a.apiId}
                className="rounded-xl border border-gray-700/50 bg-white/[0.03] hover:border-emerald-500/20 transition-all duration-300 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gray-800/80">
                      <ApiIcon name={a.name} />
                    </div>
                    <h3 className="text-sm font-semibold text-white">{a.name}</h3>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-[0.08em] shrink-0 ${TIER_META[a.requiredTier as TierLevel].bgColor} ${TIER_META[a.requiredTier as TierLevel].color}`}>
                    Tier {a.requiredTier}
                  </span>
                </div>
                {API_DESCRIPTIONS[a.name] && (
                  <p className="mt-3 text-xs text-gray-500 leading-relaxed">
                    {API_DESCRIPTIONS[a.name]}
                  </p>
                )}
                <div className="h-px bg-gray-700/40 mx-0 my-3" />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-gray-500 mb-0.5">Price/Call</p>
                    <p className="text-gray-200 font-mono">{a.pricePerCall} USDC</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-gray-500 mb-0.5">Total Calls</p>
                    <p className="text-blue-400 font-mono">{a.totalCalls}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-gray-500 mb-0.5">Revenue</p>
                    <p className="text-emerald-400 font-mono text-base font-semibold">{a.totalRevenue} USDC</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Recent API Calls (Ghost Activity style) */}
        <div className="p-6 flex flex-col">
          <h2 className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-1 font-medium">
            Recent API Calls
          </h2>

          <div className="flex-1 min-h-0">
            {callHistory.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3 text-center">
                <svg className="w-10 h-10 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C7.029 2 3 6.029 3 11v8.5c0 .414.336.75.75.75s.75-.336.75-.75V19h.75c.414 0 .75-.336.75-.75S5.664 18 5.25 18H4.5v-1.5h.75c.414 0 .75-.336.75-.75s-.336-.75-.75-.75H4.5V11c0-4.136 3.364-7.5 7.5-7.5s7.5 3.364 7.5 7.5v4h-.75c-.414 0-.75.336-.75.75s.336.75.75.75H19.5v1.5h-.75c-.414 0-.75.336-.75.75s.336.75.75.75h.75v.5c0 .414.336.75.75.75s.75-.336.75-.75V11c0-4.971-4.029-9-9-9zm-2.25 9.75a1.125 1.125 0 100-2.25 1.125 1.125 0 000 2.25zm4.5 0a1.125 1.125 0 100-2.25 1.125 1.125 0 000 2.25z" />
                </svg>
                <p className="text-[12px] text-gray-600 leading-relaxed">
                  No API calls yet.
                  <br />
                  Waiting for agent activity.
                </p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {callHistory.map((evt, idx) => {
                  const label =
                    evt.type === "payment:made"
                      ? `Shield Deposit`
                      : evt.type === "score:updated"
                        ? `Proof Submit`
                        : (evt.data.apiName as string) || `Relay Forward`;
                  const amount =
                    evt.type === "payment:made"
                      ? `+${(evt.data.amount as string) || "?"} MON`
                      : evt.type === "score:updated"
                        ? `Score ${(evt.data.newScore as number) ?? ""}`
                        : `-0.00 MON`;
                  const amountPositive =
                    evt.type === "payment:made" && !evt.data.error
                      ? true
                      : evt.type === "score:updated";
                  const borderColor =
                    idx === 0
                      ? "border-l-emerald-400"
                      : idx === 1
                        ? "border-l-emerald-500/60"
                        : "border-l-emerald-700/40";
                  const hash = evt.data.nullifier
                    ? `${String(evt.data.nullifier).slice(0, 6)}...${String(evt.data.nullifier).slice(-4)}`
                    : null;

                  return (
                    <div
                      key={evt.id}
                      className={`flex items-center justify-between gap-3 py-3.5 border-b border-gray-800/60 border-l-2 pl-4 overflow-hidden ${borderColor}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white leading-tight truncate">{label}</p>
                        {hash ? (
                          <p className="text-[11px] text-gray-500 font-mono mt-0.5">{hash}</p>
                        ) : (
                          <p className="text-[11px] text-gray-600 mt-0.5 truncate">
                            {evt.type === "api:called"
                              ? `API called: ${(evt.data.apiName as string) || `ID ${evt.data.apiId}`}`
                              : evt.type === "payment:made"
                                ? `Payment: ${(evt.data.amount as string) ?? "?"} MON`
                                : `Score → ${evt.data.newScore}`}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-[13px] font-semibold whitespace-nowrap ${
                            amountPositive ? "text-emerald-400" : "text-gray-300"
                          }`}
                        >
                          {amount}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5 whitespace-nowrap">
                          {timeAgo(evt.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* bottom padding so the last section doesn't hug the rounded corner */}
      <div className="pb-2" />
    </div>
  );
}
