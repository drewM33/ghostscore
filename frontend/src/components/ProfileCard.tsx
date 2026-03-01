import type { AgentProfile } from "../types";

interface Props {
  profile: AgentProfile;
  compact?: boolean;
}

const CAPABILITY_COLORS: Record<string, string> = {
  "market-data": "bg-blue-900/60 text-blue-300",
  payments: "bg-emerald-900/60 text-emerald-300",
  coordination: "bg-purple-900/60 text-purple-300",
  swaps: "bg-amber-900/60 text-amber-300",
  analytics: "bg-cyan-900/60 text-cyan-300",
  bridging: "bg-pink-900/60 text-pink-300",
};

function capColor(cap: string): string {
  return CAPABILITY_COLORS[cap] ?? "bg-gray-700/60 text-gray-300";
}

export function ProfileCard({ profile, compact = false }: Props) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium text-white truncate">{profile.name}</span>
        {profile.capabilities.slice(0, 2).map((c) => (
          <span
            key={c}
            className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${capColor(c)}`}
          >
            {c}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gradient-to-r from-gray-800/60 to-gray-800/30 border border-gray-700/60 p-4 w-full">
      <h3 className="text-lg font-bold text-white">{profile.name}</h3>
      <p className="text-sm text-gray-400 mt-0.5">{profile.description}</p>
      {profile.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {profile.capabilities.map((cap) => (
            <span
              key={cap}
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${capColor(cap)}`}
            >
              {cap}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
