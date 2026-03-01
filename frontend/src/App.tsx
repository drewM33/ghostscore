import React, { useState, useEffect, useCallback, useRef } from "react";
import { AgentDashboard } from "./tabs/AgentDashboard";
import { ProviderDashboard } from "./tabs/ProviderDashboard";
import { ComplianceView } from "./tabs/ComplianceView";
import { ChatView } from "./components/ChatView";
import { ConnectWallet } from "./components/ConnectWallet";
import { GhostReveal } from "./components/GhostReveal";
import { PowerUpCinematic } from "./components/PowerUpCinematic";
import { useGhostScoreEvents } from "./hooks/useGhostScoreEvents";
import { api } from "./services/api";
import type { TabId } from "./types";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

// Addresses that have already completed agent registration.
// Lowercased for case-insensitive comparison.
const REGISTERED_ADDRESSES = new Set([
  "0x5720dbd6c2135b9c1b06d32b4d3c22084238feb7",
]);

type RegistrationStatus = "disconnected" | "unregistered" | "registering" | "registered";

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─── Sidebar nav icons ────────────────────────────────────────────────────────

function ShieldNavIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function ServerNavIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  );
}

function CheckCircleNavIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function MessageNavIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-3.5 h-3.5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.688a9.065 9.065 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
  );
}

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: TabId; label: string; Icon: () => React.ReactElement }[] = [
  { id: "agent",      label: "Agent",      Icon: ShieldNavIcon      },
  { id: "provider",   label: "Provider",   Icon: ServerNavIcon      },
  { id: "compliance", label: "Compliance", Icon: CheckCircleNavIcon },
  { id: "chat",       label: "Chat",       Icon: MessageNavIcon     },
];

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [status, setStatus]               = useState<RegistrationStatus>("disconnected");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletError, setWalletError]     = useState("");
  const [activeTab, setActiveTab]         = useState<TabId>("agent");
  const [copied, setCopied]               = useState(false);
  const [isNewRegistration, setIsNewRegistration] = useState(false);

  // Ghost reveal overlay state
  const [showGhostReveal, setShowGhostReveal]   = useState(false);
  const [walletConnected, setWalletConnected]   = useState(false);
  const pendingAddressRef                        = useRef("");

  // Power-up cinematic (score crosses 50)
  const [powerUpTriggered, setPowerUpTriggered]  = useState(false);
  const prevScoreRef                             = useRef<number>(0);
  const scoreInitializedRef                       = useRef(false);

  const ghostScore = useGhostScoreEvents(walletAddress || null);

  useEffect(() => {
    api.setAgentAddress(walletAddress);
  }, [walletAddress]);

  // Initialize prevScore on mount when registered (so refresh at score 60 doesn't trigger)
  useEffect(() => {
    if (status === "disconnected") {
      scoreInitializedRef.current = false;
      return;
    }
    if (!walletAddress || status !== "registered") return;
    api.getScore(walletAddress).then((data) => {
      prevScoreRef.current = data.score ?? 0;
      scoreInitializedRef.current = true;
    }).catch(() => {
      scoreInitializedRef.current = true;
    });
  }, [walletAddress, status]);

  // Trigger power-up when score crosses 50
  useEffect(() => {
    if (!scoreInitializedRef.current) return;
    const newScore = ghostScore.score;
    const prev = prevScoreRef.current;
    prevScoreRef.current = newScore;
    if (prev < 50 && newScore >= 50 && localStorage.getItem("ghostscore_powerup_shown") !== "true") {
      setPowerUpTriggered(true);
    }
  }, [ghostScore.score]);

  const handlePowerUpComplete = useCallback(() => {
    setPowerUpTriggered(false);
    localStorage.setItem("ghostscore_powerup_shown", "true");
  }, []);

  // Listen for MetaMask account/disconnect changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[];
      if (list.length === 0) {
        setStatus("disconnected");
        setWalletAddress("");
      } else {
        const addr = list[0];
        setWalletAddress(addr);
        setStatus(REGISTERED_ADDRESSES.has(addr.toLowerCase()) ? "registered" : "unregistered");
      }
    };

    const handleDisconnect = () => {
      setStatus("disconnected");
      setWalletAddress("");
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("disconnect", handleDisconnect);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("disconnect", handleDisconnect);
    };
  }, []);

  const handleConnectWallet = useCallback(async () => {
    setWalletError("");
    if (!window.ethereum) {
      setWalletError("No wallet detected. Install MetaMask to continue.");
      return;
    }

    // Show the ghost reveal overlay immediately while MetaMask prompt opens
    pendingAddressRef.current = "";
    setWalletConnected(false);
    setShowGhostReveal(true);

    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (accounts.length === 0) {
        setShowGhostReveal(false);
        return;
      }

      // Store the address and signal the overlay that the wallet is connected
      pendingAddressRef.current = accounts[0];
      setWalletConnected(true);
    } catch (err) {
      console.error("Wallet connection failed:", err);
      setShowGhostReveal(false);
      setWalletConnected(false);
      setWalletError("Connection rejected. Please try again.");
    }
  }, []);

  // Called by GhostReveal after its exit animation completes
  const handleGhostRevealComplete = useCallback(() => {
    const addr = pendingAddressRef.current;
    setShowGhostReveal(false);
    setWalletConnected(false);
    setWalletAddress(addr);
    setIsNewRegistration(false);
    setStatus(REGISTERED_ADDRESSES.has(addr.toLowerCase()) ? "registered" : "unregistered");
  }, []);

  const handleRegister = useCallback(async () => {
    setStatus("registering");
    await new Promise<void>((resolve) => setTimeout(resolve, 2200));
    REGISTERED_ADDRESSES.add(walletAddress.toLowerCase());
    setIsNewRegistration(true);
    setStatus("registered");
  }, [walletAddress]);

  const handleDisconnect = useCallback(() => {
    setStatus("disconnected");
    setWalletAddress("");
    setWalletError("");
    setIsNewRegistration(false);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [walletAddress]);

  // ── Landing screen (disconnected) ────────────────────────────────────────────
  if (status === "disconnected") {
    return (
      <>
        <ConnectWallet onConnect={handleConnectWallet} error={walletError} />
        {showGhostReveal && (
          <GhostReveal
            animationSrc="/ghost-reveal.mp4"
            walletConnected={walletConnected}
            onComplete={handleGhostRevealComplete}
          />
        )}
      </>
    );
  }

  const isRegistered = status === "registered";
  const navDisabled  = !isRegistered;

  // ── Main layout (sidebar + content) ──────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#06060a] text-gray-100">
      <div className="app-bg" />

      {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 border-r border-white/[0.06] bg-[#0a0a0f] flex flex-col relative z-10">

        {/* Wordmark */}
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/[0.04]">
          <img src="/ghost-logo.png" alt="GhostScore" className="brand-logo" />
          <div>
            <h1 className="text-[15px] font-bold text-white tracking-tight leading-tight">GhostScore</h1>
            <p className="text-[9px] text-gray-600 tracking-widest uppercase mt-0.5">Private Agent Reputation</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 mt-4 flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => { if (!navDisabled) setActiveTab(id); }}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium tracking-wide transition-all ${
                navDisabled
                  ? "text-gray-600 pointer-events-none"
                  : activeTab === id
                  ? "bg-white/[0.06] text-white"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
              }`}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom section */}
        <div className="border-t border-white/[0.04] px-4 pt-4 pb-5 space-y-3">

          {/* Wallet */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-gray-600">Wallet</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                <CopyIcon className="w-3 h-3" />
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <code className="block text-xs text-gray-400 font-mono">
              {truncateAddress(walletAddress)}
            </code>
          </div>

          {/* Disconnect */}
          <button
            onClick={handleDisconnect}
            className="w-full py-2 px-3 rounded-lg text-[11px] font-medium text-gray-500 hover:text-red-400 hover:bg-red-500/[0.08] border border-white/[0.04] hover:border-red-500/20 transition-all"
          >
            Disconnect
          </button>

          {/* Version */}
          <p className="text-[10px] text-gray-700 leading-relaxed">
            GhostScore Protocol v1.0
            <br />
            <span className="text-gray-800">Monad Testnet</span>
          </p>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">

        {/* ── Registration / spinner ── */}
        {!isRegistered && (
          <div className="flex items-center justify-center min-h-full py-12">
            <div className="relative z-10 max-w-sm w-full mx-auto px-6 flex flex-col items-center text-center gap-7">

              {status === "registering" ? (
                <div className="flex flex-col items-center gap-5 py-6">
                  <svg className="animate-spin h-12 w-12 text-emerald-400" viewBox="0 0 24 24">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-gray-300 text-[15px] font-medium tracking-wide">Generating Ghost ID...</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <h2 className="text-[2.6rem] font-black text-white tracking-tight leading-tight">
                      Register Your Agent
                    </h2>
                    <p className="text-gray-400 text-[15px] leading-relaxed">
                      Create a private on-chain identity. Your GhostScore is visible only to you.
                    </p>
                  </div>

                  {/* Connected wallet pill */}
                  <div className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-5 py-3.5">
                    <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1.5">Connected Wallet</p>
                    <code className="text-sm font-mono text-gray-300">{truncateAddress(walletAddress)}</code>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={handleRegister}
                    className="w-full py-4 rounded-xl text-[13px] font-bold tracking-[0.12em] uppercase flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-black shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    Register Agent →
                  </button>

                  <p className="text-[11px] text-gray-600 leading-relaxed -mt-2">
                    This will create a shielded identity on Monad. Gas fee ~0.001 MON
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Dashboard tabs ── */}
        {isRegistered && (
          <>
            {activeTab === "chat" ? (
              <div className="h-full flex flex-col min-h-0 p-4 md:p-6">
                <ChatView
                  agentAddress={walletAddress}
                  currentTier={ghostScore.tier}
                  onPaymentComplete={(res) => {
                    ghostScore.pushEvent({
                      id: `pay-${Date.now()}`,
                      type: "payment:made",
                      timestamp: Date.now(),
                      data: res,
                    });
                  }}
                />
              </div>
            ) : (
              <div className="max-w-5xl mx-auto p-8 w-full">
                {activeTab === "agent" && (
                  <AgentDashboard
                    agentAddress={walletAddress}
                    ghostScore={ghostScore}
                    isNewAgent={isNewRegistration}
                  />
                )}
                {activeTab === "provider" && (
                  <ProviderDashboard events={ghostScore.events} />
                )}
                {activeTab === "compliance" && <ComplianceView />}
              </div>
            )}
          </>
        )}
      </main>

      {/* Power-up cinematic overlay (fixed, triggers when score crosses 50) */}
      {isRegistered && (
        <PowerUpCinematic
          triggered={powerUpTriggered}
          videoSrc="/videos/ghost-evolution.mp4"
          onComplete={handlePowerUpComplete}
        />
      )}
    </div>
  );
}
