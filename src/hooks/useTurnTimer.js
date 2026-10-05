import { useEffect, useState } from "react";

// Turn lengths the host can pick, in seconds. 0 means no timer.
export const TURN_TIMER_OPTIONS = [0, 30, 60, 90, 120, 180];

export function formatClock(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// Times each turn on the big screen. It's only a guide: running out shows "Time's up" but
// leaves the turn alone, which still passes on a wrong guess or End turn. The clock restarts
// when the turn passes, a new game starts or the length changes. It lives on this screen
// only: the database rules don't know about timers, so nothing about it goes to the phones.
// Returns null while there's no clock to show, else { endsAt, pausedLeft, togglePause },
// where pausedLeft is the milliseconds left while paused and null while running.
export function useTurnTimer({ game, seconds }) {
  const gameId = game?.gameId;
  const team = game?.turn;
  const turnKey = seconds > 0 && game && !game.winner ? `${gameId}:${team}:${seconds}` : null;
  const [clock, setClock] = useState(null); // { key, endsAt, pausedLeft }

  useEffect(() => {
    if (!turnKey) return;
    setClock({ key: turnKey, endsAt: Date.now() + seconds * 1000, pausedLeft: null });
  }, [turnKey, seconds]);

  if (clock === null || clock.key !== turnKey) return null;
  const togglePause = () => {
    const at = Date.now();
    setClock((c) =>
      c.pausedLeft === null
        ? { ...c, pausedLeft: Math.max(0, c.endsAt - at) }
        : { ...c, endsAt: at + c.pausedLeft, pausedLeft: null }
    );
  };
  return { endsAt: clock.endsAt, pausedLeft: clock.pausedLeft, togglePause };
}
