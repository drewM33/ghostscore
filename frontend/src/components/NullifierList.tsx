import { useState } from "react";
import type { NullifierEntry } from "../types";

interface Props {
  nullifiers: NullifierEntry[];
  title?: string;
}

export function NullifierList({
  nullifiers,
  title = "Nullifier History",
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const safe = Array.isArray(nullifiers) ? nullifiers : [];
  const display = expanded ? safe : safe.slice(0, 3);

  function formatTime(ts: number) {
    return new Date(ts * 1000).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function truncateHash(hash: string) {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        {title} ({safe.length})
      </button>

      {display.length > 0 && (
        <div className="space-y-1">
          {display.map((n) => (
            <div
              key={n.hash}
              className="flex items-center justify-between px-3 py-1.5 rounded bg-gray-800/50 text-xs"
            >
              <code className="text-emerald-400 font-mono">
                {truncateHash(n.hash)}
              </code>
              <span className="text-gray-500">{formatTime(n.timestamp)}</span>
            </div>
          ))}
          {!expanded && safe.length > 3 && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-emerald-400 hover:text-emerald-300 pl-3"
            >
              +{safe.length - 3} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
