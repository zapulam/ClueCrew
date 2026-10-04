import { useEffect, useState } from "react";
import { openPhoneRoom } from "../lib/relay";

const LOADING = { loaded: false, exists: false, game: null, hostOnline: false };

// Follows a room from a codemaster's phone. `handle` is null until connected.
export function usePhoneRelay(roomId) {
  const [room, setRoom] = useState(LOADING);
  const [handle, setHandle] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    let closed = false;
    let opened = null;
    setRoom(LOADING);
    setFailed(false);
    openPhoneRoom(roomId, {
      onRoom: (next) => {
        if (!closed) setRoom(next);
      },
    }).then(
      (h) => {
        opened = h;
        if (closed) h.close();
        else setHandle(h);
      },
      (error) => {
        console.error(error);
        if (!closed) setFailed(true);
      }
    );
    return () => {
      closed = true;
      opened?.close();
      setHandle(null);
    };
  }, [roomId]);

  return { ...room, handle, failed };
}
