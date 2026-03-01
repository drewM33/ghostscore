import { useEffect, useRef, useState } from "react";

interface Props {
  label: string;
  value: number | string;
  suffix?: string;
  animate?: boolean;
  accent?: string;
}

export function StatsCard({
  label,
  value,
  suffix = "",
  animate = true,
  accent = "text-white",
}: Props) {
  const numericValue = typeof value === "number" ? value : parseFloat(value);
  const isNumeric = !isNaN(numericValue);
  const [displayed, setDisplayed] = useState(numericValue);
  const initialized = useRef(false);

  useEffect(() => {
    if (!isNumeric) return;
    if (!initialized.current) {
      initialized.current = true;
      if (animate) {
        let frame: number;
        const duration = 600;
        const t0 = performance.now();
        const target = numericValue;
        const step = (now: number) => {
          const p = Math.min((now - t0) / duration, 1);
          const eased = 1 - (1 - p) ** 3;
          setDisplayed(target * eased);
          if (p < 1) frame = requestAnimationFrame(step);
        };
        setDisplayed(0);
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
      }
      return;
    }
    setDisplayed(numericValue);
  }, [numericValue, isNumeric, animate]);

  const displayValue = isNumeric
    ? Number.isInteger(numericValue)
      ? Math.round(displayed).toLocaleString()
      : displayed.toFixed(3)
    : String(value);

  return (
    <div className="rounded-xl bg-gray-800/60 border border-gray-700 p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold ${accent}`}>
        {displayValue}
        {suffix && (
          <span className="text-sm text-gray-400 ml-1">{suffix}</span>
        )}
      </p>
    </div>
  );
}
