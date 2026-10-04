// Public identifiers for the Firebase Realtime Database that relays codemaster
// phone taps. They are not secrets: database.rules.json controls access.
// While they are empty, the codemaster phone feature stays hidden.
export const firebaseConfig = {
  projectId: "",
  databaseURL: "",
};

// Local testing against the Firebase emulator (dev server only). Set VITE_FIREBASE_EMULATOR
// to the emulator's port, e.g. 9000, to reach it on whichever host the page was opened from
// (so phones on the same Wi-Fi work too), or to host:port.
const emulator = import.meta.env.DEV ? import.meta.env.VITE_FIREBASE_EMULATOR : "";
export const emulatorHost = !emulator
  ? null
  : emulator.includes(":")
    ? emulator
    : `${window.location.hostname}:${emulator}`;

export const activeFirebaseConfig = emulatorHost
  ? { projectId: "demo-codenames", databaseURL: "https://demo-codenames-default-rtdb.firebaseio.com" }
  : firebaseConfig;

export const relayConfigured = Boolean(activeFirebaseConfig.projectId && activeFirebaseConfig.databaseURL);
