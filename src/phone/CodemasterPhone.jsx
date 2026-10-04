import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, SkipForward } from "lucide-react";
import { usePhoneRelay } from "../hooks/usePhoneRelay";
import { relayConfigured } from "../lib/firebaseConfig";
import { otherTeam, outcomeFor } from "../lib/game";
import { loadTeam, normalizeRoomId, saveTeam } from "../lib/room";
import { ConfirmSheet } from "./ConfirmSheet";
import { WordList } from "./WordList";

const TEAM_NAME = { green: "Green", blue: "Blue" };
// If the big screen hasn't applied a tap by then, the phone withdraws it.
const PENDING_TIMEOUT_MS = 5000;
const TOAST_MS = 2200;
const TOAST_STYLE = {
  correct: { green: "bg-green-700 text-white", blue: "bg-blue-600 text-white" },
  opponent: "bg-red-900 text-white",
  free: "bg-gray-600 text-white",
  assassin: "bg-black text-red-200 border border-red-500/50",
  info: "bg-gray-700 text-gray-100",
};

function Wordmark({ className = "" }) {
  return (
    <span className={`font-extrabold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent ${className}`}>
      CodeNames
    </span>
  );
}

function Centered({ children }) {
  return (
    <main className="min-h-dvh bg-gray-900 text-gray-100 grid place-items-center px-6 py-10">
      <div className="w-full max-w-sm grid justify-items-center gap-4 text-center">{children}</div>
    </main>
  );
}

function JoinForm({ initial = "" }) {
  const [code, setCode] = useState(initial);
  const valid = normalizeRoomId(code);
  return (
    <form
      className="flex gap-2 w-full mt-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) window.location.search = `?room=${valid}`;
      }}
    >
      <input
        id="room-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={6}
        autoComplete="off"
        autoCapitalize="characters"
        aria-label="Room code"
        placeholder="CODE"
        className="flex-1 min-w-0 h-12 rounded-xl border border-gray-700 bg-gray-950 text-center font-mono text-lg font-bold tracking-[0.14em] uppercase placeholder:text-gray-600"
      />
      <button type="submit" disabled={!valid} className="h-12 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
        Join
      </button>
    </form>
  );
}

function NotFound({ roomId }) {
  return (
    <Centered>
      <Wordmark className="text-xl" />
      <h1 className="text-2xl font-bold">Game not found</h1>
      <p className="text-gray-400">
        {roomId ? `There's no game with the code ${roomId}.` : "This link is missing a room code."} Scan the QR code on the big
        screen again, or type the code shown there.
      </p>
      <JoinForm />
    </Centered>
  );
}

function TeamPicker({ roomId, onPick }) {
  return (
    <Centered>
      <Wordmark className="text-xl" />
      <span className="font-mono text-xs text-gray-400 px-2 py-1 rounded-md border border-gray-700 tracking-[0.08em]">Room {roomId}</span>
      <h1 className="text-2xl font-bold">Which team are you?</h1>
      <div className="w-full grid gap-3 mt-1">
        <button onClick={() => onPick("green")} className="min-h-[76px] rounded-2xl border border-green-500/40 bg-green-500/15 text-green-200 flex items-center gap-3.5 px-5 text-left cursor-pointer active:scale-[0.98] transition-transform">
          <span className="w-[18px] h-[18px] rounded-full bg-green-500 flex-shrink-0" />
          <span>
            <b className="block text-lg">Green Team</b>
            <span className="block text-[13px] opacity-80">9 words, goes first</span>
          </span>
        </button>
        <button onClick={() => onPick("blue")} className="min-h-[76px] rounded-2xl border border-blue-500/45 bg-blue-500/15 text-blue-200 flex items-center gap-3.5 px-5 text-left cursor-pointer active:scale-[0.98] transition-transform">
          <span className="w-[18px] h-[18px] rounded-full bg-blue-500 flex-shrink-0" />
          <span>
            <b className="block text-lg">Blue Team</b>
            <span className="block text-[13px] opacity-80">8 words</span>
          </span>
        </button>
      </div>
      <p className="text-gray-400 text-[14.5px]">Keep this screen away from your team. It shows every word's color.</p>
    </Centered>
  );
}

// Keeps the phone awake while the word list is showing, where the browser allows it.
function useWakeLock(active) {
  useEffect(() => {
    if (!active || !navigator.wakeLock) return;
    let lock = null;
    let cancelled = false;
    const request = () =>
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (cancelled) l.release();
          else lock = l;
        })
        .catch(() => {});
    const onVisibility = () => {
      if (document.visibilityState === "visible") request();
    };
    request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

function outcomeMessage(outcome, game, index, team) {
  const role = game.roles[index];
  switch (outcome) {
    case "correct":
      return game.winner === team ? "Correct. You found them all!" : "Correct. Keep going.";
    case "opponent":
      return game.winner ? `That was ${TEAM_NAME[role]}'s word. ${TEAM_NAME[game.winner]} wins.` : `That was ${TEAM_NAME[role]}'s word. Turn over.`;
    case "free":
      return "Free word. Turn over.";
    default:
      return "Assassin. Game over.";
  }
}

function PhoneRoom({ roomId }) {
  const room = usePhoneRelay(roomId);
  const { handle, game, hostOnline } = room;
  const [team, setTeam] = useState(() => loadTeam(roomId));
  const [pickingTeam, setPickingTeam] = useState(false);
  // The confirm sheet belongs to one board state: any reveal or turn change closes it.
  const [confirm, setConfirm] = useState(null); // { index, gameId, seq }
  const [pending, setPending] = useState(null); // { key, type, index?, gameId }
  const [toast, setToast] = useState(null); // { id, kind, text }

  useEffect(() => {
    handle?.setTeam(team);
  }, [handle, team]);
  useWakeLock(Boolean(team && game));

  const showToast = useCallback((kind, text) => {
    setToast({ id: Date.now(), kind, text });
    if (kind !== "info") navigator.vibrate?.(kind === "correct" ? 40 : [60, 40, 60]);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  // A tap is confirmed when the board it sent shows up changed.
  useEffect(() => {
    if (!pending || !game) return;
    if (game.gameId !== pending.gameId) {
      setPending(null);
    } else if (pending.type === "reveal" && game.revealed[pending.index]) {
      const event = game.lastEvent;
      const outcome = event?.index === pending.index ? event.outcome : outcomeFor(game.roles[pending.index], team);
      setPending(null);
      showToast(outcome, outcomeMessage(outcome, game, pending.index, team));
    } else if (pending.type === "endTurn" && game.turn !== team) {
      setPending(null);
      showToast("info", `Turn ended. ${TEAM_NAME[game.turn]}'s turn.`);
    }
  }, [game, pending, team, showToast]);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      handle?.cancelRequest(pending.key);
      setPending(null);
      showToast("info", "That didn't go through. Try again.");
    }, PENDING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pending, handle, showToast]);

  if (room.failed) {
    return (
      <Centered>
        <Wordmark className="text-xl" />
        <h1 className="text-2xl font-bold">Couldn't connect</h1>
        <p className="text-gray-400">Check your internet connection and try again.</p>
        <button onClick={() => window.location.reload()} className="h-12 px-6 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold cursor-pointer">
          Try again
        </button>
      </Centered>
    );
  }
  if (!room.loaded) {
    return (
      <Centered>
        <div className="w-10 h-10 rounded-full border-4 border-gray-700 border-t-purple-400 animate-spin" aria-label="Loading" />
      </Centered>
    );
  }
  if (!room.exists) return <NotFound roomId={roomId} />;

  if (!team || pickingTeam) {
    return (
      <TeamPicker
        roomId={roomId}
        onPick={(picked) => {
          saveTeam(roomId, picked);
          setTeam(picked);
          setPickingTeam(false);
        }}
      />
    );
  }

  if (!game) {
    return (
      <Centered>
        <div className="w-10 h-10 rounded-full border-4 border-gray-700 border-t-purple-400 animate-spin" aria-hidden="true" />
        <h1 className="text-2xl font-bold">Waiting for the big screen</h1>
        <p className="text-gray-400">Your words show up here as soon as a game starts. Room {roomId}.</p>
        <button onClick={() => setPickingTeam(true)} className="text-sm text-gray-400 underline underline-offset-4 cursor-pointer">
          You're on {TEAM_NAME[team]} Team. Change team
        </button>
      </Centered>
    );
  }

  const theirs = otherTeam(team);
  const myTurn = !game.winner && game.turn === team;
  const canAct = Boolean(handle) && hostOnline && myTurn && !pending;
  const sheetOpen = confirm && confirm.gameId === game.gameId && confirm.seq === game.seq && !game.revealed[confirm.index];

  const onTap = (index) => {
    if (game.revealed[index] || pending) return;
    if (game.winner) return showToast("info", "The game is over.");
    if (!hostOnline) return showToast("info", "The big screen is offline.");
    if (!myTurn) return showToast("info", `It's ${TEAM_NAME[game.turn]}'s turn. Wait for yours.`);
    setConfirm({ index, gameId: game.gameId, seq: game.seq });
  };
  const reveal = () => {
    const { index } = confirm;
    setConfirm(null);
    if (!canAct) return;
    const key = handle.sendRequest({ type: "reveal", team, gameId: game.gameId, index });
    setPending({ key, type: "reveal", index, gameId: game.gameId });
  };
  const endTurn = () => {
    if (!canAct) return;
    const key = handle.sendRequest({ type: "endTurn", team, gameId: game.gameId });
    setPending({ key, type: "endTurn", gameId: game.gameId });
  };

  let banner;
  if (game.winner) {
    const hitBy = game.endReason === "assassin" ? `${TEAM_NAME[otherTeam(game.winner)]} hit the assassin. ` : "";
    banner = { style: "bg-gray-800/90 border border-gray-700/60 text-gray-100", text: `${hitBy}${TEAM_NAME[game.winner]} wins. Waiting for a new game.` };
  } else if (!hostOnline) {
    banner = { style: "bg-red-900/60 border border-red-500/40 text-red-100", text: "The big screen is offline. Taps are paused until it's back." };
  } else if (myTurn) {
    banner = { style: `${team === "green" ? "bg-green-700" : "bg-blue-600"} text-white`, text: "Your turn. Tap a word when your team guesses it.", pulse: true };
  } else {
    banner = { style: "bg-gray-800/90 border border-gray-700/60 text-gray-400", text: `${TEAM_NAME[theirs]}'s turn. You can look, but taps won't count.` };
  }

  return (
    <main className="min-h-dvh bg-gray-900 text-gray-100 select-none [touch-action:manipulation] [-webkit-touch-callout:none]">
      <div className="max-w-md mx-auto">
        <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-md border-b border-gray-700/50 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 grid gap-2.5">
          <div className="flex items-center justify-between">
            <Wordmark className="text-lg" />
            <span className="font-mono text-xs text-gray-400 px-2 py-0.5 rounded-md border border-gray-700 tracking-[0.08em]">{roomId}</span>
          </div>
          <button
            onClick={() => setPickingTeam(true)}
            className={`justify-self-start inline-flex items-center gap-2 pl-3 pr-2.5 py-1.5 rounded-xl border font-bold text-[15px] cursor-pointer ${
              team === "green" ? "text-green-200 border-green-500/40 bg-green-500/15" : "text-blue-200 border-blue-500/45 bg-blue-500/15"
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${team === "green" ? "bg-green-500" : "bg-blue-500"}`} />
            {TEAM_NAME[team]} Team
            <ChevronDown size={16} className="opacity-70" />
          </button>
          <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold leading-snug ${banner.style}`} role="status">
            <span className={`w-2 h-2 rounded-full bg-current flex-shrink-0 ${banner.pulse ? "animate-pulse" : ""}`} />
            {banner.text}
          </div>
        </header>

        <div className="px-3.5 pt-4 pb-32">
          <WordList game={game} team={team} pendingIndex={pending?.type === "reveal" ? pending.index : null} onTap={onTap} />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-gray-900 from-70% to-transparent px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <div className="max-w-md mx-auto">
          {game.winner ? (
            <p className="text-center text-sm text-gray-400 py-3.5">Game over. Start a new game on the big screen.</p>
          ) : myTurn ? (
            <button
              onClick={endTurn}
              disabled={!canAct}
              className={`w-full min-h-[52px] rounded-2xl text-white font-bold text-base inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                team === "green" ? "bg-green-700 hover:bg-green-600" : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              <SkipForward size={17} />
              {pending?.type === "endTurn" ? "Ending turn…" : "End turn"}
            </button>
          ) : (
            <p className="text-center text-sm text-gray-400 py-3.5">Waiting for {TEAM_NAME[theirs]} to finish guessing…</p>
          )}
        </div>
      </div>

      {toast && (
        <div
          key={toast.id}
          role="status"
          className={`cn-toast fixed left-4 right-4 bottom-24 z-20 max-w-md mx-auto px-4 py-3 rounded-2xl text-[14.5px] font-bold shadow-2xl ${
            toast.kind === "correct" ? TOAST_STYLE.correct[team] : TOAST_STYLE[toast.kind]
          }`}
        >
          {toast.text}
        </div>
      )}

      {sheetOpen && (
        <ConfirmSheet
          word={game.words[confirm.index]}
          role={game.roles[confirm.index]}
          team={team}
          onConfirm={reveal}
          onCancel={() => setConfirm(null)}
        />
      )}
    </main>
  );
}

export default function CodemasterPhone({ initialRoom }) {
  const roomId = normalizeRoomId(initialRoom);
  if (!relayConfigured) {
    return (
      <Centered>
        <Wordmark className="text-xl" />
        <h1 className="text-2xl font-bold">Codemaster phones aren't set up yet</h1>
        <p className="text-gray-400">This copy of CodeNames isn't connected to a phone service, so the big screen can't hear taps.</p>
        <a href={import.meta.env.BASE_URL} className="text-purple-300 underline underline-offset-4">Open the game</a>
      </Centered>
    );
  }
  if (!roomId) return <NotFound roomId={null} />;
  return <PhoneRoom roomId={roomId} />;
}
