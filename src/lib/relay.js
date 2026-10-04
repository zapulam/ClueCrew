// Talks to Firebase Realtime Database so codemaster phones can reach the big screen.
//
// rooms/{roomId}/
//   meta         { v, createdAt }       written when the big screen opens the room
//   host         { tabId, at }          the big screen's presence
//   codemasters  { [connectionId]: { team, clientId, at } }
//   game         the board, written only by the big screen
//   requests     { [pushId]: { type, team, gameId, index?, clientId, at } } pushed by phones
import { fromWire, toWire } from "./game.js";
import { activeFirebaseConfig, emulatorHost } from "./firebaseConfig.js";
import { getClientId, randomId } from "./room.js";

let sdkPromise = null;

// Firebase is only downloaded once someone turns on codemaster phones.
function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = Promise.all([import("firebase/app"), import("firebase/database")]).then(([app, database]) => {
      const firebaseApp = app.getApps().length ? app.getApp() : app.initializeApp(activeFirebaseConfig);
      const db = database.getDatabase(firebaseApp);
      if (emulatorHost) {
        const [host, port] = emulatorHost.split(":");
        try {
          database.connectDatabaseEmulator(db, host, Number(port));
        } catch {
          // Already connected (after a hot reload).
        }
      }
      return { db, ...database };
    });
  }
  return sdkPromise;
}

// Writes a presence value now and after every reconnect, and has the server remove it
// when the connection drops. Returns stop({ keep }) to stop and (unless keep) remove it.
function keepPresent(sdk, path, value) {
  const { db, ref, onValue, onDisconnect, set, remove, serverTimestamp } = sdk;
  const node = ref(db, path);
  let active = true;
  const unsubscribe = onValue(ref(db, ".info/connected"), (snap) => {
    if (snap.val() !== true || !active) return;
    onDisconnect(node)
      .remove()
      .then(() => active && set(node, { ...value, at: serverTimestamp() }))
      .catch(console.error);
  });
  return ({ keep = false } = {}) => {
    if (!active) return;
    active = false;
    unsubscribe();
    onDisconnect(node).cancel().catch(() => {});
    if (!keep) remove(node).catch(() => {});
  };
}

// The big screen. Phone requests are removed as soon as they arrive and handed to
// onRequest. If another tab takes over the room, this one stops and calls onSuperseded.
export async function openHostRoom(roomId, { tabId, onRequest, onCodemasters, onSuperseded }) {
  const sdk = await loadSdk();
  const { db, ref, set, update, remove, onValue, onChildAdded, serverTimestamp } = sdk;
  const room = `rooms/${roomId}`;
  await update(ref(db, room), { meta: { v: 1, createdAt: serverTimestamp() } });

  let closed = false;
  let claimed = false;
  let superseded = false;
  const unsubscribes = [];
  const stopHost = keepPresent(sdk, `${room}/host`, { tabId });

  const close = ({ retire = false } = {}) => {
    if (closed) return;
    closed = true;
    unsubscribes.forEach((unsubscribe) => unsubscribe());
    stopHost({ keep: superseded || retire });
    // Retiring a room (New code) deletes it, so phones still on it see "Game not found".
    if (retire) remove(ref(db, room)).catch(console.error);
  };

  const hostRef = ref(db, `${room}/host`);
  unsubscribes.push(
    onValue(hostRef, (snap) => {
      const host = snap.val();
      if (host?.tabId === tabId) {
        claimed = true;
      } else if (!host) {
        // A previous page load's disconnect cleanup can land after we claimed: reclaim.
        if (claimed && !closed) set(hostRef, { tabId, at: serverTimestamp() }).catch(console.error);
      } else if (claimed && !closed) {
        superseded = true;
        close();
        onSuperseded();
      }
    })
  );

  unsubscribes.push(
    onValue(ref(db, `${room}/codemasters`), (snap) => {
      const counts = { green: 0, blue: 0 };
      snap.forEach((child) => {
        const team = child.val()?.team;
        if (team in counts) counts[team]++;
      });
      onCodemasters(counts);
    })
  );

  unsubscribes.push(
    onChildAdded(ref(db, `${room}/requests`), (snap) => {
      remove(snap.ref).catch(console.error);
      onRequest(snap.val());
    })
  );

  return {
    publish(game) {
      if (!closed) set(ref(db, `${room}/game`), toWire(game)).catch(console.error);
    },
    close,
    get superseded() {
      return superseded;
    },
  };
}

// A codemaster's phone. onRoom receives { loaded, exists, game, hostOnline } on every change.
export async function openPhoneRoom(roomId, { onRoom }) {
  const sdk = await loadSdk();
  const { db, ref, set, push, remove, onValue, serverTimestamp } = sdk;
  const room = `rooms/${roomId}`;
  const clientId = getClientId();
  // One presence entry per page load, so a reload's late disconnect cleanup
  // can't remove the new page's entry.
  const connectionId = randomId();

  let state = { loaded: false, exists: false, game: null, hostOnline: false };
  const emit = (patch) => {
    state = { ...state, ...patch };
    onRoom(state);
  };
  const unsubscribes = [
    onValue(
      ref(db, `${room}/meta`),
      (snap) => emit({ loaded: true, exists: snap.exists() }),
      () => emit({ loaded: true, exists: false })
    ),
    onValue(ref(db, `${room}/game`), (snap) => emit({ game: fromWire(snap.val()) })),
    onValue(ref(db, `${room}/host`), (snap) => emit({ hostOnline: snap.exists() })),
  ];
  let stopPresence = null;

  return {
    setTeam(team) {
      stopPresence?.();
      stopPresence = team ? keepPresent(sdk, `${room}/codemasters/${connectionId}`, { team, clientId }) : null;
    },
    // request: { type: 'reveal', team, gameId, index } or { type: 'endTurn', team, gameId }
    sendRequest(request) {
      const node = push(ref(db, `${room}/requests`));
      set(node, { ...request, clientId, at: serverTimestamp() }).catch(console.error);
      return node.key;
    },
    cancelRequest(key) {
      remove(ref(db, `${room}/requests/${key}`)).catch(() => {});
    },
    close() {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
      stopPresence?.();
    },
  };
}
