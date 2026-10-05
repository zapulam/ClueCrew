import React, { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy } from "lucide-react";
import { Modal } from "./Modal";
import { TurnTimerPicker } from "./TurnTimerPicker";
import { primaryButton, secondaryButton } from "./buttons";
import { buildJoinUrl } from "../lib/room";

function StatusRow({ team, count }) {
  const name = team === "green" ? "Green" : "Blue";
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-gray-800/70 border border-gray-700/50 font-semibold">
      <span className="flex items-center gap-2.5">
        <span className={`w-3 h-3 rounded-full ${team === "green" ? "bg-green-500" : "bg-blue-500"}`} />
        {name} codemaster
      </span>
      {count > 0 ? (
        <span className="flex items-center gap-1.5 text-sm text-green-200">
          <Check size={16} strokeWidth={3} />
          {count > 1 ? `${count} phones connected` : "Connected"}
        </span>
      ) : (
        <span className="flex items-center gap-2 text-sm text-gray-400">
          <span className="w-2.5 h-2.5 rounded-full border-2 border-gray-400 animate-pulse" />
          Waiting to scan
        </span>
      )}
    </div>
  );
}

export default function ConnectModal({
  roomId,
  status,
  codemasters,
  onNewCode,
  onRetry,
  onClose,
  startsGame = false,
  gameInProgress = false,
  turnSeconds,
  onTurnSecondsChange,
}) {
  const url = buildJoinUrl(roomId);
  const [copied, setCopied] = useState(false);
  const [autoClosing, setAutoClosing] = useState(false);
  const [confirmingNewCode, setConfirmingNewCode] = useState(false);
  const bothConnected = codemasters.green > 0 && codemasters.blue > 0;

  // Close by itself once the second codemaster joins, so the QR code isn't left up for guessers.
  // startsGame flips to false as soon as that game starts, so remember it from the moment of joining.
  const onCloseRef = useRef(onClose);
  const startsGameRef = useRef(startsGame);
  useEffect(() => {
    onCloseRef.current = onClose;
    startsGameRef.current = startsGame;
  });
  const wasBothConnected = useRef(bothConnected);
  useEffect(() => {
    const justJoined = bothConnected && !wasBothConnected.current;
    wasBothConnected.current = bothConnected;
    if (!justJoined) return;
    setAutoClosing(startsGameRef.current ? "starting" : "closing");
    const timer = setTimeout(() => onCloseRef.current(), 1600);
    return () => clearTimeout(timer);
  }, [bothConnected]);

  useEffect(() => setCopied(false), [roomId]);

  // A new code ends the current game, so ask first if cards have already been revealed.
  const requestNewCode = () => {
    if (gameInProgress) setConfirmingNewCode(true);
    else onNewCode();
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(url).then(() => setCopied(true), () => {});
  };

  return (
    <Modal label="Connect codemaster phones" width="wide" onClose={onClose}>
      <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
        Connect codemaster phones
      </h2>
      <p className="mt-1 text-gray-400 md:text-lg">
        Each codemaster scans this and picks their team.{startsGame && " The game starts as soon as both have joined."} Close it before the guessers can scan it too.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-[280px_minmax(0,1fr)] md:gap-8 items-center">
        <div className="mx-auto w-full max-w-[280px] aspect-square bg-white rounded-2xl p-4">
          <QRCodeSVG
            value={url}
            level="M"
            marginSize={1}
            bgColor="#ffffff"
            fgColor="#111827"
            title={`Join link for room ${roomId}`}
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">Room code</div>
          <div className="mt-1 font-mono text-4xl md:text-5xl font-bold tracking-[0.14em]">{roomId}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-sm text-gray-400 break-all">
            <span>{url.replace(/^https?:\/\//, "")}</span>
            {navigator.clipboard && (
              <button
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-700 font-sans font-semibold text-xs text-gray-100 hover:bg-gray-700/50 cursor-pointer whitespace-nowrap"
              >
                {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy link"}
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-2.5">
            <StatusRow team="green" count={codemasters.green} />
            <StatusRow team="blue" count={codemasters.blue} />
          </div>

          <TurnTimerPicker value={turnSeconds} onChange={onTurnSecondsChange} className="mt-5" />

          {status === "connecting" && <p className="mt-3 text-sm text-gray-400">Connecting to the phone service…</p>}
          {status === "error" && (
            <p className="mt-3 text-sm text-red-300">
              Couldn't reach the phone service. Check the internet connection, then{" "}
              <button onClick={onRetry} className="underline cursor-pointer">try again</button>.
            </p>
          )}
          {autoClosing && bothConnected && (
            <p className="mt-3 text-sm text-green-300">
              Both codemasters are connected. {autoClosing === "starting" ? "Starting the game…" : "Closing…"}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        {confirmingNewCode ? (
          <>
            <p key="warning" className="w-full text-sm md:text-base text-amber-200">
              This ends the current game and disconnects both phones.
            </p>
            <button
              key="start-over"
              onClick={() => {
                setConfirmingNewCode(false);
                onNewCode();
              }}
              className="bg-red-700 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-semibold cursor-pointer transition-colors shadow-lg"
            >
              Start over
            </button>
            <button key="cancel" onClick={() => setConfirmingNewCode(false)} className={secondaryButton}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button key="new-code" onClick={requestNewCode} className={secondaryButton} title="End this game and show a fresh code">
              New code
            </button>
            <button key="done" onClick={onClose} className={primaryButton}>
              Done
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
