import { useEffect, useState, useCallback } from "react";
import { NullifierList } from "../components/NullifierList";
import { api } from "../services/api";
import type {
  NullifierEntry,
  GovernanceStatus,
  ValidationStats,
  ComplianceReport,
} from "../types";
import { MOCK_NULLIFIERS, MOCK_GOVERNANCE, MOCK_VALIDATION_STATS } from "../mocks/data";

export function ComplianceView() {
  const [nullifiers, setNullifiers] = useState<NullifierEntry[]>(MOCK_NULLIFIERS);
  const [governance, setGovernance] = useState<GovernanceStatus>(MOCK_GOVERNANCE);
  const [validations, setValidations] = useState<ValidationStats>(MOCK_VALIDATION_STATS);

  useEffect(() => {
    api.getGovernance().then(setGovernance);
    api.getValidationStats().then(setValidations);
    api.getNullifiers("all").then(setNullifiers).catch(() => {});
  }, []);

  function exportReport() {
    const report: ComplianceReport = {
      generatedAt: new Date().toISOString(),
      totalPayments: nullifiers.length,
      nullifiers,
      governance,
      validations,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ghost-score-compliance-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const [copied, setCopied] = useState<string | null>(null);

  const copyAddress = useCallback((addr: string) => {
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(addr);
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  function truncateAddress(addr: string) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  return (
    <div className="rounded-xl overflow-hidden border border-gray-800 bg-[#0b0b0f]">
      {/* ── 1. Privacy banner (subtle dark, no teal gradient) ───────────────── */}
      <div className="px-6 py-4 border-b border-gray-800/70">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 flex items-end justify-center gap-2">
          <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-300">
              Amounts and counterparties are sealed
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Nullifier hashes prove payment activity occurred without revealing who paid whom or how much.
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. Stats strip (horizontal bar like Agent dashboard) ───────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-800/70 border-b border-gray-800/70">
        <div className="px-4 py-5 flex items-center justify-center gap-1.5 text-sm">
          <span className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Total Payments</span>
          <span className="text-white font-medium tabular-nums">{nullifiers.length}</span>
        </div>
        <div className="px-4 py-5 flex items-center justify-center gap-1.5 text-sm">
          <span className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Validated Actions</span>
          <span className="text-white font-medium tabular-nums">{validations.totalValidations}</span>
        </div>
        <div className="px-4 py-5 flex items-center justify-center gap-1.5 text-sm">
          <span className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Success Rate</span>
          <span className="text-white font-medium tabular-nums">{(validations.successRate * 100).toFixed(1)}%</span>
        </div>
        <div className="px-4 py-5 flex items-center justify-center gap-1.5 text-sm">
          <span className="text-[10px] uppercase tracking-[0.1em] text-gray-500">System Status</span>
          <span className={`font-medium ${governance.paused ? "text-red-400" : "text-emerald-400"}`}>
            {governance.paused ? "Paused" : "Active"}
          </span>
        </div>
      </div>

      {/* ── 3. Main two-column: Nullifier Proofs | Governance ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 border-t border-gray-800/70 divide-y lg:divide-y-0 lg:divide-x divide-gray-800/70">
        {/* Left: On-Chain Nullifier Proofs (Agent Nullifier History style) */}
        <div className="p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] uppercase tracking-[0.14em] text-gray-400 font-medium">
              On-Chain Nullifier Proofs
            </h2>
            <button
              onClick={exportReport}
              className="px-3 py-1.5 rounded-lg bg-transparent border border-white/[0.08] hover:border-white/[0.15] text-gray-400 hover:text-white text-xs transition-all flex items-center gap-2"
            >
              Export Report
              <span className="text-gray-400">→</span>
            </button>
          </div>
          <div className="rounded-2xl border border-white/[0.04] bg-[#0d1117]/80 backdrop-blur-xl p-6 flex-1">
            <NullifierList
              nullifiers={nullifiers}
              title="All Nullifier Hashes"
            />
          </div>
        </div>

        {/* Right: Governance (Agent card style) */}
        <div className="p-6 flex flex-col">
          <h2 className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-5 font-medium">
            Governance
          </h2>
          <div className="rounded-2xl border border-white/[0.04] bg-[#0d1117]/80 backdrop-blur-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Status</span>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  governance.paused
                    ? "bg-red-900/50 text-red-400"
                    : "bg-emerald-900/50 text-emerald-400"
                }`}
              >
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                    governance.paused ? "bg-red-400" : "bg-emerald-400"
                  }`}
                />
                {governance.paused ? "Paused" : "Active"}
              </span>
            </div>

            {/* Oracle address with copy */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-gray-500 mb-1.5">
                Current Oracle
              </p>
              <div className="flex items-center gap-2">
                <code className="text-sm text-emerald-400 font-mono">
                  {truncateAddress(governance.oracle)}
                </code>
                <button
                  onClick={() => copyAddress(governance.oracle)}
                  className="p-1 rounded hover:bg-white/[0.06] transition-colors group"
                  title="Copy full address"
                >
                  {copied === governance.oracle ? (
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Signers */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-gray-500 mb-1.5">
                Multisig Signers (2-of-3)
              </p>
              <div className="space-y-1.5">
                {governance.signers.map((s, i) => (
                  <div key={s} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 w-5 text-right text-xs">#{i + 1}</span>
                    <code className="text-emerald-400 font-mono text-xs flex-1">
                      {truncateAddress(s)}
                    </code>
                    <button
                      onClick={() => copyAddress(s)}
                      className="p-0.5 rounded hover:bg-white/[0.06] transition-colors group shrink-0"
                      title="Copy"
                    >
                      {copied === s ? (
                        <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3 text-gray-600 group-hover:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Proposals */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-gray-500 mb-1.5">
                Proposals
              </p>
              {governance.proposals.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No proposals submitted.
                </p>
              ) : (
                <div className="space-y-2">
                  {governance.proposals.map((p) => (
                    <div
                      key={p.id}
                      className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.04] text-sm"
                    >
                      <div className="flex justify-between">
                        <span className="text-gray-300">Proposal #{p.id}</span>
                        <span
                          className={
                            p.executed ? "text-emerald-400" : "text-amber-400"
                          }
                        >
                          {p.executed
                            ? "Executed"
                            : `${p.approvalCount}/2 approvals`}
                        </span>
                      </div>
                      <code className="text-xs text-emerald-400/80 font-mono mt-1 block">
                        New oracle: {truncateAddress(p.newOracle)}
                      </code>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-gray-600 mt-2 italic">
                Oracle changes require 2-of-3 multisig approval + timelock.
              </p>
            </div>

            {/* Validation Stats */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-gray-500 mb-1.5">
                Validation Stats
              </p>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Total: </span>
                  <span className="text-emerald-400 font-mono">
                    {validations.totalValidations}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Success: </span>
                  <span className="text-emerald-400 font-mono">
                    {(validations.successRate * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* bottom padding so the last section doesn't hug the rounded corner */}
      <div className="pb-2" />
    </div>
  );
}
