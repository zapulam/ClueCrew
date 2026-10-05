import React, { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Check, Timer, X } from "lucide-react";
import { otherTeam } from "../lib/game";

const TEAM_NAME = { green: "Green", blue: "Blue" };
const CONFETTI = {
  green: ["#22c55e", "#4ade80", "#bbf7d0", "#ffffff", "#fde68a"],
  blue: ["#3b82f6", "#60a5fa", "#bfdbfe", "#ffffff", "#fde68a"],
};
// How long each banner stays up before it leaves (ms).
const HOLD = { correct: 1500, opponent: 1700, free: 1500, endTurn: 1400 };
const EXIT = 550;
const CARD_FLIP = 380;
const ASSASSIN_START = 420;
const ASSASSIN_END = 2500;

function cardOrigin(index) {
  const card = document.querySelector(`[data-card-index="${index}"]`);
  if (!card) return { x: 0.5, y: 0.5 };
  const r = card.getBoundingClientRect();
  return { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight };
}

function burst(index, team) {
  confetti({
    particleCount: 90,
    spread: 75,
    startVelocity: 38,
    origin: cardOrigin(index),
    colors: CONFETTI[team],
    scalar: 0.9,
    ticks: 160,
    disableForReducedMotion: true,
  });
}

function celebrate(team) {
  const end = Date.now() + 1200;
  let frame;
  const tick = () => {
    confetti({ particleCount: 7, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors: CONFETTI[team], disableForReducedMotion: true });
    confetti({ particleCount: 7, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors: CONFETTI[team], disableForReducedMotion: true });
    if (Date.now() < end) frame = requestAnimationFrame(tick);
  };
  tick();
  return () => cancelAnimationFrame(frame);
}

function describe(fx) {
  const { event, word, winner } = fx;
  const team = TEAM_NAME[event.team];
  const next = TEAM_NAME[otherTeam(event.team)];
  if (event.type === "endTurn") {
    return event.source === "timer" ? `Time's up. ${next}'s turn.` : `${team} ended their turn. ${next}'s turn.`;
  }
  switch (event.outcome) {
    case "correct":
      return winner ? `${word}. Correct! That's all of them. ${team} wins.` : `${word}. Correct! ${team} keeps guessing.`;
    case "opponent":
      return winner ? `${word}. ${next}'s word. ${next} wins.` : `${word}. ${next}'s word. ${next}'s turn.`;
    case "free":
      return `${word}. Miss, free word. ${next}'s turn.`;
    default:
      return `${word} is the assassin. ${team} hit the assassin. ${next} wins.`;
  }
}

// Plays the animation for the latest reveal or End Turn, then calls onDone(fx.key).
// fx = { key, event, word, winner }, where event is the game's lastEvent.
export function RevealFx({ fx, onDone }) {
  const [stage, setStage] = useState({ key: null, phase: "in" });
  const phase = fx && stage.key === fx.key ? stage.phase : "in";

  useEffect(() => {
    if (!fx) return;
    const { key, event, winner } = fx;
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const set = (next) => setStage({ key, phase: next });
    let stopCelebrating;

    if (event.outcome === "assassin") {
      at(ASSASSIN_START, () => set("assassin"));
      at(ASSASSIN_END, () => {
        set("done");
        onDone(key);
      });
    } else {
      const hold = HOLD[event.type === "endTurn" ? "endTurn" : event.outcome];
      if (event.outcome === "correct") at(CARD_FLIP, () => burst(event.index, event.team));
      at(hold, () => set("out"));
      at(hold + EXIT, () => {
        set("done");
        if (winner) stopCelebrating = celebrate(winner);
        onDone(key);
      });
    }
    return () => {
      timers.forEach(clearTimeout);
      stopCelebrating?.();
    };
  }, [fx, onDone]);

  return (
    <>
      <div className="sr-only" aria-live="polite">{fx ? describe(fx) : ""}</div>
      {fx && phase !== "done" && <FxLayer fx={fx} phase={phase} />}
    </>
  );
}

function FxLayer({ fx, phase }) {
  const { event, word, winner } = fx;
  const team = TEAM_NAME[event.team];
  const next = TEAM_NAME[otherTeam(event.team)];

  if (event.outcome === "assassin") {
    if (phase !== "assassin") return null;
    return (
      <div className="cn-assassin fixed inset-0 z-40 grid place-items-center bg-black/85">
        <div className="cn-assassin-content relative text-center px-4">
          <div className="cn-skull text-[120px] md:text-[190px] leading-none" aria-hidden="true">💀</div>
          <div className="mt-2 text-xl md:text-3xl font-extrabold tracking-[0.14em] uppercase text-red-200">
            {team} hit the assassin
          </div>
        </div>
      </div>
    );
  }

  let style;
  let line;
  if (event.type === "endTurn" && event.source === "timer") {
    style = "bg-gray-800/95 border-2 border-amber-400/70 text-amber-100 px-8 py-4";
    line = (
      <>
        <Timer size={24} strokeWidth={2.5} />
        Time's up! {next}'s turn.
      </>
    );
  } else if (event.type === "endTurn") {
    style = "bg-gray-800/95 border border-gray-700 text-gray-100 px-8 py-4";
    line = `${team} ended their turn. ${next}'s turn.`;
  } else if (event.outcome === "correct") {
    style = `${event.team === "blue" ? "bg-blue-600" : "bg-green-600"} text-white`;
    line = (
      <>
        <Check size={26} strokeWidth={3} />
        {winner ? "Correct! That's all of them." : `Correct! ${team} keeps guessing.`}
      </>
    );
  } else if (event.outcome === "opponent") {
    style = "bg-gray-900/95 border-[3px] border-red-500 text-white";
    line = (
      <>
        <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-red-500 grid place-items-center">
          <X size={18} strokeWidth={3} />
        </span>
        <span className="text-red-200">{winner ? `${next}'s word.` : `${next}'s word. ${next}'s turn.`}</span>
      </>
    );
  } else {
    style = "bg-gray-600 text-gray-50";
    line = `Miss. Free word. ${next}'s turn.`;
  }

  return (
    <>
      {event.outcome === "opponent" && <div className="cn-flash fixed inset-0 z-30 pointer-events-none" />}
      <div className="fixed inset-0 z-40 grid place-items-center pointer-events-none px-4">
        <div
          className={`cn-banner ${phase === "out" ? "is-out" : ""} ${event.outcome === "free" ? "is-free" : ""} grid justify-items-center gap-1.5 rounded-3xl px-8 md:px-12 py-5 md:py-6 shadow-2xl text-center ${style}`}
        >
          {word && event.type !== "endTurn" && (
            <div className="text-4xl md:text-6xl font-extrabold tracking-wide leading-none">{word}</div>
          )}
          <div className="text-base md:text-2xl font-semibold flex items-center gap-2.5">{line}</div>
        </div>
      </div>
    </>
  );
}
