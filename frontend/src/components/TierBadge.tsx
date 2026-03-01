import { TIER_META, type TierLevel } from "../types";

interface Props {
  tier: TierLevel;
  size?: "sm" | "md" | "lg";
}

export function TierBadge({ tier, size = "md" }: Props) {
  const meta = TIER_META[tier];
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${meta.bgColor} ${meta.color} ${sizeClasses[size]}`}
    >
      <span className="inline-block w-2 h-2 rounded-full bg-current" />
      Tier {tier} — {meta.label}
    </span>
  );
}
