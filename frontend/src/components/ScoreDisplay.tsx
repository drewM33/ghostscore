import { useEffect, useRef, useState } from "react";
import { TIER_META, type TierLevel } from "../types";

interface Props {
  score: number;
  tier: TierLevel;
  animate?: boolean;
}

const RING_RADIUS = 90;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const TIER_THRESHOLDS = [20, 50, 80] as const;

export function ScoreDisplay({ score, tier, animate = true }: Props) {
  const [displayed, setDisplayed] = useState(animate ? 0 : score);
  const prevTier = useRef(tier);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (!animate) {
      setDisplayed(score);
      return;
    }
    let frame: number;
    const start = displayed;
    const delta = score - start;
    const duration = Math.max(400, Math.abs(delta) * 60);
    const t0 = performance.now();

    const step = (now: number) => {
      const elapsed = now - t0;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayed(Math.round(start + delta * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, animate]);

  useEffect(() => {
    if (tier > prevTier.current) {
      setCelebrating(true);
      const id = setTimeout(() => setCelebrating(false), 1200);
      prevTier.current = tier;
      return () => clearTimeout(id);
    }
    prevTier.current = tier;
  }, [tier]);

  const offset = CIRCUMFERENCE - (displayed / 100) * CIRCUMFERENCE;
  const meta = TIER_META[tier];

  const strokeColor =
    tier === 3
      ? "#f59e0b"
      : tier === 2
        ? "#3b82f6"
        : tier === 1
          ? "#10b981"
          : "#6b7280";

  return (
    <div className="relative flex flex-col items-center">
      {celebrating && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="animate-ping rounded-full h-48 w-48 border-4 border-current opacity-30" style={{ borderColor: strokeColor }} />
        </div>
      )}

      <svg width="220" height="220" className="drop-shadow-lg">
        <circle
          cx="110"
          cy="110"
          r={RING_RADIUS}
          fill="none"
          stroke="#1f2937"
          strokeWidth="12"
        />

        {TIER_THRESHOLDS.map((t) => {
          const angle = (t / 100) * 360 - 90;
          const rad = (angle * Math.PI) / 180;
          const x = 110 + (RING_RADIUS + 14) * Math.cos(rad);
          const y = 110 + (RING_RADIUS + 14) * Math.sin(rad);
          return (
            <g key={t}>
              <circle
                cx={110 + RING_RADIUS * Math.cos(rad)}
                cy={110 + RING_RADIUS * Math.sin(rad)}
                r="3"
                fill={displayed >= t ? strokeColor : "#4b5563"}
              />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-gray-500 text-[10px]"
              >
                {t}
              </text>
            </g>
          );
        })}

        <circle
          cx="110"
          cy="110"
          r={RING_RADIUS}
          fill="none"
          stroke={strokeColor}
          strokeWidth="12"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 110 110)"
          className="transition-all duration-300"
        />

        <text
          x="110"
          y="100"
          textAnchor="middle"
          className="fill-white text-4xl font-bold"
        >
          {displayed}
        </text>
        <text
          x="110"
          y="128"
          textAnchor="middle"
          className={`text-sm font-medium ${meta.color}`}
        >
          {meta.label}
        </text>
      </svg>
    </div>
  );
}
