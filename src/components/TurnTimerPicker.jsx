import React, { useId } from "react";
import { Timer } from "lucide-react";
import { formatClock, TURN_TIMER_OPTIONS } from "../hooks/useTurnTimer";

// Picks how long each turn lasts. value is in seconds, 0 for no timer.
export function TurnTimerPicker({ value, onChange, className = "" }) {
  const labelId = useId();
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${className}`}>
      <span id={labelId} className="flex items-center gap-1.5 text-sm font-semibold text-gray-300">
        <Timer size={16} />
        Turn timer
      </span>
      <div role="group" aria-labelledby={labelId} className="inline-flex flex-wrap rounded-xl border border-gray-700 bg-gray-800/70 p-1">
        {TURN_TIMER_OPTIONS.map((seconds) => (
          <button
            key={seconds}
            type="button"
            aria-pressed={value === seconds}
            onClick={() => onChange(seconds)}
            className={`px-2.5 py-1 rounded-lg text-sm font-semibold tabular-nums transition-colors cursor-pointer ${
              value === seconds ? "bg-purple-600 text-white" : "text-gray-300 hover:bg-gray-700/60"
            }`}
          >
            {seconds ? formatClock(seconds) : "Off"}
          </button>
        ))}
      </div>
    </div>
  );
}
