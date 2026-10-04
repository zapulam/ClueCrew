import { useEffect, useRef, useState } from "react";
import { sanitizeRequest } from "../lib/game";
import { openHostRoom } from "../lib/relay";
import { randomId } from "../lib/room";

// One id per page load, so a duplicated tab can tell itself apart from the original.
const TAB_ID = randomId();
const NO_CODEMASTERS = { green: 0, blue: 0 };

// Hosts the game in a Firebase room while `enabled`: mirrors `game` to the room and
// feeds phone requests into `dispatch`. Status: off | connecting | live | superseded | error.
export function useHostRelay({ enabled, roomId, game, dispatch }) {
  const [handle, setHandle] = useState(null);
  const [status, setStatus] = useState("connecting");
  const [codemasters, setCodemasters] = useState(NO_CODEMASTERS);
  const [attempt, setAttempt] = useState(0);
  // Lets the cleanup tell "switched to a new code" (delete the old room) from other teardowns.
  const currentRoomId = useRef(roomId);
  currentRoomId.current = roomId;

  useEffect(() => {
    if (!enabled || !roomId) return;
    let closed = false;
    let room = null;
    setStatus("connecting");
    openHostRoom(roomId, {
      tabId: TAB_ID,
      onRequest: (raw) => {
        const action = sanitizeRequest(raw);
        if (action) dispatch(action);
      },
      onCodemasters: (counts) => {
        if (!closed) setCodemasters(counts);
      },
      onSuperseded: () => {
        if (closed) return;
        setHandle(null);
        setCodemasters(NO_CODEMASTERS);
        setStatus("superseded");
      },
    }).then(
      (opened) => {
        room = opened;
        if (closed) {
          opened.close();
        } else if (!opened.superseded) {
          setHandle(opened);
          setStatus("live");
        }
      },
      (error) => {
        console.error(error);
        if (!closed) setStatus("error");
      }
    );
    return () => {
      closed = true;
      room?.close({ retire: currentRoomId.current !== roomId });
      setHandle(null);
      setCodemasters(NO_CODEMASTERS);
    };
  }, [enabled, roomId, dispatch, attempt]);

  useEffect(() => {
    handle?.publish(game);
  }, [handle, game]);

  return {
    status: enabled && roomId ? status : "off",
    codemasters,
    retry: () => setAttempt((n) => n + 1),
  };
}
