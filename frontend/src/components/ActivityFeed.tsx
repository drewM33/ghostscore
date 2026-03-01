import type { ReactNode } from "react";
import type { GhostEvent } from "../types";

interface Props {
  events: GhostEvent[];
}

const EXPLORER = "https://testnet.monadscan.com/tx/";

const EVENT_ICONS: Record<GhostEvent["type"], string> = {
  "score:updated": "📈",
  "tier:changed": "🏆",
  "api:called": "🔗",
  "validation:new": "✅",
  "payment:made": "💸",
};

const EVENT_COLORS: Record<GhostEvent["type"], string> = {
  "score:updated": "border-emerald-500/40",
  "tier:changed": "border-amber-500/40",
  "api:called": "border-blue-500/40",
  "validation:new": "border-purple-500/40",
  "payment:made": "border-cyan-500/40",
};

function TxLink({ hash }: { hash: string }) {
  return (
    <a
      href={`${EXPLORER}${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-teal-400 underline underline-offset-2 decoration-teal-400/40 hover:text-teal-300 hover:decoration-teal-300/60 transition-colors"
    >
      {hash.slice(0, 10)}...
    </a>
  );
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
      return (
        <>
          Payment: {String(d.amount ?? "?")} MON
          {hash && <> (<TxLink hash={hash} />)</>}
        </>
      );
    }
    default:
      return JSON.stringify(d);
  }
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function ActivityFeed({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="text-gray-500 text-sm py-8 text-center">
        No events yet. Make a payment to get started.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
      {events.map((evt) => (
        <div
          key={evt.id}
          className={`flex items-start gap-3 px-3 py-2 rounded-lg bg-gray-800/50 border-l-2 ${EVENT_COLORS[evt.type]} animate-[fadeIn_0.3s_ease-out]`}
        >
          <span className="text-lg mt-0.5">{EVENT_ICONS[evt.type]}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-200">
              {formatEventMessage(evt)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {timeAgo(evt.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
