import React, { Suspense, lazy, useCallback, useEffect, useReducer, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GameGrid } from "./components/Gamegrid";
import { Modal } from "./components/Modal";
import { RevealFx } from "./components/RevealFx";
import { TurnTimerPicker } from "./components/TurnTimerPicker";
import { primaryButton, secondaryButton } from "./components/buttons";
import {
  PlusCircle,
  Eye,
  EyeOff,
  MessageCircleQuestion,
  Play,
  SkipForward,
  Smartphone,
  Timer,
} from "lucide-react";
import { createGame, gameReducer, getCounts, otherTeam, parseWordList, TOTALS } from "./lib/game";
import { generateRoomId, loadHostSession, normalizeRoomId, saveHostSession } from "./lib/room";
import { relayConfigured } from "./lib/firebaseConfig";
import { useHostRelay } from "./hooks/useHostRelay";
import { formatClock, useTurnTimer } from "./hooks/useTurnTimer";
import wordsContent from './data/words.txt?raw';

// Loaded on first use so the QR code library stays out of the main bundle.
const ConnectModal = lazy(() => import("./components/ConnectModal"));

const WORD_POOL = parseWordList(wordsContent);
const TEAM_NAME = { green: "Green", blue: "Blue" };

// Time left in the turn; click to pause. Ticks by itself so the board doesn't re-render every tick.
function TurnClock({ timer }) {
  const paused = timer.pausedLeft !== null;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (paused) return;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [paused, timer.endsAt]);
  const seconds = Math.ceil((paused ? timer.pausedLeft : Math.max(0, timer.endsAt - now)) / 1000);
  const low = !paused && seconds <= 10;
  return (
    <button
      onClick={timer.togglePause}
      title={paused ? "Resume the turn timer" : "Pause the turn timer"}
      aria-label={`${formatClock(seconds)} left. ${paused ? "Resume" : "Pause"} the turn timer`}
      className={`inline-flex items-center gap-1.5 px-3 border-l border-white/25 text-sm font-semibold tabular-nums transition-colors cursor-pointer ${
        low ? "bg-red-600 animate-pulse" : "bg-black/10 hover:bg-black/25"
      } ${paused ? "text-white/70" : ""}`}
    >
      {paused ? <Play size={14} /> : <Timer size={14} />}
      {formatClock(seconds)}
    </button>
  );
}

function TurnControls({ game, timer, onEndTurn }) {
  if (game.winner) {
    return (
      <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-gray-800 border border-gray-700 font-bold text-gray-100 whitespace-nowrap">
        {TEAM_NAME[game.winner]} won
      </span>
    );
  }
  const glow = game.turn === "green"
    ? "bg-green-600 shadow-[0_0_24px_rgba(34,197,94,0.35)]"
    : "bg-blue-600 shadow-[0_0_24px_rgba(59,130,246,0.35)]";
  // One pill: whose turn it is, then the turn timer if there is one, then End turn as a darker segment.
  return (
    <motion.div
      key={game.turn}
      initial={{ y: -8, scale: 0.85, opacity: 0 }}
      animate={{ y: 0, scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={`inline-flex items-stretch rounded-full overflow-hidden font-bold text-white whitespace-nowrap ${glow}`}
    >
      <span className="inline-flex items-center gap-2 pl-3 pr-3 py-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
        {TEAM_NAME[game.turn]}'s turn
      </span>
      {timer && <TurnClock timer={timer} />}
      <button
        onClick={onEndTurn}
        title={`End ${TEAM_NAME[game.turn]}'s turn`}
        className="inline-flex items-center gap-1.5 pl-2.5 pr-3.5 border-l border-white/25 bg-black/15 hover:bg-black/30 text-sm font-semibold transition-colors cursor-pointer"
      >
        <SkipForward size={14} />
        End turn
      </button>
    </motion.div>
  );
}

function ScorePills({ counts, activeTeam, compact = false }) {
  const pill = compact ? "px-3 py-1.5" : "px-2 py-2";
  const dot = compact ? "w-2 h-2" : "w-3 h-3";
  const text = `${compact ? "text-sm " : ""}font-semibold whitespace-nowrap`;
  return (
    <>
      <div className={`flex items-center gap-2 bg-gradient-to-r from-green-900/50 to-green-800/50 ${pill} rounded-full border border-green-700/50 shadow-sm transition-shadow ${activeTeam === "green" ? "ring-2 ring-green-500 shadow-[0_0_18px_rgba(34,197,94,0.45)]" : ""}`}>
        <div className={`${dot} bg-gradient-to-r from-green-500 to-green-600 rounded-full shadow-sm`}></div>
        <span className={`${text} text-green-200`}>Green: {counts.green}/{TOTALS.green}</span>
      </div>
      <div className={`flex items-center gap-2 bg-gradient-to-r from-blue-900/50 to-blue-800/50 ${pill} rounded-full border border-blue-700/50 shadow-sm transition-shadow ${activeTeam === "blue" ? "ring-2 ring-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.45)]" : ""}`}>
        <div className={`${dot} bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-sm`}></div>
        <span className={`${text} text-blue-200`}>Blue: {counts.blue}/{TOTALS.blue}</span>
      </div>
      <div className={`flex items-center gap-2 bg-gradient-to-r from-gray-800/50 to-gray-700/50 ${pill} rounded-full border border-gray-600/50 shadow-sm`}>
        <div className={`${dot} bg-gradient-to-r from-gray-400 to-gray-500 rounded-full shadow-sm`}></div>
        <span className={`${text} text-gray-300`}>Neutral: {counts.neutral}/{TOTALS.neutral}</span>
      </div>
    </>
  );
}

export default function ClueCrew() {
  const [session] = useState(loadHostSession);
  const [game, dispatch] = useReducer(gameReducer, session.game);
  const [codemasterMode, setCodemasterMode] = useState(false);
  const [dismissedWinFor, setDismissedWinFor] = useState(null);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [showMobileRecommendModal, setShowMobileRecommendModal] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [roomId, setRoomId] = useState(session.roomId);
  const [phonesEnabled, setPhonesEnabled] = useState(relayConfigured && session.phonesEnabled && Boolean(session.roomId));
  const [turnSeconds, setTurnSeconds] = useState(session.turnSeconds);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const relay = useHostRelay({ enabled: phonesEnabled, roomId, game, dispatch });
  const timer = useTurnTimer({ game, seconds: turnSeconds, dispatch });

  useEffect(() => {
    saveHostSession({ roomId, game, phonesEnabled, turnSeconds });
  }, [roomId, game, phonesEnabled, turnSeconds]);

  const openConnect = () => {
    if (!roomId) setRoomId(generateRoomId());
    setPhonesEnabled(true);
    setIsConnectOpen(true);
  };
  const closeConnect = useCallback(() => setIsConnectOpen(false), []);
  // A fresh code starts over: it ends the current game (someone may have seen its key) and
  // disconnects everyone on the old code (that room is deleted). The next game starts by
  // itself once both codemasters have joined the new code.
  const newRoomCode = () => {
    dispatch({ type: "clear" });
    setCodemasterMode(false);
    setDismissedWinFor(null);
    setRoomId(generateRoomId());
  };
  const gameInProgress = Boolean(game) && !game.winner && game.revealed.some(Boolean);

  const joinAsCodemaster = (e) => {
    e.preventDefault();
    const code = normalizeRoomId(joinCode);
    if (code) window.location.search = `?room=${code}`;
  };

  // Animate each new reveal or End Turn exactly once. Starting from the restored
  // event means a refresh doesn't replay the last animation.
  const eventKey = game?.lastEvent ? `${game.gameId}:${game.lastEvent.seq}` : null;
  const seenEventKey = useRef(eventKey);
  const [fx, setFx] = useState(null);
  const [fxDoneKey, setFxDoneKey] = useState(null);
  const onFxDone = useCallback((key) => setFxDoneKey(key), []);
  useEffect(() => {
    if (!eventKey || eventKey === seenEventKey.current) return;
    seenEventKey.current = eventKey;
    const event = game.lastEvent;
    setFx({ key: eventKey, gameId: game.gameId, event, word: event.index !== null ? game.words[event.index] : null, winner: game.winner });
  }, [eventKey, game]);
  // Only the current game's animation plays. The board (and RevealFx) unmounts while there's
  // no game, so without this a new game's board would replay the old game's last reveal.
  const gameFx = fx?.gameId === game?.gameId ? fx : null;
  const fxPlaying = Boolean(gameFx) && gameFx.key === eventKey && fxDoneKey !== gameFx.key;
  const cardFx = gameFx?.event.type === "reveal"
    ? { index: gameFx.event.index, outcome: gameFx.event.outcome, key: gameFx.key }
    : null;

  const startNewGame = () => {
    // With codemaster phones, the old room goes away with the old game: both phones are
    // disconnected and the QR code comes up. The game starts once both have scanned it.
    if (phonesEnabled && game) {
      newRoomCode();
      setIsConnectOpen(true);
      return;
    }
    dispatch({ type: "newGame", game: createGame(WORD_POOL) });
    setCodemasterMode(false);
    setDismissedWinFor(null);
  };

  // With codemaster phones, the game starts by itself once both codemasters have joined.
  const bothCodemastersJoined = phonesEnabled && relay.codemasters.green > 0 && relay.codemasters.blue > 0;
  useEffect(() => {
    if (bothCodemastersJoined && !game) dispatch({ type: "newGame", game: createGame(WORD_POOL) });
  }, [bothCodemastersJoined, game]);

  // Show confirmation before starting a new game if one is in progress
  const confirmAndStartNewGame = () => {
    if (game) {
      setShowNewGameConfirm(true);
    } else {
      if (window.matchMedia('(max-width: 767px)').matches) {
        setShowMobileRecommendModal(true);
      } else {
        startNewGame();
      }
    }
  };

  const handleReveal = (index) => dispatch({ type: "reveal", index, source: "host" });
  const handleEndTurn = () => dispatch({ type: "endTurn", source: "host" });

  const counts = getCounts(game);
  const activeTeam = game && !game.winner ? game.turn : null;
  // Hold the win popup until the winning reveal's animation has finished.
  const showWin = Boolean(game?.winner) && dismissedWinFor !== game.gameId && !fxPlaying;

  return (
    <div className="flex flex-col w-screen h-screen">
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Win Modal */}
          {showWin && (
            <Modal label="Game over" onClose={() => setDismissedWinFor(game.gameId)} className="flex flex-col items-center">
              <div className="text-center mb-6">
                <h2 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  {TEAM_NAME[game.winner]} Team Wins!
                </h2>
                <p className="text-gray-300 text-lg">
                  {game.endReason === "assassin"
                    ? `${TEAM_NAME[otherTeam(game.winner)]} hit the assassin.`
                    : `Every ${game.winner} word found.`}
                </p>
                <div className="text-6xl mt-4">{game.endReason === "assassin" ? "💀" : "🎉"}</div>
              </div>
              <div className="flex gap-4 mt-6">
                <button onClick={startNewGame} className={primaryButton}>
                  Start New Game
                </button>
                <button onClick={() => setDismissedWinFor(game.gameId)} className={secondaryButton}>
                  View Board
                </button>
              </div>
            </Modal>
          )}

          {/* Connect Codemaster Phones Modal */}
          {isConnectOpen && roomId && (
            <Suspense fallback={null}>
              <ConnectModal
                roomId={roomId}
                status={relay.status}
                codemasters={relay.codemasters}
                onNewCode={newRoomCode}
                onRetry={relay.retry}
                onClose={closeConnect}
                startsGame={!game}
                gameInProgress={gameInProgress}
                turnSeconds={turnSeconds}
                onTurnSecondsChange={setTurnSeconds}
              />
            </Suspense>
          )}

          {/* Another tab took over the phone room */}
          {relay.status === "superseded" && (
            <Modal label="Game open in another tab" onClose={() => setPhonesEnabled(false)} className="flex flex-col items-center text-center">
              <h2 className="text-2xl font-bold mb-3 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Phones moved to another tab
              </h2>
              <p className="text-gray-300 mb-8">
                This game was opened in another tab, so the codemaster phones are talking to that one now.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <button onClick={relay.retry} className={primaryButton}>
                  Use this tab
                </button>
                <button onClick={() => setPhonesEnabled(false)} className={secondaryButton}>
                  Keep the other tab
                </button>
              </div>
            </Modal>
          )}

          {/* Help Modal */}
          {isHelpOpen && (
            <Modal label="How to play" width="wide" onClose={() => setIsHelpOpen(false)}>
              <h3 className="text-2xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                How to Play ClueCrew
              </h3>
              {/* Two columns from md up, so the rules fit on a laptop screen without scrolling. */}
              <div className="grid gap-4 md:grid-cols-2 text-sm text-gray-300">
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-900/50 to-blue-800/50 p-4 rounded-xl border border-blue-700/50">
                    <p className="font-semibold text-blue-200 mb-2">Objective:</p>
                    <p>Find all your team's words first.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-r from-green-900/50 to-green-800/50 p-3 rounded-xl border border-green-700/50">
                      <p className="font-semibold text-green-200">Green Team:</p>
                      <p className="text-green-300">9 words</p>
                    </div>
                    <div className="bg-gradient-to-r from-blue-900/50 to-blue-800/50 p-3 rounded-xl border border-blue-700/50">
                      <p className="font-semibold text-blue-200">Blue Team:</p>
                      <p className="text-blue-300">8 words</p>
                    </div>
                    <div className="bg-gradient-to-r from-gray-800/50 to-gray-700/50 p-3 rounded-xl border border-gray-600/50">
                      <p className="font-semibold text-gray-200">Neutral:</p>
                      <p className="text-gray-300">7 words</p>
                    </div>
                    <div className="bg-gradient-to-r from-purple-900/50 to-purple-800/50 p-3 rounded-xl border border-purple-700/50">
                      <p className="font-semibold text-purple-200">Assassin:</p>
                      <p className="text-purple-300">1 word (instant loss)</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-gray-800/50 to-gray-700/50 p-4 rounded-xl border border-gray-600/50">
                    <p className="font-semibold text-gray-200 mb-2">Turns:</p>
                    <p>Keep guessing while you're right. A wrong guess passes the turn, or press <strong>End turn</strong> to stop. With a <strong>turn timer</strong>, the turn also passes when time runs out.</p>
                  </div>
                  <div className="bg-gradient-to-r from-green-900/50 to-green-800/50 p-4 rounded-xl border border-green-700/50">
                    <p className="font-semibold text-green-200 mb-2">Views:</p>
                    <p className="text-green-300"><strong>Codemaster View:</strong> Sees everything.</p>
                    <p className="text-green-300"><strong>Player View:</strong> Sees only revealed words.</p>
                    {relayConfigured && (
                      <p className="text-green-300 mt-2">
                        <strong>Codemaster phones:</strong> each codemaster scans the code from the phone button, sees their words on their phone, and taps the word their team guesses.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-center mt-8 short:mt-6">
                <button onClick={() => setIsHelpOpen(false)} className={primaryButton}>
                  Got it!
                </button>
              </div>
            </Modal>
          )}

          {/* New Game Confirmation Modal */}
          {showNewGameConfirm && (
            <Modal label="Start new game" onClose={() => setShowNewGameConfirm(false)} className="flex flex-col items-center">
              <h2 className="text-3xl font-bold mb-4 text-center bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Start New Game?
              </h2>
              <p className="text-gray-300 text-center mb-8 text-lg">
                A game is already in progress. Starting a new game will overwrite the current one.
                {phonesEnabled && " Both codemaster phones will be disconnected and need to scan a new code."}
              </p>
              <TurnTimerPicker value={turnSeconds} onChange={setTurnSeconds} className="justify-center mb-8" />
              <div className="flex gap-4">
                <button onClick={() => { setShowNewGameConfirm(false); startNewGame(); }} className={primaryButton}>
                  Start New Game
                </button>
                <button onClick={() => setShowNewGameConfirm(false)} className={secondaryButton}>
                  Cancel
                </button>
              </div>
            </Modal>
          )}

          {/* Mobile Recommend Larger Screen Modal */}
          {showMobileRecommendModal && (
            <Modal label="Larger screen recommended" onClose={() => setShowMobileRecommendModal(false)} className="flex flex-col items-center">
              <p className="text-gray-300 text-center mb-8 text-lg">
                We recommend playing on a larger screen 😄
              </p>
              <div className="flex gap-4">
                <button onClick={() => { setShowMobileRecommendModal(false); startNewGame(); }} className={primaryButton}>
                  Continue anyway
                </button>
                <button onClick={() => setShowMobileRecommendModal(false)} className={secondaryButton}>
                  Cancel
                </button>
              </div>
            </Modal>
          )}
          {!game ? (
            // my-auto centers the card but lets it scroll on screens too short for it (justify-center would clip it).
            <div className="flex flex-col items-center flex-1 min-h-0 relative overflow-y-auto overflow-x-hidden bg-gray-900 py-4">
              {/* Background decorative elements */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-pink-600/20 to-purple-600/20 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="relative my-auto text-center bg-gray-800/90 backdrop-blur-xl rounded-3xl p-8 md:p-12 short:py-6 shadow-2xl border border-gray-700/50 max-w-2xl mx-4"
              >
                {/* Title */}
                <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-6 short:mb-3 tracking-tight">
                  ClueCrew
                </h1>

                {/* Subtitle */}
                <p className="text-xl text-gray-300 mb-8 short:mb-4 font-medium">
                  The ultimate word association game for teams
                </p>

                {/* Game description */}
                <div className="mb-8 short:mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
                    <div className="flex items-center gap-2 bg-green-900/30 px-3 py-2 rounded-lg border border-green-700/30">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>Green Team: 9 words</span>
                    </div>
                    <div className="flex items-center gap-2 bg-blue-900/30 px-3 py-2 rounded-lg border border-blue-700/30">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span>Blue Team: 8 words</span>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-800/30 px-3 py-2 rounded-lg border border-gray-600/30">
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                      <span>Neutral: 7 words</span>
                    </div>
                  </div>
                </div>

                {/* Word count */}
                <div className="mb-8 short:mb-4">
                  <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-900/30 to-blue-900/30 px-4 py-2 rounded-full border border-green-700/30">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-300">
                      {WORD_POOL.length} words loaded and ready
                    </span>
                  </div>
                </div>

                <TurnTimerPicker value={turnSeconds} onChange={setTurnSeconds} className="justify-center mb-8 short:mb-4" />

                {/* Start button */}
                <button
                  onClick={confirmAndStartNewGame}
                  className="group relative bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white px-12 py-5 rounded-2xl font-bold text-lg transition-all duration-200 shadow-xl hover:shadow-lg cursor-pointer"
                >
                  <span className="relative z-10 flex items-center gap-3">
                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                      <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Start New Game
                  </span>
                </button>

                {relayConfigured && (
                  <div className="mt-5 flex flex-col items-center gap-3">
                    <button
                      onClick={openConnect}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-pink-500/40 text-pink-300 hover:bg-pink-900/20 font-semibold transition-colors cursor-pointer"
                    >
                      <Smartphone size={18} />
                      Connect codemaster phones
                    </button>
                    {phonesEnabled && (
                      <p className="flex items-center gap-2 text-sm text-gray-400">
                        <span className={`w-2.5 h-2.5 rounded-full ${relay.codemasters.green > 0 ? "bg-green-500" : "bg-gray-600"}`} />
                        <span className={`w-2.5 h-2.5 rounded-full ${relay.codemasters.blue > 0 ? "bg-blue-500" : "bg-gray-600"}`} />
                        The game starts when both codemasters have joined.
                      </p>
                    )}
                    {showJoin ? (
                      <form onSubmit={joinAsCodemaster} className="flex gap-2">
                        <input
                          id="join-code"
                          value={joinCode}
                          onChange={(e) => setJoinCode(e.target.value)}
                          maxLength={6}
                          autoComplete="off"
                          autoCapitalize="characters"
                          aria-label="Room code"
                          placeholder="CODE"
                          className="w-36 h-11 rounded-xl border border-gray-600 bg-gray-900 text-center font-mono font-bold tracking-[0.14em] uppercase text-gray-100 placeholder:text-gray-600"
                        />
                        <button
                          type="submit"
                          disabled={!normalizeRoomId(joinCode)}
                          className="h-11 px-4 rounded-xl bg-gray-700 hover:bg-gray-600 font-semibold text-gray-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                        >
                          Join
                        </button>
                      </form>
                    ) : (
                      <button onClick={() => setShowJoin(true)} className="text-sm text-gray-400 hover:text-gray-200 underline underline-offset-4 cursor-pointer">
                        Codemaster with a room code? Join here
                      </button>
                    )}
                  </div>
                )}

                {/* Footer text */}
                <p className="text-xs text-gray-400 mt-6 short:mt-4">
                  Use the header buttons to toggle codemaster view and access game controls
                </p>
              </motion.div>
            </div>
          ) : (
            <div className="flex flex-col h-full bg-gray-900 relative overflow-hidden">
              {/* Background decorative elements */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-pink-600/20 to-purple-600/20 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
              </div>
              <div className="mb-4 bg-gray-900/90 backdrop-blur-xl p-4 shadow-xl border border-gray-700/50 relative z-10 flex-shrink-0">
                <div className="relative flex items-center justify-between w-full">
                  <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent flex-shrink-0">
                    ClueCrew
                  </h2>
                  {/* Turn and progress - extra-large screens, centered in header (narrower ones run into the header buttons) */}
                  <div className="hidden xl:flex absolute left-1/2 transform -translate-x-1/2 items-center gap-4">
                    <TurnControls game={game} timer={timer} onEndTurn={handleEndTurn} />
                    <div className="flex items-center gap-3">
                      <ScorePills counts={counts} activeTeam={activeTeam} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                    {relayConfigured && (
                      <button
                        onClick={openConnect}
                        title="Connect codemaster phones"
                        aria-label={`Connect codemaster phones (${(relay.codemasters.green > 0) + (relay.codemasters.blue > 0)} of 2 connected)`}
                        className="group relative p-2 text-pink-400 hover:text-pink-300 hover:bg-pink-900/30 rounded-xl transition-all duration-200 w-10 h-10 flex items-center justify-center shadow-sm hover:shadow-md transform hover:scale-105 active:scale-95 border border-pink-600/30 hover:border-pink-500/50 cursor-pointer"
                      >
                        <Smartphone size={18} />
                        {phonesEnabled && (
                          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5 px-1 py-0.5 rounded-full bg-gray-900 border border-gray-700">
                            <span className={`w-1.5 h-1.5 rounded-full ${relay.codemasters.green > 0 ? "bg-green-500" : "bg-gray-600"}`} />
                            <span className={`w-1.5 h-1.5 rounded-full ${relay.codemasters.blue > 0 ? "bg-blue-500" : "bg-gray-600"}`} />
                          </span>
                        )}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1 bg-gray-900 text-gray-100 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap border border-gray-700/50 shadow-lg">
                          Codemaster phones
                        </div>
                      </button>
                    )}
                    <button
                      onClick={confirmAndStartNewGame}
                      title="Start New Game"
                      className="group relative p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded-xl transition-all duration-200 w-10 h-10 flex items-center justify-center shadow-sm hover:shadow-md transform hover:scale-105 active:scale-95 border border-blue-600/30 hover:border-blue-500/50 cursor-pointer"
                    >
                      <PlusCircle size={18} />
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1 bg-gray-900 text-gray-100 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap border border-gray-700/50 shadow-lg">
                        Start New Game
                      </div>
                    </button>
                    <button
                      onClick={() => setCodemasterMode(!codemasterMode)}
                      title={codemasterMode ? "Switch to Player View" : "Switch to Codemaster View"}
                      className="group relative p-2 text-green-400 hover:text-green-300 hover:bg-green-900/30 rounded-xl transition-all duration-200 w-10 h-10 flex items-center justify-center shadow-sm hover:shadow-md transform hover:scale-105 active:scale-95 border border-green-600/30 hover:border-green-500/50 cursor-pointer"
                    >
                      {codemasterMode ? <EyeOff size={18} /> : <Eye size={18} />}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1 bg-gray-900 text-gray-100 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap border border-gray-700/50 shadow-lg">
                        {codemasterMode ? "Switch to Player View" : "Switch to Codemaster View"}
                      </div>
                    </button>
                    <button
                      onClick={() => setIsHelpOpen(true)}
                      title="How to play"
                      className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-900/30 rounded-xl transition-all duration-200 w-10 h-10 flex items-center justify-center shadow-sm hover:shadow-md transform hover:scale-105 active:scale-95 border border-purple-600/30 hover:border-purple-500/50 cursor-pointer"
                    >
                      <MessageCircleQuestion size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 flex flex-col overflow-y-auto relative z-10">
                <GameGrid
                  words={game.words}
                  revealed={game.revealed}
                  roles={game.roles}
                  onReveal={handleReveal}
                  codemasterMode={codemasterMode}
                  cardFx={cardFx}
                />
              </div>
              <RevealFx fx={gameFx} onDone={onFxDone} />

              {/* Turn and score bar - bottom of screen below extra-large screens */}
              <div className="flex xl:hidden flex-shrink-0 justify-center bg-gray-900/90 backdrop-blur-xl p-3 border-t border-gray-700/50 relative z-10 w-full">
                <div className="flex justify-center items-center gap-3 flex-wrap">
                  <TurnControls game={game} timer={timer} onEndTurn={handleEndTurn} />
                  <ScorePills counts={counts} activeTeam={activeTeam} compact />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
