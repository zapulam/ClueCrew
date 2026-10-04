import React from "react";

const TEAM_NAME = { green: "Green", blue: "Blue" };
const KIND_STYLE = {
  green: "bg-green-500/15 text-green-200",
  blue: "bg-blue-500/15 text-blue-200",
  neutral: "bg-gray-400/15 text-gray-200",
  assassin: "bg-red-500/15 text-red-200",
};
const TEAM_BUTTON = { green: "bg-green-700 hover:bg-green-600", blue: "bg-blue-600 hover:bg-blue-500" };

// Bottom sheet asking the codemaster to confirm a reveal, saying what the word is.
export function ConfirmSheet({ word, role, team, onConfirm, onCancel }) {
  const other = team === "green" ? "blue" : "green";
  let kind;
  let note;
  let confirmLabel = "Reveal";
  let confirmStyle = TEAM_BUTTON[team];
  if (role === team) {
    kind = "Your team's word";
    note = "Reveal it on the big screen?";
  } else if (role === "assassin") {
    kind = "Assassin";
    confirmLabel = "Reveal assassin";
    confirmStyle = "bg-red-700 hover:bg-red-600";
  } else if (role === "neutral") {
    kind = "Free word";
    note = "Your turn ends after this.";
  } else {
    kind = `${TEAM_NAME[role]} team's word`;
    note = `This helps ${TEAM_NAME[role]} and ends your turn.`;
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/55" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Reveal ${word}`}
        className="cn-sheet w-full max-w-md bg-gray-800 rounded-t-3xl border-t border-gray-700 px-5 pt-2.5 pb-[max(env(safe-area-inset-bottom),1.5rem)] grid gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 rounded-full bg-gray-600 justify-self-center" />
        <span className={`justify-self-start text-[11.5px] font-extrabold uppercase tracking-[0.1em] px-2.5 py-1 rounded-lg ${KIND_STYLE[role]}`}>
          {kind}
        </span>
        <div className="text-[34px] font-extrabold tracking-wide leading-tight break-words">{word}?</div>
        {note && <div className="text-[15px] text-gray-400 -mt-1">{note}</div>}
        {role === "assassin" && (
          <div className="text-[15px] text-red-200 bg-red-500/15 border border-red-500/50 rounded-xl px-3 py-2.5">
            This ends the game and {TEAM_NAME[other]} wins. Only reveal it if your team really guessed it.
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5 mt-1">
          <button onClick={onConfirm} className={`min-h-[52px] rounded-2xl text-white font-bold text-base cursor-pointer ${confirmStyle}`}>
            {confirmLabel}
          </button>
          <button onClick={onCancel} className="min-h-[52px] rounded-2xl bg-gray-700 hover:bg-gray-600 text-white font-bold text-base cursor-pointer">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
