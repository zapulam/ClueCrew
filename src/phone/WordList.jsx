import React from "react";
import { Check } from "lucide-react";
import { otherTeam } from "../lib/game";

const SECTION = {
  green: { name: "Green Team", heading: "text-green-200", dot: "bg-green-500", word: "bg-green-500/15 border-green-500/40 text-green-200" },
  blue: { name: "Blue Team", heading: "text-blue-200", dot: "bg-blue-500", word: "bg-blue-500/15 border-blue-500/45 text-blue-200" },
  neutral: { name: "Free", heading: "text-gray-200", dot: "bg-gray-400", word: "bg-gray-400/15 border-gray-400/35 text-gray-200" },
  assassin: { name: "Assassin", heading: "text-red-200", dot: "bg-black ring-[1.5px] ring-red-500", word: "bg-black border-red-500/50 text-red-200" },
};

// Every word grouped by color: your team first, then the other team, Free and Assassin.
// Alphabetical within a group, and guessed words stay in place so nothing moves under a thumb.
export function WordList({ game, team, pendingIndex, onTap }) {
  const order = [team, otherTeam(team), "neutral", "assassin"];
  return (
    <div className="grid gap-5">
      {order.map((role) => {
        const indices = game.roles
          .map((r, i) => (r === role ? i : -1))
          .filter((i) => i >= 0)
          .sort((a, b) => game.words[a].localeCompare(game.words[b]));
        const left = indices.filter((i) => !game.revealed[i]).length;
        const style = SECTION[role];
        return (
          <section key={role} aria-label={style.name} className="grid gap-2">
            <div className="flex items-center justify-between px-0.5">
              <span className={`flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.1em] ${style.heading}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                {style.name}
              </span>
              <span className="text-[12.5px] font-semibold text-gray-400 tabular-nums">
                {role === "assassin" ? (left ? "avoid" : "revealed") : `${left} left`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {indices.map((i) => {
                const done = game.revealed[i];
                const pending = pendingIndex === i;
                return (
                  <button
                    key={i}
                    onClick={() => onTap(i)}
                    aria-disabled={done || undefined}
                    aria-label={done ? `${game.words[i]}, already guessed` : game.words[i]}
                    className={`min-h-12 flex items-center justify-between gap-1.5 px-3 rounded-xl border text-[14.5px] font-bold tracking-wide text-left transition-transform ${style.word} ${
                      done ? "opacity-40 line-through decoration-2 cursor-default" : "active:scale-[0.97] cursor-pointer"
                    }`}
                  >
                    <span className="min-w-0 break-words">{game.words[i]}</span>
                    <span className="flex-shrink-0">
                      {pending ? (
                        <span className="block w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin" aria-label="Sending" />
                      ) : done ? (
                        <Check size={16} strokeWidth={3} />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
